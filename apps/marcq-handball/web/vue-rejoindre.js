// vue-rejoindre.js — ce qui est DIT quand on rejoint le classement.
//
// L'autre moitie est web/classement.js, qui decide ce qui est ENVOYE. La
// separation est ce qui rend verifiable, sans navigateur, la garantie du PRD §5 :
// aucun de ces deux modules ne lit le nom que le PRP 03 garde sur le telephone,
// et un test lit leur source pour le prouver — commentaires compris.
//
// Aucune animation n'appartient a ce fichier. Le PRD §10 reserve le mouvement a
// « grimper au classement », qui est du ressort du PRP 09 ; un ecran de
// consentement qui s'anime demanderait d'attendre pour lire ce qu'il faut lire.

import { EVT_CLASSEMENT, empreinte, envoiNecessaire, envoyer, retirer, supprimer, synchroniser } from './classement.js';
import { ecrireClassement, fusionnerFaits, lireClassement, lireFaits, lireRessentis } from './etat.js';
import { empreinteRessentis, ressentisPourEnvoi } from './ressenti.js';
import { dateEnToutesLettres } from './vue-jour.js';

// --- ce que le PRD §7.4 fait dire, mot pour mot ----------------------------

// Ces cinq phrases ne se reformulent pas : le PRD les a pesees, et
// tests/rejoindre.test.js les compare au bloc de citation du document lui-meme,
// lu dans le depot. Une reformulation, meme heureuse, fait tomber le test.
export const CONSENTEMENT = {
  titre: 'Avant de rejoindre le classement',
  avertissement: 'Le nom que tu choisis ici sera visible par tout le monde sur Internet, avec ta progression. Cette page n’est pas protégée par un mot de passe.',
  // Le fragment que le PRD met en gras, entoure d'un <strong> au montage.
  fort: 'par tout le monde sur Internet',
  surLeTelephone: 'Ton prénom, lui, reste sur ton téléphone.',
  parent: 'Montre cet écran à un parent avant de continuer.',
  continuer: 'Choisir un nom et rejoindre',
  refuser: 'Non merci',
};

// L'etape 2 remplace l'etape 1 dans le meme hote. Le bloc entier repete serait
// du bruit ; le bloc entier scrolle hors de l'ecran laisserait le champ decisif
// sans contexte, au moment precis ou un parent regarde.
export const RAPPEL_CHOIX = 'Ce nom sera visible par tout le monde sur Internet.';

// « Sans exageration » (PRD §7.4). Pas de second champ de confirmation, pas
// d'indicateur de robustesse, pas de « choisis un code difficile » : un
// appareillage de mot de passe autour de quatre chiffres dirait le contraire de
// la phrase qui l'accompagne.
export const EXPLICATION_CODE = 'Ce code empêche quelqu’un d’autre de modifier ton score depuis un autre téléphone. Ce n’est pas un mot de passe : il n’y a rien de sensible sur le serveur.';

export const TEXTE_REJOINDRE = 'Apparaître au classement';

// Le titre de l'ecran qui porte l'onglet, et l'onglet lui-meme. Le PRD §7.5
// appelle ce bloc « L'equipe » et non « le classement » : on y lit un podium,
// une position ET une jauge de groupe, la seule mesure ou personne n'est
// dernier. Nommer l'onglet « Classement » promettrait un tableau complet, que
// le §9 refuse d'afficher.
export const TITRE_ECRAN_CLASSEMENT = 'L’équipe';

// L'ecran vers lequel on revient apres avoir rejoint ou refuse. C'est celui qui
// porte le bouton menant ici, et il n'a qu'une definition : deux copies
// divergeraient le jour ou la route change.
export const RETOUR_CLASSEMENT = '#/equipe';

// --- le pseudonyme ---------------------------------------------------------

// Aucun de ces mots n'est un nom de personne, aucun ne renvoie au club ni a la
// ville. 24 x 90 = 2160 tirages : dans un groupe de vingt, une collision arrive
// une fois sur onze — le serveur repond alors 403 et l'ecran propose autre chose.
export const MOTS_PSEUDO = ['Renard', 'Faucon', 'Comète', 'Bourrasque', 'Silex',
  'Cyclone', 'Panthère', 'Aigle', 'Tornade', 'Orage', 'Éclair', 'Braise',
  'Requin', 'Vipère', 'Lynx', 'Bison', 'Cobra', 'Météore', 'Mirage', 'Sirocco',
  'Granit', 'Obsidienne', 'Mustang', 'Typhon'];

// LA SIGNATURE EST LA GARANTIE. Cette fonction ne recoit que sa source d'alea :
// elle ne peut pas deriver de ce que le PRP 03 garde sur le telephone, parce
// qu'elle ne le voit pas. C'est plus solide qu'une consigne, et un test d'arite
// le verifie.
export function proposerPseudo(alea = Math.random) {
  const mot = MOTS_PSEUDO[Math.floor(alea() * MOTS_PSEUDO.length) % MOTS_PSEUDO.length];
  const nombre = 10 + Math.floor(alea() * 90) % 90;
  return `${mot}-${nombre}`;
}

// Le meme jeu de caracteres que le serveur : lettres Unicode, chiffres, espace,
// tiret, apostrophe droite, tiret bas. Ni point ni autre ponctuation — le
// PRP 07 les refuse, et un motif client plus large ferait tomber une saisie
// valide a l'ecran en 400 au retour du reseau.
export const MOTIF_PSEUDO = /^[\p{L}\p{N} '\-_]{2,16}$/u;
export const MOTIF_CODE = /^\d{4}$/;

const PSEUDO_MIN = 2;
const PSEUDO_MAX = 16;

// Normalise puis valide. Les suites d'ESPACES sont reduites a une seule ; un
// saut de ligne interne, lui, survit et fait echouer le motif — coller trois
// lignes depuis une note n'est pas un pseudonyme.
//
// NFC evite qu'un « e » suivi d'un accent combinant cree un jumeau invisible
// d'un pseudonyme existant. Le serveur, lui, REFUSE les marques combinantes
// faute de pouvoir normaliser en Go : sans ce NFC, une saisie decomposee
// partirait en 400 alors qu'elle s'affiche correctement.
//
// L'apostrophe typographique est ramenee a la droite : un clavier de telephone
// produit la premiere, et le serveur n'accepte que la seconde.
export function validerPseudo(saisie) {
  const valeur = String(saisie ?? '')
    .trim()
    .replace(/ +/g, ' ')
    .replace(/’/g, "'")
    .normalize('NFC');

  if (valeur === '') return { valeur, erreur: 'vide' };
  // Compte en RUNES : « Léa » et « Lea » ont la meme limite.
  const runes = [...valeur].length;
  if (runes < PSEUDO_MIN) return { valeur, erreur: 'trop-court' };
  // 16 runes : au-dela, le podium deborde sur un ecran de 320 px.
  if (runes > PSEUDO_MAX) return { valeur, erreur: 'trop-long' };
  if (!MOTIF_PSEUDO.test(valeur)) return { valeur, erreur: 'caracteres' };
  return { valeur, erreur: null };
}

export function validerCode(saisie) {
  const valeur = String(saisie ?? '').trim();
  return MOTIF_CODE.test(valeur) ? { valeur, erreur: null } : { valeur, erreur: 'longueur' };
}

export const ERREURS_PSEUDO = {
  vide: 'Il faut un nom, même court.',
  'trop-court': 'Il faut au moins deux caractères.',
  'trop-long': 'Seize caractères au maximum.',
  caracteres: 'Les emojis et les caractères spéciaux ne passent pas ici.',
};

export const ERREURS_CODE = { longueur: 'Le code doit faire exactement quatre chiffres.' };

// --- refuser en dernier recours --------------------------------------------

// LE MEILLEUR MESSAGE D'ERREUR EST CELUI QU'ON N'AFFICHE PAS. Un emoji dans un
// pseudonyme n'est pas une faute a corriger, c'est une envie que le serveur ne
// sait pas stocker ; renvoyer l'enfant a son clavier pour qu'il devine LEQUEL de
// ses caracteres derange est une impasse, et c'est celle qui a ete constatee.
//
// On enleve donc ce qui ne passe pas et on PROPOSE le reste. L'enfant garde la
// main : la proposition arrive dans le champ, il la valide, la modifie ou la
// remplace. Rien n'est envoye sans son second geste — un nom public ne se
// corrige pas dans son dos.
//
// Le jeu conserve est exactement celui de MOTIF_PSEUDO, donc celui du serveur :
// lettres, chiffres, espace, tiret, apostrophe droite, tiret bas.
const CARACTERES_REFUSES = /[^\p{L}\p{N} '\-_]/gu;

export function nettoyerPseudo(saisie) {
  const brut = String(saisie ?? '');
  const garde = [...brut
    .replace(/’/g, "'")
    .normalize('NFC')
    // Un ESPACE et non rien : ce qui est retire separait souvent deux mots, et
    // « Tom.le.chevre » doit rendre « Tom le chevre », pas « Tomlechevre ». Les
    // espaces surnumeraires tombent a la ligne suivante.
    .replace(CARACTERES_REFUSES, ' ')
    .replace(/ +/g, ' ')
    .trim()].slice(0, PSEUDO_MAX).join('').trimEnd();

  return { valeur: garde, aRetire: garde !== validerPseudo(brut).valeur };
}

// Ce que l'ecran dit quand il a nettoye. Le nom propose est cite : sans lui, la
// phrase demande de comparer deux etats du champ de memoire.
export function phraseNettoyage(propose) {
  return `Les emojis et les caractères spéciaux ne passent pas. On garde « ${propose} » ?`;
}

// Et quand il ne reste rien : « Tom » ecrit en emojis n'a pas de repli.
export const RIEN_A_GARDER = 'Il ne reste rien à garder. Écris un nom en lettres ou en chiffres.';

// --- ce que l ecran dit d un echec -----------------------------------------

// La regle est simple et n'a qu'une exception : le `message` du serveur gagne
// quand il est la — le PRP 07 le pose en francais, « destine a etre affiche tel
// quel » —, et messageErreur parle quand il n'y en a pas : pas de reseau, delai
// depasse, 405 en texte brut, corps illisible.
//
// Les phrases ci-dessous reproduisent MOT POUR MOT celles du serveur la ou il
// en a une. Deux vocabulaires qui divergeraient seraient exactement le defaut
// que le PRP 07 nomme en posant son `message` ; un test l'epingle.
const MESSAGES = {
  'json-invalide': 'Ta demande n’a pas été comprise. Recharge la page et réessaie.',
  'pseudo-invalide': 'Ce nom n’a pas été accepté. Essaie deux à seize lettres, chiffres, espaces ou tirets.',
  'code-invalide': 'Le code doit faire exactement quatre chiffres.',
  'faits-invalide': 'Ta progression n’a pas pu être lue. Recharge la page et réessaie.',
  'ressentis-invalide': 'Ton ressenti n’a pas été accepté. Recharge la page et réessaie.',
  // Une SEULE phrase pour deux situations — « ce nom est pris » et « ton code
  // est faux » —, et c'est une decision du PRP 07, pas une paresse : les
  // distinguer transformerait la route en oracle de disponibilite de
  // pseudonymes. La phrase retenue est la sienne : elle est vraie dans les deux
  // cas et n'en designe aucun.
  'code-refuse': 'Ce nom est déjà pris, ou le code ne correspond pas.',
  'trop-d-essais': 'Trop d’essais sur ce nom. Réessaie dans un quart d’heure.',
  'classement-plein': 'Le classement est complet. Il n’accepte plus de nouveau nom.',
  'classement-fige': 'Le classement est terminé depuis le 21 août. Ta progression reste sur ton téléphone.',
  'classement-indisponible': 'Le classement est indisponible. Ta progression, elle, est bien enregistrée sur ton téléphone.',
};

const SANS_RESEAU = 'Pas de réseau. Réessaie quand tu en auras.';
const SANS_REPONSE = 'Le classement n’a pas répondu. Ça repartira tout seul.';

export function messageErreur(statut, erreur) {
  if (statut === 0) return SANS_RESEAU;
  return MESSAGES[erreur] ?? SANS_REPONSE;
}

// L'ecran affiche le message du serveur quand il y en a un.
function phraseDe(resultat) {
  return resultat.message ?? messageErreur(resultat.statut, resultat.erreur);
}

// --- la sortie (PRD §14) ---------------------------------------------------

// La derniere proposition n'est pas une precaution juridique : une page
// publique a pu etre lue, capturee, indexee. Promettre un effacement total
// serait faux, et le PRD §5 construit tout le produit sur le fait que ce qui
// est publie est public.
export const EXPLICATION_SUPPRESSION = 'Ton nom et ton score disparaissent du classement, pour tout le monde. Ta progression et tes séances cochées restent sur ton téléphone : tu ne perds rien de ce que tu as fait. Le nom redevient libre, et ce qui a déjà été vu par d’autres ne s’efface pas.';

export const TITRE_BLOC_SUPPRESSION = 'Mon nom au classement';

// Ce que dit le bloc quand ce telephone ne porte aucun nom. La phrase nomme les
// deux situations reelles plutot que de decrire un mecanisme : un parent qui a
// cree un nom depuis son propre telephone, et quiconque a fait « changer
// d'enfant » depuis. Sans elle, l'ecran demande un nom et un code sans dire a
// qui il s'adresse, et celui qui a le probleme ne se reconnait pas.
export const EXPLICATION_SUPPRESSION_SANS_NOM = 'Ce téléphone ne connaît aucun nom au classement. Si tu en as créé un ailleurs — depuis un autre téléphone, ou avant d’avoir changé d’enfant —, tape-le ici avec son code à 4 chiffres pour le retirer.';

export function phraseSuppression(pseudo) {
  return `Supprimer « ${pseudo} » du classement ?`;
}

// « Changer d'enfant » efface la cle locale mais ne touche pas au serveur : le
// nom resterait au classement et plus personne n'en detiendrait le code.
export function avertissementChangementEnfant(pseudo) {
  return `Ton nom au classement (« ${pseudo} ») restera visible, et plus personne `
    + 'ne pourra le supprimer. Supprime-le d’abord si tu ne veux pas le laisser.';
}

export const SANS_RESEAU_SUPPRESSION = 'Il faut du réseau pour supprimer ton nom.';
export const RETIRE = 'Ton nom a été retiré du classement.';
export const DEJA_RETIRE = 'Ce nom n’était plus au classement. C’est réglé.';

// --- l etat visible du classement ------------------------------------------

// C'est cette ligne qui tient le « et le dit » du PRD §11 : le classement
// affiche la derniere valeur connue ET annonce qu'elle est vieille.
export const PHRASES_SYNCHRO = {
  'a-jour': 'Classement à jour.',
  'en-attente': 'Ta progression part dès que tu auras du réseau.',
  'hors-ligne': 'Pas de réseau.',
  jamais: 'Classement jamais reçu. Reviens quand tu auras du réseau.',
  echec: 'Le classement n’a pas répondu. Ça repartira tout seul.',
};

const MINUTE = 60000;

// Le meme fuseau fige que app.js : un enfant en vacances a l'etranger ne doit
// pas lire « hier » sur un releve de ce matin.
const FORMAT_JOUR = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' });
const jourParis = (d) => FORMAT_JOUR.format(d);

export function formaterFraicheur(recuA, maintenant) {
  const recu = Date.parse(recuA);
  if (Number.isNaN(recu)) return null;

  const ecoule = maintenant.getTime() - recu;
  if (ecoule < 2 * MINUTE) return 'à l’instant';
  if (ecoule < 60 * MINUTE) return `il y a ${Math.round(ecoule / MINUTE)} min`;
  if (ecoule < 12 * 60 * MINUTE) return `il y a ${Math.round(ecoule / (60 * MINUTE))} h`;

  // Au-dela de douze heures, un ecart en heures n'apprend plus rien : c'est le
  // jour qui compte. Les deux dates sont lues en Europe/Paris, comme partout
  // ailleurs dans l'app.
  const jourRecu = jourParis(new Date(recu));
  const jourVeille = jourParis(new Date(maintenant.getTime() - 24 * 60 * MINUTE));
  if (jourRecu === jourVeille) return 'hier';
  return `le ${dateEnToutesLettres(jourRecu)}`;
}

// `echec` vient du dernier EVT_CLASSEMENT : synchroniser emet aussi sur un
// echec, et l'ecran doit pouvoir dire « ca n'a pas repondu » plutot que rester
// muet sur un classement qu'il affiche encore.
export function etatSynchro(local, maintenant, enLigne, echec = false) {
  const connu = local?.dernierRangConnu ?? null;

  // Sans rien de recu, on n'affiche pas un classement vide en le faisant passer
  // pour un classement a zero.
  let statut;
  if (connu === null) statut = 'jamais';
  else if (echec) statut = 'echec';
  else if (!enLigne) statut = 'hors-ligne';
  else if (envoiNecessaire(local, lireFaits())) statut = 'en-attente';
  else statut = 'a-jour';

  const fraicheur = connu === null ? null : formaterFraicheur(connu.recuA, maintenant);
  let phrase = PHRASES_SYNCHRO[statut];
  if (fraicheur !== null && statut !== 'a-jour') phrase += ` Dernière mise à jour ${fraicheur}.`;
  return { statut, phrase, fraicheur };
}

// Le champ `ignores` du PRP 07, rendu lisible. Sans cette phrase, un enfant qui
// a coche en avance voit son ecran perso et le podium ne pas dire le meme
// nombre, sans qu'aucun des deux ne soit en cause : l'horloge du telephone
// decide de l'affichage, celle du serveur decide du rang (ossature §5).
//
// Elle ne s'excuse pas et n'invite a rien — il n'y a rien a faire, sinon
// attendre le jour de la seance.
export function phraseIgnores(n) {
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n === 1) return '1 exercice ne compte pas encore : sa séance n’est pas encore arrivée.';
  return `${n} exercices ne comptent pas encore : leur séance n’est pas encore arrivée.`;
}

// --- le montage ------------------------------------------------------------

function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

// Le message d'erreur d'UN champ : il vit sous lui, il le marque, et il part
// des que l'enfant retouche sa saisie.
//
// Quatre choses ensemble, parce qu'aucune ne suffit seule. `role="alert"` le
// fait annoncer par un lecteur d'ecran — `role="status"` ne le ferait pas, et
// c'est bien une alerte. `aria-describedby` le rattache au champ, donc au
// clavier. `aria-invalid` et la classe donnent la bordure rouge, seul signal
// qui survit a un message pousse hors de l'ecran par le clavier du telephone.
// Et le champ prend le focus : c'est ce qui l'AMENE dans la fenetre, avec son
// message juste dessous.
function messageDeChamp(champ) {
  const noeud = el('p', 'erreur-champ');
  noeud.id = `${champ.id}-erreur`;
  noeud.setAttribute('role', 'alert');
  noeud.hidden = true;

  function effacer() {
    if (noeud.hidden) return;
    noeud.hidden = true;
    noeud.textContent = '';
    champ.removeAttribute('aria-invalid');
    champ.removeAttribute('aria-describedby');
    champ.classList.remove('champ-en-erreur');
  }

  // Retoucher, c'est repondre : le message a fait son travail et n'a plus a
  // rester sous un champ dont le contenu a change.
  champ.addEventListener('input', effacer);

  return {
    noeud,
    effacer,
    poser(texte) {
      noeud.textContent = texte;
      noeud.hidden = false;
      champ.setAttribute('aria-invalid', 'true');
      champ.setAttribute('aria-describedby', noeud.id);
      champ.classList.add('champ-en-erreur');
      champ.focus();
      // Le champ est dans la fenetre grace au focus ; on tire le message avec
      // lui. `nearest` ne bouge rien s'il y est deja — pas de saut inutile.
      if (typeof noeud.scrollIntoView === 'function') noeud.scrollIntoView({ block: 'nearest' });
    },
  };
}

// Entoure un fragment d'un <strong> sans composer de HTML : le texte est
// decoupe et rassemble en noeuds, jamais concatene dans innerHTML.
function avecFort(phrase, fragment) {
  const p = el('p', 'consentement-avertissement');
  const coupe = phrase.indexOf(fragment);
  if (coupe === -1) {
    p.textContent = phrase;
    return p;
  }
  p.append(
    document.createTextNode(phrase.slice(0, coupe)),
    el('strong', null, fragment),
    document.createTextNode(phrase.slice(coupe + fragment.length)),
  );
  return p;
}

// L'ecran #/rejoindre, en DEUX ETAPES sur une seule route : l'etape 2 remplace
// l'etape 1 dans le meme hote. « Non merci » n'ecrit rien — aucun refus n'est
// memorise : ce serait un schema de plus a migrer pour un seul usage, moins
// insister. Revenir sur son refus coute un tap.
export function monterRejoindre(hote, ctx) {
  const section = el('section', 'ecran ecran-rejoindre');
  hote.append(section);
  etapeConsentement(section, ctx);
}

function etapeConsentement(section, ctx) {
  section.replaceChildren();
  section.append(
    el('h1', 'titre-ecran', CONSENTEMENT.titre),
    avecFort(CONSENTEMENT.avertissement, CONSENTEMENT.fort),
    el('p', 'aide', CONSENTEMENT.surLeTelephone),
  );

  const parent = el('p', 'consentement-parent');
  parent.append(el('strong', null, CONSENTEMENT.parent));
  section.append(parent);

  const actions = el('div', 'consentement-actions');
  const continuer = el('button', 'bouton bouton-principal', CONSENTEMENT.continuer);
  continuer.type = 'button';
  continuer.addEventListener('click', () => etapeChoix(section, ctx));

  const refuser = el('button', 'bouton', CONSENTEMENT.refuser);
  refuser.type = 'button';
  // On revient D'OU L'ON VIENT : l'ecran de l'equipe, qui porte le bouton qui
  // mene ici. Renvoyer vers « Ma progression » — ce que faisait ce fichier quand
  // le bloc y vivait — deposerait l'enfant sur un ecran qui ne parle pas de ce
  // qu'il vient de refuser.
  refuser.addEventListener('click', () => ctx.aller(RETOUR_CLASSEMENT));

  actions.append(continuer, refuser);
  section.append(actions);
}

// Le bloc d'action de #/perso, pose dans la <section class="bloc-equipe"> que
// monterPerso ajoute sous le calendrier. Le PRP 09 posera podium, position et
// jauge AU-DESSUS de cet appel, dans ce meme conteneur : c'est le seul point de
// contact entre les deux branches.
//
// Il ecoute EVT_CLASSEMENT et se redessine : sans cet ecouteur, la ligne d'etat
// resterait sur ce qu'elle disait a l'ouverture de l'ecran, et le premier
// releve reussi ne se verrait pas.
// LA REPRISE A BESOIN D'UNE PORTE, ET L'ECRAN DE SAISIE N'EN EST PAS UNE.
// L'ecran ou l'on tape un nom et un code n'est atteignable que tant qu'aucun nom
// n'est enregistre ici — passe l'inscription, le bouton qui y mene disparait,
// par construction. Un telephone qui a deja rejoint ne pouvait donc plus rien
// reprendre, et c'est exactement la situation de celui qui a perdu sa
// progression : il a saisi son nom, il l'a toujours. Ce geste-ci renvoie donc la
// demande de reprise avec le nom et le code DEJA stockes, sans rien redemander.
//
// Il ne s'affiche que sous un nom connu, et il ne peut rien detruire : une
// reprise n'enleve jamais rien, ni ici ni sur le serveur.
export const TEXTE_RECUPERER = 'Récupérer ma progression';
export const AIDE_RECUPERER = 'Si tu as coché des séances sur un autre téléphone.';
export const RECUPERATION_A_JOUR = 'Rien de plus à récupérer : cet appareil est à jour.';
export const SANS_RESEAU_RECUPERATION = 'Il faut du réseau pour récupérer ta progression.';

function boutonRecuperer(local, ctx) {
  const bouton = el('button', 'bouton-lien', TEXTE_RECUPERER);
  bouton.type = 'button';

  const retour = el('p', 'retour');
  retour.setAttribute('role', 'status');

  bouton.addEventListener('click', async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      retour.textContent = SANS_RESEAU_RECUPERATION;
      return;
    }
    bouton.disabled = true;
    retour.textContent = 'Récupération…';

    const avant = Object.keys(lireFaits()).length;
    const ressentis = ressentisPourEnvoi(ctx.prog, lireRessentis());
    const resultat = await envoyer({
      pseudo: local.pseudo, code: local.code, faits: lireFaits(), ressentis, reprise: true,
    });
    bouton.disabled = false;

    if (!resultat.ok) {
      retour.textContent = phraseDe(resultat);
      return;
    }

    const apres = fusionnerFaits(resultat.moi?.faits);
    // Meme raison qu'a l'inscription : l'empreinte est celle d'APRES la fusion.
    // Prise sur ce qui vient de partir, le declencheur suivant renverrait un
    // ensemble plus petit que la fiche, en remplacement — la reprise serait
    // defaite dans la seconde qui suit.
    ecrireClassement({
      dernierEnvoi: {
        at: new Date().toISOString(),
        empreinte: empreinte(apres),
        empreinteRessentis: empreinteRessentis(ressentis),
      },
    });

    if (Object.keys(apres).length > avant) {
      // Quelque chose est revenu : on remonte l'ecran, et c'est la progression
      // retrouvee qui fait le message — bien plus qu'une phrase. C'est le seul
      // cas ou remonter est le bon geste ; dans l'autre, il n'afficherait rien
      // de neuf et l'enfant croirait que le bouton n'a pas marche.
      ctx.rafraichir();
      return;
    }
    // ON NE REMONTE PAS ICI. Le bloc partirait et emporterait la seule reponse
    // que l'enfant recoit — c'est l'anomalie 7 du journal, deja payee une fois.
    retour.textContent = RECUPERATION_A_JOUR;
  });

  const groupe = el('div', 'action-recuperer');
  groupe.append(bouton, el('p', 'aide', AIDE_RECUPERER), retour);
  return groupe;
}

export function monterActionClassement(hote, ctx) {
  const bloc = el('div', 'action-classement');
  hote.append(bloc);

  let dernierEchec = false;

  function redessiner() {
    bloc.replaceChildren();
    const local = lireClassement();

    if (local.pseudo === null) {
      // Un <a> et jamais un montage direct : la regle 2 du contrat d'ecran du
      // PRP 03 interdit a un ecran d'en monter un autre.
      const bouton = el('a', 'bouton bouton-principal', TEXTE_REJOINDRE);
      bouton.href = '#/rejoindre';
      bloc.append(bouton);
    } else {
      bloc.append(el('p', 'nom-classement', `Tu apparais sous le nom « ${local.pseudo} ».`));
      bloc.append(boutonRecuperer(local, ctx));
      const gerer = el('a', 'bouton-lien', 'Gérer ce nom');
      gerer.href = '#/reglages';
      bloc.append(gerer);
    }

    const enLigne = typeof navigator === 'undefined' || navigator.onLine !== false;
    const { statut, phrase } = etatSynchro(local, new Date(), enLigne, dernierEchec);
    const ligne = el('p', `etat-synchro etat-${statut}`, phrase);
    ligne.setAttribute('role', 'status');
    bloc.append(ligne);

    const ignores = phraseIgnores(local.dernierRangConnu?.moi?.ignores ?? 0);
    if (ignores !== null) bloc.append(el('p', 'aide', ignores));
  }

  function surClassement(evt) {
    dernierEchec = !(evt.detail?.statut >= 200 && evt.detail.statut < 300);
    redessiner();
  }

  redessiner();
  document.addEventListener(EVT_CLASSEMENT, surClassement);
  return function demonter() {
    document.removeEventListener(EVT_CLASSEMENT, surClassement);
  };
}

function etapeChoix(section, ctx) {
  section.replaceChildren();
  section.append(
    el('h1', 'titre-ecran', 'Choisir un nom'),
    el('p', 'consentement-rappel', RAPPEL_CHOIX),
  );

  const formulaire = el('form', 'formulaire-rejoindre');
  formulaire.noValidate = true;

  const champPseudo = el('input', 'champ');
  champPseudo.id = 'champ-pseudo';
  champPseudo.type = 'text';
  champPseudo.autocomplete = 'off';
  champPseudo.maxLength = PSEUDO_MAX;
  // Pre-rempli et ENTIEREMENT modifiable, y compris par ce que l'enfant voudra :
  // le PRD §7.4 le dit, « c'est son choix, il a été informé de ce qu'il
  // implique ».
  champPseudo.value = proposerPseudo();

  const etiquettePseudo = el('label', 'etiquette', 'Ton nom au classement');
  etiquettePseudo.htmlFor = champPseudo.id;

  const autre = el('button', 'bouton-lien', 'Proposer un autre nom');
  autre.type = 'button';
  autre.addEventListener('click', () => { champPseudo.value = proposerPseudo(); champPseudo.focus(); });

  const champCode = el('input', 'champ');
  champCode.id = 'champ-code';
  champCode.type = 'text';
  champCode.inputMode = 'numeric';
  champCode.pattern = '[0-9]{4}';
  champCode.maxLength = 4;
  champCode.autocomplete = 'off';

  const etiquetteCode = el('label', 'etiquette', 'Ton code à 4 chiffres');
  etiquetteCode.htmlFor = champCode.id;

  const valider = el('button', 'bouton bouton-principal', 'Rejoindre');
  valider.type = 'submit';

  const retour = el('p', 'retour');
  retour.setAttribute('role', 'status');

  // UN MESSAGE D'ERREUR SE LIT LA OU LE REGARD EST DEJA : sous le champ fautif,
  // et pas au bas du formulaire. Le rapport qui a motive ce bloc disait « rien
  // ne se passe » alors que la phrase s'affichait bel et bien — a un champ, un
  // bouton et une explication de distance, derriere le clavier du telephone.
  const erreurPseudo = messageDeChamp(champPseudo);
  const erreurCode = messageDeChamp(champCode);

  formulaire.append(
    etiquettePseudo, champPseudo, erreurPseudo.noeud, autre,
    etiquetteCode, champCode, erreurCode.noeud, el('p', 'aide', EXPLICATION_CODE),
    valider, retour,
  );

  formulaire.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    erreurPseudo.effacer();
    erreurCode.effacer();
    retour.textContent = '';

    const pseudo = validerPseudo(champPseudo.value);
    if (pseudo.erreur !== null) {
      // On ne refuse qu'apres avoir essaye de sauver la saisie. Le nettoyage est
      // PROPOSE, jamais applique en silence : le nom est public, il ne se
      // corrige pas dans le dos de celui qui le porte. Il arrive donc dans le
      // champ, et c'est un second appui qui l'envoie.
      const propre = nettoyerPseudo(champPseudo.value);
      if (propre.aRetire && validerPseudo(propre.valeur).erreur === null) {
        champPseudo.value = propre.valeur;
        erreurPseudo.poser(phraseNettoyage(propre.valeur));
        return;
      }
      erreurPseudo.poser(propre.aRetire && propre.valeur === '' ? RIEN_A_GARDER : ERREURS_PSEUDO[pseudo.erreur]);
      return;
    }
    // Une saisie valide mais non normalisee — apostrophe de clavier, espaces
    // doubles — part sous sa forme normalisee, et le champ la montre : sans
    // cela, l'enfant lit au podium un nom qu'il n'a pas tape.
    if (pseudo.valeur !== champPseudo.value) champPseudo.value = pseudo.valeur;

    const code = validerCode(champCode.value);
    if (code.erreur !== null) {
      erreurCode.poser(ERREURS_CODE[code.erreur]);
      return;
    }

    valider.disabled = true;
    retour.textContent = 'Envoi…';
    const faits = lireFaits();
    const ressentis = ressentisPourEnvoi(ctx.prog, lireRessentis());
    // `reprise` n'est vraie QUE d'ici : c'est le seul ecran ou l'on saisit un
    // code, donc le seul moment ou un telephone peut se rattacher a une fiche
    // qu'il ne connait pas. Les envois automatiques, eux, gardent le
    // remplacement — c'est lui qui fait qu'une case decochee par erreur se
    // rattrape.
    const resultat = await envoyer({
      pseudo: pseudo.valeur, code: code.valeur, faits, ressentis, reprise: true,
    });
    valider.disabled = false;

    if (!resultat.ok) {
      // UN ECHEC NE VIDE AUCUN CHAMP : retaper quatre chiffres apres un 403 est
      // la friction qui fait abandonner (PRD §14).
      retour.textContent = phraseDe(resultat);
      // Ce que l'ecran FAIT ne revele rien : proposer un autre nom et laisser
      // retenter le code sont utiles quelle que soit la situation reelle, et
      // aucun des deux n'affirme laquelle s'est produite.
      if (resultat.erreur === 'code-refuse') champPseudo.focus();
      return;
    }

    // La reprise rend la fiche : ce qui a ete coche sur un autre telephone
    // rentre ici, et rien ne repart. C'est ce qui fait du code une vraie cle de
    // reprise et non un simple cadenas sur un nom.
    const apres = fusionnerFaits(resultat.moi?.faits);

    // L'empreinte est celle des faits que le serveur a MAINTENANT, c'est-a-dire
    // ceux d'apres la fusion — et non ceux qu'on vient d'envoyer. Prendre les
    // seconds ferait repartir un envoi aussitot, avec un ensemble plus petit
    // que la fiche : le remplacement rendrait alors la moitie de ce que la
    // reprise vient de sauver.
    // `instantane` est conserve tel quel — ce que le serveur vient de rendre
    // est un rang, pas un podium.
    const recuA = new Date().toISOString();
    ecrireClassement({
      pseudo: pseudo.valeur,
      code: code.valeur,
      dernierEnvoi: { at: recuA, empreinte: empreinte(apres), empreinteRessentis: empreinteRessentis(ressentis) },
      dernierRangConnu: {
        ...(lireClassement().dernierRangConnu ?? { instantane: null }),
        recuA,
        moi: resultat.moi,
      },
    });
    // Un envoi accepte est suivi d'un releve, exactement comme dans
    // synchroniser : la reponse d'inscription est PLATE — elle donne mon rang,
    // jamais le tableau. Sans ce releve, le podium et la jauge resteraient sur
    // la valeur d'avant l'inscription alors que le classement compte un
    // participant de plus. On ne l'attend pas : l'ecran suivant se met a jour
    // sur EVT_CLASSEMENT.
    synchroniser(ctx);
    ctx.aller(RETOUR_CLASSEMENT);
  });

  section.append(formulaire);
  champPseudo.focus();
}

// Le bloc de #/reglages. IL EXISTE TOUJOURS, et c'est la correction du 7 aout :
// tant qu'il ne s'affichait que sur le telephone porteur du nom, un parent qui
// avait cree un nom pour son enfant depuis son propre telephone puis fait
// « changer d'enfant » laissait au classement un nom que PLUS PERSONNE ne
// pouvait retirer. Le serveur, lui, l'a toujours accepte : un nom, son code, et
// la fiche part, d'ou qu'arrive la requete. Il ne manquait que l'ecran.
//
// Deux chemins, parce que les deux situations ne demandent pas le meme geste :
// le telephone qui porte le nom le connait deja et n'a qu'un tap a offrir ;
// celui qui ne le porte pas doit le designer, donc le taper avec son code.
//
// LA SUPPRESSION NE SE MET JAMAIS EN ATTENTE, dans les deux cas. Effacer
// localement d'abord, en comptant sur une reprise, ferait perdre le code — donc
// le seul moyen de retirer un nom qui, lui, resterait affiche. Hors ligne, rien
// n'agit et l'ecran le dit.
export function monterSuppression(hote, ctx) {
  const local = lireClassement();

  const bloc = el('section', 'bloc-reglage bloc-danger');
  bloc.append(el('h2', 'titre-bloc', TITRE_BLOC_SUPPRESSION));

  if (local.pseudo === null) suppressionParSaisie(bloc);
  else suppressionDuNomConnu(bloc, local);

  hote.append(bloc);
  return null;
}

// Le chemin d'origine : ce telephone porte le nom, il en a le code, un tap
// suffit. Rien n'y a change.
function suppressionDuNomConnu(bloc, local) {
  bloc.append(el('p', 'avertissement', EXPLICATION_SUPPRESSION));

  const bouton = el('button', 'bouton bouton-danger', `Supprimer « ${local.pseudo} »`);
  bouton.type = 'button';

  const retour = el('p', 'retour');
  retour.setAttribute('role', 'status');

  bouton.addEventListener('click', async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      retour.textContent = SANS_RESEAU_SUPPRESSION;
      return;
    }
    if (typeof globalThis.confirm !== 'function') return;
    if (!globalThis.confirm(phraseSuppression(local.pseudo))) return;

    bouton.disabled = true;
    retour.textContent = 'Suppression…';
    const resultat = await retirer({ pseudo: local.pseudo, code: local.code });
    bouton.disabled = false;

    if (!resultat.ok) {
      // Rien n'est efface localement : 403, 429, 409, 503 et statut 0 laissent
      // la fiche et le code en place. Le 403 de la suppression ne se raconte
      // pas differemment de celui de l'envoi — la phrase du serveur est vraie,
      // et inviter a verifier le code suffit.
      retour.textContent = phraseDe(resultat);
      return;
    }
    // Le PRP 07 rappelle qu'un enfant qui appuie deux fois, ou dont le reseau a
    // rejoue la requete, ne doit pas voir une erreur pour une action qui a
    // abouti.
    retour.textContent = resultat.suppression?.supprime ? RETIRE : DEJA_RETIRE;
    // Le bouton part, le message reste. On NE remonte PAS l'ecran : le bloc
    // disparaitrait — il n'existe que s'il y a un nom a retirer — et emporterait
    // la seule confirmation que l'enfant recoit. C'est la meme raison qui
    // empeche le premier bloc des reglages de se remonter apres coup.
    bouton.remove();
  });

  bloc.append(bouton, retour);
}

// Le chemin neuf : ce telephone ne porte aucun nom. On en designe un en le
// tapant, avec son code — exactement les deux valeurs que le serveur exige, et
// pas une de plus. Aucune liste n'est proposee et aucun nom n'est confirme comme
// existant : la route est publique, et un ecran qui dirait « ce nom n'existe
// pas » en ferait un oracle de disponibilite de pseudonymes.
function suppressionParSaisie(bloc) {
  bloc.append(
    el('p', 'avertissement', EXPLICATION_SUPPRESSION_SANS_NOM),
    el('p', 'aide', EXPLICATION_SUPPRESSION),
  );

  const formulaire = el('form', 'formulaire-suppression');
  formulaire.noValidate = true;

  const champPseudo = el('input', 'champ');
  champPseudo.id = 'champ-pseudo-suppression';
  champPseudo.type = 'text';
  champPseudo.autocomplete = 'off';
  champPseudo.maxLength = PSEUDO_MAX;
  const etiquettePseudo = el('label', 'etiquette', 'Le nom à retirer');
  etiquettePseudo.htmlFor = champPseudo.id;

  const champCode = el('input', 'champ');
  champCode.id = 'champ-code-suppression';
  champCode.type = 'text';
  champCode.inputMode = 'numeric';
  champCode.pattern = '[0-9]{4}';
  champCode.maxLength = 4;
  champCode.autocomplete = 'off';
  const etiquetteCode = el('label', 'etiquette', 'Son code à 4 chiffres');
  etiquetteCode.htmlFor = champCode.id;

  // Meme traitement des refus que l'ecran de consentement : le message sous le
  // champ fautif, pas au bas du formulaire.
  const erreurPseudo = messageDeChamp(champPseudo);
  const erreurCode = messageDeChamp(champCode);

  const valider = el('button', 'bouton bouton-danger', 'Supprimer ce nom');
  valider.type = 'submit';

  const retour = el('p', 'retour');
  retour.setAttribute('role', 'status');

  formulaire.append(
    etiquettePseudo, champPseudo, erreurPseudo.noeud,
    etiquetteCode, champCode, erreurCode.noeud,
    valider, retour,
  );

  formulaire.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    erreurPseudo.effacer();
    erreurCode.effacer();
    retour.textContent = '';

    // Les deux saisies sont validees AVANT toute question et tout appel : une
    // confirmation posee sur un code a trois chiffres demanderait d'assumer un
    // geste qui ne peut pas aboutir.
    const pseudo = validerPseudo(champPseudo.value);
    if (pseudo.erreur !== null) {
      erreurPseudo.poser(ERREURS_PSEUDO[pseudo.erreur]);
      return;
    }
    if (pseudo.valeur !== champPseudo.value) champPseudo.value = pseudo.valeur;

    const code = validerCode(champCode.value);
    if (code.erreur !== null) {
      erreurCode.poser(ERREURS_CODE[code.erreur]);
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      retour.textContent = SANS_RESEAU_SUPPRESSION;
      return;
    }
    if (typeof globalThis.confirm !== 'function') return;
    if (!globalThis.confirm(phraseSuppression(pseudo.valeur))) return;

    valider.disabled = true;
    retour.textContent = 'Suppression…';
    // `supprimer` et non `retirer` : il n'y a RIEN a effacer sur ce telephone —
    // c'est la definition meme de ce chemin —, et `retirer` emettrait en plus un
    // EVT_CLASSEMENT a instantane nul, qui viderait le podium deja affiche sur
    // l'ecran de l'equipe. On retire un nom du serveur, on ne se deconnecte de
    // rien.
    const resultat = await supprimer({ pseudo: pseudo.valeur, code: code.valeur });
    valider.disabled = false;

    if (!resultat.ok) {
      // Rien n'est vide : retaper quatre chiffres apres un refus est la friction
      // qui fait abandonner (PRD §14).
      retour.textContent = phraseDe(resultat);
      return;
    }
    // Idempotent : un nom inconnu du serveur — jamais cree, ou deja retire — est
    // un succes, pas une erreur. Le formulaire reste en place, car rien ne dit
    // que c'etait le seul nom a retirer.
    retour.textContent = resultat.suppression?.supprime ? RETIRE : DEJA_RETIRE;
  });

  bloc.append(formulaire);
}

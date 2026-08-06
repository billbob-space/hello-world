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

import { EVT_CLASSEMENT, empreinte, envoiNecessaire, envoyer, retirer } from './classement.js';
import { ecrireClassement, lireClassement, lireFaits } from './etat.js';
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

const ERREURS_PSEUDO = {
  vide: 'Il faut un nom, même court.',
  'trop-court': 'Il faut au moins deux caractères.',
  'trop-long': 'Seize caractères au maximum.',
  caracteres: 'Lettres, chiffres, espace, tiret ou apostrophe seulement.',
};

const ERREURS_CODE = { longueur: 'Le code doit faire exactement quatre chiffres.' };

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
  refuser.addEventListener('click', () => ctx.aller('#/perso'));

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

  formulaire.append(
    etiquettePseudo, champPseudo, autre,
    etiquetteCode, champCode, el('p', 'aide', EXPLICATION_CODE),
    valider, retour,
  );

  formulaire.addEventListener('submit', async (evt) => {
    evt.preventDefault();

    const pseudo = validerPseudo(champPseudo.value);
    if (pseudo.erreur !== null) {
      retour.textContent = ERREURS_PSEUDO[pseudo.erreur];
      champPseudo.focus();
      return;
    }
    const code = validerCode(champCode.value);
    if (code.erreur !== null) {
      retour.textContent = ERREURS_CODE[code.erreur];
      champCode.focus();
      return;
    }

    valider.disabled = true;
    retour.textContent = 'Envoi…';
    const faits = lireFaits();
    const resultat = await envoyer({ pseudo: pseudo.valeur, code: code.valeur, faits });
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

    // L'empreinte est celle des faits REELLEMENT envoyes : sans elle, le
    // premier declencheur qui suit renverrait aussitot le meme corps.
    // `instantane` est conserve tel quel — ce que le serveur vient de rendre
    // est un rang, pas un podium.
    const recuA = new Date().toISOString();
    ecrireClassement({
      pseudo: pseudo.valeur,
      code: code.valeur,
      dernierEnvoi: { at: recuA, empreinte: empreinte(faits) },
      dernierRangConnu: {
        ...(lireClassement().dernierRangConnu ?? { instantane: null }),
        recuA,
        moi: resultat.moi,
      },
    });
    ctx.aller('#/perso');
  });

  section.append(formulaire);
  champPseudo.focus();
}

// Le bloc de #/reglages. Il n'existe que s'il y a quelque chose a retirer :
// proposer de supprimer un nom qu'on n'a pas serait une question sans reponse.
//
// LA SUPPRESSION NE SE MET JAMAIS EN ATTENTE. Effacer localement d'abord, en
// comptant sur une reprise, ferait perdre le code — donc le seul moyen de
// retirer un nom qui, lui, resterait affiche. Hors ligne, le bouton n'agit pas
// et le dit.
export function monterSuppression(hote, ctx) {
  const local = lireClassement();
  if (local.pseudo === null) return null;

  const bloc = el('section', 'bloc-reglage bloc-danger');
  bloc.append(
    el('h2', 'titre-bloc', 'Mon nom au classement'),
    el('p', 'avertissement', EXPLICATION_SUPPRESSION),
  );

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
  hote.append(bloc);
  return null;
}

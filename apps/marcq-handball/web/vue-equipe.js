// vue-equipe.js — le second niveau du PRD §7.5 : ou l'enfant se situe.
//
// Trois blocs, dans cet ordre et il n'est pas negociable : le podium, qui nomme
// trois marches ; la position, qui n'en nomme aucune ; la jauge collective, la
// seule mesure ou personne n'est dernier — et c'est elle qu'on lit en refermant.
//
// Ce fichier LIT le rang dans le tableau du serveur — il ne l'invente pas et
// n'en garde pas un vieux. Depuis que les ex aequo partagent leur place, la
// regle du §9 tient entiere dans ce tableau : le rang est le nombre d'enfants
// strictement devant, plus un. Aucun departage cache ne subsiste, donc lire
// n'est plus declarer (ossature §2). Le seul chiffre repris tel quel du serveur
// l'est quand ce tableau n'est PAS comparable, et il est nomme comme tel.

import { creerBarre } from './barre.js';
import { EVT_CLASSEMENT, synchroniser } from './classement.js';
import { lireClassement } from './etat.js';
import { progression } from './domaine.js';
import { dateEnToutesLettres } from './vue-jour.js';
import { rouler } from './recompenses.js';

export const TITRE_EQUIPE = 'L’équipe';
export const TEXTE_ACTUALISER = 'Actualiser';
export const PHRASE_PERSONNE = 'Personne n’a encore rejoint le classement.';

// Le podium montre TROIS MARCHES (PRD §9) — trois scores, pas trois enfants :
// depuis que les ex aequo partagent leur place, une marche porte tous les
// prenoms qui la partagent. La constante existe pour que la regle soit un nombre
// nomme qu'un test lit, pas un 3 perdu dans une tranche.
export const PODIUM_MAX = 3;

export const enfants = (n) => (n === 1 ? '1 enfant' : `${n} enfants`);

// --- le modele, pur --------------------------------------------------------

// '1er' et jamais '1e' ; '2e' et jamais '2eme'. Le PRD §7.5 ecrit « 3e ».
export function rangOrdinal(n) {
  return n === 1 ? '1er' : `${n}e`;
}

// Les trois premieres MARCHES, groupees par rang. Une marche rend les prenoms
// que le serveur a envoyes et combien ils sont ; quand elle est muette — trop
// peuplee pour une page publique —, ce nombre est tout ce qui s'affiche, et il
// suffit : « 1er : 14 enfants, 100 % ».
//
// Une marche n'est nommee QUE si tous ses prenoms sont arrives. Un fragment
// afficherait « 3e : Bibou » quand ils sont deux la, c'est-a-dire un gagnant qui
// n'existe pas. C'est le garde-fou du §9 rejoue cote client : le serveur n'envoie
// deja pas ces noms, cette seconde garde empeche de les afficher s'ils
// transitaient un jour.
export function podiumDe(instantane, monPseudo) {
  const lignes = instantane?.classement ?? [];
  const marches = [];
  for (const l of lignes) {
    const derniere = marches[marches.length - 1];
    if (derniere !== undefined && derniere.rang === l.rang) {
      derniere.lignes.push(l);
      continue;
    }
    if (marches.length === PODIUM_MAX) break;
    marches.push({ rang: l.rang, lignes: [l] });
  }
  return marches.map((m) => {
    const pseudos = m.lignes
      .map((l) => l.pseudo)
      .filter((p) => typeof p === 'string' && p !== '');
    const entiere = pseudos.length === m.lignes.length;
    return {
      rang: m.rang,
      ordinal: rangOrdinal(m.rang),
      pseudos: entiere ? pseudos : [],
      nombre: m.lignes.length,
      // Le serveur a deja arrondi `part` a trois decimales, pour que le podium
      // et l'ecran perso n'affichent pas 90,9 % et 91 % pour le meme enfant.
      pourcent: Math.round((m.lignes[0].part ?? 0) * 100),
      moi: monPseudo !== null && entiere && pseudos.includes(monPseudo),
    };
  });
}

// Le rang, et l'ensemble sur lequel il porte. Les arguments sont NOMMES : quatre
// parametres positionnels dont deux entiers s'inversent un jour sans qu'aucun
// test ne le voie.
export function positionDe({ instantane, moi, cochees, inscrit }) {
  // Pas de classement, donc pas de position : on n'affiche pas « 1er sur 1 » a
  // quelqu'un qui est seul avec lui-meme.
  if (instantane == null || !(instantane.participants > 0)) return null;
  const lignes = instantane.classement ?? [];

  // `moi` est la reponse au DERNIER ENVOI de ce telephone. Elle ne se rafraichit
  // qu'a l'envoi suivant, la ou l'instantane est relu en permanence : elle sert
  // donc au denominateur, jamais au rang. Voir le bloc du rang ci-dessous.
  const memeJour = moi != null && moi.jour === instantane.jour;
  const participantsMoi = memeJour && typeof moi.participants === 'number' ? moi.participants : 0;

  // Un compte incomparable — deux programmes differents, voir modeleEquipe — ne
  // se compare a rien. Le rang du dernier envoi est alors le seul chiffre
  // disponible : perimable, mais tranche par le serveur sur SON programme.
  if (typeof cochees !== 'number') {
    if (!memeJour || typeof moi.rang !== 'number') return null;
    return {
      rang: moi.rang,
      ordinal: rangOrdinal(moi.rang),
      // Un corps ancien — servi par un cache — n'a pas le champ : zero ex aequo
      // est alors la lecture prudente, la phrase se tait plutot que d'inventer.
      exAequo: typeof moi.exAequo === 'number' ? moi.exAequo : 0,
      participants: Math.max(participantsMoi, instantane.participants),
      inscrit: true,
    };
  }

  // LE RANG SE LIT DANS LE TABLEAU DU JOUR. Depuis que les ex aequo partagent
  // leur place, la regle du §9 est entiere dans ce tableau : le rang est le
  // nombre d'enfants STRICTEMENT devant, plus un. Rien n'est cache, donc rien
  // n'est declare — ce n'est pas un rang invente par le client, c'est la lecture
  // d'une regle publique sur une donnee publique.
  //
  // Tant que l'heure departageait, seul le serveur pouvait trancher et ce fichier
  // reprenait son verdict. Le garder aurait coute cher : le 8 aout, une heure
  // apres la livraison des ex aequo, un telephone qui n'avait plus rien envoye
  // affichait « Tu es 2e sur 2 » sous un podium qui le disait 1er.
  // On se compare aux AUTRES, donc ma ligne sort du tableau d'abord. Elle y
  // figure au score que le serveur connait de moi — celui de mon dernier envoi
  // —, qui n'est pas forcement celui que je viens de cocher. Sans ce retrait, un
  // telephone dont la progression locale a pris de l'avance ou du retard sur ce
  // qu'il a envoye se compte lui-meme comme quelqu'un a battre, et lit
  // « 3e sur 2 ».
  const autres = inscrit ? sansMaLigne(lignes, monScoreConnu(moi, memeJour, cochees)) : lignes;

  const devant = autres.filter((l) => (l.cochees ?? 0) > cochees).length;
  const rang = devant + 1;
  const exAequo = autres.filter((l) => (l.cochees ?? 0) === cochees).length;

  if (inscrit) {
    // Le denominateur vient du plus recent des trois nombres. Juste apres une
    // inscription, `moi` compte le nouveau participant que l'instantane ne
    // connait pas encore, et melanger leurs nombres donnerait « 4e sur 3 » —
    // qu'aucun test de fonction pure ne voit et que le premier enfant qui
    // rejoint lit tout de suite. Le rang y entre pour la meme raison : etre 4e
    // suppose au moins quatre participants, et le PRD §9 promet un rang
    // toujours atteignable.
    return {
      rang,
      ordinal: rangOrdinal(rang),
      exAequo,
      participants: Math.max(participantsMoi, instantane.participants, rang),
      inscrit: true,
    };
  }

  // Je ne suis pas dans le tableau : les lignes a mon score sont autant d'ex
  // aequo, et aucune ne me devance.
  //
  // Le denominateur vaut participants + 1 : l'ensemble compare, ce sont les
  // inscrits PLUS celui qui regarde. Sans le « + 1 », un non-participant moins
  // avance que tous serait « 10e sur 9 », et l'ecreter a 9 reviendrait a lui
  // promettre qu'il n'est pas dernier alors qu'il l'est. Corollaire utile : le
  // denominateur ne bouge pas quand on rejoint, donc rejoindre n'est jamais
  // presente comme un moyen de mieux se classer.
  return {
    rang,
    ordinal: rangOrdinal(rang),
    exAequo,
    participants: instantane.participants + 1,
    inscrit: false,
  };
}

// Le score sous lequel MA ligne figure au tableau : celui de mon dernier envoi
// quand il porte sur le meme jour, sinon, faute de mieux, celui que je compte
// ici. Les deux coincident sauf entre une coche et l'envoi qui la porte.
function monScoreConnu(moi, memeJour, cochees) {
  return memeJour && typeof moi.cochees === 'number' ? moi.cochees : cochees;
}

// Retire UNE ligne au score donne. Une seule : mes ex aequo restent des ex
// aequo. Aucune si le tableau n'en porte pas — il est alors anterieur a mon
// inscription, et il n'y a rien a retirer.
function sansMaLigne(lignes, score) {
  const i = lignes.findIndex((l) => (l.cochees ?? 0) === score);
  return i === -1 ? lignes : [...lignes.slice(0, i), ...lignes.slice(i + 1)];
}

// « Tu es 4e sur 12, avec 1 autre. » La mention n'apparait que s'il y a
// quelqu'un : « avec 0 autre » ferait lire une egalite qui n'existe pas.
export function phrasePosition(position) {
  const place = `Tu es ${position.ordinal} sur ${position.participants}`;
  const autres = position.exAequo ?? 0;
  if (autres < 1) return `${place}.`;
  return `${place}, avec ${autres === 1 ? '1 autre' : `${autres} autres`}.`;
}

// La jauge du §7.5, mise en forme depuis le champ `groupe` du serveur, sans
// recomposition : un nombre public, identique sur tous les telephones et sur
// l'ecran du coach, vaut mieux qu'une jauge recomposee par appareil, donc
// invérifiable.
export function modeleGroupe(instantane) {
  const g = instantane?.groupe ?? { cochees: 0, programmees: 0, part: 0 };
  return {
    cochees: g.cochees ?? 0,
    programmees: g.programmees ?? 0,
    pourcent: Math.round((g.part ?? 0) * 100),
    // <progress max="0"> est invalide. La garde vit dans le modele, jamais dans
    // le montage — la meme qu'a l'ecran perso.
    echelle: Math.max(1, g.programmees ?? 0),
    // La phrase porte TOUJOURS ses deux nombres : le pourcentage peut reculer
    // quand une seance nouvelle entre au denominateur, et c'est ce que les deux
    // nombres expliquent.
    phrase: `Ensemble, ceux qui ont rejoint ont coché ${g.cochees ?? 0} exercices sur ${g.programmees ?? 0}.`,
  };
}

// Elle date les NOMBRES AFFICHES — le jour dont le denominateur est celui du
// classement. La ligne d'etat du PRP 08, juste dessous, date la RECEPTION. Les
// deux ne disent pas la meme chose : un podium sans sa date se lit comme un
// podium en direct, et une fraicheur sans le jour ne dit pas sur quel
// denominateur porte le « 3e sur 10 ».
export function datationEquipe(instantane, aujourdhui, fin = null) {
  const jour = dateEnToutesLettres(instantane.jour);
  // Apres la fin du programme, le classement EST actualise : il est arrete, ce
  // qui n'est pas la meme chose. Sans ce cas, le 22 aout l'ecran inviterait a
  // reessayer une actualisation qui ne changera plus jamais rien.
  if (fin !== null && instantane.jour >= fin) return `Classement arrêté le ${jour}.`;
  return instantane.jour === aujourdhui
    ? `Classement de ${jour}.`
    : `Classement de ${jour} — pas encore actualisé aujourd’hui.`;
}

// Rend null quand rien n'a jamais ete recu : un podium vide se lit comme un
// podium ou personne n'est monte, et une jauge a zero comme une equipe qui n'a
// rien fait. La ligne d'etat du PRP 08 dit deja « Classement jamais recu » ;
// c'est elle qui parle, et une seule fois.
export function modeleEquipe(ctx, local) {
  const connu = local?.dernierRangConnu ?? null;
  const instantane = connu?.instantane ?? null;
  if (instantane == null) return null;

  // On compte au jour du SERVEUR, pas a celui du telephone : le tableau auquel
  // on se compare a ete calcule avec le denominateur de instantane.jour.
  //
  // Et on refuse de comparer deux programmes differents : le service worker peut
  // servir un programme.json anterieur, et deux denominateurs qui different
  // signalent ce cas. La position se tait alors, plutot que de mentir ; le
  // podium et la jauge restent, ils ne dependent pas de mes cases.
  const p = progression(ctx.prog, instantane.jour, ctx.faits ?? {});
  const cochees = p.programmees === instantane.programmees ? p.cochees : null;

  const position = positionDe({
    instantane,
    moi: connu.moi ?? null,
    cochees,
    inscrit: local.pseudo !== null,
  });

  return {
    titre: TITRE_EQUIPE,
    jour: instantane.jour,
    datation: datationEquipe(instantane, ctx.aujourdhui, ctx.prog?.fin ?? null),
    podium: podiumDe(instantane, local.pseudo ?? null),
    position: position === null ? null : { ...position, phrase: phrasePosition(position) },
    groupe: modeleGroupe(instantane),
    vide: instantane.participants === 0 ? PHRASE_PERSONNE : null,
  };
}

// --- le montage ------------------------------------------------------------
// Il pose le modele dans le DOM et n'y ajoute AUCUNE decision : elles sont
// toutes au-dessus, ou node --test les attrape.

function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  // textContent, jamais du HTML compose. Un pseudonyme vient d'une page
  // publique sans authentification : il s'affiche, il ne s'interprete pas.
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

function lignePodium(marche) {
  const li = el('li', marche.moi ? 'ligne-podium podium-moi' : 'ligne-podium');
  // Une marche nommee montre ses prenoms ; une marche muette montre combien ils
  // sont, et c'est deja la bonne information : ce qui compte est qu'ils y soient
  // ensemble.
  const qui = marche.pseudos.length > 0 ? marche.pseudos.join(', ') : enfants(marche.nombre);
  // Le rang est masque aux lecteurs d'ecran : « 1er Renard 100 % » lu a la file
  // ne dit pas ce que l'oeil comprend d'une colonne. La ligne cachee le dit en
  // une phrase.
  const rang = el('span', 'rang-podium', marche.ordinal);
  rang.setAttribute('aria-hidden', 'true');
  const pseudo = el('span', marche.pseudos.length > 0 ? 'pseudo-podium' : 'pseudo-podium nombre-podium', qui);
  pseudo.setAttribute('aria-hidden', 'true');
  const part = el('span', 'part-podium', `${marche.pourcent} %`);
  part.setAttribute('aria-hidden', 'true');
  const dit = `${marche.ordinal} : ${qui}, ${marche.pourcent} %.${marche.moi ? ' C’est toi.' : ''}`;
  li.append(rang, pseudo, part, el('span', 'lu-seul', dit));
  return li;
}

// Le conteneur .equipe est pose une fois et jamais remplace : c'est l'ancre de
// toutes les mises a jour. hote est le .bloc-equipe du PRP 08, qui porte AUSSI
// son bloc d'action — un replaceChildren() sur hote emporterait le bouton
// « Apparaitre au classement » au premier rafraichissement.
export function monterEquipe(hote, ctx) {
  const equipe = el('div', 'equipe');
  hote.append(equipe);

  function redessiner() {
    // On relit l'etat, on ne lit pas evt.detail : synchroniser a deja ecrit dans
    // le stockage avant d'emettre. Une source unique ; lire detail en serait une
    // seconde, et les deux divergeraient le jour ou un envoi echoue apres un
    // releve reussi.
    majEquipe(equipe, modeleEquipe(ctx, lireClassement()), { ctx });
  }

  redessiner();
  // Pose MEME quand le modele est null, sans quoi un enfant ouvrant #/perso
  // avant la premiere reponse ne verrait jamais le classement arriver.
  document.addEventListener(EVT_CLASSEMENT, redessiner);
  return function demonterEquipe() {
    document.removeEventListener(EVT_CLASSEMENT, redessiner);
  };
}

// Met a jour EN PLACE, et anime le rang quand — et seulement quand — les quatre
// conditions du PRD §10 sont reunies. La regle tient en une phrase : on anime un
// changement qu'on a VU ARRIVER, jamais un changement qu'on decouvre.
export function majEquipe(equipe, modele, options = {}) {
  const { rouler: roulerFn = rouler, ctx = {} } = options;

  // Les deux valeurs de depart se lisent AVANT toute reecriture.
  const ancienTexte = equipe.querySelector('.rang-position')?.dataset.rang;
  const ancienRang = ancienTexte === undefined ? null : Number(ancienTexte);
  const ancienJour = equipe.dataset.jour;

  equipe.replaceChildren();
  if (modele === null) {
    delete equipe.dataset.jour;
    return;
  }
  equipe.dataset.jour = modele.jour;

  equipe.append(
    el('h2', 'titre-bloc', modele.titre),
    el('p', 'datation-equipe', modele.datation),
  );

  // Personne n'a rejoint : une seule ligne. Une jauge a 0 % le 3 aout au soir
  // decouragerait exactement au moment ou il ne faut pas.
  if (modele.vide !== null) {
    equipe.append(el('p', 'aide', modele.vide));
    equipe.append(boutonActualiser(ctx));
    return;
  }

  if (modele.podium.length > 0) {
    const ol = el('ol', 'podium');
    for (const ligne of modele.podium) ol.append(lignePodium(ligne));
    equipe.append(ol);
  }

  if (modele.position !== null) {
    const p = el('p', 'position-equipe');
    const nombre = el('span', 'rang-position', modele.position.ordinal);
    nombre.setAttribute('aria-hidden', 'true');
    nombre.dataset.rang = String(modele.position.rang);
    p.append(nombre, el('span', 'phrase-position', modele.position.phrase));
    equipe.append(p);

    animerLeRang(equipe, nombre, ancienRang, modele, ancienJour, roulerFn);
  }

  // Muette : la phrase juste a cote porte les deux nombres.
  const groupe = el('p', 'groupe-equipe');
  const barre = creerBarre(modele.groupe.cochees, modele.groupe.echelle,
    { classe: 'jauge-groupe', muette: true });
  groupe.append(barre, el('span', 'phrase-groupe', modele.groupe.phrase));
  equipe.append(groupe, boutonActualiser(ctx));
}

// Quatre conditions, toutes necessaires :
//   1. le conteneur portait deja un rang — arriver sur une page n'est pas grimper ;
//   2. le jour n'a pas change — a minuit toutes les parts chutent, et cet ecran
//      ne doit pas animer un changement qu'il n'a pas cause ;
//   3. le rang a reellement change ;
//   4. la position existait avant — passer de rien a un rang est une apparition.
function animerLeRang(equipe, noeud, ancienRang, modele, ancienJour, roulerFn) {
  if (ancienRang === null || Number.isNaN(ancienRang)) return;
  if (ancienJour !== modele.jour) return;
  if (ancienRang === modele.position.rang) return;

  // rouler vient du PRP 06 et n'est pas reecrit : il porte deja la courbe,
  // l'arrondi, l'interruption qui pose la valeur finale, et le respect de
  // prefers-reduced-motion. Le format rend l'ordinal, pour que le nombre roule
  // de « 5e » a « 3e » et non de 5 a 3 suivi d'un suffixe qui apparait a la fin.
  roulerFn(noeud, ancienRang, modele.position.rang, { format: rangOrdinal });

  const classe = modele.position.rang < ancienRang ? 'rang-monte' : 'rang-descend';
  equipe.classList.add(classe);
  // Sans ce retrait, la classe collerait jusqu'au demontage et l'animation ne
  // rejouerait jamais.
  equipe.addEventListener('animationend', function retirer() {
    equipe.classList.remove(classe);
    equipe.removeEventListener('animationend', retirer);
  });
}

// Le quatrieme declencheur du PRP 08, celui qu'il attribue nommement a cet
// ecran. Il appelle synchroniser DIRECTEMENT, sans passer par le debit des
// declencheurs automatiques : une main est son propre garde-fou.
//
// L'ecran ne se met pas a jour depuis la valeur rendue mais depuis
// EVT_CLASSEMENT : un seul chemin de rendu, qu'on ait tape le bouton ou qu'un
// autre declencheur ait tire.
function boutonActualiser(ctx) {
  const bouton = el('button', 'bouton actualiser-equipe', TEXTE_ACTUALISER);
  bouton.type = 'button';
  bouton.addEventListener('click', async () => {
    bouton.disabled = true;
    try {
      await synchroniser(ctx);
    } finally {
      // Dans les deux issues : synchroniser ne rejette jamais, il rend un
      // resultat.
      bouton.disabled = false;
    }
  });
  return bouton;
}

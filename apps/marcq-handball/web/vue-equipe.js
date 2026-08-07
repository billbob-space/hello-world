// vue-equipe.js — le second niveau du PRD §7.5 : ou l'enfant se situe.
//
// Trois blocs, dans cet ordre et il n'est pas negociable : le podium, qui nomme
// trois personnes ; la position, qui n'en nomme aucune ; la jauge collective, la
// seule mesure ou personne n'est dernier — et c'est elle qu'on lit en refermant.
//
// Ce fichier ne calcule JAMAIS un rang que le serveur a tranche. La seule
// exception est la position de quelqu'un que le serveur ne connait pas, et elle
// est nommee comme telle. Un rang calcule par le client serait un rang declare
// par le client (ossature §2).

import { creerBarre } from './barre.js';
import { EVT_CLASSEMENT, synchroniser } from './classement.js';
import { lireClassement } from './etat.js';
import { progression } from './domaine.js';
import { dateEnToutesLettres } from './vue-jour.js';
import { rouler } from './recompenses.js';

export const TITRE_EQUIPE = 'L’équipe';
export const TEXTE_ACTUALISER = 'Actualiser';
export const PHRASE_PERSONNE = 'Personne n’a encore rejoint le classement.';

// Le podium nomme TROIS personnes (PRD §9). La constante existe pour que la
// regle soit un nombre nomme qu'un test lit, pas un 3 perdu dans une tranche.
export const PODIUM_MAX = 3;

// --- le modele, pur --------------------------------------------------------

// '1er' et jamais '1e' ; '2e' et jamais '2eme'. Le PRD §7.5 ecrit « 3e ».
export function rangOrdinal(n) {
  return n === 1 ? '1er' : `${n}e`;
}

// Les trois premieres lignes NOMMEES, et rien d'autre. Une ligne sans pseudonyme
// n'entre JAMAIS dans le podium, meme si elle est dans les trois premieres :
// c'est le garde-fou du §9 rejoue cote client. Le serveur n'envoie deja pas le
// nom du quatrieme ; cette seconde garde empeche de l'afficher s'il transitait
// un jour.
export function podiumDe(instantane, monPseudo) {
  const lignes = instantane?.classement ?? [];
  return lignes
    .filter((l) => typeof l?.pseudo === 'string' && l.pseudo !== '')
    .slice(0, PODIUM_MAX)
    .map((l) => ({
      rang: l.rang,
      ordinal: rangOrdinal(l.rang),
      pseudo: l.pseudo,
      // Le serveur a deja arrondi `part` a trois decimales, pour que le podium
      // et l'ecran perso n'affichent pas 90,9 % et 91 % pour le meme enfant.
      pourcent: Math.round((l.part ?? 0) * 100),
      moi: monPseudo !== null && l.pseudo === monPseudo,
    }));
}

// Le rang, et l'ensemble sur lequel il porte. Les arguments sont NOMMES : quatre
// parametres positionnels dont deux entiers s'inversent un jour sans qu'aucun
// test ne le voie.
export function positionDe({ instantane, moi, cochees, inscrit }) {
  // Pas de classement, donc pas de position : on n'affiche pas « 1er sur 1 » a
  // quelqu'un qui est seul avec lui-meme.
  if (instantane == null || !(instantane.participants > 0)) return null;
  const lignes = instantane.classement ?? [];

  // Le serveur seul peut trancher les ex aequo — « a egalite, le premier arrive
  // a ce score est devant » (PRD §9) — et il a deja tranche.
  if (moi != null && moi.jour === instantane.jour && typeof moi.rang === 'number') {
    // Le denominateur vient de LA MEME REPONSE que le rang, pas de l'instantane.
    // Les deux corps peuvent dater de deux instants differents — l'inscription
    // ecrit `moi` avant que le releve suivant n'ait rafraichi `instantane` — et
    // melanger leurs nombres produit « 4e sur 3 », qu'aucun test de fonction
    // pure ne voit et que le premier enfant qui rejoint lit tout de suite.
    const participants = typeof moi.participants === 'number'
      ? Math.max(moi.participants, instantane.participants)
      : instantane.participants;
    return {
      rang: moi.rang,
      ordinal: rangOrdinal(moi.rang),
      participants,
      inscrit: true,
    };
  }

  // Un compte incomparable est pire qu'un rang absent : voir modeleEquipe.
  if (typeof cochees !== 'number') return null;

  if (inscrit) {
    // Ma ligne est DANS le tableau : comparaison stricte, sinon je me compte
    // moi-meme comme quelqu'un qui me devance. Le denominateur reste
    // `participants` — j'y suis deja.
    const devant = lignes.filter((l) => (l.cochees ?? 0) > cochees).length;
    return {
      rang: devant + 1,
      ordinal: rangOrdinal(devant + 1),
      participants: instantane.participants,
      inscrit: true,
    };
  }

  // Je ne suis pas dans le tableau. Comparaison LARGE : a egalite, le §9 met
  // devant « le premier arrive a ce score », et quelqu'un qui n'a rien publie
  // n'a aucune date d'arrivee a faire valoir. Le rang le moins flatteur est le
  // seul honnete.
  //
  // Le denominateur vaut participants + 1 : l'ensemble compare, ce sont les
  // inscrits PLUS celui qui regarde. Sans le « + 1 », un non-participant moins
  // avance que tous serait « 10e sur 9 », et l'ecreter a 9 reviendrait a lui
  // promettre qu'il n'est pas dernier alors qu'il l'est. Corollaire utile : le
  // denominateur ne bouge pas quand on rejoint, donc rejoindre n'est jamais
  // presente comme un moyen de mieux se classer.
  const devant = lignes.filter((l) => (l.cochees ?? 0) >= cochees).length;
  return {
    rang: devant + 1,
    ordinal: rangOrdinal(devant + 1),
    participants: instantane.participants + 1,
    inscrit: false,
  };
}

export function phrasePosition(position) {
  return `Tu es ${position.ordinal} sur ${position.participants}.`;
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

function lignePodium(ligne) {
  const li = el('li', ligne.moi ? 'ligne-podium podium-moi' : 'ligne-podium');
  // Le rang est masque aux lecteurs d'ecran : « 1er Renard 100 % » lu a la file
  // ne dit pas ce que l'oeil comprend d'une colonne. La ligne cachee le dit en
  // une phrase.
  const rang = el('span', 'rang-podium', ligne.ordinal);
  rang.setAttribute('aria-hidden', 'true');
  const pseudo = el('span', 'pseudo-podium', ligne.pseudo);
  pseudo.setAttribute('aria-hidden', 'true');
  const part = el('span', 'part-podium', `${ligne.pourcent} %`);
  part.setAttribute('aria-hidden', 'true');
  const dit = `${ligne.ordinal} : ${ligne.pseudo}, ${ligne.pourcent} %.${ligne.moi ? ' C’est toi.' : ''}`;
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

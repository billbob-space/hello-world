// vue-reglages.js — deux gestes, et un avertissement.
//
// PRD §7.2 : corriger son prenom garde la progression, supprimer son profil
// repart a zero. Les deux ne se ressemblent pas a l'ecran, et c'est le sujet de
// ce fichier : un formulaire ordinaire d'un cote, une zone a part de l'autre.
//
// LE SECOND GESTE S'APPELAIT « CHANGER D'ENFANT », du nom de sa RAISON — un
// frere, une soeur, un telephone partage — et non de son effet. Deux
// consequences, et la seconde etait un defaut : personne cherchant a effacer un
// profil ne pensait a ouvrir ce bouton, et le bouton effacait le telephone en
// LAISSANT le nom au classement. Le code partait avec le reste, donc plus
// personne — pas meme son auteur — ne pouvait retirer ce nom. Son avertissement
// le disait, ce qui documentait le defaut sans l'empecher.

import { retirer } from './classement.js';
import { ecrirePrenom, ecrireSonnerie, lireClassement, lireFaits, lireSonnerie, toutEffacer } from './etat.js';
import { creerSonneur, SONNERIE_PAR_DEFAUT, SONNERIES } from './sonnerie.js';
import { monterSuppression, phraseDe } from './vue-rejoindre.js';

// PRD §14, ligne « Perte du telephone ou vidage du navigateur » : le risque est
// « assume et annonce ». Il est ecrit ici, en clair, et pas au moment ou la
// progression est deja perdue.
export const AVERTISSEMENT_SAUVEGARDE =
  'Il n’y a pas de compte, donc pas de sauvegarde : ta progression vit dans ce '
  + 'navigateur, sur ce téléphone. Si tu changes de téléphone ou que tu vides ton '
  + 'navigateur, elle est perdue.';

export const TITRE_SUPPRIMER_PROFIL = 'Supprimer mon profil';

export const CONFIRMATION_SUPPRESSION_PROFIL =
  'Supprimer ton profil efface le prénom et toute la progression enregistrée sur '
  + 'ce téléphone. C’est définitif. Continuer ?';

// La phrase ne s'ajoute que s'il y a un nom a retirer — sinon elle parlerait de
// rien. Elle annonce l'autre moitie du geste : celle qui part du SERVEUR, donc
// la seule que ce telephone ne pourra pas defaire ensuite.
export function avertissementNomAuClassement(pseudo) {
  return `Ton nom au classement (« ${pseudo} ») est retiré lui aussi : il disparaît `
    + 'pour tout le monde, et redevient libre.';
}

// Refuser hors ligne n'est pas de la prudence de facade. Effacer le telephone
// d'abord perdrait le code, donc le seul moyen de retirer un nom qui, lui,
// resterait en ligne : c'est EXACTEMENT le defaut que ce geste repare.
export const PROFIL_SANS_RESEAU = 'Il faut du réseau : ton nom au classement doit partir d’abord, sinon il resterait en ligne sans que personne ne puisse l’enlever. Rien n’a été effacé.';

export const PROFIL_RIEN_EFFACE = 'Rien n’a été effacé.';

// Le sonneur de cet ecran est le sien : il n'a pas a partager le contexte audio
// du minuteur, qui vit sur un autre ecran et peut ne jamais avoir ete ouvert.
const sonneurDesReglages = creerSonneur();

export function monterReglages(hote, ctx) {
  const section = document.createElement('section');
  section.className = 'ecran ecran-reglages';

  const titre = document.createElement('h1');
  titre.className = 'titre-ecran';
  titre.textContent = 'Réglages';

  section.append(titre, blocPrenom(ctx), blocSonnerie(), blocSauvegarde());
  // Le bloc du classement n'existe que s'il y a un nom a retirer. Il vient AVANT
  // « supprimer mon profil » : c'est le geste destructeur le plus doux des deux,
  // et le seul qui laisse a l'enfant sa progression.
  monterSuppression(section, ctx);
  section.append(blocSupprimerProfil(ctx));
  hote.append(section);
}

// Le seul REGLAGE de l'application — les autres blocs sont des gestes. Il vient
// juste apres le prenom : c'est le seul des quatre qu'on vient chercher pour le
// plaisir, et il n'a pas a se meriter en passant devant deux avertissements.
//
// CHOISIR, C'EST ENTENDRE. Le tap qui coche une sonnerie la joue aussitot : sans
// cela il faudrait revenir a une seance, lancer un rebours et attendre son zero
// pour savoir ce qu'on vient de choisir. Il se trouve que c'est aussi le geste
// qui reveille l'audio du navigateur, mais ce n'est pas la raison — la raison
// est qu'un son se choisit a l'oreille.
function blocSonnerie() {
  const bloc = document.createElement('section');
  bloc.className = 'bloc-reglage';

  const titre = document.createElement('h2');
  titre.className = 'titre-bloc';
  titre.textContent = 'La sonnerie du minuteur';

  const aide = document.createElement('p');
  aide.className = 'aide';
  aide.textContent = 'Ce qu’on entend quand un compte à rebours arrive à zéro. Le téléphone vibre dans tous les cas.';

  bloc.append(titre, aide);

  const groupe = document.createElement('div');
  groupe.className = 'choix-sonnerie';
  groupe.setAttribute('role', 'radiogroup');
  groupe.setAttribute('aria-label', 'La sonnerie du minuteur');

  const choisie = lireSonnerie() ?? SONNERIE_PAR_DEFAUT;

  for (const s of SONNERIES) {
    const etiquette = document.createElement('label');
    etiquette.className = 'ligne-sonnerie';

    const bouton = document.createElement('input');
    bouton.type = 'radio';
    bouton.name = 'sonnerie';
    bouton.value = s.cle;
    bouton.className = 'case-sonnerie';
    bouton.checked = s.cle === choisie;

    const texte = document.createElement('span');
    texte.className = 'texte-sonnerie';
    const nom = document.createElement('span');
    nom.className = 'nom-sonnerie';
    nom.textContent = s.nom;
    const detail = document.createElement('span');
    detail.className = 'aide';
    detail.textContent = s.description;
    texte.append(nom, detail);

    etiquette.append(bouton, texte);
    groupe.append(etiquette);
  }

  groupe.addEventListener('change', (e) => {
    const bouton = e.target;
    if (!(bouton instanceof HTMLInputElement) || bouton.name !== 'sonnerie') return;
    ecrireSonnerie(bouton.value);
    sonneurDesReglages.jouer(bouton.value);
  });

  bloc.append(groupe);
  return bloc;
}

// Geste 1 : corriger son prenom. La progression n'est pas touchee — le prenom et
// les faits sont deux cles distinctes (ossature §6), en changer une ne lit meme
// pas l'autre. On ne remonte pas l'ecran apres coup : la confirmation ecrite
// sous le champ disparaitrait avec lui, et l'enfant n'aurait aucun retour.
function blocPrenom(ctx) {
  const bloc = document.createElement('section');
  bloc.className = 'bloc-reglage';

  const titre = document.createElement('h2');
  titre.className = 'titre-bloc';
  titre.textContent = 'Mon prénom';

  const formulaire = document.createElement('form');
  formulaire.className = 'formulaire-prenom';
  formulaire.noValidate = true;

  const etiquette = document.createElement('label');
  etiquette.className = 'etiquette';
  etiquette.htmlFor = 'champ-prenom-reglages';
  etiquette.textContent = 'Ton prénom';

  const champ = document.createElement('input');
  champ.className = 'champ';
  champ.id = 'champ-prenom-reglages';
  champ.name = 'prenom';
  champ.type = 'text';
  champ.autocomplete = 'given-name';
  champ.maxLength = 24;
  champ.value = ctx.prenom;

  const bouton = document.createElement('button');
  bouton.className = 'bouton';
  bouton.type = 'submit';
  bouton.textContent = 'Enregistrer';

  // `role="status"` fait annoncer le retour par les lecteurs d'ecran sans voler
  // le focus au champ.
  const retour = document.createElement('p');
  retour.className = 'retour';
  retour.setAttribute('role', 'status');

  formulaire.append(etiquette, champ, bouton, retour);
  formulaire.addEventListener('submit', (evt) => {
    evt.preventDefault();
    const enregistre = ecrirePrenom(champ.value);
    if (enregistre === null) {
      retour.textContent = 'Il faut un prénom, même court.';
      champ.focus();
      return;
    }
    champ.value = enregistre;
    retour.textContent = `C’est noté, ${enregistre}.`;
  });

  bloc.append(titre, formulaire);
  return bloc;
}

function blocSauvegarde() {
  const bloc = document.createElement('section');
  bloc.className = 'bloc-reglage';

  const titre = document.createElement('h2');
  titre.className = 'titre-bloc';
  titre.textContent = 'Où vit ta progression';

  const texte = document.createElement('p');
  texte.className = 'avertissement';
  texte.textContent = AVERTISSEMENT_SAUVEGARDE;

  bloc.append(titre, texte);
  return bloc;
}

// Geste 2 : supprimer son profil. Il « repart a zero, et le dit clairement avant
// d'agir » (PRD §7.2) — d'ou le decompte de ce qui sera efface, puis une
// confirmation. `confirm` est natif, bloquant et impossible a rater ; une modale
// maison couterait trois fois plus de lignes pour moins de garanties. Un
// navigateur qui l'a desactive fait ne rien faire au bouton, ce qui est le bon
// defaut pour un geste destructeur.
//
// LE PROFIL A DEUX MOITIES, et le geste emporte les deux : ce qui vit sur le
// telephone, et le nom au classement quand il y en a un. C'est ce second point
// qui manquait — le geste effacait le code, donc le seul moyen de retirer un nom
// qu'il laissait en ligne.
function blocSupprimerProfil(ctx) {
  const bloc = document.createElement('section');
  bloc.className = 'bloc-reglage bloc-danger';

  const titre = document.createElement('h2');
  titre.className = 'titre-bloc';
  titre.textContent = TITRE_SUPPRIMER_PROFIL;

  const auClassement = lireClassement().pseudo;
  const cochees = Object.keys(lireFaits()).length;
  const pluriel = cochees > 1 ? 's' : '';
  const texte = document.createElement('p');
  texte.className = 'avertissement';
  texte.textContent =
    `Tout part : le prénom ${ctx.prenom}, ${cochees} exercice${pluriel} coché${pluriel}`
    + `${auClassement === null ? '' : `, et le nom « ${auClassement} » au classement`}. `
    + 'C’est fait pour un frère, une sœur, un téléphone partagé — ou pour effacer '
    + 'un profil créé par erreur.';

  const bouton = document.createElement('button');
  bouton.className = 'bouton bouton-danger';
  bouton.type = 'button';
  bouton.textContent = TITRE_SUPPRIMER_PROFIL;

  const retour = document.createElement('p');
  retour.className = 'retour';
  retour.setAttribute('role', 'status');

  bouton.addEventListener('click', async () => {
    if (typeof globalThis.confirm !== 'function') return;
    // L'etat est relu AU CLIC et non au montage : le bloc du classement, juste
    // au-dessus, a pu retirer le nom entre-temps sans que l'ecran soit remonte.
    const local = lireClassement();
    const question = local.pseudo === null
      ? CONFIRMATION_SUPPRESSION_PROFIL
      : `${CONFIRMATION_SUPPRESSION_PROFIL}\n\n${avertissementNomAuClassement(local.pseudo)}`;
    if (!globalThis.confirm(question)) return;

    // Rien a demander a personne : ce profil n'existe que sur ce telephone. Le
    // frere qui reprend l'appareil dans le train n'a pas besoin de reseau.
    if (local.pseudo === null) {
      effacerEtRepartir(ctx);
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      retour.textContent = PROFIL_SANS_RESEAU;
      return;
    }

    bouton.disabled = true;
    retour.textContent = 'Suppression…';
    // LE SERVEUR D'ABORD, LE TELEPHONE ENSUITE, et c'est `retirer` qui tient cet
    // ordre — il n'efface la cle locale qu'une fois la fiche partie. Un echec
    // laisse donc le code en place, et avec lui le moyen de recommencer.
    const resultat = await retirer({ pseudo: local.pseudo, code: local.code });
    bouton.disabled = false;
    if (!resultat.ok) {
      retour.textContent = `${phraseDe(resultat)} ${PROFIL_RIEN_EFFACE}`;
      return;
    }
    effacerEtRepartir(ctx);
  });

  bloc.append(titre, texte, bouton, retour);
  return bloc;
}

// Le routeur relit le prenom a chaque rendu : sans prenom, il monte l'ecran de
// premier lancement. Aucun rechargement de page, donc aucune attente.
function effacerEtRepartir(ctx) {
  toutEffacer();
  ctx.aller('#/');
}

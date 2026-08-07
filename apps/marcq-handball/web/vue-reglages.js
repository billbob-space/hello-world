// vue-reglages.js — deux gestes, et un avertissement.
//
// PRD §7.2 : corriger son prenom garde la progression, changer d'enfant repart a
// zero. Les deux ne se ressemblent pas a l'ecran, et c'est le sujet de ce
// fichier : un formulaire ordinaire d'un cote, une zone a part de l'autre.

import { ecrirePrenom, ecrireSonnerie, lireClassement, lireFaits, lireSonnerie, toutEffacer } from './etat.js';
import { creerSonneur, SONNERIE_PAR_DEFAUT, SONNERIES } from './sonnerie.js';
import { avertissementChangementEnfant, monterSuppression } from './vue-rejoindre.js';

// PRD §14, ligne « Perte du telephone ou vidage du navigateur » : le risque est
// « assume et annonce ». Il est ecrit ici, en clair, et pas au moment ou la
// progression est deja perdue.
export const AVERTISSEMENT_SAUVEGARDE =
  'Il n’y a pas de compte, donc pas de sauvegarde : ta progression vit dans ce '
  + 'navigateur, sur ce téléphone. Si tu changes de téléphone ou que tu vides ton '
  + 'navigateur, elle est perdue.';

export const CONFIRMATION_CHANGEMENT =
  'Changer d’enfant efface le prénom et toute la progression enregistrée sur ce '
  + 'téléphone. C’est définitif. Continuer ?';

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
  // « changer d'enfant » : c'est le geste destructeur le plus doux des deux, et
  // celui que l'avertissement du second recommande de faire d'abord.
  monterSuppression(section, ctx);
  section.append(blocChangerEnfant(ctx));
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

// Geste 2 : changer d'enfant. Il « repart a zero, et le dit clairement avant
// d'agir » (PRD §7.2) — d'ou le decompte de ce qui sera efface, puis une
// confirmation. `confirm` est natif, bloquant et impossible a rater ; une modale
// maison couterait trois fois plus de lignes pour moins de garanties. Un
// navigateur qui l'a desactive fait ne rien faire au bouton, ce qui est le bon
// defaut pour un geste destructeur.
function blocChangerEnfant(ctx) {
  const bloc = document.createElement('section');
  bloc.className = 'bloc-reglage bloc-danger';

  const titre = document.createElement('h2');
  titre.className = 'titre-bloc';
  titre.textContent = 'Changer d’enfant';

  const cochees = Object.keys(lireFaits()).length;
  const pluriel = cochees > 1 ? 's' : '';
  const texte = document.createElement('p');
  texte.className = 'avertissement';
  texte.textContent =
    `Le téléphone repart à zéro : le prénom ${ctx.prenom} et ${cochees} exercice${pluriel} `
    + `coché${pluriel} seront effacés. C’est fait pour un frère, une sœur, un téléphone partagé.`;

  const bouton = document.createElement('button');
  bouton.className = 'bouton bouton-danger';
  bouton.type = 'button';
  bouton.textContent = 'Changer d’enfant';
  bouton.addEventListener('click', () => {
    if (typeof globalThis.confirm !== 'function') return;
    // « Changer d'enfant » efface la cle du classement comme les autres, mais ne
    // touche pas au serveur : le nom y resterait, et plus personne n'en
    // detiendrait le code. La phrase n'est ajoutee que s'il y a un nom a
    // orpheliner — sinon elle parlerait de rien.
    const auClassement = lireClassement().pseudo;
    const question = auClassement === null
      ? CONFIRMATION_CHANGEMENT
      : `${CONFIRMATION_CHANGEMENT}\n\n${avertissementChangementEnfant(auClassement)}`;
    if (!globalThis.confirm(question)) return;
    toutEffacer();
    // Le routeur relit le prenom a chaque rendu : sans prenom, il monte l'ecran
    // de premier lancement. Aucun rechargement de page, donc aucune attente.
    ctx.aller('#/');
  });

  bloc.append(titre, texte, bouton);
  return bloc;
}

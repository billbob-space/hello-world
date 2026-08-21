// vue-prenom.js — le premier lancement. Un champ, un bouton, une phrase.
//
// PRD §7.1. C'est le seul peage de l'application, et il n'est demande qu'une
// fois. Il ne route pas : il ecrit le prenom puis rend la main au routeur, qui
// relit le stockage et monte l'ecran demande.

import { ecrirePrenom } from './etat.js';

// La phrase du PRD §7.1, au mot pres. Elle est ce qui rend l'absence de compte
// credible plutot que suspecte ; un test verifie qu'elle n'a pas ete reformulee.
export const PHRASE_RASSURANTE = 'Ton prénom reste sur ton téléphone.';

// Le refus d'un champ vide, dans les MEMES mots qu'aux reglages (vue-reglages.js).
export const PRENOM_MANQUANT = 'Il faut un prénom, même court.';

export function monterPrenom(hote, ctx) {
  const section = document.createElement('section');
  section.className = 'ecran ecran-prenom';

  // Le blason du club. Il n'est ici que parce qu'il repond a la question de
  // l'enfant qui ouvre un lien recu sur le groupe de l'equipe : de qui ca vient.
  // C'est donc une IMAGE avec un texte de remplacement, et non le fond decoratif
  // qu'il est sur l'ecran du jour. Servi par l'app, jamais par un tiers.
  // Ce n'est pas la mascotte que le PRD §10 refuse : il ne parle pas, ne reagit
  // a rien, et n'apparait sur aucun autre ecran.
  const blason = document.createElement('img');
  blason.className = 'blason-accueil';
  blason.src = '/mhb.webp';
  blason.alt = 'Marcq Handball';
  // Dites au navigateur : sans elles, l'arrivee de l'image pousse le champ vers
  // le bas alors que le curseur y est deja.
  blason.width = 384;
  blason.height = 369;

  // Le titre vient du programme, jamais d'une chaine recopiee : le PRD §8 veut
  // un fichier de donnees reutilisable la saison suivante.
  const titre = document.createElement('h1');
  titre.className = 'titre-accueil';
  titre.textContent = ctx.prog.titre;

  const formulaire = document.createElement('form');
  formulaire.className = 'formulaire-prenom';
  // La validation native afficherait une bulle en anglais sur certains
  // navigateurs ; on l'ecarte, et on dit la meme chose dans la langue de l'app.
  formulaire.noValidate = true;

  const etiquette = document.createElement('label');
  etiquette.className = 'etiquette';
  etiquette.htmlFor = 'champ-prenom';
  etiquette.textContent = 'Ton prénom';

  const champ = document.createElement('input');
  champ.className = 'champ';
  champ.id = 'champ-prenom';
  champ.name = 'prenom';
  champ.type = 'text';
  champ.autocomplete = 'given-name';
  champ.maxLength = 24;
  // `enterKeyHint` met « OK » sur la touche de validation du clavier mobile :
  // un tap de moins entre le lien recu et la premiere seance.
  champ.enterKeyHint = 'go';

  const aide = document.createElement('p');
  aide.className = 'aide';
  aide.textContent = PHRASE_RASSURANTE;

  const bouton = document.createElement('button');
  bouton.className = 'bouton bouton-principal';
  bouton.type = 'submit';
  bouton.textContent = 'C’est parti';

  // LE SEUL BOUTON DE L'APPLICATION NE PEUT PAS NE RIEN FAIRE. Champ vide, il
  // ne se passait rien du tout : le curseur revenait dans un champ ou il etait
  // deja, sans un mot. Sur un telephone, ou le clavier cache le champ et ou le
  // retour du focus ne se voit pas, l'enfant en conclut que l'app est cassee —
  // au premier ecran, celui que le PRD §7.1 appelle le seul peage.
  //
  // La phrase n'est pas inventee ici : c'est MOT POUR MOT celle que l'ecran des
  // reglages emploie deja pour la meme regle sur le meme champ. Deux
  // vocabulaires pour un seul refus seraient le defaut, pas la correction.
  // `role="status"` la fait annoncer sans voler le focus, qui reste au champ ;
  // la hauteur reservee par `.retour` empeche le bouton de sauter quand elle
  // parait.
  const retour = document.createElement('p');
  retour.className = 'retour';
  retour.setAttribute('role', 'status');

  formulaire.append(etiquette, champ, aide, bouton, retour);
  section.append(blason, titre, formulaire);
  hote.append(section);
  champ.focus();

  formulaire.addEventListener('submit', (evt) => {
    evt.preventDefault();
    // `ecrirePrenom` rend null si l'entree est vide une fois nettoyee. On le
    // dit, et on remet le curseur dans le champ.
    if (ecrirePrenom(champ.value) === null) {
      retour.textContent = PRENOM_MANQUANT;
      champ.focus();
      return;
    }
    retour.textContent = '';
    ctx.rafraichir();
  });
}

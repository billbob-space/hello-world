// vue-prenom.js — le premier lancement. Un champ, un bouton, une phrase.
//
// PRD §7.1. C'est le seul peage de l'application, et il n'est demande qu'une
// fois. Il ne route pas : il ecrit le prenom puis rend la main au routeur, qui
// relit le stockage et monte l'ecran demande.

import { ecrirePrenom } from './etat.js';

// La phrase du PRD §7.1, au mot pres. Elle est ce qui rend l'absence de compte
// credible plutot que suspecte ; un test verifie qu'elle n'a pas ete reformulee.
export const PHRASE_RASSURANTE = 'Ton prénom reste sur ton téléphone.';

export function monterPrenom(hote, ctx) {
  const section = document.createElement('section');
  section.className = 'ecran ecran-prenom';

  // Le titre vient du programme, jamais d'une chaine recopiee : le PRD §8 veut
  // un fichier de donnees reutilisable la saison suivante.
  const titre = document.createElement('h1');
  titre.className = 'titre-accueil';
  titre.textContent = ctx.prog.titre;

  const formulaire = document.createElement('form');
  formulaire.className = 'formulaire-prenom';
  // La validation native afficherait une bulle en anglais sur certains
  // navigateurs ; on prefere ne rien reprocher et remettre le curseur.
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

  formulaire.append(etiquette, champ, aide, bouton);
  section.append(titre, formulaire);
  hote.append(section);
  champ.focus();

  formulaire.addEventListener('submit', (evt) => {
    evt.preventDefault();
    // `ecrirePrenom` rend null si l'entree est vide une fois nettoyee. On ne
    // reproche rien : on remet simplement le curseur dans le champ.
    if (ecrirePrenom(champ.value) === null) {
      champ.focus();
      return;
    }
    ctx.rafraichir();
  });
}

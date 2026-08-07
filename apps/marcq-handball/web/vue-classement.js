// vue-classement.js — l'ecran « L'equipe », derriere son propre onglet.
//
// Il ne calcule rien et n'appelle personne : tout ce qu'il montre vient de
// vue-equipe.js — podium, position, jauge —, et tout ce qu'il fait vient de
// vue-rejoindre.js — rejoindre, recuperer, l'etat de synchronisation. Ce
// fichier est le CONTENANT, et c'est la seule raison pour laquelle il existe :
// avant lui, ces deux blocs vivaient au bas de « Ma progression », ou il fallait
// derouler tout un calendrier pour les atteindre.
//
// Le PRD §7.5 met la comparaison au SECOND niveau de lecture, apres ce qu'il y a
// a faire aujourd'hui. Un onglet ne contredit pas cette regle — il ne devance
// personne, il se choisit — la ou un ecran d'accueil l'aurait contredite.

import { monterEquipe } from './vue-equipe.js';
import { monterActionClassement } from './vue-rejoindre.js';

function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

export function monterClassement(hote, ctx) {
  const section = el('section', 'ecran ecran-classement');
  // AUCUN TITRE POSE ICI. `monterEquipe` ecrit deja « L'equipe » en tete de son
  // bloc ; en ajouter un second au-dessus l'affichait deux fois de suite, ce
  // qu'un navigateur montre en une seconde et qu'aucun test de fonction pure ne
  // pouvait voir. Le titre de l'ecran est donc celui du bloc, et il n'y en a
  // qu'un seul endroit ou le changer.

  // Le meme conteneur qu'au bas de « Ma progression » avant ce deplacement, et
  // le meme ordre : podium, position et jauge AU-DESSUS du bloc d'action. On lit
  // ou l'on en est, puis ce qu'on peut faire — l'inverse proposerait d'agir
  // avant d'avoir donne une raison de le faire.
  const equipe = el('section', 'bloc-equipe');
  section.append(equipe);
  const demonterEquipe = monterEquipe(equipe, ctx);
  const demonterAction = monterActionClassement(equipe, ctx);

  hote.append(section);
  // Les deux ecouteurs vivent sur `document`, que le routeur ne vide pas : sans
  // ce demontage, quitter cet ecran puis y revenir en empilerait un par visite.
  return () => { demonterEquipe(); demonterAction(); };
}

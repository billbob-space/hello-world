// barre.js — la barre de progression, partout la meme.
//
// Six ecrans en affichent une ; elle vivait jusqu'ici en six exemplaires, chacun
// un `<progress>` construit sur place. Le passage par un module unique n'est pas
// un rangement : c'est ce qui permet de changer la MECANIQUE une seule fois.
//
// Ce qui a change, et pourquoi. Le remplissage n'est plus une LARGEUR qui
// s'anime mais un bloc pleine largeur qui se DEPLACE sous un cadre qui le rogne.
// Une largeur qui bouge oblige le navigateur a refaire la mise en page a chaque
// image ; un deplacement ne touche ni la mise en page ni le dessin, il se
// compose. A l'oeil c'est le meme mouvement — le cout, lui, n'est plus le meme,
// et la regle vaut pour ce qu'un ecran futur ajoutera a cote.
//
// Le deplacement plutot qu'une mise a l'echelle : `scaleX` ecraserait aussi les
// extremites arrondies, et le bout droit de la barre serait d'autant plus pince
// que la progression est faible. Ici la barre garde son bout rond a toutes les
// valeurs, et c'est le cadre qui coupe ce qui depasse a gauche.
//
// Ce que ca coute : `<progress>` etait annonce tout seul par les lecteurs
// d'ecran. Le role et les trois valeurs sont donc poses A LA MAIN ci-dessous, et
// c'est la seule raison pour laquelle ce fichier existe plutot que trois lignes
// recopiees — recopiees, l'une des six les aurait perdues.

// La part remplie, entre 0 et 1. Fonction pure, donc verifiable sans
// navigateur : c'est le seul calcul de ce module.
//
// `echelle` vaut au moins 1 chez tous les appelants — un `<progress max="0">`
// etait invalide et les modeles s'en gardaient deja. Le garde est repris ici
// parce qu'une division par zero rendrait NaN, que le CSS ignorerait en
// silence : la barre resterait vide sans que rien ne le dise.
export function partDe(coches, echelle) {
  const total = Number(echelle) > 0 ? Number(echelle) : 1;
  const part = Number(coches) / total;
  if (!Number.isFinite(part)) return 0;
  return Math.min(1, Math.max(0, part));
}

// Cree la barre. `classe` ajoute une classe a cote de `barre` ; `muette` retire
// la barre de la restitution des lecteurs d'ecran, pour les deux ecrans ou le
// nombre est deja ecrit juste a cote et ou l'annoncer deux fois serait du bruit.
//
// `nom` est le nom accessible d'une barre NON muette : `role="progressbar"`
// sans nom est annonce par un lecteur d'ecran sans dire ce qu'il mesure — axe
// le releve sous `aria-progressbar-name`, gravite serieuse. Il doit dire CE
// QU'ELLE MESURE, et RIEN DE PLUS : le nom est pose une fois a la creation et
// n'est jamais rejoue par `reglerBarre`. Un nom qui porterait le compte serait
// donc fige au compte du montage, et mentirait des la premiere coche sur le
// seul ecran ou la barre bouge. Le chiffre vit dans les aria-value* en dessous,
// qui, eux, sont remis a jour a chaque appel.
export function creerBarre(coches, echelle, options = {}) {
  const { classe = '', muette = false, nom = null } = options;

  const barre = document.createElement('div');
  barre.className = classe ? `barre ${classe}` : 'barre';

  const remplissage = document.createElement('span');
  remplissage.className = 'barre-remplissage';
  barre.append(remplissage);

  if (muette) {
    barre.setAttribute('aria-hidden', 'true');
  } else {
    barre.setAttribute('role', 'progressbar');
    if (nom) barre.setAttribute('aria-label', nom);
  }

  reglerBarre(barre, coches, echelle, options);
  return barre;
}

// Met la barre a jour. Appelee a chaque coche sur l'ecran de seance : elle ne
// touche qu'une propriete personnalisee et trois attributs, et n'ajoute ni ne
// retire un seul noeud.
//
// `muette` est repasse plutot que relu sur l'element : relire un attribut qu'on
// vient d'ecrire fait dependre le calcul de l'etat du DOM, ce qui se paie deux
// fois — en lecture inutile, et en double de DOM a etoffer dans les tests.
export function reglerBarre(barre, coches, echelle, { muette = false } = {}) {
  barre.style.setProperty('--part', String(partDe(coches, echelle)));
  if (muette) return;
  const max = Number(echelle) > 0 ? echelle : 1;
  barre.setAttribute('aria-valuemin', '0');
  barre.setAttribute('aria-valuemax', String(max));
  barre.setAttribute('aria-valuenow', String(coches));
  // Sans `aria-valuetext`, un lecteur d'ecran calcule un POURCENTAGE a partir
  // des trois valeurs ci-dessus et annonce « 43 % » la ou l'ecran, lui, ecrit
  // « 3 / 7 ». L'unite entendue n'existe alors nulle part a l'oeil, et il reste
  // une division a faire pour rapprocher les deux. On dicte donc le compte, qui
  // est ce que l'ecran montre.
  barre.setAttribute('aria-valuetext', `${coches} sur ${max}`);
}

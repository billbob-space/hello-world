// vue-liste.js — A8 (« Ajouté après les PRP ») : les trente-six exercices, à
// l'écran.
//
// Il n'existait aucun endroit où voir le programme complet : l'application le
// déroulait sans jamais le montrer, alors que c'est un document que le club a
// distribué et qu'elle a sous les yeux depuis juillet. Cet écran reconstitue
// les deux pages d'origine — les exercices groupés par famille, dans l'ordre
// de la feuille — avec pour chacun son libellé exact, l'objectif de la
// semaine en cours, et s'il a été fait au moins une fois cette semaine.
//
// Purement consultatif : rien ne se coche ni ne se lance ici, contrairement
// au détail d'une séance (vue-detail-seance.js) — ce n'est pas un troisième
// parcours de correction, c'est la feuille du club entière, à l'écran.
//
// AUCUN COMPTEUR, AUCUN POURCENTAGE, AUCUN CLASSEMENT (PRD §4, §14) : chaque
// ligne dit fait ou pas fait cette semaine, point.

import { exercicesParFamille, objectifTexte } from './programme.js';
import { semaineCourante, exerciceFaitCetteSemaine } from './domaine.js';

const SEMAINES_DU_PROGRAMME = 8;

function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

// Même trait, même taille optique que les autres écrans (vue-grille.js,
// vue-detail-seance.js) : jamais un glyphe de police (✓, ›) qui varie d'un
// système à l'autre.
function icone(classe, points) {
  const span = el('span', classe);
  span.innerHTML = `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="${points}"/></svg>`;
  return span;
}

export function monterListe(hote, ctx) {
  const { etat, programme } = ctx;
  const semaine = Math.min(semaineCourante(programme, etat.faits, etat.semaineDeDepart), SEMAINES_DU_PROGRAMME);

  const section = el('section', 'ecran-liste zone-surete');
  const empiecement = el('div', 'empiecement empiecement--compact');
  empiecement.append(el('h1', null, 'Les 36 exercices'));
  section.append(empiecement);

  const corps = el('div', 'jersey corps-liste');
  const retour = document.createElement('a');
  retour.className = 'bouton--discret lien-retour';
  retour.href = '#/jour';
  retour.append(icone('icone-fleche', '15 5 8 12 15 19'), el('span', 'lien-retour__libelle', 'Aujourd’hui'));
  corps.append(retour);

  const liste = el('div', 'liste-programme');
  for (const famille of exercicesParFamille(programme)) {
    const groupe = el('div', 'groupe-programme');
    groupe.append(el('span', 'etiquette groupe-programme__titre', famille.nom));
    const lignes = el('div', 'groupe-programme__lignes');
    for (const ex of famille.exercices) {
      const fait = exerciceFaitCetteSemaine(etat.faits, semaine, ex.id);
      const ligne = el('div', `ligne-programme${fait ? ' ligne-programme--fait' : ''}`);
      const marque = el('span', 'ligne-programme__marque');
      if (fait) marque.append(icone('ligne-programme__coche', '5 13 10 18 19 7'));
      ligne.append(marque, el('span', 'ligne-programme__nom', ex.libelle), el('span', 'ligne-programme__objectif', objectifTexte(ex, semaine)));
      lignes.append(ligne);
    }
    groupe.append(lignes);
    liste.append(groupe);
  }
  corps.append(liste);

  section.append(corps);
  hote.append(section);

  return function demonter() {};
}

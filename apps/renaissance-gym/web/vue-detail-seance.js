// vue-detail-seance.js — le détail d'une case de la grille (PRD, A3 et A3
// bis, « Ajouté après les PRP »).
//
// C'est la feuille du club à la vraie granularité : le nom de la séance, et
// la liste de ses exercices, chacun marqué fait ou pas fait. Toute case
// ouvrable de la grille — la semaine en cours comme les semaines passées —
// mène ici, jamais à un bandeau de confirmation qui coche la séance entière :
// « la correction descend à l'exercice ».
//
// Chaque ligne porte DEUX gestes bien séparés, et il ne faut jamais les
// confondre (A3 bis) :
//   - Cocher / décocher : marque l'exercice fait ou pas fait, ne lance rien.
//   - Lancer : ouvre l'écran de séance pour de vrai, pour ce seul exercice,
//     avec l'objectif de LA SEMAINE DE CETTE CASE. Le retour ramène ici,
//     jamais à l'écran du jour (voir vue-seance.js, mode « cible unique »).
// Les deux cibles font chacune 56 px et ne se touchent jamais (PRD §5 : rien
// ne dépend d'un geste précis, aucune cible sous 56 px).
//
// AUCUN TOTAL, AUCUN POURCENTAGE, AUCUNE MOYENNE ici non plus (PRD §4, §14) :
// chaque ligne dit fait ou pas fait, point.

import { seance, exercicesDeSeance } from './programme.js';
import { faitsDeSeance } from './domaine.js';
import { ajouterFait, ecrireEtat, retirerFait } from './etat.js';
import { fusionnerRecords, recordsDepuisFaits } from './records.js';

function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

// Mêmes traits, même taille optique que vue-grille.js : jamais un glyphe de
// police (✓, ›) qui varie d'un système à l'autre.
function icone(classe, points) {
  const span = el('span', classe);
  span.innerHTML = `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="${points}"/></svg>`;
  return span;
}

// Sous-route « #/grille/seance/<semaine>/<numero> », posée par une case
// ouvrable de la grille. `null` quand la route ne porte pas cette forme
// précise — la vue redirige alors vers la grille plutôt que de rendre un
// écran cassé.
export function cibleDepuisHash(hash) {
  const trouve = /^#\/grille\/seance\/(\d+)\/(\d+)$/.exec(String(hash ?? ''));
  if (trouve === null) return null;
  const semaine = Number(trouve[1]);
  const numero = Number(trouve[2]);
  if (semaine < 1 || semaine > 8 || numero < 1 || numero > 4) return null;
  return { semaine, numero };
}

export function monterDetailSeance(hote, ctx) {
  const { programme, maintenant } = ctx;
  let etatCourant = ctx.etat;

  const hash = typeof location !== 'undefined' ? location.hash : '';
  const cible = cibleDepuisHash(hash);

  const section = el('section', 'ecran-detail-seance zone-surete');
  hote.append(section);

  if (cible === null) {
    if (typeof location !== 'undefined') location.hash = '#/grille';
    return function demonter() {};
  }

  const { semaine, numero } = cible;
  const s = seance(programme, numero);
  const exercices = exercicesDeSeance(programme, numero);

  const empiecement = el('div', 'empiecement empiecement--compact');
  // Deux étiquettes dans leur conteneur dédié (finition, correctif A repris
  // de vue-jour.js) : juxtaposées sans lui, elles se collent sans espace.
  const etiquettes = el('div', 'empiecement__etiquettes');
  etiquettes.append(el('span', 'etiquette', `Semaine ${semaine}`));
  etiquettes.append(el('span', 'etiquette', `Séance ${numero} sur 4`));
  empiecement.append(etiquettes);
  empiecement.append(el('h1', null, s !== undefined ? s.nom : `Séance ${numero}`));
  section.append(empiecement);

  const corps = el('div', 'jersey corps-detail-seance');
  const retour = document.createElement('a');
  retour.className = 'bouton--discret lien-retour';
  retour.href = '#/grille';
  retour.append(icone('icone-fleche', '15 5 8 12 15 19'), el('span', 'lien-retour__libelle', 'Ta grille'));
  corps.append(retour);

  const liste = el('div', 'liste-exercices');
  corps.append(liste);
  section.append(corps);

  function estFait(idExercice) {
    return faitsDeSeance(etatCourant.faits, semaine, numero).has(idExercice);
  }

  // A3 bis : cocher ou décocher une ligne, sans jamais rien lancer. Le fait
  // ajouté ici prend exactement la même forme que ceux produits par la
  // séance guidée — { seance, semaine, exercice, a } — plus le marqueur
  // `corrige`, pour que la fusion entre deux téléphones (PRD §9.8) ne
  // dédoublonne jamais mal une correction faite après coup.
  function alternerFait(ex) {
    if (estFait(ex.id)) {
      etatCourant = retirerFait({
        seance: numero, semaine, exercice: ex.id, a: maintenant().toISOString(),
      });
    } else {
      etatCourant = ajouterFait({
        seance: numero, semaine, exercice: ex.id, a: maintenant().toISOString(), corrige: true,
      });
      // A16 (lot ludique, « Ajouté après les PRP ») : cocher depuis la grille
      // est une validation comme une autre — elle compte pour « le plus
      // d'exercices faits dans une journée » et « le total », au même titre
      // qu'une validation depuis la séance guidée. Ne se fait JAMAIS au
      // retrait (`retirerFait` ci-dessus) : décocher n'est pas un acte
      // négatif, et un record déjà acquis ne redescend jamais (records.js).
      etatCourant = ecrireEtat({
        records: fusionnerRecords(etatCourant.records, recordsDepuisFaits(etatCourant.faits)),
      });
    }
    rendreListe();
  }

  // A3 bis : « Lancer » ouvre l'écran de séance ordinaire, réduit à ce seul
  // exercice — voir vue-seance.js, `cibleUniqueDepuisHash`. La semaine de
  // CETTE case voyage dans la route : l'objectif affiché est le sien, jamais
  // celui de la semaine courante.
  function allerLancer(ex) {
    if (typeof location !== 'undefined') location.hash = `#/seance/${numero}/${ex.id}/${semaine}`;
  }

  function rendreListe() {
    liste.replaceChildren();
    for (const ex of exercices) {
      const fait = estFait(ex.id);
      const ligne = el('div', 'ligne-exercice');

      // Geste 1, cocher/décocher : ne lance jamais rien.
      const boiteFait = el('button', `case-exercice${fait ? ' case-exercice--fait' : ''}`);
      boiteFait.type = 'button';
      boiteFait.setAttribute('aria-pressed', String(fait));
      boiteFait.setAttribute(
        'aria-label',
        fait ? `Marquer « ${ex.libelle} » comme pas fait` : `Marquer « ${ex.libelle} » comme fait`,
      );
      if (fait) boiteFait.append(icone('case-exercice__coche', '5 13 10 18 19 7'));
      boiteFait.addEventListener('click', () => alternerFait(ex));

      const nom = el('span', 'ligne-exercice__nom', ex.libelle);

      // Geste 2, lancer : ouvre l'exercice pour de vrai. Une cible séparée,
      // qui ne touche jamais la précédente (PRD §5, A3 bis).
      const lancer = el('button', 'bouton-lancer', 'Lancer');
      lancer.type = 'button';
      lancer.setAttribute('aria-label', `Lancer « ${ex.libelle} »`);
      lancer.addEventListener('click', () => allerLancer(ex));

      ligne.append(boiteFait, nom, lancer);
      liste.append(ligne);
    }
  }

  rendreListe();

  return function demonter() {};
}

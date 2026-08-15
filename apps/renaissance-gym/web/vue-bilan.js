// vue-bilan.js — A17 (« Ajouté après les PRP », le lot ludique) : l'écran de
// fin des huit semaines.
//
// « C'est la trace de son été » : ce module ne recalcule RIEN — il rend
// l'instantané déjà figé par `bilan.js` au moment où le programme s'est
// terminé (`vue-jour.js`), et rien de plus. Aucun bouton de partage, aucun
// envoi (PRD, lot ludique A17) : elle tend le téléphone, l'écran ne fait rien
// d'autre que se montrer.

import { phraseBilan } from './bilan.js';
import { construireSvgJustaucorps } from './vue-justaucorps.js';

function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

function icone(classe, points) {
  const span = el('span', classe);
  span.innerHTML = `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="${points}"/></svg>`;
  return span;
}

// Une ligne de record, seulement si elle porte quelque chose à montrer — un
// zéro n'est pas une faute (PRD §4, §14), mais il n'a rien à célébrer non
// plus, et un écran pensé pour être montré ne gagne rien à l'afficher.
function ligneRecord(texte, valeur) {
  return valeur > 0 ? el('p', 'bilan__record', texte) : null;
}

export function monterBilan(hote, ctx) {
  const { etat } = ctx;
  const bilan = etat.bilan ?? null;

  const section = el('section', 'ecran-bilan zone-surete');
  const empiecement = el('div', 'empiecement empiecement--compact');
  empiecement.append(el('h1', null, 'Ton été'));
  section.append(empiecement);

  const corps = el('div', 'jersey corps-bilan');
  const retour = document.createElement('a');
  retour.className = 'bouton--discret lien-retour';
  retour.href = '#/jour';
  retour.append(icone('icone-fleche', '15 5 8 12 15 19'), el('span', 'lien-retour__libelle', 'Aujourd’hui'));
  corps.append(retour);

  if (bilan === null) {
    // L'avenir ne se coche pas (PRD §9.3), et le bilan ne se montre pas
    // davantage avant l'heure : ni chiffre, ni promesse de ce qui viendra.
    corps.append(el('p', null, 'Ton bilan apparaîtra ici quand les huit semaines seront terminées.'));
  } else {
    corps.append(el('p', 'bilan__phrase', phraseBilan(bilan)));

    // `etat.parures`, la liste PERSISTÉE — jamais un recalcul depuis les
    // faits courants (voir vue-justaucorps.js) : un nouveau programme peut
    // avoir redémarré depuis, faits vidés, sans que « son justaucorps
    // entièrement paré » (PRD, lot ludique A17) n'en soit affecté.
    const figure = el('div', 'justaucorps__figure');
    figure.innerHTML = construireSvgJustaucorps(etat.parures ?? []);
    corps.append(figure);

    const records = bilan.records ?? {};
    const blocRecords = el('div', 'bilan__records');
    const tenue = ligneRecord(`Sa plus longue tenue : ${records.plusLongueTenue} secondes.`, records.plusLongueTenue);
    const jour = ligneRecord(`Le plus d’exercices faits dans une même journée : ${records.plusExercicesJour}.`, records.plusExercicesJour);
    for (const ligne of [tenue, jour]) {
      if (ligne !== null) blocRecords.append(ligne);
    }
    corps.append(blocRecords);
  }

  section.append(corps);
  hote.append(section);

  return function demonter() {};
}

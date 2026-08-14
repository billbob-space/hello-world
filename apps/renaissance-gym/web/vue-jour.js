// vue-jour.js — l'écran du jour (PRP 04 chantier A, PRD §7.2).
//
// Un seul écran pour les deux cas du PRD §7.2, parce que ce sont deux états
// du même écran et non deux écrans. `modeleJour` calcule tout ce qui
// s'affiche et ne touche à rien ; `monterJour` l'écrit dans le DOM et ne
// calcule rien — c'est ce partage qui rend les cas vérifiables sans
// navigateur (comme `marcq-handball`).
//
// L'écran ne montre JAMAIS de rouge, de retard, ni de compte de ce qui n'a
// pas été fait (PRD §14 : l'abandon est le risque principal).

import { seance } from './programme.js';
import { prochaineSeance, seancesFaites, semaineCourante } from './domaine.js';

function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

// Les noms de familles, dans l'ordre d'apparition dans la séance, sans
// doublon — jamais écrits en dur : dérivés de `programme.json` (ossature §7
// point 2).
function famillesDeSeance(programme, s) {
  const nomParId = new Map(programme.familles.map((f) => [f.id, f.nom]));
  const exParId = new Map(programme.exercices.map((ex) => [ex.id, ex]));
  const vues = new Set();
  const noms = [];
  for (const idEx of s.exercices) {
    const ex = exParId.get(idEx);
    if (ex !== undefined && !vues.has(ex.famille)) {
      vues.add(ex.famille);
      noms.push(nomParId.get(ex.famille) ?? ex.famille);
    }
  }
  return noms;
}

// Le modèle de l'écran, pur (ossature §6). `semaine` est celle qui compte
// pour l'affichage — bornée à 8, le neuvième cas étant « terminé ».
export function modeleJour(ctx) {
  const { etat, programme, maintenant } = ctx;
  const semaineBrute = semaineCourante(etat.debut, maintenant(), etat.semaineDeDepart);

  if (semaineBrute > 8) {
    return { cas: 'termine', semaine: 8 };
  }

  const semaine = semaineBrute;
  const numero = prochaineSeance(programme, etat.faits, semaine);

  if (numero === null) {
    return { cas: 'bouclee', semaine, seancesFaites: seancesFaites(programme, etat.faits, semaine) };
  }

  const s = seance(programme, numero);
  return {
    cas: 'a-faire',
    semaine,
    numero,
    nom: s.nom,
    familles: famillesDeSeance(programme, s),
  };
}

function construireStrass(nombreDeFacettes = 6) {
  const conteneur = el('div', 'strass strass--balaie');
  for (let i = 0; i < nombreDeFacettes; i += 1) conteneur.append(el('span', 'strass__facette'));
  return conteneur;
}

export function monterJour(hote, ctx) {
  const m = modeleJour(ctx);

  const section = el('section', 'ecran-jour zone-surete');
  const empiecement = el('div', 'empiecement');
  empiecement.append(el('span', 'etiquette', `Semaine ${m.semaine}`));
  section.append(empiecement, el('hr', 'passepoil'));

  const corps = el('div', 'jersey corps-jour');

  if (m.cas === 'termine') {
    corps.append(el('h1', 'titre-jour', 'Ton programme est terminé'));
    corps.append(el(
      'p',
      null,
      'Les huit semaines sont passées — bravo. Ta grille reste là pour la revoir.',
    ));
  } else if (m.cas === 'bouclee') {
    corps.append(el('h1', 'titre-jour', 'Ta semaine est bouclée.'));
    corps.append(construireStrass());
    // Discrète, et discrète pour de bon (PRD §9.5) : refaire une séance ne la
    // compte pas deux fois, `etat.ajouterFait` ignorant les doublons.
    const refaire = el('button', 'bouton--discret', 'Refaire une séance');
    refaire.type = 'button';
    refaire.addEventListener('click', () => {
      if (typeof location !== 'undefined') location.hash = '#/seance/1';
    });
    corps.append(refaire);
  } else {
    corps.append(el('span', 'etiquette', `Séance ${m.numero} sur 4`));
    corps.append(el('h1', 'titre-jour', m.nom));
    corps.append(el('p', 'familles-jour', m.familles.join(' · ')));
    const bouton = el('button', 'bouton', 'Commencer');
    bouton.type = 'button';
    bouton.addEventListener('click', () => {
      if (typeof location !== 'undefined') location.hash = `#/seance/${m.numero}`;
    });
    corps.append(bouton);
  }

  section.append(corps);
  hote.append(section);

  return function demonter() {};
}

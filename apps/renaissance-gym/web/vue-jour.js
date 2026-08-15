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

// Le mot le plus long de `nom`, sans espace (finition, correctif C) : la
// taille d'affichage doit se plier a l'unite qui ne peut jamais se couper en
// fin de ligne, pas a la longueur totale — sinon « Le socle », qui se replie
// deja proprement sur deux lignes ("Le" / "socle"), ratatinerait pour rien.
function plusLongMot(nom) {
  return nom.split(/\s+/).reduce((max, mot) => Math.max(max, mot.length), 1);
}

function construireStrass(nombreDeFacettes = 6) {
  const conteneur = el('div', 'strass strass--balaie');
  for (let i = 0; i < nombreDeFacettes; i += 1) conteneur.append(el('span', 'strass__facette'));
  return conteneur;
}

// L'accueil est le seul carrefour de l'application (PRP 05, PRP 07) : c'est
// d'ici, et de nulle part d'autre en dehors d'un « Retour », qu'on rejoint la
// grille et les reglages. Deux vrais liens (`<a>`), pas des boutons : le
// bouton retour du telephone doit fonctionner, et un appui long doit pouvoir
// les ouvrir dans un autre onglet.
function construireNavigationSecondaire() {
  const nav = el('div', 'nav-secondaire');
  const versGrille = document.createElement('a');
  versGrille.className = 'bouton--discret';
  versGrille.href = '#/grille';
  versGrille.textContent = 'Ta grille';
  const versReglages = document.createElement('a');
  versReglages.className = 'bouton--discret';
  versReglages.href = '#/reglages';
  versReglages.textContent = 'Réglages';
  nav.append(versGrille, versReglages);
  return nav;
}

export function monterJour(hote, ctx) {
  const m = modeleJour(ctx);

  const section = el('section', 'ecran-jour zone-surete');
  // Le passepoil et la couture sont un seul element (style.css,
  // `.empiecement::before`) : rien a monter ici a part l'empiecement
  // lui-meme (finition, correctif 2).
  const empiecement = el('div', 'empiecement');
  // Les deux etiquettes vivent chacune sur sa ligne (finition, correctif A) :
  // deux `span` inline-block juxtaposes sans texte entre eux se collent sans
  // le moindre espace — semaine et seance venaient s'accoler tout court,
  // sans espace ni separateur. Ce n'etait pas un probleme de contenu mais de
  // mise en page, ce conteneur le tranche.
  const etiquettes = el('div', 'empiecement__etiquettes');
  etiquettes.append(el('span', 'etiquette', `Semaine ${m.semaine}`));
  // « Séance X sur 4 » vit desormais dans l'empiecement, a cote de la
  // semaine : ce n'est plus un surtitre pose au-dessus du nom de la seance
  // (finition, correctifs 5 et 6) — seul le nom occupe le champ jersey.
  if (m.cas === 'a-faire') {
    etiquettes.append(el('span', 'etiquette', `Séance ${m.numero} sur 4`));
  }
  empiecement.append(etiquettes);
  section.append(empiecement);

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
    // Un seul objet focal (finition, correctif 5) : le nom de la séance,
    // seul, à la taille d'affichage, dans l'emplacement que `.objectif-seance`
    // occupe sur l'écran de séance — jamais un simple `h1.titre-jour`, bien
    // plus petit que le plus grand texte de l'application.
    const objectifNoeud = el('h1', 'objectif-seance');
    const nomNoeud = el('span', 'objectif-seance__nom', m.nom);
    // La taille d'affichage se plie au panneau (finition, correctif C) : sans
    // borne derivee du mot le plus long, « L'équilibre » et « L'acrobatie »
    // — plus longs que « Le socle » — debordent des deux cotes de l'ecran.
    nomNoeud.style.setProperty('--plus-long-mot', String(plusLongMot(m.nom)));
    objectifNoeud.append(nomNoeud);
    objectifNoeud.append(el('span', 'familles-jour', m.familles.join(' · ')));
    corps.append(objectifNoeud);
    const bouton = el('button', 'bouton', 'Commencer');
    bouton.type = 'button';
    bouton.addEventListener('click', () => {
      if (typeof location !== 'undefined') location.hash = `#/seance/${m.numero}`;
    });
    corps.append(bouton);
  }

  corps.append(construireNavigationSecondaire());

  section.append(corps);
  hote.append(section);

  return function demonter() {};
}

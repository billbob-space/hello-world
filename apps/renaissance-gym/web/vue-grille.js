// vue-grille.js — les huit semaines, les badges (PRP 05, PRD §7.4, §9.3 à
// §9.7, §6 lot 3 ; A3 et A3 bis, « Ajouté après les PRP »).
//
// C'est la feuille du club, en mieux : huit rangs de quatre cases. AUCUN
// TOTAL, AUCUN POURCENTAGE, AUCUNE MOYENNE n'est jamais rendu ici (PRD §4,
// §14) — ce qui a été fait se CONSTATE en regardant la grille, ça ne
// s'instrumente pas. La case se remplit d'or À PROPORTION des exercices
// faits (A3) : ce n'est jamais un chiffre, seulement un remplissage.
//
// Une case future n'a AUCUN gestionnaire de clic (PRD §9.3) : ce n'est pas
// une question de style desactive, la fonction qui la construit s'arrete
// avant d'appeler `addEventListener`. TOUTE AUTRE case OUVRABLE s'ouvre — la
// semaine en cours comme les semaines passées (A3, qui revient sur PRD §13) —
// et l'appui mène au détail de la séance (`vue-detail-seance.js`), jamais à
// un bandeau qui coche la séance entière d'un coup : la correction descend à
// l'exercice, elle ne vit plus ici.

import {
  semaineCourante, semaineEstFuture, seanceEstFaite, avancementSeance,
} from './domaine.js';
import { ecrireEtat } from './etat.js';
import { BADGES, nouveauxBadges } from './badges.js';

const SEMAINES_DU_PROGRAMME = 8;
const SEANCES_PAR_SEMAINE = 4;

function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

// Des icones en trait, jamais des glyphes de police (finition, correctif 8) :
// un seul poids de trait, une seule taille optique (style.css). Le HTML est
// analyse par le parseur HTML (innerHTML), qui bascule seul dans l'espace de
// noms SVG : `xmlns` n'est donc pas necessaire ici, et sa presence litterale
// casserait le test « aucune URL absolue » (tests/coque.test.js).
function icone(classe, points) {
  const span = el('span', classe);
  span.innerHTML = `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="${points}"/></svg>`;
  return span;
}

function construireStrass(nombreDeFacettes, balaie) {
  const conteneur = el('div', balaie ? 'strass strass--balaie' : 'strass');
  for (let i = 0; i < nombreDeFacettes; i += 1) conteneur.append(el('span', 'strass__facette'));
  return conteneur;
}

// Pur : le seul calcul de « quel visage porte cette case », partagé par le
// rendu et par les tests (PRP 05 : les quatre états du §Chantier A).
export function classeDeCase({
  faite, semaine, semaineCouranteActuelle,
}) {
  if (semaineEstFuture(semaine, semaineCouranteActuelle)) return 'future';
  if (faite) return 'faite';
  if (semaine === semaineCouranteActuelle) return 'encours';
  return 'passee-vide';
}

export function monterGrille(hote, ctx) {
  const { programme, maintenant } = ctx;
  let etatCourant = ctx.etat;

  const section = el('section', 'ecran-grille zone-surete');
  const empiecement = el('div', 'empiecement empiecement--compact');
  empiecement.append(el('h1', null, 'Ta grille'));
  section.append(empiecement);

  const corps = el('div', 'jersey corps-grille');
  const retour = document.createElement('a');
  retour.className = 'bouton--discret lien-retour';
  retour.href = '#/jour';
  retour.append(icone('icone-fleche', '15 5 8 12 15 19'), el('span', 'lien-retour__libelle', 'Aujourd’hui'));
  // A8 (« Ajouté après les PRP ») : la liste des trente-six exercices,
  // atteignable depuis la grille et depuis les réglages (vue-reglages.js).
  const versListe = document.createElement('a');
  versListe.className = 'bouton--discret';
  versListe.href = '#/liste';
  versListe.textContent = 'Les 36 exercices';
  const grille = el('div', 'grille-programme');
  const confirmation = el('div', 'confirmation-case');
  confirmation.hidden = true;
  const finProgramme = el('div', 'fin-programme');
  const zoneBadges = el('div', 'zone-badges');

  corps.append(retour, versListe, grille, confirmation, finProgramme, zoneBadges);
  section.append(corps);
  hote.append(section);

  function fermerConfirmation() {
    confirmation.hidden = true;
    confirmation.replaceChildren();
  }

  // Un geste explicite, confirme, jamais automatique (PRD §9.7) : ce
  // bandeau ne sert plus qu'a « Recommencer a zero », depuis que la
  // correction d'une case a migre vers le detail de la seance (A3).
  function ouvrirConfirmation(question, surOui) {
    confirmation.replaceChildren();
    confirmation.hidden = false;
    confirmation.append(el('p', 'confirmation-case__question', question));
    const rangee = el('div', 'confirmation-case__boutons');
    const oui = el('button', 'bouton', 'Oui');
    oui.type = 'button';
    const non = el('button', 'bouton--discret', 'Non');
    non.type = 'button';
    oui.addEventListener('click', () => {
      surOui();
      fermerConfirmation();
    });
    non.addEventListener('click', fermerConfirmation);
    rangee.append(oui, non);
    confirmation.append(rangee);
  }

  // Verifie ce qu'un changement de faits vient d'ouvrir comme badge, le
  // persiste (une fois, pour toujours — badges.js) et rend les nouveaux ids a
  // mettre en avant dans ce rendu-ci.
  function verifierBadges(avant, apres) {
    const nouveaux = nouveauxBadges(programme, avant, apres);
    if (nouveaux.length === 0) return { etat: apres, nouveaux };
    const badges = [...new Set([...(apres.badges ?? []), ...nouveaux])];
    return { etat: ecrireEtat({ badges }), nouveaux };
  }

  // A3 : la case porte son avancement — remplie d'or à proportion des
  // exercices faits, jamais en chiffre. Trois visages : vide, entamée (le
  // remplissage), finie (la coche). `avancementSeance` et `seanceEstFaite`
  // s'accordent toujours : la seconde est vraie exactement quand la première
  // vaut 1 (domaine.js).
  function construireCase(semaine, numero, semaineCouranteActuelle) {
    const avancement = avancementSeance(programme, etatCourant.faits, semaine, numero);
    const faite = seanceEstFaite(programme, etatCourant.faits, semaine, numero);
    const cas = classeDeCase({ faite, semaine, semaineCouranteActuelle });
    const entamee = cas !== 'future' && cas !== 'faite' && avancement > 0;

    const classes = ['case-seance', `case-seance--${cas}`];
    if (entamee) classes.push('case-seance--entamee');
    const bouton = el('button', classes.join(' '));
    bouton.type = 'button';
    bouton.setAttribute('aria-label', `Semaine ${semaine}, séance ${numero}`);

    if (entamee) {
      const remplissage = el('div', 'case-seance__remplissage');
      remplissage.style.transform = `scaleX(${avancement})`;
      bouton.append(remplissage);
    }

    if (cas === 'faite') {
      bouton.append(icone('case-seance__coche', '5 13 10 18 19 7'));
    } else if (cas === 'encours') {
      bouton.append(icone('case-seance__chevron', '9 5 16 12 9 19'));
    }

    // Semaine future : AUCUN gestionnaire de clic. Le test « une case future
    // est inerte » lit exactement cette absence (PRD §9.3).
    if (cas === 'future') {
      bouton.disabled = true;
      return bouton;
    }

    // Toute case ouvrable s'ouvre — la semaine en cours comme les semaines
    // passées (A3) — sur le détail de la séance, jamais sur un bandeau qui
    // coche tout d'un coup : la correction vit dans la liste, pas ici.
    bouton.addEventListener('click', () => {
      if (typeof location !== 'undefined') location.hash = `#/grille/seance/${semaine}/${numero}`;
    });
    return bouton;
  }

  function construireRang(semaine, semaineCouranteActuelle) {
    const rang = el('div', 'rang-semaine');
    if (semaine === semaineCouranteActuelle) rang.classList.add('rang-semaine--courante');
    rang.append(el('span', 'etiquette rang-semaine__etiquette', `S${semaine}`));
    const cases = el('div', 'rang-semaine__cases');
    for (let numero = 1; numero <= SEANCES_PAR_SEMAINE; numero += 1) {
      cases.append(construireCase(semaine, numero, semaineCouranteActuelle));
    }
    rang.append(cases);
    return rang;
  }

  function ouvrirConfirmationRecommencer() {
    ouvrirConfirmation('Recommencer tout le programme, depuis le début ?', () => {
      etatCourant = ecrireEtat({ debut: maintenant().toISOString(), semaineDeDepart: 1, faits: [] });
      rendreTout([]);
      if (typeof location !== 'undefined') location.hash = '#/jour';
    });
  }

  function rendreFinProgramme(semaineCouranteActuelle) {
    finProgramme.replaceChildren();
    if (semaineCouranteActuelle <= SEMAINES_DU_PROGRAMME) return;
    finProgramme.append(el('h2', 'titre-jour', 'Ton programme est terminé'));
    finProgramme.append(el('p', null, 'Ta grille reste là pour la revoir.'));
    const recommencer = el('button', 'bouton--discret', 'Recommencer à zéro');
    recommencer.type = 'button';
    recommencer.addEventListener('click', ouvrirConfirmationRecommencer);
    finProgramme.append(recommencer);
  }

  function rendreBadges(misEnAvant) {
    zoneBadges.replaceChildren();
    const gagnes = etatCourant.badges ?? [];
    if (gagnes.length === 0) return;
    zoneBadges.append(el('span', 'etiquette', 'Tes badges'));
    const liste = el('div', 'liste-badges');
    for (const id of gagnes) {
      const badge = BADGES.find((b) => b.id === id);
      if (badge === undefined) continue;
      const carte = el('div', 'badge-carte');
      carte.append(construireStrass(5, misEnAvant.includes(id)));
      carte.append(el('span', 'badge-carte__nom', badge.nom));
      carte.append(el('p', 'badge-carte__phrase', badge.phrase));
      liste.append(carte);
    }
    zoneBadges.append(liste);
  }

  function rendreTout(misEnAvant) {
    // A5 (« Ajouté après les PRP ») : la semaine courante se déduit désormais
    // des faits, jamais de l'horloge (voir domaine.js).
    const semaineCouranteActuelle = semaineCourante(programme, etatCourant.faits, etatCourant.semaineDeDepart);
    grille.replaceChildren();
    for (let semaine = 1; semaine <= SEMAINES_DU_PROGRAMME; semaine += 1) {
      grille.append(construireRang(semaine, semaineCouranteActuelle));
    }
    rendreFinProgramme(semaineCouranteActuelle);
    rendreBadges(misEnAvant);
  }

  // Au montage : un badge deja merite mais jamais encore constate (par
  // exemple ramene par une synchronisation) est signale une fois ici.
  const { etat: etatApresBadges, nouveaux } = verifierBadges(etatCourant, etatCourant);
  etatCourant = etatApresBadges;
  rendreTout(nouveaux);

  return function demonter() {};
}

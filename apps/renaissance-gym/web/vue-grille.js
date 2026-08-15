// vue-grille.js — les huit semaines, les corrections, les badges (PRP 05,
// PRD §7.4, §9.3 à §9.7, §6 lot 3).
//
// C'est la feuille du club, en mieux : huit rangs de quatre cases. AUCUN
// TOTAL, AUCUN POURCENTAGE, AUCUNE MOYENNE n'est jamais rendu ici (PRD §4,
// §14) — ce qui a été fait se CONSTATE en regardant la grille, ça ne
// s'instrumente pas.
//
// Une case future n'a AUCUN gestionnaire de clic (PRD §9.3) : ce n'est pas
// une question de style desactive, la fonction qui la construit s'arrete
// avant d'appeler `addEventListener`. Seules les semaines ECOULEES se
// corrigent (PRD §9.4) — la semaine en cours se joue depuis l'ecran du jour,
// jamais depuis la grille : ce n'est pas un second parcours d'entrainement
// (PRD §13).

import { exercicesDeSeance } from './programme.js';
import {
  semaineCourante, semaineEstFuture, semaineEstPassee, seanceEstFaite,
} from './domaine.js';
import { ajouterFait, retirerFait, ecrireEtat } from './etat.js';
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
  retour.className = 'bouton--discret';
  retour.href = '#/jour';
  retour.append(icone('icone-fleche', '15 5 8 12 15 19'), ' Aujourd’hui');
  const grille = el('div', 'grille-programme');
  const confirmation = el('div', 'confirmation-case');
  confirmation.hidden = true;
  const finProgramme = el('div', 'fin-programme');
  const zoneBadges = el('div', 'zone-badges');

  corps.append(retour, grille, confirmation, finProgramme, zoneBadges);
  section.append(corps);
  hote.append(section);

  function fermerConfirmation() {
    confirmation.hidden = true;
    confirmation.replaceChildren();
  }

  // Un appui sur une case corrigeable ouvre une confirmation COURTE, jamais
  // un ecran a part (PRP 05 chantier B).
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

  // Cocher enregistre TOUS les exercices de la seance, a la date du jour, et
  // marque `corrige: true` (PRP 05 chantier B) : la fusion §9.8 retient
  // toujours la date la plus ancienne, donc un exercice deja fait pour de
  // vrai n'est jamais ecrase par cette date de correction. Decocher retire
  // les faits, sans egard a l'origine de la date.
  function appliquerCorrection(semaine, numero, dejaFaite) {
    const avant = etatCourant;
    const exercicesSeance = exercicesDeSeance(programme, numero);
    let dernierEtat = avant;
    if (dejaFaite) {
      for (const ex of exercicesSeance) {
        dernierEtat = retirerFait({
          seance: numero, semaine, exercice: ex.id, a: maintenant().toISOString(),
        });
      }
    } else {
      for (const ex of exercicesSeance) {
        dernierEtat = ajouterFait({
          seance: numero, semaine, exercice: ex.id, a: maintenant().toISOString(), corrige: true,
        });
      }
    }
    const { etat, nouveaux } = verifierBadges(avant, dernierEtat);
    etatCourant = etat;
    rendreTout(nouveaux);
  }

  function construireCase(semaine, numero, semaineCouranteActuelle) {
    const faite = seanceEstFaite(programme, etatCourant.faits, semaine, numero);
    const cas = classeDeCase({ faite, semaine, semaineCouranteActuelle });

    const bouton = el('button', `case-seance case-seance--${cas}`);
    bouton.type = 'button';
    bouton.setAttribute('aria-label', `Semaine ${semaine}, séance ${numero}`);

    if (cas === 'faite') {
      bouton.append(icone('case-seance__coche', '5 13 10 18 19 7'));
    } else if (cas === 'encours') {
      bouton.append(icone('case-seance__chevron', '9 5 16 12 9 19'));
    }

    // Semaine future OU semaine en cours : AUCUN gestionnaire de clic. Le
    // test « une case future est inerte » lit exactement cette absence.
    if (cas === 'future' || cas === 'encours') {
      bouton.disabled = true;
      return bouton;
    }

    // Semaines ecoulees seulement : c'est la ou « le passe se corrige »
    // (PRD §9.4).
    if (semaineEstPassee(semaine, semaineCouranteActuelle)) {
      bouton.addEventListener('click', () => {
        const question = faite
          ? `Tu n’as pas fait la séance ${numero} de la semaine ${semaine} ?`
          : `Tu as fait la séance ${numero} de la semaine ${semaine} ?`;
        ouvrirConfirmation(question, () => appliquerCorrection(semaine, numero, faite));
      });
    }
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
    const semaineCouranteActuelle = semaineCourante(etatCourant.debut, maintenant(), etatCourant.semaineDeDepart);
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

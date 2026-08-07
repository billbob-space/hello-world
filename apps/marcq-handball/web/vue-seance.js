// vue-seance.js — l'ecran de seance : la LISTE COMPLETE des exercices.
//
// Pas un exercice a la fois : a 13 ans on veut savoir ce qui reste avant de
// commencer (PRD §7.3). Le module reprend la coupure du PRP 03 :
//   - le modele, pur, qui prend toutes les decisions et que node --test prouve ;
//   - le montage, qui pose ce modele dans le DOM et n'y ajoute aucune decision.

import { etatSeance } from './domaine.js';
import { cocher, decocher } from './etat.js';
import { creerOrchestre, monterChrono } from './chrono.js';
import { monterVideo } from './video.js';
import { dateEnToutesLettres } from './vue-jour.js';

// --- les libelles -----------------------------------------------------------

// « lundi 3 août » -> « 3 août ». Le jour de semaine se retire, la table des
// mois ne se recopie pas : une seconde table divergerait a la premiere retouche
// du calendrier, et c'est exactement le genre d'ecart qu'aucun test ne montre.
export function dateCourte(dateISO) {
  return dateEnToutesLettres(dateISO).replace(/^\S+\s/, '');
}

// Le coach a nomme ses blocs « Course » et « Renforcement » ; un seul bloc du
// programme porte un titre a lui (PRP 02, decision 2).
export function titreBloc(bloc) {
  return bloc.titre ?? (bloc.type === 'course' ? 'Course' : 'Renforcement');
}

// Le nombre de tours est affiche (PRD §7.3) — mais pas « 1 tour », qui
// n'apprend rien et alourdirait l'en-tete de chacun des sept blocs de course.
export function sousTitreBloc(bloc) {
  const morceaux = [];
  if (bloc.tours > 1) morceaux.push(`${bloc.tours} tours`);
  if (bloc.repos) morceaux.push(`repos ${bloc.repos}`);
  return morceaux.join(' · ');
}

// --- le modele --------------------------------------------------------------

// Pourquoi les cases sont inactives. Rend null quand elles ne le sont pas :
// l'appelant n'a alors rien a afficher, et l'invariant « motif === null si et
// seulement si cochable » se lit d'un coup d'oeil ici.
export function motifVerrou({ dateISO, aujourdhui, fin }) {
  if (aujourdhui > fin) return 'Le programme est terminé. Rien ne se coche plus.';
  if (dateISO > aujourdhui) return `Séance à venir. Elle s’ouvrira ${dateEnToutesLettres(dateISO)}.`;
  return null;
}

// Tout ce que le montage doit savoir, et rien de plus. Pur : memes entrees,
// memes sorties, aucun DOM, aucune horloge — `ctx.aujourdhui` est calcule une
// seule fois par app.js (PRP 03). Rend null si aucune seance n'a lieu ce jour-la.
export function modeleSeance(ctx, dateISO) {
  const { prog, aujourdhui, faits = {} } = ctx;
  const seance = prog.seances.find((s) => s.date === dateISO);
  if (!seance) return null;

  const etat = etatSeance(prog, dateISO, aujourdhui, faits);

  return {
    date: seance.date,
    titre: seance.titre,
    semaine: seance.semaine,
    dateLisible: dateEnToutesLettres(seance.date),
    cochable: etat.cochable,
    motif: motifVerrou({ dateISO, aujourdhui, fin: prog.fin }),
    statut: etat.statut,
    total: etat.total,
    coches: etat.coches,
    // La part de CETTE seance, pas celle du rang : le denominateur du
    // classement est `progression()` du domaine, calcule sur ce qui est
    // programme a ce jour (PRD §9). Confondre les deux ferait afficher 100 %
    // des la premiere seance finie.
    part: etat.total === 0 ? 0 : etat.coches / etat.total,
    blocs: seance.blocs.map((bloc) => ({
      titre: titreBloc(bloc),
      sousTitre: sousTitreBloc(bloc),
      exercices: bloc.exercices.map((ex) => ({
        id: ex.id,
        libelle: ex.libelle,
        // La mesure passe TELLE QUELLE : c'est `chrono.js` qui decide s'il y a
        // une duree prescrite, et lui seul. La recopier ici en « minuteur oui/
        // non » mettrait la meme regle a deux endroits.
        mesure: ex.mesure ?? null,
        // L'adresse choisie par un adulte, quand il y en a une. Absente, c'est
        // `video.js` qui retombe sur une recherche — cet ecran ne decide rien.
        video: ex.video ?? null,
        fait: Object.prototype.hasOwnProperty.call(faits, ex.id),
      })),
    })),
  };
}

// Les deux seances qui encadrent une date, qu'elle porte une seance ou non.
// `chargerProgramme` valide les seances strictement croissantes : la derniere
// anterieure et la premiere posterieure sont bien les deux voisines.
export function voisines(prog, dateISO) {
  const dates = prog.seances.map((s) => s.date);
  return {
    precedente: dates.filter((d) => d < dateISO).at(-1) ?? null,
    suivante: dates.find((d) => d > dateISO) ?? null,
  };
}

// Un tap, une ecriture. La persistance ne differe pas a la sortie d'ecran : un
// ado qui ferme l'onglet entre deux series ne doit rien perdre.
// Rend les faits a jour — ceux que `etat.js` vient de relire depuis le
// stockage. `faits` n'est pas mute : le contrat d'ecran du PRP 03 interdit de
// toucher a `ctx`, et un second etat tenu en memoire divergerait en silence.
export function basculerFait(faits, id, quand = new Date().toISOString()) {
  return Object.prototype.hasOwnProperty.call(faits, id) ? decocher(id) : cocher(id, quand);
}

// --- la route ---------------------------------------------------------------

// Le mois et le jour sont bornes : un fragment forge comme #/seance/2026-13-45
// n'atteint jamais le rendu, qui n'a donc pas a se defendre d'une date
// impossible. L'expression vit ici et non dans app.js — c'est l'ecran qui sait
// lire sa propre route, app.js n'en tient que le tableau.
export const MOTIF_SEANCE =
  /^#\/seance\/(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))$/;

export function dateDeLaRoute(route) {
  const trouve = MOTIF_SEANCE.exec(route);
  return trouve === null ? null : trouve[1];
}

// --- le montage -------------------------------------------------------------
// Il pose le modele dans le DOM et n'y ajoute AUCUNE decision. Tout ce qui se
// decide est au-dessus, et se prouve sans navigateur.

// Les deux points d'accroche du PRP 06. Ils remontent (bubbles) : les
// recompenses s'ecoutent depuis `document`, sans modifier ce fichier ni la
// signature de monterSeance. Le PRP 10 branchera le ressenti sur le second.
export const EVT_COCHAGE = 'marcq:exercice-coche';
export const EVT_SEANCE_COMPLETE = 'marcq:seance-complete';

function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  // textContent, jamais du HTML compose : le programme est une donnee editable
  // a la main, un libelle contenant un chevron casserait la page.
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

// Le pied d'ecran : les deux seances voisines. C'est le chemin du rattrapage
// tant que le calendrier de l'ecran perso n'existe pas (PRP 05). Des liens, pas
// des boutons : le bouton retour du telephone doit rester une navigation.
function piedDeSeance(prog, dateISO) {
  const { precedente, suivante } = voisines(prog, dateISO);
  if (precedente === null && suivante === null) return null;

  const pied = el('nav', 'voisines');
  pied.setAttribute('aria-label', 'Autres séances');
  for (const [date, classe, texte] of [
    [precedente, 'lien-voisine vers-precedente', precedente && `← ${dateCourte(precedente)}`],
    [suivante, 'lien-voisine vers-suivante', suivante && `${dateCourte(suivante)} →`],
  ]) {
    if (date === null) continue;
    const a = el('a', classe, texte);
    a.href = `#/seance/${date}`;
    pied.append(a);
  }
  return pied;
}

// L'ecran de seance, au contrat du PRP 03 : (hote, ctx). Rien ne deborde de
// `hote` — pas de minuterie, pas d'ecouteur sur window — il n'y a donc rien a
// rendre : le routeur vide `hote` avant le montage suivant et les ecouteurs
// poses ici disparaissent avec lui.
export function monterSeance(hote, ctx) {
  const dateISO = dateDeLaRoute(ctx.route);
  const modele = modeleSeance(ctx, dateISO);

  const section = el('section', 'ecran ecran-seance');

  if (modele === null) {
    // Une date sans seance : du repos, pas une erreur (PRD §9). Les voisines
    // restent affichees, sans quoi l'enfant serait coince sur cet ecran.
    section.append(
      el('h1', 'titre-ecran', 'Pas de séance ce jour-là'),
      el('p', 'aide', dateISO === null
        ? 'Cette adresse ne désigne aucune séance.'
        : `Le programme ne prévoit rien le ${dateCourte(dateISO)}. C’est du repos, pas un oubli.`),
    );
    const repli = piedDeSeance(ctx.prog, dateISO ?? ctx.aujourdhui);
    if (repli) section.append(repli);
    hote.append(section);
    return;
  }

  section.dataset.seance = modele.date;

  section.append(
    el('p', 'date-seance', `Semaine ${modele.semaine} · ${modele.dateLisible}`),
    el('h1', 'titre-ecran', modele.titre),
  );

  // <progress> natif, comme l'ecran du jour : annonce par les lecteurs d'ecran,
  // sans calcul de largeur ni bibliotheque. Le ressort du PRD §10 s'ajoutera
  // par le CSS au PRP 06, sans changer une ligne d'ici.
  const progression = el('p', 'progression-seance');
  const barre = el('progress', 'barre');
  barre.max = modele.total;
  const compte = el('span', 'compte');
  progression.append(barre, compte);
  section.append(progression);

  if (modele.motif !== null) {
    section.classList.add('seance-verrouillee');
    section.append(el('p', 'verrou-seance', modele.motif));
  }

  // Les lignes, retenues par identifiant : un tap met a jour SA ligne, jamais
  // toute la liste — un rendu complet perdrait le focus et la position de
  // defilement au milieu d'une seance.
  const lignes = new Map();
  // Un seul minuteur tourne a la fois, sur toute la seance : l'orchestre est
  // cree ici et passe a chacun.
  const orchestre = creerOrchestre();
  const demontages = [];

  for (const bloc of modele.blocs) {
    const groupe = el('section', 'bloc-seance');
    groupe.append(el('h2', 'titre-bloc', bloc.titre));
    if (bloc.sousTitre !== '') groupe.append(el('p', 'tours-bloc', bloc.sousTitre));

    const liste = el('ul', 'exercices');
    for (const ex of bloc.exercices) {
      const item = el('li', 'exercice');
      if (ex.fait) item.classList.add('fait');

      // Une case native dans une etiquette qui prend toute la largeur : la zone
      // de tap est la LIGNE entiere, et le clavier comme les lecteurs d'ecran
      // fonctionnent sans un attribut ARIA de plus.
      const etiquette = el('label', 'ligne-exercice');
      const boite = document.createElement('input');
      boite.type = 'checkbox';
      boite.className = 'case-exercice';
      boite.checked = ex.fait;
      // Une case desactivee n'emet jamais d'evenement `change` : c'est la
      // traduction DOM de « l'avenir ne se coche pas » (PRD §9).
      boite.disabled = !modele.cochable;
      boite.dataset.exercice = ex.id;

      etiquette.append(boite, el('span', 'libelle-exercice', ex.libelle));
      item.append(etiquette);
      // LE MINUTEUR EST HORS DE L'ETIQUETTE, et ce n'est pas un detail de mise
      // en page : un bouton place dedans ferait basculer la case a chaque tap —
      // l'etiquette couvre toute la ligne, c'est ce qui donne au PRP 04 sa zone
      // de tap pleine largeur. Demarrer un rebours cocherait donc l'exercice.
      // Le lien et le minuteur partagent la meme colonne de droite, et sont
      // HORS de l'etiquette pour la meme raison : elle couvre toute la ligne, un
      // tap dedans cocherait l'exercice au lieu d'ouvrir la video.
      const actions = el('div', 'actions-exercice');
      item.append(actions);
      monterVideo(actions, ex);
      demontages.push(monterChrono(actions, ex, { orchestre }));
      liste.append(item);
      lignes.set(ex.id, item);
    }
    groupe.append(liste);
    section.append(groupe);
  }

  const pied = piedDeSeance(ctx.prog, dateISO);
  if (pied) section.append(pied);

  function majProgression(m) {
    barre.value = m.coches;
    compte.textContent = m.coches === m.total
      ? `Séance complète · ${m.total} / ${m.total}`
      : `${m.coches} / ${m.total}`;
  }
  majProgression(modele);

  // `ctx.faits` n'est jamais mute (regle 1) : la vue tient son propre etat, et
  // c'est le retour de `basculerFait` — relu depuis le stockage — qui fait foi.
  let faits = ctx.faits;
  let complete = modele.coches === modele.total;

  // Une seule ecoute pour toute la liste : le parent sait deja quelle case a
  // change, et cinquante-trois fermetures gardees en vie ne rendraient rien de
  // plus. `change` remonte depuis une case a cocher.
  section.addEventListener('change', (e) => {
    const boite = e.target;
    if (!(boite instanceof HTMLInputElement) || boite.dataset.exercice === undefined) return;

    const id = boite.dataset.exercice;
    faits = basculerFait(faits, id);
    const fait = Object.prototype.hasOwnProperty.call(faits, id);

    // La case affiche ce que le stockage contient, jamais ce que le tap a suppose.
    boite.checked = fait;
    const ligne = lignes.get(id);
    if (ligne) ligne.classList.toggle('fait', fait);

    const suivant = modeleSeance({ ...ctx, faits }, dateISO);
    majProgression(suivant);

    section.dispatchEvent(new CustomEvent(EVT_COCHAGE, {
      bubbles: true,
      detail: {
        id, fait, ligne: ligne ?? null,
        coches: suivant.coches, total: suivant.total, part: suivant.part,
      },
    }));

    // La seance se valide au moment ou la derniere case tombe, et seulement a
    // ce moment : decocher puis recocher rejoue l'evenement, rester complet ne
    // le rejoue pas. Sans ce garde, les confettis du PRP 06 repartiraient a
    // chaque tap sur une seance deja finie.
    if (suivant.coches === suivant.total && !complete) {
      complete = true;
      section.dispatchEvent(new CustomEvent(EVT_SEANCE_COMPLETE, {
        bubbles: true,
        detail: { date: modele.date, total: suivant.total },
      }));
    } else if (suivant.coches < suivant.total) {
      complete = false;
    }
  });

  hote.append(section);
  // Chaque minuteur pose un battement ; sans ce demontage, quitter l'ecran en
  // laisserait tourner un par visite.
  return () => { for (const arreter of demontages) arreter(); };
}

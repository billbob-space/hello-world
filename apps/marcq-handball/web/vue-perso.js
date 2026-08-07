// vue-perso.js — ce que l'enfant a accompli, et personne d'autre.
//
// PRD §7.5 : « Ma progression » vient AVANT « L'equipe ». Cet ecran ne compare
// rien, il lit. La comparaison aux autres est le lot 2 (PRP 09) et s'ajoutera
// SOUS le calendrier, sans toucher a une ligne de ce fichier.
//
// Deux moities, comme a l'ecran de seance : un modele pur que node --test
// prouve, puis un montage qui n'ajoute aucune decision.

import { calendrier, etatSeance, progression, totauxAccomplis } from './domaine.js';
import { dateEnToutesLettres } from './vue-jour.js';

// --- le langage d'ado -------------------------------------------------------

// « 2 h 10 », pas « 130 min » (PRD §7.5). Sous la minute la seconde compte —
// c'est l'unite du gainage ; au-dela elle n'apprend plus rien, et le PRD §8
// arrondit lui-meme le gainage a la minute (« ~24 minutes »).
export function formaterDuree(secondes) {
  const s = Math.max(0, Math.round(secondes));
  if (s < 60) return `${s} s`;
  const minutes = Math.round(s / 60);
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  // Deux chiffres pour les minutes, comme sur une horloge : « 1 h 05 » et
  // jamais « 1 h 5 ».
  return reste === 0 ? `${heures} h` : `${heures} h ${String(reste).padStart(2, '0')}`;
}

// Le pluriel se pose ici et pas au montage : c'est du texte, et le texte se
// prouve sans navigateur. Zero prend le singulier, comme en francais.
function pluriel(n, mot) {
  return `${n} ${mot}${n > 1 ? 's' : ''}`;
}

// L'ordre est celui de la phrase du PRD §7.5 — « 112 pompes, 165 squats,
// 45 burpees, 2 h 10 de course » — complete par les trois unites que cette
// phrase n'illustre pas. La course ferme la liste : c'est la seule qui se lit
// en heures, et c'est la chute du recit.
const VOLUME = [
  { unite: 'pompes', dire: (n) => pluriel(n, 'pompe') },
  { unite: 'squats', dire: (n) => pluriel(n, 'squat') },
  { unite: 'burpees', dire: (n) => pluriel(n, 'burpee') },
  { unite: 'abdos', dire: (n) => pluriel(n, 'abdo') },
  { unite: 'fentes', dire: (n) => pluriel(n, 'fente') },
  { unite: 'gainage_s', dire: (s) => `${formaterDuree(s)} de gainage` },
  { unite: 'min_course', dire: (min) => `${formaterDuree(min * 60)} de course` },
];

// Les unites a zero sortent de la liste : « 0 burpee » n'est pas un recit, et le
// 3 aout au matin il y en aurait six sur sept. `cases` n'est pas un volume et
// n'apparait pas ici — il sert a la part, au-dessus.
export function lignesVolume(totaux) {
  return VOLUME
    .filter(({ unite }) => (totaux[unite] ?? 0) > 0)
    .map(({ unite, dire }) => ({ unite, phrase: dire(totaux[unite]) }));
}

// --- le calendrier ----------------------------------------------------------

// Les six etats viennent du domaine (PRP 02) : cet ecran n'en invente aucun et
// n'en fusionne aucun. Le PRD §7.5 en nomme quatre — faite, manquee, a venir,
// repos ; les deux autres sont ceux que le domaine distingue et qu'aucun des
// quatre ne dirait sans mentir (voir « Points d'attention » du PRP).
// L'ordre des cles est celui de la legende.
export const ETATS = {
  'faite': { libelle: 'faite', marque: '✓' },
  'partielle': { libelle: 'commencée', marque: '½' },
  'aujourd-hui': { libelle: 'aujourd’hui', marque: '●' },
  'a-venir': { libelle: 'à venir', marque: '○' },
  'manquee': { libelle: 'manquée', marque: '—' },
  'repos': { libelle: 'repos', marque: '' },
};

// Le lundi ouvre la semaine : zero case vide quand le programme commence un
// lundi — le cas de 2026 — et jusqu'a six sinon. Calcule, jamais suppose :
// programme.json est editable et la saison suivante peut commencer autrement
// (PRD §8). Une date ISO sans heure est lue en UTC, `getUTCDay` ne subit donc
// aucun fuseau.
export function decalageInitial(dateISO) {
  const depuisDimanche = new Date(`${dateISO}T00:00:00Z`).getUTCDay();
  return (depuisDimanche + 6) % 7;
}

// Ce qu'une case du calendrier montre et annonce.
function decrireJour(prog, jour, aujourdhui, faits) {
  const { libelle, marque } = ETATS[jour.statut];
  const commun = {
    date: jour.date,
    numero: Number(jour.date.slice(8, 10)),
    statut: jour.statut,
    marque,
    estSeance: jour.seance !== null,
    estAujourdhui: jour.date === aujourdhui,
  };

  if (jour.seance === null) {
    return {
      ...commun,
      href: null,
      detail: null,
      nom: `${dateEnToutesLettres(jour.date)} · ${libelle}`,
    };
  }

  // `calendrier` rend le statut, pas le compte. Plutot que de recompter les
  // cases ici, on interroge `etatSeance` — deja exportee par le domaine
  // (ossature §5) — sur les seuls jours de seance.
  const { coches, total } = etatSeance(prog, jour.date, aujourdhui, faits);
  const detail = `${coches} sur ${total}`;
  return {
    ...commun,
    href: `#/seance/${jour.date}`,
    detail,
    nom: `${dateEnToutesLettres(jour.date)} · ${jour.seance.titre} · ${libelle} · ${detail}`,
  };
}

// Seulement les etats presents : le 3 aout au matin, une legende de six lignes
// en expliquerait quatre qui ne sont nulle part sur la grille.
function legendeDe(jours) {
  const presents = new Set(jours.map((j) => j.statut));
  return Object.entries(ETATS)
    .filter(([statut]) => presents.has(statut))
    .map(([statut, { libelle, marque }]) => ({ statut, libelle, marque }));
}

// --- le modele --------------------------------------------------------------

// Il ne recalcule rien : il appelle le domaine (PRP 02) et met en forme.
export function modelePerso(ctx) {
  const { prog, aujourdhui, faits = {} } = ctx;
  const p = progression(prog, aujourdhui, faits);
  const lignes = lignesVolume(totauxAccomplis(prog, faits));
  const jours = calendrier(prog, aujourdhui, faits)
    .map((jour) => decrireJour(prog, jour, aujourdhui, faits));
  const seances = jours.filter((j) => j.estSeance).length;

  return {
    titre: 'Ma progression',
    part: {
      cochees: p.cochees,
      programmees: p.programmees,
      pourcent: Math.round(p.part * 100),
      // <progress max="0"> est invalide. Avant la premiere seance l'echelle vaut
      // 1 et la barre est vide : exactement ce qu'il faut montrer, sans laisser
      // le montage decider quoi que ce soit.
      echelle: Math.max(1, p.programmees),
      phrase: p.programmees === 0
        ? `Le programme commence ${dateEnToutesLettres(prog.debut)}.`
        : `${pluriel(p.cochees, 'exercice')} sur ${p.programmees} programmés à ce jour.`,
    },
    volume: {
      lignes,
      // Un ecran vide n'est pas une punition : il dit par ou ca commence.
      vide: lignes.length === 0
        ? 'Rien de coché pour l’instant. La première case ouvre le compteur.'
        : null,
    },
    calendrier: {
      decalage: decalageInitial(prog.debut),
      // Compte, jamais ecrit : « 19 jours · 7 seances » suit programme.json.
      resume: `${jours.length} jours · ${pluriel(seances, 'séance')}`,
      jours,
      legende: legendeDe(jours),
    },
  };
}

// --- le montage -------------------------------------------------------------
// Il pose le modele dans le DOM et n'y ajoute AUCUNE decision. Tout ce qui se
// decide est au-dessus, et se prouve sans navigateur.

// Les six memes lignes qu'a l'ecran de seance. `vue-seance.js` ne les exporte
// pas, et les hisser dans un module partage changerait une interface que le
// PRP 04 a fixee : beaucoup de bruit pour six lignes.
function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  // textContent, jamais du HTML compose : le programme est une donnee editable
  // a la main, un libelle contenant un chevron casserait la page.
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

function lien(href, classe, texte) {
  const a = el('a', classe, texte);
  a.href = href;
  return a;
}

// La part accomplie, en grand : c'est le premier chiffre de l'ecran. Le volume
// vient juste apres, en second (PRD §9).
function blocPart(part) {
  const bloc = el('div', 'part-perso');

  const chiffre = el('p', 'chiffre-part', `${part.pourcent} %`);
  // Le nombre est pose a sa valeur : rien ne roule sur un ecran qu'on consulte.
  // L'attribut est l'accroche du test, qui lit la valeur sans analyser le texte.
  chiffre.dataset.compteur = String(part.pourcent);

  // Une <progress> native, comme aux ecrans du jour et de seance : annoncee par
  // les lecteurs d'ecran sans un attribut ARIA de plus.
  const jauge = el('p', 'progression-perso');
  const barre = document.createElement('progress');
  barre.className = 'barre';
  barre.max = part.echelle;
  barre.value = part.cochees;
  jauge.append(barre);

  bloc.append(chiffre, jauge, el('p', 'phrase-part', part.phrase));
  return bloc;
}

function blocVolume(volume) {
  const bloc = el('section', 'volume-perso');
  bloc.append(el('h2', 'titre-bloc', 'Ce que tu as fait'));

  if (volume.vide !== null) {
    bloc.append(el('p', 'aide', volume.vide));
    return bloc;
  }

  const liste = el('ul', 'liste-volume');
  for (const ligne of volume.lignes) {
    const item = el('li', 'item-volume', ligne.phrase);
    // L'accroche du test : la ligne se retrouve par son unite, sans analyser le
    // texte qu'elle affiche.
    item.dataset.unite = ligne.unite;
    liste.append(item);
  }
  bloc.append(liste);
  return bloc;
}

function blocCalendrier(cal) {
  const bloc = el('section', 'calendrier-perso');
  bloc.append(
    el('h2', 'titre-bloc', 'Le calendrier'),
    el('p', 'resume-calendrier', cal.resume),
  );

  // Les initiales n'apprennent rien a qui n'a pas la grille sous les yeux :
  // chaque case annonce deja sa date en toutes lettres.
  const entete = el('div', 'entete-calendrier');
  entete.setAttribute('aria-hidden', 'true');
  for (const initiale of ['L', 'M', 'M', 'J', 'V', 'S', 'D']) {
    entete.append(el('span', null, initiale));
  }
  bloc.append(entete);

  const grille = el('div', 'grille-calendrier');
  for (let i = 0; i < cal.decalage; i += 1) {
    // Les cases d'avant le premier jour alignent la grille sur la semaine ;
    // elles ne portent aucune information.
    const vide = el('span', 'jour-calendrier jour-hors');
    vide.setAttribute('aria-hidden', 'true');
    grille.append(vide);
  }

  for (const jour of cal.jours) {
    const classe = `jour-calendrier jour-${jour.statut}`;
    // Un jour de seance est un lien — le calendrier est l'autre chemin du
    // rattrapage (PRD §6, lot 1 point 4). Un jour de repos n'est pas cliquable :
    // il n'y a rien a ouvrir, et un lien mort se tape trois fois avant qu'on
    // comprenne.
    const cellule = jour.href === null ? el('span', classe) : lien(jour.href, classe);

    const numero = el('span', 'numero-jour', String(jour.numero));
    numero.setAttribute('aria-hidden', 'true');
    const marque = el('span', 'marque-jour', jour.marque);
    marque.setAttribute('aria-hidden', 'true');
    // Ce que l'oeil lit dans la couleur et la marque, le lecteur d'ecran le lit
    // ici. Un aria-label sur un <span> sans role n'est pas restitue partout ;
    // du texte l'est.
    cellule.append(numero, marque, el('span', 'lu-seul', jour.nom));
    if (jour.estAujourdhui) cellule.setAttribute('aria-current', 'date');
    grille.append(cellule);
  }
  bloc.append(grille);

  const legende = el('ul', 'legende-calendrier');
  for (const etat of cal.legende) {
    const item = el('li', 'item-legende');
    const marque = el('span', 'marque-legende', etat.marque);
    marque.classList.add(`jour-${etat.statut}`);
    item.append(marque, el('span', null, etat.libelle));
    legende.append(item);
  }
  bloc.append(legende);
  return bloc;
}

// L'ecran, au contrat du PRP 03. Rien a demonter : aucun ecouteur ne deborde de
// `hote`, que le routeur vide avant chaque montage.
export function monterPerso(hote, ctx) {
  const m = modelePerso(ctx);
  const section = el('section', 'ecran ecran-perso');
  section.append(
    el('h1', 'titre-ecran', m.titre),
    blocPart(m.part),
    blocVolume(m.volume),
    blocCalendrier(m.calendrier),
  );

  // « L'equipe » VIVAIT ICI, sous le calendrier, et n'y vit plus : elle a son
  // onglet et son ecran, `#/equipe`. Le placement d'origine suivait le PRD §7.5
  // — la comparaison au second niveau de lecture — mais le second niveau d'un
  // DOCUMENT n'est pas le bas d'un ecran : podium, position et bouton pour
  // rejoindre se trouvaient derriere un calendrier de dix-neuf jours a
  // derouler, donc nulle part. Un onglet respecte la meme regle sans la payer :
  // il ne devance personne, il se choisit.
  //
  // Cet ecran ne parle donc plus a personne du tout, et tests/perso.test.js le
  // verifie en cherchant dans cette source l'appel reseau du navigateur — dont
  // le nom ne peut pas s'ecrire ici sans faire tomber le test qui le cherche.
  hote.append(section);
  return () => {};
}

// vue-justaucorps.js — A13 et A14 (« Ajouté après les PRP », le lot ludique) :
// le justaucorps qui se pare, et ses couleurs.
//
// C'est le seul écran où le dessin prend toute la place (PRD, lot ludique
// A13) : rien d'autre n'y vit qu'elle-même, ce qu'elle a gagné, et le choix
// qu'elle peut faire. Il n'apparaît JAMAIS pendant une séance — même règle
// que le rang de strass (`vue-seance.js` ne monte ni l'un ni l'autre) — et
// n'affiche AUCUNE parure verrouillée : ce qui manque ne se montre jamais en
// creux, ni cadenas ni compte à rebours. `construireSvgJustaucorps` ne rend
// donc QUE ce qu'elle a : une parure absente n'existe simplement pas dans le
// dessin, elle n'y est pas cachée.
//
// A14 : les six couleurs sont CELLES DU JUSTAUCORPS, pas celles de
// l'application — aucun jeton de style.css (--bleu-roi, --fuchsia, --or,
// --jersey) n'est redéfini ici, l'application ne se repeint pas. Trois des
// six réutilisent des jetons déjà existants (parce qu'ils appartiennent déjà
// au monde du club et du sport) ; les trois autres sont propres à cet écran
// (`--parure-*`, style.css) et n'existent nulle part ailleurs dans
// l'interface. Chaque combinaison associe le velours choisi à l'or — jamais
// une seconde couleur libre : l'or reste ce que le reste de l'application dit
// déjà, « ce qui est acquis » (DESIGN.md), et c'est lui qui pare les huit
// parures plus bas, quelle que soit la couleur choisie ici.

import { PARURES, nouvellesParures } from './parures.js';
import { ecrireEtat } from './etat.js';

function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

// Mêmes traits, même taille optique que les autres écrans (vue-grille.js) :
// jamais un glyphe de police qui varie d'un système à l'autre.
function icone(classe, points) {
  const span = el('span', classe);
  span.innerHTML = `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="${points}"/></svg>`;
  return span;
}

// A14 : toutes disponibles dès le premier jour, aucune à gagner.
export const COULEURS = [
  { id: 'bleu-roi', nom: 'Bleu roi et or', jeton: '--bleu-roi' },
  { id: 'fuchsia', nom: 'Fuchsia et or', jeton: '--fuchsia' },
  { id: 'nuit', nom: 'Nuit et or', jeton: '--bleu-nuit' },
  { id: 'grenat', nom: 'Grenat et or', jeton: '--parure-grenat' },
  { id: 'emeraude', nom: 'Émeraude et or', jeton: '--parure-emeraude' },
  { id: 'violine', nom: 'Violine et or', jeton: '--parure-violine' },
];

export function couleurParId(id) {
  return COULEURS.find((c) => c.id === id) ?? COULEURS[0];
}

// --- Le dessin, pur : une chaîne de balisage, jamais un accès au DOM -------
//
// « Un justaucorps se coud, il ne s'arrondit pas » (DESIGN.md) : aucune
// courbe, seulement des polygones et des polylignes — le même vocabulaire que
// le reste du système (biseau, couture à 12°, losanges de strass). Le contour
// est UN SEUL polygone continu : deux bretelles, une encolure, deux emmanchures
// et une échancrure de jambe haute.

const VIEWBOX = '0 0 200 260';

const CONTOUR = [
  [78, 8], [70, 30], [58, 56], [52, 112], [60, 152], [90, 236],
  [100, 200], [110, 236], [140, 152], [148, 112], [142, 56], [130, 30], [122, 8], [100, 34],
];

function pts(liste) {
  return liste.map(([x, y]) => `${x},${y}`).join(' ');
}

function silhouette() {
  return `<polygon points="${pts(CONTOUR)}" fill="var(--couleur-choisie)" />`;
}

// Une facette d'or, la même forme que `.strass__facette` (style.css) —
// « un losange tourné », ici tracé en coordonnées absolues du dessin.
function losange(cx, cy, taille) {
  const demi = taille / 2;
  return `<polygon points="${cx},${cy - demi} ${cx + demi},${cy} ${cx},${cy + demi} ${cx - demi},${cy}" fill="var(--or)" opacity="0.85" />`;
}

function rangStrass(cy) {
  return [70, 85, 100, 115, 130].map((x) => losange(x, cy, 10)).join('');
}

// Chaque `partie` du catalogue de `parures.js` correspond à un fragment de
// dessin, et à un seul — c'est le seul lien entre les deux fichiers.
const PARTIES = {
  passepoil: '<polyline points="78,8 100,34 122,8" fill="none" stroke="var(--or)" stroke-width="3" stroke-linejoin="round" />',
  strass: rangStrass(92),
  chevron: '<polyline points="66,46 78,58 66,70" fill="none" stroke="var(--or)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />',
  empiecement: '<polygon points="55,160 145,140 148,112 52,112" fill="var(--or)" opacity="0.9" />',
  'passepoil-2': '<polyline points="60,152 90,236 100,200 110,236 140,152" fill="none" stroke="var(--or)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />',
  'strass-2': rangStrass(114),
  'chevron-2': '<polyline points="134,46 122,58 134,70" fill="none" stroke="var(--or)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />',
  'empiecement-2': '<polygon points="60,192 140,180 145,152 60,152" fill="var(--or)" opacity="0.9" />',
};

// Pur, exporté pour ses propres tests : rend le justaucorps tel qu'il est
// MAINTENANT, avec pour seules couches celles dont l'identifiant figure dans
// `idsAcquis` — rien de plus, jamais une couche masquée ou grisée pour ce qui
// manque encore.
export function construireSvgJustaucorps(idsAcquis) {
  const acquis = new Set(idsAcquis);
  const couches = PARURES
    .filter((p) => acquis.has(p.id))
    .map((p) => `<g class="justaucorps__parure justaucorps__parure--${p.id}">${PARTIES[p.partie] ?? ''}</g>`)
    .join('');
  return `<svg viewBox="${VIEWBOX}">${silhouette()}${couches}</svg>`;
}

export function monterJustaucorps(hote, ctx) {
  const { programme } = ctx;
  let etatCourant = ctx.etat;

  // Comme les badges (vue-grille.js) : une parure tout juste méritée mais
  // jamais encore constatée (par exemple ramenée par une synchronisation) se
  // persiste ici, au montage — définitivement (PRD, lot ludique A13).
  const nouvelles = nouvellesParures(programme, etatCourant, etatCourant);
  if (nouvelles.length > 0) {
    const parures = [...new Set([...(etatCourant.parures ?? []), ...nouvelles])];
    etatCourant = ecrireEtat({ parures });
  }

  const section = el('section', 'ecran-justaucorps zone-surete');
  const empiecement = el('div', 'empiecement empiecement--compact');
  empiecement.append(el('h1', null, 'Ton justaucorps'));
  section.append(empiecement);

  const corps = el('div', 'jersey corps-justaucorps');
  const retour = document.createElement('a');
  retour.className = 'bouton--discret lien-retour';
  retour.href = '#/jour';
  retour.append(icone('icone-fleche', '15 5 8 12 15 19'), el('span', 'lien-retour__libelle', 'Aujourd’hui'));
  corps.append(retour);

  // Le dessin : l'objet focal de l'écran, celui qui prend toute la place.
  //
  // LE DESSIN LIT `etat.parures` (la liste PERSISTÉE), JAMAIS
  // `paruresAcquises(...)` : cette dernière est une recomputation LIVE depuis
  // les faits actuels (comme `badgesGagnes`), qui redeviendrait vide après un
  // programme recommencé à zéro (faits vidés) — exactement ce que le PRD
  // interdit (« une semaine bouclée ne se débloque pas »). `nouvellesParures`
  // ci-dessus est le seul endroit qui a besoin du calcul live, pour détecter
  // ce qu'il faut AJOUTER à la liste persistée.
  const figure = el('div', 'justaucorps__figure');
  corps.append(figure);
  figure.innerHTML = construireSvgJustaucorps(etatCourant.parures);

  // A14 : les couleurs, dès le premier jour.
  const blocCouleurs = el('div', 'justaucorps__couleurs');
  blocCouleurs.append(el('span', 'etiquette', 'Ses couleurs'));
  const grilleCouleurs = el('div', 'justaucorps__grille-couleurs');
  const boutonsCouleur = [];

  function appliquerCouleur(id) {
    figure.style.setProperty('--couleur-choisie', `var(${couleurParId(id).jeton})`);
  }

  function rafraichirChoix(id) {
    boutonsCouleur.forEach(({ bouton, couleur }) => {
      const choisie = couleur.id === id;
      bouton.setAttribute('aria-pressed', String(choisie));
      bouton.classList.toggle('justaucorps__couleur--choisie', choisie);
    });
  }

  for (const c of COULEURS) {
    const bouton = el('button', 'justaucorps__couleur', c.nom);
    bouton.type = 'button';
    bouton.style.setProperty('--couleur-apercu', `var(${c.jeton})`);
    bouton.addEventListener('click', () => {
      etatCourant = ecrireEtat({ couleurJustaucorps: c.id });
      appliquerCouleur(c.id);
      rafraichirChoix(c.id);
    });
    boutonsCouleur.push({ bouton, couleur: c });
    grilleCouleurs.append(bouton);
  }
  blocCouleurs.append(grilleCouleurs);
  corps.append(blocCouleurs);

  appliquerCouleur(etatCourant.couleurJustaucorps);
  rafraichirChoix(etatCourant.couleurJustaucorps);

  section.append(corps);
  hote.append(section);

  return function demonter() {};
}

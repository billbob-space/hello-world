// apps/ramure-v2/web/src/camera.ts
//
// Camera pure, testable sans DOM. Porte F-17 (zoom et deplacement bornes),
// N-02 (fluidite) et la section "Camera" de §11 : le point vise reste sous
// le doigt, zoom et deplacement sont deux gestes distincts, le zoom est
// borne. Le zoom s'applique par TRANSFORM sur le groupe SVG racine
// (canevas.ts) : cette camera ne connait ni cercle ni rayon.
export interface Vue {
  x: number;
  y: number;
  echelle: number;
}

export interface Rect {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export const ECHELLE_MIN = 0.4;
export const ECHELLE_MAX = 4;

function bornerEchelle(e: number): number {
  return Math.min(ECHELLE_MAX, Math.max(ECHELLE_MIN, e));
}

// zoomer applique `facteur` a l'echelle courante, bornee a
// [ECHELLE_MIN, ECHELLE_MAX], en recalculant la translation pour que la
// coordonnee MONDE du pointVise (en coordonnees ECRAN, sous le doigt ou le
// curseur) reste inchangee : monde = (ecran - v.x) / v.echelle doit valoir
// la meme chose avant et apres. C'est la condition centrale de la camera
// (§11) : un zoom qui deriverait rendrait le canevas impossible a
// parcourir au doigt.
export function zoomer(v: Vue, facteur: number, pointVise: { x: number; y: number }): Vue {
  const nouvelleEchelle = bornerEchelle(v.echelle * facteur);
  // A partir de monde = (pointVise - v.x) / v.echelle = (pointVise - x') / nouvelleEchelle,
  // on isole x' = pointVise - nouvelleEchelle * (pointVise - v.x) / v.echelle.
  const rapport = nouvelleEchelle / v.echelle;
  return {
    x: pointVise.x - rapport * (pointVise.x - v.x),
    y: pointVise.y - rapport * (pointVise.y - v.y),
    echelle: nouvelleEchelle,
  };
}

// deplacer translate la vue de (dx, dy) EN COORDONNEES ECRAN, sans jamais
// toucher a l'echelle : le geste de defilement ne zoome jamais (§11, "les
// deux gestes sont distincts").
export function deplacer(v: Vue, dx: number, dy: number): Vue {
  return { x: v.x + dx, y: v.y + dy, echelle: v.echelle };
}

// cadrageNeutre calcule la vue qui centre `contenu` dans `viewport` et le
// fait tenir entierement (la dimension la plus contraignante des deux
// fixe l'echelle), bornee a [ECHELLE_MIN, ECHELLE_MAX]. C'est la vue de
// reference : aBouge() compare toute vue courante a celle-ci.
export function cadrageNeutre(contenu: Rect, viewport: Rect): Vue {
  const echelleX = contenu.largeur > 0 ? viewport.largeur / contenu.largeur : 1;
  const echelleY = contenu.hauteur > 0 ? viewport.hauteur / contenu.hauteur : 1;
  const echelle = bornerEchelle(Math.min(echelleX, echelleY));

  const centreContenu = {
    x: contenu.x + contenu.largeur / 2,
    y: contenu.y + contenu.hauteur / 2,
  };
  const centreViewport = {
    x: viewport.x + viewport.largeur / 2,
    y: viewport.y + viewport.hauteur / 2,
  };

  return {
    x: centreViewport.x - centreContenu.x * echelle,
    y: centreViewport.y - centreContenu.y * echelle,
    echelle,
  };
}

// aBouge est vrai des que la vue differe du cadrage neutre : c'est ce qui
// fait apparaitre la commande de retour au cadrage neutre (§11 : "un
// retour au cadrage neutre est propose des que la vue a ete modifiee").
const EPSILON = 1e-6;

export function aBouge(v: Vue, neutre: Vue): boolean {
  return (
    Math.abs(v.x - neutre.x) > EPSILON ||
    Math.abs(v.y - neutre.y) > EPSILON ||
    Math.abs(v.echelle - neutre.echelle) > EPSILON
  );
}

// ---------------------------------------------------------------------
// viewportLibre — le rectangle du canevas REELLEMENT disponible, panneaux
// ancres deduits (critique 2026-08-22, C7/C12).
// ---------------------------------------------------------------------

/** Mesure d'un panneau ancre, deja exprimee dans le repere de la boite du
 * svg (voir `gauche`/`haut` ci-dessous) : main.ts (cablage) fait la seule
 * lecture DOM (`getBoundingClientRect`) et lui passe le resultat ; cette
 * fonction reste pure, comme le reste de ce module. */
export interface PanneauMesure {
  largeur: number;
  hauteur: number;
  /** distance du bord gauche du panneau au bord gauche de la boite svg */
  gauche: number;
  /** distance du bord haut du panneau au bord haut de la boite svg */
  haut: number;
}

// viewportLibre rend le rectangle du canevas REELLEMENT disponible, panneaux
// ancres deduits.
//
// Critique 2026-08-22 C7 / C12 : le cadrage passait `{0, 0, svg.clientWidth,
// svg.clientHeight}` — la boite svg ENTIERE — a cadrageNeutre(), qui centre
// dedans. Les panneaux ancres (fiche, collection) n'en etaient jamais
// retranches. Mesure @390x844 : svg 390x727 depuis y=117, fiche ancree en bas
// a y=464 sur 380 px ; le centre tombait a y=481 (soit 117 + 727/2), donc SOUS
// la fiche, couvert a 76 %, avec trois branches. Mesure @1440x900 : fiche a
// x=1072, arbre centre a x=720 au lieu de x=536 — 437 px de vide a gauche
// contre 88 px de jeu a droite. Le PRD §07 l'exige explicitement : « le
// canevas se recale sur l'espace restant quand un panneau s'ouvre ou se
// replie ».
//
// `largeurBoiteSvg`/`hauteurBoiteSvg` sont les dimensions REELLES (fractionnaires,
// `getBoundingClientRect`) de la boite svg — utilisees uniquement pour trancher
// si un panneau "prend toute la largeur" (ancre en bas, disposition etroite) ou
// "prend toute la hauteur" (ancre a droite, disposition large), sur la part de
// largeur occupee plutot que sur un point de rupture duplique : disposition.ts
// reste la seule source de verite sur la disposition.
export function viewportLibre(
  plein: Rect,
  largeurBoiteSvg: number,
  hauteurBoiteSvg: number,
  panneaux: readonly PanneauMesure[],
): Rect {
  if (largeurBoiteSvg === 0 || hauteurBoiteSvg === 0) return plein;

  let hautLibre = 0;
  let basLibre = plein.hauteur;
  let gaucheLibre = 0;
  let droiteLibre = plein.largeur;

  for (const panneau of panneaux) {
    if (panneau.largeur === 0 || panneau.hauteur === 0) continue;
    const prendToutLarge = panneau.largeur >= largeurBoiteSvg * 0.9;
    if (prendToutLarge) {
      basLibre = Math.min(basLibre, panneau.haut);
    } else {
      droiteLibre = Math.min(droiteLibre, panneau.gauche);
    }
  }

  const largeur = droiteLibre - gaucheLibre;
  const hauteur = basLibre - hautLibre;
  // Un panneau qui couvrirait tout ne doit pas produire un cadrage nul : on
  // retombe alors sur la boite entiere plutot que sur un viewport degenere.
  if (largeur < 80 || hauteur < 80) return plein;
  return { x: gaucheLibre, y: hautLibre, largeur, hauteur };
}

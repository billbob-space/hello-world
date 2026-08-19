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

// apps/ramure-v2/web/src/canevas.ts
//
// Rendu SVG DANS LE DOM (decision du README de la serie, rappelee en tete
// du PRP 05) : chaque noeud est un element DOM focalisable, condition
// necessaire a l'accessibilite clavier et lecteur d'ecran (§12) que le
// PRP 08 verifiera. Porte §11 "lisibilite", F-38 (aucun chargement sans
// issue) et F-39 (affichage progressif).
import { textes } from "./textes";
import { CIBLE_TACTILE_MIN_PX } from "./disposition";
import type { Vue } from "./camera";

export { CIBLE_TACTILE_MIN_PX };

export const NS_SVG = "http://www.w3.org/2000/svg";
const NS_XLINK = "http://www.w3.org/1999/xlink";

export interface Point {
  x: number;
  y: number;
}

export interface Cercle extends Point {
  r: number;
}

export interface DonneesNoeud extends Cercle {
  id: string;
  nom: string;
}

/** Les trois groupes de peinture du canevas, DANS L'ORDRE ou ils sont
 * ajoutes au SVG. L'ordre de peinture SVG suit l'ordre des enfants : un
 * groupe ajoute plus tard est dessine PAR-DESSUS les precedents. Placer
 * "libelles" en dernier est donc ce qui garantit qu'aucune pastille
 * voisine ne peut jamais recouvrir un nom (§11). */
export interface Groupes {
  liens: SVGGElement;
  noeuds: SVGGElement;
  libelles: SVGGElement;
}

export interface NoeudDessine {
  id: string;
  groupe: SVGGElement;
  cercle: SVGCircleElement;
  pattern: SVGPatternElement;
  libelle: SVGTextElement;
  /** Cible tactile INVISIBLE, distincte de la pastille visible (`cercle`) :
   * §12 exige au moins 24x24px de cible, mais la camera peut zoomer
   * jusqu'a ECHELLE_MIN (0.4, camera.ts) — a ce niveau, la pastille du
   * plus petit heritier ne mesure plus que quelques pixels a l'ecran.
   * `ajusterZoneTactile` agrandit CE cercle transparent (jamais `cercle`,
   * qui resterait visuellement fidele a l'affinite, F-09) pour compenser
   * l'echelle courante. */
  zoneTactile: SVGCircleElement;
}

function elementSVG<K extends keyof SVGElementTagNameMap>(
  nom: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS(NS_SVG, nom) as SVGElementTagNameMap[K];
}

function obtenirDefs(svg: SVGElement): SVGDefsElement {
  const existant = svg.querySelector(":scope > defs");
  if (existant) {
    return existant as SVGDefsElement;
  }
  const defs = elementSVG("defs");
  svg.prepend(defs);
  return defs;
}

// creerGroupes construit les trois groupes de peinture, une fois par
// canevas. Ne JAMAIS ajouter un element directement en enfant du SVG apres
// cet appel : ce serait ajoute apres "libelles" et casserait la garantie
// de lisibilite.
export function creerGroupes(svg: SVGElement): Groupes {
  const liens = elementSVG("g");
  liens.setAttribute("class", "liens");
  const noeuds = elementSVG("g");
  noeuds.setAttribute("class", "noeuds");
  const libelles = elementSVG("g");
  libelles.setAttribute("class", "libelles");
  svg.append(liens, noeuds, libelles);
  return { liens, noeuds, libelles };
}

// appliquerVue pose la camera (camera.ts) sur le groupe SVG racine, PAR
// TRANSFORM : c'est l'ENSEMBLE de la scene qui grossit ou se deplace,
// illustrations comprises (§11 : "zoomer rapproche vraiment"). Aucune
// pastille n'est redimensionnee ici — son attribut `r` n'est jamais
// touche, quel que soit le niveau de zoom (verifie par test).
export function appliquerVue(groupeRacine: SVGGElement, v: Vue): void {
  groupeRacine.setAttribute("transform", `translate(${v.x} ${v.y}) scale(${v.echelle})`);
}

// repliCouleur derive une teinte HSL STABLE a partir du nom de l'artiste :
// meme nom, meme couleur, a chaque appel, sur chaque poste (F-38, F-39).
// C'est ce repli qui rend inoffensifs le 404 de Cover Art Archive et une
// branche sans fiche Deezer : la pastille garde toujours un contenu, jamais
// un vide.
export function repliCouleur(nom: string): string {
  let h = 0;
  for (let i = 0; i < nom.length; i++) {
    h = (h * 31 + nom.charCodeAt(i)) >>> 0;
  }
  const teinte = h % 360;
  return `hsl(${teinte}, 55%, 45%)`;
}

// dessinerNoeud ajoute un noeud (centre, branche ou heritier) : un cercle
// dans le groupe "noeuds", un motif de repli dans <defs>, et un libelle
// dans le groupe "libelles" — jamais dans le meme groupe que le cercle. Le
// cercle recoit sa taille FINALE des ce premier appel (F-39) : rien ne le
// redimensionne plus tard, seul le remplissage change (definirIllustration).
export function dessinerNoeud(
  svg: SVGElement,
  groupes: Groupes,
  n: DonneesNoeud,
): NoeudDessine {
  const defs = obtenirDefs(svg);
  const patternId = `repli-${n.id}`;
  const cote = 2 * n.r;

  const pattern = elementSVG("pattern");
  pattern.setAttribute("id", patternId);
  pattern.setAttribute("patternUnits", "userSpaceOnUse");
  pattern.setAttribute("x", String(n.x - n.r));
  pattern.setAttribute("y", String(n.y - n.r));
  pattern.setAttribute("width", String(cote));
  pattern.setAttribute("height", String(cote));

  const fond = elementSVG("rect");
  fond.setAttribute("width", String(cote));
  fond.setAttribute("height", String(cote));
  fond.setAttribute("fill", repliCouleur(n.nom));
  pattern.append(fond);
  defs.append(pattern);

  const groupe = elementSVG("g");
  groupe.setAttribute("class", "noeud");
  groupe.setAttribute("data-id", n.id);
  groupe.setAttribute("tabindex", "0");
  groupe.setAttribute("role", "button");
  groupe.setAttribute("aria-label", textes.accessibleNoeud(n.nom));

  // zoneTactile AVANT cercle : place derriere lui dans l'ordre de peinture
  // (sans consequence puisqu'elle est transparente), mais surtout jamais
  // apres — un enfant ajoute plus tard capterait le clic en premier sans
  // rien changer visuellement, ce qui serait juste une source de confusion
  // a la lecture du DOM.
  const zoneTactile = elementSVG("circle");
  zoneTactile.setAttribute("class", "zone-tactile");
  zoneTactile.setAttribute("cx", String(n.x));
  zoneTactile.setAttribute("cy", String(n.y));
  zoneTactile.setAttribute("r", String(n.r));
  zoneTactile.setAttribute("fill", "transparent");
  // pointer-events="all" : un remplissage transparent n'intercepte RIEN
  // par defaut en SVG (seuls stroke/fill visibles le font) — sans cet
  // attribut, agrandir `r` n'agrandirait rien du tout au toucher.
  zoneTactile.setAttribute("pointer-events", "all");
  zoneTactile.setAttribute("aria-hidden", "true"); // le nom accessible vit sur le groupe
  groupe.append(zoneTactile);

  const cercle = elementSVG("circle");
  cercle.setAttribute("cx", String(n.x));
  cercle.setAttribute("cy", String(n.y));
  cercle.setAttribute("r", String(n.r));
  cercle.setAttribute("fill", `url(#${patternId})`);
  cercle.setAttribute("pointer-events", "none"); // le clic est capte par zoneTactile, jamais deux fois
  groupe.append(cercle);
  groupes.noeuds.append(groupe);

  const libelle = elementSVG("text");
  libelle.setAttribute("x", String(n.x));
  libelle.setAttribute("y", String(n.y + n.r + 14));
  libelle.setAttribute("text-anchor", "middle");
  libelle.setAttribute("class", "libelle");
  libelle.setAttribute("aria-hidden", "true"); // le nom accessible vit sur le groupe (role=button)
  libelle.textContent = n.nom;
  groupes.libelles.append(libelle);

  return { id: n.id, groupe, cercle, pattern, libelle, zoneTactile };
}

// definirIllustration remplace le CONTENU du motif de repli par l'image
// arrivee, sans jamais toucher au cercle : ni cx, ni cy, ni r ne changent.
// Le motif garde exactement les memes dimensions qu'a sa creation : l'image
// occupe donc exactement la place qu'occupait le repli, sans decalage
// (F-39).
export function definirIllustration(noeud: NoeudDessine, url: string): void {
  noeud.pattern.replaceChildren();
  const largeur = noeud.pattern.getAttribute("width") ?? "0";
  const hauteur = noeud.pattern.getAttribute("height") ?? largeur;

  const image = elementSVG("image");
  image.setAttribute("width", largeur);
  image.setAttribute("height", hauteur);
  image.setAttribute("preserveAspectRatio", "xMidYMid slice");
  // href seul suffit dans les navigateurs actuels ; xlink:href reste posé
  // pour les lecteurs SVG plus anciens qui l'exigent encore.
  image.setAttributeNS(NS_XLINK, "xlink:href", url);
  image.setAttribute("href", url);
  noeud.pattern.append(image);
}

// dessinerLien trace un trait qui s'arrete au BORD de chaque pastille,
// jamais a son centre (§11 : "les liens rejoignent leurs deux extremites").
// Verification purement geometrique sur x1/y1/x2/y2, jamais par capture
// d'ecran.
export function dessinerLien(
  groupes: Groupes,
  depuis: Cercle,
  vers: Cercle,
): SVGLineElement {
  const dx = vers.x - depuis.x;
  const dy = vers.y - depuis.y;
  const distance = Math.hypot(dx, dy) || 1;
  const ux = dx / distance;
  const uy = dy / distance;

  const ligne = elementSVG("line");
  ligne.setAttribute("class", "lien");
  ligne.setAttribute("x1", String(depuis.x + ux * depuis.r));
  ligne.setAttribute("y1", String(depuis.y + uy * depuis.r));
  ligne.setAttribute("x2", String(vers.x - ux * vers.r));
  ligne.setAttribute("y2", String(vers.y - uy * vers.r));
  groupes.liens.insertBefore(ligne, groupes.liens.firstChild);
  return ligne;
}

// ---------------------------------------------------------------------
// Cible tactile minimale (§12, WCAG 2.2 SC 2.5.8, PRP 08)
// ---------------------------------------------------------------------

/** ajusterZoneTactile agrandit le cercle INVISIBLE d'un noeud (jamais son
 * cercle visible) pour que sa taille A L'ECRAN reste au moins
 * `minPx` x `minPx`, quelle que soit l'echelle courante de la camera —
 * `r * echelle` est ce qui compte a l'ecran, pas `r` seul, une fois le
 * groupe racine mis a l'echelle par appliquerVue(). Ne RETRECIT jamais la
 * zone en dessous de la pastille visible : `r` de la zone tactile est
 * toujours >= `r` du cercle visible. */
export function ajusterZoneTactile(
  n: NoeudDessine,
  echelle: number,
  minPx: number = CIBLE_TACTILE_MIN_PX,
): void {
  const rVisible = Number(n.cercle.getAttribute("r")) || 0;
  const echelleUtile = Number.isFinite(echelle) && echelle > 0 ? echelle : 1;
  const rMinimal = minPx / 2 / echelleUtile;
  n.zoneTactile.setAttribute("r", String(Math.max(rVisible, rMinimal)));
  // La zone tactile suit toujours la position du cercle visible : sans
  // cette synchronisation, un noeud dont `cercle` a bouge (promotion.ts,
  // appliquerTransitionVisuelle) toucherait au mauvais endroit.
  n.zoneTactile.setAttribute("cx", n.cercle.getAttribute("cx") ?? "0");
  n.zoneTactile.setAttribute("cy", n.cercle.getAttribute("cy") ?? "0");
}

/** ajusterZonesTactiles applique ajusterZoneTactile a tous les noeuds
 * dessines — appelee a chaque changement de vue (main.ts, appliquerVue),
 * puisque l'echelle qui determine la taille minimale necessaire change a
 * chaque zoom. */
export function ajusterZonesTactiles(
  noeuds: Iterable<NoeudDessine>,
  echelle: number,
  minPx: number = CIBLE_TACTILE_MIN_PX,
): void {
  for (const n of noeuds) {
    ajusterZoneTactile(n, echelle, minPx);
  }
}

// ---------------------------------------------------------------------
// Activation clavier ET clic (F-11, §12, PRP 08)
// ---------------------------------------------------------------------

/** cablerActivation cable un SEUL gestionnaire pour deux entrees
 * possibles (F-11 "souris et clavier produisent le meme resultat") :
 * un clic, ou Entree/Espace au clavier sur le groupe focalisable
 * (tabindex=0, role=button, poses par dessinerNoeud). Espace est
 * intercepte par preventDefault() : sans lui, la page defilerait au lieu
 * d'activer le noeud (comportement par defaut d'un <button> HTML, qu'un
 * <g role="button"> n'obtient jamais gratuitement). */
export function cablerActivation(n: NoeudDessine, gestionnaire: () => void): void {
  n.groupe.addEventListener("click", () => gestionnaire());
  n.groupe.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter" || evt.key === " " || evt.key === "Spacebar") {
      evt.preventDefault();
      gestionnaire();
    }
  });
}

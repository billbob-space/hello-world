// apps/ramure-v2/web/tests/canevas.test.ts
//
// Porte §11 "lisibilite", F-38 et F-39 (PRP 05, tache 3). Quatre proprietes
// verifiees par mesure geometrique et structurelle sur le DOM, jamais par
// une capture d'ecran (voir la section "Pourquoi du SVG dans le DOM" du
// PRP) : le rendu vit reellement dans le DOM, donc jsdom peut le mesurer.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ajusterZoneTactile,
  ajusterZonesTactiles,
  appliquerVue,
  cablerActivation,
  creerGroupes,
  definirIllustration,
  dessinerLien,
  dessinerNoeud,
  repliCouleur,
  CIBLE_TACTILE_MIN_PX,
  NS_SVG,
} from "../src/canevas";
import { ECHELLE_MIN, zoomer, type Vue } from "../src/camera";

function svgVierge(): SVGSVGElement {
  return document.createElementNS(NS_SVG, "svg") as SVGSVGElement;
}

describe("repliCouleur (repli d'illustration deterministe, F-38/F-39)", () => {
  it("rend toujours la meme couleur pour le meme nom", () => {
    expect(repliCouleur("Portishead")).toBe(repliCouleur("Portishead"));
  });

  it("rend des couleurs differentes pour des noms differents (cas courant)", () => {
    expect(repliCouleur("Portishead")).not.toBe(repliCouleur("Boards of Canada"));
  });
});

describe("dessinerNoeud + definirIllustration", () => {
  let svg: SVGSVGElement;

  beforeEach(() => {
    svg = svgVierge();
  });

  it("l'arrivee d'une image ne change aucune coordonnee du cercle", () => {
    const groupes = creerGroupes(svg);
    const noeud = dessinerNoeud(svg, groupes, { id: "a1", nom: "Aphex Twin", x: 10, y: 20, r: 30 });

    const avant = {
      cx: noeud.cercle.getAttribute("cx"),
      cy: noeud.cercle.getAttribute("cy"),
      r: noeud.cercle.getAttribute("r"),
    };

    definirIllustration(noeud, "https://exemple.test/pochette.jpg");

    expect(noeud.cercle.getAttribute("cx")).toBe(avant.cx);
    expect(noeud.cercle.getAttribute("cy")).toBe(avant.cy);
    expect(noeud.cercle.getAttribute("r")).toBe(avant.r);
    // Le motif occupe EXACTEMENT la place reservee au cercle : memes
    // dimensions que celles posees a la creation du repli.
    expect(noeud.pattern.getAttribute("width")).toBe(String(2 * 30));
    expect(noeud.pattern.querySelector("image")?.getAttribute("href")).toBe(
      "https://exemple.test/pochette.jpg",
    );
  });

  // Releve en production le 20 aout 2026 : quand l'illustration n'arrive
  // jamais — CDN injoignable, bloqueur de publicites, hors ligne — la
  // pastille disparaissait ENTIEREMENT, ne laissant qu'un libelle flottant
  // et un trait. definirIllustration remplacait tout le contenu du motif,
  // le fond de repli compris : le cercle n'avait alors plus rien a peindre.
  // F-38/F-39 promettent l'inverse : « la pastille garde toujours un
  // contenu, jamais un vide ».
  it("garde le fond de repli SOUS l'image, qui peut ne jamais se charger", () => {
    const groupes = creerGroupes(svg);
    const noeud = dessinerNoeud(svg, groupes, { id: "a2", nom: "Aphex Twin", x: 10, y: 20, r: 30 });

    definirIllustration(noeud, "https://exemple.test/injoignable.jpg");

    const fond = noeud.pattern.querySelector("rect");
    expect(fond).not.toBeNull();
    expect(fond?.getAttribute("fill")).toBe(repliCouleur("Aphex Twin"));
    // ... et l'image PAR-DESSUS : l'ordre de peinture SVG suit l'ordre du
    // document, le fond doit donc rester le premier enfant.
    const enfants = [...noeud.pattern.children].map((e) => e.tagName.toLowerCase());
    expect(enfants).toEqual(["rect", "image"]);
  });

  it("une seconde illustration ne cumule pas deux images dans le motif", () => {
    const groupes = creerGroupes(svg);
    const noeud = dessinerNoeud(svg, groupes, { id: "a3", nom: "Bjork", x: 0, y: 0, r: 20 });

    definirIllustration(noeud, "https://exemple.test/1.jpg");
    definirIllustration(noeud, "https://exemple.test/2.jpg");

    expect(noeud.pattern.querySelectorAll("image")).toHaveLength(1);
    expect(noeud.pattern.querySelector("image")?.getAttribute("href")).toBe(
      "https://exemple.test/2.jpg",
    );
    expect(noeud.pattern.querySelectorAll("rect")).toHaveLength(1);
  });

  it("l'arrivee des heritiers ne deplace aucune branche deja dessinee", () => {
    const groupes = creerGroupes(svg);
    const branche = dessinerNoeud(svg, groupes, { id: "b1", nom: "Boards of Canada", x: 100, y: 0, r: 30 });
    const avant = {
      cx: branche.cercle.getAttribute("cx"),
      cy: branche.cercle.getAttribute("cy"),
      r: branche.cercle.getAttribute("r"),
    };

    dessinerNoeud(svg, groupes, { id: "h1", nom: "Hudson Mohawke", x: 130, y: 20, r: 10 });
    dessinerNoeud(svg, groupes, { id: "h2", nom: "Rustie", x: 130, y: -20, r: 10 });

    expect(branche.cercle.getAttribute("cx")).toBe(avant.cx);
    expect(branche.cercle.getAttribute("cy")).toBe(avant.cy);
    expect(branche.cercle.getAttribute("r")).toBe(avant.r);
  });
});

describe("dessinerLien (§11 : un lien touche les deux bords)", () => {
  it("part exactement du bord de la pastille source et s'arrete exactement au bord de la pastille cible", () => {
    const svg = svgVierge();
    const groupes = creerGroupes(svg);

    const ligne = dessinerLien(groupes, { x: 0, y: 0, r: 10 }, { x: 100, y: 0, r: 20 });

    expect(Number(ligne.getAttribute("x1"))).toBeCloseTo(10);
    expect(Number(ligne.getAttribute("y1"))).toBeCloseTo(0);
    expect(Number(ligne.getAttribute("x2"))).toBeCloseTo(80);
    expect(Number(ligne.getAttribute("y2"))).toBeCloseTo(0);
  });

  it("touche les deux bords meme quand le lien n'est pas horizontal", () => {
    const svg = svgVierge();
    const groupes = creerGroupes(svg);

    const depuis = { x: 0, y: 0, r: 15 };
    const vers = { x: 90, y: 120, r: 25 }; // distance 150
    const ligne = dessinerLien(groupes, depuis, vers);

    const x1 = Number(ligne.getAttribute("x1"));
    const y1 = Number(ligne.getAttribute("y1"));
    const x2 = Number(ligne.getAttribute("x2"));
    const y2 = Number(ligne.getAttribute("y2"));

    expect(Math.hypot(x1 - depuis.x, y1 - depuis.y)).toBeCloseTo(depuis.r, 5);
    expect(Math.hypot(x2 - vers.x, y2 - vers.y)).toBeCloseTo(vers.r, 5);
  });
});

describe("creerGroupes (§11 : un nom n'est jamais masque)", () => {
  it("place le groupe des libelles en DERNIER enfant du SVG, apres liens et noeuds", () => {
    const svg = svgVierge();
    const groupes = creerGroupes(svg);

    expect(svg.lastElementChild).toBe(groupes.libelles);
  });

  it("reste le dernier groupe apres l'ajout de noeuds et de liens", () => {
    const svg = svgVierge();
    const groupes = creerGroupes(svg);
    dessinerNoeud(svg, groupes, { id: "c", nom: "Centre", x: 0, y: 0, r: 50 });
    dessinerLien(groupes, { x: 0, y: 0, r: 50 }, { x: 200, y: 0, r: 20 });

    expect(svg.lastElementChild).toBe(groupes.libelles);
  });
});

describe("appliquerVue (§11 : le zoom agrandit tout, jamais les pastilles)", () => {
  it("apres un zoom x2, le rayon d'une pastille est inchange : le zoom passe par le transform du groupe racine", () => {
    const svg = svgVierge();
    const racine = document.createElementNS(NS_SVG, "g") as SVGGElement;
    svg.append(racine);
    const groupes = creerGroupes(racine);
    const noeud = dessinerNoeud(racine, groupes, { id: "n1", nom: "Squarepusher", x: 40, y: 0, r: 25 });

    const neutre: Vue = { x: 0, y: 0, echelle: 1 };
    appliquerVue(racine, neutre);
    const rAvant = noeud.cercle.getAttribute("r");

    const zoome = zoomer(neutre, 2, { x: 40, y: 0 });
    appliquerVue(racine, zoome);

    expect(noeud.cercle.getAttribute("r")).toBe(rAvant);
    expect(racine.getAttribute("transform")).toContain(`scale(${zoome.echelle})`);
  });
});

describe("cablerActivation (F-11, §12 : clic et clavier produisent le meme resultat)", () => {
  it("appelle le gestionnaire au clic", () => {
    const svg = svgVierge();
    const groupes = creerGroupes(svg);
    const noeud = dessinerNoeud(svg, groupes, { id: "n1", nom: "Boards of Canada", x: 0, y: 0, r: 30 });
    const gestionnaire = vi.fn();
    cablerActivation(noeud, gestionnaire);

    noeud.groupe.dispatchEvent(new MouseEvent("click"));

    expect(gestionnaire).toHaveBeenCalledTimes(1);
  });

  it("appelle le MEME gestionnaire sur Entree ou Espace, jamais sur une autre touche", () => {
    const svg = svgVierge();
    const groupes = creerGroupes(svg);
    const noeud = dessinerNoeud(svg, groupes, { id: "n1", nom: "Squarepusher", x: 0, y: 0, r: 30 });
    const gestionnaire = vi.fn();
    cablerActivation(noeud, gestionnaire);

    noeud.groupe.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    noeud.groupe.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    noeud.groupe.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));

    expect(gestionnaire).toHaveBeenCalledTimes(2);
  });

  it("empeche le comportement par defaut d'Espace (deroulement de la page)", () => {
    const svg = svgVierge();
    const groupes = creerGroupes(svg);
    const noeud = dessinerNoeud(svg, groupes, { id: "n1", nom: "Rustie", x: 0, y: 0, r: 30 });
    cablerActivation(noeud, () => {});

    const evenement = new KeyboardEvent("keydown", { key: " ", cancelable: true });
    noeud.groupe.dispatchEvent(evenement);

    expect(evenement.defaultPrevented).toBe(true);
  });
});

describe("ajusterZoneTactile / ajusterZonesTactiles (§12, WCAG 2.5.8 : cible >= 24x24px a toute echelle)", () => {
  it("agrandit la zone tactile d'un heritier (r=16) au niveau de zoom minimal de la camera", () => {
    const svg = svgVierge();
    const groupes = creerGroupes(svg);
    const heritier = dessinerNoeud(svg, groupes, { id: "h1", nom: "Hudson Mohawke", x: 10, y: 0, r: 16 });

    ajusterZoneTactile(heritier, ECHELLE_MIN);

    const rZone = Number(heritier.zoneTactile.getAttribute("r"));
    expect(rZone * 2 * ECHELLE_MIN).toBeGreaterThanOrEqual(CIBLE_TACTILE_MIN_PX);
  });

  it("ne retrecit jamais la zone tactile sous le cercle visible (a fort zoom, r=16 suffit deja)", () => {
    const svg = svgVierge();
    const groupes = creerGroupes(svg);
    const noeud = dessinerNoeud(svg, groupes, { id: "n1", nom: "Burial", x: 0, y: 0, r: 16 });

    ajusterZoneTactile(noeud, 4); // ECHELLE_MAX

    expect(Number(noeud.zoneTactile.getAttribute("r"))).toBeGreaterThanOrEqual(16);
  });

  it("ne modifie jamais le rayon du cercle VISIBLE (F-09 : l'affinite se lit sans texte, jamais deformee)", () => {
    const svg = svgVierge();
    const groupes = creerGroupes(svg);
    const noeud = dessinerNoeud(svg, groupes, { id: "n1", nom: "Burial", x: 0, y: 0, r: 16 });

    ajusterZoneTactile(noeud, ECHELLE_MIN);

    expect(noeud.cercle.getAttribute("r")).toBe("16");
  });

  it("ajusterZonesTactiles applique la meme regle a tous les noeuds fournis", () => {
    const svg = svgVierge();
    const groupes = creerGroupes(svg);
    const a = dessinerNoeud(svg, groupes, { id: "a", nom: "A", x: 0, y: 0, r: 14 });
    const b = dessinerNoeud(svg, groupes, { id: "b", nom: "B", x: 0, y: 0, r: 16 });

    ajusterZonesTactiles([a, b], ECHELLE_MIN);

    for (const n of [a, b]) {
      const rZone = Number(n.zoneTactile.getAttribute("r"));
      expect(rZone * 2 * ECHELLE_MIN).toBeGreaterThanOrEqual(CIBLE_TACTILE_MIN_PX);
    }
  });
});

describe("le plus petit noeud du produit (branche, TAILLE_PASTILLE.min=14) tient la cible tactile a ECHELLE_MIN", () => {
  it("14px de rayon, agrandi, tient 24x24px a l'echelle la plus faible de la camera", () => {
    const svg = svgVierge();
    const groupes = creerGroupes(svg);
    const pirePastille = dessinerNoeud(svg, groupes, { id: "pire", nom: "Plus petite branche", x: 0, y: 0, r: 14 });

    ajusterZoneTactile(pirePastille, ECHELLE_MIN);

    const cotePx = Number(pirePastille.zoneTactile.getAttribute("r")) * 2 * ECHELLE_MIN;
    expect(cotePx).toBeGreaterThanOrEqual(CIBLE_TACTILE_MIN_PX);
  });
});

describe("web/index.html", () => {
  it("porte lang=\"fr\" (doit survivre au remplacement de la page d'accueil, PRP 05)", () => {
    const chemin = resolve(process.cwd(), "index.html");
    const html = readFileSync(chemin, "utf-8");
    expect(html).toMatch(/<html[^>]*\blang="fr"/);
  });
});

// apps/ramure-v2/web/tests/canevas.test.ts
//
// Porte §11 "lisibilite", F-38 et F-39 (PRP 05, tache 3). Quatre proprietes
// verifiees par mesure geometrique et structurelle sur le DOM, jamais par
// une capture d'ecran (voir la section "Pourquoi du SVG dans le DOM" du
// PRP) : le rendu vit reellement dans le DOM, donc jsdom peut le mesurer.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  appliquerVue,
  creerGroupes,
  definirIllustration,
  dessinerLien,
  dessinerNoeud,
  repliCouleur,
  NS_SVG,
} from "../src/canevas";
import { zoomer, type Vue } from "../src/camera";

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

describe("web/index.html", () => {
  it("porte lang=\"fr\" (doit survivre au remplacement de la page d'accueil, PRP 05)", () => {
    const chemin = resolve(process.cwd(), "index.html");
    const html = readFileSync(chemin, "utf-8");
    expect(html).toMatch(/<html[^>]*\blang="fr"/);
  });
});

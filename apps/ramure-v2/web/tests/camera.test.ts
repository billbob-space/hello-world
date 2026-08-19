// apps/ramure-v2/web/tests/camera.test.ts
//
// Porte F-17, N-02 et la section "Camera" de §11 (PRP 05, tache 4). Fichier
// pur, sans DOM.
import { describe, expect, it } from "vitest";
import {
  ECHELLE_MAX,
  ECHELLE_MIN,
  aBouge,
  cadrageNeutre,
  deplacer,
  zoomer,
  type Vue,
} from "../src/camera";

// Coordonnee MONDE d'un point ecran, etant donne la vue (translation puis
// echelle, comme le transform SVG "translate(x y) scale(echelle)" pose par
// main.ts) : monde = (ecran - vue.translation) / vue.echelle. Le test
// central de la camera se lit sur cette coordonnee, pas sur les champs
// bruts de Vue, pour ne pas dependre d'un choix d'implementation interne.
function versMonde(v: Vue, pointEcran: { x: number; y: number }): { x: number; y: number } {
  return { x: (pointEcran.x - v.x) / v.echelle, y: (pointEcran.y - v.y) / v.echelle };
}

describe("zoomer : le point vise reste sous le doigt", () => {
  it("la coordonnee monde du point vise est inchangee a 1e-9 pres, apres un zoom avant", () => {
    const v0: Vue = { x: 10, y: -5, echelle: 1 };
    const pointVise = { x: 120, y: 80 };
    const mondeAvant = versMonde(v0, pointVise);

    const v1 = zoomer(v0, 1.5, pointVise);
    const mondeApres = versMonde(v1, pointVise);

    expect(Math.abs(mondeApres.x - mondeAvant.x)).toBeLessThan(1e-9);
    expect(Math.abs(mondeApres.y - mondeAvant.y)).toBeLessThan(1e-9);
  });

  it("reste vrai pour un zoom arriere et un point vise quelconque, sur 100 essais aleatoires", () => {
    for (let i = 0; i < 100; i++) {
      const v0: Vue = {
        x: (Math.random() - 0.5) * 1000,
        y: (Math.random() - 0.5) * 1000,
        echelle: 0.5 + Math.random() * 2,
      };
      const pointVise = { x: (Math.random() - 0.5) * 2000, y: (Math.random() - 0.5) * 2000 };
      const mondeAvant = versMonde(v0, pointVise);

      const facteur = 0.3 + Math.random() * 3;
      const v1 = zoomer(v0, facteur, pointVise);
      const mondeApres = versMonde(v1, pointVise);

      expect(Math.abs(mondeApres.x - mondeAvant.x)).toBeLessThan(1e-9);
      expect(Math.abs(mondeApres.y - mondeAvant.y)).toBeLessThan(1e-9);
    }
  });
});

describe("zoomer : le zoom est borne", () => {
  it("ne depasse jamais ECHELLE_MAX quel que soit le facteur demande", () => {
    const v0: Vue = { x: 0, y: 0, echelle: ECHELLE_MAX - 0.01 };
    const v1 = zoomer(v0, 1000, { x: 0, y: 0 });
    expect(v1.echelle).toBeLessThanOrEqual(ECHELLE_MAX);
  });

  it("ne descend jamais sous ECHELLE_MIN quel que soit le facteur demande", () => {
    const v0: Vue = { x: 0, y: 0, echelle: ECHELLE_MIN + 0.01 };
    const v1 = zoomer(v0, 0.0001, { x: 0, y: 0 });
    expect(v1.echelle).toBeGreaterThanOrEqual(ECHELLE_MIN);
  });
});

describe("zoomer et deplacer sont distincts", () => {
  it("deplacer ne change jamais l'echelle", () => {
    const v0: Vue = { x: 0, y: 0, echelle: 1.7 };
    const v1 = deplacer(v0, 40, -15);
    expect(v1.echelle).toBe(v0.echelle);
  });

  it("zoomer ne modifie la translation que pour maintenir le point vise (deplacement nul a facteur 1)", () => {
    const v0: Vue = { x: 12, y: -8, echelle: 1.4 };
    const v1 = zoomer(v0, 1, { x: 50, y: 50 });
    expect(v1.x).toBeCloseTo(v0.x, 9);
    expect(v1.y).toBeCloseTo(v0.y, 9);
    expect(v1.echelle).toBe(v0.echelle);
  });
});

describe("aBouge", () => {
  const neutre: Vue = { x: 0, y: 0, echelle: 1 };

  it("est faux quand la vue est identique au cadrage neutre", () => {
    expect(aBouge({ x: 0, y: 0, echelle: 1 }, neutre)).toBe(false);
  });

  it("est vrai des que la translation differe", () => {
    expect(aBouge({ x: 1, y: 0, echelle: 1 }, neutre)).toBe(true);
  });

  it("est vrai des que l'echelle differe", () => {
    expect(aBouge({ x: 0, y: 0, echelle: 1.01 }, neutre)).toBe(true);
  });
});

describe("cadrageNeutre", () => {
  it("centre le contenu dans le viewport et choisit une echelle qui le fait tenir entierement", () => {
    const contenu = { x: -400, y: -400, largeur: 800, hauteur: 800 };
    const viewport = { x: 0, y: 0, largeur: 1000, hauteur: 500 };

    const v = cadrageNeutre(contenu, viewport);

    // Le centre du contenu doit tomber au centre du viewport.
    const centreContenuEcran = {
      x: v.x + (contenu.x + contenu.largeur / 2) * v.echelle,
      y: v.y + (contenu.y + contenu.hauteur / 2) * v.echelle,
    };
    expect(centreContenuEcran.x).toBeCloseTo(viewport.x + viewport.largeur / 2, 6);
    expect(centreContenuEcran.y).toBeCloseTo(viewport.y + viewport.hauteur / 2, 6);

    // Le contenu tient entierement dans le viewport (contrainte la plus
    // etroite des deux dimensions).
    expect(contenu.largeur * v.echelle).toBeLessThanOrEqual(viewport.largeur + 1e-6);
    expect(contenu.hauteur * v.echelle).toBeLessThanOrEqual(viewport.hauteur + 1e-6);
  });
});

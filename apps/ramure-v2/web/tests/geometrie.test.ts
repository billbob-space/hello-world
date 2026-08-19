// apps/ramure-v2/web/tests/geometrie.test.ts
//
// Porte F-09 (l'affinite se lit sans texte) et F-10 (heritiers rattaches
// visuellement). Fichier pur, sans DOM : geometrie.ts et
// internal/arbre/selection.go (PRP 04, Go) portent les deux exigences les
// plus subtiles du produit (PRP 05, tache 2).
import { describe, expect, it } from "vitest";
import {
  placerBranches,
  placerHeritiers,
  rayonPour,
  taillePour,
  type Anneau,
  type Taille,
} from "../src/geometrie";

// rayonMin choisi pour que, meme au cadrage large (10 branches, F-08), deux
// pastilles de taille MAXIMALE (TAILLE_PASTILLE.max dans geometrie.ts) et
// d'affinite maximale (donc au rayon minimal, cote a cote) ne se
// chevauchent jamais : chord = 2*rayonMin*sin(pi/10) doit depasser 2*40.
// 150 laisse une marge confortable (chord ~= 92.7 > 80).
const ANNEAU: Anneau = { rayonMin: 150, rayonMax: 420 };
const TAILLE: Taille = { min: 14, max: 40 };

describe("rayonPour", () => {
  it("est strictement decroissant en affinite sur 100 echantillons croissants", () => {
    let precedent = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= 100; i++) {
      const affinite = i / 100;
      const rayon = rayonPour(affinite, ANNEAU);
      expect(rayon).toBeLessThan(precedent);
      precedent = rayon;
    }
  });

  it("ramene une affinite hors bornes dans [0,1]", () => {
    expect(rayonPour(-3, ANNEAU)).toBe(rayonPour(0, ANNEAU));
    expect(rayonPour(7, ANNEAU)).toBe(rayonPour(1, ANNEAU));
  });
});

describe("taillePour", () => {
  it("est strictement croissante en affinite sur 100 echantillons croissants", () => {
    let precedent = Number.NEGATIVE_INFINITY;
    for (let i = 0; i <= 100; i++) {
      const affinite = i / 100;
      const taille = taillePour(affinite, TAILLE);
      expect(taille).toBeGreaterThan(precedent);
      precedent = taille;
    }
  });

  it("ramene une affinite hors bornes dans [0,1]", () => {
    expect(taillePour(-3, TAILLE)).toBe(taillePour(0, TAILLE));
    expect(taillePour(7, TAILLE)).toBe(taillePour(1, TAILLE));
  });
});

describe("rayon et taille varient tous les deux (F-09)", () => {
  it("un voisin d'affinite 0.9 et un d'affinite 0.1 different sur les deux proprietes", () => {
    const proche = { rayon: rayonPour(0.9, ANNEAU), taille: taillePour(0.9, TAILLE) };
    const loin = { rayon: rayonPour(0.1, ANNEAU), taille: taillePour(0.1, TAILLE) };
    expect(proche.rayon).not.toBe(loin.rayon);
    expect(proche.taille).not.toBe(loin.taille);
  });
});

describe("placerBranches", () => {
  it("ne produit aucun chevauchement de pastilles pour 10 branches", () => {
    const n = 10;
    const affinites = Array.from({ length: n }, (_, i) => 0.05 + (i / n) * 0.9);
    const branches = placerBranches(n, ANNEAU, affinites);

    expect(branches).toHaveLength(n);
    for (let i = 0; i < branches.length; i++) {
      for (let j = i + 1; j < branches.length; j++) {
        const a = branches[i]!;
        const b = branches[j]!;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        expect(distance).toBeGreaterThanOrEqual(a.r + b.r);
      }
    }
  });
});

describe("placerHeritiers (F-10)", () => {
  it("place chaque heritier plus pres de sa branche que de toute autre branche, sur 500 configurations aleatoires", () => {
    for (let essai = 0; essai < 500; essai++) {
      const nBranches = 3 + Math.floor(Math.random() * 8);
      const affinites = Array.from({ length: nBranches }, () => 0.1 + Math.random() * 0.8);
      const branches = placerBranches(nBranches, ANNEAU, affinites);

      const cible = Math.floor(Math.random() * branches.length);
      const branche = branches[cible]!;
      const nHeritiers = 1 + Math.floor(Math.random() * 3);
      const ouverture = Math.PI / 3 + Math.random() * (Math.PI / 3);

      const heritiers = placerHeritiers(branche, nHeritiers, ouverture);
      expect(heritiers).toHaveLength(nHeritiers);

      for (const h of heritiers) {
        const distanceBranche = Math.hypot(h.x - branche.x, h.y - branche.y);
        for (const autre of branches) {
          if (autre === branche) continue;
          const distanceAutre = Math.hypot(h.x - autre.x, h.y - autre.y);
          expect(distanceBranche).toBeLessThan(distanceAutre);
        }
      }
    }
  });
});

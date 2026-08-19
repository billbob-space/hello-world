// apps/ramure-v2/web/tests/disposition.test.ts
//
// Parite stricte (PRP 08) : le point de rupture client DOIT correspondre
// exactement a celui de la CSS (index.html, `@media (min-width: 60rem)`)
// et au parametre `largeur` envoye au serveur (internal/api/centre.go,
// cadragePour) — les trois DOIVENT s'accorder, sinon le client affiche
// une disposition et en demande une autre.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CIBLE_TACTILE_MIN_PX, SEUIL_LARGE_PX, dispositionCourante, dispositionPour } from "../src/disposition";

describe("dispositionPour", () => {
  it("rend \"etroit\" juste en dessous du seuil, \"large\" juste au-dessus", () => {
    expect(dispositionPour(SEUIL_LARGE_PX - 1)).toBe("etroit");
    expect(dispositionPour(SEUIL_LARGE_PX)).toBe("large");
  });

  it("rend \"etroit\" a 320px (le plus petit viewport verifie, PRP 08)", () => {
    expect(dispositionPour(320)).toBe("etroit");
  });

  it("rend \"large\" a 2560px (le plus grand viewport verifie, PRP 08)", () => {
    expect(dispositionPour(2560)).toBe("large");
  });
});

describe("dispositionCourante", () => {
  it("lit innerWidth de la fenetre fournie, sans toucher a la fenetre reelle", () => {
    expect(dispositionCourante({ innerWidth: 375 })).toBe("etroit");
    expect(dispositionCourante({ innerWidth: 1280 })).toBe("large");
  });
});

describe("accord avec la CSS d'index.html", () => {
  it("SEUIL_LARGE_PX correspond au point de rupture CSS 60rem (16px/rem)", () => {
    const chemin = resolve(process.cwd(), "index.html");
    const html = readFileSync(chemin, "utf-8");
    expect(html).toMatch(/@media \(min-width: 60rem\)/);
    expect(SEUIL_LARGE_PX).toBe(60 * 16);
  });
});

describe("CIBLE_TACTILE_MIN_PX", () => {
  it("vaut 24px (WCAG 2.2 SC 2.5.8 AA)", () => {
    expect(CIBLE_TACTILE_MIN_PX).toBe(24);
  });
});

// apps/ramure-v2/web/tests/textes.test.ts
//
// Premier test reel de la chaine TypeScript (PRP 05, tache 1) : toutes les
// chaines affichees a l'utilisateur vivent dans textes.ts, en francais, et
// nulle part ailleurs (PRD §05, vocabulaire contractuel). Ce test ne
// verifie pas l'exhaustivite (le PRP 08 le fera au bout en bout) : il donne
// seulement a vitest quelque chose de reel a executer des cette tache.
import { describe, expect, it } from "vitest";
import { textes } from "../src/textes";

describe("textes", () => {
  it("porte le titre du produit", () => {
    expect(textes.titre).toBe("RAMURE");
  });

  it("annonce le nouveau centre en francais, avec son nom", () => {
    expect(textes.annonceNouveauCentre("Portishead")).toBe(
      "Nouveau centre : Portishead",
    );
  });

  it("nomme l'intitule accessible d'un noeud par le nom complet de l'artiste, jamais une initiale ou une position (§12)", () => {
    expect(textes.accessibleNoeud("Boards of Canada")).toBe(
      "Boards of Canada",
    );
  });

  it("propose un retour au cadrage neutre", () => {
    expect(textes.cadrageInitial.length).toBeGreaterThan(0);
  });
});

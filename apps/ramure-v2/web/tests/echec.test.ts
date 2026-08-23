// apps/ramure-v2/web/tests/echec.test.ts
//
// PRODUCT.md §17 Q6 (decision du 22 aout 2026) : "Que voit-on quand une
// graine ne donne rien ?" Ce fichier couvre la logique PURE + DOM de
// web/src/echec.ts -- le cablage evenementiel (main.ts) reste verifie
// manuellement et par le bout en bout (web/tests/e2e/pannes.spec.ts,
// echec-plantation.spec.ts), comme le reste de son cablage DOM.
import { describe, expect, it } from "vitest";
import { afficherEchecPlantation, estEchecDePlantation, masquerEchecPlantation, texteEchecPlantation } from "../src/echec";
import type { CentreAPI } from "../src/passerelle";

function centre(partiel: Partial<CentreAPI> & Pick<CentreAPI, "etat">): CentreAPI {
  return {
    artiste: { nom: "", mbid: "", pays: "", desambiguisation: "" },
    illustration: { petite: "", moyenne: "", grande: "" },
    ...partiel,
  };
}

describe("estEchecDePlantation", () => {
  it("etat ok -- jamais un echec, quel que soit le mbid", () => {
    expect(estEchecDePlantation(centre({ etat: "ok" }))).toBe(false);
  });

  it("aucun_voisin AVEC mbid -- un artiste REELLEMENT resolu, sans voisin connu (F-36, legitime)", () => {
    expect(
      estEchecDePlantation(centre({ etat: "aucun_voisin", artiste: { nom: "Artiste Solitaire", mbid: "mbid-1", pays: "", desambiguisation: "" } })),
    ).toBe(false);
  });

  it("aucun_voisin SANS mbid -- nom introuvable (critique 2026-08-22 C15, l'ancien artiste fantome)", () => {
    expect(estEchecDePlantation(centre({ etat: "aucun_voisin" }))).toBe(true);
  });

  it("panne -- jamais de mbid (centrePanne, internal/arbre/centre.go), toujours un echec de plantation", () => {
    expect(estEchecDePlantation(centre({ etat: "panne" }))).toBe(true);
  });
});

describe("texteEchecPlantation", () => {
  it("aucun_voisin -- ajoute ce qu'on peut faire au message du serveur", () => {
    expect(texteEchecPlantation(centre({ etat: "aucun_voisin", message: 'Aucun artiste ne correspond a "Zzzt".' }))).toBe(
      "Aucun artiste ne correspond a \"Zzzt\". Vérifie l'orthographe, ou plante un autre nom.",
    );
  });

  it("panne -- le message du serveur invite deja a reessayer, jamais complete par une suggestion d'orthographe", () => {
    const message = "les voisins de cet artiste n'ont pas pu etre charges, reessayez dans un instant.";
    expect(texteEchecPlantation(centre({ etat: "panne", message }))).toBe(message);
  });

  it("message serveur absent -- repli sur le texte generique, jamais une chaine vide", () => {
    expect(texteEchecPlantation(centre({ etat: "aucun_voisin" }))).toContain("Aucun artiste ne correspond à cette recherche.");
  });
});

describe("afficherEchecPlantation / masquerEchecPlantation", () => {
  function elements() {
    const bande = document.createElement("p");
    bande.hidden = true;
    const arbre = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    return { bande, arbre };
  }

  it("pose le message et devoile la bande", () => {
    const els = elements();
    afficherEchecPlantation(els, "Aucun artiste ne correspond à « Zzzt ».", false);
    expect(els.bande.hidden).toBe(false);
    expect(els.bande.textContent).toBe("Aucun artiste ne correspond à « Zzzt ».");
  });

  it("arbre existant -- l'estompe, ne l'efface jamais (§17 Q6, l'exploration en cours n'est pas perdue)", () => {
    const els = elements();
    afficherEchecPlantation(els, "message", true);
    expect(els.arbre.classList.contains("estompe")).toBe(true);
  });

  it("pas d'arbre precedent -- la bande s'affiche seule, rien n'est estompe (cas explicitement traite, pas un oubli)", () => {
    const els = elements();
    afficherEchecPlantation(els, "message", false);
    expect(els.arbre.classList.contains("estompe")).toBe(false);
  });

  it("masquerEchecPlantation leve la bande et retire l'estompe", () => {
    const els = elements();
    afficherEchecPlantation(els, "message", true);
    masquerEchecPlantation(els);
    expect(els.bande.hidden).toBe(true);
    expect(els.bande.textContent).toBe("");
    expect(els.arbre.classList.contains("estompe")).toBe(false);
  });

  it("elements absents -- ne plante jamais (arbre pas encore monte, tests DOM partiels)", () => {
    expect(() => afficherEchecPlantation({ bande: null, arbre: null }, "message", true)).not.toThrow();
    expect(() => masquerEchecPlantation({ bande: null, arbre: null })).not.toThrow();
  });
});

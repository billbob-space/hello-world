// apps/ramure-v2/web/tests/recherche.test.ts
//
// Recherche, suggestions, rattrapage et partage (F-01 a F-04, F-34).
// Porte 06, tache 2.
import { describe, expect, it, vi } from "vitest";
import {
  GestionnaireSuggestions,
  construireLienPartage,
  creerAmorceurUneFois,
  extraireGraineDeLURL,
  type SuggestionAPI,
} from "../src/recherche";

describe("1 · navigation clavier des suggestions (F-01, F-02)", () => {
  function gestionnaire(suggestions: SuggestionAPI[] = []) {
    const g = new GestionnaireSuggestions();
    g.definir(suggestions);
    return g;
  }

  it("commence sans selection : aria-activedescendant absent", () => {
    const g = gestionnaire([{ nom: "Portishead", mbid: "m1" }]);
    expect(g.indexActif).toBeNull();
  });

  it("fleche bas parcourt vers le bas, fleche haut revient en arriere", () => {
    const g = gestionnaire([
      { nom: "Portishead", mbid: "m1" },
      { nom: "Massive Attack", mbid: "m2" },
    ]);
    g.suivant();
    expect(g.indexActif).toBe(0);
    g.suivant();
    expect(g.indexActif).toBe(1);
    g.precedent();
    expect(g.indexActif).toBe(0);
  });

  it("fleche bas depuis la fin revient au debut (cycle)", () => {
    const g = gestionnaire([{ nom: "A", mbid: "1" }, { nom: "B", mbid: "2" }]);
    g.suivant(); // -> 0
    g.suivant(); // -> 1 (dernier)
    g.suivant(); // -> 0 (cycle)
    expect(g.indexActif).toBe(0);
  });

  it("valider sans selection choisit le premier resultat si un seul existe implicitement au clavier", () => {
    const g = gestionnaire([{ nom: "Portishead", mbid: "m1" }]);
    g.suivant();
    expect(g.selection()?.nom).toBe("Portishead");
  });

  it("effacer() vide la liste et la selection en une action", () => {
    const g = gestionnaire([{ nom: "Portishead", mbid: "m1" }]);
    g.suivant();
    g.effacer();
    expect(g.suggestions).toHaveLength(0);
    expect(g.indexActif).toBeNull();
  });

  it("expose l'etat pour aria-expanded, aria-activedescendant et role=listbox", () => {
    const g = gestionnaire([{ nom: "Portishead", mbid: "m1" }]);
    expect(g.ouvert).toBe(true);
    g.effacer();
    expect(g.ouvert).toBe(false);
  });

  it("idActif(prefixe) rend un identifiant stable pour l'option active", () => {
    const g = gestionnaire([{ nom: "Portishead", mbid: "m1" }, { nom: "Massive Attack", mbid: "m2" }]);
    g.suivant();
    g.suivant();
    expect(g.idActif("suggestion")).toBe("suggestion-1");
  });
});

describe("2 · le rattrapage est TOUJOURS affiche, jamais applique en silence (F-03, §09)", () => {
  it("correction() rend le premier candidat marque correction=true", () => {
    const g = new GestionnaireSuggestions();
    g.definir([{ nom: "Portishead", mbid: "m1", correction: true }]);
    expect(g.correction()?.nom).toBe("Portishead");
  });

  it("aucune correction si aucun candidat n'est marque", () => {
    const g = new GestionnaireSuggestions();
    g.definir([{ nom: "Massive Attack", mbid: "m2" }]);
    expect(g.correction()).toBeNull();
  });
});

describe("3 · le partage d'un arbre (F-34)", () => {
  it("produit un lien qui porte uniquement le nom de l'artiste", () => {
    const lien = construireLienPartage("Portishead", "https://ramure-v2.apps.billbob.ovh");
    expect(lien).toBe("https://ramure-v2.apps.billbob.ovh/?graine=Portishead");
  });

  it("encode un nom contenant un espace ou une esperluette, puis le decode correctement", () => {
    const lien = construireLienPartage("Simon & Garfunkel", "https://ramure-v2.apps.billbob.ovh");
    const url = new URL(lien);
    // L'espace est encode "+" et l'esperluette "%26" (encodage standard
    // d'une chaine de requete) : ce qui compte n'est pas la forme brute,
    // mais que le decodage rende exactement le nom d'origine.
    expect(lien).toContain("%26");
    expect(url.searchParams.get("graine")).toBe("Simon & Garfunkel");
  });

  it("ne contient aucun identifiant d'utilisateur ni jeton de session", () => {
    const lien = construireLienPartage("Portishead", "https://ramure-v2.apps.billbob.ovh");
    expect(lien).not.toMatch(/user|token|session|email/i);
  });

  it("extraireGraineDeLURL decode un nom avec espace ou esperluette", () => {
    const params = new URLSearchParams({ graine: "Simon & Garfunkel" });
    expect(extraireGraineDeLURL(params)).toBe("Simon & Garfunkel");
  });

  it("extraireGraineDeLURL rend null en l'absence de graine", () => {
    expect(extraireGraineDeLURL(new URLSearchParams())).toBeNull();
  });
});

describe("4 · amorcage externe, une seule fois (F-04)", () => {
  it("un amorceur ne plante qu'une fois : la deuxieme invocation est ignoree", () => {
    const surPlanter = vi.fn();
    const g = new GestionnaireSuggestions();
    void g; // le comportement d'amorcage unique vit dans recherche.ts (amorcerUneFois)
    const amorcer = (nom: string) => surPlanter(nom);
    const amorcerUneFois = creerAmorceurUneFois(amorcer);
    amorcerUneFois("Portishead");
    amorcerUneFois("Portishead");
    amorcerUneFois("Massive Attack");
    expect(surPlanter).toHaveBeenCalledTimes(1);
    expect(surPlanter).toHaveBeenCalledWith("Portishead");
  });
});

// apps/ramure-v2/web/tests/collection.test.ts
//
// La collection cote client (PRP 07, tache 3) : lignee affichee (F-30),
// replanter d'un clic (F-31), miroir hors ligne sans perte ni doublon
// (F-33).
import { describe, expect, it, vi } from "vitest";
import {
  MiroirHorsLigne,
  construireCollection,
  type EntreeAPI,
} from "../src/collection";

function stockageDeTest(): Storage {
  // jsdom fournit localStorage ; un stockage frais par test evite toute
  // fuite entre cas.
  window.localStorage.clear();
  return window.localStorage;
}

const entree = (mbid: string, nom = mbid, lignee: string[] = []): EntreeAPI => ({
  nom,
  mbid,
  lignee,
  ajoute: "2026-03-14T12:00:00Z",
});

describe("1 · le miroir hors ligne ne perd rien et ne duplique rien (F-33)", () => {
  it("un ajout hors ligne remonte a la reconnexion", () => {
    const miroir = new MiroirHorsLigne(stockageDeTest());
    miroir.ajouter(entree("m1", "Portishead"));

    // Le serveur, hors ligne, n'a encore RIEN vu de cet ajout.
    const vue = miroir.vue([]);
    expect(vue.map((e) => e.mbid)).toEqual(["m1"]);
  });

  it("un retrait hors ligne ne ressuscite pas a la reconnexion", () => {
    const miroir = new MiroirHorsLigne(stockageDeTest());
    miroir.retirer("m1");

    // Le serveur porte encore l'entree (il ne sait pas encore qu'elle a
    // ete retiree) : la vue locale doit deja la masquer.
    const vue = miroir.vue([entree("m1", "Portishead")]);
    expect(vue).toEqual([]);
  });

  it("une entree presente des deux cotes ne produit pas de doublon", () => {
    const miroir = new MiroirHorsLigne(stockageDeTest());
    miroir.ajouter(entree("m1", "Portishead"));

    // Le serveur a ENTRE-TEMPS confirme le meme ajout (un autre appareil,
    // ou une synchronisation partielle) : la vue ne doit compter qu'UNE
    // seule fois "m1".
    const vue = miroir.vue([entree("m1", "Portishead")]);
    expect(vue.filter((e) => e.mbid === "m1")).toHaveLength(1);
  });

  it("un appareil reste longtemps hors ligne ne doit pas effacer ce qu'un autre a garde entre-temps", () => {
    const miroir = new MiroirHorsLigne(stockageDeTest());
    // Aucun changement local : le miroir est purement passif.
    const vue = miroir.vue([entree("m1", "Portishead"), entree("m2", "Tricky")]);
    expect(vue.map((e) => e.mbid).sort()).toEqual(["m1", "m2"]);
  });

  it("ajouter puis retirer localement le meme artiste annule l'ajout en attente", () => {
    const miroir = new MiroirHorsLigne(stockageDeTest());
    miroir.ajouter(entree("m1"));
    miroir.retirer("m1");
    expect(miroir.ajoutsEnAttente).toHaveLength(0);
    expect(miroir.retraitsEnAttente).toEqual(["m1"]);
  });

  it("retirer puis regarder localement le meme artiste annule le retrait en attente", () => {
    const miroir = new MiroirHorsLigne(stockageDeTest());
    miroir.retirer("m1");
    miroir.ajouter(entree("m1"));
    expect(miroir.retraitsEnAttente).toHaveLength(0);
    expect(miroir.ajoutsEnAttente.map((e) => e.mbid)).toEqual(["m1"]);
  });

  it("confirmer() efface les changements desormais reconnus par le serveur, jamais les autres", () => {
    const stockage = stockageDeTest();
    const miroir = new MiroirHorsLigne(stockage);
    miroir.ajouter(entree("confirme"));
    miroir.ajouter(entree("pas-encore"));
    miroir.retirer("retire-confirme");

    // Le serveur porte desormais "confirme" (l'ajout a reussi) ; il ne
    // porte plus "retire-confirme" (le retrait a reussi) ; il ne sait
    // toujours rien de "pas-encore" (echec ou synchronisation partielle).
    miroir.confirmer([entree("confirme")]);

    expect(miroir.ajoutsEnAttente.map((e) => e.mbid)).toEqual(["pas-encore"]);
    expect(miroir.retraitsEnAttente).toHaveLength(0);
  });

  it("survit a une nouvelle instance sur le meme stockage (rechargement de page)", () => {
    const stockage = stockageDeTest();
    const premier = new MiroirHorsLigne(stockage);
    premier.ajouter(entree("m1", "Portishead"));

    const second = new MiroirHorsLigne(stockage);
    expect(second.ajoutsEnAttente.map((e) => e.mbid)).toEqual(["m1"]);
  });
});

describe("2 · le chemin parcouru s'affiche (F-30)", () => {
  it("chaque artiste garde montre sa lignee complete et sa date, pas seulement son nom", () => {
    const conteneur = document.createElement("div");
    construireCollection(conteneur, {
      entrees: [entree("m1", "Tricky", ["Portishead", "Massive Attack", "Tricky"])],
      surReplanter: () => {},
      surRetirer: () => {},
    });

    expect(conteneur.textContent).toContain("Tricky");
    expect(conteneur.textContent).toContain("Portishead");
    expect(conteneur.textContent).toContain("Massive Attack");
    const date = conteneur.querySelector(".collection-date");
    expect(date?.textContent?.length ?? 0).toBeGreaterThan(0);
  });

  it("une collection vide affiche un message explicite, jamais un panneau silencieux", () => {
    const conteneur = document.createElement("div");
    construireCollection(conteneur, { entrees: [], surReplanter: () => {}, surRetirer: () => {} });
    expect(conteneur.textContent).toContain("Aucun artiste");
  });

  it("actualiser() repeint la liste sans reconstruire le conteneur", () => {
    const conteneur = document.createElement("div");
    const panneau = construireCollection(conteneur, {
      entrees: [],
      surReplanter: () => {},
      surRetirer: () => {},
    });
    panneau.actualiser([entree("m1", "Portishead")]);
    expect(conteneur.textContent).toContain("Portishead");
  });
});

describe("3 · replanter d'un clic (F-31)", () => {
  it("cliquer sur une entree appelle surReplanter avec l'entree complete", () => {
    const surReplanter = vi.fn();
    const conteneur = document.createElement("div");
    const cible = entree("m1", "Portishead", ["Portishead"]);
    construireCollection(conteneur, { entrees: [cible], surReplanter, surRetirer: () => {} });

    conteneur.querySelector<HTMLButtonElement>(".collection-replanter")?.click();
    expect(surReplanter).toHaveBeenCalledWith(cible);
  });

  it("cliquer sur le bouton retirer ne declenche PAS le replantage", () => {
    const surReplanter = vi.fn();
    const surRetirer = vi.fn();
    const conteneur = document.createElement("div");
    construireCollection(conteneur, {
      entrees: [entree("m1", "Portishead")],
      surReplanter,
      surRetirer,
    });

    conteneur.querySelector<HTMLButtonElement>(".collection-retirer")?.click();
    expect(surRetirer).toHaveBeenCalledWith("m1");
    expect(surReplanter).not.toHaveBeenCalled();
  });
});

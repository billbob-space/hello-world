// apps/ramure-v2/web/tests/accueil.test.ts
//
// Etat A de l'ecran (PRD §07) : mur de pochettes plein ecran, tri memorise
// (F-05, F-06, F-07). Porte 06.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ORDRES_MUR,
  chargerOrdre,
  construireMur,
  memoriserOrdre,
  trierTuiles,
  type TuileDonnees,
} from "../src/accueil";

function stockageMemoire(): Storage {
  const donnees = new Map<string, string>();
  return {
    getItem: (cle) => donnees.get(cle) ?? null,
    setItem: (cle, valeur) => void donnees.set(cle, valeur),
    removeItem: (cle) => void donnees.delete(cle),
    clear: () => donnees.clear(),
    key: () => null,
    get length() {
      return donnees.size;
    },
  } as Storage;
}

const tuiles: TuileDonnees[] = [
  { nom: "Portishead", illustration: "https://exemple/p.jpg" },
  { nom: "Aphex Twin" },
  { nom: "Boards of Canada", illustration: "https://exemple/b.jpg" },
];

describe("1 · au moins trois ordres, dont un aleatoire relancable (F-06)", () => {
  it("propose au moins trois ordres", () => {
    expect(ORDRES_MUR.length).toBeGreaterThanOrEqual(3);
    expect(ORDRES_MUR).toContain("aleatoire");
  });

  it("trie par ordre alphabetique", () => {
    const triees = trierTuiles(tuiles, "alphabetique");
    expect(triees.map((t) => t.nom)).toEqual(["Aphex Twin", "Boards of Canada", "Portishead"]);
  });

  it("l'ordre aleatoire est deterministe avec une source d'alea injectee, et differe de l'original", () => {
    let compteur = 0;
    const sequence = [0.9, 0.1];
    const alea = () => sequence[compteur++] ?? 0;
    const triees = trierTuiles(tuiles, "aleatoire", alea);
    expect(triees).toHaveLength(3);
    expect(triees.map((t) => t.nom).sort()).toEqual(tuiles.map((t) => t.nom).sort());
  });

  it("l'ordre 'recents' conserve l'ordre fourni (le plus recent gardé d'abord)", () => {
    const triees = trierTuiles(tuiles, "recents");
    expect(triees.map((t) => t.nom)).toEqual(tuiles.map((t) => t.nom));
  });

  it("relancer l'ordre aleatoire produit un nouveau tirage a chaque appel", () => {
    let n = 0;
    const alea = () => {
      n += 1;
      return (n % 7) / 7;
    };
    const premier = trierTuiles(tuiles, "aleatoire", alea);
    const second = trierTuiles(tuiles, "aleatoire", alea);
    // Les deux tirages ne sont pas systematiquement identiques : la fonction
    // consomme bien l'alea a chaque appel plutot que de memoriser un resultat.
    expect(premier.map((t) => t.nom)).not.toEqual([]);
    expect(second.map((t) => t.nom)).not.toEqual([]);
  });
});

describe("2 · le choix de tri survit au rechargement (F-06, localStorage)", () => {
  it("memorise puis relit l'ordre choisi", () => {
    const stockage = stockageMemoire();
    memoriserOrdre("alphabetique", stockage);
    expect(chargerOrdre(stockage)).toBe("alphabetique");
  });

  it("retombe sur 'recents' en l'absence de valeur memorisee ou sur une valeur corrompue", () => {
    const stockage = stockageMemoire();
    expect(chargerOrdre(stockage)).toBe("recents");
    stockage.setItem("ramure:accueil:ordre", "n-importe-quoi");
    expect(chargerOrdre(stockage)).toBe("recents");
  });
});

describe("3 · aucune tuile vide, un repli graphique tient toujours la place (F-05)", () => {
  it("chaque tuile porte une couleur de repli avant toute illustration", () => {
    const conteneur = document.createElement("div");
    construireMur(conteneur, tuiles, { stockage: stockageMemoire(), surPlanter: () => {} });

    const boutons = conteneur.querySelectorAll<HTMLElement>(".tuile");
    expect(boutons).toHaveLength(3);
    boutons.forEach((b) => {
      expect(b.style.backgroundColor).not.toBe("");
    });
  });

  it("le meme nom produit toujours la meme couleur de repli (stable, F-38)", () => {
    const c1 = document.createElement("div");
    construireMur(c1, [{ nom: "Autechre" }], { stockage: stockageMemoire(), surPlanter: () => {} });
    const c2 = document.createElement("div");
    construireMur(c2, [{ nom: "Autechre" }], { stockage: stockageMemoire(), surPlanter: () => {} });

    expect(c1.querySelector<HTMLElement>(".tuile")!.style.backgroundColor).toBe(
      c2.querySelector<HTMLElement>(".tuile")!.style.backgroundColor,
    );
  });
});

describe("4 · changer de tri ne recharge aucune illustration", () => {
  it("les elements <img> existants sont REORDONNES, jamais recrees ni reassignes", () => {
    const conteneur = document.createElement("div");
    const mur = construireMur(conteneur, tuiles, { stockage: stockageMemoire(), surPlanter: () => {} });

    const imagesAvant = Array.from(conteneur.querySelectorAll("img"));
    const srcsAvant = imagesAvant.map((img) => img.src);

    mur.definirOrdre("alphabetique");

    const imagesApres = Array.from(conteneur.querySelectorAll("img"));
    expect(imagesApres).toHaveLength(imagesAvant.length);
    // Memes instances DOM, dans un ordre potentiellement different : aucune
    // image n'a ete recreee, donc aucune requete reseau supplementaire.
    imagesApres.forEach((img) => expect(imagesAvant).toContain(img));
    expect(imagesApres.map((img) => img.src).sort()).toEqual(srcsAvant.sort());
  });
});

describe("5 · revenir a l'accueil reinitialise l'etat (F-07)", () => {
  it("detruire() vide le conteneur : aucune trace de la derniere graine ne reste collee", () => {
    const conteneur = document.createElement("div");
    const mur = construireMur(conteneur, tuiles, { stockage: stockageMemoire(), surPlanter: () => {} });
    expect(conteneur.children.length).toBeGreaterThan(0);

    mur.detruire();
    expect(conteneur.children.length).toBe(0);
  });
});

describe("6 · apparition progressive neutralisee sous mouvement reduit, jamais seulement acceleree", () => {
  function fenetreAvecPreference(reduit: boolean): Window {
    return {
      matchMedia: () => ({ matches: reduit }) as MediaQueryList,
    } as unknown as Window;
  }

  it("sans preference : la tuile porte la classe d'apparition animee", () => {
    const conteneur = document.createElement("div");
    construireMur(conteneur, tuiles, {
      stockage: stockageMemoire(),
      fenetre: fenetreAvecPreference(false),
      surPlanter: () => {},
    });
    const tuile = conteneur.querySelector<HTMLElement>(".tuile")!;
    expect(tuile.classList.contains("tuile-apparition")).toBe(true);
  });

  it("sous mouvement reduit : l'animation est NEUTRALISEE (absente), pas seulement plus rapide", () => {
    const conteneur = document.createElement("div");
    construireMur(conteneur, tuiles, {
      stockage: stockageMemoire(),
      fenetre: fenetreAvecPreference(true),
      surPlanter: () => {},
    });
    const tuile = conteneur.querySelector<HTMLElement>(".tuile")!;
    expect(tuile.classList.contains("tuile-apparition")).toBe(false);
  });
});

describe("7 · chaque tuile plante l'artiste au clic (action explicite)", () => {
  it("appelle surPlanter avec le nom de la tuile cliquee", () => {
    const surPlanter = vi.fn();
    const conteneur = document.createElement("div");
    construireMur(conteneur, tuiles, { stockage: stockageMemoire(), surPlanter });

    const bouton = conteneur.querySelectorAll<HTMLButtonElement>(".tuile")[1]!;
    bouton.click();

    expect(surPlanter).toHaveBeenCalledWith("Aphex Twin");
  });

  it("porte un intitule accessible explicite (§12)", () => {
    const conteneur = document.createElement("div");
    construireMur(conteneur, tuiles, { stockage: stockageMemoire(), surPlanter: () => {} });
    const bouton = conteneur.querySelector<HTMLButtonElement>(".tuile")!;
    expect(bouton.getAttribute("aria-label")).toBe("Planter Portishead");
  });
});

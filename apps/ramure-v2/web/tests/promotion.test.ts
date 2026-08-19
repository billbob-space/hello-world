// apps/ramure-v2/web/tests/promotion.test.ts
//
// Porte F-11 a F-14 et la section "transition de promotion" de §11
// (PRP 05, tache 5). C'est le geste fondamental du produit (§05) : le
// reste de l'interface peut etre mediocre sans que le produit disparaisse ;
// celui-ci, non. Neuf exigences testees.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { creerGroupes, dessinerNoeud, definirIllustration, NS_SVG } from "../src/canevas";
import {
  GestionnaireLignee,
  annoncerNouveauCentre,
  appliquerTransitionVisuelle,
  dureePromotion,
  promouvoir,
  recadrerSiBouge,
} from "../src/promotion";
import { textes } from "../src/textes";

function scene() {
  const svg = document.createElementNS(NS_SVG, "svg") as SVGSVGElement;
  const racine = document.createElementNS(NS_SVG, "g") as SVGGElement;
  svg.append(racine);
  document.body.append(svg); // isConnected exige un document reel
  const groupes = creerGroupes(racine);
  return { svg, racine, groupes };
}

describe("1 · le noeud choisi reste visible en continu (F-12)", () => {
  it("l'element DOM du noeud promu est le meme objet avant et apres la transition, toujours dans le document", async () => {
    const { racine, groupes } = scene();
    const branche = dessinerNoeud(racine, groupes, { id: "b1", nom: "Autechre", x: 200, y: 0, r: 30 });
    const reference = branche.groupe;

    await appliquerTransitionVisuelle(branche, null, { x: 0, y: 0, r: 60 }, { dureeMs: 0 });

    expect(branche.groupe).toBe(reference);
    expect(reference.isConnected).toBe(true);
  });
});

describe("2 · la generation precedente s'efface sur place", () => {
  it("la position de l'ancien centre ne change pas ; seule son opacite varie", async () => {
    const { racine, groupes } = scene();
    const ancienCentre = dessinerNoeud(racine, groupes, { id: "centre", nom: "Aphex Twin", x: 0, y: 0, r: 60 });
    const branche = dessinerNoeud(racine, groupes, { id: "b1", nom: "Autechre", x: 200, y: 0, r: 30 });

    const avant = {
      cx: ancienCentre.cercle.getAttribute("cx"),
      cy: ancienCentre.cercle.getAttribute("cy"),
      r: ancienCentre.cercle.getAttribute("r"),
    };

    await appliquerTransitionVisuelle(branche, ancienCentre, { x: 0, y: 0, r: 60 }, { dureeMs: 0 });

    expect(ancienCentre.cercle.getAttribute("cx")).toBe(avant.cx);
    expect(ancienCentre.cercle.getAttribute("cy")).toBe(avant.cy);
    expect(ancienCentre.cercle.getAttribute("r")).toBe(avant.r);
    expect(ancienCentre.groupe.style.opacity).toBe("0");
  });
});

describe("3 et 4 · illustration continue, jamais de clignotement", () => {
  it("le noeud promu garde son illustration deja chargee : aucune reecriture du motif pendant la transition", async () => {
    const { racine, groupes } = scene();
    const branche = dessinerNoeud(racine, groupes, { id: "b1", nom: "Autechre", x: 200, y: 0, r: 30 });
    definirIllustration(branche, "https://exemple.test/autechre.jpg");
    const hrefAvant = branche.pattern.querySelector("image")?.getAttribute("href");

    await appliquerTransitionVisuelle(branche, null, { x: 0, y: 0, r: 60 }, { dureeMs: 0 });

    const hrefApres = branche.pattern.querySelector("image")?.getAttribute("href");
    expect(hrefApres).toBe(hrefAvant);
    expect(hrefApres).not.toBe("");
    expect(hrefApres).toBeTruthy();
  });
});

describe("5 · robustesse aux gestes rapides (F-13)", () => {
  it("deux promotions enchainees a 50 ms d'intervalle aboutissent au SECOND artiste demande", async () => {
    vi.useFakeTimers();
    try {
      const lignee = new GestionnaireLignee();
      lignee.commencerPromotion("centre-initial");

      const resultats: Array<{ id: string; applique: boolean }> = [];

      const p1 = promouvoir(lignee, { id: "artiste-a", nom: "Artiste A" }, {
        mouvementReduit: true,
        chargerCentre: () => new Promise((resolve) => setTimeout(() => resolve("donnees-a"), 200)),
      }).then((r) => resultats.push({ id: "artiste-a", applique: r.applique }));

      await vi.advanceTimersByTimeAsync(50);

      const p2 = promouvoir(lignee, { id: "artiste-b", nom: "Artiste B" }, {
        mouvementReduit: true,
        chargerCentre: () => new Promise((resolve) => setTimeout(() => resolve("donnees-b"), 50)),
      }).then((r) => resultats.push({ id: "artiste-b", applique: r.applique }));

      await vi.advanceTimersByTimeAsync(300);
      await Promise.all([p1, p2]);

      expect(lignee.centre).toBe("artiste-b");
      expect(resultats.find((r) => r.id === "artiste-a")?.applique).toBe(false);
      expect(resultats.find((r) => r.id === "artiste-b")?.applique).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("6 · reponses tardives ecartees (§09)", () => {
  it("une reponse portant une generation perimee est ecartee meme si elle resout APRES la reponse courante mais arrive en second", async () => {
    const lignee = new GestionnaireLignee();
    lignee.commencerPromotion("centre-initial");

    let resoudrePremiere!: (v: string) => void;
    let resoudreSeconde!: (v: string) => void;
    const premierePromesse = new Promise<string>((resolve) => (resoudrePremiere = resolve));
    const secondePromesse = new Promise<string>((resolve) => (resoudreSeconde = resolve));

    const resultatPremiere = promouvoir(lignee, { id: "artiste-a", nom: "Artiste A" }, {
      mouvementReduit: true,
      chargerCentre: () => premierePromesse,
    });
    const resultatSeconde = promouvoir(lignee, { id: "artiste-b", nom: "Artiste B" }, {
      mouvementReduit: true,
      chargerCentre: () => secondePromesse,
    });

    // La SECONDE promotion (la plus recente) resout D'ABORD...
    resoudreSeconde("donnees-b");
    const b = await resultatSeconde;
    // ...puis la PREMIERE (perimee) resout APRES.
    resoudrePremiere("donnees-a");
    const a = await resultatPremiere;

    expect(b.applique).toBe(true);
    expect(a.applique).toBe(false);
    expect(lignee.centre).toBe("artiste-b");
  });
});

describe("7 · naviguer dans la lignee pendant une transition en cours (F-13)", () => {
  it("mene a la destination demandee, pas a la promotion interrompue", async () => {
    const lignee = new GestionnaireLignee();
    lignee.commencerPromotion("racine");
    lignee.commencerPromotion("intermediaire"); // lignee = [racine]

    let resoudre!: (v: string) => void;
    const enCours = promouvoir(lignee, { id: "cible-lointaine", nom: "Cible lointaine" }, {
      mouvementReduit: true,
      chargerCentre: () => new Promise<string>((resolve) => (resoudre = resolve)),
    });

    // L'utilisateur clique "racine" dans la lignee AVANT que la promotion en cours ne resolve.
    const nav = lignee.naviguerVersAncetre(0);
    expect(nav.idCentre).toBe("racine");
    expect(lignee.centre).toBe("racine");

    resoudre("donnees-cible-lointaine");
    const resultat = await enCours;

    expect(resultat.applique).toBe(false); // perimee par la navigation
    expect(lignee.centre).toBe("racine"); // la destination demandee l'emporte
  });
});

describe("8 · la vue ne se recadre que si l'utilisateur l'avait modifiee", () => {
  it("n'appelle pas recadrer() quand aBouge() est faux", () => {
    const appliquer = vi.fn();
    recadrerSiBouge(false, appliquer);
    expect(appliquer).not.toHaveBeenCalled();
  });

  it("appelle recadrer() quand aBouge() est vrai", () => {
    const appliquer = vi.fn();
    recadrerSiBouge(true, appliquer);
    expect(appliquer).toHaveBeenCalledTimes(1);
  });
});

describe("10 · reinitialiser() (F-07, PRP 08 : \"quitter l'exploration\", distinct de \"remonter d'un cran\")", () => {
  it("vide la lignee et le centre courant", () => {
    const lignee = new GestionnaireLignee();
    lignee.commencerPromotion("racine");
    lignee.commencerPromotion("intermediaire");

    lignee.reinitialiser();

    expect(lignee.centre).toBeNull();
    expect(lignee.lignee).toEqual([]);
  });

  it("bat une nouvelle generation : une reponse en vol au moment du retour a l'accueil est ecartee", () => {
    const lignee = new GestionnaireLignee();
    const generationAvant = lignee.commencerPromotion("racine");

    lignee.reinitialiser();

    expect(lignee.estPerimee(generationAvant)).toBe(true);
  });
});

describe("11 · annoncerNouveauCentre (§12 : le changement de centre est annonce)", () => {
  it("ecrit le message de textes.annonceNouveauCentre dans l'element fourni", () => {
    const etat = document.createElement("p");
    etat.setAttribute("role", "status");
    etat.setAttribute("aria-live", "polite");

    annoncerNouveauCentre(etat, "Portishead", (fn) => fn()); // planifie IMMEDIATEMENT (pas de setTimeout reel)

    expect(etat.textContent).toBe(textes.annonceNouveauCentre("Portishead"));
    expect(etat.getAttribute("aria-live")).toBe("polite");
  });

  it("ne fait rien (ne plante pas) si l'element est absent", () => {
    expect(() => annoncerNouveauCentre(null, "Portishead", (fn) => fn())).not.toThrow();
  });

  it("differe l'ecriture via `planifier` par defaut (repli setTimeout(fn, 0))", () => {
    vi.useFakeTimers();
    try {
      const etat = document.createElement("p");
      annoncerNouveauCentre(etat, "Aphex Twin");
      expect(etat.textContent).toBe(""); // rien avant que le minuteur ne se declenche
      vi.runAllTimers();
      expect(etat.textContent).toBe(textes.annonceNouveauCentre("Aphex Twin"));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("12 · la zone tactile suit le noeud promu (§12, PRP 08 : cible >= 24x24px a toute echelle)", () => {
  it("cx/cy/r de zoneTactile valent ceux de la cible apres la transition", async () => {
    const { racine, groupes } = scene();
    const branche = dessinerNoeud(racine, groupes, { id: "b1", nom: "Autechre", x: 200, y: 0, r: 16 });

    await appliquerTransitionVisuelle(branche, null, { x: 0, y: 0, r: 60 }, { dureeMs: 0 });

    expect(branche.zoneTactile.getAttribute("cx")).toBe("0");
    expect(branche.zoneTactile.getAttribute("cy")).toBe("0");
    expect(branche.zoneTactile.getAttribute("r")).toBe("60");
  });
});

describe("9 · mouvement reduit : neutralise, pas accelere", () => {
  it("dureePromotion rend 0 sous mouvement reduit, une duree perceptible sinon", () => {
    expect(dureePromotion(true)).toBe(0);
    expect(dureePromotion(false)).toBeGreaterThan(0);
  });

  it("sous mouvement reduit, le centre est a jour dans le meme tour de boucle et la duree mesuree est 0", async () => {
    const { racine, groupes } = scene();
    const branche = dessinerNoeud(racine, groupes, { id: "b1", nom: "Squarepusher", x: 200, y: 0, r: 30 });

    const debut = performance.now();
    await appliquerTransitionVisuelle(branche, null, { x: 0, y: 0, r: 60 }, { dureeMs: dureePromotion(true) });
    const duree = performance.now() - debut;

    expect(branche.cercle.getAttribute("cx")).toBe("0");
    expect(branche.cercle.getAttribute("r")).toBe("60");
    expect(duree).toBeLessThan(20); // aucun delai residuel, marge machine large
  });
});

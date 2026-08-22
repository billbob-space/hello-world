// apps/ramure-v2/web/tests/fiche.test.ts
//
// Fiche du centre, discographie, lecteur d'extraits et service d'ecoute
// (F-19, F-21, F-22, F-24, F-25, F-40). Porte 06, tache 3.
import { describe, expect, it, vi } from "vitest";
import {
  GestionnaireLecteur,
  GestionnaireService,
  SERVICES,
  construireApercuBranche,
  construireFiche,
  filtrerParType,
  lienEcoute,
  mettreAJourLiens,
  peindreDiscographie,
  typesPresents,
  type AlbumAPI,
  type ExtraitAPI,
} from "../src/fiche";

const albums: AlbumAPI[] = [
  { mbid: "a1", titre: "Dummy", sortie: "1994", type: "studio", note: 4.5, votes: 42 },
  { mbid: "a2", titre: "Live 1998", sortie: "1998", type: "live", note: 0, votes: 0 },
  { mbid: "a3", titre: "Third", sortie: "2008", type: "studio", note: 4.2, votes: 30 },
];

describe("1 · filtre par type, masque s'il n'y a rien a filtrer (F-22)", () => {
  it("typesPresents rend les types distincts realisant reellement presents", () => {
    expect(typesPresents(albums).sort()).toEqual(["live", "studio"]);
  });

  it("un seul type present : la liste ne compte qu'un element (le filtre doit alors etre masque par l'appelant)", () => {
    const unSeulType: AlbumAPI[] = [albums[0]!, albums[2]!];
    expect(typesPresents(unSeulType)).toEqual(["studio"]);
  });

  it("filtrerParType ne garde que les albums du type demande", () => {
    expect(filtrerParType(albums, "live").map((a) => a.titre)).toEqual(["Live 1998"]);
  });

  it("filtrerParType('tous') rend tous les albums, dans leur ordre d'origine", () => {
    expect(filtrerParType(albums, "tous")).toEqual(albums);
  });

  it("un album releve d'un seul type (F-22) : aucun doublon possible entre filtres", () => {
    const parType = new Map<string, number>();
    for (const t of typesPresents(albums)) {
      parType.set(t, filtrerParType(albums, t as never).length);
    }
    const total = [...parType.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(albums.length);
  });
});

describe("2 · le lecteur est reinitialise a chaque changement de centre (F-24)", () => {
  it("demarre sans extrait courant", () => {
    const l = new GestionnaireLecteur();
    expect(l.extraitCourant).toBeNull();
    expect(l.enLecture).toBe(false);
  });

  it("jouer() selectionne un extrait, reinitialiser() l'efface", () => {
    const extraits: ExtraitAPI[] = [{ titre: "Glory Box", url: "https://x/1.mp3", duree: 30 }];
    const l = new GestionnaireLecteur();
    l.definirExtraits(extraits);
    l.jouer(0);
    expect(l.extraitCourant?.titre).toBe("Glory Box");
    expect(l.enLecture).toBe(true);

    l.reinitialiser();
    expect(l.extraitCourant).toBeNull();
    expect(l.enLecture).toBe(false);
  });

  it("definirExtraits() (appele a chaque nouveau centre) reinitialise implicitement la lecture en cours", () => {
    const l = new GestionnaireLecteur();
    l.definirExtraits([{ titre: "A", url: "https://x/a.mp3", duree: 10 }]);
    l.jouer(0);
    expect(l.enLecture).toBe(true);

    l.definirExtraits([{ titre: "B", url: "https://x/b.mp3", duree: 20 }]);
    expect(l.enLecture).toBe(false);
    expect(l.extraitCourant).toBeNull();
  });

  it("suivant() enchaine l'extrait suivant, sans depasser la fin (§07 : le lecteur enchaine les extraits)", () => {
    const l = new GestionnaireLecteur();
    l.definirExtraits([
      { titre: "A", url: "https://x/a.mp3", duree: 10 },
      { titre: "B", url: "https://x/b.mp3", duree: 10 },
    ]);
    l.jouer(0);
    l.suivant();
    expect(l.extraitCourant?.titre).toBe("B");
    l.suivant();
    expect(l.enLecture).toBe(false); // fin de liste : s'arrete, ne boucle pas indefiniment
  });
});

describe("3 · sans extrait, commande desactivee et EXPLICITE, jamais un bouton inerte (F-40)", () => {
  it("desactive = true et un texte non vide explique pourquoi", () => {
    const l = new GestionnaireLecteur();
    l.definirExtraits([]);
    expect(l.desactive).toBe(true);
    expect(l.raisonDesactivation.length).toBeGreaterThan(0);
  });

  it("actif des qu'au moins un extrait existe", () => {
    const l = new GestionnaireLecteur();
    l.definirExtraits([{ titre: "A", url: "https://x/a.mp3", duree: 10 }]);
    expect(l.desactive).toBe(false);
  });
});

describe("4 · le service d'ecoute se choisit et tous les liens le respectent (F-25)", () => {
  it("propose la liste des cinq services du PRP 03", () => {
    expect(SERVICES).toHaveLength(5);
    expect(SERVICES).toEqual(
      expect.arrayContaining(["deezer", "spotify", "apple", "youtube", "tidal"]),
    );
  });

  it("Deezer est le service par defaut en l'absence de reglage (repli documente, PRP 07 clos)", () => {
    const g = new GestionnaireService();
    expect(g.service).toBe("deezer");
  });

  it("changer de service notifie les abonnes : tous les liens peuvent se recalculer", () => {
    const g = new GestionnaireService();
    const auditeur = vi.fn();
    g.observer(auditeur);
    g.definir("spotify");
    expect(g.service).toBe("spotify");
    expect(auditeur).toHaveBeenCalledWith("spotify");
  });

  it("lienEcoute change selon le service, pour un artiste comme pour un album", () => {
    const artiste = lienEcoute("deezer", "Portishead");
    const album = lienEcoute("deezer", "Portishead", "Dummy");
    const spotifyArtiste = lienEcoute("spotify", "Portishead");
    expect(artiste).not.toBe(spotifyArtiste);
    expect(album).toContain("Dummy");
    expect(album).not.toBe(artiste);
  });

  it("lienEcoute ne rend jamais une chaine vide (F-26 : jamais une page vide)", () => {
    for (const s of SERVICES) {
      expect(lienEcoute(s, "Portishead").length).toBeGreaterThan(0);
    }
  });
});

describe("5 · sur ecran large, survoler une branche n'ecrase jamais le profil du centre (F-19)", () => {
  it("le profil du centre et l'apercu de survol sont DEUX conteneurs DOM distincts", () => {
    const conteneurFiche = document.createElement("div");
    const fiche = construireFiche(conteneurFiche, {
      nom: "Portishead",
      profil: { presentation: "Bio", genres: ["trip hop"], auditeurs: 100 },
      albums,
      extraits: [],
      service: new GestionnaireService(),
    });

    const conteneurApercu = document.createElement("div");
    construireApercuBranche(conteneurApercu, { nom: "Massive Attack" });

    expect(conteneurFiche.textContent).toContain("Portishead");
    expect(conteneurFiche.textContent).not.toContain("Massive Attack");
    expect(conteneurApercu.textContent).toContain("Massive Attack");
    expect(conteneurApercu).not.toBe(conteneurFiche);
    void fiche;
  });
});

describe("6 · le reclassement par appreciation est perceptible UNE seule fois (F-21)", () => {
  it("peindre deux fois avec les memes donnees ne recree pas les lignes ni ne rejoue l'animation", () => {
    const conteneur = document.createElement("div");
    peindreDiscographie(conteneur, albums, "tous");
    const lignesAvant = Array.from(conteneur.querySelectorAll(".discographie-album"));
    const classesAvant = lignesAvant.map((l) => l.className);

    peindreDiscographie(conteneur, albums, "tous");
    const lignesApres = Array.from(conteneur.querySelectorAll(".discographie-album"));

    expect(lignesApres).toHaveLength(lignesAvant.length);
    expect(lignesApres.map((l) => l.className)).toEqual(classesAvant);
  });

  it("la premiere peinture marque chaque ligne comme fraichement classee, une seule fois", () => {
    const conteneur = document.createElement("div");
    peindreDiscographie(conteneur, albums, "tous");
    const lignes = conteneur.querySelectorAll(".discographie-album");
    lignes.forEach((l) => expect(l.classList.contains("discographie-classee")).toBe(true));
  });
});

describe("7 · changer de service change TOUS les liens de la fiche (F-25)", () => {
  it("mettreAJourLiens recalcule le href de chaque album selon le service courant", () => {
    const conteneur = document.createElement("div");
    peindreDiscographie(conteneur, albums, "tous");

    mettreAJourLiens(conteneur, albums, "Portishead", "deezer");
    const hrefDeezer = conteneur.querySelector<HTMLAnchorElement>(".discographie-lien")!.href;

    mettreAJourLiens(conteneur, albums, "Portishead", "spotify");
    const hrefSpotify = conteneur.querySelector<HTMLAnchorElement>(".discographie-lien")!.href;

    expect(hrefDeezer).not.toBe(hrefSpotify);
  });

  it("chaque album porte son PROPRE lien (pas un lien unique partage)", () => {
    const conteneur = document.createElement("div");
    peindreDiscographie(conteneur, albums, "tous");
    mettreAJourLiens(conteneur, albums, "Portishead", "deezer");

    const liens = Array.from(conteneur.querySelectorAll<HTMLAnchorElement>(".discographie-lien"));
    const hrefs = liens.map((a) => a.href);
    expect(new Set(hrefs).size).toBe(liens.length);
  });
});

describe("8 · garder est disponible depuis la fiche, et n'interrompt rien (F-28, PRP 07)", () => {
  const profil = { presentation: "", genres: [], auditeurs: 0 };

  it("le bouton garder rapporte le geste a l'appelant, sans appel reseau ni etat propre", () => {
    const surBasculerGarde = vi.fn();
    const conteneur = document.createElement("div");
    construireFiche(conteneur, {
      nom: "Portishead",
      profil,
      albums: [],
      extraits: [],
      service: new GestionnaireService(),
      surBasculerGarde,
      dejaGarde: false,
    });

    const bouton = conteneur.querySelector<HTMLButtonElement>(".fiche-garder")!;
    expect(bouton.getAttribute("aria-pressed")).toBe("false");
    bouton.click();
    expect(surBasculerGarde).toHaveBeenCalledTimes(1);
  });

  it("sans surBasculerGarde, aucun bouton garder n'apparait (compatibilite)", () => {
    const conteneur = document.createElement("div");
    construireFiche(conteneur, { nom: "Portishead", profil, albums: [], extraits: [], service: new GestionnaireService() });
    expect(conteneur.querySelector(".fiche-garder")).toBeNull();
  });

  it("garder un artiste NE reinitialise PAS le lecteur d'extraits en cours (PRP 06, seul element a etat persistant)", () => {
    const conteneur = document.createElement("div");
    const panneau = construireFiche(conteneur, {
      nom: "Portishead",
      profil,
      albums: [],
      extraits: [{ titre: "Extrait", url: "https://x/1.mp3", duree: 30 }],
      service: new GestionnaireService(),
      surBasculerGarde: () => {},
      dejaGarde: false,
    });
    panneau.lecteur.jouer(0);
    expect(panneau.lecteur.enLecture).toBe(true);

    conteneur.querySelector<HTMLButtonElement>(".fiche-garder")!.click();

    expect(panneau.lecteur.enLecture).toBe(true);
    expect(panneau.lecteur.extraitCourant?.titre).toBe("Extrait");
  });

  it("actualiserGarde() reflete un changement d'etat externe sans reconstruire le panneau", () => {
    const conteneur = document.createElement("div");
    const panneau = construireFiche(conteneur, {
      nom: "Portishead",
      profil,
      albums: [],
      extraits: [],
      service: new GestionnaireService(),
      surBasculerGarde: () => {},
      dejaGarde: false,
    });
    panneau.actualiserGarde(true);
    const bouton = conteneur.querySelector<HTMLButtonElement>(".fiche-garder")!;
    expect(bouton.getAttribute("aria-pressed")).toBe("true");
  });
});

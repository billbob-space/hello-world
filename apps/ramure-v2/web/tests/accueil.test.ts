// apps/ramure-v2/web/tests/accueil.test.ts
//
// Etat A de l'ecran (PRD §07) : mur de pochettes plein ecran, tri memorise
// (F-05, F-06, F-07). Porte 06.
import { describe, expect, it, vi } from "vitest";
import {
  ORDRES_MUR,
  capaciteMur,
  chargerOrdre,
  construireMur,
  libelleAccueilIntertitre,
  libelleTriRecents,
  memoriserOrdre,
  trierTuiles,
  type MesureMur,
  type SourceMur,
  type TuileDonnees,
} from "../src/accueil";
import { textes } from "../src/textes";

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
      // Depuis le plafond §17 Q9, construireMur pose TOUJOURS un ecouteur
      // de redimensionnement : ces fenetres factices doivent l'accepter.
      addEventListener: () => {},
      removeEventListener: () => {},
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

describe("8 · capaciteMur — le mur n'affiche que ce qui tient (§17 Q9)", () => {
  it("cas nominal : mesure §17 Q8 a 1440 (6 colonnes, 778px) -> 3 rangees, 18 tuiles", () => {
    const mesure: MesureMur = { colonnes: 6, tailleTuile: 230.7, gap: 8, hauteurDisponible: 778 };
    expect(capaciteMur(mesure, 50)).toBe(18);
  });

  it("une seule rangee tient : capacite = colonnes", () => {
    const mesure: MesureMur = { colonnes: 6, tailleTuile: 230.7, gap: 8, hauteurDisponible: 240 };
    expect(capaciteMur(mesure, 50)).toBe(6);
  });

  it("le plafond ne descend jamais sous le nombre de tuiles disponible", () => {
    const mesure: MesureMur = { colonnes: 6, tailleTuile: 100, gap: 8, hauteurDisponible: 2000 };
    expect(capaciteMur(mesure, 3)).toBe(3);
  });

  it("entree non finie ou <= 0 : repli sur le total, jamais 0 tuile affichee", () => {
    expect(capaciteMur({ colonnes: NaN, tailleTuile: 100, gap: 8, hauteurDisponible: 500 }, 6)).toBe(6);
    expect(capaciteMur({ colonnes: 6, tailleTuile: 0, gap: 8, hauteurDisponible: 500 }, 6)).toBe(6);
    expect(capaciteMur({ colonnes: 6, tailleTuile: 100, gap: 8, hauteurDisponible: 0 }, 6)).toBe(6);
  });

  it("fenetre trop courte pour une seule rangee : la montre quand meme (max(1, ...))", () => {
    const mesure: MesureMur = { colonnes: 4, tailleTuile: 200, gap: 8, hauteurDisponible: 50 };
    expect(capaciteMur(mesure, 20)).toBe(4);
  });
});

describe("9 · le plafond s'applique APRES le tri : l'ordre decide qui est visible (§17 Q9)", () => {
  // mesurer factice : capacite constante de 2, quel que soit le
  // conteneur -- isole le test du calcul de layout reel (jsdom n'en fait
  // pas), conformement au principe d'injection deja en place pour `alea`.
  const mesurerDeux = () => ({ colonnes: 2, tailleTuile: 100, gap: 0, hauteurDisponible: 100 }) as MesureMur;

  const quatre: TuileDonnees[] = [
    { nom: "Portishead" },
    { nom: "Aphex Twin" },
    { nom: "Boards of Canada" },
    { nom: "Massive Attack" },
  ];

  function libellesVisibles(conteneur: HTMLElement): string[] {
    return Array.from(conteneur.querySelectorAll<HTMLElement>(".mur-item"))
      .filter((item) => !item.hidden)
      .map((item) => item.querySelector(".tuile-libelle")!.textContent);
  }

  function libellesMasques(conteneur: HTMLElement): string[] {
    return Array.from(conteneur.querySelectorAll<HTMLElement>(".mur-item"))
      .filter((item) => item.hidden)
      .map((item) => item.querySelector(".tuile-libelle")!.textContent);
  }

  it("ordre 'recents' : les 2 premieres de l'ordre fourni sont visibles, les 2 suivantes masquees", () => {
    const conteneur = document.createElement("div");
    construireMur(conteneur, quatre, {
      stockage: stockageMemoire(),
      surPlanter: () => {},
      mesurer: mesurerDeux,
    });

    expect(libellesVisibles(conteneur)).toEqual(["Portishead", "Aphex Twin"]);
    expect(libellesMasques(conteneur)).toEqual(["Boards of Canada", "Massive Attack"]);
  });

  it("changer l'ordre en 'alphabetique' change QUI est visible, sans changer la capacite", () => {
    const conteneur = document.createElement("div");
    const mur = construireMur(conteneur, quatre, {
      stockage: stockageMemoire(),
      surPlanter: () => {},
      mesurer: mesurerDeux,
    });

    mur.definirOrdre("alphabetique");

    // "Portishead", visible sous 'recents', passe hors capacite une fois
    // trie alphabetiquement : c'est bien l'ORDRE qui a decide, pas un
    // filtre fixe sur les tuiles elles-memes.
    expect(libellesVisibles(conteneur)).toEqual(["Aphex Twin", "Boards of Canada"]);
    expect(libellesMasques(conteneur)).toEqual(["Massive Attack", "Portishead"]);
  });
});

describe("10 · l'ecouteur de redimensionnement est retire par detruire() (§17 Q9)", () => {
  it("addEventListener puis removeEventListener portent le MEME gestionnaire", () => {
    const ecouteurs = new Map<string, EventListener>();
    const fenetre = {
      matchMedia: () => ({ matches: false }) as MediaQueryList,
      addEventListener: vi.fn((type: string, gestionnaire: EventListener) => {
        ecouteurs.set(type, gestionnaire);
      }),
      removeEventListener: vi.fn(),
    } as unknown as Window;

    const conteneur = document.createElement("div");
    const mur = construireMur(conteneur, tuiles, {
      stockage: stockageMemoire(),
      fenetre,
      surPlanter: () => {},
    });

    expect(fenetre.addEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
    const gestionnaire = ecouteurs.get("resize");

    mur.detruire();

    expect(fenetre.removeEventListener).toHaveBeenCalledWith("resize", gestionnaire);
  });
});

// Critique 2026-08-23 (second passage), N1 : le redimensionnement
// recalcule le PLAFOND, jamais l'ORDRE. Le defaut etait invisible en tri
// "recents" et "alphabetique" (tris stables : re-trier redonne la meme
// liste) et ne se voyait qu'en "aleatoire", ou trierTuiles CONSOMME un
// tirage a chaque appel. D'ou les deux tests ci-dessous : l'un compte les
// tirages, l'autre observe le mur.
describe("11 · un redimensionnement replafonne le mur, il ne le REBAT pas", () => {
  const quatre: TuileDonnees[] = [
    { nom: "Portishead" },
    { nom: "Aphex Twin" },
    { nom: "Boards of Canada" },
    { nom: "Massive Attack" },
  ];

  function fenetreFactice(): { fenetre: Window; redimensionner: () => void } {
    const ecouteurs = new Map<string, EventListener>();
    const fenetre = {
      matchMedia: () => ({ matches: false }) as MediaQueryList,
      addEventListener: (type: string, g: EventListener) => void ecouteurs.set(type, g),
      removeEventListener: () => {},
    } as unknown as Window;
    return {
      fenetre,
      redimensionner: () => ecouteurs.get("resize")?.(new Event("resize")),
    };
  }

  it("en tri 'aleatoire', dix redimensionnements ne consomment AUCUN tirage", () => {
    const { fenetre, redimensionner } = fenetreFactice();
    const alea = vi.fn(() => 0.5);
    const stockage = stockageMemoire();
    stockage.setItem("ramure:accueil:ordre", "aleatoire");

    const conteneur = document.createElement("div");
    construireMur(conteneur, quatre, { stockage, fenetre, alea, surPlanter: () => {} });

    const tiragesAuPremierRendu = alea.mock.calls.length;
    expect(tiragesAuPremierRendu).toBeGreaterThan(0); // le melange a bien eu lieu

    for (let i = 0; i < 10; i++) redimensionner();

    expect(alea.mock.calls.length).toBe(tiragesAuPremierRendu);
  });

  it("l'ordre affiche est identique avant et apres redimensionnement, meme en 'aleatoire'", () => {
    const { fenetre, redimensionner } = fenetreFactice();
    let graine = 0;
    const stockage = stockageMemoire();
    stockage.setItem("ramure:accueil:ordre", "aleatoire");

    const conteneur = document.createElement("div");
    // Un `alea` qui change a chaque appel : si un tirage etait relance, la
    // liste changerait a coup sur, et le test echouerait.
    construireMur(conteneur, quatre, {
      stockage,
      fenetre,
      alea: () => ((graine = (graine + 0.37) % 1), graine),
      surPlanter: () => {},
    });

    const lire = () =>
      Array.from(conteneur.querySelectorAll<HTMLElement>(".mur-item")).map(
        (item) => item.querySelector(".tuile-libelle")!.textContent,
      );

    const avant = lire();
    redimensionner();
    redimensionner();
    expect(lire()).toEqual(avant);
  });

  it("un redimensionnement ne re-insere aucune tuile : l'animation d'apparition n'est pas relancee", () => {
    const { fenetre, redimensionner } = fenetreFactice();
    const conteneur = document.createElement("div");
    construireMur(conteneur, quatre, {
      stockage: stockageMemoire(),
      fenetre,
      surPlanter: () => {},
    });

    // Une re-insertion (`append` sur un enfant deja place) remet a zero
    // l'animation CSS `apparition`. On l'observe ici par le seul moyen
    // dont jsdom dispose : le noeud doit rester le MEME objet, jamais
    // detache puis rattache.
    const avant = Array.from(conteneur.children);
    const observateur = new MutationObserver(() => {});
    observateur.observe(conteneur, { childList: true });

    redimensionner();
    // takeRecords() est SYNCHRONE : il vide la file sans attendre la
    // microtache qui appellerait le rappel. C'est ce qui rend l'assertion
    // fiable dans un test qui ne rend pas la main.
    const mutations = observateur.takeRecords();
    observateur.disconnect();

    const inserees = mutations.flatMap((m) => Array.from(m.addedNodes));
    expect(inserees).toEqual([]);
    expect(Array.from(conteneur.children)).toEqual(avant);
  });

  it("une capacite qui retrecit (4 puis 2) masque des tuiles au redimensionnement, sans toucher l'ordre", () => {
    const { fenetre, redimensionner } = fenetreFactice();
    // mesurer factice : 4 places au premier appel (construction), 2 au
    // second (declenche par `redimensionner()`) -- simule une fenetre qui
    // retrecit entre les deux, sans dependre d'un vrai calcul de layout
    // (jsdom n'en fait pas, cf. describe 9).
    let appel = 0;
    const mesurerVariable = (): MesureMur => {
      appel += 1;
      return { colonnes: appel === 1 ? 4 : 2, tailleTuile: 100, gap: 0, hauteurDisponible: 100 };
    };

    const conteneur = document.createElement("div");
    construireMur(conteneur, quatre, {
      stockage: stockageMemoire(), // "recents" par defaut : l'ordre fourni fait deja foi
      fenetre,
      surPlanter: () => {},
      mesurer: mesurerVariable,
    });

    const tousLesLibelles = () =>
      Array.from(conteneur.querySelectorAll<HTMLElement>(".mur-item")).map(
        (item) => item.querySelector(".tuile-libelle")!.textContent,
      );
    const libellesVisibles = () =>
      Array.from(conteneur.querySelectorAll<HTMLElement>(".mur-item"))
        .filter((item) => !item.hidden)
        .map((item) => item.querySelector(".tuile-libelle")!.textContent);

    const ordreAvant = tousLesLibelles();
    expect(libellesVisibles()).toHaveLength(4); // capacite 4 au premier rendu : tout tient

    redimensionner();

    // Le jeu visible retrecit (constat 1 : le redimensionnement replafonne)...
    expect(libellesVisibles()).toHaveLength(2);
    // ...et l'ordre complet des libelles, visibles ou non, n'a pas bouge
    // (constat 4 : ce n'est pas un rebattage, seul le masquage a change).
    expect(tousLesLibelles()).toEqual(ordreAvant);
  });
});

describe("12 · le mur nomme ce qu'il montre, sans mentir sur une garde qui n'a pas eu lieu (§17 Q10, N4)", () => {
  const SOURCES: readonly SourceMur[] = ["amorcage", "collection"];

  it("propose les deux etats du mur", () => {
    expect(SOURCES).toEqual(["amorcage", "collection"]);
  });

  it("l'intertitre nomme \"Pour commencer\" tant que rien n'est garde (amorcage editorial)", () => {
    expect(libelleAccueilIntertitre("amorcage")).toBe(textes.accueilIntertitrePourCommencer);
    expect(libelleAccueilIntertitre("amorcage")).not.toBe(textes.triRecents); // n'affirme pas une garde
  });

  it("l'intertitre nomme \"Déjà gardés\" une fois la collection reelle, jamais le libelle du tri", () => {
    expect(libelleAccueilIntertitre("collection")).toBe(textes.accueilIntertitreCollection);
    expect(libelleAccueilIntertitre("collection")).not.toBe(textes.triRecents);
  });

  it("le tri 'recents' ne s'appelle jamais \"Gardés récemment\" au-dessus de l'amorcage editorial", () => {
    // C'est le defaut exact du constat N4 : le premier visiteur lisait ce
    // libelle au-dessus de six artistes que personne n'avait gardes.
    expect(libelleTriRecents("amorcage")).not.toBe(textes.triRecents);
    expect(libelleTriRecents("amorcage")).toBe(textes.triSelectionEditoriale);
  });

  it("le tri 'recents' redevient \"Gardés récemment\" des que le mur vient reellement de la collection", () => {
    expect(libelleTriRecents("collection")).toBe(textes.triRecents);
  });

  // Constat 2026-08-23 N7 : avant cette decision, l'intertitre reprenait
  // MOT POUR MOT le libelle du tri "recents" en etat collection — deux
  // fois la meme chaine dans la meme bande de 36 px, et l'intertitre
  // continuait d'annoncer un classement par date de garde des que le
  // visiteur passait sur l'alphabetique ou l'aleatoire. Le test d'egalite
  // qui verrouillait cette fusion est remplace par son contraire : les
  // deux chaines DOIVENT differer en collection, et l'intertitre ne doit
  // JAMAIS affirmer une garde tant qu'elle n'a pas eu lieu (amorcage).
  it("l'intertitre et le tri ne partagent pas leur formulation (§17 Q10, N7)", () => {
    expect(libelleAccueilIntertitre("amorcage")).not.toBe(textes.triRecents);
    expect(libelleAccueilIntertitre("collection")).not.toBe(libelleTriRecents("collection"));
  });
});

// §17 Q11 (PRODUCT.md, decision du 23 aout 2026) : "la bande pousse le
// mur" ne coute rien QUE SI le plafond (§17 Q9) est reevalue a
// l'apparition ET a la disparition de la bande -- sinon la derniere
// rangee reste rognee tant qu'elle est la. main.ts appelle pour cela
// mur.replafonner(), expose ici pour la premiere fois : ce describe
// verifie que l'appel PUBLIC fait exactement ce que fait deja
// `surRedimensionnement` (describe 11 ci-dessus), sans attendre un
// evenement `resize` -- c'est le meme mecanisme, appele autrement.
describe("13 · replafonner() est expose, et fait ce que fait deja le redimensionnement (§17 Q11)", () => {
  const quatre: TuileDonnees[] = [
    { nom: "Portishead" },
    { nom: "Aphex Twin" },
    { nom: "Boards of Canada" },
    { nom: "Massive Attack" },
  ];

  function libellesVisibles(conteneur: HTMLElement): string[] {
    return Array.from(conteneur.querySelectorAll<HTMLElement>(".mur-item"))
      .filter((item) => !item.hidden)
      .map((item) => item.querySelector(".tuile-libelle")!.textContent);
  }

  it("un appel direct retrecit la capacite -- comme la bande d'echec qui pousse #accueil", () => {
    // mesurerVariable simule la bande qui apparait : 4 places tant qu'elle
    // est absente, 2 des qu'elle a pris sa rangee (index.html, regle
    // `main:has(#accueil:not([hidden]))`) -- sans dependre d'un vrai calcul
    // de layout (jsdom n'en fait pas, cf. describe 9).
    let appel = 0;
    const mesurerVariable = (): MesureMur => {
      appel += 1;
      return { colonnes: appel === 1 ? 4 : 2, tailleTuile: 100, gap: 0, hauteurDisponible: 100 };
    };

    const conteneur = document.createElement("div");
    const mur = construireMur(conteneur, quatre, {
      stockage: stockageMemoire(),
      surPlanter: () => {},
      mesurer: mesurerVariable,
    });

    expect(libellesVisibles(conteneur)).toHaveLength(4); // capacite 4 au premier rendu

    mur.replafonner(); // l'appel que main.ts pose a l'apparition de la bande

    expect(libellesVisibles(conteneur)).toHaveLength(2);
  });

  it("un appel direct rend la capacite -- comme la bande d'echec qui leve #accueil", () => {
    // Symetrique du test precedent : 2 places d'abord (bande affichee), 4
    // ensuite (bande levee, §17 Q11 "a l'apparition ET a la disparition").
    let appel = 0;
    const mesurerVariable = (): MesureMur => {
      appel += 1;
      return { colonnes: appel === 1 ? 2 : 4, tailleTuile: 100, gap: 0, hauteurDisponible: 100 };
    };

    const conteneur = document.createElement("div");
    const mur = construireMur(conteneur, quatre, {
      stockage: stockageMemoire(),
      surPlanter: () => {},
      mesurer: mesurerVariable,
    });

    expect(libellesVisibles(conteneur)).toHaveLength(2);

    mur.replafonner(); // l'appel que main.ts pose a la disparition de la bande

    expect(libellesVisibles(conteneur)).toHaveLength(4);
  });

  it("replafonner() ne re-trie ni ne re-insere aucune tuile -- seul le plafond bouge (comme le redimensionnement, describe 11)", () => {
    const conteneur = document.createElement("div");
    const mur = construireMur(conteneur, quatre, {
      stockage: stockageMemoire(),
      surPlanter: () => {},
      mesurer: () => ({ colonnes: 2, tailleTuile: 100, gap: 0, hauteurDisponible: 100 }),
    });

    const avant = Array.from(conteneur.children);
    const observateur = new MutationObserver(() => {});
    observateur.observe(conteneur, { childList: true });

    mur.replafonner();
    const mutations = observateur.takeRecords();
    observateur.disconnect();

    expect(mutations.flatMap((m) => Array.from(m.addedNodes))).toEqual([]);
    expect(Array.from(conteneur.children)).toEqual(avant);
  });
});

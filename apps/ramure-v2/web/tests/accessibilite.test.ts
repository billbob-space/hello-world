// apps/ramure-v2/web/tests/accessibilite.test.ts
//
// PRP 08, tache 1 : parite stricte des dispositions et WCAG 2.2 AA sans
// exception sur l'ecran principal (§07, §12, M-08). Les onze tests
// annonces par le PRP, dans l'ordre.
//
// Ce fichier tourne sur DOM SIMULE (jsdom) : il attrape les intitules en
// double, l'ordre de tabulation et les proprietes structurelles — jamais
// le recouvrement visuel reel ni le zoom des illustrations (PRP 09, "ce
// que la suite attend de vous" n°1). Les mesures reelles (contrastes,
// tailles de cible en pixels, parcours clavier effectif) sont documentees
// dans le rapport de chantier, prises dans un vrai navigateur
// (Playwright), jamais reproduites ici.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { construireMur, type TuileDonnees } from "../src/accueil";
import { cablerActivation, creerGroupes, dessinerNoeud, repliCouleur, type NoeudDessine } from "../src/canevas";
import { construireCollection } from "../src/collection";
import {
  GestionnaireService,
  SERVICES,
  construireApercuBranche,
  construireFiche,
} from "../src/fiche";
import { TAILLE_PASTILLE, placerBranches, rayonPour, taillePour, type Anneau } from "../src/geometrie";
import { textes } from "../src/textes";

// ---------------------------------------------------------------------
// Fixture : la VRAIE page (index.html), jamais une reconstruction a la
// main qui divergerait sans bruit de ce que le navigateur sert vraiment.
// main.ts n'est pas importe (PRP 05 : "n'est PAS teste unitairement") —
// chaque brique qu'il assemble l'est deja ; ce fichier reproduit UNIQUEMENT
// les quelques affectations statiques (aria-label depuis textes.ts) que
// main.ts pose au demarrage, pour tester l'ecran tel qu'il apparait
// vraiment a l'utilisateur.
// ---------------------------------------------------------------------

function construireDocument(): void {
  const chemin = resolve(process.cwd(), "index.html");
  const html = readFileSync(chemin, "utf-8");
  const corps = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? "";
  document.body.innerHTML = corps.replace(/<script[\s\S]*?<\/script>/g, "");
}

function etiqueterCommandesStatiques(): void {
  const logo = document.querySelector<HTMLElement>("#logo");
  logo?.setAttribute("aria-label", textes.retourAccueil);
  const remonter = document.querySelector<HTMLElement>("#remonter-lignee");
  remonter?.setAttribute("aria-label", textes.remonterLaLignee);
  const accueil = document.querySelector<HTMLElement>("#accueil");
  accueil?.setAttribute("aria-label", textes.accueilTitre);
  const collection = document.querySelector<HTMLElement>("#collection-bouton");
  if (collection) {
    collection.textContent = "♥";
    collection.setAttribute("aria-label", textes.collectionOuvrir);
  }
  const partager = document.querySelector<HTMLElement>("#partager");
  if (partager) {
    partager.textContent = "⇪";
    partager.setAttribute("aria-label", textes.partagerLien);
  }
}

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

/** nomAccessible calcule un nom accessible SUFFISANT pour ce produit
 * (aria-label, aria-labelledby, ou texte visible d'un bouton/lien) — pas
 * un moteur complet de la specification "Accessible Name and
 * Description" (inutile ici : aucun controle de l'app ne s'appuie sur
 * alt/title/placeholder pour son nom). */
function nomAccessible(el: Element): string | null {
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

  const labelledby = el.getAttribute("aria-labelledby");
  if (labelledby) {
    const texte = labelledby
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
      .join(" ")
      .trim();
    if (texte) return texte;
  }

  if (el.tagName === "BUTTON" || el.tagName === "A" || el.getAttribute("role") === "button") {
    const texte = el.textContent?.trim();
    if (texte) return texte;
  }

  return null;
}

/** estVisible : un element (ou un de ses ancetres) porte `hidden` ou
 * `aria-hidden="true"` est invisible/absent de l'arbre d'accessibilite —
 * exactement ce que `[hidden] { display:none !important; }`
 * (index.html) traduit visuellement, et ce qu'une technologie
 * d'assistance respecte de son cote. */
function estVisible(el: Element): boolean {
  let n: Element | null = el;
  while (n) {
    if (n.hasAttribute("hidden") || n.getAttribute("aria-hidden") === "true") return false;
    n = n.parentElement;
  }
  return true;
}

const tuiles: TuileDonnees[] = [{ nom: "Portishead" }, { nom: "Boards of Canada" }];

function peuplerMur(): void {
  const conteneur = document.querySelector<HTMLElement>("#mur");
  if (!conteneur) return;
  construireMur(conteneur, tuiles, { stockage: stockageMemoire(), surPlanter: () => {} });
}

function peuplerCanevas(): NoeudDessine[] {
  const svg = document.querySelector<SVGSVGElement>("#canevas");
  if (!svg) return [];
  const groupes = creerGroupes(svg);
  const centre = dessinerNoeud(svg, groupes, { id: "centre", nom: "Aphex Twin", x: 0, y: 0, r: 60 });
  const b1 = dessinerNoeud(svg, groupes, { id: "b1", nom: "Squarepusher", x: 200, y: 0, r: 30 });
  const b2 = dessinerNoeud(svg, groupes, { id: "b2", nom: "Autechre", x: -200, y: 0, r: 25 });
  const h1 = dessinerNoeud(svg, groupes, { id: "h1", nom: "Venetian Snares", x: 220, y: 20, r: 14 });
  return [centre, b1, b2, h1];
}

function peuplerFiche(): void {
  const el = document.querySelector<HTMLElement>("#fiche");
  if (!el) return;
  construireFiche(el, {
    nom: "Aphex Twin",
    profil: { presentation: "", genres: [], auditeurs: 0 },
    albums: [],
    extraits: [],
    service: new GestionnaireService(),
    dejaGarde: false,
    surBasculerGarde: () => {},
  });
}

function peuplerApercu(): void {
  const el = document.querySelector<HTMLElement>("#apercu-branche");
  if (el) construireApercuBranche(el, { nom: "Squarepusher" });
}

function peuplerCollection(): void {
  const el = document.querySelector<HTMLElement>("#collection");
  if (!el) return;
  construireCollection(el, {
    entrees: [{ nom: "Boards of Canada", mbid: "m1", ajoute: new Date().toISOString() }],
    surReplanter: () => {},
    surRetirer: () => {},
  });
}

function peuplerServiceEtTri(): void {
  const service = document.querySelector<HTMLSelectElement>("#service");
  if (service) {
    for (const s of SERVICES) {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = textes.service[s];
      service.append(opt);
    }
  }
}

/** Etat B (§07) : une graine plantee — canevas, fiche, apercu et
 * collection peuvent tous etre peints ; #accueil reste `hidden` (valeur
 * par defaut du markup). */
function construireEtatCanevas(): NoeudDessine[] {
  construireDocument();
  etiqueterCommandesStatiques();
  peuplerServiceEtTri();
  const noeuds = peuplerCanevas();
  peuplerFiche();
  peuplerApercu();
  peuplerCollection();
  return noeuds;
}

/** Etat A (§07) : l'accueil, aucune graine plantee — le canevas est
 * masque comme le fait masquerAccueil()/afficherAccueil() (main.ts). */
function construireEtatAccueil(): void {
  construireDocument();
  etiqueterCommandesStatiques();
  peuplerServiceEtTri();
  peuplerMur();
  document.querySelector("#accueil")?.removeAttribute("hidden");
  document.querySelector("#canevas")?.setAttribute("hidden", "");
}

// ---------------------------------------------------------------------
// 1 · un seul champ de recherche dans le document, a toute largeur
// ---------------------------------------------------------------------

describe("1 · un seul champ de recherche dans le document, a toute largeur (320 -> 2560px, pas de 40)", () => {
  it("une seule instance du champ de recherche et du formulaire \"search\", quelle que soit innerWidth simulee", () => {
    construireEtatCanevas();
    for (let largeur = 320; largeur <= 2560; largeur += 40) {
      Object.defineProperty(window, "innerWidth", { value: largeur, configurable: true });
      window.dispatchEvent(new Event("resize"));

      expect(document.querySelectorAll('input[role="combobox"]').length, `largeur=${largeur}`).toBe(1);
      expect(document.querySelectorAll('form[role="search"]').length, `largeur=${largeur}`).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------
// 2 · aucun intitule accessible en double, aux deux dispositions
// ---------------------------------------------------------------------

function nomsEnDouble(): Array<[string, number]> {
  const candidats = Array.from(
    document.querySelectorAll('button, a[href], [role="button"], select'),
  ).filter(estVisible);
  const noms = candidats.map(nomAccessible).filter((n): n is string => Boolean(n));
  const comptes = new Map<string, number>();
  for (const nom of noms) comptes.set(nom, (comptes.get(nom) ?? 0) + 1);
  return [...comptes.entries()].filter(([, n]) => n > 1);
}

describe("2 · aucun intitule accessible en double, aux deux dispositions", () => {
  it("etat B (canevas + fiche + apercu + collection peints) : aucun doublon, a 375px puis a 1280px", () => {
    for (const largeur of [375, 1280]) {
      construireEtatCanevas();
      Object.defineProperty(window, "innerWidth", { value: largeur, configurable: true });
      const doublons = nomsEnDouble();
      expect(doublons, `largeur=${largeur} etat=canevas doublons=${JSON.stringify(doublons)}`).toEqual([]);
    }
  });

  it("etat A (accueil, mur de tuiles) : aucun doublon, a 375px puis a 1280px", () => {
    for (const largeur of [375, 1280]) {
      construireEtatAccueil();
      Object.defineProperty(window, "innerWidth", { value: largeur, configurable: true });
      const doublons = nomsEnDouble();
      expect(doublons, `largeur=${largeur} etat=accueil doublons=${JSON.stringify(doublons)}`).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------
// 3 · chaque noeud est activable au clavier, avec le meme resultat qu'au
// clic (F-11) — cablerActivation est deja couvert en detail par
// canevas.test.ts ; ce test verifie le meme contrat depuis une scene
// construite comme le fait main.ts (dessinerNoeud + cablerActivation).
// ---------------------------------------------------------------------

describe("3 · chaque noeud est activable au clavier, meme resultat qu'au clic (F-11)", () => {
  it("Entree active le noeud exactement comme un clic", () => {
    const noeuds = construireEtatCanevas();
    const branche = noeuds[1]!; // Squarepusher
    const gestionnaire = vi.fn();
    cablerActivation(branche, gestionnaire);

    branche.groupe.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    branche.groupe.dispatchEvent(new MouseEvent("click"));

    expect(gestionnaire).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------
// 4 · chaque noeud porte le nom complet de l'artiste comme intitule
// accessible
// ---------------------------------------------------------------------

describe("4 · chaque noeud porte le nom complet de l'artiste comme intitule accessible", () => {
  it("jamais une initiale, un identifiant ou une position", () => {
    const noeuds = construireEtatCanevas();
    const attendus = ["Aphex Twin", "Squarepusher", "Autechre", "Venetian Snares"];
    noeuds.forEach((n, i) => {
      expect(n.groupe.getAttribute("aria-label")).toBe(attendus[i]);
      expect(n.groupe.getAttribute("aria-label")).not.toMatch(/^[A-Z]\.?$/); // pas une initiale
      expect(n.groupe.getAttribute("aria-label")).not.toBe(n.id); // pas l'identifiant interne
      expect(n.groupe.getAttribute("aria-label")).not.toMatch(/^\d+$/); // pas une position
    });
  });
});

// ---------------------------------------------------------------------
// 5 · le changement de centre est annonce (region aria-live="polite")
// ---------------------------------------------------------------------

describe("5 · le changement de centre est annonce", () => {
  it("#etat porte role=status et aria-live=polite dans le document reel", () => {
    construireEtatCanevas();
    const etat = document.querySelector("#etat");
    expect(etat?.getAttribute("role")).toBe("status");
    expect(etat?.getAttribute("aria-live")).toBe("polite");
  });

  it("annoncerNouveauCentre (promotion.ts, cablee par main.ts) ecrit le nom du nouveau centre dans CET element", async () => {
    const { annoncerNouveauCentre } = await import("../src/promotion");
    construireEtatCanevas();
    const etat = document.querySelector<HTMLElement>("#etat")!;

    annoncerNouveauCentre(etat, "Boards of Canada", (fn) => fn());

    expect(etat.textContent).toBe(textes.annonceNouveauCentre("Boards of Canada"));
  });
});

// ---------------------------------------------------------------------
// 6 · quitter l'exploration et remonter d'un cran ont des intitules
// distincts
// ---------------------------------------------------------------------

describe("6 · quitter l'exploration et remonter d'un cran ont des intitules distincts", () => {
  it("intitules et glyphes differents entre #logo (quitter) et #remonter-lignee (remonter)", () => {
    construireEtatCanevas();
    const logo = document.querySelector<HTMLElement>("#logo")!;
    const remonter = document.querySelector<HTMLElement>("#remonter-lignee")!;

    expect(logo.getAttribute("aria-label")).toBe(textes.retourAccueil);
    expect(remonter.getAttribute("aria-label")).toBe(textes.remonterLaLignee);
    expect(logo.getAttribute("aria-label")).not.toBe(remonter.getAttribute("aria-label"));
    expect(logo.textContent).not.toBe(remonter.textContent);
  });

  it("\"remonter d'un cran\" est masque tant qu'aucune lignee n'existe (rien vers quoi remonter)", () => {
    construireEtatCanevas();
    expect(document.querySelector("#remonter-lignee")?.hasAttribute("hidden")).toBe(true);
  });
});

// ---------------------------------------------------------------------
// 7 · les cibles tactiles font au moins 24x24px, y compris les commandes
// de zoom et le plus petit noeud, aux deux dispositions — les noeuds du
// canevas sont verifies en detail par canevas.test.ts (ajusterZoneTactile
// a ECHELLE_MIN) ; ce test-ci couvre les commandes HTML de la barre,
// declarees en CSS statique (index.html).
// ---------------------------------------------------------------------

function minPx(style: string, selecteurEchappe: string, propriete: "min-height" | "min-width"): number {
  const bloc = style.match(new RegExp(`${selecteurEchappe}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
  const valeur = bloc.match(new RegExp(`${propriete}:\\s*([\\d.]+)rem`))?.[1];
  expect(valeur, `${propriete} de ${selecteurEchappe} introuvable ou pas en rem`).toBeTruthy();
  return Number(valeur) * 16; // 1rem = 16px (aucune regle ne redefinit la racine, index.html)
}

describe("7 · les cibles tactiles font au moins 24x24px (commandes HTML de la barre)", () => {
  it("boutons de zoom, partage, collection et \"remonter d'un cran\" declarent >= 24px en CSS", () => {
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf-8");
    const style = html.match(/<style>([\s\S]*)<\/style>/)?.[1] ?? "";

    for (const [selecteur, prop] of [
      ["#recherche button, \\.camera button", "min-height"],
      ["#recherche button, \\.camera button", "min-width"],
      ["\\.partager", "min-height"],
      ["\\.partager", "min-width"],
      ["\\.precedent", "min-height"],
      ["\\.precedent", "min-width"],
    ] as const) {
      expect(minPx(style, selecteur, prop)).toBeGreaterThanOrEqual(24);
    }
  });
});

// ---------------------------------------------------------------------
// 8 · l'ordre de tabulation suit la logique de lecture, pas l'ordre de
// rendu
// ---------------------------------------------------------------------

describe("8 · l'ordre de tabulation suit la logique de lecture (clockwise depuis midi), pas l'ordre de rendu", () => {
  it("les noeuds dessines DANS L'ORDRE de placerBranches() restent dans cet ordre dans le DOM, et l'angle ne decroit jamais", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGSVGElement;
    document.body.append(svg);
    const groupes = creerGroupes(svg);
    const ANNEAU: Anneau = { rayonMin: 150, rayonMax: 420 };
    const affinites = [0.9, 0.2, 0.6, 0.4, 0.8]; // ordre SERVEUR (affinite), PAS l'ordre angulaire
    const positions = placerBranches(affinites.length, ANNEAU, affinites);

    // dessinerEntourage (main.ts) appelle dessinerNoeud dans l'ORDRE DU
    // TABLEAU RECU du serveur — reproduit ici a l'identique.
    positions.forEach((pos, i) => {
      dessinerNoeud(svg, groupes, { id: `b${i}`, nom: `Artiste ${i}`, x: pos.x, y: pos.y, r: pos.r });
    });

    const dansLeDOM = Array.from(svg.querySelectorAll(".noeud"));
    expect(dansLeDOM.map((n) => n.getAttribute("data-id"))).toEqual(positions.map((_, i) => `b${i}`));

    // Angle normalise pour que 0 = midi (haut), croissant dans le sens
    // horaire — memes conventions que geometrie.placerBranches().
    const angles = dansLeDOM.map((n) => {
      const cx = Number(n.querySelector("circle")!.getAttribute("cx"));
      const cy = Number(n.querySelector("circle")!.getAttribute("cy"));
      return (Math.atan2(cy, cx) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
    });
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i]!, `angle[${i}]=${angles[i]} < angle[${i - 1}]=${angles[i - 1]}`).toBeGreaterThanOrEqual(
        angles[i - 1]! - 1e-9,
      );
    }
  });
});

// ---------------------------------------------------------------------
// 9 · les panneaux et fenetres sont titres, meme sans titre visible
// ---------------------------------------------------------------------

describe("9 · les panneaux et fenetres sont titres, meme sans titre visible", () => {
  it("fiche, collection, apercu de branche et accueil portent tous un aria-label non vide", () => {
    construireEtatCanevas();
    for (const id of ["#fiche", "#collection", "#apercu-branche", "#accueil"]) {
      const el = document.querySelector(id);
      expect(el, id).not.toBeNull();
      expect(el!.getAttribute("aria-label")?.trim(), id).toBeTruthy();
    }
  });

  it("le formulaire de recherche est titre (role=search + aria-label)", () => {
    construireDocument();
    const formulaire = document.querySelector('form[role="search"]');
    expect(formulaire?.getAttribute("aria-label")?.trim()).toBeTruthy();
  });
});

// ---------------------------------------------------------------------
// 10 · un lien d'evitement mene au contenu principal
// ---------------------------------------------------------------------

describe("10 · un lien d'evitement mene au contenu principal", () => {
  it("l'evitement pointe vers l'id du <main>, qui existe reellement", () => {
    construireDocument();
    const evitement = document.querySelector<HTMLAnchorElement>(".evitement");
    const main = document.querySelector("main");
    expect(evitement?.getAttribute("href")).toBe(`#${main?.id}`);
    expect(main?.id).toBeTruthy();
    expect(document.getElementById(main!.id)).toBe(main);
  });
});

// ---------------------------------------------------------------------
// 11 · aucune information n'est portee par la couleur seule
// ---------------------------------------------------------------------

describe("11 · aucune information n'est portee par la couleur seule (l'affinite se lit par distance et taille, jamais par la teinte)", () => {
  it("l'affinite reste perceptible sans couleur : rayon et taille varient de facon monotone (F-09, deja couvert en detail par geometrie.test.ts)", () => {
    const ANNEAU: Anneau = { rayonMin: 150, rayonMax: 420 };
    expect(rayonPour(0.9, ANNEAU)).toBeLessThan(rayonPour(0.1, ANNEAU));
    expect(taillePour(0.9, TAILLE_PASTILLE)).toBeGreaterThan(taillePour(0.1, TAILLE_PASTILLE));
  });

  it("repliCouleur ne recoit meme pas l'affinite en parametre : la couleur encode l'IDENTITE, jamais l'affinite", () => {
    expect(repliCouleur.length).toBe(1); // une seule entree possible : le nom
    expect(repliCouleur("Aphex Twin")).toBe(repliCouleur("Aphex Twin"));
  });
});

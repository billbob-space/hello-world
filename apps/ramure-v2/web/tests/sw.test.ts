// apps/ramure-v2/web/tests/sw.test.ts
//
// Porte N-11, N-12, F-42 (PRP 08, tache 2). jsdom n'implemente ni
// ServiceWorkerGlobalScope ni Cache Storage a l'execution : ce fichier ne
// teste donc QUE la DECISION DE ROUTAGE (quelle requete va au reseau,
// laquelle passe par le cache) — pure, sans DOM ni reseau. La mecanique
// de cache elle-meme (installation, mise a jour, hors ligne reel) est
// verifiee dans un vrai navigateur (voir le rapport de chantier : mesures
// Playwright + PRP 09).
import { describe, expect, it } from "vitest";
import { estAppelAPI, estIllustration, estStatique } from "../src/sw";

// estAppelAPI/estStatique comparent a `self.location.origin`, qui vaut
// l'origine du document jsdom courant (window.location.origin) — jamais
// un domaine invente, sous peine de fausser justement ce que ces
// fonctions verifient.
const ORIGINE = window.location.origin;

describe("estAppelAPI (le piege du PRP : /api/... n'est JAMAIS mis en cache)", () => {
  it("est vrai pour /api/centre", () => {
    expect(estAppelAPI(new URL(`${ORIGINE}/api/centre?nom=Portishead`))).toBe(true);
  });
  it("est vrai pour /api/collection", () => {
    expect(estAppelAPI(new URL(`${ORIGINE}/api/collection`))).toBe(true);
  });
  it("est faux pour la page d'accueil", () => {
    expect(estAppelAPI(new URL(`${ORIGINE}/`))).toBe(false);
  });
  it("est faux pour un domaine tiers qui ressemblerait a /api/", () => {
    expect(estAppelAPI(new URL("https://evil.test/api/centre"))).toBe(false);
  });
});

function requeteImage(url: string): Request {
  return { url, destination: "image", method: "GET" } as unknown as Request;
}

describe("estIllustration", () => {
  it("est vrai pour une requete dont la destination est \"image\", meme hors domaine (Cover Art Archive, Deezer)", () => {
    expect(estIllustration(requeteImage("https://coverartarchive.org/release/x/front.jpg"))).toBe(true);
  });
  it("est faux pour une requete JSON (destination vide)", () => {
    const requete = { url: `${ORIGINE}/api/centre`, destination: "", method: "GET" } as unknown as Request;
    expect(estIllustration(requete)).toBe(false);
  });
});

describe("estStatique (la coquille de l'app, jamais un domaine tiers)", () => {
  it("est vrai pour la page d'accueil \"/\"", () => {
    expect(estStatique(new URL(`${ORIGINE}/`))).toBe(true);
  });
  it("est vrai pour /dist/app.js", () => {
    expect(estStatique(new URL(`${ORIGINE}/dist/app.js`))).toBe(true);
  });
  it("est faux pour /api/centre (jamais mis en cache, voir estAppelAPI)", () => {
    expect(estStatique(new URL(`${ORIGINE}/api/centre`))).toBe(false);
  });
  it("est faux pour un domaine tiers", () => {
    expect(estStatique(new URL("https://coverartarchive.org/release/x/front.jpg"))).toBe(false);
  });
});

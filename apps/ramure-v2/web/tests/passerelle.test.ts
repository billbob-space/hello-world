// apps/ramure-v2/web/tests/passerelle.test.ts
//
// Couche reseau extraite de main.ts (revue PRP 06, constat 1 : la couverture
// navigateur laissait chargerReglageServeur, alors livre et fonctionnel,
// sans AUCUN test — vitest ou Playwright — pour le retenir au prochain
// refactoring). Chaque fonction est exercee avec un double de fetch : cas
// nominal, panne reseau (fetch qui rejette), session expiree (F-41, quand
// applicable) et reponse malformee.
import { afterEach, describe, expect, it, vi } from "vitest";
import { EN_TETE_SESSION } from "../src/session";
import {
  ajouterALaCollection,
  chargerCentre,
  chargerCollectionServeur,
  chargerFiche,
  chargerReglageServeur,
  chargerSuggestions,
  enTetesJSON,
  retirerDeLaCollection,
  type CentreAPI,
} from "../src/passerelle";

const SESSION = "session-de-test";
const ORIGINE = window.location.origin;

/** reponseJSON() fabrique un double minimal du sous-ensemble de Response
 * dont passerelle.ts a besoin : jamais un vrai fetch(), jamais jsdom, pour
 * que ces tests restent rapides et deterministes (meme discipline que
 * session.test.ts). */
function reponseJSON(
  corps: unknown,
  options: { ok?: boolean; redirected?: boolean; url?: string; contentType?: string } = {},
): Response {
  const {
    ok = true,
    redirected = false,
    url = `${ORIGINE}/api/quelque-chose`,
    contentType = "application/json",
  } = options;
  return {
    ok,
    redirected,
    url,
    type: "basic",
    headers: { get: (nom: string) => (nom.toLowerCase() === "content-type" ? contentType : null) },
    json: async () => corps,
  } as unknown as Response;
}

function reponseMalformee(): Response {
  return {
    ok: true,
    redirected: false,
    url: `${ORIGINE}/api/quelque-chose`,
    type: "basic",
    headers: { get: () => "application/json" },
    json: async () => {
      throw new SyntaxError("JSON invalide");
    },
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("enTetesJSON", () => {
  it("pose Content-Type et l'en-tete de session, sans etat global", () => {
    expect(enTetesJSON(SESSION)).toEqual({
      "Content-Type": "application/json",
      [EN_TETE_SESSION]: SESSION,
    });
  });
});

describe("chargerFiche", () => {
  it("cas nominal : rend la fiche decodee", async () => {
    const fiche = { profil: { presentation: "", genres: [], auditeurs: 0 }, extraits: [], lienEcoute: "https://x" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponseJSON(fiche)));
    await expect(chargerFiche("Portishead", "deezer")).resolves.toEqual(fiche);
  });

  it("panne reseau : rend null, ne rejette jamais", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    await expect(chargerFiche("Portishead", "deezer")).resolves.toBeNull();
  });

  it("reponse non ok : rend null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponseJSON({}, { ok: false })));
    await expect(chargerFiche("Portishead", "deezer")).resolves.toBeNull();
  });

  it("reponse malformee (JSON invalide) : rend null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponseMalformee()));
    await expect(chargerFiche("Portishead", "deezer")).resolves.toBeNull();
  });
});

describe("chargerSuggestions", () => {
  it("cas nominal : rend la liste decodee", async () => {
    const suggestions = [{ nom: "Portishead", mbid: "m1" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponseJSON(suggestions)));
    await expect(chargerSuggestions("port")).resolves.toEqual(suggestions);
  });

  it("panne reseau : rend un tableau vide", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    await expect(chargerSuggestions("port")).resolves.toEqual([]);
  });

  it("reponse non ok : rend un tableau vide", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponseJSON([], { ok: false })));
    await expect(chargerSuggestions("port")).resolves.toEqual([]);
  });

  it("reponse malformee : rend un tableau vide", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponseMalformee()));
    await expect(chargerSuggestions("port")).resolves.toEqual([]);
  });
});

describe("chargerCollectionServeur", () => {
  it("cas nominal : rend la collection decodee", async () => {
    const entrees = [{ nom: "Portishead", mbid: "m1", lignee: [], ajoute: "2026-01-01T00:00:00Z" }];
    const f = vi.fn().mockResolvedValue(reponseJSON(entrees));
    vi.stubGlobal("fetch", f);
    await expect(chargerCollectionServeur(SESSION)).resolves.toEqual(entrees);
    expect(f).toHaveBeenCalledWith("/api/collection", { headers: { [EN_TETE_SESSION]: SESSION } });
  });

  it("panne reseau (F-33, hors ligne) : rend un tableau vide, le miroir local prend le relais", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    await expect(chargerCollectionServeur(SESSION)).resolves.toEqual([]);
  });

  it("reponse non ok : rend un tableau vide", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponseJSON([], { ok: false })));
    await expect(chargerCollectionServeur(SESSION)).resolves.toEqual([]);
  });

  it("reponse malformee : rend un tableau vide", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponseMalformee()));
    await expect(chargerCollectionServeur(SESSION)).resolves.toEqual([]);
  });
});

describe("ajouterALaCollection (le PUT seul ; le miroir hors ligne reste dans main.ts)", () => {
  it("cas nominal : PUT reussi (reponse.ok) rend true", async () => {
    const f = vi.fn().mockResolvedValue(reponseJSON({}));
    vi.stubGlobal("fetch", f);
    const entree = { nom: "Portishead", mbid: "m1", lignee: ["Portishead"] };
    await expect(ajouterALaCollection(SESSION, entree)).resolves.toBe(true);
    expect(f).toHaveBeenCalledWith("/api/collection", {
      method: "PUT",
      headers: enTetesJSON(SESSION),
      body: JSON.stringify(entree),
    });
  });

  it("panne reseau : rend false, reste en attente dans le miroir (F-33)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    await expect(ajouterALaCollection(SESSION, { nom: "P", mbid: "m1" })).resolves.toBe(false);
  });

  it("reponse non ok (session expiree ou refus serveur) : rend false", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponseJSON({}, { ok: false })));
    await expect(ajouterALaCollection(SESSION, { nom: "P", mbid: "m1" })).resolves.toBe(false);
  });
});

describe("retirerDeLaCollection (le DELETE seul)", () => {
  it("cas nominal : n'echoue pas quand le DELETE aboutit", async () => {
    const f = vi.fn().mockResolvedValue(reponseJSON({}));
    vi.stubGlobal("fetch", f);
    await expect(retirerDeLaCollection(SESSION, "m1")).resolves.toBeUndefined();
    expect(f).toHaveBeenCalledWith("/api/collection?mbid=m1", {
      method: "DELETE",
      headers: { [EN_TETE_SESSION]: SESSION },
    });
  });

  it("panne reseau : n'echoue pas non plus, reste en attente dans le miroir (F-33)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    await expect(retirerDeLaCollection(SESSION, "m1")).resolves.toBeUndefined();
  });
});

// chargerReglageServeur (constat 1 de la revue PRP 06) : ce service, exige
// par la tache 3 du PRP 06, tournait deja en production sans AUCUN test —
// ni vitest ni Playwright — pour le retenir a un futur refactoring. Ce qui
// suit verifie precisement ce que F-25 exige : le reglage RENDU PAR LE
// SERVEUR doit pouvoir ecraser le defaut du client (cas nominal), et une
// panne ne doit jamais empecher le demarrage (elle rend null, jamais un
// rejet).
describe("chargerReglageServeur (F-25, constat 1 de la revue PRP 06)", () => {
  it("cas nominal : le reglage du serveur est rendu tel quel, pret a ecraser le defaut du client", async () => {
    const f = vi.fn().mockResolvedValue(reponseJSON({ service: "spotify" }));
    vi.stubGlobal("fetch", f);
    await expect(chargerReglageServeur(SESSION)).resolves.toEqual({ service: "spotify" });
    expect(f).toHaveBeenCalledWith("/api/reglages", { headers: { [EN_TETE_SESSION]: SESSION } });
  });

  it("panne reseau : rend null, ne casse jamais le demarrage — le defaut du client reste en vigueur", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    await expect(chargerReglageServeur(SESSION)).resolves.toBeNull();
  });

  it("reponse non ok (session expiree) : rend null, meme repli que la panne reseau", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponseJSON({}, { ok: false })));
    await expect(chargerReglageServeur(SESSION)).resolves.toBeNull();
  });

  it("reponse malformee : rend null plutot que de laisser echouer le demarrage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponseMalformee()));
    await expect(chargerReglageServeur(SESSION)).resolves.toBeNull();
  });
});

describe("chargerCentre (F-41 : une session expiree ne doit jamais etre confondue avec une panne)", () => {
  const centreOK: CentreAPI = {
    artiste: { nom: "Portishead", mbid: "m1", pays: "GB", desambiguisation: "" },
    illustration: { petite: "", moyenne: "", grande: "" },
    etat: "ok",
  };

  it("cas nominal : rend le centre decode, avec l'en-tete de session", async () => {
    const f = vi.fn().mockResolvedValue(reponseJSON(centreOK));
    vi.stubGlobal("fetch", f);
    await expect(chargerCentre("Portishead", SESSION, ORIGINE)).resolves.toEqual(centreOK);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/^\/api\/centre\?/);
    expect(url).toContain("nom=Portishead");
    expect(init.headers).toEqual({ [EN_TETE_SESSION]: SESSION });
  });

  it("panne reseau : rejette (aucun repli silencieux ici, contrairement aux autres routes) — l'appelant (main.ts) gere le message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    await expect(chargerCentre("Portishead", SESSION, ORIGINE)).rejects.toThrow();
  });

  it("session expiree (redirection Traefik vers Google, origine differente) : rejette une SessionExpireeError, jamais confondue avec une panne", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        reponseJSON(
          {},
          { redirected: true, url: "https://accounts.google.com/o/oauth2/auth", contentType: "text/html" },
        ),
      ),
    );
    await expect(chargerCentre("Portishead", SESSION, ORIGINE)).rejects.toMatchObject({
      name: "SessionExpireeError",
    });
  });

  it("session expiree (memes origine et code 200, mais Content-Type text/html) : rejette une SessionExpireeError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponseJSON({}, { contentType: "text/html" })));
    await expect(chargerCentre("Portishead", SESSION, ORIGINE)).rejects.toMatchObject({
      name: "SessionExpireeError",
    });
  });

  it("reponse malformee (JSON invalide, mais pas une session expiree) : rejette l'erreur de decodage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponseMalformee()));
    await expect(chargerCentre("Portishead", SESSION, ORIGINE)).rejects.toThrow();
  });

  it("porte l'origine et l'amorce en parametres quand demandes", async () => {
    const f = vi.fn().mockResolvedValue(reponseJSON(centreOK));
    vi.stubGlobal("fetch", f);
    await chargerCentre("Portishead", SESSION, ORIGINE, { origine: "promotion", amorce: "collection" });
    const [url] = f.mock.calls[0] as [string];
    expect(url).toContain("origine=promotion");
    expect(url).toContain("amorce=collection");
  });
});

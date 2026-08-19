// apps/ramure-v2/web/tests/session.test.ts
import { describe, expect, it } from "vitest";
import {
  EN_TETE_SESSION,
  SessionExpireeError,
  estReponseSessionExpiree,
  sessionId,
  type ReponseDiagnosticable,
} from "../src/session";

describe("session", () => {
  it("rend le meme jeton a deux appels successifs (stable pour l'onglet)", () => {
    window.sessionStorage.clear();
    const a = sessionId(window.sessionStorage);
    const b = sessionId(window.sessionStorage);
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("deux stockages distincts (deux onglets) obtiennent des jetons differents", () => {
    window.sessionStorage.clear();
    const a = sessionId(window.sessionStorage);
    const stockageVide = { getItem: () => null, setItem: () => {} } as unknown as Storage;
    const b = sessionId(stockageVide);
    expect(a).not.toBe(b);
  });

  it("l'en-tete de session est nomme X-Ramure-Session", () => {
    expect(EN_TETE_SESSION).toBe("X-Ramure-Session");
  });
});

// Aucun appel reseau ici : ReponseDiagnosticable est un simple objet
// litteral, jamais un vrai fetch() ni un vrai Response (F-41, PRP 08).
function reponse(partiel: Partial<ReponseDiagnosticable>): ReponseDiagnosticable {
  return {
    redirected: false,
    url: "https://ramure-v2.apps.billbob.ovh/api/centre?nom=x",
    headers: { get: () => "application/json" },
    ...partiel,
  };
}

describe("estReponseSessionExpiree (F-41 : session expiree, jamais confondue avec une panne)", () => {
  const origine = "https://ramure-v2.apps.billbob.ovh";

  it("une reponse JSON normale, meme origine, n'est PAS une session expiree", () => {
    expect(estReponseSessionExpiree(reponse({}), origine)).toBe(false);
  });

  it("une reponse de type opaqueredirect (fetch en mode manual) EST une session expiree", () => {
    expect(estReponseSessionExpiree(reponse({ type: "opaqueredirect" }), origine)).toBe(true);
  });

  it("une reponse de type opaque EST une session expiree", () => {
    expect(estReponseSessionExpiree(reponse({ type: "opaque" }), origine)).toBe(true);
  });

  it("une reponse redirigee vers un hote externe (Google) EST une session expiree", () => {
    const r = reponse({
      redirected: true,
      url: "https://accounts.google.com/o/oauth2/auth?client_id=x",
      headers: { get: () => "text/html; charset=utf-8" },
    });
    expect(estReponseSessionExpiree(r, origine)).toBe(true);
  });

  it("une reponse 200 en text/html sur /api/centre EST une session expiree, meme sans redirection detectee", () => {
    const r = reponse({ redirected: false, headers: { get: () => "text/html; charset=utf-8" } });
    expect(estReponseSessionExpiree(r, origine)).toBe(true);
  });

  it("une redirection interne (meme origine) n'est PAS une session expiree", () => {
    const r = reponse({ redirected: true, url: `${origine}/api/centre?nom=x` });
    expect(estReponseSessionExpiree(r, origine)).toBe(false);
  });
});

describe("SessionExpireeError", () => {
  it("est distinguable d'une Error generique par instanceof", () => {
    const erreur = new SessionExpireeError();
    expect(erreur).toBeInstanceOf(Error);
    expect(erreur).toBeInstanceOf(SessionExpireeError);
    expect(new Error("autre panne")).not.toBeInstanceOf(SessionExpireeError);
  });
});

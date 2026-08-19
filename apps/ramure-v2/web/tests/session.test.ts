// apps/ramure-v2/web/tests/session.test.ts
import { describe, expect, it } from "vitest";
import { EN_TETE_SESSION, sessionId } from "../src/session";

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

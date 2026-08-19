// apps/ramure-v2/web/playwright.config.ts
//
// Recette bout en bout (PRP 09, tache 1, PRD §13) : lancee UNIQUEMENT a la
// main, jamais en CI (voir apps/ramure-v2/test.sh — RAMURE_E2E n'est posee
// nulle part dans le workflow). `npm run --prefix web test:e2e` l'invoque
// avec ce fichier comme cwd, d'ou son emplacement ICI plutot qu'a la
// racine de l'app : c'est ce que le bloc de test.sh du PRP fixe.
//
// AUCUN serveur partage ici (pas de bloc `webServer`) : chaque fichier de
// specification demarre et arrete SON PROPRE serveur Go
// (tests/e2e/support/serveur.ts) — mise-a-jour.spec.ts (F-42) a besoin de
// le REDEMARRER en cours de route pour changer le contenu de web/dist/sw.js,
// chose impossible avec un unique processus partage. `workers: 1` est donc
// IMPERATIF : main.go fixe le port 8080 en dur (son propre commentaire :
// "le relire ici depuis l'environnement creerait une seconde source de
// verite"), deux fichiers ne peuvent jamais l'occuper a la fois.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts/,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    trace: "retain-on-failure",
    // PLAYWRIGHT_CHROMIUM_PATH pointe un Chromium DEJA present sur la
    // machine (bacs a sable sans acces a la CDN de Playwright, comme celui
    // qui a ecrit ces tests : /opt/pw-browsers/chromium) — jamais fige ici,
    // pour ne pas verser un chemin propre a une seule machine dans le
    // depot. Absent, Playwright retombe sur son propre navigateur
    // telecharge (`npx playwright install chromium`), le chemin normal
    // hors bac a sable.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
});

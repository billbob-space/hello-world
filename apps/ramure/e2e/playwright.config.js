// Une seule cible, un seul navigateur : lancer.sh demarre l'app — reseau
// externe coupe (voir lancer.sh) — et pose RAMURE_E2E_URL avant d'appeler
// « npx playwright test ».
//
// retries: 0 en local, 1 en CI — et pas plus. Un test bout en bout intermittent
// apprend a ignorer le rouge, ce que la §13 du PRD tranche pour ramure lui-meme :
// « tester contre des sources reelles produit des echecs intermittents qui
// finissent par etre ignores, et masquent alors les vraies regressions ». Une
// suite qui echoue deux fois de suite sur des commits differents se DESACTIVE
// avec une entree de journal, elle ne se tolere pas.
//
// executablePath : le Chromium preinstalle de l'environnement. Sans lui, la
// version de @playwright/test installee ici peut attendre une revision de
// navigateur differente de celle en cache et refuser de demarrer.
const { defineConfig, devices } = require("@playwright/test");

// Le Chromium preinstalle de l'environnement de developpement, QUAND il existe.
// En integration continue il n'existe pas : le runner installe le sien par
// « npx playwright install chromium », et un executablePath pointant sur un
// chemin absent fait echouer la suite AVANT le premier test — sur une machine
// ou tout est pourtant en place. Constate en CI sur estran, pilabelle et ramure.
const fs = require("fs");
const chemin = process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const lancement = fs.existsSync(chemin) ? { executablePath: chemin } : {};

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 20_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.RAMURE_E2E_URL || "http://localhost:18086",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: lancement } },
  ],
});

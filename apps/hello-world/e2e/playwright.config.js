// Une seule cible, un seul navigateur : lancer.sh demarre l'app et pose
// HELLO_WORLD_E2E_URL avant d'appeler « npx playwright test ».
//
// retries: 0 en local, 1 en CI — et pas plus. Un test bout en bout intermittent
// apprend a ignorer le rouge, ce que le PRD de ramure a deja tranche pour toute
// la fabrique : « tester contre des sources reelles produit des echecs
// intermittents qui finissent par etre ignores, et masquent alors les vraies
// regressions ». Une suite qui echoue deux fois de suite sur des commits
// differents se DESACTIVE avec une entree de journal, elle ne se tolere pas.
//
// executablePath : le Chromium preinstalle de l'environnement. Sans lui, la
// version de @playwright/test installee ici peut attendre une revision de
// navigateur differente de celle en cache et refuser de demarrer.
const { defineConfig, devices } = require("@playwright/test");

// Le Chromium preinstalle de l'environnement de developpement, QUAND il existe.
// En integration continue il n'existe pas : le runner installe le sien par
// « npx playwright install chromium », et un executablePath pointant sur un
// chemin absent ferait echouer la suite avant le premier test — sur une machine
// ou tout est pourtant en place. D'ou le test d'existence : on epingle le
// navigateur local s'il est la, on laisse Playwright choisir sinon.
const fs = require("fs");
const chemin = process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const lancement = fs.existsSync(chemin) ? { executablePath: chemin } : {};

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 15_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.HELLO_WORLD_E2E_URL || "http://localhost:18081",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: lancement } },
  ],
});

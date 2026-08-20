// Une seule cible, un seul navigateur : lancer.sh demarre l'app et pose
// PILABELLE_E2E_URL avant d'appeler « npx playwright test ».
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

const chromium = process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 20_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PILABELLE_E2E_URL || "http://localhost:18085",
    trace: "retain-on-failure",
    // pilabelle lit l'identite dans l'en-tete X-Forwarded-User, pose par
    // Traefik (forwardauth) une fois l'authentification faite en amont. En
    // bout en bout il n'y a pas d'authentification devant le serveur natif :
    // Playwright pose lui-meme cet en-tete, par defaut pour tous les tests
    // qui n'en fabriquent pas un a eux via un contexte dedie (isolation des
    // profils entre tests).
    extraHTTPHeaders: { "X-Forwarded-User": "e2e-defaut@pilabelle.invalid" },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: chromium } } },
  ],
});

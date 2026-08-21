// Config minimale : une seule cible, un seul navigateur. lancer.sh monte la
// stack et fixe ARDOISE_E2E_URL avant d'appeler `npx playwright test`.
//
// executablePath pointe explicitement sur le Chromium precharge de
// l'environnement (voir la skill "run" / le README de session : Chromium est
// preinstalle sous /opt/pw-browsers, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1) : sans
// cela, la version de @playwright/test installee ici peut attendre une
// revision de navigateur differente de celle mise en cache et refuser de
// demarrer.
const { defineConfig, devices } = require("@playwright/test");
const fs = require("fs");

// Le Chromium preinstalle de l'environnement de developpement, QUAND il existe.
// En integration continue il n'existe pas : le runner installe le sien, et un
// executablePath pointant sur un chemin absent ferait echouer la suite avant le
// premier test — sur une machine ou tout est pourtant en place.
const chemin = process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const lancement = fs.existsSync(chemin) ? { executablePath: chemin } : {};

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 15_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.ARDOISE_E2E_URL || "http://localhost:18080",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: lancement,
      },
    },
  ],
});

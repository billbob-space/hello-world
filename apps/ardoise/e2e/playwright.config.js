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
        launchOptions: {
          executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
        },
      },
    },
  ],
});

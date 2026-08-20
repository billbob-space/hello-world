// Voir apps/ardoise/e2e/playwright.config.js pour le detail de l'executablePath.
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
    baseURL: process.env.COMPTEUR_E2E_URL || "http://localhost:18081",
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

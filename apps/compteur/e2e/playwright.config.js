// Voir apps/ardoise/e2e/playwright.config.js pour le detail de l'executablePath.
const { defineConfig, devices } = require("@playwright/test");

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
        launchOptions: {
          executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
        },
      },
    },
  ],
});

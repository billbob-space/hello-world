// Tests de bout en bout de compteur, contre la stack REELLE montee par
// ../lancer.sh. A8 du PRD : le parcours cliquer -> voir le total dans un
// vrai navigateur.
const { test, expect } = require("@playwright/test");

test("parcours complet : cliquer incremente, la provenance change au rechargement", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#bouton")).toBeVisible();

  const avant = Number(await page.locator("#valeur").textContent());
  await page.locator("#bouton").click();
  await expect(page.locator("#valeur")).toHaveText(String(avant + 1));

  // L'incrementation invalide le cache (R2) : la lecture qui suit
  // immediatement (l'appel a charger() dans le handler de clic) vient donc
  // de la base.
  await expect(page.locator("#provenance")).toHaveText("Lu dans la base");

  // Un rechargement declenche une deuxieme lecture consecutive : cache.
  await page.reload();
  await expect(page.locator("#provenance")).toHaveText("Lu dans le cache");
  await expect(page.locator("#valeur")).toHaveText(String(avant + 1));
});

test("un second clic avance encore le total", async ({ page }) => {
  await page.goto("/");
  const avant = Number(await page.locator("#valeur").textContent());
  await page.locator("#bouton").click();
  await expect(page.locator("#valeur")).toHaveText(String(avant + 1));
  await page.locator("#bouton").click();
  await expect(page.locator("#valeur")).toHaveText(String(avant + 2));
});

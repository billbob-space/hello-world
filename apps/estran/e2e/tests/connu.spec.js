// Bout en bout de estran, PHASE « connue » : les cinq variables ESTRAN_BASE_*
// pointent vers stub-serveur.js (lancer.sh), qui rend des donnees FIXES —
// jamais le reseau reel, jamais un fournisseur en vrai (le PRD de la fabrique
// interdit de tester contre des sources reelles : « ca produit des echecs
// intermittents qui finissent par etre ignores »).
//
// Ce que la phase precedente (degrade.spec.js) ne peut pas verifier : que
// l'app affiche CORRECTEMENT une vraie donnee, pas seulement qu'elle survit
// a leur absence. Les valeurs attendues ici sont recopiees de
// stub-serveur.js — si l'un des deux fichiers change, l'autre doit suivre.
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

test("la page d'accueil s'affiche", async ({ page }) => {
  const reponse = await page.goto("/");
  expect(reponse.status()).toBe(200);
  await expect(page.locator("h1").first()).toBeVisible();
});

test("la meteo affiche une temperature connue", async ({ page }) => {
  await page.goto("/");
  // TEMPERATURE_C = 21.4 dans stub-serveur.js, Math.round -> "21°".
  await expect(page.locator("#heures-rangee")).toContainText("21°", { timeout: 10_000 });
});

test("la marée affiche une hauteur et des extrema connus", async ({ page }) => {
  await page.goto("/");
  const jauge = page.locator("#jauge-carte");
  // HAUTEUR_EAU_M = 3.14 dans stub-serveur.js.
  await expect(jauge).toContainText("3.14", { timeout: 10_000 });
  // Les deux extrema encadrant "maintenant" valent toujours HAUTEUR_BM_M
  // (1.00) ou HAUTEUR_PM_M (5.50), quelle que soit l'heure du test.
  await expect(jauge).toContainText(/1\.00|5\.50/);
});

test("la pluie du jour affiche un cumul connu", async ({ page }) => {
  await page.goto("/");
  // CUMUL_PLUIE_MM = 3.0 dans stub-serveur.js, affiche "3 mm" (pas de
  // decimale JS pour un entier). La bande de l'heure qui vient est seche
  // (niveau 1 partout) : "temps sec pour l'heure qui vient".
  await expect(page.locator("#pluie-carte")).toContainText("3 mm", { timeout: 10_000 });
  await expect(page.locator("#pluie-carte")).toContainText("temps sec pour l’heure qui vient");
});

// L'ACCESSIBILITE MESUREE, sur la page dans son etat le plus complet (donnees
// connues plutot que degradees) : c'est ce passage, et lui seul, qui rend
// l'accessibilite bloquante dans la chaine.
test("aucune violation d'accessibilite serieuse", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#jauge-carte")).toContainText("3.14", { timeout: 10_000 });

  const resultat = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const graves = resultat.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(graves.map((v) => `${v.id} (${v.impact}) : ${v.help}`)).toEqual([]);
});

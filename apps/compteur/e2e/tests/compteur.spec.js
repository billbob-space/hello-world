// Tests de bout en bout de compteur, contre la stack REELLE montee par
// ../lancer.sh. A8 du PRD : le parcours cliquer -> voir le total dans un
// vrai navigateur.
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

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

// L'ACCESSIBILITE MESUREE. C'est ce passage, et lui seul, qui rend le contraste,
// l'atteignabilite au clavier et les libelles de lecteur d'ecran BLOQUANTS dans
// la chaine. Le jugement UX qui ne se mesure pas appartient a l'agent
// « esthete », en fin de branche : les deux ne se remplacent pas.
//
// waitForLoadState avant analyze() : AxeBuilder injecte son script dans la page,
// et une navigation en cours detruit son contexte d'execution — « Execution
// context was destroyed ». Constate sur ramure, ou le test passait ou tombait
// selon la vitesse de la machine. Une course qu'on gagne une fois sur deux est
// pire qu'un test absent : elle apprend a ignorer le rouge.
test("aucune violation d'accessibilite serieuse", { tag: "@a11y" }, async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const resultat = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const graves = resultat.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(graves.map((v) => `${v.id} (${v.impact}) : ${v.help}`)).toEqual([]);
});

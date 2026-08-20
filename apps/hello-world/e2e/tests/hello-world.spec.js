// Bout en bout de hello-world : un vrai navigateur, contre le binaire reel.
//
// Ce que cette suite garde, et que les tests Go ne peuvent pas voir : la page
// s'affiche vraiment, elle est atteignable au clavier, et son contraste est
// lisible. Un test Go verifie que le serveur REND du HTML ; il ne dit rien de
// ce que ce HTML devient dans un navigateur.
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

test("la page d'accueil s'affiche", async ({ page }) => {
  const reponse = await page.goto("/");
  expect(reponse.status()).toBe(200);
  // Un titre de premier niveau visible : c'est le point de repere du lecteur
  // d'ecran comme de l'oeil, et son absence ne casse aucun test Go.
  await expect(page.locator("h1").first()).toBeVisible();
});

test("la sonde de sante repond", async ({ request }) => {
  const r = await request.get("/healthz");
  expect(r.ok()).toBeTruthy();
});

// L'ACCESSIBILITE MESUREE. C'est ce passage, et lui seul, qui rend
// l'accessibilite bloquante dans la chaine : contraste insuffisant, element
// inatteignable au clavier, libelle muet pour un lecteur d'ecran. Le reste du
// jugement UX appartient a l'agent « esthete », qui juge ce qui ne se mesure
// pas. Ces deux-la ne se remplacent pas l'un l'autre.
test("aucune violation d'accessibilite serieuse", async ({ page }) => {
  await page.goto("/");
  const resultat = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const graves = resultat.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(graves.map((v) => `${v.id} (${v.impact}) : ${v.help}`)).toEqual([]);
});

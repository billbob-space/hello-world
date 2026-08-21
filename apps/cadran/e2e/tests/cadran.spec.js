// Bout en bout de cadran : un vrai navigateur, contre le binaire reel.
//
// Ce que cette suite garde, et que les tests Go ne peuvent pas voir : la page
// s'affiche vraiment, son contraste est lisible, les aiguilles avancent
// reellement dans le navigateur, le cadran ne deborde pas sur un ecran de
// telephone, et le repli « sans JavaScript » promis par le PRD est vrai — pas
// seulement documente.
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

test("la page d'accueil s'affiche", async ({ page }) => {
  const reponse = await page.goto("/");
  expect(reponse.status()).toBe(200);
  // Un titre de premier niveau visible : c'est le point de repere du lecteur
  // d'ecran comme de l'oeil, et son absence ne casse aucun test Go.
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator("h1").first()).toHaveText("cadran");
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

// La lecture chiffree affiche l'heure du serveur, au format HH:MM:SS — c'est
// la lecture de secours quand on veut la seconde exacte plutot que l'allure
// generale des aiguilles.
test("la lecture chiffree affiche une heure au bon format", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#lecture")).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
});

// Les aiguilles sont animees par requestAnimationFrame cote client (voir le
// script embarque dans page.html) : rien dans un test Go ne peut verifier
// qu'un navigateur reel les fait vraiment bouger, seulement que le premier
// angle envoye est juste.
test("les aiguilles avancent en continu dans le navigateur", async ({ page }) => {
  await page.goto("/");
  const avant = await page.locator("#aig-s").getAttribute("style");
  await page.waitForTimeout(1200);
  const apres = await page.locator("#aig-s").getAttribute("style");
  expect(apres).not.toBe(avant);
});

// Le cadran est en CSS pur : les graduations sont des calques carres pivotes,
// dont la rotation agrandit la zone de debordement d'un facteur racine de
// deux. C'est exactement le defaut deja constate et corrige (voir README) :
// sans `overflow: hidden` sur le disque, la page defile lateralement sur
// telephone. Un test Go ne rend jamais de CSS et ne peut pas voir ce defaut.
test.describe("sur un ecran de telephone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("le cadran ne provoque aucun defilement horizontal", async ({ page }) => {
    await page.goto("/");
    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(debordement).toBeLessThanOrEqual(0);
  });
});

// Le PRD est explicite : « Degrader, jamais casser. Sans JavaScript le cadran
// est fige mais juste ». C'est une promesse produit, pas un detail : elle ne
// se verifie que dans un navigateur ou JavaScript est reellement coupe, ce
// qu'aucun test Go ne peut simuler.
test.describe("sans JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("le cadran reste juste mais affiche fige", async ({ page }) => {
    await page.goto("/");
    // Les aiguilles gardent l'angle calcule au serveur : jamais absentes.
    await expect(page.locator("#aig-h")).toHaveAttribute("style", /rotate\(-?\d+\.\d+deg\)/);
    await expect(page.locator("#aig-m")).toHaveAttribute("style", /rotate\(-?\d+\.\d+deg\)/);
    await expect(page.locator("#aig-s")).toHaveAttribute("style", /rotate\(-?\d+\.\d+deg\)/);
    // La mention qui empeche de croire a une horloge arretee.
    await expect(page.locator(".fige")).toBeVisible();
    await expect(page.locator(".fige")).toContainText("heure du rendu");
  });
});

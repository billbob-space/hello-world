// Bout en bout de estran, PHASE « degrade » : les cinq variables
// ESTRAN_BASE_* pointent vers un port ferme (lancer.sh), donc aucun
// fournisseur externe n'est joignable — ni le vrai, ni un simulateur.
// L'application demarre a froid : rien connu depuis un appel precedent.
//
// Ce que cette suite garde, et que les tests Go ne peuvent pas voir : dans
// un vrai navigateur, une panne totale des fournisseurs ne laisse jamais un
// ecran vide — chaque section touchee affiche son indisponibilite
// (PRODUCT.md, principe 3 : « degrader, jamais casser »). Si un jour
// ESTRAN_BASE_* cessait d'etre lu (regression sur meteo.go/maree.go/
// pluie.go), ce test recevrait de vraies donnees et echouerait — c'est
// aussi un garde-fou contre une fuite reseau future.
const { test, expect } = require("@playwright/test");

test("la sonde de sante repond meme quand aucun fournisseur n'est joignable", async ({ request }) => {
  const r = await request.get("/healthz");
  expect(r.ok()).toBeTruthy();
});

test("chaque section indisponible affiche son etat, jamais un ecran vide", async ({ page }) => {
  await page.goto("/");

  // La maree n'a pas de cle dans cette phase : « configuration requise »,
  // independant du reseau.
  await expect(page.locator("#jauge-carte")).toContainText("Configuration requise", { timeout: 10_000 });
  // Les previsions et la pluie, elles, DEPENDENT vraiment de la coupure :
  // avec un vrai reseau elles montreraient une meteo reelle.
  await expect(page.locator("#heures-rangee")).toContainText("indisponible", { timeout: 10_000 });
  await expect(page.locator("#pluie-carte")).toContainText("indisponible", { timeout: 10_000 });

  // Aucune section n'est restee bloquee sur son etat de chargement initial.
  await expect(page.locator("main")).not.toContainText("chargement…");
});

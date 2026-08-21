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
  // La QUATRIEME section n'etait verifiee nulle part, et c'est celle qui avait
  // garde une improvisation apres l'unification du 20 aout 2026 : elle disait
  // « tendance indisponible », sans dire quelle source se tait ni que
  // l'application reessaie seule, quand les trois autres le disaient.
  await expect(page.locator("#jours-rangee")).toContainText("indisponible", { timeout: 10_000 });

  // Aucune section n'est restee bloquee sur son etat de chargement initial.
  await expect(page.locator("main")).not.toContainText("chargement…");

  // Les quatre sections disent leur indisponibilite EXACTEMENT de la meme
  // facon (PRODUCT.md, « Deux decisions d'ecran... — 20 aout 2026 ») : meme
  // cadre — pose par la seule classe .indisponible-carte — et meme gabarit de
  // phrase en trois temps, « <Sujet> indisponible : <qui ne repond pas>.
  // Nouvelle tentative automatique dans 5 minutes. » La carte de maree fait
  // exception ici et seulement ici : sans cle API elle affiche « Configuration
  // requise », qui n'est pas une panne.
  await expect(page.locator(".indisponible-carte")).toHaveCount(4);
  for (const id of ["#heures-rangee", "#pluie-carte", "#jours-rangee"]) {
    await expect(page.locator(id)).toContainText(
      /^[A-ZÉÈÊÀÂÎÔÛÇ][^:]* indisponibles? : .+\. Nouvelle tentative automatique dans 5 minutes\.$/
    );
  }
});

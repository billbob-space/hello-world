// apps/ramure-v2/web/tests/e2e/accueil-mur.spec.ts
//
// PRODUCT.md §17 Q7 (decision du 22 aout 2026) : "Quelle est la forme des
// tuiles du mur d'accueil sur ecran large ?" -- variante retenue, des
// pochettes CARREES en grille centree, jamais les bandes verticales de
// rapport 1:3,2 mesurees a 1440 par la critique du 22 aout 2026 (C3/C15).
//
// Piege explicite du meme document : `auto-fit` a ete pose la veille
// precisement pour supprimer 485 px (34 % de 1440) de vide mort a droite --
// forcer le carre par des colonnes de taille FIXE rouvre ce vide (verifie
// empiriquement en ecrivant ce fichier). web/index.html retient donc les
// colonnes etirees (`minmax(9rem, 1fr)`, mecanisme INCHANGE de C3) et fait
// porter le carre sur la RANGEE (`aspect-ratio: 1` sur `.tuile`,
// `grid-auto-rows: auto`) -- d'ou l'exigence de cette suite : mesurer le
// rapport ET le vide lateral, jamais l'un sans l'autre.
import { expect, test } from "@playwright/test";
import { ScenarioAPI, installerAPI } from "./support/api";
import { BASE_URL, demarrerServeur, type ServeurRamure } from "./support/serveur";

let serveur: ServeurRamure;

test.beforeAll(async () => {
  serveur = await demarrerServeur();
});

test.afterAll(async () => {
  await serveur.arreter();
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { RAMURE_SW_DESACTIVE?: boolean }).RAMURE_SW_DESACTIVE = true;
  });
});

test("mur d'accueil @1440 -- tuiles carrees, vide lateral RESTE borne (§17 Q7)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installerAPI(page, new ScenarioAPI());
  await page.goto(`${BASE_URL}/`);
  await expect(page.locator("#accueil")).toBeVisible();

  const tuiles = page.locator(".tuile");
  await expect(tuiles).toHaveCount(6); // AMORCAGE_EDITORIAL, web/src/main.ts

  const premiere = await tuiles.first().boundingBox();
  if (!premiere) throw new Error("tuile introuvable");
  const rapport = premiere.width / premiere.height;
  expect(rapport, `rapport largeur/hauteur mesure a 1440 : ${rapport.toFixed(3)}`).toBeGreaterThan(0.9);
  expect(rapport, `rapport largeur/hauteur mesure a 1440 : ${rapport.toFixed(3)}`).toBeLessThan(1.1);

  // Vide lateral : le mecanisme de C3 (colonnes `1fr`, zero reliquat) n'a
  // PAS change -- seule la hauteur de la rangee suit desormais la largeur
  // de la tuile. Le vide attendu est donc la seule marge structurelle
  // (padding de .mur, arrondi de mise en page), a des annees-lumiere des
  // 485 px (34 % de la largeur) que la version etiree corrigeait.
  const murBox = await page.locator("#mur").boundingBox();
  if (!murBox) throw new Error("#mur introuvable");
  const xs = await tuiles.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x));
  const videGauche = Math.min(...xs) - murBox.x;
  expect(videGauche, `vide lateral mesure a 1440 : ${videGauche.toFixed(1)}px`).toBeGreaterThanOrEqual(0);
  expect(videGauche, `vide lateral mesure a 1440 : ${videGauche.toFixed(1)}px`).toBeLessThan(20); // padding de .mur (8px) + arrondi
});

test("mur d'accueil @390 -- deux colonnes, quasi carre, aucun defilement (ne casse pas l'existant)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installerAPI(page, new ScenarioAPI());
  await page.goto(`${BASE_URL}/`);
  await expect(page.locator("#accueil")).toBeVisible();

  const tuiles = page.locator(".tuile");
  const premiere = await tuiles.first().boundingBox();
  if (!premiere) throw new Error("tuile introuvable");
  const rapport = premiere.width / premiere.height;
  expect(rapport, `rapport largeur/hauteur mesure a 390 : ${rapport.toFixed(3)}`).toBeGreaterThan(0.85);
  expect(rapport, `rapport largeur/hauteur mesure a 390 : ${rapport.toFixed(3)}`).toBeLessThan(1.15);

  // Deux colonnes (deja le cas avant cette branche, PRODUCT.md §17 Q7,
  // "acquis") : deux valeurs de x distinctes parmi les 6 tuiles.
  const xs = await tuiles.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)));
  expect(new Set(xs).size).toBe(2);

  // Aucun defilement du mur (deja vrai avant cette branche -- verifie, pas
  // suppose, apres le passage de `grid-auto-rows: 1fr` a `auto`).
  const defile = await page.evaluate(() => {
    const mur = document.querySelector("#mur")!;
    return mur.scrollHeight > mur.clientHeight;
  });
  expect(defile).toBe(false);
});

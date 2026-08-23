// apps/ramure-v2/web/tests/e2e/echec-plantation.spec.ts
//
// PRODUCT.md §17 Q6 (decision du 22 aout 2026) : "Que voit-on quand une
// graine ne donne rien ?" -- variante retenue C, une bande pleine largeur
// sous la barre de recherche, l'arbre precedent conserve derriere elle,
// estompe. Remplace l'ancien artiste fantome (critique 2026-08-22 C15) :
// un disque au centre portant le nom mal orthographie saisi par le
// visiteur, dementi seulement par une ligne de gris a l'autre bout de
// l'ecran. web/tests/e2e/pannes.spec.ts couvre deja les DEUX etats serveur
// distincts (F-36 "aucun voisin", F-37 "panne") ; ce fichier verifie la
// PROMESSE propre a la bande : l'exploration en cours n'est pas perdue,
// et l'absence d'arbre precedent est un cas traite, pas un oubli.
import { expect, test } from "@playwright/test";
import { branche, centreOK, centreVide, ScenarioAPI, installerAPI } from "./support/api";
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

async function planter(page: import("@playwright/test").Page, nom: string): Promise<void> {
  await page.fill("#graine", nom);
  await page.locator("#recherche button[type=submit]").click();
}

test("pas d'arbre precedent -- la bande s'affiche seule (§17 Q6, cas traite, pas un oubli)", async ({ page }) => {
  const scenario = new ScenarioAPI();
  scenario.definirCentre("Zzzt", centreVide('Aucun artiste ne correspond a "Zzzt".'));
  await installerAPI(page, scenario);
  await page.goto(`${BASE_URL}/`);

  await expect(page.locator("#accueil")).toBeVisible(); // premier ecran, aucune exploration encore commencee
  await planter(page, "Zzzt");

  await expect(page.locator("#echec-plantation")).toBeVisible();
  await expect(page.locator("#echec-plantation")).toContainText("Vérifie l'orthographe");
  // Rien a estomper -- aucun arbre n'a jamais ete dessine.
  await expect(page.locator(".noeud")).toHaveCount(0);
  await expect(page.locator("#canevas")).not.toHaveClass(/estompe/);
});

test("l'arbre precedent survit a une plantation ratee, estompe derriere la bande, puis se retablit", async ({ page }) => {
  const scenario = new ScenarioAPI();
  scenario.definirCentre("Artiste Connu", centreOK("Artiste Connu", { branches: [branche("Voisin Connu", { affinite: 0.9 })] }));
  scenario.definirCentre("Fotte De Frappe", centreVide('Aucun artiste ne correspond a "Fotte De Frappe".'));
  await installerAPI(page, scenario);
  await page.goto(`${BASE_URL}/`);

  // 1. Une exploration reussie, d'abord.
  await planter(page, "Artiste Connu");
  await expect(page.locator('.noeud[data-id="centre"]')).toHaveAttribute("aria-label", "Artiste Connu");
  await expect(page.locator(".noeud")).toHaveCount(2); // centre + 1 branche

  // 2. Une seconde graine, mal orthographiee, echoue.
  await planter(page, "Fotte De Frappe");
  await expect(page.locator("#echec-plantation")).toBeVisible();
  await expect(page.locator("#echec-plantation")).toContainText("Fotte De Frappe");
  // L'arbre precedent n'a pas ete efface : MEMES noeuds, jamais reconstruits
  // (§17 Q6, "l'exploration en cours n'est pas perdue").
  await expect(page.locator(".noeud")).toHaveCount(2);
  await expect(page.locator('.noeud[data-id="centre"]')).toHaveAttribute("aria-label", "Artiste Connu");
  // ... mais assez lisible pour se reperer, sans concurrencer le message
  // (mesure du contraste et de l'opacite : voir web/index.html, #canevas.estompe).
  await expect(page.locator("#canevas")).toHaveClass(/estompe/);
  await expect(page.locator("#canevas")).toHaveCSS("opacity", "0.4");
  await expect(page.locator("#canevas")).toHaveCSS("pointer-events", "none");

  // 3. Une plantation reussie leve la bande -- elle n'est jamais une alerte
  // qui s'auto-efface (echec.ts, masquerEchecPlantation).
  await planter(page, "Artiste Connu");
  await expect(page.locator("#echec-plantation")).toBeHidden();
  await expect(page.locator("#canevas")).not.toHaveClass(/estompe/);
  await expect(page.locator('.noeud[data-id="centre"]')).toHaveAttribute("aria-label", "Artiste Connu");
});

test("retour a l'accueil (le visiteur repart) leve la bande", async ({ page }) => {
  const scenario = new ScenarioAPI();
  scenario.definirCentre("Fotte De Frappe", centreVide('Aucun artiste ne correspond a "Fotte De Frappe".'));
  await installerAPI(page, scenario);
  await page.goto(`${BASE_URL}/`);

  await planter(page, "Fotte De Frappe");
  await expect(page.locator("#echec-plantation")).toBeVisible();

  await page.locator("#logo").click(); // F-07, "quitter l'exploration"
  await expect(page.locator("#accueil")).toBeVisible();
  await expect(page.locator("#echec-plantation")).toBeHidden();
});

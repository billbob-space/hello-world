// Bout en bout de l'ecran de choix du lieu (prp/05-ecran-de-choix.md,
// section 8). Trois lieux fixes, definis dans stub-serveur.js et cherches
// par un mot-cle qui n'est jamais un vrai nom de commune ("littoral",
// "interieur", "inconnu") :
//
//   1. littoral   — la fiche annonce marée + état de la mer PRESENTS, et
//                    apres selection la jauge de marée et la houle des
//                    vignettes sont bien la.
//   2. interieur  — la fiche annonce marée + état de la mer ABSENTS, et apres
//                    selection le cadre pointillé remplace la jauge, la houle
//                    a disparu des vignettes, et — la régression que ce PRP
//                    redoute le plus — la carte d'indisponibilité n'apparaît
//                    NULLE PART.
//   3. inconnue   — le stub rend l'appel marin en erreur : les deux premières
//                    lignes disent « on verra sur place », jamais « pas de ».
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

async function ouvrirEtChercher(page, motCle) {
  await page.goto("/");
  await page.locator("#bouton-lieu").click();
  const dialogue = page.locator("#dialogue-lieu");
  await expect(dialogue).toBeVisible();
  await page.locator("#lieu-recherche").fill(motCle);
  const fiche = page.locator("#dialogue-lieu-liste .fiche-lieu");
  await expect(fiche).toHaveCount(1, { timeout: 10_000 });
  return { dialogue, fiche };
}

test("littoral : la fiche annonce marée et état de la mer, présents après le choix", async ({ page }) => {
  const { dialogue, fiche } = await ouvrirEtChercher(page, "littoral");

  await expect(fiche).toContainText("Le Touquet-Test");
  await expect(fiche).toContainText("LITTORAL");
  await expect(fiche).toContainText("Marée — Le Touquet (site test)");
  await expect(fiche).toContainText("État de la mer — houle et vagues");
  await expect(fiche).not.toContainText("Pas de marée");
  await expect(fiche).not.toContainText("Pas d’état de la mer");

  await fiche.click();
  await expect(dialogue).toBeHidden();

  // HAUTEUR_EAU_M = 3.14 (stub-serveur.js), identique quel que soit le lieu :
  // la jauge de marée est bien affichée, pas le cadre pointillé.
  const jauge = page.locator("#jauge-carte");
  await expect(jauge).toContainText("3.14", { timeout: 10_000 });
  await expect(jauge).not.toContainText("Pas de marée");

  // VAGUES_M = 1.2 (stub-serveur.js) : la houle est bien dans les vignettes.
  await expect(page.locator("#heures-rangee")).toContainText("1.2", { timeout: 10_000 });

  await expect(page.locator("#bouton-lieu-texte")).toHaveText("Le Touquet-Test");
});

test("intérieur : la fiche annonce l'absence, puis le cadre pointillé remplace la jauge — jamais la carte d'indisponibilité", async ({ page }) => {
  const { dialogue, fiche } = await ouvrirEtChercher(page, "interieur");

  await expect(fiche).toContainText("Arras-Test");
  await expect(fiche).toContainText("INTÉRIEUR");
  await expect(fiche).toContainText("Pas de marée — côte à");
  await expect(fiche).toContainText("Pas d’état de la mer");
  await expect(fiche).not.toContainText("Marée — ");
  await expect(fiche).not.toContainText("on verra sur place");

  await fiche.click();
  await expect(dialogue).toBeHidden();

  const jauge = page.locator("#jauge-carte");
  await expect(jauge).toContainText("Pas de marée à Arras-Test", { timeout: 10_000 });
  await expect(jauge).toContainText("la côte la plus proche du catalogue est à");

  // La régression que ce PRP redoute le plus : une absence légitime ne doit
  // JAMAIS prendre le gabarit de panne (carteIndisponible), nulle part sur
  // l'écran — les trois autres sections fonctionnent normalement ici.
  await expect(page.locator(".indisponible-carte")).toHaveCount(0);
  await expect(jauge).not.toHaveClass(/indisponible-carte/);

  // La houle a disparu des vignettes (wave_height nul pour ce lieu, stub) :
  // aucune donnée de vagues à afficher, jamais un zéro inventé.
  await expect(page.locator("#heures-rangee")).toContainText("21°", { timeout: 10_000 });
  await expect(page.locator("#heures-rangee")).not.toContainText("1.2 m");
});

test("capacité inconnue : le stub rend le marin en erreur — « on verra sur place », jamais « pas de »", async ({ page }) => {
  const { fiche } = await ouvrirEtChercher(page, "inconnu");

  await expect(fiche).toContainText("Zone-Test");
  // littoral: null n'affiche ni pastille LITTORAL ni pastille INTERIEUR :
  // affirmer l'un ou l'autre mentirait sur ce qu'on sait vraiment du lieu.
  await expect(fiche).not.toContainText("LITTORAL");
  await expect(fiche).not.toContainText("INTÉRIEUR");

  // Deux lignes INCONNUES (marée + état de la mer) — jamais trois : la pluie
  // à la minute reste présente. Selecteur structurel plutôt qu'un comptage de
  // texte : .pour-lecteur (clip-path) reste dans le DOM et fausserait un
  // comptage fait sur le texte rendu.
  const inconnues = fiche.locator(".capacite--inconnue");
  await expect(inconnues).toHaveCount(2);
  await expect(inconnues.nth(0)).toContainText("on verra sur place");
  await expect(inconnues.nth(1)).toContainText("on verra sur place");
  await expect(fiche.locator(".capacite--absente")).toHaveCount(0);
  const texte = (await fiche.textContent()) || "";
  expect(texte.toLowerCase()).not.toMatch(/pas de/);
});

test("l'écran de choix ouvert ne porte aucune violation d'accessibilité sérieuse", async ({ page }) => {
  await page.goto("/");
  await page.locator("#bouton-lieu").click();
  await expect(page.locator("#dialogue-lieu")).toBeVisible();
  // Laisse la liste par défaut (lieux vus) finir de se peupler avant de
  // mesurer : un état "chargement…" ne dit rien de la structure finale.
  await expect(page.locator("#dialogue-lieu-liste .etat-attente")).toHaveCount(0, { timeout: 10_000 });

  const resultat = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const graves = resultat.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(graves.map((v) => `${v.id} (${v.impact}) : ${v.help}`)).toEqual([]);
});

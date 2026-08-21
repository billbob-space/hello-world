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

// La date du jour regarde ne s'ecrit plus qu'une fois (PRODUCT.md, "Deux
// decisions d'ecran de plus... — 21 aout 2026") : sur un jour autre
// qu'aujourd'hui, elle vivait avant a la fois sur la carte de maree
// (.jauge-jour-titre) ET dans le titre de la section horaire, au meme y a
// 1440 px. Cette regression est prouvee sur "demain" (decalage +1), le seul
// autre jour que le stub couvre a la fois pour la meteo (previsions) et la
// maree (extrema) — voir stub-serveur.js.
test("sur un autre jour, la date n'apparait qu'une fois — la carte de marée ne la répète plus", async ({ page }) => {
  await page.goto("/");

  await page.locator("#nav-suivant").click();

  const jauge = page.locator("#jauge-carte");
  const titrePrevisions = page.locator("#titre-previsions");

  // La carte de maree bascule sur les extrema du jour (stub : PM/BM a heures
  // fixes) : on attend ce contenu avant de mesurer, pour ne pas lire un
  // "chargement…" intermediaire.
  await expect(jauge).toContainText(/Pleine mer|Basse mer/, { timeout: 10_000 });

  // Le titre de la section horaire porte desormais la date en toutes
  // lettres, jamais son libelle par defaut.
  await expect(titrePrevisions).not.toHaveText("Les prochaines heures");
  await expect(titrePrevisions).not.toHaveText("Ce jour");
  const libelleJour = (await titrePrevisions.textContent()).trim();
  expect(libelleJour.length).toBeGreaterThan(0);

  // Regression directe : la carte de maree ne doit plus jamais porter
  // l'element qui affichait la date, ni ce libelle en texte sous une autre
  // classe — comparaison INSENSIBLE A LA CASSE : l'ancien code capitalisait
  // ce meme libelle sur la carte ("Dimanche 23 août") alors que le titre de
  // section le rend tel quel ("dimanche 23 août", mis en capitales par le
  // CSS) ; une comparaison sensible a la casse aurait laisse revenir le
  // defaut sans faire echouer ce test.
  await expect(jauge.locator(".jauge-jour-titre")).toHaveCount(0);
  const echappe = libelleJour.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await expect(jauge).not.toContainText(new RegExp(echappe, "i"));

  // Contre-epreuve documentee dans la tache : remettre l'ancien
  // `<p class="jauge-jour-titre">${capitaliser(m.jour_affiche_libelle)}</p>`
  // dans rendreExtremaJour fait echouer les deux assertions ci-dessus.
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

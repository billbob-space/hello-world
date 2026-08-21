// Bout en bout de l'ecran de choix du lieu (prp/05-ecran-de-choix.md,
// section 8, corrige par la critique du 21 aout 2026, soir — voir
// .impeccable/critique/2026-08-21T22-40-00Z__ecran-de-choix-du-lieu.md).
// Trois lieux fixes, definis dans stub-serveur.js et cherches par un
// mot-cle qui n'est jamais un vrai nom de commune ("littoral", "interieur",
// "inconnu") :
//
//   1. littoral   — la fiche annonce marée + état de la mer PRESENTS, et
//                    apres selection la jauge de marée et la houle des
//                    vignettes sont bien la, la section MAREE reste en
//                    tete d'ecran (rien ne change sur un lieu qui a une
//                    marée).
//   2. interieur  — la fiche annonce marée + état de la mer ABSENTS ; apres
//                    selection, la section MAREE entiere quitte la tete
//                    d'ecran (elle n'apparaissait deja plus comme une
//                    panne : constat repris ici) et l'absence devient une
//                    ligne sous le nom du lieu, dans l'en-tete.
//   3. inconnue   — le stub rend l'appel marin en erreur (littoral: null),
//                    mais Zone-Test est aussi a plus de 600 km de tout site
//                    du catalogue de marée : la marée, qui vient d'une
//                    AUTRE source que le caractere littoral, reste
//                    connaissable et annonce une absence legitime des la
//                    fiche — jamais « on verra sur place » pour une donnée
//                    que le catalogue sait deja dire. Seul l'état de la mer,
//                    qui depend vraiment de l'appel marin muet, reste
//                    INCONNU sur cette fiche.
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

test("littoral : la fiche annonce marée et état de la mer, présents après le choix — rien ne change sur un lieu qui a une marée", async ({ page }) => {
  const { dialogue, fiche } = await ouvrirEtChercher(page, "littoral");

  await expect(fiche).toContainText("Le Touquet-Test");
  await expect(fiche).toContainText("LITTORAL");
  await expect(fiche).toContainText("Marée — disponible");
  // Le detail (site, distance) est demote dans une sous-ligne (critique du
  // 21 aout 2026, "trois jetons plutot que trois phrases") mais reste dans
  // le MEME jeton que son sujet.
  await expect(fiche).toContainText("Le Touquet (site test)");
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

  // Sur un lieu qui a une marée, la section MAREE reste en tete d'ecran et
  // la ligne d'absence de l'en-tete reste masquée (prp/05, section 7 :
  // « rien ne bouge sur un lieu de littoral »).
  await expect(page.locator("#jauge-section")).toBeVisible();
  await expect(page.locator("#entete-absence-maree")).toBeHidden();

  // VAGUES_M = 1.2 (stub-serveur.js) : la houle est bien dans les vignettes.
  await expect(page.locator("#heures-rangee")).toContainText("1.2", { timeout: 10_000 });

  await expect(page.locator("#bouton-lieu-texte")).toHaveText("Le Touquet-Test");
});

test("intérieur : la fiche annonce l'absence, puis la section marée quitte la tête d'écran — jamais la carte d'indisponibilité", async ({ page }) => {
  const { dialogue, fiche } = await ouvrirEtChercher(page, "interieur");

  await expect(fiche).toContainText("Arras-Test");
  await expect(fiche).toContainText("INTÉRIEUR");
  await expect(fiche).toContainText("Pas de marée");
  // « point de mesure », jamais « côte » (critique du 21 aout 2026,
  // constat 1 / correction objective) : ce qui est loin, c'est le point de
  // mesure de marée le plus proche du catalogue, pas la mer elle-même.
  await expect(fiche).toContainText("point de mesure le plus proche à");
  await expect(fiche).not.toContainText("côte");
  await expect(fiche).toContainText("Pas d’état de la mer");
  await expect(fiche).not.toContainText("Marée — disponible");
  await expect(fiche).not.toContainText("on verra sur place");

  await fiche.click();
  await expect(dialogue).toBeHidden();

  // La section MAREE entiere quitte la tete d'ecran (prp/05, section 7 ;
  // critique du 21 aout 2026, "Montre, pas tranche" § 3 : 280 px mesurés du
  // titre à la fin du cadre pointillé pour une absence, sur un écran de
  // téléphone déjà court) : l'absence devient une ligne sous le nom du lieu,
  // dans l'en-tête.
  await expect(page.locator("#jauge-section")).toBeHidden();
  const absence = page.locator("#entete-absence-maree");
  await expect(absence).toBeVisible();
  await expect(absence).toContainText("Pas de marée à Arras-Test");
  await expect(absence).toContainText("le point de mesure de marée le plus proche est à");
  await expect(absence).not.toContainText("côte");

  // La régression que ce PRP redoute le plus : une absence légitime ne doit
  // JAMAIS prendre le gabarit de panne (carteIndisponible), nulle part sur
  // l'écran — les trois autres sections fonctionnent normalement ici.
  await expect(page.locator(".indisponible-carte")).toHaveCount(0);

  // La houle a disparu des vignettes (wave_height nul pour ce lieu, stub) :
  // aucune donnée de vagues à afficher, jamais un zéro inventé.
  await expect(page.locator("#heures-rangee")).toContainText("21°", { timeout: 10_000 });
  await expect(page.locator("#heures-rangee")).not.toContainText("1.2 m");
});

test("capacité vraiment inconnue (littoral) mais marée connaissable via le catalogue — jamais une réponse « du tac au tac »", async ({ page }) => {
  const { dialogue, fiche } = await ouvrirEtChercher(page, "inconnu");

  await expect(fiche).toContainText("Zone-Test");
  // littoral: null n'affiche ni LITTORAL ni INTERIEUR — mais un TROISIEME
  // repère plutôt qu'une pastille vide (critique du 21 aout 2026,
  // heuristique 1 : une pastille vide ne se distingue pas d'un oubli).
  await expect(fiche).not.toContainText("LITTORAL");
  await expect(fiche).not.toContainText("INTÉRIEUR");
  await expect(fiche.locator(".pastille-littoral--inconnu")).toHaveText("À VÉRIFIER");

  // Correction de fond (constat 1, critique du 21 aout 2026, soir) : la
  // marée vient du catalogue api-maree.fr, pas de l'appel marin — elle
  // reste connaissable ici MÊME si le marin est muet pour ce lieu
  // (Zone-Test est à plus de 600 km de tout site du catalogue, voir
  // stub-serveur.js). Avant le correctif, cette fiche affichait « Marée —
  // on verra sur place » et l'écran principal répondait « Pas de marée » du
  // tac au tac au clic suivant — l'écran qui doit annoncer AVANT se taisait.
  await expect(fiche).toContainText("Pas de marée — la Méditerranée n’est pas couverte");

  // L'état de la mer, lui, dépend vraiment de l'appel marin (muet ici) :
  // seule ligne encore INCONNUE sur cette fiche — jamais deux lignes
  // identiques sans sujet (correctif P1, même critique, à ne pas rouvrir).
  const inconnues = fiche.locator(".capacite--inconnue");
  await expect(inconnues).toHaveCount(1);
  await expect(inconnues.first()).toContainText("État de la mer — on verra sur place");
  await expect(fiche.locator(".capacite--absente")).toHaveCount(1);

  await fiche.click();
  await expect(dialogue).toBeHidden();

  // La promesse du PRP tenue : l'écran principal dit EXACTEMENT ce que la
  // fiche avait déjà annoncé, jamais une réponse « du tac au tac ».
  await expect(page.locator("#jauge-section")).toBeHidden();
  const absence = page.locator("#entete-absence-maree");
  await expect(absence).toBeVisible();
  await expect(absence).toContainText("Pas de marée à Zone-Test");
  await expect(absence).toContainText("n’est pas couvert par ce fournisseur");
  await expect(page.locator(".indisponible-carte")).toHaveCount(0);
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

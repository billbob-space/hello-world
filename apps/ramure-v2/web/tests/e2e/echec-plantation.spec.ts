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

  // Critique 2026-08-23 N4/N5 : l'accueil, lui, REVIENT -- c'est le seul
  // rebond possible sans arbre. Il reste visible ET estompe (dimme, jamais
  // masque) : la bande dit "plante un autre nom", et le mur en dessous en
  // est le moyen.
  await expect(page.locator("#accueil")).toBeVisible();
  await expect(page.locator("#accueil")).toHaveClass(/estompe/);
  // Critique 2026-08-23-c (troisieme passage) : l'opacite porte sur #mur
  // SEUL, pas sur #accueil entier -- opacity se compose avec ses
  // descendants, et la dimmer sur #accueil aurait aussi dimme
  // .accueil-barre (intertitre + tri) sous le seuil de contraste WCAG 2.2
  // AA (mesure : 3,28:1 et 1,70:1). C'est le mur, "le plan precedent", que
  // §17 Q6 estompe ; la barre est l'UI courante, jamais la selection
  // passee -- elle reste lisible.
  await expect(page.locator("#mur")).toHaveCSS("opacity", "0.4");
  await expect(page.locator(".accueil-barre")).toHaveCSS("opacity", "1");
  // Constat 2026-08-23 N1 : l'accueil qui revient ici NE PASSE PAS par
  // afficherAccueil() (traiterEchecPlantation pose accueilSection.hidden
  // directement) -- sans le correctif, le champ gardait le placeholder
  // ordinaire pose par masquerAccueil() au lieu de la promesse que
  // l'accueil doit montrer, exactement quand le visiteur vient d'echouer.
  await expect(page.locator("#graine")).toHaveAttribute(
    "placeholder",
    "Plante un nom, saute de branche en branche.",
  );
  // Zoom, dezoom et partage n'ont de sens que sur un arbre : masques (N6).
  await expect(page.locator("#zoomer-avant")).toBeHidden();
  await expect(page.locator("#zoomer-arriere")).toBeHidden();
  await expect(page.locator("#partager")).toBeHidden();
  // Les six tuiles de l'amorcage editorial sont toutes la.
  await expect(page.locator(".tuile")).toHaveCount(6);
});

test("les tuiles de l'accueil restent cliquables pendant l'echec (N5) -- contrairement a l'arbre, qui reste inerte", async ({ page }) => {
  const scenario = new ScenarioAPI();
  scenario.definirCentre("Zzzt", centreVide('Aucun artiste ne correspond a "Zzzt".'));
  await installerAPI(page, scenario);
  await page.goto(`${BASE_URL}/`);

  await planter(page, "Zzzt");
  await expect(page.locator("#echec-plantation")).toBeVisible();
  await expect(page.locator("#accueil")).toHaveClass(/estompe/);

  // #accueil.estompe n'a PAS pointer-events:none (a la difference de
  // #canevas.estompe) : une tuile EST le rebond que la bande propose.
  await expect(page.locator("#accueil")).not.toHaveCSS("pointer-events", "none");
  await page.getByRole("button", { name: "Planter Portishead" }).click();
  // La tentative a bien ete jouee -- la bande se met a jour avec le nom de
  // la tuile cliquee, preuve que le clic n'a pas ete absorbe.
  await expect(page.locator("#echec-plantation")).toContainText("Portishead");
});

// PRODUCT.md §17 Q11 (decision du 23 aout 2026, variante A retenue -- "la
// bande pousse le mur"). Le test PRECEDENT porte le nom "la barre de
// l'accueil reste cliquable" depuis avant cette decision, mais ne clique
// qu'une TUILE -- qui est sous le mur, jamais sous .accueil-barre, et l'a
// toujours ete : il ne prouvait donc RIEN sur la barre elle-meme et
// passait deja avec le defaut (critique 2026-08-23-c, N1, "couverture").
// Le defaut mesure par N1 : #echec-plantation recouvrait ENTIEREMENT
// .accueil-barre (intertitre + tri) aux deux largeurs -- le tri restait
// focalisable au clavier (tabIndex 0) mais totalement invisible et
// injoignable au pointeur (`elementFromPoint` au centre du tri rendait
// #echec-plantation), un manquement a WCAG 2.2 2.4.11 qu'aucune regle
// axe-core ne detecte. Ce test-ci clique reellement CE QUE SON NOM promet.
for (const [libelle, largeur, hauteur] of [
  ["@1440", 1440, 900],
  ["@390", 390, 844],
] as const) {
  test(`la barre de l'accueil (#tri) reste visible ET cliquable pendant l'echec, jamais seulement focalisable ${libelle} (§17 Q11, N1)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: hauteur });
    const scenario = new ScenarioAPI();
    scenario.definirCentre("Zzzt", centreVide('Aucun artiste ne correspond a "Zzzt".'));
    await installerAPI(page, scenario);
    await page.goto(`${BASE_URL}/`);

    await planter(page, "Zzzt");
    await expect(page.locator("#echec-plantation")).toBeVisible();
    await expect(page.locator("#tri")).toBeVisible();

    // Le defaut EXACT mesure par la critique : le centre du tri repondait
    // #echec-plantation, jamais #tri lui-meme -- covert a 100 %, aux deux
    // largeurs. Reproduit ici avec le meme outil de mesure (elementFromPoint).
    const auCentreDuTri = await page.evaluate(() => {
      const tri = document.querySelector("#tri")!;
      const r = tri.getBoundingClientRect();
      const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return el === tri;
    });
    expect(auCentreDuTri, "le point au centre du tri doit rendre le tri, pas la bande d'echec par-dessus").toBe(true);

    // Cliquable pour de vrai, pas seulement focalisable : changer sa valeur
    // doit reussir, comme n'importe quel select non recouvert.
    await expect(page.locator("#tri")).toHaveValue("recents");
    await page.selectOption("#tri", "alphabetique");
    await expect(page.locator("#tri")).toHaveValue("alphabetique");

    // Geometrie : la bande ne recouvre plus rien -- elle POUSSE l'accueil,
    // elle ne se superpose plus a sa barre (§17 Q11, "rien ne recouvre
    // rien"). Une marge de 0,5px absorbe l'arrondi de mise en page.
    const bande = await page.locator("#echec-plantation").boundingBox();
    const barre = await page.locator(".accueil-barre").boundingBox();
    if (!bande || !barre) throw new Error("geometrie introuvable");
    expect(
      barre.y,
      `la barre (y=${barre.y}) doit commencer au niveau ou apres le bas de la bande (${bande.y + bande.height})`,
    ).toBeGreaterThanOrEqual(bande.y + bande.height - 0.5);
  });
}

// PRODUCT.md §17 Q11, "condition explicite" : le cout (44px de mur a 1440,
// 82px a 390) ne devient un defaut QUE si le plafond de §17 Q9 n'est pas
// reevalue a l'apparition ET a la disparition de la bande -- sinon la
// derniere rangee resterait rognee tant qu'elle est la. A 1440, les 6
// tuiles de l'amorcage editorial tiennent TOUJOURS sur une seule rangee
// (bien plus de 6 colonnes a cette largeur, §17 Q8/Q9) : aucune hauteur de
// fenetre ne peut donc les faire deborder, et ce test ne peut etre probant
// qu'a 390 (2 colonnes, 3 rangees necessaires) -- voir accueil-mur.spec.ts
// pour la mesure de hauteur (avec/sans bande) aux DEUX largeurs.
test("le plafond du mur (§17 Q9) est reevalue a l'apparition ET a la disparition de la bande @390 (§17 Q11)", async ({
  page,
}) => {
  // Hauteur choisie plus courte que le 844 habituel : a 390x844, les 6
  // tuiles de l'amorcage editorial tiennent DEJA en 3 rangees meme une
  // fois la bande apparue (mesure : #mur passe de 691 a ~628px, encore
  // au-dessus des ~581px necessaires pour 3 rangees a cette largeur) --
  // ce test a besoin d'une marge plus fine pour etre probant, sans
  // dependre de la longueur exacte du message d'echec (qui fixe la
  // hauteur de la bande, cf accueil-mur.spec.ts pour cette mesure-la).
  await page.setViewportSize({ width: 390, height: 760 });
  const scenario = new ScenarioAPI();
  scenario.definirCentre("Zzzt", centreVide('Aucun artiste ne correspond a "Zzzt".'));
  await installerAPI(page, scenario);
  await page.goto(`${BASE_URL}/`);
  await expect(page.locator("#accueil")).toBeVisible();

  const masquees = () =>
    page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>(".mur-item")).filter((i) => i.hidden).length);

  await expect(page.locator(".mur-item")).toHaveCount(6);
  expect(await masquees(), "avant tout echec, la zone doit porter les 6 tuiles a cette hauteur -- sinon ce test ne serait pas probant").toBe(0);

  await planter(page, "Zzzt");
  await expect(page.locator("#echec-plantation")).toBeVisible();
  await expect
    .poll(masquees, "la bande reduit #mur : au moins une tuile doit sortir de la capacite")
    .toBeGreaterThan(0);

  // Aucune tuile masquee n'est atteignable au clavier (§17 Q9, inchange).
  const focusEchoue = await page.evaluate(() => {
    const masque = Array.from(document.querySelectorAll<HTMLElement>(".mur-item")).find((i) => i.hidden);
    const bouton = masque?.querySelector<HTMLButtonElement>("button");
    bouton?.focus();
    return document.activeElement !== bouton;
  });
  expect(focusEchoue, "une tuile masquee par le nouveau plafond ne doit jamais recevoir le focus").toBe(true);

  // Retour a l'accueil : la bande se leve, #mur retrouve sa hauteur pleine,
  // le plafond doit suivre dans l'AUTRE sens -- c'est le second sens de
  // "a l'apparition ET a la disparition" que §17 Q11 exige explicitement.
  await page.locator("#logo").click();
  await expect(page.locator("#echec-plantation")).toBeHidden();
  await expect.poll(masquees, "la bande levee, les 6 tuiles doivent redevenir visibles").toBe(0);
});

test("la fiche du centre reste a 0,4 d'opacite derriere la bande, arbre existant (N7, contrairement a l'accueil)", async ({ page }) => {
  const scenario = new ScenarioAPI();
  scenario.definirCentre("Artiste Connu", centreOK("Artiste Connu", { branches: [branche("Voisin Connu", { affinite: 0.9 })] }));
  scenario.definirCentre("Fotte De Frappe", centreVide('Aucun artiste ne correspond a "Fotte De Frappe".'));
  await installerAPI(page, scenario);
  await page.goto(`${BASE_URL}/`);

  await planter(page, "Artiste Connu");
  await expect(page.locator("#fiche")).toBeVisible();

  await planter(page, "Fotte De Frappe");
  await expect(page.locator("#echec-plantation")).toBeVisible();
  await expect(page.locator("#fiche")).toHaveClass(/estompe/);
  await expect(page.locator("#fiche")).toHaveCSS("opacity", "0.4");
  await expect(page.locator("#fiche")).toHaveCSS("pointer-events", "none");
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

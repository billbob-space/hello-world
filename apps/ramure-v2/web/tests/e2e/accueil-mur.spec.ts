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
//
// PRODUCT.md §17 Q8 (decision du 23 aout 2026, variante C) : la rangee
// n'est plus centree dans le vide, elle est CALEE en haut -- ce fichier
// mesure desormais aussi ce calage (vide haut minimal, vide bas qui
// absorbe tout le reste), jamais seulement la forme des tuiles.
//
// PRODUCT.md §17 Q9 (decision du 23 aout 2026) : au-dela de la capacite
// mesuree de la zone, le mur n'affiche plus une rangee coupee par
// `overflow: hidden` -- les tuiles en trop sont retirees de la page ET de
// l'arbre d'accessibilite (`hidden`), jamais laissees invisibles-mais-
// tabulables. Verifie ci-dessous avec un viewport dont la hauteur est
// deliberement trop courte pour porter les 6 tuiles de l'amorcage
// editorial (web/src/main.ts, AMORCAGE_EDITORIAL) en plusieurs rangees.
//
// PRODUCT.md §17 Q10 (decision du 23 aout 2026, variante C -- "le mur
// possede le haut") : le calage haut, le carre, la grille centree, le
// plafond et le plancher ne bougent pas, mais ce que le haut de l'accueil
// LAISSE au mur, si -- header + .accueil-barre passent de 121,6px a
// ~100px a 1440 (critique 2026-08-23-b, N3), et ne doivent PAS grandir a
// 390 (188,6px avant cette decision). Comme le plafond (§17 Q9) est lu
// sur la hauteur REELLE du conteneur, un haut qui grandirait ferait
// RECULER la capacite du mur sans qu'aucun test de cette suite ne s'en
// apercoive -- d'ou le test dedie plus bas, qui mesure le haut ET la
// hauteur qu'il laisse au mur, jamais l'un sans l'autre.
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

  // §17 Q8 (variante C, 23 aout 2026) : la rangee est CALEE en haut, plus
  // centree dans le vide. Vide haut minimal (padding de .mur seul) ; vide
  // bas qui absorbe tout le reste -- valeurs citees par la decision :
  // ~8px en haut, ~539px en bas pour ces six tuiles a 1440x900.
  const ys = await tuiles.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().bottom));
  const videHaut = (await tuiles.first().boundingBox())!.y - murBox.y;
  const videBas = murBox.y + murBox.height - Math.max(...ys);
  expect(videHaut, `vide haut mesure a 1440 : ${videHaut.toFixed(1)}px`).toBeLessThan(20); // padding (8px) + arrondi
  expect(videBas, `vide bas mesure a 1440 : ${videBas.toFixed(1)}px`).toBeGreaterThan(videHaut * 10); // la quasi-totalite du vide est en bas
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

test("mur d'accueil -- plus de tuiles que la capacite : aucune hors zone, aucune masquee atteignable au clavier (§17 Q9)", async ({
  page,
}) => {
  // 390x400 : les 2 colonnes de l'ecran etroit imposent des tuiles de
  // 183 px de cote (carre, aspect-ratio: 1) -- une hauteur trop courte
  // pour porter les 3 rangees des 6 tuiles de AMORCAGE_EDITORIAL
  // (web/src/main.ts) en entier, mais assez haute pour qu'UNE rangee
  // complete tienne sans etre elle-meme rognee (mesure empiriquement en
  // ecrivant ce test : en dessous, la rangee retenue deborde par le bas
  // -- comportement assume par §17 Q9, "une fenetre trop courte pour une
  // seule rangee montre quand meme cette rangee", hors de portee de ce cas).
  await page.setViewportSize({ width: 390, height: 400 });
  await installerAPI(page, new ScenarioAPI());
  await page.goto(`${BASE_URL}/`);
  await expect(page.locator("#accueil")).toBeVisible();

  const items = page.locator(".mur-item");
  await expect(items).toHaveCount(6); // AMORCAGE_EDITORIAL au complet, cote DOM

  const murBox = await page.locator("#mur").boundingBox();
  if (!murBox) throw new Error("#mur introuvable");

  const etat = await page.evaluate(() => {
    const conteneurBox = document.querySelector("#mur")!.getBoundingClientRect();
    const tousLesItems = Array.from(document.querySelectorAll<HTMLElement>(".mur-item"));
    const visibles = tousLesItems.filter((i) => !i.hidden);
    const masques = tousLesItems.filter((i) => i.hidden);
    const boxesVisibles = visibles.map((i) => i.querySelector(".tuile")!.getBoundingClientRect());
    const horsZone = boxesVisibles.filter(
      (r) =>
        r.top < conteneurBox.top - 0.5 ||
        r.bottom > conteneurBox.bottom + 0.5 ||
        r.left < conteneurBox.left - 0.5 ||
        r.right > conteneurBox.right + 0.5,
    ).length;
    return { total: tousLesItems.length, visibles: visibles.length, masques: masques.length, horsZone };
  });

  // La capacite mesuree a ce viewport est strictement inferieure aux 6
  // tuiles de l'amorcage : sans quoi ce test ne verifierait rien.
  expect(etat.masques, "au moins une tuile doit deborder de la capacite pour que ce test soit probant").toBeGreaterThan(0);
  expect(etat.visibles + etat.masques).toBe(etat.total);
  expect(etat.horsZone, "aucune tuile VISIBLE ne doit deborder, meme partiellement, de la zone du mur").toBe(0);

  // Aucune tuile masquee n'est atteignable au clavier : Tab depuis le
  // corps de page ne doit jamais y poser le focus, et un focus()
  // PROGRAMMATIQUE direct doit echouer -- `hidden` retire l'element du
  // flux (regle globale `[hidden]{display:none!important}`, index.html).
  const focusEchoue = await page.evaluate(() => {
    const masque = Array.from(document.querySelectorAll<HTMLElement>(".mur-item")).find((i) => i.hidden);
    const bouton = masque?.querySelector<HTMLButtonElement>("button");
    bouton?.focus();
    return document.activeElement !== bouton;
  });
  expect(focusEchoue, "une tuile masquee ne doit jamais pouvoir recevoir le focus").toBe(true);
});

// Critique 2026-08-23 (second passage), N1 : les trois tests ci-dessus
// dimensionnent tous AVANT `goto` -- aucun ne charge la page puis
// redimensionne la fenetre EN PLACE. C'est ce trou qui laissait passer un
// mur repeint en entier (donc un tri "aleatoire" rebattu) a chaque
// evenement `resize` : ce test-ci charge large, ou tout tient, puis
// retrecit sans recharger, et attend que le plafond suive.
test("mur d'accueil -- un redimensionnement SANS rechargement replafonne (§17 Q9)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installerAPI(page, new ScenarioAPI());
  await page.goto(`${BASE_URL}/`);
  await expect(page.locator("#accueil")).toBeVisible();

  const items = page.locator(".mur-item");
  await expect(items).toHaveCount(6); // AMORCAGE_EDITORIAL au complet

  const masquesAvant = await page.evaluate(
    () => Array.from(document.querySelectorAll<HTMLElement>(".mur-item")).filter((i) => i.hidden).length,
  );
  expect(masquesAvant, "a 390x844 la zone porte les 6 tuiles : rien ne doit etre masque avant redimensionnement").toBe(
    0,
  );

  // Meme largeur (les colonnes ne bougent pas), hauteur reduite a la valeur
  // du test precedent -- reproduit le geste "retracter la barre d'URL" ou
  // "faire pivoter le telephone", jamais un rechargement.
  await page.setViewportSize({ width: 390, height: 400 });
  // `resize` n'est pas emis par `setViewportSize` dans tous les moteurs :
  // on le declenche explicitement pour isoler ce que le gestionnaire fait,
  // independamment de ce que le navigateur choisit d'emettre.
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));

  const masquesApres = await page.evaluate(
    () => Array.from(document.querySelectorAll<HTMLElement>(".mur-item")).filter((i) => i.hidden).length,
  );
  expect(masquesApres, "le retrecissement doit masquer au moins une tuile, sans recharger la page").toBeGreaterThan(
    0,
  );
});

// PRODUCT.md §17 Q10 (decision du 23 aout 2026) : le haut de l'accueil
// (header + .accueil-barre) tient sa cible de hauteur, ET -- ce que
// mesurer sa seule hauteur ne prouverait pas -- la zone qu'il LAISSE au
// mur (#mur, `height: 100%` de la ligne `1fr` du grid `.accueil`, §07)
// augmente en consequence, jamais l'inverse. Bornes reprises de la
// critique 2026-08-23-b (N3, mesures AVANT cette decision) : 121,6px puis
// 188,6px.
test("le haut de l'accueil tient sa cible (~100px a 1440, pas de croissance a 390) et laisse PLUS de hauteur au mur (§17 Q10)", async ({
  page,
}) => {
  async function mesurerHaut(largeur: number, hauteur: number) {
    await page.setViewportSize({ width: largeur, height: hauteur });
    await installerAPI(page, new ScenarioAPI());
    await page.goto(`${BASE_URL}/`);
    await expect(page.locator("#accueil")).toBeVisible();
    const header = await page.locator("header").boundingBox();
    const barre = await page.locator(".accueil-barre").boundingBox();
    const mur = await page.locator("#mur").boundingBox();
    if (!header || !barre || !mur) throw new Error("geometrie du haut introuvable");
    return { haut: header.height + barre.height, hauteurMur: mur.height };
  }

  const AVANT_1440 = 121.6; // critique 2026-08-23-b, N3 -- mesure avant §17 Q10
  const AVANT_390 = 188.6;

  const g1440 = await mesurerHaut(1440, 900);
  expect(g1440.haut, `haut mesure a 1440 : ${g1440.haut.toFixed(1)}px (cible ~100px)`).toBeLessThan(110);
  expect(
    g1440.hauteurMur,
    `hauteur laissee au mur a 1440 : ${g1440.hauteurMur.toFixed(1)}px`,
  ).toBeGreaterThan(900 - AVANT_1440);

  const g390 = await mesurerHaut(390, 844);
  expect(g390.haut, `haut mesure a 390 : ${g390.haut.toFixed(1)}px (ne doit pas depasser l'avant)`).toBeLessThanOrEqual(
    AVANT_390,
  );
  expect(
    g390.hauteurMur,
    `hauteur laissee au mur a 390 : ${g390.hauteurMur.toFixed(1)}px`,
  ).toBeGreaterThanOrEqual(844 - AVANT_390);
});

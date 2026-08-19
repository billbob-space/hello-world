// apps/ramure-v2/web/tests/e2e/collection-hors-ligne.spec.ts
//
// PRP 09, tache 1 : F-33, "sans compte ou sans reseau, la collection reste
// utilisable localement et se reconcilie a la reconnexion, sans perte ni
// doublon" -- le TROISIEME point explicitement demande par ce chantier
// (avec F-14 et F-42) : un VRAI cycle hors ligne -> modification -> retour
// en ligne, dans un vrai navigateur. web/tests/collection.test.ts (DOM
// simule) verifie deja MiroirHorsLigne.vue()/confirmer() en isolation,
// avec des tableaux ecrits a la main -- jamais le cablage reel : un vrai
// clic pendant que le navigateur est reellement hors ligne
// (context.setOffline), puis une vraie reconnexion qui rejoue les
// changements en attente (window "online", web/src/main.ts).
import { expect, test } from "@playwright/test";
import { branche, centreOK, ficheDe, ScenarioAPI, installerAPI } from "./support/api";
import { BASE_URL, demarrerServeur, type ServeurRamure } from "./support/serveur";

let serveur: ServeurRamure;

test.beforeAll(async () => {
  serveur = await demarrerServeur();
});

test.afterAll(async () => {
  await serveur.arreter();
});

test("F-33 -- cycle hors ligne reel : garder hors ligne, puis reconciliation au retour en ligne", async ({ page, context }) => {
  await page.addInitScript(() => {
    (window as unknown as { RAMURE_SW_DESACTIVE?: boolean }).RAMURE_SW_DESACTIVE = true;
  });

  const scenario = new ScenarioAPI();
  scenario.definirCentre("Artiste Hors Ligne", centreOK("Artiste Hors Ligne", { branches: [branche("Voisin")] }));
  scenario.definirFiche("Artiste Hors Ligne", ficheDe("Artiste Hors Ligne"));
  await installerAPI(page, scenario);

  await page.goto(`${BASE_URL}/`);
  await page.fill("#graine", "Artiste Hors Ligne");
  await page.locator("#recherche button[type=submit]").click();
  await expect(page.locator('.noeud[data-id="centre"]')).toHaveAttribute("aria-label", "Artiste Hors Ligne");

  const boutonGarder = page.locator(".fiche-garder");
  await expect(boutonGarder).toHaveText("Garder cet artiste");

  // --- Vraiment hors ligne : emulation navigateur (context.setOffline) +
  // requetes qui echouent pour de vrai (support/api.ts, ScenarioAPI.horsLigne
  // -- voir son commentaire : l'emulation seule ne suffit pas a faire
  // echouer une route deja interceptee par ce mock). ------------------
  await context.setOffline(true);
  scenario.horsLigne = true;

  await boutonGarder.click();

  // F-33 : la collection reste UTILISABLE localement -- le bouton reflete
  // le geste IMMEDIATEMENT (miroir hors ligne, web/src/main.ts
  // ajouterALaCollection), sans attendre un reseau qui n'est pas la.
  await expect(boutonGarder).toHaveText("Deja garde");
  await expect(boutonGarder).toHaveAttribute("aria-pressed", "true");

  // Le serveur (simule) n'a RIEN recu : la tentative PUT a echoue
  // silencieusement (catch{}, "reste en attente dans le miroir").
  expect(scenario.collection).toHaveLength(0);

  // Le miroir hors ligne (localStorage, PAS le serveur) porte deja
  // l'ajout en attente -- verifie directement, c'est la structure que
  // web/tests/collection.test.ts connait par son nom (MiroirHorsLigne).
  const miroirBrut = await page.evaluate(() => window.localStorage.getItem("ramure:collection:miroir"));
  const miroir = JSON.parse(miroirBrut ?? "{}") as { ajouts?: { nom: string }[] };
  expect(miroir.ajouts?.map((a) => a.nom)).toEqual(["Artiste Hors Ligne"]);

  // --- Retour en ligne : reconciliation reelle, un evenement "online" a
  // la fois (context.setOffline(false) ne garantit pas, seul, que Chromium
  // headless emette l'evenement DOM cote page dans tous les cas ; le
  // dispatch explicite ci-dessous exerce PRECISEMENT le meme gestionnaire
  // que web/src/main.ts cable sur `window.addEventListener("online", ...)`,
  // sans dependre d'un comportement de plateforme non garanti). ----------
  scenario.horsLigne = false;
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  // F-33, "se reconcilie a la reconnexion, sans perte ni doublon" : le
  // serveur simule recoit ENFIN l'ajout, exactement une fois.
  await expect.poll(() => scenario.collection.length).toBe(1);
  expect(scenario.collection[0]?.nom).toBe("Artiste Hors Ligne");
  expect(scenario.collection[0]?.mbid).toBeTruthy();

  // Defaut #6 (REFERENCE.md) corrige : `synchroniserMiroir()` (web/src/main.ts,
  // sur l'evenement "online") appelle desormais `miroir.confirmer()` apres le
  // rafraichissement de `collectionServeur` -- le miroir local est PURGE des
  // qu'une entree est reconnue par le serveur, jamais renvoye (PUT) a un
  // futur evenement "online".
  const ajoutsRestants = await page.evaluate(() => {
    const brut = window.localStorage.getItem("ramure:collection:miroir");
    return (JSON.parse(brut ?? "{}") as { ajouts?: { nom: string }[] }).ajouts?.map((a) => a.nom) ?? [];
  });
  expect(ajoutsRestants).toEqual([]);

  // Le bouton reste coherent apres la reconciliation -- aucun "sursaut"
  // visuel (F-28) alors que la source de verite vient de changer sous lui.
  await expect(boutonGarder).toHaveText("Deja garde");
});

test("F-33 -- un retrait hors ligne ne ressuscite pas a la reconnexion", async ({ page, context }) => {
  await page.addInitScript(() => {
    (window as unknown as { RAMURE_SW_DESACTIVE?: boolean }).RAMURE_SW_DESACTIVE = true;
  });

  const scenario = new ScenarioAPI();
  scenario.definirCentre("Artiste Deja Garde", centreOK("Artiste Deja Garde", { branches: [branche("Voisin")] }));
  scenario.definirFiche("Artiste Deja Garde", ficheDe("Artiste Deja Garde"));
  // Deja present cote "serveur" AVANT que le navigateur ne charge quoi que
  // ce soit -- imite un artiste garde depuis un autre appareil (F-32).
  const mbid = "mbid-artiste-deja-garde";
  scenario.collection = [{ nom: "Artiste Deja Garde", mbid, lignee: ["Artiste Deja Garde"], ajoute: new Date().toISOString() }];
  await installerAPI(page, scenario);

  await page.goto(`${BASE_URL}/`);
  await page.fill("#graine", "Artiste Deja Garde");
  await page.locator("#recherche button[type=submit]").click();
  const boutonGarder = page.locator(".fiche-garder");
  await expect(boutonGarder).toHaveText("Deja garde"); // reconnu des l'ouverture (F-28/F-33, actualiserCollection au demarrage)

  await context.setOffline(true);
  scenario.horsLigne = true;
  await boutonGarder.click(); // retire, hors ligne
  await expect(boutonGarder).toHaveText("Garder cet artiste");
  // Le "serveur" simule ignore toujours l'artiste : la tentative DELETE a
  // echoue silencieusement, exactement comme l'ajout du premier test.
  expect(scenario.collection.map((e) => e.mbid)).toEqual([mbid]);

  scenario.horsLigne = false;
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  // F-33, "un retrait hors ligne ne ressuscite pas a la reconnexion" : le
  // serveur simule finit par oublier l'artiste, jamais l'inverse.
  await expect.poll(() => scenario.collection.length).toBe(0);
  await expect(boutonGarder).toHaveText("Garder cet artiste");
});

// apps/ramure-v2/web/tests/e2e/mise-a-jour.spec.ts
//
// PRP 09, tache 1 : F-42/N-12, "detection -> banniere -> clic ->
// activation, en un seul passage" -- le DEUXIEME point explicitement
// demande par ce chantier (avec F-14 et F-33). web/tests/sw.test.ts (DOM
// simule) verifie deja estAppelAPI/estIllustration/estStatique -- jamais
// le VRAI cycle du Service Worker (install -> waiting -> skipWaiting ->
// controllerchange -> reload), qui n'existe que dans un vrai navigateur.
//
// Le defi propre a ce test : web/dist/sw.js est EMBARQUE dans le binaire
// Go par //go:embed (main.go) au moment de `go build`/`go run`, donc figE
// pour toute la duree de vie d'un processus serveur -- AUCUNE interception
// cote navigateur (page.route) ne peut simuler "une nouvelle version" du
// service worker lui-meme : verifie empiriquement en ecrivant ce fichier,
// `page.route()` n'intercepte PAS les requetes qu'un Service Worker emet
// pour s'installer ou se mettre a jour (seules les requetes de la PAGE le
// sont). Ce test modifie donc reellement web/dist/sw.js sur disque (un
// ARTEFACT de build, jamais suivi par git -- web/.gitignore) puis
// REDEMARRE le vrai serveur Go, qui embarque alors le nouveau contenu :
// c'est la seule facon fidele de faire vivre un VRAI second `go:embed`
// pendant la duree d'un seul test, sans toucher a main.go.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { ScenarioAPI, installerAPI } from "./support/api";
import { BASE_URL, demarrerServeur, RACINE_APP, type ServeurRamure } from "./support/serveur";

const CHEMIN_SW = join(RACINE_APP, "web/dist/sw.js");

test("F-42/N-12 -- cycle complet : detection -> banniere -> clic -> activation", async ({ page }) => {
  const contenuOriginal = readFileSync(CHEMIN_SW, "utf-8");
  let serveur: ServeurRamure | undefined;

  try {
    serveur = await demarrerServeur();

    // Service worker ACTIF pour ce test (seul de la serie) : c'est
    // precisement le mecanisme sous verification. Aucune source externe
    // sollicitee pour autant -- ScenarioAPI intercepte /api/... comme
    // partout ailleurs ; le SW, lui, ne touche jamais /api/... (sw.ts,
    // estAppelAPI, deja verifie sur DOM simule).
    await installerAPI(page, new ScenarioAPI());
    await page.goto(`${BASE_URL}/`);

    // --- Version installee : attendre un CONTROLEUR actif -------------
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const marqueurAvant = await page.evaluate(() => {
      (window as unknown as { __ramureMarqueur?: string }).__ramureMarqueur = "avant-mise-a-jour";
      return (window as unknown as { __ramureMarqueur?: string }).__ramureMarqueur;
    });
    expect(marqueurAvant).toBe("avant-mise-a-jour");

    // --- "Deploiement" d'une nouvelle version : contenu DIFFERENT de
    // sw.js sur disque, puis un VRAI redemarrage du serveur Go, qui
    // embarque ce nouveau contenu au prochain `go run .` (go:embed lit le
    // systeme de fichiers a la COMPILATION, jamais au runtime). -----------
    writeFileSync(CHEMIN_SW, `${contenuOriginal}\n// version-recette-${Date.now()}\n`, "utf-8");
    await serveur.arreter();
    serveur = await demarrerServeur();

    // --- Detection : le meme onglet, reste OUVERT (aucune navigation),
    // declenche exactement le chemin que main.ts cable sur
    // "visibilitychange" -- un evenement synthetique suffit, la propriete
    // document.visibilityState reste "visible" pendant tout ce test
    // (l'onglet n'a jamais ete masque), ce que le gestionnaire verifie. --
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

    // --- Banniere : "Une nouvelle version de RAMURE est disponible." ---
    await expect(page.locator("#mise-a-jour")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#mise-a-jour-texte")).toHaveText("Une nouvelle version de RAMURE est disponible.");
    await expect(page.locator("#mise-a-jour-appliquer")).toHaveText("Mettre a jour");

    // --- Clic -> activation -> rechargement REEL de la page -------------
    const rechargement = page.waitForEvent("load");
    await page.locator("#mise-a-jour-appliquer").click();
    await rechargement;

    // Activation prouvee par une VRAIE navigation : le marqueur pose
    // avant le clic a disparu (nouveau document, pas une manipulation DOM
    // locale) -- c'est le "controllerchange" -> window.location.reload()
    // de web/src/main.ts qui vient de s'executer.
    const marqueurApres = await page.evaluate(() => (window as unknown as { __ramureMarqueur?: string }).__ramureMarqueur);
    expect(marqueurApres).toBeUndefined();

    // La nouvelle version controle desormais la page, et la banniere
    // n'a plus lieu d'etre (rien en attente : reg.waiting est vide juste
    // apres l'activation).
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const enAttente = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return !!reg?.waiting;
    });
    expect(enAttente).toBe(false);
  } finally {
    // Restauration : web/dist n'est pas suivi par git (regenere par `npm
    // run --prefix web build` a chaque test.sh), mais laisser un fichier
    // modifie derriere ce test troublerait quiconque relance ce fichier
    // seul, sans repasser par test.sh au prealable.
    writeFileSync(CHEMIN_SW, contenuOriginal, "utf-8");
    if (serveur) await serveur.arreter();
  }
});

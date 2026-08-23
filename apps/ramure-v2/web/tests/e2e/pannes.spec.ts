// apps/ramure-v2/web/tests/e2e/pannes.spec.ts
//
// PRP 09, tache 1 : "Pannes simulees, une par cas : source vide, source en
// erreur, depassement de quota, extraits indisponibles, session expiree."
// Chaque cas est un test independant, un seul scenario simule a la fois --
// jamais deux pannes melangees dans le meme parcours, pour qu'un echec
// pointe sans ambiguite vers UNE seule cause.
import { expect, test } from "@playwright/test";
import { branche, centreOK, centrePanne, centreVide, ficheDe, ScenarioAPI, installerAPI } from "./support/api";
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
  await page.goto(`${BASE_URL}/`);
  await page.fill("#graine", nom);
  await page.locator("#recherche button[type=submit]").click();
}

// ---------------------------------------------------------------------
// 1. Source vide (F-36) : un artiste existe mais n'a AUCUN voisin connu --
// distinct d'une panne, jamais de proposition de reessayer.
// ---------------------------------------------------------------------
test("panne 1/5 -- source vide (F-36, aucun voisin connu)", async ({ page }) => {
  const scenario = new ScenarioAPI();
  scenario.definirCentre("Artiste Solitaire", {
    artiste: { nom: "Artiste Solitaire", mbid: "mbid-artiste-solitaire", pays: "", desambiguisation: "" },
    illustration: { petite: "", moyenne: "", grande: "" },
    etat: "aucun_voisin",
    message: "Aucun voisin connu pour cet artiste.",
  });
  await installerAPI(page, scenario);
  await planter(page, "Artiste Solitaire");

  // Defaut #3 (REFERENCE.md, F-36 marquee "Critique" au PRD §08) corrige :
  // reconstruireScene() (web/src/main.ts) pose le message distinctif
  // ("Aucun voisin connu...") dans #etat, ET n'appelle plus annoncer()
  // ("Nouveau centre : <nom>", differe d'un tour de boucle) que sur un etat
  // "ok" -- il n'ecrase donc plus jamais ce message avant qu'une technologie
  // d'assistance n'ait pu le lire. #etat porte deja aria-live="polite"
  // (index.html) : ce texte est lui-meme l'annonce.
  await expect(page.locator("#etat")).toHaveText("Aucun voisin connu pour cet artiste.");
  // reconstruireScene() dessine le centre INCONDITIONNELLEMENT (F-38 :
  // toujours un contenu, jamais un vide) -- ici un unique cercle nomme
  // "Artiste Solitaire", sans branche autour, ce qui est le comportement
  // attendu de F-36 pour la PARTIE visuelle (seule l'annonce vocale est en
  // cause ci-dessus).
  await expect(page.locator(".noeud")).toHaveCount(1);
  await expect(page.locator("#graine")).toBeEnabled();
  // §17 Q6 (PRODUCT.md, decision du 22 aout 2026) : un mbid REEL (l'artiste
  // est bel et bien resolu, il n'a simplement aucun voisin connu) n'est
  // JAMAIS un echec de plantation -- la bande reste masquee.
  await expect(page.locator("#echec-plantation")).toBeHidden();
});

// ---------------------------------------------------------------------
// 2. Source en erreur (F-37) : une source est indisponible -- distinct du
// vide ci-dessus, le message invite explicitement a reessayer.
// ---------------------------------------------------------------------
test("panne 2/5 -- source en erreur (F-37, invite a reessayer)", async ({ page }) => {
  const scenario = new ScenarioAPI();
  scenario.definirCentre("Artiste Malchanceux", centrePanne("les voisins de cet artiste n'ont pas pu etre charges, reessayez dans un instant."));
  await installerAPI(page, scenario);

  let statutRecu = 0;
  page.on("response", (r) => {
    if (r.url().includes("/api/centre")) statutRecu = r.status();
  });

  await planter(page, "Artiste Malchanceux");

  // §17 Q6 (PRODUCT.md, decision du 22 aout 2026, remplace l'ancien defaut
  // #3/artiste fantome) : centrePanne() ne porte JAMAIS de mbid -- c'est un
  // echec de plantation (echec.ts, estEchecDePlantation), plus un simple
  // "aucun voisin". reconstruireScene() ne dessine donc plus AUCUN centre :
  // #etat reste vide, le message distinctif de panne vit desormais dans la
  // bande pleine largeur, jamais ecrase par une annonce "Nouveau centre".
  await expect(page.locator("#etat")).toHaveText("");
  await expect(page.locator("#echec-plantation")).toBeVisible();
  await expect(page.locator("#echec-plantation")).toHaveText(
    "les voisins de cet artiste n'ont pas pu etre charges, reessayez dans un instant.",
  );
  await expect(page.locator("#echec-plantation")).toHaveAttribute("role", "alert");
  // Critique 2026-08-22 C15 : l'ancien artiste fantome (un cercle nomme du
  // texte saisi par le visiteur, JAMAIS resolu) a disparu -- aucun centre
  // n'est plus dessine sur un echec de plantation. Premier essai depuis
  // l'accueil (aucun arbre precedent) : la bande s'affiche seule (§17 Q6,
  // "cas a traiter, pas un oubli"), rien n'est estompe faute d'arbre.
  await expect(page.locator(".noeud")).toHaveCount(0);
  await expect(page.locator("#canevas")).not.toHaveClass(/estompe/);
  // internal/api/centre.go : une panne repond 503, jamais 200 -- le JSON
  // reste neanmoins exploitable (chargerCentre() ne teste jamais
  // response.ok, voir web/src/main.ts) : c'est le CONTENU qui distingue.
  await expect.poll(() => statutRecu).toBe(503);

  // F-37 : reessayer relance un VRAI chargement, jamais un echec fige --
  // ici, la source redevient disponible et l'ecran se retablit sans
  // rechargement de page.
  scenario.definirCentre("Artiste Malchanceux", centreOK("Artiste Malchanceux", { branches: [branche("Voisin Retrouve")] }));
  await page.fill("#graine", "Artiste Malchanceux");
  await page.locator("#recherche button[type=submit]").click();
  await expect(page.locator('.noeud[data-id="centre"]')).toHaveAttribute("aria-label", "Artiste Malchanceux");
  // §17 Q6 : la bande n'est pas une alerte qui s'auto-efface -- elle se
  // leve uniquement sur une plantation reussie (echec.ts,
  // masquerEchecPlantation, appelee par reconstruireScene).
  await expect(page.locator("#echec-plantation")).toBeHidden();
});

// ---------------------------------------------------------------------
// 3. Depassement de quota (N-14) : le PRD est explicite, un visiteur seul
// N'EST JAMAIS REJETE, il attend son tour -- donc simule ici par un DELAI,
// jamais une erreur, et verifie que le chargement finit par aboutir.
// ---------------------------------------------------------------------
test("panne 3/5 -- depassement de quota (N-14, attend son tour, n'echoue jamais)", async ({ page }) => {
  const scenario = new ScenarioAPI();
  scenario.definirCentre("Artiste Tres Demande", centreOK("Artiste Tres Demande", { branches: [branche("Voisin Patient")] }));
  scenario.delaiProchainCentreMs = 3_000; // simule l'attente derriere le limiteur (internal/budget)
  await installerAPI(page, scenario);

  await planter(page, "Artiste Tres Demande");

  // Pendant l'attente : un message de chargement, jamais un ecran casse ni
  // une erreur (F-38, "aucun chargement sans issue").
  await expect(page.locator("#etat")).toHaveText("Chargement de Artiste Tres Demande…");
  await expect(page.locator(".noeud")).toHaveCount(0);

  // Le chargement finit par ABOUTIR (jamais rejete, N-14) : expect.poll
  // laisse le delai artificiel s'ecouler avant de conclure a un echec.
  await expect(page.locator('.noeud[data-id="centre"]')).toHaveAttribute("aria-label", "Artiste Tres Demande", { timeout: 8_000 });
});

// ---------------------------------------------------------------------
// 4. Extraits indisponibles (F-40) : commande de lecture DESACTIVEE et
// EXPLICITE, jamais un bouton simplement inerte.
// ---------------------------------------------------------------------
test("panne 4/5 -- extraits indisponibles (F-40, commande explicite)", async ({ page }) => {
  const scenario = new ScenarioAPI();
  scenario.definirCentre("Artiste Sans Extrait", centreOK("Artiste Sans Extrait", { branches: [branche("Voisin")] }));
  scenario.definirFiche("Artiste Sans Extrait", ficheDe("Artiste Sans Extrait", { extraits: [] }));
  await installerAPI(page, scenario);

  await planter(page, "Artiste Sans Extrait");

  const lecteur = page.locator(".lecteur-bouton");
  await expect(lecteur).toHaveText("Aucun extrait disponible pour cet artiste.");
  await expect(lecteur).toBeDisabled();
  await expect(lecteur).toHaveAttribute("aria-disabled", "true");
});

// ---------------------------------------------------------------------
// 5. Session expiree (F-41) : Traefik intercepte la requete a la place du
// serveur applicatif -- jamais confondu avec une panne reseau normale.
// ---------------------------------------------------------------------
test("panne 5/5 -- session expiree (F-41, jamais confondue avec une panne reseau)", async ({ page }) => {
  const scenario = new ScenarioAPI();
  scenario.sessionExpiree = true;
  await installerAPI(page, scenario);

  await planter(page, "N'importe Quel Artiste");

  await expect(page.locator("#etat")).toContainText("Ta session a expiré.");
  const lien = page.locator("#etat a");
  await expect(lien).toHaveText("Se reconnecter");
  // Jamais le message generique de panne reseau (§09) : le remede est
  // different (se reconnecter, pas reessayer).
  await expect(page.locator("#etat")).not.toContainText("reessay");
});

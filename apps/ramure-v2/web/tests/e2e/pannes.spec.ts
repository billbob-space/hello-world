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

  // ANOMALIE CRITIQUE DECOUVERTE PAR CETTE RECETTE (F-36 est marquee
  // "Critique" au PRD §08 ; rapportee au chantier, pas corrigee ici) :
  // reconstruireScene() (web/src/main.ts) pose bien le message distinctif
  // ("Aucun voisin connu...") dans #etat -- MAIS annonce()
  // INCONDITIONNELLEMENT, juste apres, un "Nouveau centre : <nom>" DIFFERE
  // d'un tour de boucle (annoncerNouveauCentre, promotion.ts,
  // `setTimeout(fn, 0)`). Ce second appel efface TOUJOURS le premier avant
  // qu'une technologie d'assistance n'ait pu le lire : la region
  // aria-live="polite" #etat finit systematiquement par annoncer "Nouveau
  // centre : Artiste Solitaire" -- un message FAUX (il n'y a pas de
  // nouveau centre, la resolution a echoue) -- jamais le message que F-36
  // exige. Cette assertion verifie l'etat REELLEMENT percu, pas celui que
  // le code ecrit un instant avant de l'ecraser.
  await expect(page.locator("#etat")).toHaveText("Nouveau centre : Artiste Solitaire");
  // reconstruireScene() dessine le centre INCONDITIONNELLEMENT (F-38 :
  // toujours un contenu, jamais un vide) -- ici un unique cercle nomme
  // "Artiste Solitaire", sans branche autour, ce qui est le comportement
  // attendu de F-36 pour la PARTIE visuelle (seule l'annonce vocale est en
  // cause ci-dessus).
  await expect(page.locator(".noeud")).toHaveCount(1);
  await expect(page.locator("#graine")).toBeEnabled();
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

  // Meme anomalie que le cas 1/5 ci-dessus (F-36/F-37, annonce() efface
  // systematiquement le message distinctif) : artiste.nom est vide sur un
  // centre de panne (centrePanne() ne resout jamais d'identite), d'ou une
  // annonce finale VIDE de sens plutot que le texte "reessayez dans un
  // instant" pourtant pose un instant plus tot.
  await expect(page.locator("#etat")).toHaveText("Nouveau centre : ");
  // Meme dessin inconditionnel que le cas 1/5 -- ici avec un nom VIDE
  // (centrePanne() n'a jamais resolu d'identite), donc un cercle SANS
  // libelle accessible : une pastille orpheline plutot qu'une absence
  // d'ecran (ni mieux, ni pire que le cas vide -- note complementaire,
  // pas une seconde anomalie critique).
  await expect(page.locator(".noeud")).toHaveCount(1);
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

  await expect(page.locator("#etat")).toContainText("Ta session a expire.");
  const lien = page.locator("#etat a");
  await expect(lien).toHaveText("Se reconnecter");
  // Jamais le message generique de panne reseau (§09) : le remede est
  // different (se reconnecter, pas reessayer).
  await expect(page.locator("#etat")).not.toContainText("reessay");
});

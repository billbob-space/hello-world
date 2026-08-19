// apps/ramure-v2/web/tests/e2e/parcours.spec.ts
//
// PRP 09, tache 1 : le parcours complet du PRD (§13, "bout en bout") --
// "planter -> promouvoir -> remonter la lignee -> garder -> replanter ->
// partager" -- joue dans un VRAI navigateur contre le VRAI serveur Go
// (support/serveur.ts), toutes les sources externes simulees par
// interception au niveau du navigateur (support/api.ts) : jamais un appel
// reseau reel. Joue dans les DEUX dispositions (etroit et large, PRP 08
// "parite stricte") : le meme scenario, la meme suite d'assertions, deux
// largeurs de fenetre -- une regression qui ne casserait qu'une seule
// disposition ne peut pas se cacher derriere l'autre.
//
// F-14 ("remonter d'un cran") y est verifiee sur un arbre REELLEMENT
// promu par un clic (pas seulement plante) : le PRP 08 avait cable le
// bouton sans jamais l'exercer apres une VRAIE promotion, seule occasion
// ou la lignee interne (promotion.ts, GestionnaireLignee) contient plus
// qu'une simple racine.
import { expect, test } from "@playwright/test";
import { branche, centreOK, ficheDe, ScenarioAPI, installerAPI, mbidDe } from "./support/api";
import { BASE_URL, demarrerServeur, type ServeurRamure } from "./support/serveur";

const RAYON_CENTRE = 60; // web/src/main.ts, RAYON_CENTRE -- fige le contrat visuel du centre

let serveur: ServeurRamure;

test.beforeAll(async () => {
  serveur = await demarrerServeur();
});

test.afterAll(async () => {
  await serveur.arreter();
});

async function desactiverServiceWorker(page: import("@playwright/test").Page): Promise<void> {
  // README ("Installation et mise a jour") : le SEUL mecanisme documente
  // pour empecher un service worker deja installe par un test precedent de
  // fausser celui-ci (PRP 08, "ce que la suite attend de vous" n2).
  await page.addInitScript(() => {
    (window as unknown as { RAMURE_SW_DESACTIVE?: boolean }).RAMURE_SW_DESACTIVE = true;
  });
}

const DISPOSITIONS = [
  { nom: "etroit (< 60rem)", largeur: 700, hauteur: 900 },
  { nom: "large (>= 60rem)", largeur: 1280, hauteur: 900 },
] as const;

for (const disposition of DISPOSITIONS) {
  test(`parcours complet -- disposition ${disposition.nom}`, async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE_URL });
    await page.setViewportSize({ width: disposition.largeur, height: disposition.hauteur });
    await desactiverServiceWorker(page);

    const scenario = new ScenarioAPI();
    scenario.definirSuggestions("Portishread", [{ nom: "Portishead", mbid: mbidDe("Portishead"), correction: true }]);
    scenario.definirCentre(
      "Portishead",
      centreOK("Portishead", { branches: [branche("Massive Attack", { affinite: 0.9, heritiers: 2 }), branche("Tricky", { affinite: 0.6 })] }),
    );
    scenario.definirCentre(
      "Massive Attack",
      centreOK("Massive Attack", { branches: [branche("Portishead", { affinite: 0.9 }), branche("Tricky", { affinite: 0.5 })] }),
    );
    scenario.definirFiche("Portishead", ficheDe("Portishead"));
    scenario.definirFiche("Massive Attack", ficheDe("Massive Attack"));
    await installerAPI(page, scenario);

    await page.goto(`${BASE_URL}/`);

    // --- Etat A : l'accueil (§07) -------------------------------------
    await expect(page.locator("#accueil")).toBeVisible();
    await expect(page.locator("#canevas")).toBeHidden();

    // --- 1. Planter, avec une faute de frappe -------------------------
    await page.fill("#graine", "Portishread");
    await page.locator("#recherche button[type=submit]").click();

    // --- 2. Correction proposee, puis acceptee (F-03) ------------------
    const correction = page.locator("#correction");
    await expect(correction).toBeVisible();
    await expect(correction).toContainText("Tu voulais dire Portishead ?");

    // Defaut #7 (REFERENCE.md) corrige, DISPOSITION ETROITE en particulier :
    // la liste de suggestions ouverte par la frappe ("Portishread" ->
    // suggestion "Portishead", index.html #suggestions) se fermait toute
    // seule uniquement en surface (l'appel qui la peuple, debattu 200ms,
    // continuait de courir independamment et la rouvrait apres coup) -- au
    // point de RECOUVRIR physiquement le bouton "Oui, planter Portishead" en
    // disposition etroite (confirme par Playwright, qui refusait le clic
    // pendant 45s). `afficherCorrection()` ferme desormais la liste ET
    // invalide toute requete de suggestion encore en vol (fermerSuggestions,
    // main.ts) : plus besoin d'un contournement manuel (Echap) pour cliquer
    // "Oui, planter…".
    await expect(page.locator("#suggestions")).toBeHidden();

    await correction.getByRole("button", { name: "Oui, planter Portishead" }).click();
    await expect(correction).toBeHidden();

    // --- 3. L'arbre s'affiche, la fiche du centre avec lui -------------
    await expect(page.locator("#canevas")).toBeVisible();
    await expect(page.locator("#accueil")).toBeHidden();
    await expect(page.locator('.noeud[data-id="centre"]')).toHaveAttribute("aria-label", "Portishead");
    await expect(page.locator('.noeud[aria-label="Massive Attack"]')).toBeVisible();
    await expect(page.locator('.noeud[aria-label="Tricky"]')).toBeVisible();
    // Les liens rejoignent bien deux noeuds existants (verification fine
    // de geometrie : geometrie.spec.ts) ; ici on verifie seulement le
    // COMPTE : 2 branches + 2 heritiers de la premiere = 4 liens.
    await expect(page.locator(".liens line")).toHaveCount(4);

    await expect(page.locator("#fiche")).toBeVisible();
    await expect(page.locator(".fiche-titre")).toHaveText("Portishead");
    const boutonGarder = page.locator(".fiche-garder");
    await expect(boutonGarder).toHaveText("Garder cet artiste");
    await expect(boutonGarder).toHaveAttribute("aria-pressed", "false");

    // Lecteur d'extraits (F-24, F-40) : la commande existe et est
    // cliquable sans erreur. NOTE (rapportee dans les anomalies du
    // chantier) : aucun element <audio> n'est cree nulle part dans
    // fiche.ts/main.ts -- cliquer "Lire" ne produit aujourd'hui NI son NI
    // aucun changement visuel observable depuis le navigateur ; ce test ne
    // verifie donc que l'absence d'erreur, pas une lecture reelle.
    const lecteur = page.locator(".lecteur-bouton");
    await expect(lecteur).toBeEnabled();
    await lecteur.click();

    // --- 4. Promouvoir (F-11, F-12) : un clic sur une branche ----------
    await page.locator('.noeud[aria-label="Massive Attack"]').click();
    const centreApresPromotion = page.locator('.noeud[aria-label="Massive Attack"]');
    await expect(centreApresPromotion).toBeVisible();
    // La transition n'est jamais une reconstruction (F-12) : le noeud
    // promu GRANDIT jusqu'a la taille du centre -- c'est la preuve, cote
    // client, qu'une vraie promotion a eu lieu (et pas un rechargement).
    await expect(centreApresPromotion.locator("circle").first()).toHaveAttribute("r", String(RAYON_CENTRE));
    await expect(page.locator(".fiche-titre")).toHaveText("Massive Attack");
    // Precondition de F-14 : le bouton "remonter d'un cran" n'apparait
    // qu'apres une VRAIE promotion, jamais apres une simple plantation.
    await expect(page.locator("#remonter-lignee")).toBeVisible();
    await expect(page.locator("#remonter-lignee")).toHaveAttribute("aria-label", "Revenir a l'artiste precedent");

    // --- 5. F-14 : remonter d'un cran, sur un arbre REELLEMENT promu ---
    await page.locator("#remonter-lignee").click();
    await expect(page.locator('.noeud[data-id="centre"]')).toHaveAttribute("aria-label", "Portishead");
    await expect(page.locator(".fiche-titre")).toHaveText("Portishead");

    // Defaut #1 (REFERENCE.md) corrige : web/src/main.ts maintient DEUX
    // tableaux paralleles censes rester de MEME longueur (son propre
    // commentaire l'exige) -- `lignee.lignee` (promotion.ts, GestionnaireLignee,
    // en identifiants) et `ligneeNoms` (le miroir en noms lisibles). Ils se
    // desynchronisaient des qu'une plantation echouait (faute de frappe) puis
    // etait corrigee : `nomCentreCourant` valait "" sur un centre
    // "aucun_voisin" (l'artiste ne resout vers rien), une chaine FAUSSE qui
    // faisait sauter le push sur `ligneeNoms` sans empecher celui, symetrique,
    // sur `lignee.lignee`. reconstruireScene()/promouvoirVers() replient
    // desormais `nomCentreCourant` sur le nom REELLEMENT demande (jamais
    // vide) : les deux tableaux restent de meme longueur en toute
    // circonstance. Consequence OBSERVABLE, correcte cette fois : le bouton
    // reste visible ici, parce qu'il reste REELLEMENT un cran au-dessus de
    // "Portishead" dans cette session -- la tentative "Portishread" corrigee
    // avant meme la premiere promotion, qui compte elle aussi comme un
    // centre quitte (voir le commentaire de planter(), F-14).
    await expect(page.locator("#remonter-lignee")).toBeVisible();

    // --- 6. Garder (F-28) -----------------------------------------------
    await expect(boutonGarder).toHaveText("Garder cet artiste");
    await boutonGarder.click();
    await expect(boutonGarder).toHaveText("Deja garde");
    await expect(boutonGarder).toHaveAttribute("aria-pressed", "true");

    // --- 7. Replanter depuis la collection (F-31) -----------------------
    await page.locator("#logo").click(); // F-07 : retour a l'accueil propre
    await expect(page.locator("#accueil")).toBeVisible();
    await page.locator("#collection-bouton").click();
    const itemCollection = page.locator(".collection-item", { hasText: "Portishead" });
    await expect(itemCollection).toBeVisible();

    // Defaut #2 (REFERENCE.md) corrige, compose du #1 : F-30 promet "le
    // chemin de decouverte", en NOMS lisibles -- `ajouterALaCollection`
    // (main.ts) construit desormais le champ `lignee` de l'entree a partir
    // de `ligneeNoms` (des noms), jamais plus de `lignee.lignee` (les
    // IDENTIFIANTS opaques de GestionnaireLignee, promotion.ts, prefixes
    // "racine:"). Le prefixe technique a disparu ; la tentative "Portishread"
    // (avant sa correction) reste visible dans le chemin -- fidele a ce que
    // la session a REELLEMENT explore, jamais un identifiant.
    await expect(itemCollection.locator(".collection-lignee")).toHaveText("Portishread -> Portishead");
    await itemCollection.locator(".collection-replanter").click();
    await expect(page.locator("#collection")).toBeHidden(); // F-31 : ferme le panneau
    await expect(page.locator('.noeud[data-id="centre"]')).toHaveAttribute("aria-label", "Portishead");

    // --- 8. Partager (F-34) ---------------------------------------------
    await page.locator("#partager").click();
    await expect(page.locator("#etat")).toHaveText("Lien copie dans le presse-papiers.");
    const lienCopie = await page.evaluate(() => navigator.clipboard.readText());
    expect(new URL(lienCopie).searchParams.get("graine")).toBe("Portishead");
  });
}

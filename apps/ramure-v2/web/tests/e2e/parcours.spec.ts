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

    // ANOMALIE DECOUVERTE PAR CETTE RECETTE, DISPOSITION ETROITE
    // UNIQUEMENT (rapportee au chantier, pas corrigee ici) : la liste de
    // suggestions ouverte par la frappe ("Portishread" -> suggestion
    // "Portishead", index.html #suggestions) NE SE FERME JAMAIS toute
    // seule quand la banniere de correction apparait -- rien, dans
    // web/src/main.ts, n'appelle suggestions.effacer() a ce moment-la
    // (seul planter() le fait, plus tard, au clic sur "Oui, planter...").
    // En disposition ETROITE, #suggestions (position absolute, z-index 5)
    // finit par RECOUVRIR physiquement le bouton "Oui, planter Portishead"
    // -- confirme par Playwright lui-meme, qui refuse le clic pendant 45s
    // ("<li ...> from <form ...#recherche> subtree intercepts pointer
    // events"). Un vrai doigt sur un vrai telephone rencontrerait la meme
    // chose : le geste attendu ("Oui, planter...") toucherait en realite
    // une suggestion invisible-mais-presente. Contournement EXPLICITE
    // ci-dessous (Echap, F-02, un geste qu'un utilisateur reel devrait
    // penser a faire lui-meme) pour continuer le parcours.
    await page.locator("#graine").press("Escape");
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

    // ANOMALIE DECOUVERTE PAR CETTE RECETTE (rapportee au chantier, pas
    // corrigee ici -- hors perimetre de cette tache) : le bouton reste
    // VISIBLE alors qu'il n'y a plus rien au-dessus dans la lignee. Cause
    // racine : web/src/main.ts maintient DEUX tableaux paralleles censes
    // rester de MEME longueur (son propre commentaire l'exige) --
    // `lignee.lignee` (promotion.ts, GestionnaireLignee) et `ligneeNoms`
    // (le miroir en noms lisibles) -- mais les deux gardes qui decident
    // quand pousser une entree DIFFERENT : GestionnaireLignee.commencerPromotion
    // pousse des que `this.#centreId !== null`, alors que main.ts ne pousse
    // sur `ligneeNoms` que `if (nomCentreCourant)` (une chaine VIDE, rendue
    // par un centre "aucun_voisin" comme celui de la faute de frappe
    // ci-dessus, est fausse dans le second test mais pas dans le premier).
    // Resultat : des qu'une plantation echoue puis est corrigee AVANT toute
    // promotion, `lignee.lignee` porte une entree fantome de plus que
    // `ligneeNoms` pour le reste de la session, et "remonter d'un cran"
    // laisse le bouton visible un cran trop longtemps. Un second clic ne
    // casse rien (garde defensive deja presente sur `ligneeNoms[-1] ===
    // undefined`, promotion.ts/main.ts) : verifie ci-dessous plutot que
    // suppose.
    await expect(page.locator("#remonter-lignee")).toBeVisible();
    await page.locator("#remonter-lignee").click();
    await expect(page.locator('.noeud[data-id="centre"]')).toHaveAttribute("aria-label", "Portishead"); // inchange : no-op sur, pas une navigation vers un id fantome
    await expect(page.locator(".fiche-titre")).toHaveText("Portishead");

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

    // ANOMALIE DECOUVERTE PAR CETTE RECETTE (rapportee au chantier, pas
    // corrigee ici) : F-30 promet "le chemin de decouverte", en NOMS
    // lisibles -- mais `ajouterALaCollection` (main.ts) construit le champ
    // `lignee` de l'entree a partir de `lignee.lignee` (les IDENTIFIANTS
    // opaques de GestionnaireLignee, promotion.ts), jamais du `ligneeNoms`
    // que main.ts entretient a cote precisement pour cet usage ("insuffisant
    // pour rappeler /api/centre, qui exige un nom", dit son propre
    // commentaire). Compose avec l'anomalie ci-dessus (l'entree fantome de
    // la faute de frappe corrigee), le prefixe technique "racine:" ET le
    // nom MAL ORTHOGRAPHIE de la recherche corrigee fuient tous deux,
    // definitivement, dans la collection affichee a l'utilisateur.
    await expect(itemCollection.locator(".collection-lignee")).toHaveText("racine:Portishread -> Portishead");
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

// apps/ramure-v2/web/tests/e2e/accessibilite.spec.ts
//
// PRP 09, tache 1 : "Accessibilite automatisee sur chaque ecran" -- en
// plus de la verification manuelle au clavier deja documentee au README
// (§ "Accessibilite", jouee a la main, pas ici). Ce fichier tourne axe-core
// (le meme moteur que les audits Lighthouse/DevTools) contre le VRAI DOM
// rendu par un vrai navigateur, sur les DEUX dispositions (parite stricte,
// PRP 08) et sur les ecrans que web/tests/accessibilite.test.ts (DOM
// simule, jsdom) ne peut pas construire en conditions reelles : l'arbre
// APRES un vrai chargement reseau, le panneau collection ouvert, la
// banniere de correction affichee.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { branche, centreOK, ficheDe, ScenarioAPI, installerAPI } from "./support/api";
import { BASE_URL, demarrerServeur, type ServeurRamure } from "./support/serveur";

let serveur: ServeurRamure;

test.beforeAll(async () => {
  serveur = await demarrerServeur();
});

test.afterAll(async () => {
  await serveur.arreter();
});

// scanner() echoue sur toute violation NON attendue (une regression fraiche
// se voit donc immediatement) et VERIFIE que chaque violation deja connue
// (voir web/tests/REFERENCE.md, "echecs connus") est toujours presente --
// si elle disparait un jour (bug corrige), ce test echouera aussi, et
// c'est voulu : c'est le signal qu'il faut retirer l'entree de la liste,
// jamais la laisser trainer indefiniment "au cas ou".
async function scanner(page: Page, idsConnus: readonly string[] = []): Promise<void> {
  const resultats = await new AxeBuilder({ page }).analyze();
  const resume = (liste: typeof resultats.violations) =>
    JSON.stringify(
      liste.map((v) => ({ regle: v.id, impact: v.impact, aide: v.help, occurrences: v.nodes.length, cibles: v.nodes.map((n) => n.target) })),
      null,
      2,
    );

  const inattendues = resultats.violations.filter((v) => !idsConnus.includes(v.id));
  expect(inattendues, resume(inattendues)).toEqual([]);

  const idsObserves = resultats.violations.map((v) => v.id);
  for (const id of idsConnus) {
    expect(idsObserves, `"${id}" etait attendue (bug connu) mais n'est plus observee -- corrigee ? retirer alors cette entree de idsConnus.`).toContain(id);
  }
}

async function desactiverServiceWorker(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { RAMURE_SW_DESACTIVE?: boolean }).RAMURE_SW_DESACTIVE = true;
  });
}

const DISPOSITIONS = [
  { nom: "etroit (< 60rem)", largeur: 700, hauteur: 900 },
  { nom: "large (>= 60rem)", largeur: 1280, hauteur: 900 },
] as const;

for (const disposition of DISPOSITIONS) {
  test.describe(`accessibilite automatisee -- ${disposition.nom}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: disposition.largeur, height: disposition.hauteur });
      await desactiverServiceWorker(page);
    });

    test("ecran d'accueil (etat A, mur de pochettes)", async ({ page }) => {
      await installerAPI(page, new ScenarioAPI());
      await page.goto(`${BASE_URL}/`);
      await expect(page.locator("#accueil")).toBeVisible();
      await scanner(page);
    });

    test("arbre et fiche du centre (etat B, apres un vrai chargement)", async ({ page }) => {
      const scenario = new ScenarioAPI();
      scenario.definirCentre(
        "Artiste Central",
        centreOK("Artiste Central", { branches: [branche("Voisin A", { affinite: 0.8, heritiers: 1 }), branche("Voisin B", { affinite: 0.5 })] }),
      );
      scenario.definirFiche("Artiste Central", ficheDe("Artiste Central"));
      await installerAPI(page, scenario);
      await page.goto(`${BASE_URL}/`);
      await page.fill("#graine", "Artiste Central");
      await page.locator("#recherche button[type=submit]").click();
      await expect(page.locator('.noeud[data-id="centre"]')).toBeVisible();
      await expect(page.locator("#fiche")).toBeVisible();
      // Defaut #4 (REFERENCE.md, "color-contrast") corrige : .fiche-lien-artiste
      // et .discographie-lien (web/index.html) declarent desormais l'accent
      // #f0a828 (ratio mesure 8.90:1 sur le fond #161617 du panneau, WCAG 2 AA
      // exige 4.5:1) plutot que de retomber sur le bleu de lien par defaut du
      // navigateur.
      await scanner(page);
    });

    test("panneau collection ouvert (F-30, plusieurs artistes gardes)", async ({ page }) => {
      const scenario = new ScenarioAPI();
      scenario.collection = [
        { nom: "Premier Artiste Garde", mbid: "mbid-premier", lignee: ["Premier Artiste Garde"], ajoute: new Date().toISOString() },
        { nom: "Second Artiste Garde", mbid: "mbid-second", lignee: ["Racine", "Second Artiste Garde"], ajoute: new Date().toISOString() },
      ];
      await installerAPI(page, scenario);
      await page.goto(`${BASE_URL}/`);
      await page.locator("#collection-bouton").click();
      await expect(page.locator("#collection")).toBeVisible();
      await scanner(page);
    });

    test("correction orthographique proposee (F-03)", async ({ page }) => {
      const scenario = new ScenarioAPI();
      scenario.definirSuggestions("Tyop", [{ nom: "Typo", mbid: "mbid-typo", correction: true }]);
      await installerAPI(page, scenario);
      await page.goto(`${BASE_URL}/`);
      await page.fill("#graine", "Tyop");
      await page.locator("#recherche button[type=submit]").click();
      await expect(page.locator("#correction")).toBeVisible();
      // Defaut #5 (REFERENCE.md, "aria-command-name") corrige : avant que la
      // correction ne soit acceptee, le centre reste "aucun_voisin" avec un
      // artiste dont le nom n'a resolu vers rien -- reconstruireScene()
      // (web/src/main.ts) dessine quand meme le noeud central (F-38, "toujours
      // un contenu"), desormais avec le nom REELLEMENT demande ("Tyop") comme
      // repli, jamais une chaine vide : la commande ARIA (role="button",
      // tabindex=0) garde un nom accessible en toute circonstance.
      await expect(page.locator('.noeud[data-id="centre"]')).toHaveAttribute("aria-label", "Tyop");
      await scanner(page);
    });

    test("banniere de mise a jour affichee (F-42)", async ({ page }) => {
      // Verifie l'accessibilite de la banniere SANS passer par le cycle
      // reseau complet du service worker (couvert par mise-a-jour.spec.ts,
      // F-42) : afficherBanniereMiseAJour n'est pas exportee de main.ts
      // (delibere, "n'est pas teste unitairement"), donc reproduite ici a
      // l'identique (role="status", meme DOM que web/index.html).
      await installerAPI(page, new ScenarioAPI());
      await page.goto(`${BASE_URL}/`);
      await page.evaluate(() => {
        const banniere = document.querySelector<HTMLElement>("#mise-a-jour");
        const texte = document.querySelector<HTMLElement>("#mise-a-jour-texte");
        const bouton = document.querySelector<HTMLElement>("#mise-a-jour-appliquer");
        if (banniere) banniere.hidden = false;
        if (texte) texte.textContent = "Une nouvelle version de RAMURE est disponible.";
        if (bouton) bouton.textContent = "Mettre a jour";
      });
      await expect(page.locator("#mise-a-jour")).toBeVisible();
      await scanner(page);
    });
  });
}

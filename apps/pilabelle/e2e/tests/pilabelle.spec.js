// Bout en bout de pilabelle : un vrai navigateur, contre le binaire reel.
//
// Ce que cette suite garde, et que les tests Go ne peuvent pas voir : les
// ecrans s'affichent vraiment dans un navigateur, le parcours d'une seance se
// joue jusqu'au premier exercice, et le rendu reste accessible a chaque etape.
// Un test Go verifie que le serveur REND du JSON ; il ne dit rien de ce que
// le web/ en fait a l'ecran.
//
// Identite : pilabelle lit le compte dans l'en-tete X-Forwarded-User, pose en
// production par Traefik apres l'authentification en amont. Ici, aucune
// authentification ne se dresse devant le serveur natif : chaque test qui a
// besoin d'un profil neuf et isole ouvre son propre contexte navigateur avec
// un X-Forwarded-User qui lui est propre, pour ne jamais heurter le profil
// qu'un autre test a deja cree sur le meme repertoire de donnees.
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

// Les sept jours actifs (formulaire-reponses.js) : les cocher tous garantit
// que le jour ou tourne le test est un jour actif, donc que la seance du jour
// est bien "a-faire" et non "repos" (domaine.go, JourActif).
const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

async function remplirEtValiderQuestionnaire(page) {
  await page.locator('input[name="niveau"][value="debutante"]').check();
  for (const jour of JOURS) {
    await page.locator(`input[name="jour"][value="${jour}"]`).check();
  }
  await page.getByRole("button", { name: "Commencer" }).click();
}

test("la page d'accueil s'affiche", async ({ page }) => {
  const reponse = await page.goto("/");
  expect(reponse.status()).toBe(200);
  // Profil neuf (identite jamais vue) : l'ecran affiche est le questionnaire
  // de bienvenue, dont le titre est le premier h1 rendu par l'app.
  await expect(page.locator("h1").first()).toBeVisible();
});

test("la sonde de sante repond", async ({ request }) => {
  const r = await request.get("/healthz");
  expect(r.ok()).toBeTruthy();
});

// L'ACCESSIBILITE MESUREE, sur chaque ecran du parcours principal. C'est ce
// passage, et lui seul, qui rend l'accessibilite bloquante dans la chaine :
// contraste insuffisant, element inatteignable au clavier, libelle muet pour
// un lecteur d'ecran. Le reste du jugement UX appartient a l'agent
// « esthete », qui juge ce qui ne se mesure pas. Ces deux-la ne se
// remplacent pas l'un l'autre.
test("aucune violation d'accessibilite serieuse sur les ecrans visites", async ({ browser }) => {
  const contexte = await browser.newContext({
    extraHTTPHeaders: { "X-Forwarded-User": "e2e-axe@pilabelle.invalid" },
  });
  const page = await contexte.newPage();
  const violationsGraves = [];

  async function scanner(nomEcran) {
    const resultat = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    for (const v of resultat.violations) {
      if (v.impact === "serious" || v.impact === "critical") {
        // Le NOEUD fautif, et pas seulement la regle enfreinte. Une violation
        // INTERMITTENTE ne se diagnostique pas autrement : le rapport detaille
        // que Playwright ecrit dans test-results/ ne survit pas au runner, et
        // « aria-prohibited-attr sur l'ecran exercice » ne dit pas sur QUEL
        // element. Trois noeuds au plus, tronques : de quoi nommer le coupable
        // sans noyer le journal du job.
        const noeuds = (v.nodes || [])
          .slice(0, 3)
          .map((n) => `${(n.target || []).join(" ")} :: ${String(n.html || "").slice(0, 200)}`)
          .join(" | ");
        violationsGraves.push(
          `${nomEcran} : ${v.id} (${v.impact}) : ${v.help} -- ${noeuds}`,
        );
      }
    }
  }

  // Ecran 1 : le questionnaire de bienvenue (profil neuf).
  await page.goto("/");
  await expect(page.locator("h1").first()).toBeVisible();
  await scanner("questionnaire");

  await remplirEtValiderQuestionnaire(page);

  // Ecran 2 : la proposition de notifications, intercalee une seule fois
  // juste apres la creation du profil.
  await expect(page.getByText("Active les rappels et les mots doux ?")).toBeVisible();
  await scanner("proposition-notifications");
  await page.getByRole("button", { name: "Plus tard" }).click();

  // Ecran 3 : le jour, avec la seance du jour a faire.
  await expect(page.locator("h1")).toHaveText("Séance du jour");
  await scanner("jour");

  // Ecran 4 : le premier exercice de la seance.
  await page.getByRole("button", { name: "Commencer" }).click();
  await expect(page.locator("h2")).toBeVisible();
  await scanner("exercice");

  expect(violationsGraves).toEqual([]);
  await contexte.close();
});

// LE PARCOURS PRINCIPAL. pilabelle est l'app dont la couverture navigateur
// est la plus basse de la fabrique : ce test suit une utilisatrice neuve du
// questionnaire jusqu'au premier exercice guide, en verifiant que chaque
// etape produit vraiment ce que le PRD promet — pas seulement qu'elle
// s'affiche.
test("parcours principal : du questionnaire au premier exercice guide", async ({ browser }) => {
  const contexte = await browser.newContext({
    extraHTTPHeaders: { "X-Forwarded-User": "e2e-parcours@pilabelle.invalid" },
  });
  const page = await contexte.newPage();

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Bienvenue 👋" })).toBeVisible();

  await remplirEtValiderQuestionnaire(page);

  // La proposition de notifications s'intercale une seule fois : on la passe.
  await expect(page.getByText("Active les rappels et les mots doux ?")).toBeVisible();
  await page.getByRole("button", { name: "Plus tard" }).click();

  // L'ecran du jour : une seance a faire, decrite par ses etapes.
  await expect(page.getByRole("heading", { level: 1, name: "Séance du jour" })).toBeVisible();
  await expect(page.getByText(/étapes, guidées pas à pas/)).toBeVisible();
  const nombreEtapes = await page.locator("ul li").count();
  expect(nombreEtapes).toBeGreaterThan(0);

  // Le premier exercice, guide pas a pas : un titre, une consigne, un
  // chronometre qui n'affiche rien avant le geste explicite de depart.
  await page.getByRole("button", { name: "Commencer" }).click();
  await expect(page.locator("h2")).toBeVisible();
  await expect(page.locator("p.consigne")).not.toBeEmpty();
  const boutonPrincipal = page.getByRole("button", { name: "Prête" });
  await expect(boutonPrincipal).toBeVisible();

  // Demarrer le chronometre : la phase d'effort s'affiche immediatement, le
  // bouton passe a "Pause" — sans attendre la fin du decompte, deja hors du
  // perimetre de ce test.
  await boutonPrincipal.click();
  await expect(page.locator("p.phase")).toHaveText("💪 Effort");
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

  await contexte.close();
});

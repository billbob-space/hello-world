// Bout en bout de marcq-handball : un vrai navigateur, contre le binaire reel.
//
// Le parcours joue est celui d'un enfant qui ouvre le lien pour la premiere
// fois (PRD §1, §7.1) : l'ecran du prenom, puis l'ecran du jour — ce qu'il y a
// a faire aujourd'hui, le coeur du produit (PRD §4) — puis l'onglet
// « L'equipe », le second niveau de lecture (PRD §7.5). C'est le seul chemin
// qu'un utilisateur emprunte vraiment a chaque visite ; les autres ecrans
// (reglages, coach, bilan…) sont laisses de cote pour tenir le chantier dans
// sa taille.
//
// Ce que cette suite garde, et que les tests Go et node --test ne peuvent pas
// voir : la page s'affiche vraiment dans un navigateur, le formulaire se
// remplit et se soumet, la navigation par onglet fonctionne, et chaque ecran
// traverse est accessible. `vue-classement.js` et `vue-prenom.js` sont les
// moins couverts par les tests unitaires du depot (journal) : c'est
// precisement ce que ce parcours traverse.
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

async function verifierAccessibilite(page) {
  const resultat = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const graves = resultat.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(graves.map((v) => `${v.id} (${v.impact}) : ${v.help}`)).toEqual([]);
}

test("l'ecran du prenom s'affiche", async ({ page }) => {
  const reponse = await page.goto("/");
  expect(reponse.status()).toBe(200);
  // Le titre du programme, lu depuis programme.json : c'est le point de
  // repere du premier ecran, celui que le PRD §7.1 decrit comme le seul peage
  // de l'application.
  await expect(page.locator("h1").first()).toBeVisible();
  // La phrase rassurante du PRD §7.1, au mot pres : c'est elle qui rend
  // l'absence de compte credible plutot que suspecte.
  await expect(page.getByText("Ton prénom reste sur ton téléphone.")).toBeVisible();
});

test("la sonde de sante repond", async ({ request }) => {
  const r = await request.get("/healthz");
  expect(r.ok()).toBeTruthy();
});

test("le parcours principal : prenom, jour, equipe", async ({ page }) => {
  await page.goto("/");

  // Ecran 1 : le prenom (vue-prenom.js). Un champ, un bouton — l'enfant
  // saisit son prenom et ne le renvoie jamais tel quel a personne (PRD §5).
  await page.getByLabel("Ton prénom").fill("Léa");
  await page.getByRole("button", { name: "C’est parti" }).click();

  // Ecran 2 : le jour (vue-jour.js), le coeur du produit — ce qu'il y a a
  // faire aujourd'hui (PRD §4). La salutation prouve que le prenom a ete
  // retenu et que le routeur a bien enchaine sur l'ecran suivant.
  await expect(page.getByText("Salut Léa")).toBeVisible();
  await expect(page.locator("h1").first()).toBeVisible();
  // La barre de navigation n'apparait qu'une fois le prenom connu.
  await expect(page.getByRole("link", { name: "L’équipe" })).toBeVisible();

  // Ecran 3 : l'equipe (vue-classement.js), le second niveau de lecture du
  // PRD §7.5 — la comparaison, jamais devant l'ecran du jour.
  await page.getByRole("link", { name: "L’équipe" }).click();
  await expect(page.getByRole("heading", { name: "L’équipe", level: 2 })).toBeVisible();
});

// L'ACCESSIBILITE MESUREE, sur chaque ecran du parcours. C'est ce passage, et
// lui seul, qui rend l'accessibilite bloquante dans la chaine : contraste
// insuffisant, element inatteignable au clavier, libelle muet pour un
// lecteur d'ecran. Le reste du jugement UX appartient a l'agent « esthete »,
// qui juge ce qui ne se mesure pas. Ces deux-la ne se remplacent pas l'un
// l'autre.
test("aucune violation d'accessibilite serieuse sur le parcours", async ({ page }) => {
  await page.goto("/");
  await verifierAccessibilite(page); // ecran du prenom

  await page.getByLabel("Ton prénom").fill("Léa");
  await page.getByRole("button", { name: "C’est parti" }).click();
  await expect(page.getByText("Salut Léa")).toBeVisible();
  await verifierAccessibilite(page); // ecran du jour

  await page.getByRole("link", { name: "L’équipe" }).click();
  await expect(page.getByRole("heading", { name: "L’équipe", level: 2 })).toBeVisible();
  await verifierAccessibilite(page); // ecran de l'equipe
});

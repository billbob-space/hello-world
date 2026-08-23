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

// Une date figee, DANS le programme (2026-08-03 au 2026-08-21, web/programme.json),
// sur un jour QUI PORTE UNE SEANCE (2026-08-12, « Fractionné long »), ni la
// premiere ni la derniere du programme : app.js bascule la racine sur le bilan
// des que `aujourdhui` depasse `prog.fin` (PRD §9), et ces deux tests jouent le
// parcours du jour, pas celui du bilan. Sans horloge figee ils suivent la date
// systeme et deviennent rouges des le 22 aout 2026.
//
// Un jour de SEANCE, pas de repos : un jour de repos evite la barre de
// progression (barre.js, vue-jour.js) au lieu de l'exercer, et l'a longtemps
// laissee sans nom accessible sans qu'aucun test ne le voie.
const DATE_DANS_LE_PROGRAMME = "2026-08-12T12:00:00Z";

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

// Le seul bouton de l'application ne pouvait pas rester muet sur un champ vide
// (vue-prenom.js). Ce cas ne se preterait pas a `tests/vues.test.js`, qui ne
// teste jamais le montage DOM des vues par convention : on le joue ici, contre
// un vrai navigateur, exactement comme le reste du premier ecran ci-dessus.
test("un prenom vide est refuse, annonce, et ne fait pas avancer l'ecran", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "C’est parti" }).click();

  // La MEME phrase qu'aux reglages (vue-reglages.js) pour le meme refus.
  const retour = page.getByText("Il faut un prénom, même court.");
  await expect(retour).toBeVisible();
  // `role="status"` : annonce sans voler le focus, qui reste au champ.
  await expect(retour).toHaveAttribute("role", "status");
  await expect(page.getByLabel("Ton prénom")).toBeFocused();

  // Aucune navigation n'a eu lieu : l'ecran du jour ne s'est pas ouvert.
  await expect(page.getByText("Salut")).toHaveCount(0);
});

test("la sonde de sante repond", async ({ request }) => {
  const r = await request.get("/healthz");
  expect(r.ok()).toBeTruthy();
});

test("le parcours principal : prenom, jour, equipe", async ({ page }) => {
  // Doit s'installer AVANT `goto` : app.js lit la date au chargement, dans
  // son tout premier rendu.
  await page.clock.install({ time: DATE_DANS_LE_PROGRAMME });
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
  // Meme raison que le test precedent : figer la date avant `goto`, sinon le
  // parcours entier de ce test se joue sur l'ecran du bilan.
  await page.clock.install({ time: DATE_DANS_LE_PROGRAMME });
  await page.goto("/");
  // Barriere avant mesure : `index.html` livre un `<main>` vide, et `app.js` ne
  // rend qu'apres `await fetch('/programme.json')`, que `page.goto` n'attend
  // pas. Sans elle, axe analyse un ecran vide, ne trouve rien, et declare
  // l'ecran du prenom propre sans l'avoir regarde.
  await expect(page.getByLabel("Ton prénom")).toBeVisible();
  await verifierAccessibilite(page); // ecran du prenom

  await page.getByLabel("Ton prénom").fill("Léa");
  await page.getByRole("button", { name: "C’est parti" }).click();
  await expect(page.getByText("Salut Léa")).toBeVisible();
  await verifierAccessibilite(page); // ecran du jour

  // Ecran de seance (vue-seance.js) : le trou du 2026-08-22 (journal) — la
  // barre y manquait de nom accessible, et une case cochee y faisait tomber
  // le chronometre sous 4,5:1 de contraste — n'a jamais ete vu ici, ce
  // parcours ne visitant pas cet ecran. Trois cases cochees, comme la mesure
  // qui a trouve le trou : c'est l'etat qui declenchait le defaut de
  // contraste, un ecran vierge ne l'aurait pas revele.
  await page.getByRole("link", { name: "Commencer la séance" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const cases = page.locator(".case-exercice");
  for (let i = 0; i < 3; i += 1) await cases.nth(i).check();
  await expect(cases.nth(0)).toBeChecked();
  await verifierAccessibilite(page); // ecran de seance

  // Ecran « Ma progression » (vue-perso.js) : meme trou, meme barre sans nom.
  await page.getByRole("link", { name: "Ma progression" }).click();
  await expect(page.getByRole("heading", { name: "Ma progression", level: 1 })).toBeVisible();
  await verifierAccessibilite(page); // ecran perso

  await page.getByRole("link", { name: "L’équipe" }).click();
  await expect(page.getByRole("heading", { name: "L’équipe", level: 2 })).toBeVisible();
  await verifierAccessibilite(page); // ecran de l'equipe
});

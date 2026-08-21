// Bout en bout de renaissance-gym : un vrai navigateur, contre le binaire reel.
//
// Ce que cette suite garde, et que les tests Go et les tests unitaires du
// front (tests/*.test.js, joues sans navigateur) ne peuvent pas voir : la
// page s'affiche vraiment, le parcours d'entree mene bien a l'ecran du jour,
// et la promesse du PRD §8.4 — « l'union des quatre seances vaut exactement
// les trente-six exercices » — se verifie a l'ecran, pas seulement en
// memoire (programme.js, couvertureComplete, deja teste par
// tests/programme.test.js).
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

// Un code a six chiffres quelconque (PRD §10.2) : la valeur n'importe pas,
// seule sa forme compte pour la creation de compte.
const CODE = "482913";

async function remplirCode(page, prefixe, code) {
  for (let i = 0; i < 6; i += 1) {
    await page.locator(`#${prefixe}-${i}`).fill(code[i]);
  }
}

// Mene une gymnaste toute neuve (aucun etat local) jusqu'a l'ecran du jour,
// en suivant exactement le parcours des trois ecrans d'entree (PRD §7.1) :
// prenom, semaine de depart (la 1, deja choisie par defaut), pseudo et code
// proposes par la page elle-meme. C'est une vraie creation de compte, contre
// le serveur reel demarre par lancer.sh — jamais un etat injecte a la main.
async function creerCompte(page, prenom) {
  await page.goto("/");
  await page.locator("#entree-prenom").fill(prenom);
  await page.getByRole("button", { name: "C’est parti" }).click();

  // Ecran 2 : la semaine de depart. La 1re est deja choisie (donnees.semaine
  // vaut 1 par defaut) — passer directement a l'ecran suivant.
  await page.getByRole("button", { name: "Continuer" }).click();

  // Ecran 3 : le compte. Le code se saisit dans deux jeux de six cases.
  await remplirCode(page, "entree-code", CODE);
  await remplirCode(page, "entree-code-confirme", CODE);
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  // La creation attend la reponse du serveur (A18) avant de naviguer :
  // attendre le changement de route plutot qu'un delai fixe.
  await page.waitForFunction(() => location.hash === "#/jour");
}

// Verifie qu'un ecran deja monte ne porte aucune violation d'accessibilite
// serieuse, et rend le resultat pour que l'appelant compose son propre
// message d'echec (quel ecran, quelle violation).
async function violationsGraves(page) {
  const resultat = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return resultat.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
}

test("la page d'accueil s'affiche", async ({ page }) => {
  const reponse = await page.goto("/");
  expect(reponse.status()).toBe(200);
  // Sans prenom enregistre, le routeur aiguille vers l'ecran d'entree
  // (app.js, `router`) : c'est son titre qui doit etre visible.
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator("h1").first()).toHaveText("Salut, c’est quoi ton prénom ?");
});

test("la sonde de sante repond", async ({ request }) => {
  const r = await request.get("/healthz");
  expect(r.ok()).toBeTruthy();
});

test("le parcours d'entree cree un compte et mene a l'ecran du jour", async ({ page }) => {
  await creerCompte(page, "Alix");
  // L'ecran du jour porte le nom de la premiere seance en objet focal
  // (vue-jour.js, cas « a-faire ») : c'est la preuve que le compte existe
  // vraiment et que le programme a ete charge.
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator(".objectif-seance__nom")).toHaveText("Le socle");
});

// LA VERIFICATION DE COUVERTURE (PRD §8.4) : « l'union des quatre seances
// vaut exactement les trente-six exercices », et pas une intention — ici on
// la lit dans les DEUX ecrans ou un navigateur la montre vraiment.
//
// - « Les 36 exercices » (#/liste, A8) liste le programme complet, groupe
//   par famille.
// - « Ta grille » -> chaque case ouvre le detail d'une seance
//   (#/grille/seance/<semaine>/<numero>), qui liste ses propres exercices.
//
// La promesse se lit en comparant l'ensemble affiche sur le premier ecran a
// l'union des quatre ensembles affiches sur le second : ce que
// tests/programme.test.js prouve en memoire (`couvertureComplete`), ce test
// le prouve pour de vrai, exercice par exercice, tel qu'une gymnaste le
// verrait en ouvrant les quatre cases de sa semaine.
test("l'union des quatre seances affichees vaut exactement les 36 exercices affiches", async ({ page }) => {
  await creerCompte(page, "Coverage");

  await page.goto("/#/liste");
  await expect(page.locator("h1").first()).toHaveText("Les 36 exercices");
  const exercicesDeLaListe = await page.locator(".ligne-programme__nom").allTextContents();
  expect(exercicesDeLaListe).toHaveLength(36);
  expect(new Set(exercicesDeLaListe).size).toBe(36);

  const unionDesSeances = new Set();
  for (let numero = 1; numero <= 4; numero += 1) {
    await page.goto(`/#/grille/seance/1/${numero}`);
    const noms = await page.locator(".ligne-exercice__nom").allTextContents();
    // Chaque seance fait entre neuf et onze exercices (PRD §8.4).
    expect(noms.length).toBeGreaterThanOrEqual(9);
    expect(noms.length).toBeLessThanOrEqual(11);
    for (const nom of noms) unionDesSeances.add(nom);
  }

  expect(unionDesSeances.size).toBe(36);
  expect([...unionDesSeances].sort()).toEqual([...exercicesDeLaListe].sort());
});

// L'ACCESSIBILITE MESUREE, sur chaque ecran visite du parcours — l'ecran
// d'entree (avant tout compte), puis l'ecran du jour, la grille, la liste
// des 36 exercices et le detail d'une seance (apres creation d'un compte).
// C'est ce passage, et lui seul, qui rend l'accessibilite bloquante dans la
// chaine : contraste insuffisant, element inatteignable au clavier, libelle
// muet pour un lecteur d'ecran. Le reste du jugement UX (DESIGN.md,
// RETROSPECTIVE.md) appartient a l'agent « esthete », qui juge ce qui ne se
// mesure pas. Ces deux-la ne se remplacent pas l'un l'autre.
test("aucune violation d'accessibilite serieuse sur les ecrans visites", async ({ page }) => {
  const graves = [];

  async function mesurer(nomEcran) {
    for (const v of await violationsGraves(page)) {
      graves.push(`${nomEcran} : ${v.id} (${v.impact}) : ${v.help}`);
    }
  }

  // Ecran d'entree, avant tout compte : les trois ecrans du parcours.
  await page.goto("/");
  await mesurer("entree — prenom");
  await page.locator("#entree-prenom").fill("Access");
  await page.getByRole("button", { name: "C’est parti" }).click();
  await mesurer("entree — semaine");
  await page.getByRole("button", { name: "Continuer" }).click();
  await mesurer("entree — compte");

  await remplirCode(page, "entree-code", CODE);
  await remplirCode(page, "entree-code-confirme", CODE);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForFunction(() => location.hash === "#/jour");
  await mesurer("jour");

  await page.goto("/#/grille");
  await mesurer("grille");

  await page.goto("/#/liste");
  await mesurer("liste des 36 exercices");

  await page.goto("/#/grille/seance/1/1");
  await mesurer("detail d'une seance");

  expect(graves).toEqual([]);
});

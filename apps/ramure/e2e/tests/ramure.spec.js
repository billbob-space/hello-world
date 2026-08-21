// Bout en bout de ramure : un vrai navigateur, contre le binaire reel.
//
// Deux instances tournent (voir lancer.sh), Deezer et Last.fm repointes par
// RAMURE_BASE_DEEZER / RAMURE_BASE_LASTFM (main.go, deezer.go, lastfm.go) —
// jamais interrogeables par hasard, jamais dependantes d'un reseau reel :
//
//   RAMURE_E2E_URL        -> une fixture locale deterministe (fixture-deezer.js)
//                             C'est ce qui rend l'ecran B (l'arbre planté)
//                             atteignable, avec des reponses figees.
//   RAMURE_E2E_URL_PANNE  -> Deezer repointe vers un port local FERME
//                             C'est ce qui produit une vraie panne reseau, sans
//                             avoir a simuler une erreur serveur.
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

const URL_PANNE = process.env.RAMURE_E2E_URL_PANNE || "http://localhost:18088";

// NOM_VIDE doit rester synchronise avec fixture-deezer.js : c'est le seul nom
// que la fixture resout volontairement en liste vide, pour distinguer "source
// jointe, rien trouve" de "source non jointe" (F-36).
const NOM_VIDE = "Nom Introuvable";
const NOM_CONNU = "Portishead";

// CE QUI NAVIGUE, ET POURQUOI. installeServiceWorker() (ramure.js) enregistre
// sw.js des le premier chargement. Son gestionnaire "activate" appelle
// self.clients.claim() (sw.js) : la toute PREMIERE fois qu'une page visite
// l'origine, elle n'est pas encore controlee par un service worker, donc
// clients.claim() la fait passer sous son controle — et ramure.js reagit a ce
// "controllerchange" par un location.reload() inconditionnel (F-42, diffuser
// une mise a jour sans action manuelle). Resultat : une VRAIE navigation, dont
// le delai depend de la vitesse d'installation du service worker, survient
// quelque part apres chaque premiere visite — jamais sur les visites
// suivantes de la MEME page, puisqu'une page qui demarre deja controlee ne
// recoit plus de "controllerchange".
//
// C'est une course, pas un defaut ponctuel d'un test : n'importe quel appel
// PONCTUEL (page.evaluate — ce que fait AxeBuilder.analyze() en interne — ou
// page.accessibility.snapshot()) qui tombe pendant cette navigation voit son
// contexte d'execution detruit et echoue. Les locators et page.waitForFunction,
// eux, reessaient automatiquement apres une navigation : c'est pour ça qu'on
// s'en sert ici plutot que d'attendre un delai fixe, qui masquerait la course
// au lieu de la fermer.
//
// pageStable() attend que ce rechargement eventuel ait DEJA eu lieu, en
// attendant que la page courante soit controlee : soit elle l'etait deja
// (aucun rechargement a venir), soit waitForFunction traverse lui-meme le
// rechargement et se resout sur la page finale, qui demarre deja controlee.
// Dans les deux cas, ce qui suit cet appel s'execute sur un document stable.
async function pageStable(page) {
  await page.waitForFunction(
    () => !("serviceWorker" in navigator) || !!navigator.serviceWorker.controller,
  );
}

test("la page d'accueil s'affiche", async ({ page }) => {
  const reponse = await page.goto("/");
  await pageStable(page);
  expect(reponse.status()).toBe(200);
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator("h1").first()).toHaveText(/Ramure/);
});

test("la sonde de sante repond", async ({ request }) => {
  const r = await request.get("/healthz");
  expect(r.ok()).toBeTruthy();
  expect(await r.text()).toMatch(/^ok /);
});

test("le mur d'accueil se remplit depuis la source", async ({ page }) => {
  await page.goto("/");
  await pageStable(page);
  // 28 resolutions concurrentes contre la fixture locale (Amorcage,
  // sources.go) : le mur se peuple sans jamais toucher un reseau externe.
  await expect(page.locator("#mur .tuile").first()).toBeVisible({ timeout: 15_000 });
  // Aucun message d'echec ne doit apparaitre quand la source a repondu.
  await expect(page.locator("#accueil-etat")).toBeHidden();
});

// L'ECRAN B, enfin atteignable : planter un artiste connu de la fixture fait
// vraiment pousser l'arbre, avec sa fiche et ses branches — ce qu'aucun test
// contre un reseau coupe ne pouvait montrer.
test("planter un artiste connu ouvre l'arbre de parenté (écran B)", async ({ page }) => {
  await page.goto("/");
  await pageStable(page);
  await page.locator("#graine").fill(NOM_CONNU);
  await page.locator("#graine").press("Enter");

  await expect(page.locator("#exploration")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#accueil")).toBeHidden();
  await expect(page.locator("#fiche-nom")).toHaveText(NOM_CONNU);

  // Le vivier de la fixture compte 8 voisins (branchesMin = 6) : l'arbre doit
  // donc avoir dessiné plusieurs branches, pas zéro.
  const noeuds = page.locator("#noeuds > *");
  await expect(async () => {
    expect(await noeuds.count()).toBeGreaterThan(0);
  }).toPass({ timeout: 15_000 });
});

// F-36, cas "vide" : la source est jointe, elle répond, elle n'a simplement
// rien trouvé pour ce nom. Reessayer ne changerait rien tant que le nom reste
// le même — le bouton ne doit donc PAS apparaître.
test("planter un nom introuvable affiche un vide, jamais une panne (F-36)", async ({ page }) => {
  await page.goto("/");
  await pageStable(page);
  await page.locator("#graine").fill(NOM_VIDE);
  await page.locator("#graine").press("Enter");

  const boite = page.locator("#etat-ecran");
  // Un seul expect porte tout le budget d'attente (15 s, comme ailleurs dans
  // ce fichier pour un aller-retour serveur) : la transition "attente" ->
  // "vide" est asynchrone (chargeArbre, ramure.js), et separer visibilite et
  // attribut en deux assertions faisait retomber la seconde sur le timeout
  // par defaut de 5 s, trop court sous charge — c'est ce qui a rendu ce test
  // intermittent.
  await expect(boite).toHaveAttribute("data-genre", "vide", { timeout: 15_000 });
  await expect(page.locator("#etat-titre")).toHaveText("L'arbre s'arrête ici");
  await expect(page.locator("#etat-reessayer")).toBeHidden();
  // F-38 : une action de sortie reste toujours offerte, même sur un vide.
  await expect(page.locator("#etat-retour")).toBeVisible();
});

// F-36, cas "panne" : la source n'a pas répondu du tout (port local fermé).
// Reessayer a ici un vrai sens, donc le bouton doit apparaître — sur l'accueil
// (le mur ne peut rendre aucune tuile) comme sur une plantation.
test("sans source joignable, le mur d'accueil signale une panne — pas un vide silencieux (F-36)", async ({ page }) => {
  await page.goto(URL_PANNE + "/");
  await pageStable(page);

  const etatMur = page.locator("#accueil-etat");
  await expect(etatMur).toBeVisible({ timeout: 15_000 });
  const texte = await etatMur.textContent();
  expect(texte).not.toMatch(/Rien à proposer/);
  expect(texte).toMatch(/Tape un nom d'artiste pour commencer/);
  await expect(page.locator("#mur")).toBeEmpty();
});

test("planter un nom sans source joignable produit une panne réessayable (F-36)", async ({ page }) => {
  await page.goto(URL_PANNE + "/");
  await pageStable(page);
  await page.locator("#graine").fill(NOM_CONNU);
  await page.locator("#graine").press("Enter");

  const boite = page.locator("#etat-ecran");
  // Meme raison que sur le test "vide" ci-dessus : un seul expect porte tout
  // le budget d'attente de la transition asynchrone "attente" -> "panne".
  await expect(boite).toHaveAttribute("data-genre", "panne", { timeout: 15_000 });
  await expect(page.locator("#etat-titre")).toHaveText("Chargement impossible");
  await expect(page.locator("#etat-reessayer")).toBeVisible();
  await expect(page.locator("#etat-retour")).toBeVisible();
});

// L'ACCESSIBILITE MESUREE, sur les DEUX écrans réels — l'accueil rempli, puis
// l'arbre planté — pas seulement sur une superposition d'erreur. C'est ce
// passage, et lui seul, qui rend l'accessibilité bloquante dans la chaîne.
//
// pageStable() est INDISPENSABLE ici : AxeBuilder.analyze() injecte et execute
// son script en un seul appel (page.evaluate), qui ne survit pas au
// rechargement decrit plus haut. Sans cet appel, ce test est intermittent —
// c'est exactement ce qui a ete observe et qu'il fallait fermer, pas
// contourner.
test("aucune violation d'accessibilité sérieuse sur l'accueil", async ({ page }) => {
  await page.goto("/");
  await pageStable(page);
  await expect(page.locator("#mur .tuile").first()).toBeVisible({ timeout: 15_000 });

  const resultat = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const graves = resultat.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(graves.map((v) => `${v.id} (${v.impact}) : ${v.help}`)).toEqual([]);
});

// Meme risque que le test precedent, meme remede : le rechargement peut
// survenir a tout moment apres la premiere visite, y compris pendant que
// l'arbre pousse. Il passait par chance jusqu'ici.
test("aucune violation d'accessibilité sérieuse sur l'arbre planté (écran B)", async ({ page }) => {
  await page.goto("/");
  await pageStable(page);
  await page.locator("#graine").fill(NOM_CONNU);
  await page.locator("#graine").press("Enter");
  await expect(page.locator("#exploration")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#fiche-nom")).toHaveText(NOM_CONNU);

  const resultat = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const graves = resultat.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(graves.map((v) => `${v.id} (${v.impact}) : ${v.help}`)).toEqual([]);
});

// §07 : "le champ de recherche est UNIQUE dans le document [...] deux champs
// de recherche simultanés produiraient des requêtes en double et deux
// commandes portant le même intitulé désorienteraient la navigation assistée".
// Verifié dans les deux dispositions ET dans les deux états d'écran : c'est en
// changeant d'état, pas seulement de largeur, que le noeud est déplacé.
test("le champ de recherche est un noeud unique, jamais dupliqué", async ({ page }) => {
  const verifieUnique = async () => {
    await expect(page.locator("#recherche")).toHaveCount(1);
    await expect(page.locator("input#graine")).toHaveCount(1);
    await expect(page.locator("label:has-text(\"Nom d'artiste\")")).toHaveCount(1);
  };

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await pageStable(page);
  await expect(page.locator("#mur .tuile").first()).toBeVisible({ timeout: 15_000 });
  await verifieUnique();

  // La disposition large déplace le même noeud vers la barre d'outils
  // (§07, "Deux dispositions") — toujours un seul exemplaire.
  await page.setViewportSize({ width: 1280, height: 900 });
  await verifieUnique();

  // Planter un artiste bascule vers l'écran B, qui héberge le champ dans sa
  // PROPRE barre d'outils (#hote-recherche-barre) — toujours le même noeud
  // déplacé, jamais un second créé.
  await page.locator("#graine").fill(NOM_CONNU);
  await page.locator("#graine").press("Enter");
  await expect(page.locator("#exploration")).toBeVisible({ timeout: 15_000 });
  await verifieUnique();
});

// §12 : "aucun intitulé accessible en double [...] en particulier lors du
// basculement entre dispositions". Verifié sur les deux écrans réels, chacun
// dans son propre etat visible — un lecteur d'écran qui annonce deux fois
// "Fermer" ou deux fois "Rebattre" sur le même écran ne permet plus de savoir
// laquelle des deux commandes vient d'être activée.
async function nomsAccessiblesDupliques(page) {
  const snapshot = await page.accessibility.snapshot({ interestingOnly: true });
  const interactifs = new Set([
    "button", "link", "textbox", "searchbox", "combobox",
    "checkbox", "radio", "menuitem", "tab", "switch",
  ]);

  const noms = [];
  const parcourt = (noeud) => {
    if (!noeud) return;
    if (interactifs.has(noeud.role) && noeud.name && noeud.name.trim()) {
      noms.push(`${noeud.role}:${noeud.name.trim()}`);
    }
    (noeud.children || []).forEach(parcourt);
  };
  parcourt(snapshot);

  return [...new Set(noms.filter((n, i) => noms.indexOf(n) !== i))];
}

// page.accessibility.snapshot() est, comme AxeBuilder.analyze(), un appel
// ponctuel qui ne survit pas a une navigation : meme remede.
test("aucun nom accessible dupliqué sur l'écran d'accueil", async ({ page }) => {
  await page.goto("/");
  await pageStable(page);
  await expect(page.locator("#mur .tuile").first()).toBeVisible({ timeout: 15_000 });
  expect(await nomsAccessiblesDupliques(page)).toEqual([]);
});

test("aucun nom accessible dupliqué sur l'écran de l'arbre planté", async ({ page }) => {
  await page.goto("/");
  await pageStable(page);
  await page.locator("#graine").fill(NOM_CONNU);
  await page.locator("#graine").press("Enter");
  await expect(page.locator("#exploration")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#fiche-nom")).toHaveText(NOM_CONNU);

  expect(await nomsAccessiblesDupliques(page)).toEqual([]);
});

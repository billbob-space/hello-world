// Tests de bout en bout d'ardoise, contre la stack REELLE (app + ardoise-base
// + redis) montee par ../lancer.sh. Rien n'est simule : c'est la seule facon
// de verifier A8 du PRD (le parcours navigateur) et §5 (la provenance affichee
// change reellement entre deux lectures consecutives).
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

test("parcours complet : ecrire une ligne, la voir, puis voir la provenance changer", async ({ page }) => {
  const texte = `ligne e2e ${Math.random().toString(36).slice(2)}`;

  await page.goto("/");
  await expect(page.locator("#texte")).toBeVisible();

  await page.locator("#texte").fill(texte);
  await page.locator('button[type="submit"]').click();

  await expect(page.locator("#lignes li").first().locator(".texte")).toHaveText(texte);

  // L'ecriture invalide le cache (R4) : la lecture qui suit immediatement
  // (charger(), appelee par le JS apres le POST) est donc la premiere depuis
  // l'invalidation, et vient de la base.
  await expect(page.locator("#provenance")).toHaveText("Lu dans la base");

  // Un rechargement complet declenche une deuxieme lecture consecutive :
  // elle doit venir du cache. C'est le seul moyen, pour un non-technicien,
  // de constater que le cache existe (PRD §5).
  await page.reload();
  await expect(page.locator("#provenance")).toHaveText("Lu dans le cache");
  await expect(page.locator("#lignes li").first().locator(".texte")).toHaveText(texte);
});

test("une ligne vide est refusee, en francais", async ({ page }) => {
  await page.goto("/");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator("#erreur")).toContainText("vide");
});

// R2 (serveur, refuser plutot que tronquer) est verifiee exhaustivement par
// domaine_test.go, sans navigateur. Cote interface, ce que l'utilisateur
// rencontre reellement est l'attribut maxlength de la zone de texte : un
// navigateur clippe la valeur avant meme l'envoi, y compris quand elle est
// posee programmatiquement (comme le fait ce test). C'est ce comportement -la
// que l'e2e verifie : personne ne peut, depuis cet ecran, produire une ligne
// de plus de 140 caracteres.
test("le champ n'accepte jamais plus de 140 caracteres", async ({ page }) => {
  await page.goto("/");
  await page.locator("#texte").fill("a".repeat(150));
  await expect(page.locator("#texte")).toHaveValue("a".repeat(140));
});

test("un texte avec des balises HTML s'affiche comme texte, jamais execute", async ({ page }) => {
  const malicieux = "<script>window.__ardoise_xss = true</script>et du <b>gras</b>";

  await page.goto("/");
  await page.locator("#texte").fill(malicieux);
  await page.locator('button[type="submit"]').click();

  const ligne = page.locator("#lignes li").first().locator(".texte");
  await expect(ligne).toHaveText(malicieux);

  // La balise n'a jamais ete interpretee : ni le script ne s'est execute...
  const injecte = await page.evaluate(() => window.__ardoise_xss);
  expect(injecte).toBeUndefined();

  // ...ni le <b> n'existe reellement comme element du DOM.
  await expect(ligne.locator("b")).toHaveCount(0);
});

// L'ACCESSIBILITE MESUREE. C'est ce passage, et lui seul, qui rend le contraste,
// l'atteignabilite au clavier et les libelles de lecteur d'ecran BLOQUANTS dans
// la chaine. Le jugement UX qui ne se mesure pas appartient a l'agent
// « esthete », en fin de branche : les deux ne se remplacent pas.
//
// waitForLoadState avant analyze() : AxeBuilder injecte son script dans la page,
// et une navigation en cours detruit son contexte d'execution — « Execution
// context was destroyed ». Constate sur ramure, ou le test passait ou tombait
// selon la vitesse de la machine. Une course qu'on gagne une fois sur deux est
// pire qu'un test absent : elle apprend a ignorer le rouge.
test("aucune violation d'accessibilite serieuse", { tag: "@a11y" }, async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const resultat = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const graves = resultat.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(graves.map((v) => `${v.id} (${v.impact}) : ${v.help}`)).toEqual([]);
});

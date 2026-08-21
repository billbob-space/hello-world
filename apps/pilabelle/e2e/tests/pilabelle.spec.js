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

// LA SUITE NE PARLE QU'A NOTRE BINAIRE. Tout ce qui sort de son origine est
// coupe net.
//
// Ce n'est pas une precaution de principe, c'est un correctif : l'ecran
// « exercice » incruste une iframe YouTube (web/video.js). axe-core DESCEND
// dans les iframes qu'il peut atteindre, et rapportait donc le balisage de
// YouTube comme une violation de NOTRE app :
//
//   aria-prohibited-attr (serious) -- iframe #movie_player ::
//   <div class="html5-video-player ..." id="movie_player"
//        aria-label="YouTube Video Player"> ::
//   aria-label attribute cannot be used on a div with no valid role attribute.
//
// D'ou l'intermittence, un run sur trois pendant trois jours : le verdict
// dependait de la question de savoir si le lecteur YouTube avait fini de
// s'initialiser au moment du scan — donc de la charge reseau du runner, et de
// rien d'autre. Le meme retard expliquait le second symptome, la reprise qui
// expirait sur « input[name=niveau] ».
//
// Le defaut de fond est plus grave que son symptome : une suite qui mesure
// l'accessibilite d'un tiers n'est pas seulement instable, elle est
// INCONTROLABLE. Le « data-version » du lecteur montre que ce balisage change
// sans nous ; YouTube pouvait rendre rouge la fabrique ENTIERE un matin, par
// une modification de son propre code, sans qu'une ligne du depot bouge.
//
// La coupure vaut donc pour toute la suite, et pas seulement pour le scan :
// un bout en bout mesure NOTRE app, jamais le reseau. L'iframe reste dans le
// DOM et garde son « title », qui est la seule chose dont nous repondions.
async function couperLeMondeExterieur(contexte) {
  const notre = new URL(process.env.PILABELLE_E2E_URL || "http://localhost:18085").host;
  await contexte.route("**/*", (route) => {
    const cible = new URL(route.request().url());
    return cible.host === notre ? route.continue() : route.abort();
  });
}

// Couvre les tests qui prennent la page par defaut. Ceux qui fabriquent leur
// propre contexte appellent le coupe-circuit eux-memes : le contexte cree a la
// main n'est PAS celui de cette fixture, et l'oublier rouvrirait le monde
// exterieur sans que rien ne le signale.
test.beforeEach(async ({ context }) => {
  await couperLeMondeExterieur(context);
});

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
  await couperLeMondeExterieur(contexte);
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
        //
        // failureSummary est indispensable, pas decoratif : pour les regles qui
        // dependent du ROLE, ce role est le plus souvent IMPLICITE (un <button>,
        // un <input type=checkbox>) et n'apparait donc dans aucun attribut du
        // html capture. Seul failureSummary nomme le couple en clair
        // (« aria-X cannot be used on role Y »). Il contient nativement des
        // sauts de ligne (axe joint les groupes any/none par \n\n) : on les
        // aplatit pour tenir sur une ligne de journal.
        const noeuds = (v.nodes || [])
          .slice(0, 3)
          .map((n) => {
            const cible = (n.target || []).join(" ");
            const html = String(n.html || "").slice(0, 200);
            const raison = String(n.failureSummary || "")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 200);
            return `${cible} :: ${html} :: ${raison}`;
          })
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

  // Le coupe-circuit se garde lui-meme. Si quelqu'un retire l'appel a
  // couperLeMondeExterieur, l'iframe YouTube se chargera de nouveau et cette
  // ligne rougira AVANT que le scan ne redevienne intermittent — un echec
  // franc et nomme, plutot qu'un run sur trois pendant trois jours.
  //
  // Honnetete sur sa portee : cette assertion ne mord qu'en integration
  // continue, la ou la machine atteint vraiment YouTube. Sur un poste dont le
  // reseau sortant est filtre, l'iframe reste vide et l'assertion passerait
  // meme sans coupure — c'est exactement ce qui a masque le defaut pendant
  // onze passages locaux verts.
  // On ne regarde que les frames reellement chargees en http(s). Une frame
  // coupee retombe sur « chrome-error://chromewebdata/ » : c'est la SIGNATURE
  // du blocage, pas une origine etrangere. La premiere version de cette
  // assertion la comptait comme telle et rougissait donc sur le cas REUSSI ;
  // elle a ete rejouee avant d'etre crue, et c'est ce passage qui l'a dit.
  const notre = new URL(process.env.PILABELLE_E2E_URL || "http://localhost:18085").host;
  const etrangeres = page.frames().flatMap((f) => {
    let u;
    try {
      u = new URL(f.url());
    } catch {
      return [];
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") return [];
    return u.host === notre ? [] : [u.host];
  });
  expect(etrangeres).toEqual([]);

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
  await couperLeMondeExterieur(contexte);
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

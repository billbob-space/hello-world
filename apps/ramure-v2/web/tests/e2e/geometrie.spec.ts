// apps/ramure-v2/web/tests/e2e/geometrie.spec.ts
//
// PRP 09, tache 1 : "Verifications de geometrie mesurees, viewport large
// explicite (1920x1080) : les traits rejoignent leur cible ; les libelles
// ne se recouvrent pas ; le zoom agrandit bien les illustrations --
// comparaison de la largeur RENDUE de l'image avant et apres zoom, pas
// seulement du rayon de la pastille. C'est precisement ce que les tests
// sur DOM simule du PRP 08 ne peuvent pas voir."
//
// Tout est mesure avec `getScreenCTM()`/`getBoundingClientRect()` -- la
// geometrie REELLEMENT rendue par un moteur de mise en page complet,
// jamais les seuls attributs SVG (cx/cy/r restent constants par design,
// web/src/canevas.ts : seul le groupe racine est mis a l'echelle par
// `transform`, voir appliquerVue()) : c'est exactement la distinction que
// jsdom ne sait pas faire (pas de CTM, pas de vrai layout), et que ce
// fichier existe pour couvrir.
import { expect, test } from "@playwright/test";
import { branche, centreOK, ScenarioAPI, installerAPI } from "./support/api";
import { BASE_URL, demarrerServeur, type ServeurRamure } from "./support/serveur";

const LARGEUR = 1920;
const HAUTEUR = 1080;

let serveur: ServeurRamure;

test.beforeAll(async () => {
  serveur = await demarrerServeur();
});

test.afterAll(async () => {
  await serveur.arreter();
});

interface Point {
  x: number;
  y: number;
}

interface LigneEcran {
  a: Point;
  b: Point;
}

interface NoeudEcran {
  label: string;
  centre: Point;
  rayonEcran: number;
  libelleRect: { x: number; y: number; width: number; height: number };
}

async function mesurerScene(page: import("@playwright/test").Page): Promise<{ lignes: LigneEcran[]; noeuds: NoeudEcran[] }> {
  return page.evaluate(() => {
    const svg = document.querySelector("#canevas") as SVGSVGElement;
    const ctm = svg.getScreenCTM();
    if (!ctm) throw new Error("getScreenCTM() indisponible -- le canevas n'est pas rendu");

    function versEcran(x: number, y: number): { x: number; y: number } {
      const p = new DOMPoint(x, y).matrixTransform(ctm as DOMMatrix);
      return { x: p.x, y: p.y };
    }

    const lignes = [...document.querySelectorAll<SVGLineElement>(".lien")].map((l) => ({
      a: versEcran(Number(l.getAttribute("x1")), Number(l.getAttribute("y1"))),
      b: versEcran(Number(l.getAttribute("x2")), Number(l.getAttribute("y2"))),
    }));

    const noeuds = [...document.querySelectorAll<SVGGElement>(".noeud")].map((n) => {
      const cercle = n.querySelector("circle") as SVGCircleElement;
      const cx = Number(cercle.getAttribute("cx"));
      const cy = Number(cercle.getAttribute("cy"));
      const r = Number(cercle.getAttribute("r"));
      const centre = versEcran(cx, cy);
      const bord = versEcran(cx + r, cy);
      const rayonEcran = Math.hypot(bord.x - centre.x, bord.y - centre.y);
      const id = n.getAttribute("data-id") ?? "";
      // Le libelle vit dans un groupe SEPARE (canevas.ts, "jamais dans le
      // meme groupe que le cercle") : retrouve par position dans le DOM
      // (meme index d'ajout que le noeud, garanti par dessinerNoeud).
      const index = [...document.querySelectorAll<SVGGElement>(".noeud")].indexOf(n);
      const texteEl = document.querySelectorAll<SVGTextElement>(".libelle")[index];
      if (!texteEl) throw new Error(`libelle introuvable pour le noeud a l'index ${index}`);
      const r2 = texteEl.getBoundingClientRect();
      return {
        label: n.getAttribute("aria-label") ?? "",
        centre,
        rayonEcran,
        libelleRect: { x: r2.x, y: r2.y, width: r2.width, height: r2.height },
        id,
      };
    });

    return { lignes, noeuds };
  });
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function rectanglesSeChevauchent(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test("geometrie mesuree -- traits, libelles et zoom, viewport 1920x1080", async ({ page }) => {
  await page.setViewportSize({ width: LARGEUR, height: HAUTEUR });
  await page.addInitScript(() => {
    (window as unknown as { RAMURE_SW_DESACTIVE?: boolean }).RAMURE_SW_DESACTIVE = true;
  });

  const scenario = new ScenarioAPI();
  scenario.definirCentre(
    "Artiste Central",
    centreOK("Artiste Central", {
      branches: [
        branche("Premiere Branche Assez Longue", { affinite: 0.95, heritiers: 2 }),
        branche("Deuxieme Branche", { affinite: 0.75, heritiers: 1 }),
        branche("Troisieme Branche Egalement Longue", { affinite: 0.55 }),
        branche("Quatrieme Branche", { affinite: 0.35 }),
      ],
    }),
  );
  await installerAPI(page, scenario);

  await page.goto(`${BASE_URL}/`);
  await page.fill("#graine", "Artiste Central");
  await page.locator("#recherche button[type=submit]").click();
  await expect(page.locator('.noeud[data-id="centre"]')).toHaveAttribute("aria-label", "Artiste Central");
  await expect(page.locator(".noeud")).toHaveCount(1 + 4 + 3); // centre + 4 branches + 3 heritiers

  // --- 1. Les traits rejoignent leur cible -----------------------------
  const { lignes, noeuds } = await mesurerScene(page);
  expect(lignes.length).toBeGreaterThan(0);
  for (const ligne of lignes) {
    for (const extremite of [ligne.a, ligne.b] as const) {
      // Le noeud dont le BORD (pas le centre le plus proche : un heritier
      // peut avoir un centre plus proche que le vrai noeud vise, sans que
      // l'extremite touche pour autant sa propre circonference) passe le
      // plus pres de cette extremite DOIT en etre quasiment a distance
      // NULLE -- un trait qui s'arrete avant sa cible (ou la depasse)
      // donnerait un residu sensiblement different de zero (§11).
      const meilleur = noeuds.reduce(
        (m, n) => {
          const residu = Math.abs(distance(extremite, n.centre) - n.rayonEcran);
          return residu < m.residu ? { n, residu } : m;
        },
        { n: noeuds[0]!, residu: Infinity },
      );
      expect(meilleur.residu, `extremite (${extremite.x.toFixed(1)},${extremite.y.toFixed(1)}) vs noeud "${meilleur.n.label}"`).toBeLessThan(2);
    }
  }

  // --- 2. Les libelles ne se recouvrent pas -----------------------------
  for (let i = 0; i < noeuds.length; i++) {
    for (let j = i + 1; j < noeuds.length; j++) {
      const chevauche = rectanglesSeChevauchent(noeuds[i]!.libelleRect, noeuds[j]!.libelleRect);
      expect(chevauche, `libelles "${noeuds[i]!.label}" et "${noeuds[j]!.label}" se recouvrent`).toBe(false);
    }
  }

  // --- 3. Le zoom agrandit REELLEMENT les illustrations ------------------
  // getBoundingClientRect() sur un <image> DE PATTERN rend systematiquement
  // 0 (verifie empiriquement : un contenu de <pattern> n'appartient pas a
  // l'arbre de rendu mesurable, seulement au remplissage qu'il decrit) --
  // la largeur RENDUE de l'illustration est donc celle du CERCLE qu'elle
  // remplit integralement (canevas.ts, definirIllustration : le motif
  // garde exactement les dimensions du cercle a sa creation). Mesurer le
  // cercle est donc mesurer l'illustration, pas seulement son rayon SVG
  // (qui, lui, ne bouge jamais -- voir l'entete de ce fichier).
  const cibleAria = "Premiere Branche Assez Longue";
  const cercleCible = page.locator(`.noeud[aria-label="${cibleAria}"] circle`).first();
  const largeurAvant = (await cercleCible.boundingBox())!.width;

  for (let i = 0; i < 4; i++) {
    await page.locator("#zoomer-avant").click();
  }
  const largeurApres = (await cercleCible.boundingBox())!.width;

  expect(largeurApres).toBeGreaterThan(largeurAvant * 1.8); // 1.3^4 ~= 2.86, large marge de tolerance
});

// apps/ramure-v2/web/src/main.ts
//
// Point d'entree du client, bundle par esbuild vers web/dist/app.js et
// embarque par //go:embed web/dist (main.go). Cable ensemble geometrie.ts,
// canevas.ts, camera.ts et promotion.ts contre GET /api/centre. Ce fichier
// n'est PAS teste unitairement : chaque brique qu'il assemble l'est deja
// (voir web/tests/), et son propre role — cablage DOM et evenements reels —
// est verifie manuellement (PRP 05, "l'arbre s'affiche et se parcourt
// vraiment").
import {
  appliquerVue as appliquerVueSurGroupe,
  creerGroupes,
  definirIllustration,
  dessinerLien,
  dessinerNoeud,
  type Groupes,
  type NoeudDessine,
} from "./canevas";
import { placerBranches, placerHeritiers, type Anneau } from "./geometrie";
import { aBouge, cadrageNeutre, deplacer, zoomer, type Vue } from "./camera";
import {
  GestionnaireLignee,
  appliquerTransitionVisuelle,
  dureePromotion,
  promouvoir,
  recadrerSiBouge,
} from "./promotion";
import { textes } from "./textes";

// Champs du JSON rendu par GET /api/centre : une seule convention
// d'etiquetage — camelCase minuscule — sur tous les types, y compris
// internal/source.* (Artiste, Voisin, Illustration, Profil, Album), qui
// portent desormais une etiquette json explicite au meme titre que
// Branche/Centre.
interface VoisinAPI {
  nom: string;
  mbid: string;
  affinite: number;
}

interface IllustrationAPI {
  petite: string;
  moyenne: string;
  grande: string;
}

interface BrancheAPI {
  voisin: VoisinAPI;
  illustration: IllustrationAPI;
  lienDeezer?: string;
  heritiers?: VoisinAPI[];
}

interface CentreAPI {
  artiste: { nom: string; mbid: string; pays: string; desambiguisation: string };
  illustration: IllustrationAPI;
  branches?: BrancheAPI[];
  etat: "ok" | "aucun_voisin" | "panne";
  message?: string;
}

const ANNEAU: Anneau = { rayonMin: 150, rayonMax: 420 };
const RAYON_CENTRE = 60;
const RAYON_HERITIER = 16;

const svg = document.querySelector<SVGSVGElement>("#canevas");
const etat = document.querySelector<HTMLElement>("#etat");
const formulaire = document.querySelector<HTMLFormElement>("#recherche");
const champGraine = document.querySelector<HTMLInputElement>("#graine");
const boutonZoomerAvant = document.querySelector<HTMLButtonElement>("#zoomer-avant");
const boutonZoomerArriere = document.querySelector<HTMLButtonElement>("#zoomer-arriere");
const boutonCadrage = document.querySelector<HTMLButtonElement>("#cadrage-initial");

const lignee = new GestionnaireLignee();

let vue: Vue = { x: 0, y: 0, echelle: 1 };
let vueNeutre: Vue = vue;
let groupeRacine: SVGGElement | null = null;
let groupes: Groupes | null = null;
let noeudsDessines = new Map<string, NoeudDessine>();
let centreCourant: NoeudDessine | null = null;

function mouvementReduit(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function appliquerVue(): void {
  if (groupeRacine) {
    appliquerVueSurGroupe(groupeRacine, vue);
  }
  if (boutonCadrage) {
    boutonCadrage.hidden = !aBouge(vue, vueNeutre);
  }
}

function annoncer(nom: string): void {
  if (!etat) return;
  window.setTimeout(() => {
    etat.textContent = textes.annonceNouveauCentre(nom);
  }, 0);
}

function viderLiens(): void {
  if (groupes) groupes.liens.replaceChildren();
}

function retirerNoeud(n: NoeudDessine): void {
  n.groupe.remove();
  n.libelle.remove();
  n.pattern.remove();
}

// dessinerEntourage ajoute branches et heritiers AUTOUR d'un centre deja
// en place (id, position (0,0), rayon RAYON_CENTRE) : aucune reconstruction
// du noeud central, seulement l'ajout de ses voisins (F-39, affichage
// progressif).
function dessinerEntourage(centreAPI: CentreAPI): void {
  if (!groupeRacine || !groupes) return;

  const branches = centreAPI.branches ?? [];
  const affinites = branches.map((b) => b.voisin.affinite);
  const positions = placerBranches(branches.length, ANNEAU, affinites);

  branches.forEach((b, i) => {
    const pos = positions[i]!;
    const id = b.voisin.mbid || b.voisin.nom;
    const n = dessinerNoeud(groupeRacine!, groupes!, { id, nom: b.voisin.nom, x: pos.x, y: pos.y, r: pos.r });
    dessinerLien(groupes!, { x: 0, y: 0, r: RAYON_CENTRE }, pos);
    cablerNoeud(n, b.voisin.nom);
    noeudsDessines.set(id, n);
    if (b.illustration?.moyenne) definirIllustration(n, b.illustration.moyenne);

    if (b.heritiers && b.heritiers.length > 0) {
      const posHeritiers = placerHeritiers(pos, b.heritiers.length, Math.PI / 2.5);
      b.heritiers.forEach((h, j) => {
        const posH = posHeritiers[j]!;
        const idH = `${id}-${h.mbid || h.nom}`;
        const nh = dessinerNoeud(groupeRacine!, groupes!, { id: idH, nom: h.nom, x: posH.x, y: posH.y, r: RAYON_HERITIER });
        dessinerLien(groupes!, pos, { ...posH, r: RAYON_HERITIER });
        cablerNoeud(nh, h.nom);
        noeudsDessines.set(idH, nh);
      });
    }
  });
}

function cablerNoeud(n: NoeudDessine, nom: string): void {
  n.groupe.addEventListener("click", () => void promouvoirVers(n, nom));
  n.groupe.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter" || evt.key === " ") {
      evt.preventDefault();
      void promouvoirVers(n, nom);
    }
  });
}

async function chargerCentre(nom: string): Promise<CentreAPI> {
  const reponse = await fetch(`/api/centre?nom=${encodeURIComponent(nom)}`);
  return (await reponse.json()) as CentreAPI;
}

// planter demarre une exploration a partir de zero (recherche, lien
// partage) : ici seulement, la scene est entierement reconstruite, faute
// de noeud existant a promouvoir.
async function planter(nom: string): Promise<void> {
  if (!svg) return;
  const generation = lignee.commencerPromotion(`racine:${nom}`);
  if (etat) etat.textContent = `Chargement de ${nom}…`;

  let centreAPI: CentreAPI;
  try {
    centreAPI = await chargerCentre(nom);
  } catch {
    if (!lignee.estPerimee(generation) && etat) {
      etat.textContent = "Le reseau n'a pas repondu, reessayez dans un instant.";
    }
    return;
  }
  if (lignee.estPerimee(generation)) return; // reponse tardive (§09) : ecartee

  svg.replaceChildren();
  const racine = document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement;
  racine.setAttribute("class", "racine");
  svg.append(racine);
  groupeRacine = racine;
  groupes = creerGroupes(racine);
  noeudsDessines = new Map();

  if (centreAPI.etat !== "ok" || !centreAPI.branches || centreAPI.branches.length === 0) {
    if (etat) etat.textContent = centreAPI.message ?? "Aucun voisin connu pour cet artiste.";
  } else if (etat) {
    etat.textContent = "";
  }

  const centreNoeud = dessinerNoeud(racine, groupes, { id: "centre", nom: centreAPI.artiste.nom, x: 0, y: 0, r: RAYON_CENTRE });
  if (centreAPI.illustration?.moyenne) definirIllustration(centreNoeud, centreAPI.illustration.moyenne);
  centreCourant = centreNoeud;
  noeudsDessines.set("centre", centreNoeud);

  dessinerEntourage(centreAPI);
  annoncer(centreAPI.artiste.nom);

  const viewport = { x: 0, y: 0, largeur: svg.clientWidth || 800, hauteur: svg.clientHeight || 600 };
  const contenu = { x: -ANNEAU.rayonMax, y: -ANNEAU.rayonMax, largeur: 2 * ANNEAU.rayonMax, hauteur: 2 * ANNEAU.rayonMax };
  vue = cadrageNeutre(contenu, viewport);
  vueNeutre = vue;
  appliquerVue();
}

// promouvoirVers (F-11 a F-14, §11 "transition de promotion") : le noeud
// CLIQUE devient le centre SANS jamais etre recree — appliquerTransitionVisuelle
// deplace ses attributs existants — pendant que l'ancien centre s'efface
// sur place. La scene environnante (anciennes branches et heritiers) n'est
// retiree qu'APRES la transition, remplacee par le nouvel entourage.
async function promouvoirVers(noeud: NoeudDessine, nom: string): Promise<void> {
  if (!svg || !groupes) return;
  const ancienCentre = centreCourant;
  const reduit = mouvementReduit();

  await appliquerTransitionVisuelle(noeud, ancienCentre, { x: 0, y: 0, r: RAYON_CENTRE }, { dureeMs: dureePromotion(reduit) });

  recadrerSiBouge(aBouge(vue, vueNeutre), () => {
    vue = vueNeutre;
    appliquerVue();
  });

  const resultat = await promouvoir(lignee, { id: noeud.id, nom }, {
    mouvementReduit: reduit,
    chargerCentre: () => chargerCentre(nom),
  });
  if (!resultat.applique || !resultat.donnees) return; // perimee ou navigation ailleurs (§09, F-13)

  const centreAPI = resultat.donnees;

  // Retire tout sauf le noeud promu, deja en place au centre.
  for (const [id, n] of noeudsDessines) {
    if (n === noeud) continue;
    retirerNoeud(n);
    void id;
  }
  viderLiens();
  noeudsDessines = new Map([[noeud.id, noeud]]);
  centreCourant = noeud;

  if (centreAPI.etat !== "ok" || !centreAPI.branches || centreAPI.branches.length === 0) {
    if (etat) etat.textContent = centreAPI.message ?? "Aucun voisin connu pour cet artiste.";
  } else if (etat) {
    etat.textContent = "";
  }

  dessinerEntourage(centreAPI);
  annoncer(centreAPI.artiste.nom);
}

formulaire?.addEventListener("submit", (evt) => {
  evt.preventDefault();
  const nom = champGraine?.value.trim();
  if (nom) void planter(nom);
});

boutonZoomerAvant?.addEventListener("click", () => {
  vue = zoomer(vue, 1.3, { x: 0, y: 0 });
  appliquerVue();
});
boutonZoomerArriere?.addEventListener("click", () => {
  vue = zoomer(vue, 1 / 1.3, { x: 0, y: 0 });
  appliquerVue();
});
boutonCadrage?.addEventListener("click", () => {
  vue = vueNeutre;
  appliquerVue();
});

// Deplacement au doigt/souris : pas de bibliotheque de geste, deux
// ecouteurs suffisent (F-17). Le zoom au doigt (pincement) est laisse a
// l'affinement produit ulterieur ; le zoom a la molette suit le meme
// chemin que les boutons.
let pointeurActif = false;
let dernierPoint = { x: 0, y: 0 };
svg?.addEventListener("pointerdown", (evt) => {
  pointeurActif = true;
  dernierPoint = { x: evt.clientX, y: evt.clientY };
});
window.addEventListener("pointermove", (evt) => {
  if (!pointeurActif) return;
  const dx = evt.clientX - dernierPoint.x;
  const dy = evt.clientY - dernierPoint.y;
  dernierPoint = { x: evt.clientX, y: evt.clientY };
  vue = deplacer(vue, dx, dy);
  appliquerVue();
});
window.addEventListener("pointerup", () => {
  pointeurActif = false;
});
svg?.addEventListener(
  "wheel",
  (evt) => {
    evt.preventDefault();
    const rect = svg.getBoundingClientRect();
    const pointVise = { x: evt.clientX - rect.left - rect.width / 2, y: evt.clientY - rect.top - rect.height / 2 };
    const facteur = evt.deltaY < 0 ? 1.1 : 1 / 1.1;
    vue = zoomer(vue, facteur, pointVise);
    appliquerVue();
  },
  { passive: false },
);

document.title = textes.titre;

const parametres = new URLSearchParams(window.location.search);
const grainePlantee = parametres.get("graine") ?? parametres.get("nom");
if (grainePlantee) {
  if (champGraine) champGraine.value = grainePlantee;
  void planter(grainePlantee);
}

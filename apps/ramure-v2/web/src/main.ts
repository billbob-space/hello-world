// apps/ramure-v2/web/src/main.ts
//
// Point d'entree du client, bundle par esbuild vers web/dist/app.js et
// embarque par //go:embed web/dist (main.go). Cable ensemble geometrie.ts,
// canevas.ts, camera.ts, promotion.ts (PRP 05) et desormais accueil.ts,
// recherche.ts, fiche.ts (PRP 06) contre GET /api/centre, /api/suggest et
// /api/fiche. Ce fichier n'est PAS teste unitairement : chaque brique qu'il
// assemble l'est deja (voir web/tests/), et son propre role — cablage DOM
// et evenements reels — est verifie manuellement (PRP 05, "l'arbre
// s'affiche et se parcourt vraiment" ; PRP 06, "le parcours complet tient
// a la main").
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
import { construireMur, type MurAccueil, type TuileDonnees } from "./accueil";
import {
  GestionnaireSuggestions,
  construireLienPartage,
  creerAmorceurUneFois,
  extraireGraineDeLURL,
  type SuggestionAPI,
} from "./recherche";
import {
  GestionnaireService,
  SERVICES,
  construireApercuBranche,
  construireFiche,
  type AlbumAPI,
  type ExtraitAPI,
  type PanneauFiche,
  type ProfilAPI,
} from "./fiche";

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
  profil?: ProfilAPI;
  illustration: IllustrationAPI;
  discographie?: AlbumAPI[];
  branches?: BrancheAPI[];
  etat: "ok" | "aucun_voisin" | "panne";
  message?: string;
}

interface FicheAPI {
  profil: ProfilAPI;
  extraits: ExtraitAPI[];
  lienEcoute: string;
  lienDeezer?: string;
}

const ANNEAU: Anneau = { rayonMin: 150, rayonMax: 420 };
const RAYON_CENTRE = 60;
const RAYON_HERITIER = 16;

// Selection editoriale d'amorcage de l'accueil (§07 etat A) : la
// collection (PRP 07) n'existe pas encore, ce sont donc des noms — des
// donnees, pas des chaines d'interface — qui amorcent le mur tant que
// personne n'a rien garde.
const AMORCAGE_EDITORIAL: TuileDonnees[] = [
  { nom: "Portishead" },
  { nom: "Aphex Twin" },
  { nom: "Boards of Canada" },
  { nom: "Massive Attack" },
  { nom: "Autechre" },
  { nom: "Burial" },
];

const svg = document.querySelector<SVGSVGElement>("#canevas");
const etat = document.querySelector<HTMLElement>("#etat");
const formulaire = document.querySelector<HTMLFormElement>("#recherche");
const champGraine = document.querySelector<HTMLInputElement>("#graine");
const boutonZoomerAvant = document.querySelector<HTMLButtonElement>("#zoomer-avant");
const boutonZoomerArriere = document.querySelector<HTMLButtonElement>("#zoomer-arriere");
const boutonCadrage = document.querySelector<HTMLButtonElement>("#cadrage-initial");
const boutonLogo = document.querySelector<HTMLButtonElement>("#logo");
const boutonPartager = document.querySelector<HTMLButtonElement>("#partager");
const accueilSection = document.querySelector<HTMLElement>("#accueil");
const murConteneur = document.querySelector<HTMLElement>("#mur");
const triSelect = document.querySelector<HTMLSelectElement>("#tri");
const accueilPromesseEl = document.querySelector<HTMLElement>("#accueil-promesse");
const suggestionsEl = document.querySelector<HTMLUListElement>("#suggestions");
const correctionEl = document.querySelector<HTMLElement>("#correction");
const serviceSelect = document.querySelector<HTMLSelectElement>("#service");
const ficheEl = document.querySelector<HTMLElement>("#fiche");
const apercuEl = document.querySelector<HTMLElement>("#apercu-branche");

const lignee = new GestionnaireLignee();
const suggestions = new GestionnaireSuggestions();
const gestionnaireService = new GestionnaireService();

let vue: Vue = { x: 0, y: 0, echelle: 1 };
let vueNeutre: Vue = vue;
let groupeRacine: SVGGElement | null = null;
let groupes: Groupes | null = null;
let noeudsDessines = new Map<string, NoeudDessine>();
let centreCourant: NoeudDessine | null = null;
let nomCentreCourant: string | null = null;
let mur: MurAccueil | null = null;
let panneauFiche: PanneauFiche | null = null;

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

// ---------------------------------------------------------------------
// Etat A — accueil (§07, F-05 a F-07)
// ---------------------------------------------------------------------

function construireSelectTri(): void {
  if (!triSelect || triSelect.childElementCount > 0) return;
  const libelles: Record<string, string> = {
    recents: textes.triRecents,
    alphabetique: textes.triAlphabetique,
    aleatoire: textes.triAleatoire,
  };
  for (const ordre of ["recents", "alphabetique", "aleatoire"] as const) {
    const opt = document.createElement("option");
    opt.value = ordre;
    opt.textContent = libelles[ordre] ?? ordre;
    triSelect.append(opt);
  }
  triSelect.addEventListener("change", () => {
    mur?.definirOrdre(triSelect.value as "recents" | "alphabetique" | "aleatoire");
  });
}

// afficherAccueil (F-07) : reconstruit le mur a chaque fois — jamais de
// graine residuelle, jamais d'etat de la derniere exploration qui reste
// colle.
function afficherAccueil(): void {
  if (!accueilSection || !murConteneur || !svg) return;
  if (accueilPromesseEl) accueilPromesseEl.textContent = textes.accueilPromesse;
  construireSelectTri();
  if (triSelect) triSelect.value = mur?.ordre ?? "recents";

  mur?.detruire();
  mur = construireMur(murConteneur, AMORCAGE_EDITORIAL, {
    stockage: window.localStorage,
    surPlanter: (nom) => void planter(nom),
  });
  if (triSelect) triSelect.value = mur.ordre;

  accueilSection.hidden = false;
  svg.setAttribute("hidden", "");
  if (ficheEl) ficheEl.hidden = true;
  if (apercuEl) apercuEl.hidden = true;
  if (etat) etat.textContent = "";
}

function masquerAccueil(): void {
  if (!accueilSection || !svg) return;
  accueilSection.hidden = true;
  svg.removeAttribute("hidden");
}

// ---------------------------------------------------------------------
// Fiche du centre (F-19, F-21, F-22, F-24, F-25, F-40)
// ---------------------------------------------------------------------

function construireSelectService(): void {
  if (!serviceSelect || serviceSelect.childElementCount > 0) return;
  for (const s of SERVICES) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = textes.service[s];
    serviceSelect.append(opt);
  }
  serviceSelect.value = gestionnaireService.service;
  serviceSelect.addEventListener("change", () => {
    gestionnaireService.definir(serviceSelect.value as (typeof SERVICES)[number]);
  });
  // Abonnement UNIQUE, pris ici et non dans construireFiche (fiche.ts) :
  // la fiche est reconstruite a chaque nouveau centre, un abonnement pris
  // la-bas s'accumulerait a chaque promotion sans jamais se desabonner.
  gestionnaireService.observer(() => panneauFiche?.actualiserLiens());
}

// chargerFiche appelle GET /api/fiche a l'OUVERTURE de la fiche — jamais
// au chargement de l'arbre (§07) : c'est le seul endroit qui charge
// Extraits, et le seul cout que ce PRP ajoute au-dela des deux appels
// MusicBrainz du centre.
async function chargerFiche(nom: string): Promise<FicheAPI | null> {
  try {
    const reponse = await fetch(
      `/api/fiche?nom=${encodeURIComponent(nom)}&service=${encodeURIComponent(gestionnaireService.service)}`,
    );
    if (!reponse.ok) return null;
    return (await reponse.json()) as FicheAPI;
  } catch {
    return null;
  }
}

async function afficherFiche(centreAPI: CentreAPI): Promise<void> {
  if (!ficheEl) return;
  const nom = centreAPI.artiste.nom;
  const fiche = await chargerFiche(nom);
  if (nomCentreCourant !== nom) return; // reponse tardive (§09) : ecartee

  panneauFiche = construireFiche(ficheEl, {
    nom,
    profil: fiche?.profil ?? centreAPI.profil ?? { presentation: "", genres: [], auditeurs: 0 },
    albums: centreAPI.discographie ?? [],
    extraits: fiche?.extraits ?? [],
    service: gestionnaireService,
    lienDeezer: fiche?.lienDeezer,
  });
  ficheEl.hidden = false;
}

// ---------------------------------------------------------------------
// Suggestions, rattrapage (F-01 a F-04)
// ---------------------------------------------------------------------

let requeteSuggestionsEnCours = 0;
let minuteurSuggestions: number | undefined;

async function chargerSuggestions(q: string): Promise<SuggestionAPI[]> {
  try {
    const reponse = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
    if (!reponse.ok) return [];
    return (await reponse.json()) as SuggestionAPI[];
  } catch {
    return [];
  }
}

function peindreSuggestions(): void {
  if (!suggestionsEl || !champGraine) return;
  suggestionsEl.replaceChildren();
  suggestionsEl.hidden = !suggestions.ouvert;
  champGraine.setAttribute("aria-expanded", String(suggestions.ouvert));

  suggestions.suggestions.forEach((s, i) => {
    const li = document.createElement("li");
    li.id = `suggestion-${i}`;
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", String(i === suggestions.indexActif));
    li.textContent = s.nom;
    li.addEventListener("mousedown", (evt) => {
      evt.preventDefault(); // ne vole pas le focus du champ avant le clic
      void planter(s.nom);
      suggestions.effacer();
      peindreSuggestions();
    });
    suggestionsEl.append(li);
  });

  const idActif = suggestions.idActif("suggestion");
  if (idActif) {
    champGraine.setAttribute("aria-activedescendant", idActif);
  } else {
    champGraine.removeAttribute("aria-activedescendant");
  }
}

function masquerCorrection(): void {
  if (!correctionEl) return;
  correctionEl.hidden = true;
  correctionEl.replaceChildren();
}

function afficherCorrection(nomPropose: string): void {
  if (!correctionEl) return;
  correctionEl.replaceChildren();
  correctionEl.hidden = false;

  const question = document.createElement("span");
  question.textContent = textes.correctionQuestion(nomPropose);
  const accepter = document.createElement("button");
  accepter.type = "button";
  accepter.textContent = textes.correctionAccepter(nomPropose);
  accepter.addEventListener("click", () => {
    masquerCorrection();
    void planter(nomPropose);
  });
  const refuser = document.createElement("button");
  refuser.type = "button";
  refuser.textContent = textes.correctionRefuser;
  refuser.addEventListener("click", masquerCorrection);

  correctionEl.append(question, accepter, refuser);
}

// tenterRattrapage (F-03, §09) : n'est appele que lorsque le centre
// demande est introuvable. La correction proposee est TOUJOURS affichee,
// jamais appliquee a la place de la demande — c'est CorrectionPlausible,
// cote serveur, qui a deja borne la plausibilite (internal/api/suggest.go).
async function tenterRattrapage(nomDemande: string): Promise<void> {
  const candidats = await chargerSuggestions(nomDemande);
  const correction = candidats.find((c) => c.correction);
  if (correction) afficherCorrection(correction.nom);
}

// ---------------------------------------------------------------------
// Apercu de survol d'une branche (F-19) : panneau DISTINCT de la fiche,
// ne remplace jamais le profil du centre.
// ---------------------------------------------------------------------

function cablerApercuBranche(n: NoeudDessine, nom: string): void {
  if (!apercuEl) return;
  const montrer = () => {
    construireApercuBranche(apercuEl, { nom });
    apercuEl.hidden = false;
  };
  const cacher = () => {
    apercuEl.hidden = true;
  };
  n.groupe.addEventListener("mouseenter", montrer);
  n.groupe.addEventListener("mouseleave", cacher);
  n.groupe.addEventListener("focus", montrer);
  n.groupe.addEventListener("blur", cacher);
}

// ---------------------------------------------------------------------
// Partage d'un arbre (F-34)
// ---------------------------------------------------------------------

async function partagerArbre(): Promise<void> {
  if (!nomCentreCourant) return;
  const lien = construireLienPartage(nomCentreCourant, window.location.origin);
  try {
    await navigator.clipboard.writeText(lien);
    if (etat) etat.textContent = textes.lienCopie;
  } catch {
    // Presse-papiers indisponible (contexte non securise, permission
    // refusee) : le lien reste affichable, seule la copie automatique
    // echoue — degradation, jamais un ecran casse (N-06).
    if (etat) etat.textContent = lien;
  }
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
    cablerApercuBranche(n, b.voisin.nom); // F-19 : uniquement les branches
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
  masquerCorrection();
  suggestions.effacer();
  peindreSuggestions();
  masquerAccueil();
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
  nomCentreCourant = centreAPI.artiste.nom;

  if (centreAPI.etat !== "ok" || !centreAPI.branches || centreAPI.branches.length === 0) {
    if (etat) etat.textContent = centreAPI.message ?? "Aucun voisin connu pour cet artiste.";
    if (centreAPI.etat === "aucun_voisin" && !centreAPI.artiste.mbid) {
      void tenterRattrapage(nom); // F-03 : l'artiste demande est introuvable
    }
  } else if (etat) {
    etat.textContent = "";
  }

  const centreNoeud = dessinerNoeud(racine, groupes, { id: "centre", nom: centreAPI.artiste.nom, x: 0, y: 0, r: RAYON_CENTRE });
  if (centreAPI.illustration?.moyenne) definirIllustration(centreNoeud, centreAPI.illustration.moyenne);
  centreCourant = centreNoeud;
  noeudsDessines.set("centre", centreNoeud);

  dessinerEntourage(centreAPI);
  annoncer(centreAPI.artiste.nom);
  if (centreAPI.etat === "ok") void afficherFiche(centreAPI);

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
  nomCentreCourant = centreAPI.artiste.nom;
  if (apercuEl) apercuEl.hidden = true; // le survol de l'ancien entourage n'a plus de sens

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
  if (centreAPI.etat === "ok") void afficherFiche(centreAPI);
}

formulaire?.addEventListener("submit", (evt) => {
  evt.preventDefault();
  const actif = suggestions.selection();
  const nom = actif?.nom ?? champGraine?.value.trim();
  if (nom) void planter(nom);
});

champGraine?.addEventListener("input", () => {
  window.clearTimeout(minuteurSuggestions);
  const q = champGraine.value.trim();
  masquerCorrection();
  if (!q) {
    suggestions.effacer();
    peindreSuggestions();
    return;
  }
  const requete = ++requeteSuggestionsEnCours;
  minuteurSuggestions = window.setTimeout(async () => {
    const resultat = await chargerSuggestions(q);
    if (requete !== requeteSuggestionsEnCours) return; // reponse tardive (§09) : ecartee
    suggestions.definir(resultat);
    peindreSuggestions();
  }, 200); // debounce : evite un appel MusicBrainz a chaque frappe (N-03)
});

champGraine?.addEventListener("keydown", (evt) => {
  if (evt.key === "ArrowDown") {
    evt.preventDefault();
    suggestions.suivant();
    peindreSuggestions();
  } else if (evt.key === "ArrowUp") {
    evt.preventDefault();
    suggestions.precedent();
    peindreSuggestions();
  } else if (evt.key === "Escape") {
    suggestions.effacer();
    peindreSuggestions();
  }
});

boutonLogo?.addEventListener("click", () => {
  // Retour a l'accueil (F-07) : reinitialise l'etat, la derniere graine ne
  // reste pas collee.
  if (champGraine) champGraine.value = "";
  suggestions.effacer();
  peindreSuggestions();
  masquerCorrection();
  nomCentreCourant = null;
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState({}, "", url);
  afficherAccueil();
});

boutonPartager?.addEventListener("click", () => void partagerArbre());

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
if (boutonLogo) boutonLogo.setAttribute("aria-label", textes.retourAccueil);
if (boutonPartager) {
  boutonPartager.textContent = "⇪";
  boutonPartager.setAttribute("aria-label", textes.partagerLien);
}
construireSelectService();

const parametres = new URLSearchParams(window.location.search);
const grainePlantee = extraireGraineDeLURL(parametres);

// F-04 : un lien partage plante l'artiste UNE SEULE fois, jamais aux
// navigations internes suivantes.
const amorcerDepuisURL = creerAmorceurUneFois((nom: string) => {
  if (champGraine) champGraine.value = nom;
  void planter(nom);
});

if (grainePlantee) {
  amorcerDepuisURL(grainePlantee);
} else {
  afficherAccueil();
}

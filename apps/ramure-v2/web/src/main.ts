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
  ajusterZonesTactiles,
  appliquerVue as appliquerVueSurGroupe,
  cablerActivation,
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
  annoncerNouveauCentre,
  appliquerTransitionVisuelle,
  dureePromotion,
  promouvoir,
  recadrerSiBouge,
} from "./promotion";
import { dispositionCourante } from "./disposition";
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
import {
  MiroirHorsLigne,
  construireCollection,
  type EntreeAPI,
  type PanneauCollection,
} from "./collection";
import { EN_TETE_SESSION, SessionExpireeError, estReponseSessionExpiree, sessionId } from "./session";

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
const boutonRemonter = document.querySelector<HTMLButtonElement>("#remonter-lignee");
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
const collectionEl = document.querySelector<HTMLElement>("#collection");
const boutonCollection = document.querySelector<HTMLButtonElement>("#collection-bouton");
const miseAJourEl = document.querySelector<HTMLElement>("#mise-a-jour");
const miseAJourTexteEl = document.querySelector<HTMLElement>("#mise-a-jour-texte");
const boutonMiseAJour = document.querySelector<HTMLButtonElement>("#mise-a-jour-appliquer");

const lignee = new GestionnaireLignee();
// ligneeNoms est le miroir EXACT de lignee.lignee, en NOMS plutot qu'en
// identifiants opaques (GestionnaireLignee stocke un id — mbid le plus
// souvent — insuffisant pour rappeler /api/centre, qui exige un nom).
// Toute mutation de lignee.lignee (commencerPromotion, naviguerVersAncetre,
// reinitialiser) DOIT etre accompagnee ICI, au meme site d'appel, de la
// meme mutation sur ligneeNoms — c'est ce couplage manuel, et lui seul,
// qui garde les deux tableaux de MEME longueur (F-14, "remonter d'un
// cran").
let ligneeNoms: string[] = [];
const suggestions = new GestionnaireSuggestions();
const gestionnaireService = new GestionnaireService();

// PRP 07 : identite, collection, mesure. session est un jeton OPAQUE,
// sans rapport avec l'identite Google (lue uniquement cote serveur, dans
// X-Forwarded-User) — voir session.ts. miroir tient la collection
// utilisable hors ligne (F-33) ; collectionServeur est la derniere copie
// connue du serveur.
const session = sessionId(window.sessionStorage);
const miroir = new MiroirHorsLigne(window.localStorage);
let collectionServeur: EntreeAPI[] = [];
let panneauCollection: PanneauCollection | null = null;
let mbidCentreCourant: string | null = null;

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
    // §12 : la cible tactile minimale (24x24px) doit tenir a TOUTE
    // echelle de camera, jamais seulement au cadrage neutre — un
    // dezoomage (bouton, molette) reduit d'autant la taille a l'ecran
    // sans que `r` du cercle visible ne bouge (canevas.ts le garantit
    // deja pour l'affinite, F-09) ; c'est cette fonction qui compense.
    ajusterZonesTactiles(noeudsDessines.values(), vue.echelle);
  }
  if (boutonCadrage) {
    boutonCadrage.hidden = !aBouge(vue, vueNeutre);
  }
}

function annoncer(nom: string): void {
  annoncerNouveauCentre(etat, nom);
}

// actualiserVisibiliteRemonter (§12, F-14) : "remonter d'un cran" n'a de
// sens que s'il existe un cran vers lequel remonter — masque des que la
// lignee est vide, jamais un bouton actif qui ne ferait rien.
function actualiserVisibiliteRemonter(): void {
  if (boutonRemonter) boutonRemonter.hidden = lignee.lignee.length === 0;
}

// afficherSessionExpiree (F-41) : le SEUL message que /api/centre peut
// produire quand Traefik a intercepte la requete a la place du serveur
// applicatif — jamais confondu avec "le reseau n'a pas repondu" (§09),
// qui reste un probleme different avec un remede different (reessayer,
// pas se reconnecter).
function afficherSessionExpiree(): void {
  if (!etat) return;
  etat.replaceChildren();
  const message = document.createElement("span");
  message.textContent = `${textes.sessionExpireeMessage} `;
  const lien = document.createElement("a");
  lien.href = window.location.pathname + window.location.search;
  lien.textContent = textes.sessionExpireeLien;
  etat.append(message, lien);
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

  mbidCentreCourant = centreAPI.artiste.mbid || null;
  panneauFiche = construireFiche(ficheEl, {
    nom,
    profil: fiche?.profil ?? centreAPI.profil ?? { presentation: "", genres: [], auditeurs: 0 },
    albums: centreAPI.discographie ?? [],
    extraits: fiche?.extraits ?? [],
    service: gestionnaireService,
    lienDeezer: fiche?.lienDeezer,
    dejaGarde: estGarde(mbidCentreCourant),
    surBasculerGarde: () => void basculerGarde(nom, mbidCentreCourant),
  });
  ficheEl.hidden = false;
}

// ---------------------------------------------------------------------
// Collection : garder, retirer, afficher, replanter, miroir hors ligne
// (F-28 a F-33, PRP 07). identite.DepuisRequete cote serveur cloisonne
// deja par X-Forwarded-User (N-08) ; ce module ne porte JAMAIS
// l'identite, seulement le jeton de session (mesure) dans les en-tetes.
// ---------------------------------------------------------------------

function enTetesJSON(): HeadersInit {
  return { "Content-Type": "application/json", [EN_TETE_SESSION]: session };
}

/** estGarde() lit la vue FUSIONNEE (serveur + miroir hors ligne, F-33) :
 * c'est elle qui doit refleter l'etat "garde" du bouton de la fiche,
 * jamais collectionServeur seule, qui ignorerait un ajout hors ligne pas
 * encore confirme. */
function estGarde(mbid: string | null): boolean {
  if (!mbid) return false;
  return miroir.vue(collectionServeur).some((e) => e.mbid === mbid);
}

async function chargerCollectionServeur(): Promise<EntreeAPI[]> {
  try {
    const reponse = await fetch("/api/collection", { headers: { [EN_TETE_SESSION]: session } });
    if (!reponse.ok) return [];
    return (await reponse.json()) as EntreeAPI[];
  } catch {
    return []; // hors ligne (F-33) : le miroir local prend le relais dans vue()
  }
}

// actualiserCollection recharge la copie serveur ET repeint le panneau
// (F-30 : lignee et date), sans jamais reconstruire le conteneur une fois
// le panneau construit (idempotence, meme discipline que fiche.ts).
async function actualiserCollection(): Promise<void> {
  collectionServeur = await chargerCollectionServeur();
  const vue = miroir.vue(collectionServeur);

  if (collectionEl) {
    if (!panneauCollection) {
      panneauCollection = construireCollection(collectionEl, {
        entrees: vue,
        surReplanter: (e) => {
          collectionEl.hidden = true; // F-31 : ferme le panneau
          void planter(e.nom, "collection"); // M-06 : AmorceCollection
        },
        surRetirer: (mbid) => void retirerDeLaCollection(mbid),
      });
    } else {
      panneauCollection.actualiser(vue);
    }
  }
  panneauFiche?.actualiserGarde(estGarde(mbidCentreCourant));
}

async function ajouterALaCollection(nom: string, mbid: string): Promise<void> {
  // Defaut #2 (REFERENCE.md), compose du #1 : `lignee.lignee` porte des
  // IDENTIFIANTS opaques ("racine:<nom>", des mbid d'heritiers) — jamais ce
  // que F-30 promet ("le chemin de decouverte", en noms lisibles). `ligneeNoms`
  // existe precisement pour cet usage (voir sa doc plus haut) ; seul lui est
  // affiche a l'utilisateur.
  const e: EntreeAPI = { nom, mbid, lignee: [...ligneeNoms, nom], ajoute: new Date().toISOString() };
  miroir.ajouter(e); // F-33 : visible immediatement, meme hors ligne
  panneauFiche?.actualiserGarde(true); // retour visuel immediat (F-28)
  try {
    const reponse = await fetch("/api/collection", {
      method: "PUT",
      headers: enTetesJSON(),
      body: JSON.stringify({ nom, mbid, lignee: e.lignee }),
    });
    if (reponse.ok) miroir.confirmer([...collectionServeur, e]);
  } catch {
    // Reste en attente dans le miroir : reconcilie a la reconnexion (F-33).
  }
  await actualiserCollection();
}

async function retirerDeLaCollection(mbid: string): Promise<void> {
  miroir.retirer(mbid);
  panneauFiche?.actualiserGarde(false);
  try {
    await fetch(`/api/collection?mbid=${encodeURIComponent(mbid)}`, {
      method: "DELETE",
      headers: { [EN_TETE_SESSION]: session },
    });
  } catch {
    // Reste en attente dans le miroir : reconcilie a la reconnexion (F-33).
  }
  await actualiserCollection();
}

function basculerGarde(nom: string, mbid: string | null): void {
  if (!mbid) return;
  if (estGarde(mbid)) {
    void retirerDeLaCollection(mbid);
  } else {
    void ajouterALaCollection(nom, mbid);
  }
}

// synchroniserMiroir (F-33) : au retour du reseau, rejoue les ajouts et
// retraits laisses en attente. Le serveur reste la reference — confirmer()
// n'efface jamais un changement qu'il ignore encore.
async function synchroniserMiroir(): Promise<void> {
  for (const e of miroir.ajoutsEnAttente) {
    try {
      await fetch("/api/collection", { method: "PUT", headers: enTetesJSON(), body: JSON.stringify(e) });
    } catch {
      break; // toujours hors ligne : on retentera au prochain evenement "online"
    }
  }
  for (const mbid of miroir.retraitsEnAttente) {
    try {
      await fetch(`/api/collection?mbid=${encodeURIComponent(mbid)}`, {
        method: "DELETE",
        headers: { [EN_TETE_SESSION]: session },
      });
    } catch {
      break;
    }
  }
  await actualiserCollection();
  // Defaut #6 (REFERENCE.md) corrige : contrairement a ajouterALaCollection,
  // cette reconciliation ne confirmait jamais aupres du miroir hors ligne
  // (MiroirHorsLigne.confirmer(), collection.ts) -- chaque entree deja
  // reussie restait indefiniment dans localStorage et etait renvoyee (PUT)
  // a chaque futur evenement "online", meme des annees plus tard.
  // actualiserCollection() vient de rafraichir `collectionServeur` : s'en
  // servir ici purge du miroir tout changement desormais reconnu par le
  // serveur, sans jamais effacer un changement qu'il ignore encore
  // (confirmer() ne compare qu'aux mbid presents cote serveur).
  miroir.confirmer(collectionServeur);
}

window.addEventListener("online", () => void synchroniserMiroir());

// Le panneau collection partage l'emplacement du panneau fiche (meme
// classe CSS, memes deux largeurs) : les deux ne sont jamais montres a la
// fois, comme la fiche et l'apercu de survol (F-19) ne le sont jamais non
// plus.
boutonCollection?.addEventListener("click", () => {
  if (!collectionEl) return;
  const vaOuvrir = collectionEl.hidden;
  collectionEl.hidden = !vaOuvrir;
  if (ficheEl) ficheEl.hidden = vaOuvrir ? true : nomCentreCourant === null;
  if (vaOuvrir) void actualiserCollection();
});

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

// fermerSuggestions (defaut #7, REFERENCE.md) : ferme la liste de
// suggestions ET invalide toute requete debattue (debounce, 200ms) encore en
// vol -- un simple `suggestions.effacer(); peindreSuggestions();` ne suffit
// pas, puisque le minuteur pose par l'ecouteur "input" continue de courir
// independamment et rouvrirait la liste, INCHANGEE, des qu'il se declenche
// (chargerSuggestions resolue), meme apres que la banniere de correction ou
// une plantation reussie a deja repris l'ecran. C'est exactement le
// mecanisme qui, en disposition etroite, recouvrait le bouton "Oui,
// planter…" : Playwright refusait le clic pendant 45s.
function fermerSuggestions(): void {
  window.clearTimeout(minuteurSuggestions);
  requeteSuggestionsEnCours += 1; // perime toute reponse encore en vol (§09)
  suggestions.effacer();
  peindreSuggestions();
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
      void planter(s.nom); // ferme deja la liste synchronement (fermerSuggestions(), defaut #7)
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
  // Defaut #7 (REFERENCE.md) corrige : voir fermerSuggestions(). La banniere
  // de correction et la liste de suggestions ne montrent jamais rien d'utile
  // en meme temps : fermer l'une en ouvrant l'autre est donc toujours
  // correct, jamais une perte.
  fermerSuggestions();
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
  cablerActivation(n, () => void promouvoirVers(n, nom));
}

// chargerCentre porte le jeton de session (mesure) et, sur une plantation
// seulement, l'amorcage (M-06/M-07) : jamais sur une promotion, que le
// serveur distingue via origine=promotion (internal/api/centre.go).
async function chargerCentre(
  nom: string,
  options?: { origine?: "promotion"; amorce?: "collection" | "partage" },
): Promise<CentreAPI> {
  // largeur (PRP 08, disposition.ts) : le SERVEUR decide seul du nombre de
  // branches/heritiers pour cette disposition (internal/api/centre.go,
  // cadragePour) — le client ne fait que nommer la disposition qu'il
  // affiche reellement, jamais ne recompte lui-meme.
  const params = new URLSearchParams({ nom, largeur: dispositionCourante() });
  if (options?.origine) params.set("origine", options.origine);
  if (options?.amorce) params.set("amorce", options.amorce);
  const reponse = await fetch(`/api/centre?${params.toString()}`, {
    headers: { [EN_TETE_SESSION]: session },
  });
  // F-41 : une session expiree ressemble a une reponse reseau normale
  // (souvent un 200) — seul le CONTENU la trahit, jamais reponse.ok.
  if (estReponseSessionExpiree(reponse, window.location.origin)) {
    throw new SessionExpireeError();
  }
  return (await reponse.json()) as CentreAPI;
}

// reconstruireScene peint une scene ENTIEREMENT NEUVE a partir d'un
// CentreAPI deja charge — partagee par planter() (une graine, F-04) et
// remonterLignee() (F-14) : les deux repartent d'un centre sans noeud
// existant a promouvoir, contrairement a promouvoirVers() qui, lui, fait
// voyager un noeud DEJA present (F-12).
function reconstruireScene(centreAPI: CentreAPI, nomDemande: string): void {
  if (!svg) return;
  svg.replaceChildren();
  const racine = document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement;
  racine.setAttribute("class", "racine");
  svg.append(racine);
  groupeRacine = racine;
  groupes = creerGroupes(racine);
  noeudsDessines = new Map();
  // Defaut #1 (REFERENCE.md) corrige : sur un centre "aucun_voisin"/"panne",
  // centreAPI.artiste.nom est une chaine VIDE (Artiste zero-valeur, voir
  // centreVide()/centrePanne() cote Go) — la garder telle quelle rendait
  // `nomCentreCourant` faux, donc SAUTE par `if (nomCentreCourant)` plus bas
  // (planter/promouvoirVers), alors que GestionnaireLignee.commencerPromotion,
  // lui, avait deja pousse une entree. Repli sur `nomDemande` (le nom
  // REELLEMENT demande, toujours non vide) : nomCentreCourant ne peut plus
  // etre faux alors qu'un centre existe deja, ce qui garde `ligneeNoms` et
  // `lignee.lignee` de MEME longueur en toute circonstance.
  nomCentreCourant = centreAPI.artiste.nom || nomDemande;

  if (centreAPI.etat !== "ok" || !centreAPI.branches || centreAPI.branches.length === 0) {
    if (etat) etat.textContent = centreAPI.message ?? "Aucun voisin connu pour cet artiste.";
    if (centreAPI.etat === "aucun_voisin" && !centreAPI.artiste.mbid) {
      void tenterRattrapage(nomDemande); // F-03 : l'artiste demande est introuvable
    }
  } else if (etat) {
    etat.textContent = "";
  }

  // Defaut #5 (REFERENCE.md, aria-command-name) corrige : sur un centre non
  // resolu, centreAPI.artiste.nom est vide (meme cause que le defaut #1) --
  // dessinerNoeud() pose ce nom tel quel dans aria-label (canevas.ts), ce qui
  // rendait la commande ARIA du centre SANS NOM ACCESSIBLE (WCAG 4.1.2). F-38
  // exige d'afficher un centre dans tous les cas ; `nomCentreCourant`, deja
  // replie sur `nomDemande` ci-dessus, porte toujours un nom lisible.
  const centreNoeud = dessinerNoeud(racine, groupes, { id: "centre", nom: nomCentreCourant, x: 0, y: 0, r: RAYON_CENTRE });
  if (centreAPI.illustration?.moyenne) definirIllustration(centreNoeud, centreAPI.illustration.moyenne);
  centreCourant = centreNoeud;
  noeudsDessines.set("centre", centreNoeud);

  dessinerEntourage(centreAPI);
  // Defaut #3 (REFERENCE.md, F-36/F-37) corrige : annoncer() ecrivait TOUJOURS
  // "Nouveau centre : <nom>" dans #etat un tour de boucle plus tard, ecrasant
  // systematiquement le message distinctif ("Aucun voisin connu…", "…reessayez
  // dans un instant.") qui vient d'y etre pose deux lignes plus haut -- #etat
  // porte deja aria-live="polite" (index.html), donc CE message est deja
  // annonce tel quel, sans avoir besoin d'un second ecrit differe. "Nouveau
  // centre" n'a de sens que lorsqu'il y a reellement un nouveau centre --
  // c'est-a-dire seulement sur un etat "ok".
  if (centreAPI.etat === "ok") {
    annoncer(centreAPI.artiste.nom);
    void afficherFiche(centreAPI);
  }

  const viewport = { x: 0, y: 0, largeur: svg.clientWidth || 800, hauteur: svg.clientHeight || 600 };
  const contenu = { x: -ANNEAU.rayonMax, y: -ANNEAU.rayonMax, largeur: 2 * ANNEAU.rayonMax, hauteur: 2 * ANNEAU.rayonMax };
  vue = cadrageNeutre(contenu, viewport);
  vueNeutre = vue;
  appliquerVue();
  actualiserVisibiliteRemonter();
}

// planter demarre une exploration a partir de zero (recherche, lien
// partage, collection) : ici seulement, la scene est entierement
// reconstruite, faute de noeud existant a promouvoir. amorce distingue
// pour la mesure (M-06, M-07) un depart depuis un artiste garde (F-31)
// d'un depart depuis un lien recu (F-34) — absent, c'est un depart
// manuel (recherche), qui ne compte dans aucune des deux metriques.
async function planter(nom: string, amorce?: "collection" | "partage"): Promise<void> {
  if (!svg) return;
  masquerCorrection();
  fermerSuggestions(); // defaut #7 : invalide aussi une requete debattue encore en vol
  masquerAccueil();
  // F-14 : le centre quitte (s'il en existe un) devient le sommet de la
  // lignee, exactement comme lignee.commencerPromotion() le fait deja
  // pour son propre tableau d'identifiants (promotion.ts) — voir la note
  // sur `ligneeNoms` plus haut.
  if (nomCentreCourant) ligneeNoms = [...ligneeNoms, nomCentreCourant];
  const generation = lignee.commencerPromotion(`racine:${nom}`);
  if (etat) etat.textContent = `Chargement de ${nom}…`;

  let centreAPI: CentreAPI;
  try {
    centreAPI = await chargerCentre(nom, { amorce });
  } catch (erreur) {
    if (lignee.estPerimee(generation)) return;
    if (erreur instanceof SessionExpireeError) {
      afficherSessionExpiree();
    } else if (etat) {
      etat.textContent = "Le reseau n'a pas repondu, reessayez dans un instant.";
    }
    return;
  }
  if (lignee.estPerimee(generation)) return; // reponse tardive (§09) : ecartee

  reconstruireScene(centreAPI, nom);
}

// remonterLignee (F-14, §12 "remonter d'un cran") : distincte de
// "quitter l'exploration" (boutonLogo) — celle-ci ne retire qu'UNE
// entree de la lignee, vers l'artiste immediatement precedent, sans
// jamais passer par l'accueil.
async function remonterLignee(): Promise<void> {
  if (!svg || lignee.lignee.length === 0) return;
  const indexCible = lignee.lignee.length - 1;
  const nomCible = ligneeNoms[ligneeNoms.length - 1];
  if (nomCible === undefined) return; // desaccord defensif : ne devrait jamais survenir (voir la note sur ligneeNoms)

  const nav = lignee.naviguerVersAncetre(indexCible);
  ligneeNoms = ligneeNoms.slice(0, -1);
  actualiserVisibiliteRemonter();
  if (etat) etat.textContent = `Chargement de ${nomCible}…`;

  let centreAPI: CentreAPI;
  try {
    centreAPI = await chargerCentre(nomCible, { origine: "promotion" });
  } catch (erreur) {
    if (lignee.estPerimee(nav.generation)) return;
    if (erreur instanceof SessionExpireeError) {
      afficherSessionExpiree();
    } else if (etat) {
      etat.textContent = "Le reseau n'a pas repondu, reessayez dans un instant.";
    }
    return;
  }
  if (lignee.estPerimee(nav.generation)) return; // reponse tardive (§09) : ecartee

  reconstruireScene(centreAPI, nomCible);
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

  // F-14 : le centre quitte devient le sommet de la lignee — voir la note
  // sur `ligneeNoms` plus haut ; pousse ICI, synchrone, au meme instant
  // que promouvoir() pousse sur lignee.lignee (promotion.ts), jamais
  // apres l'attente reseau qui suit.
  if (nomCentreCourant) ligneeNoms = [...ligneeNoms, nomCentreCourant];

  let resultat;
  try {
    resultat = await promouvoir(lignee, { id: noeud.id, nom }, {
      mouvementReduit: reduit,
      chargerCentre: () => chargerCentre(nom, { origine: "promotion" }), // M-01
    });
  } catch (erreur) {
    if (erreur instanceof SessionExpireeError) {
      afficherSessionExpiree();
    } else if (etat) {
      etat.textContent = "Le reseau n'a pas repondu, reessayez dans un instant.";
    }
    return;
  }
  if (!resultat.applique || !resultat.donnees) return; // perimee ou navigation ailleurs (§09, F-13)

  const centreAPI = resultat.donnees;
  // Meme repli qu'en (F-14) reconstruireScene : une promotion vers un centre
  // qui echoue (source tombee entre-temps) ne doit pas non plus rendre
  // `nomCentreCourant` faux.
  nomCentreCourant = centreAPI.artiste.nom || nom;
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
  // Defaut #3 (REFERENCE.md) corrige, meme raison qu'en reconstruireScene :
  // n'annoncer "Nouveau centre" que lorsqu'il y en a reellement un.
  if (centreAPI.etat === "ok") {
    annoncer(centreAPI.artiste.nom);
    void afficherFiche(centreAPI);
  }
  actualiserVisibiliteRemonter();
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
    fermerSuggestions(); // defaut #7 : invalide aussi une requete debattue encore en vol
  }
});

boutonLogo?.addEventListener("click", () => {
  // Retour a l'accueil (F-07) : reinitialise l'etat, la derniere graine ne
  // reste pas collee. "Quitter l'exploration" (§12) — DISTINCT de
  // "remonter d'un cran" : la lignee entiere est videe ici, jamais
  // seulement raccourcie d'une entree (lignee.reinitialiser(), promotion.ts).
  if (champGraine) champGraine.value = "";
  fermerSuggestions(); // defaut #7 : invalide aussi une requete debattue encore en vol
  masquerCorrection();
  nomCentreCourant = null;
  lignee.reinitialiser();
  ligneeNoms = [];
  actualiserVisibiliteRemonter();
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState({}, "", url);
  afficherAccueil();
});

boutonRemonter?.addEventListener("click", () => void remonterLignee());

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
if (boutonRemonter) boutonRemonter.setAttribute("aria-label", textes.remonterLaLignee);
if (accueilSection) accueilSection.setAttribute("aria-label", textes.accueilTitre);
if (miseAJourTexteEl) miseAJourTexteEl.textContent = textes.miseAJourDisponible;
if (boutonMiseAJour) boutonMiseAJour.textContent = textes.miseAJourAppliquer;
actualiserVisibiliteRemonter();
if (boutonCollection) {
  boutonCollection.textContent = "♥";
  boutonCollection.setAttribute("aria-label", textes.collectionOuvrir);
}
if (boutonPartager) {
  boutonPartager.textContent = "⇪";
  boutonPartager.setAttribute("aria-label", textes.partagerLien);
}
construireSelectService();

// F-25 (close) : le service releve du serveur au demarrage — jamais du
// seul navigateur, pour qu'il suive le proprietaire d'un appareil a
// l'autre. Ecrit a chaque changement ; un echec reseau laisse le choix en
// memoire pour la session courante, sans casser l'ecran (degradation
// gracieuse, comme partout ailleurs dans le client).
async function chargerReglageServeur(): Promise<void> {
  try {
    const reponse = await fetch("/api/reglages", { headers: { [EN_TETE_SESSION]: session } });
    if (!reponse.ok) return;
    const corps = (await reponse.json()) as { service?: string };
    if (corps.service && (SERVICES as readonly string[]).includes(corps.service)) {
      gestionnaireService.definir(corps.service as (typeof SERVICES)[number]);
      if (serviceSelect) serviceSelect.value = corps.service;
    }
  } catch {
    // Le service par defaut du client (fiche.ts) reste en vigueur pour
    // cette session.
  }
}
gestionnaireService.observer((s) => {
  void fetch("/api/reglages", { method: "PUT", headers: enTetesJSON(), body: JSON.stringify({ service: s }) }).catch(
    () => {}, // meme echec : le choix reste actif dans cette session (repli, §09)
  );
});
void chargerReglageServeur();
void actualiserCollection();

const parametres = new URLSearchParams(window.location.search);
const grainePlantee = extraireGraineDeLURL(parametres);

// F-04 : un lien partage plante l'artiste UNE SEULE fois, jamais aux
// navigations internes suivantes.
const amorcerDepuisURL = creerAmorceurUneFois((nom: string) => {
  if (champGraine) champGraine.value = nom;
  void planter(nom, "partage"); // M-07 : AmorcePartage
});

if (grainePlantee) {
  amorcerDepuisURL(grainePlantee);
} else {
  afficherAccueil();
}

// ---------------------------------------------------------------------
// Service worker : installation, hors ligne, mise a jour (N-11, N-12,
// F-42, PRP 08). Desactivable par window.RAMURE_SW_DESACTIVE = true, pose
// AVANT le chargement de ce script — sans ce verrou, une version mise en
// cache par une execution precedente rendrait les echecs simules du
// PRP 09 irreproductibles (PRP 08, "ce que la suite attend de vous" n°2).
// ---------------------------------------------------------------------

declare global {
  interface Window {
    RAMURE_SW_DESACTIVE?: boolean;
  }
}

function afficherBanniereMiseAJour(appliquer: () => void): void {
  if (!miseAJourEl || !boutonMiseAJour) return;
  miseAJourEl.hidden = false;
  // { once: true } : un seul clic suffit, un second ne doit rien redeclencher.
  boutonMiseAJour.addEventListener("click", appliquer, { once: true });
}

// surMiseAJour (F-42) : NE JAMAIS activer seul un worker en attente — le
// skipWaiting() qui l'active vient UNIQUEMENT du clic sur la banniere,
// jamais automatiquement, pour ne jamais casser une exploration en cours
// (vigilance du PRP 08). Le rechargement qui suit recharge une page
// entierement neuve, prise en charge par la nouvelle version.
function surMiseAJour(inscription: ServiceWorkerRegistration): void {
  const enAttente = inscription.waiting;
  if (!enAttente) return;
  afficherBanniereMiseAJour(() => {
    let recharge = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (recharge) return; // un seul rechargement, jamais une boucle
      recharge = true;
      window.location.reload();
    });
    enAttente.postMessage("SAUTER_ATTENTE");
  });
}

async function enregistrerServiceWorker(): Promise<void> {
  if (window.RAMURE_SW_DESACTIVE || !("serviceWorker" in navigator)) return;
  try {
    // Servi par la route STATIQUE existante (/dist/, internal/api/routes.go)
    // — aucune route serveur ajoutee (PRP 08). L'en-tete
    // Service-Worker-Allowed: / (routes.go) est ce qui autorise un script
    // hors de "/" a controler "/" malgre tout.
    // scope: "/" DOIT etre demande EXPLICITEMENT : sans lui, un navigateur
    // borne le scope au repertoire du script (/dist/) meme quand l'entete
    // Service-Worker-Allowed (routes.go) l'autoriserait a etre plus large
    // — l'entete etend la limite AUTORISEE, il ne change jamais le scope
    // effectivement DEMANDE (verifie en navigateur reel, PRP 08).
    const inscription = await navigator.serviceWorker.register("/dist/sw.js", { scope: "/" });

    // Un worker deja en attente au chargement (l'onglet etait ouvert lors
    // du deploiement precedent, jamais rafraichi depuis) : signale tout de
    // suite, meme sans nouvel evenement "updatefound".
    if (inscription.waiting && navigator.serviceWorker.controller) {
      surMiseAJour(inscription);
    }

    inscription.addEventListener("updatefound", () => {
      const installe = inscription.installing;
      if (!installe) return;
      installe.addEventListener("statechange", () => {
        // "installed" ET un controller deja actif = une MISE A JOUR d'une
        // installation existante, jamais la toute premiere installation
        // (qui n'a rien a signaler).
        if (installe.state === "installed" && navigator.serviceWorker.controller) {
          surMiseAJour(inscription);
        }
      });
    });

    // Delai borne (N-12) sans action manuelle : un onglet garde ouvert
    // plusieurs heures ne doit pas attendre indefiniment le prochain
    // rechargement pour decouvrir une version deployee entre-temps.
    window.setInterval(() => void inscription.update(), 60 * 60 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void inscription.update();
    });
  } catch {
    // Navigateur ou contexte sans support (§09, N-06) : l'application
    // fonctionne quand meme, seules l'installation et le hors-ligne se
    // degradent.
  }
}
void enregistrerServiceWorker();

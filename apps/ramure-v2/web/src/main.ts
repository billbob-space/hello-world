// apps/ramure-v2/web/src/main.ts
//
// Point d'entree du client, bundle par esbuild vers web/dist/app.js et
// embarque par //go:embed web/dist (main.go). Cable ensemble geometrie.ts,
// canevas.ts, camera.ts, promotion.ts (PRP 05) et desormais accueil.ts,
// recherche.ts, fiche.ts (PRP 06) contre GET /api/centre, /api/suggest et
// /api/fiche — via passerelle.ts (revue PRP 06), qui porte desormais TOUTE
// la logique reseau (requetes, en-tetes, decodage JSON, SessionExpireeError)
// et que web/tests/passerelle.test.ts couvre. Ce fichier n'est PAS teste
// unitairement : chaque brique qu'il assemble l'est deja (voir web/tests/),
// et son propre role restant — cablage DOM et evenements, composition avec
// son propre etat (lignee, miroir hors ligne, panneaux) — est verifie
// manuellement (PRP 05, "l'arbre s'affiche et se parcourt vraiment" ; PRP
// 06, "le parcours complet tient a la main") et par le bout en bout
// (Playwright, apps/ramure-v2/e2e/).
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
import {
  aBouge,
  cadrageNeutre,
  deplacer,
  viewportLibre as calculerViewportLibre,
  zoomer,
  type PanneauMesure,
  type Rect,
  type Vue,
} from "./camera";
import {
  GestionnaireLignee,
  annoncerNouveauCentre,
  appliquerTransitionVisuelle,
  dureePromotion,
  promouvoir,
  recadrerSiBouge,
} from "./promotion";
import { textes } from "./textes";
import {
  construireMur,
  libelleAccueilIntertitre,
  libelleTriRecents,
  type MurAccueil,
  type SourceMur,
  type TuileDonnees,
} from "./accueil";
import {
  GestionnaireSuggestions,
  construireLienPartage,
  creerAmorceurUneFois,
  extraireGraineDeLURL,
} from "./recherche";
import {
  GestionnaireService,
  SERVICES,
  construireApercuBranche,
  construireFiche,
  type PanneauFiche,
} from "./fiche";
import {
  MiroirHorsLigne,
  construireCollection,
  type EntreeAPI,
  type PanneauCollection,
} from "./collection";
import { EN_TETE_SESSION, SessionExpireeError, sessionId } from "./session";
import { afficherEchecPlantation, estEchecDePlantation, masquerEchecPlantation, texteEchecPlantation } from "./echec";
import type { ElementsEchec } from "./echec";
import {
  ajouterALaCollection as envoyerAjoutCollection,
  chargerCentre,
  chargerCollectionServeur,
  chargerFiche,
  chargerReglageServeur as recupererReglageServeur,
  chargerSuggestions,
  enTetesJSON,
  retirerDeLaCollection as envoyerRetraitCollection,
  type CentreAPI,
  type FicheAPI,
} from "./passerelle";

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
const echecPlantationEl = document.querySelector<HTMLElement>("#echec-plantation");
const formulaire = document.querySelector<HTMLFormElement>("#recherche");
const champGraine = document.querySelector<HTMLInputElement>("#graine");
const promesseAttente = document.querySelector<HTMLParagraphElement>("#promesse-attente");
const boutonZoomerAvant = document.querySelector<HTMLButtonElement>("#zoomer-avant");
const boutonZoomerArriere = document.querySelector<HTMLButtonElement>("#zoomer-arriere");
const boutonCadrage = document.querySelector<HTMLButtonElement>("#cadrage-initial");
const boutonRemonter = document.querySelector<HTMLButtonElement>("#remonter-lignee");
const boutonLogo = document.querySelector<HTMLButtonElement>("#logo");
const boutonPartager = document.querySelector<HTMLButtonElement>("#partager");
const accueilSection = document.querySelector<HTMLElement>("#accueil");
const murConteneur = document.querySelector<HTMLElement>("#mur");
const triSelect = document.querySelector<HTMLSelectElement>("#tri");
const accueilIntertitreEl = document.querySelector<HTMLElement>("#accueil-intertitre");
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

// viewportLibre (cablage) : la SEULE lecture DOM (getBoundingClientRect du
// svg et des deux panneaux ancres) — le calcul lui-meme (C7/C12, critique
// 2026-08-22) est une fonction pure de camera.ts, testee sans DOM comme le
// reste de ce module (voir sa doc la-bas). cadrageNeutre() honore deja
// viewport.x et viewport.y : il suffit de lui donner le bon rectangle, la
// camera n'a pas a changer.
function viewportLibre(): Rect {
  const largeurSvg = svg?.clientWidth || 800;
  const hauteurSvg = svg?.clientHeight || 600;
  const plein: Rect = { x: 0, y: 0, largeur: largeurSvg, hauteur: hauteurSvg };
  if (!svg) return plein;
  const boiteSvg = svg.getBoundingClientRect();

  const panneaux: PanneauMesure[] = [];
  for (const panneau of [ficheEl, collectionEl]) {
    if (!panneau || panneau.hidden) continue;
    const b = panneau.getBoundingClientRect();
    panneaux.push({
      largeur: b.width,
      hauteur: b.height,
      gauche: b.left - boiteSvg.left,
      haut: b.top - boiteSvg.top,
    });
  }
  return calculerViewportLibre(plein, boiteSvg.width, boiteSvg.height, panneaux);
}

// poserBoutonFermeture ajoute au panneau une commande de sortie, une seule
// fois, en tete.
//
// Critique 2026-08-22 C13 / C16 : le PRD §07 decrit la fiche large comme un
// « panneau lateral flottant, REPLIABLE » et la collection large comme une
// fenetre a fermer — mesure : la fiche ne portait que « Garder cet artiste »
// et « Lire … », et le panneau collection portait ZERO bouton. textes.ts
// definit deja collectionFermer (« Fermer la collection »), sans aucun usage
// dans web/src. Une fois la collection ouverte, plus rien a l'ecran ne la
// refermait.
function poserBoutonFermeture(panneau: HTMLElement, libelle: string, action: () => void): void {
  const existant = panneau.querySelector<HTMLButtonElement>(".panneau-fermer");
  if (existant) {
    existant.setAttribute("aria-label", libelle);
    return;
  }
  const bouton = document.createElement("button");
  bouton.type = "button";
  bouton.className = "panneau-fermer";
  bouton.setAttribute("aria-label", libelle);
  bouton.textContent = "\u00d7";
  bouton.addEventListener("click", action);
  panneau.prepend(bouton);
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

// recadrer recalcule le cadrage neutre apres qu'un panneau s'est ouvert ou
// referme (PRD §07 : « le canevas se recale sur l'espace restant »). Il ne
// touche PAS a la vue si l'utilisateur l'a deplacee ou zoomee lui-meme :
// reprendre la main sur sa camera parce qu'un panneau bouge serait pire que
// le defaut corrige.
function recadrer(): void {
  if (!svg || !groupeRacine) return;
  const utilisateurAOrienteLaVue = aBouge(vue, vueNeutre);
  const contenu = { x: -ANNEAU.rayonMax, y: -ANNEAU.rayonMax, largeur: 2 * ANNEAU.rayonMax, hauteur: 2 * ANNEAU.rayonMax };
  vueNeutre = cadrageNeutre(contenu, viewportLibre());
  if (!utilisateurAOrienteLaVue) {
    vue = vueNeutre;
    appliquerVue();
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

// construireSelectTri cree les trois options UNE seule fois (le select
// est reutilise a chaque retour a l'accueil, jamais recree). "recents" est
// le SEUL libelle qui depend de `source` (§17 Q10) — il est donc pose en
// SORTIE UNIQUE, apres la creation eventuelle, plutot que dans la branche
// creation ET dans la branche mise a jour separees par un `return` : les
// deux ecrivaient la meme chaine pour les memes appelants (constat
// 2026-08-23 N5). "alphabetique" et "aleatoire" restent vrais quelle que
// soit la provenance du mur, donc figes a la creation.
function construireSelectTri(source: SourceMur): void {
  if (!triSelect) return;
  if (triSelect.childElementCount === 0) {
    for (const ordre of ["recents", "alphabetique", "aleatoire"] as const) {
      const opt = document.createElement("option");
      opt.value = ordre;
      triSelect.append(opt);
    }
    const optionAlphabetique = triSelect.querySelector<HTMLOptionElement>('option[value="alphabetique"]');
    if (optionAlphabetique) optionAlphabetique.textContent = textes.triAlphabetique;
    const optionAleatoire = triSelect.querySelector<HTMLOptionElement>('option[value="aleatoire"]');
    if (optionAleatoire) optionAleatoire.textContent = textes.triAleatoire;
    triSelect.addEventListener("change", () => {
      mur?.definirOrdre(triSelect.value as "recents" | "alphabetique" | "aleatoire");
    });
  }
  const optionRecents = triSelect.querySelector<HTMLOptionElement>('option[value="recents"]');
  if (optionRecents) optionRecents.textContent = libelleTriRecents(source);
}

// afficherAccueil (F-07) : reconstruit le mur a chaque fois — jamais de
// graine residuelle, jamais d'etat de la derniere exploration qui reste
// colle.
//
// `source` (§17 Q10, decision du 23 aout 2026, constat N4) : ce que le
// mur montre — "amorcage" (seul cas atteignable aujourd'hui, la
// collection ne nourrit pas encore le mur, F-28/F-30) ou "collection".
// Parametre EXPLICITE plutot que devine ici depuis `collectionServeur` :
// tant que la seconde branche n'a pas d'appelant reel, elle doit rester
// pilotable depuis l'exterieur (tests, accueil.ts) pour ne pas pourrir
// comme `accueilVide` avant elle (jamais appelee, critique 2026-08-23 N4).
// appliquerTexteAttente (§17 Q10, critique 2026-08-23 N1) : le placeholder
// du champ de recherche porte soit la promesse (accueil visible), soit son
// texte ordinaire (ailleurs) — decision UNIQUE, appelee par les TROIS sites
// qui font basculer #accueil (afficherAccueil, masquerAccueil,
// traiterEchecPlantation), plutot qu'un quatrieme site qui la repose a la
// main : c'est ce dernier cas qui laissait le placeholder ordinaire en
// place apres un echec de plantation revenu sur l'accueil.
function appliquerTexteAttente(surAccueil: boolean): void {
  if (champGraine) champGraine.placeholder = surAccueil ? textes.accueilPromesse : textes.champRecherchePlaceholder;
  // Critique 2026-08-23-c N4 : le texte d'attente ne porte la promesse que
  // pour l'oeil — un champ qui a deja un nom accessible (<label> « Nom
  // d'artiste ») n'annonce jamais son placeholder. La promesse est donc
  // AUSSI portee par un paragraphe visuellement cache, decrit par
  // aria-describedby, pose et retire ICI, au meme endroit et au meme
  // moment que le placeholder : deux sites separes auraient derive comme
  // le placeholder avait derive avant que cette fonction n'existe.
  if (promesseAttente) promesseAttente.textContent = surAccueil ? textes.accueilPromesse : "";
  if (champGraine) {
    if (surAccueil) champGraine.setAttribute("aria-describedby", "promesse-attente");
    else champGraine.removeAttribute("aria-describedby");
  }
}

function afficherAccueil(source: SourceMur = "amorcage"): void {
  if (!accueilSection || !murConteneur || !svg) return;
  if (accueilIntertitreEl) accueilIntertitreEl.textContent = libelleAccueilIntertitre(source);
  // §17 Q10 : la promesse quitte le haut de l'accueil pour devenir le
  // texte d'attente du champ — restaure par masquerAccueil().
  appliquerTexteAttente(true);
  construireSelectTri(source);
  if (triSelect) triSelect.value = mur?.ordre ?? "recents";

  mur?.detruire();

  // L'ordre compte (§17 Q9) : le plafond du mur mesure la hauteur REELLE
  // du conteneur au moment de construireMur. #accueil doit donc deja etre
  // visible AVANT cet appel — l'inverse mesurerait un conteneur encore
  // `hidden` (hauteur nulle) et replierait sur "aucun plafond" a chaque
  // premier affichage, silencieusement.
  accueilSection.hidden = false;
  svg.setAttribute("hidden", "");
  if (ficheEl) ficheEl.hidden = true;
  if (apercuEl) apercuEl.hidden = true;
  if (etat) etat.textContent = "";
  commandesDArbre(false);

  mur = construireMur(murConteneur, AMORCAGE_EDITORIAL, {
    stockage: window.localStorage,
    surPlanter: (nom) => void planter(nom),
  });
  if (triSelect) triSelect.value = mur.ordre;
}

// commandesDArbre montre ou cache les commandes qui n'ont de sens QUE sur un
// arbre plante.
//
// Critique 2026-08-22 C4 : sur l'accueil, « Zoomer », « Dezoomer » et
// « Copier le lien de cet arbre » etaient visibles et actifs (mesure : 40x40
// chacun) alors qu'aucun arbre n'existe — et le libelle du partage nomme un
// objet absent. L'application SAIT deja retirer une commande hors contexte :
// « Revenir au cadrage initial » et « Revenir a l'artiste precedent »
// mesuraient bien 0x0 sur le meme ecran. Ces trois-la manquaient a l'appel.
// La collection (♥) reste, elle : elle a du sens sans arbre.
function commandesDArbre(visibles: boolean): void {
  if (boutonZoomerAvant) boutonZoomerAvant.hidden = !visibles;
  if (boutonZoomerArriere) boutonZoomerArriere.hidden = !visibles;
  if (boutonPartager) boutonPartager.hidden = !visibles;
}

// elementsEchec (critique 2026-08-23 N7) : la scene que la bande d'echec
// met en retrait. Le canevas n'en est qu'une moitie -- la fiche du centre
// pese 352x747 sur ecran large et 45 % de la hauteur sur ecran etroit, et
// elle restait a pleine opacite, pleinement cliquable, a cote d'une bande
// de 44 px. Recalcule a chaque appel : `hidden` change entre-temps, et
// echec.ts n'estompe que ce qui est visible.
function elementsEchec(): ElementsEchec {
  return {
    bande: echecPlantationEl,
    arbre: svg,
    plans: [accueilSection, ficheEl, apercuEl, collectionEl],
  };
}

// traiterEchecPlantation (critique 2026-08-23 N3) : les TROIS chemins qui
// menent a une bande d'echec -- centre non resolu (reconstruireScene),
// panne reseau a la plantation (planter) -- executaient la MEME regle
// recopiee mot pour mot : vider le "Chargement de …" laisse par planter(),
// masquer zoom/dezoom/partage tant qu'aucune scene n'existe (N6), rouvrir
// l'accueil quand il n'y a AUCUN arbre precedent a montrer derriere la
// bande (N4), puis poser la bande elle-meme. Deux copies, trop courtes
// pour que jscpd les voie, avaient DEJA diverge une fois (le masquage des
// commandes n'avait d'abord ete applique qu'a l'une des deux) -- symptome
// qu'une regle recopiee se defait sans qu'aucun test ne rougisse.
// `groupeRacine` (deja construit ou non) dit a lui seul s'il existe un
// arbre a estomper derriere la bande.
function traiterEchecPlantation(message: string): void {
  if (etat) etat.textContent = "";
  const arbrePresent = groupeRacine !== null;
  commandesDArbre(arbrePresent);
  if (!arbrePresent && accueilSection) {
    accueilSection.hidden = false;
    // Critique 2026-08-23 N1 : sans cette ligne, le placeholder restait
    // celui pose par masquerAccueil() (l'ordinaire) au lieu de la promesse
    // que l'accueil doit montrer — exactement quand le visiteur vient
    // d'echouer une plantation.
    appliquerTexteAttente(true);
    // §17 Q11 : sans cette ligne, #canevas restait DEMASQUE -- planter()
    // appelle masquerAccueil() (qui retire `hidden` de #canevas) AVANT de
    // savoir que la tentative va echouer, et rien ne le remasquait ici.
    // Invisible sous l'ancien empilement (#accueil en `position:absolute;
    // inset:0` passait PAR-DESSUS un canevas vide, 0 noeud) : redevenu
    // visible des que #accueil participe a la grille de <main> (regle
    // `main:has(...)`, index.html) -- un #canevas normal-flow, non masque,
    // devient alors un item de grille de PLUS, qui vole de la hauteur a
    // #accueil (mesure : 194px de mur perdus au lieu de 44px). Sur le
    // premier echec depuis un accueil vierge (aucun arbre n'existe encore),
    // #canevas doit rester masque au meme titre que la fiche et l'apercu.
    if (svg) svg.setAttribute("hidden", "");
  }
  afficherEchecPlantation(elementsEchec(), message, arbrePresent);
  // §17 Q11 : la bande pousse #accueil (index.html, regle `main:has(...)`)
  // -- la hauteur reellement disponible pour `.mur` vient de changer,
  // exactement comme au redimensionnement (§17 Q9). Meme appel, jamais un
  // mecanisme neuf ; sans lui, la derniere rangee resterait rognee tant
  // que la bande reste affichee. Sans effet si l'accueil n'est pas la
  // scene visible (arbrePresent) : `mur` porte alors l'accueil precedent,
  // deja detruit au prochain afficherAccueil().
  if (!arbrePresent) mur?.replafonner();
}

function masquerAccueil(): void {
  if (!accueilSection || !svg) return;
  accueilSection.hidden = true;
  svg.removeAttribute("hidden");
  commandesDArbre(true);
  // §17 Q10 : la promesse ne s'applique qu'a l'accueil — le champ retrouve
  // son texte d'attente ordinaire des qu'une graine est plantee.
  appliquerTexteAttente(false);
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

async function afficherFiche(centreAPI: CentreAPI): Promise<void> {
  if (!ficheEl) return;
  const nom = centreAPI.artiste.nom;
  const fiche = await chargerFiche(nom, gestionnaireService.service);
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
  poserBoutonFermeture(ficheEl, textes.ficheReplier, () => {
    ficheEl.hidden = true;
    recadrer();
  });
  ficheEl.hidden = false;
  recadrer(); // C7 : la fiche vient d'occuper le bas (etroit) ou la droite (large)
}

// ---------------------------------------------------------------------
// Collection : garder, retirer, afficher, replanter, miroir hors ligne
// (F-28 a F-33, PRP 07). identite.DepuisRequete cote serveur cloisonne
// deja par X-Forwarded-User (N-08) ; ce module ne porte JAMAIS
// l'identite, seulement le jeton de session (mesure) dans les en-tetes.
// ---------------------------------------------------------------------

/** estGarde() lit la vue FUSIONNEE (serveur + miroir hors ligne, F-33) :
 * c'est elle qui doit refleter l'etat "garde" du bouton de la fiche,
 * jamais collectionServeur seule, qui ignorerait un ajout hors ligne pas
 * encore confirme. */
function estGarde(mbid: string | null): boolean {
  if (!mbid) return false;
  return miroir.vue(collectionServeur).some((e) => e.mbid === mbid);
}

// actualiserCollection recharge la copie serveur ET repeint le panneau
// (F-30 : lignee et date), sans jamais reconstruire le conteneur une fois
// le panneau construit (idempotence, meme discipline que fiche.ts).
async function actualiserCollection(): Promise<void> {
  // C17 (critique 2026-08-22) : un 401 sur /api/collection dit "la session a
  // expire", jamais "la collection est vide" (F-41) — meme distinction, meme
  // affichage que sur les trois autres chemins de chargerCentre.
  try {
    collectionServeur = await chargerCollectionServeur(session, window.location.origin);
  } catch (erreur) {
    if (erreur instanceof SessionExpireeError) {
      afficherSessionExpiree();
      return;
    }
    throw erreur;
  }
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
      // Apres construireCollection, qui remplace tout le contenu du panneau.
      poserBoutonFermeture(collectionEl, textes.collectionFermer, () => {
        collectionEl.hidden = true;
        if (ficheEl) ficheEl.hidden = nomCentreCourant === null;
        recadrer();
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
  const ok = await envoyerAjoutCollection(session, { nom, mbid, lignee: e.lignee });
  if (ok) miroir.confirmer([...collectionServeur, e]);
  await actualiserCollection();
}

async function retirerDeLaCollection(mbid: string): Promise<void> {
  miroir.retirer(mbid);
  panneauFiche?.actualiserGarde(false);
  await envoyerRetraitCollection(session, mbid);
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
      await fetch("/api/collection", { method: "PUT", headers: enTetesJSON(session), body: JSON.stringify(e) });
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
  recadrer(); // C7/C12 : l'espace libre du canevas vient de changer
  if (vaOuvrir) void actualiserCollection();
});

// ---------------------------------------------------------------------
// Suggestions, rattrapage (F-01 a F-04)
// ---------------------------------------------------------------------

let requeteSuggestionsEnCours = 0;
let minuteurSuggestions: number | undefined;

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

// reconstruireScene peint une scene ENTIEREMENT NEUVE a partir d'un
// CentreAPI deja charge — partagee par planter() (une graine, F-04) et
// remonterLignee() (F-14) : les deux repartent d'un centre sans noeud
// existant a promouvoir, contrairement a promouvoirVers() qui, lui, fait
// voyager un noeud DEJA present (F-12).
function reconstruireScene(centreAPI: CentreAPI, nomDemande: string): void {
  if (!svg) return;

  // Defaut #1 (REFERENCE.md) corrige : sur un centre "aucun_voisin"/"panne",
  // centreAPI.artiste.nom est une chaine VIDE (Artiste zero-valeur, voir
  // centreVide()/centrePanne() cote Go) — la garder telle quelle rendait
  // `nomCentreCourant` faux, donc SAUTE par `if (nomCentreCourant)` plus bas
  // (planter/promouvoirVers), alors que GestionnaireLignee.commencerPromotion,
  // lui, avait deja pousse une entree. Repli sur `nomDemande` (le nom
  // REELLEMENT demande, toujours non vide) : nomCentreCourant ne peut plus
  // etre faux alors qu'un centre existe deja, ce qui garde `ligneeNoms` et
  // `lignee.lignee` de MEME longueur en toute circonstance. Pose ICI, AVANT
  // le guard d'echec de plantation ci-dessous (§17 Q6) : une tentative
  // corrigee compte, a bon droit, comme un centre quitte (F-14, F-29/F-30,
  // web/tests/e2e/parcours.spec.ts) MEME quand rien ne se dessine.
  nomCentreCourant = centreAPI.artiste.nom || nomDemande;

  // §17 Q6 (PRODUCT.md, decision du 22 aout 2026) : un centre qui n'a RIEN
  // resolu ne reconstruit plus la scene -- l'ancien artiste fantome
  // (critique 2026-08-22 C15) laisse place a une bande d'echec, l'arbre
  // precedent conserve DERRIERE elle, estompe (echec.ts). `groupeRacine`
  // (deja construit ou non) dit s'il existe un arbre a estomper.
  if (estEchecDePlantation(centreAPI)) {
    // Critique 2026-08-23 N4 : sans arbre precedent, planter() venait de
    // masquer l'accueil -- l'echec laissait 791 px de noir, zero contenu et
    // zero action, apres avoir retire les six amorces qui etaient le seul
    // moyen de rebondir. §17 Q6 ecarte la variante A precisement parce
    // qu'elle "punit une faute de frappe par la perte de l'exploration" :
    // le mur est le plan precedent de l'accueil, il reste donc derriere la
    // bande, au meme titre que l'arbre. planter() rappelle masquerAccueil()
    // a la tentative suivante, la reapparition est donc sans suite.
    // Critique 2026-08-23 N6 : C4 avait masque zoom/dezoom/partage tant
    // qu'aucune graine n'etait plantee, mais la condition portait sur la
    // SOUMISSION, pas sur l'existence d'une scene -- l'echec les rouvrait
    // sur un ecran sans le moindre noeud, "Copier le lien de cet arbre"
    // compris. Les deux sont traites par traiterEchecPlantation (N3), une
    // seule fois pour les deux chemins qui menent ici.
    traiterEchecPlantation(texteEchecPlantation(centreAPI));
    if (centreAPI.etat === "aucun_voisin") void tenterRattrapage(nomDemande); // F-03 : la correction reste proposee, EN PLUS de la bande
    return;
  }
  masquerEchecPlantation(elementsEchec());
  // §17 Q11 : symetrique de l'appel pose dans traiterEchecPlantation --
  // si la bande se leve pendant que l'accueil est ENCORE la scene visible,
  // #mur recupere la hauteur qu'elle lui prenait, et le plafond doit le
  // suivre (§17 Q9). Sans effet ici en pratique (planter() a deja masque
  // l'accueil plus haut dans cette meme fonction) : pose pour rester vrai
  // si ce chemin change un jour, pas pour corriger un defaut observe.
  if (accueilSection && !accueilSection.hidden) mur?.replafonner();

  svg.replaceChildren();
  const racine = document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement;
  racine.setAttribute("class", "racine");
  svg.append(racine);
  groupeRacine = racine;
  groupes = creerGroupes(racine);
  noeudsDessines = new Map();

  // Ici, l'echec de plantation est deja ecarte (guard ci-dessus) : ce qui
  // reste sous "aucun_voisin" est toujours un mbid REEL (F-36, "aucun
  // voisin connu pour CET artiste" -- un resultat legitime, jamais un
  // fantome).
  if (!centreAPI.branches || centreAPI.branches.length === 0) {
    if (etat) etat.textContent = centreAPI.message ?? "Aucun voisin connu pour cet artiste.";
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

  const viewport = viewportLibre();
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
    centreAPI = await chargerCentre(nom, session, window.location.origin, { amorce });
  } catch (erreur) {
    if (lignee.estPerimee(generation)) return;
    if (erreur instanceof SessionExpireeError) {
      afficherSessionExpiree();
    } else {
      // §17 Q6 : une plantation qui echoue au niveau reseau (jamais de
      // reponse serveur exploitable) est un echec de plantation comme un
      // autre -- meme bande, meme arbre precedent conserve derriere elle,
      // traite par traiterEchecPlantation (N3) comme le centre non resolu
      // de reconstruireScene.
      traiterEchecPlantation(textes.reseauIndisponible);
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
    centreAPI = await chargerCentre(nomCible, session, window.location.origin, { origine: "promotion" });
  } catch (erreur) {
    if (lignee.estPerimee(nav.generation)) return;
    if (erreur instanceof SessionExpireeError) {
      afficherSessionExpiree();
    } else if (etat) {
      etat.textContent = textes.reseauIndisponible;
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
      chargerCentre: () => chargerCentre(nom, session, window.location.origin, { origine: "promotion" }), // M-01
    });
  } catch (erreur) {
    if (erreur instanceof SessionExpireeError) {
      afficherSessionExpiree();
    } else if (etat) {
      etat.textContent = textes.reseauIndisponible;
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
  masquerEchecPlantation(elementsEchec()); // §17 Q6 : le visiteur repart, la bande se leve
  // §17 Q11 : pas de mur?.replafonner() ici -- afficherAccueil() ci-dessous
  // detruit le mur courant et en construit un NEUF, qui mesure deja la
  // hauteur correcte (bande levee) a sa premiere peinture. Un appel ici
  // serait sans effet (mur pas encore reconstruit) et immediatement suivi
  // d'une reconstruction complete.
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
// Constat de revue (PRP 06) : role="listbox" sans nom accessible n'annonce
// qu'"liste, N elements" a un lecteur d'ecran — jamais de QUOI la liste
// parle. textes.suggestionsLabel comble ce manque (WCAG 4.1.2).
if (suggestionsEl) suggestionsEl.setAttribute("aria-label", textes.suggestionsLabel);
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
// Constat C2 (critique 2026-08-22) : ces trois libelles etaient figes en dur
// dans index.html, sans accent, et avaient deja diverge de textes.ts (qui
// les porte accentues). Cables ici comme le reste des aria-label de ce
// fichier : une seule source de verite, index.html ne fige plus rien.
if (boutonZoomerArriere) boutonZoomerArriere.setAttribute("aria-label", textes.zoomerArriere);
if (boutonZoomerAvant) boutonZoomerAvant.setAttribute("aria-label", textes.zoomerAvant);
if (serviceSelect) serviceSelect.setAttribute("aria-label", textes.choisirService);
construireSelectService();

// F-25 (close) : le service releve du serveur au demarrage — jamais du
// seul navigateur, pour qu'il suive le proprietaire d'un appareil a
// l'autre. Ecrit a chaque changement ; un echec reseau laisse le choix en
// memoire pour la session courante, sans casser l'ecran (degradation
// gracieuse, comme partout ailleurs dans le client).
async function chargerReglageServeur(): Promise<void> {
  const corps = await recupererReglageServeur(session);
  if (!corps) return; // Le service par defaut du client (fiche.ts) reste en vigueur pour cette session.
  if (corps.service && (SERVICES as readonly string[]).includes(corps.service)) {
    gestionnaireService.definir(corps.service as (typeof SERVICES)[number]);
    if (serviceSelect) serviceSelect.value = corps.service;
  }
}
gestionnaireService.observer((s) => {
  void fetch("/api/reglages", { method: "PUT", headers: enTetesJSON(session), body: JSON.stringify({ service: s }) }).catch(
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

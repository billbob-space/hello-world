// apps/ramure-v2/web/tests/e2e/support/api.ts
//
// Le "reseau simule" cote navigateur (PRP 09, tache 1) : intercepte TOUTE
// requete `/api/...` avant qu'elle ne quitte la page (Playwright
// `page.route`) et repond avec des donnees fabriquees ici — jamais une
// requete reelle vers MusicBrainz, Deezer, Odesli ou Last.fm/ListenBrainz,
// qui restent hors d'atteinte du serveur applicatif COMME du poste qui
// joue ces tests (PRD §13 : "tester contre des sources reelles produit des
// echecs intermittents"). Les formes JSON ci-dessous sont un miroir EXACT
// des interfaces cote client (web/src/main.ts, recherche.ts, fiche.ts,
// collection.ts) : un champ qui divergerait romprait silencieusement le
// contrat que ce fichier existe pour figer.
//
// /api/collection et /api/reglages exigent normalement X-Forwarded-User
// (identite.DepuisRequete, N-08), pose par Traefik en production et donc
// ABSENT du serveur de developpement local que ces tests demarrent
// (support/serveur.ts) : elles sont interceptees ici comme les autres,
// jamais laissees atteindre le vrai gestionnaire Go, qui repondrait 401.
import type { Page, Route } from "@playwright/test";

// ---------------------------------------------------------------------
// Formes JSON (miroir des interfaces TypeScript client)
// ---------------------------------------------------------------------

export interface VoisinAPI {
  nom: string;
  mbid: string;
  affinite: number;
}

export interface IllustrationAPI {
  petite: string;
  moyenne: string;
  grande: string;
}

export interface BrancheAPI {
  voisin: VoisinAPI;
  illustration: IllustrationAPI;
  lienDeezer?: string;
  heritiers?: VoisinAPI[];
}

export interface AlbumAPI {
  mbid: string;
  titre: string;
  sortie: string;
  type: string;
  note: number;
  votes: number;
}

export interface ProfilAPI {
  presentation: string;
  genres: string[];
  auditeurs: number;
}

export interface CentreAPI {
  artiste: { nom: string; mbid: string; pays: string; desambiguisation: string };
  profil?: ProfilAPI;
  illustration: IllustrationAPI;
  discographie?: AlbumAPI[];
  branches?: BrancheAPI[];
  etat: "ok" | "aucun_voisin" | "panne";
  message?: string;
}

export interface ExtraitAPI {
  titre: string;
  url: string;
  duree: number;
}

export interface FicheAPI {
  profil: ProfilAPI;
  extraits: ExtraitAPI[];
  lienEcoute: string;
  lienDeezer?: string;
}

export interface SuggestionAPI {
  nom: string;
  mbid: string;
  correction?: boolean;
}

export interface EntreeAPI {
  nom: string;
  mbid: string;
  lignee?: string[];
  ajoute: string;
}

// ---------------------------------------------------------------------
// Fabriques : construire des fixtures lisibles depuis les specs, jamais
// des litteraux JSON dupliques dans chaque fichier de test.
// ---------------------------------------------------------------------

/** mbidDe derive un identifiant STABLE et LISIBLE a partir d'un nom — les
 * assertions des specs peuvent le reconstruire sans le stocker a part. */
const DIACRITIQUES_COMBINEES = /[̀-ͯ]/g; // accents isoles par normalize("NFD")

export function mbidDe(nom: string): string {
  return `mbid-${nom
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITIQUES_COMBINEES, "")
    .replace(/[^a-z0-9]+/g, "-")}`;
}

/** image() rend une image EMBARQUEE (data: URI), jamais une URL a
 * resoudre par le navigateur : aucune requete reseau supplementaire a
 * intercepter pour peindre les illustrations des noeuds. */
export function image(couleur: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${couleur}"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function illustrationDe(nom: string, couleur: string): IllustrationAPI {
  const url = image(couleur);
  return { petite: url, moyenne: url, grande: url };
}

export interface OptionsBranche {
  affinite?: number;
  heritiers?: number;
  couleur?: string;
  /** Noms explicites des heritiers, COURTS par defaut (voir NOMS_HERITIERS
   * ci-dessous) : suffixer chaque heritier avec le nom de sa branche
   * ("<branche> (heritier N)") produit des libelles artificiellement longs
   * qui se recouvrent presque TOUJOURS a l'echelle RAYON_HERITIER=34px
   * (geometrie.ts) -- un artefact de fixture, pas une propriete du
   * produit. Des noms courts et INDEPENDANTS, comme le seraient de vrais
   * noms d'artistes voisins, donnent une mesure fidele ; geometrie.spec.ts
   * documente separement le risque avec des noms plus longs. */
  nomsHeritiers?: string[];
}

const NOMS_HERITIERS = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"];

/** branche() construit une BrancheAPI complete (voisin + illustration +
 * lien Deezer + heritiers optionnels) — jamais une branche sans
 * illustration ni lien, qui serait ELAGUEE cote serveur reel (F-16) et
 * fausserait donc le compte de noeuds attendu par les tests. */
export function branche(nom: string, options: OptionsBranche = {}): BrancheAPI {
  const couleur = options.couleur ?? "#4a7a9c";
  const nHeritiers = options.heritiers ?? 0;
  const noms = options.nomsHeritiers ?? NOMS_HERITIERS;
  return {
    voisin: { nom, mbid: mbidDe(nom), affinite: options.affinite ?? 0.7 },
    illustration: illustrationDe(nom, couleur),
    lienDeezer: `https://www.deezer.com/artist/${mbidDe(nom)}`,
    heritiers:
      nHeritiers > 0
        ? Array.from({ length: nHeritiers }, (_, i) => {
            const nomHeritier = noms[i % noms.length]! + (nHeritiers > noms.length ? ` ${i}` : "");
            return {
              nom: nomHeritier,
              mbid: `${mbidDe(nom)}-${mbidDe(nomHeritier)}`,
              affinite: Math.max(0.05, (options.affinite ?? 0.7) - 0.3),
            };
          })
        : undefined,
  };
}

export interface OptionsCentre {
  branches?: BrancheAPI[];
  profil?: Partial<ProfilAPI>;
  discographie?: AlbumAPI[];
}

/** centreOK() : un centre complet, etat "ok", pret pour GET /api/centre —
 * l'artiste, son profil, sa discographie et son entourage, exactement
 * comme internal/api/centre.go le rendrait pour une resolution reussie. */
export function centreOK(nom: string, options: OptionsCentre = {}): CentreAPI {
  const mbid = mbidDe(nom);
  const branches =
    options.branches ??
    [branche(`${nom} — voisin 1`, { affinite: 0.85, heritiers: 2 }), branche(`${nom} — voisin 2`, { affinite: 0.6 })];
  return {
    artiste: { nom, mbid, pays: "GB", desambiguisation: "" },
    profil: {
      presentation: `${nom} est un artiste fabrique pour la recette (PRP 09).`,
      genres: ["trip-hop", "electronique"],
      auditeurs: 123_456,
      ...options.profil,
    },
    illustration: illustrationDe(nom, "#c9743a"),
    discographie: options.discographie ?? [
      { mbid: `${mbid}-album-1`, titre: `${nom} (premier album)`, sortie: "1994-08-22", type: "studio", note: 4.5, votes: 42 },
      { mbid: `${mbid}-album-2`, titre: `${nom} en concert`, sortie: "1998-01-01", type: "live", note: 0, votes: 0 },
    ],
    branches,
    etat: "ok",
  };
}

/** centreVide() : F-36, "rien a montrer" — jamais confondu avec une panne
 * (voir centrePanne ci-dessous). artiste.mbid VIDE reproduit le cas ou le
 * nom demande n'a resolu vers AUCUN artiste (internal/arbre.centreVide) :
 * c'est ce qui declenche tenterRattrapage cote client (F-03). */
export function centreVide(message: string): CentreAPI {
  return {
    artiste: { nom: "", mbid: "", pays: "", desambiguisation: "" },
    illustration: { petite: "", moyenne: "", grande: "" },
    etat: "aucun_voisin",
    message,
  };
}

/** centrePanne() : F-37, une source indisponible — DISTINCT du vide
 * ci-dessus, un seul des deux messages invite a reessayer. */
export function centrePanne(message: string): CentreAPI {
  return {
    artiste: { nom: "", mbid: "", pays: "", desambiguisation: "" },
    illustration: { petite: "", moyenne: "", grande: "" },
    etat: "panne",
    message,
  };
}

export interface OptionsFiche {
  extraits?: ExtraitAPI[];
  lienEcoute?: string;
  lienDeezer?: string;
  presentation?: string;
}

export function ficheDe(nom: string, options: OptionsFiche = {}): FicheAPI {
  return {
    profil: {
      presentation: options.presentation ?? `${nom} est un artiste fabrique pour la recette (PRP 09).`,
      genres: ["trip-hop"],
      auditeurs: 123_456,
    },
    extraits:
      options.extraits ??
      [
        { titre: `${nom} — extrait 1`, url: `https://exemple.invalide/${mbidDe(nom)}-1.mp3`, duree: 30 },
        { titre: `${nom} — extrait 2`, url: `https://exemple.invalide/${mbidDe(nom)}-2.mp3`, duree: 30 },
      ],
    lienEcoute: options.lienEcoute ?? `https://www.deezer.com/search/${encodeURIComponent(nom)}`,
    lienDeezer: options.lienDeezer ?? `https://www.deezer.com/artist/${mbidDe(nom)}`,
  };
}

/** pageSessionExpiree() imite EXACTEMENT ce que Traefik rend a la place du
 * JSON attendu quand la session forwardauth a expire (F-41) : un 200 dont
 * le Content-Type est text/html — le SEUL signal que
 * estReponseSessionExpiree() (web/src/session.ts) sait lire sans
 * redirection reelle a orchestrer dans ce mock. */
export const HTML_SESSION_EXPIREE =
  "<!doctype html><html><body>Connexion Google requise (page fabriquee par la recette, PRP 09)</body></html>";

// ---------------------------------------------------------------------
// Scenario : l'etat mutable que chaque test pilote au fil du parcours.
// ---------------------------------------------------------------------

export class ScenarioAPI {
  readonly centres = new Map<string, CentreAPI>();
  readonly suggestions = new Map<string, SuggestionAPI[]>();
  readonly fiches = new Map<string, FicheAPI>();
  ecouterParDefaut = "https://www.deezer.com/search/exemple";
  collection: EntreeAPI[] = [];
  reglages: { service: string } = { service: "deezer" };

  /** N-14, "depassement de quota" (PRP 09) : le PRD est explicite, un
   * visiteur seul n'est JAMAIS rejete, il attend son tour. Simuler un
   * quota depasse par une ERREUR HTTP contredirait cette exigence — ce
   * champ retarde donc la PROCHAINE reponse a /api/centre au lieu de la
   * faire echouer, puis se remet a zero une fois consomme. */
  delaiProchainCentreMs = 0;

  /** F-41 : une fois posee, TOUTE requete /api/... recoit la page HTML de
   * Traefik plutot que le JSON attendu — imite une session qui a expire
   * PENDANT une exploration, quel que soit l'endroit ou elle frappe. */
  sessionExpiree = false;

  /** F-33 : une fois posee, TOUTE requete /api/... echoue reellement
   * (route.abort) plutot que d'etre servie par ce mock — necessaire en
   * plus de `context.setOffline(true)` (Playwright), qui ne suffit PAS a
   * elle seule : une route DEJA interceptee et servie par
   * `route.fulfill()` contourne entierement l'emulation hors ligne
   * (verifie empiriquement lors de l'ecriture de ce fichier). C'est ce
   * double dispositif — offline navigateur ET requetes qui echouent pour
   * de vrai — qui rend le cycle hors ligne de collection-hors-ligne.spec.ts
   * REEL, pas simule par un simple booleen cote client. */
  horsLigne = false;

  definirCentre(nom: string, centre: CentreAPI): this {
    this.centres.set(nom, centre);
    return this;
  }

  definirSuggestions(q: string, suggestions: SuggestionAPI[]): this {
    this.suggestions.set(q, suggestions);
    return this;
  }

  definirFiche(nom: string, fiche: FicheAPI): this {
    this.fiches.set(nom, fiche);
    return this;
  }
}

function json(route: Route, statut: number, corps: unknown): Promise<void> {
  return route.fulfill({ status: statut, contentType: "application/json; charset=utf-8", body: JSON.stringify(corps) });
}

/** installerAPI cable l'interception AVANT toute navigation (a appeler
 * avant page.goto) : un enregistrement tardif laisserait passer la toute
 * premiere requete vers le vrai gestionnaire Go. */
export async function installerAPI(page: Page, scenario: ScenarioAPI): Promise<void> {
  await page.route("**/api/**", async (route) => {
    const requete = route.request();
    const url = new URL(requete.url());
    const chemin = url.pathname;
    const methode = requete.method();

    if (scenario.horsLigne) {
      await route.abort("internetdisconnected");
      return;
    }

    if (scenario.sessionExpiree) {
      await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: HTML_SESSION_EXPIREE });
      return;
    }

    if (chemin === "/api/centre" && methode === "GET") {
      if (scenario.delaiProchainCentreMs > 0) {
        const attente = scenario.delaiProchainCentreMs;
        scenario.delaiProchainCentreMs = 0;
        await new Promise((r) => setTimeout(r, attente));
      }
      const nom = url.searchParams.get("nom") ?? "";
      const centre = scenario.centres.get(nom) ?? centreVide(`Aucun artiste ne correspond a "${nom}".`);
      await json(route, centre.etat === "panne" ? 503 : 200, centre);
      return;
    }

    if (chemin === "/api/suggest" && methode === "GET") {
      const q = url.searchParams.get("q") ?? "";
      await json(route, 200, scenario.suggestions.get(q) ?? []);
      return;
    }

    if (chemin === "/api/fiche" && methode === "GET") {
      const nom = url.searchParams.get("nom") ?? "";
      const fiche = scenario.fiches.get(nom) ?? { profil: { presentation: "", genres: [], auditeurs: 0 }, extraits: [], lienEcoute: scenario.ecouterParDefaut };
      await json(route, 200, fiche);
      return;
    }

    if (chemin === "/api/ecouter" && methode === "GET") {
      await json(route, 200, { lien: scenario.ecouterParDefaut });
      return;
    }

    if (chemin === "/api/collection" && methode === "GET") {
      await json(route, 200, scenario.collection);
      return;
    }
    if (chemin === "/api/collection" && methode === "PUT") {
      const corps = requete.postDataJSON() as { nom: string; mbid: string; lignee?: string[] };
      const entree: EntreeAPI = { nom: corps.nom, mbid: corps.mbid, lignee: corps.lignee, ajoute: new Date().toISOString() };
      scenario.collection = [...scenario.collection.filter((e) => e.mbid !== entree.mbid), entree];
      await json(route, 200, entree);
      return;
    }
    if (chemin === "/api/collection" && methode === "DELETE") {
      const mbid = url.searchParams.get("mbid") ?? "";
      scenario.collection = scenario.collection.filter((e) => e.mbid !== mbid);
      await route.fulfill({ status: 204 });
      return;
    }

    if (chemin === "/api/reglages" && methode === "GET") {
      await json(route, 200, scenario.reglages);
      return;
    }
    if (chemin === "/api/reglages" && methode === "PUT") {
      const corps = requete.postDataJSON() as { service: string };
      scenario.reglages = { service: corps.service };
      await json(route, 200, scenario.reglages);
      return;
    }

    if (chemin === "/api/diagnostic" && methode === "GET") {
      await json(route, 200, []);
      return;
    }

    // Route /api inconnue du scenario : signale par un echec explicite
    // plutot qu'un `route.continue()` qui laisserait fuir une requete vers
    // le vrai gestionnaire Go et, potentiellement, vers le reseau reel.
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ erreur: `route non simulee : ${methode} ${chemin}` }) });
  });
}

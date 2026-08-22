// apps/ramure-v2/web/src/passerelle.ts
//
// La seule couche qui parle a /api : requetes, en-tetes, decodage JSON et
// traitement de SessionExpireeError (F-41). Extrait de main.ts (PRP 06,
// revue) — memes requetes, memes en-tetes, meme gestion des erreurs,
// AUCUN comportement deplace. Fonctions PURES vis-a-vis du module : pas
// d'etat global ici, tout ce dont une fonction depend (session, service,
// origine du document) lui est passe en parametre. main.ts garde le
// cablage DOM/evenements et la composition avec son propre etat (miroir
// hors ligne, panneaux, lignee).
import { dispositionCourante } from "./disposition";
import type { EntreeAPI } from "./collection";
import type { SuggestionAPI } from "./recherche";
import type { AlbumAPI, ExtraitAPI, ProfilAPI } from "./fiche";
import { EN_TETE_SESSION, SessionExpireeError, estReponseSessionExpiree } from "./session";

// Champs du JSON rendu par GET /api/centre : une seule convention
// d'etiquetage — camelCase minuscule — sur tous les types, y compris
// internal/source.* (Artiste, Voisin, Illustration, Profil, Album), qui
// portent desormais une etiquette json explicite au meme titre que
// Branche/Centre.
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

export interface CentreAPI {
  artiste: { nom: string; mbid: string; pays: string; desambiguisation: string };
  profil?: ProfilAPI;
  illustration: IllustrationAPI;
  discographie?: AlbumAPI[];
  branches?: BrancheAPI[];
  etat: "ok" | "aucun_voisin" | "panne";
  message?: string;
}

export interface FicheAPI {
  profil: ProfilAPI;
  extraits: ExtraitAPI[];
  lienEcoute: string;
  lienDeezer?: string;
}

/** enTetesJSON() pose l'en-tete de session (mesure, N-09/N-10) a cote de
 * Content-Type sur toute requete PUT/DELETE qui porte un corps JSON. */
export function enTetesJSON(session: string): HeadersInit {
  return { "Content-Type": "application/json", [EN_TETE_SESSION]: session };
}

// chargerFiche appelle GET /api/fiche a l'OUVERTURE de la fiche — jamais
// au chargement de l'arbre (§07) : c'est le seul endroit qui charge
// Extraits, et le seul cout que ce PRP ajoute au-dela des deux appels
// MusicBrainz du centre.
export async function chargerFiche(nom: string, service: string): Promise<FicheAPI | null> {
  try {
    const reponse = await fetch(`/api/fiche?nom=${encodeURIComponent(nom)}&service=${encodeURIComponent(service)}`);
    if (!reponse.ok) return null;
    return (await reponse.json()) as FicheAPI;
  } catch {
    return null;
  }
}

export async function chargerSuggestions(q: string): Promise<SuggestionAPI[]> {
  try {
    const reponse = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
    if (!reponse.ok) return [];
    return (await reponse.json()) as SuggestionAPI[];
  } catch {
    return [];
  }
}

export async function chargerCollectionServeur(session: string): Promise<EntreeAPI[]> {
  try {
    const reponse = await fetch("/api/collection", { headers: { [EN_TETE_SESSION]: session } });
    if (!reponse.ok) return [];
    return (await reponse.json()) as EntreeAPI[];
  } catch {
    return []; // hors ligne (F-33) : le miroir local prend le relais dans vue()
  }
}

/** ajouterALaCollection() n'est que l'appel reseau (PUT) : le miroir hors
 * ligne et le retour visuel immediat restent dans main.ts, qui doit rester
 * a jour meme quand cette requete echoue. Rend `true` seulement si le
 * serveur a confirme (reponse.ok) ; `false` sur toute panne, comme le
 * `catch` d'origine qui laissait l'entree en attente dans le miroir. */
export async function ajouterALaCollection(
  session: string,
  entree: { nom: string; mbid: string; lignee?: string[] },
): Promise<boolean> {
  try {
    const reponse = await fetch("/api/collection", {
      method: "PUT",
      headers: enTetesJSON(session),
      body: JSON.stringify(entree),
    });
    return reponse.ok;
  } catch {
    return false; // reste en attente dans le miroir : reconcilie a la reconnexion (F-33)
  }
}

/** retirerDeLaCollection() n'est que l'appel reseau (DELETE), au meme
 * titre : une panne est avalee ici exactement comme le `catch` d'origine
 * l'avalait dans main.ts — le miroir hors ligne, mis a jour par
 * l'appelant, porte deja le retrait en attente. */
export async function retirerDeLaCollection(session: string, mbid: string): Promise<void> {
  try {
    await fetch(`/api/collection?mbid=${encodeURIComponent(mbid)}`, {
      method: "DELETE",
      headers: { [EN_TETE_SESSION]: session },
    });
  } catch {
    // Reste en attente dans le miroir : reconcilie a la reconnexion (F-33).
  }
}

// chargerReglageServeur (F-25, close) : le service releve du serveur au
// demarrage. Rend `null` sur toute panne ou reponse non ok — c'est
// l'appelant (main.ts) qui decide alors de garder le defaut du client en
// vigueur pour la session courante (degradation gracieuse, §09).
export async function chargerReglageServeur(session: string): Promise<{ service?: string } | null> {
  try {
    const reponse = await fetch("/api/reglages", { headers: { [EN_TETE_SESSION]: session } });
    if (!reponse.ok) return null;
    return (await reponse.json()) as { service?: string };
  } catch {
    return null;
  }
}

// chargerCentre porte le jeton de session (mesure) et, sur une plantation
// seulement, l'amorcage (M-06/M-07) : jamais sur une promotion, que le
// serveur distingue via origine=promotion (internal/api/centre.go).
// `origineDocument` est `window.location.origin`, passe en parametre pour
// que cette fonction reste sans etat global — estReponseSessionExpiree()
// en a besoin pour distinguer une vraie reponse d'une redirection Traefik
// suivie en silence (F-41).
export async function chargerCentre(
  nom: string,
  session: string,
  origineDocument: string,
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
  if (estReponseSessionExpiree(reponse, origineDocument)) {
    throw new SessionExpireeError();
  }
  return (await reponse.json()) as CentreAPI;
}

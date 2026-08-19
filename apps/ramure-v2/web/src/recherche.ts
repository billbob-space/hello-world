// apps/ramure-v2/web/src/recherche.ts
//
// Recherche, suggestions, rattrapage orthographique et partage d'un arbre
// (PRP 06, tache 2 : F-01 a F-04, F-34). Logique PURE, sans DOM ni reseau —
// main.ts cable ce module contre le champ de recherche et /api/suggest.

/** Forme JSON rendue par GET /api/suggest (internal/api/suggest.go). */
export interface SuggestionAPI {
  nom: string;
  mbid: string;
  correction?: boolean;
}

// GestionnaireSuggestions porte l'etat d'une liste de suggestions
// deroulante : navigation clavier cyclique (F-02), expose ce qu'exigent
// aria-expanded / aria-activedescendant / role="listbox" pour qu'un
// lecteur d'ecran sache que la liste existe (F-02, §12).
export class GestionnaireSuggestions {
  #suggestions: SuggestionAPI[] = [];
  #index: number | null = null;

  get suggestions(): readonly SuggestionAPI[] {
    return this.#suggestions;
  }

  get indexActif(): number | null {
    return this.#index;
  }

  /** aria-expanded : la liste existe et porte au moins une suggestion. */
  get ouvert(): boolean {
    return this.#suggestions.length > 0;
  }

  definir(suggestions: SuggestionAPI[]): void {
    this.#suggestions = suggestions;
    this.#index = null;
  }

  effacer(): void {
    this.#suggestions = [];
    this.#index = null;
  }

  suivant(): void {
    if (this.#suggestions.length === 0) return;
    this.#index = this.#index === null ? 0 : (this.#index + 1) % this.#suggestions.length;
  }

  precedent(): void {
    if (this.#suggestions.length === 0) return;
    const n = this.#suggestions.length;
    this.#index = this.#index === null ? n - 1 : (this.#index - 1 + n) % n;
  }

  /** La suggestion actuellement survolee au clavier, ou null. */
  selection(): SuggestionAPI | null {
    return this.#index === null ? null : (this.#suggestions[this.#index] ?? null);
  }

  /** aria-activedescendant : identifiant DOM de l'option active. */
  idActif(prefixe: string): string | null {
    return this.#index === null ? null : `${prefixe}-${this.#index}`;
  }

  /**
   * correction() (F-03, §09) rend le SEUL candidat marque "correction" par
   * le serveur (internal/api/suggest.go, source.CorrectionPlausible) — ou
   * null. Ne substitue jamais : c'est a l'appelant de l'AFFICHER
   * ("tu voulais dire … ?") et d'attendre une validation explicite.
   */
  correction(): SuggestionAPI | null {
    return this.#suggestions.find((s) => s.correction) ?? null;
  }
}

// construireLienPartage (F-34) : un lien vers le centre courant, qui ne
// porte QUE le nom de l'artiste — aucun identifiant d'utilisateur, aucun
// jeton de session (§09, "aucune source appelee directement depuis le
// poste" ; ici, surtout, aucune donnee personnelle dans une URL qui
// circule hors de l'application).
export function construireLienPartage(nomArtiste: string, origine: string): string {
  const url = new URL(origine);
  url.search = "";
  url.searchParams.set("graine", nomArtiste);
  return url.toString();
}

// extraireGraineDeLURL lit le parametre "graine" (ou l'alias historique
// "nom") d'une chaine de recherche deja decodee par URLSearchParams.
export function extraireGraineDeLURL(params: URLSearchParams): string | null {
  return params.get("graine") ?? params.get("nom");
}

// creerAmorceurUneFois (F-04) : un lien partage ou une entree de collection
// plante l'artiste UNE SEULE fois, jamais aux navigations internes
// suivantes. L'appelant construit l'amorceur une fois au demarrage et
// l'invoque a chaque tentative d'amorcage externe ; seule la premiere
// aboutit.
export function creerAmorceurUneFois(
  planter: (nom: string) => void,
): (nom: string) => void {
  let dejaAmorce = false;
  return (nom: string) => {
    if (dejaAmorce) return;
    dejaAmorce = true;
    planter(nom);
  };
}

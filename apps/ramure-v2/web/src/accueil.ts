// apps/ramure-v2/web/src/accueil.ts
//
// Etat A de l'ecran (PRD §07) : mur de pochettes plein ecran, tri au choix
// de l'utilisateur, memorise d'une session a l'autre. Porte F-05, F-06,
// F-07. Le nombre de colonnes suit la largeur PAR CSS (grid-template-
// columns responsive, web/index.html) : ce fichier ne calcule aucune
// disposition, il construit une seule structure DOM qui s'adapte — la
// parite stricte (PRP 08) interdit deux variantes du meme mur.
import { repliCouleur } from "./canevas";
import { textes } from "./textes";

export interface TuileDonnees {
  nom: string;
  illustration?: string;
}

// Trois ordres au minimum (F-06) : "recents" respecte l'ordre fourni par
// l'appelant (la collection, plus recent d'abord), "alphabetique" est
// stable et previsible, "aleatoire" est CONSOMME a chaque appel — donc
// relancable sans jamais rendre le meme tirage deux fois de suite.
export type OrdreMur = "recents" | "alphabetique" | "aleatoire";
export const ORDRES_MUR: readonly OrdreMur[] = ["recents", "alphabetique", "aleatoire"];

const CLE_ORDRE = "ramure:accueil:ordre";

function estOrdreMur(v: string | null): v is OrdreMur {
  return v === "recents" || v === "alphabetique" || v === "aleatoire";
}

// chargerOrdre / memoriserOrdre : F-06, "le choix survit au rechargement".
// Une valeur absente ou corrompue retombe sur "recents" plutot que de
// planter — un reglage perdu n'est jamais une erreur affichee.
export function chargerOrdre(stockage: Storage): OrdreMur {
  const valeur = stockage.getItem(CLE_ORDRE);
  return estOrdreMur(valeur) ? valeur : "recents";
}

export function memoriserOrdre(ordre: OrdreMur, stockage: Storage): void {
  stockage.setItem(CLE_ORDRE, ordre);
}

// trierTuiles est PURE : aucun acces DOM, aucun effet de bord. alea est
// injectable pour rendre le tirage aleatoire reproductible en test (comme
// internal/arbre/selection.go cote serveur, PRP 04).
export function trierTuiles(
  tuiles: readonly TuileDonnees[],
  ordre: OrdreMur,
  alea: () => number = Math.random,
): TuileDonnees[] {
  const copie = tuiles.slice();
  if (ordre === "alphabetique") {
    copie.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    return copie;
  }
  if (ordre === "aleatoire") {
    for (let i = copie.length - 1; i > 0; i--) {
      const j = Math.floor(alea() * (i + 1));
      const tmp = copie[i]!;
      copie[i] = copie[j]!;
      copie[j] = tmp;
    }
    return copie;
  }
  return copie; // "recents" : l'ordre fourni par l'appelant fait deja foi
}

export function mouvementReduit(fenetre: Window): boolean {
  return fenetre.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export interface OptionsMur {
  stockage: Storage;
  surPlanter: (nom: string) => void;
  alea?: () => number;
  fenetre?: Window;
}

export interface MurAccueil {
  readonly ordre: OrdreMur;
  definirOrdre(ordre: OrdreMur): void;
  detruire(): void;
}

// construireMur cree UNE tuile — et au plus une seule image — par artiste,
// une seule fois, a la construction. Changer d'ordre ne fait que DEPLACER
// les elements DOM deja existants (append reordonne, ne recree jamais) :
// c'est ce qui garantit qu'aucune illustration n'est rechargee au
// changement de tri (exigence testee par comptage de requetes).
export function construireMur(
  conteneur: HTMLElement,
  tuiles: readonly TuileDonnees[],
  options: OptionsMur,
): MurAccueil {
  const fenetre = options.fenetre ?? window;
  const alea = options.alea ?? Math.random;
  const reduit = mouvementReduit(fenetre);

  conteneur.replaceChildren();
  conteneur.classList.add("mur");
  conteneur.setAttribute("role", "list");

  const elements = new Map<TuileDonnees, HTMLElement>();
  for (const tuile of tuiles) {
    const item = document.createElement("div");
    item.setAttribute("role", "listitem");
    item.className = "mur-item";

    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "tuile";
    if (!reduit) bouton.classList.add("tuile-apparition");
    // Repli graphique STABLE (F-38) : la couleur derivee du nom tient la
    // place AVANT toute image, elimine toute tuile vide ou tout decalage
    // de mise en page a l'arrivee de l'illustration (F-05).
    bouton.style.backgroundColor = repliCouleur(tuile.nom);
    bouton.setAttribute("aria-label", textes.planterDepuisTuile(tuile.nom));

    if (tuile.illustration) {
      const image = document.createElement("img");
      image.src = tuile.illustration;
      image.alt = "";
      image.loading = "lazy";
      image.className = "tuile-image";
      bouton.append(image);
    }

    const libelle = document.createElement("span");
    libelle.className = "tuile-libelle";
    libelle.textContent = tuile.nom;
    bouton.append(libelle);

    bouton.addEventListener("click", () => options.surPlanter(tuile.nom));
    item.append(bouton);
    elements.set(tuile, item);
  }

  let ordreCourant = chargerOrdre(options.stockage);

  function peindre(ordre: OrdreMur): void {
    for (const tuile of trierTuiles(tuiles, ordre, alea)) {
      const el = elements.get(tuile);
      if (el) conteneur.append(el); // deplace l'element EXISTANT
    }
  }
  peindre(ordreCourant);

  return {
    get ordre() {
      return ordreCourant;
    },
    definirOrdre(nouveau: OrdreMur) {
      ordreCourant = nouveau;
      memoriserOrdre(nouveau, options.stockage);
      peindre(nouveau); // "aleatoire" relance un NOUVEAU tirage a chaque appel
    },
    detruire() {
      conteneur.replaceChildren();
      elements.clear();
    },
  };
}

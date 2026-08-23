// apps/ramure-v2/web/src/accueil.ts
//
// Etat A de l'ecran (PRD §07) : mur de pochettes plein ecran, tri au choix
// de l'utilisateur, memorise d'une session a l'autre. Porte F-05, F-06,
// F-07. Le nombre de colonnes suit la largeur PAR CSS (grid-template-
// columns responsive, web/index.html) : ce fichier ne calcule aucune
// disposition, il construit une seule structure DOM qui s'adapte — la
// parite stricte (PRP 08) interdit deux variantes du meme mur.
//
// PRODUCT.md §17 Q9 (decision du 23 aout 2026) : le mur n'affiche que ce
// qui tient dans la zone mesuree, jamais une rangee coupee par
// `overflow: hidden` sur `.mur` (invisible a l'oeil, mais restee
// tabulable et annoncee par un lecteur d'ecran). La capacite est LUE sur
// la grille que la CSS a calculee (colonnes, taille de tuile), jamais
// recalculee en parallele — capaciteMur et mesurerMur ci-dessous.
import { repliCouleur } from "./canevas";
import { textes } from "./textes";

export interface TuileDonnees {
  nom: string;
  illustration?: string;
}

// SourceMur (§17 Q10, PRODUCT.md, decision du 23 aout 2026) : ce que le
// mur montre en ce moment — les artistes deja gardes ("collection"), ou a
// defaut la selection editoriale d'amorcage ("amorcage", PRD §07 etat A).
// Seul "amorcage" est atteignable aujourd'hui : la collection ne nourrit
// pas encore le mur (F-28/F-30, main.ts AMORCAGE_EDITORIAL). Pose en
// PARAMETRE explicite plutot que deduit en silence d'une collection vide
// une fois cablee : sans quoi la branche "collection" resterait ecrite
// mais jamais executee ni testee — le sort deja subi par `accueilVide`
// (critique 2026-08-23 N4, "ecrit, jamais utilise nulle part").
export type SourceMur = "amorcage" | "collection";

// libelleAccueilIntertitre et libelleTriRecents (§17 Q10, constats N4 et
// N7) : le mur ne nommait ce qu'il montre nulle part, et le tri par defaut
// affirmait "Gardes recemment" au-dessus de six artistes que personne
// n'avait gardes — le seul mot qui qualifiait le mur le qualifiait faux,
// pour CHAQUE premier visiteur (N4).
//
// Les deux fonctions repondent a des questions DIFFERENTES et ne
// partagent PLUS leur formulation (N7) : libelleAccueilIntertitre dit CE
// QUE LE MUR MONTRE (la collection elle-meme, vraie quel que soit l'ordre
// choisi), libelleTriRecents dit DANS QUEL ORDRE (vrai seulement quand le
// tri actif est "recents"). Les confondre — reprendre `textes.triRecents`
// pour les deux, comme avant N7 — afficherait deux fois la meme chaine
// dans la meme bande de 36 px, et l'intertitre continuerait d'annoncer un
// classement par date de garde apres que le visiteur soit passe en
// alphabetique ou en aleatoire : exactement le libelle qui ment que N4
// venait de corriger, recree dans l'etat "collection".
export function libelleAccueilIntertitre(source: SourceMur): string {
  return source === "collection" ? textes.accueilIntertitreCollection : textes.accueilIntertitrePourCommencer;
}

export function libelleTriRecents(source: SourceMur): string {
  return source === "collection" ? textes.triRecents : textes.triSelectionEditoriale;
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

// MesureMur : ce que la CSS a decide, lu et jamais recalcule (§17 Q9). Le
// nombre de colonnes reste la decision de `.mur` (§07) ; ce fichier n'en
// deduit que combien de rangees entrent dans la hauteur disponible.
export interface MesureMur {
  colonnes: number;
  tailleTuile: number;
  gap: number;
  hauteurDisponible: number;
}

// capaciteMur est PURE (comme trierTuiles) : aucun acces DOM, testable
// sans jsdom ni navigateur.
//
// Garde-fous (§17 Q9) : une entree absente, non finie ou <= 0 (mesure
// ratee, conteneur pas encore attache) replie sur `total` — jamais 0
// tuile affichee, une geometrie illisible ne doit jamais faire
// disparaitre le mur. `Math.max(1, ...)` est deliberee : une fenetre trop
// courte pour une seule rangee montre quand meme cette rangee (l'option
// ecartee au §17 Q9 est de retrecir la tuile sous le plancher de 9rem,
// jamais de montrer zero rangee).
export function capaciteMur(mesure: MesureMur, total: number): number {
  const { colonnes, tailleTuile, hauteurDisponible } = mesure;
  const gap = Number.isFinite(mesure.gap) && mesure.gap >= 0 ? mesure.gap : 0;
  if (
    !Number.isFinite(colonnes) ||
    colonnes <= 0 ||
    !Number.isFinite(tailleTuile) ||
    tailleTuile <= 0 ||
    !Number.isFinite(hauteurDisponible) ||
    hauteurDisponible <= 0
  ) {
    return total;
  }
  const rangees = Math.max(1, Math.floor((hauteurDisponible + gap) / (tailleTuile + gap)));
  return Math.min(total, colonnes * rangees);
}

// mesurerMur LIT la grille que `.mur` a calculee — jamais un calcul
// parallele de la largeur de colonne (§07, §17 Q9). Le carre de `.tuile`
// (aspect-ratio: 1) fait que la largeur de la premiere colonne EST la
// hauteur de tuile ; `rowGap` est l'espacement entre rangees, pas entre
// colonnes, c'est deliberement celui-la qu'on lit pour empiler des
// rangees. En dehors d'un navigateur (jsdom, conteneur non attache),
// `getComputedStyle` ne resout pas la grille : colonnes/tailleTuile
// valent alors NaN et capaciteMur replie sur `total`.
export function mesurerMur(conteneur: HTMLElement): MesureMur {
  const style = getComputedStyle(conteneur);
  const pistes = style.gridTemplateColumns.split(/\s+/).filter(Boolean);
  const colonnes = pistes.length;
  const tailleTuile = parseFloat(pistes[0] ?? "");
  const gap = parseFloat(style.rowGap || style.gap || "");
  const paddingTop = parseFloat(style.paddingTop || "0");
  const paddingBottom = parseFloat(style.paddingBottom || "0");
  const hauteurDisponible = conteneur.clientHeight - paddingTop - paddingBottom;
  return { colonnes, tailleTuile, gap, hauteurDisponible };
}

export interface OptionsMur {
  stockage: Storage;
  surPlanter: (nom: string) => void;
  alea?: () => number;
  fenetre?: Window;
  // Injectable en test (comme `alea` et `fenetre`) : mesure la geometrie
  // du mur sans dependre d'un vrai calcul de layout (§17 Q9).
  mesurer?: (conteneur: HTMLElement) => MesureMur;
}

export interface MurAccueil {
  readonly ordre: OrdreMur;
  definirOrdre(ordre: OrdreMur): void;
  // replafonner (§17 Q11, PRODUCT.md, decision du 23 aout 2026) : reevalue
  // le plafond SEUL, SANS retrier ni reconstruire -- exactement l'appel
  // deja fait par `surRedimensionnement` a chaque `resize` (§17 Q9), expose
  // ici pour que main.ts le rappelle a l'apparition ET a la disparition de
  // la bande d'echec (§17 Q6/Q11). La hauteur disponible pour `.mur` change
  // quand la bande pousse #accueil (index.html, regle `main:has(...)`)
  // exactement comme au redimensionnement -- sans cet appel, la derniere
  // rangee resterait rognee tant que la bande est la, ce que §17 Q9
  // interdit.
  replafonner(): void;
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
  const mesurer = options.mesurer ?? mesurerMur;
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

  // peindre : le tri d'abord, le plafond ensuite (§17 Q9) — le plafond ne
  // fait que couper la QUEUE de la liste deja triee, c'est donc l'ordre
  // qui decide qui reste visible. `hidden` sur `.mur-item` (jamais
  // `display:none` pose ici sur `.tuile` seule) retire la tuile au-dela
  // de la capacite du flux, de la tabulation ET de l'arbre
  // d'accessibilite d'un seul coup (regle globale `[hidden]`,
  // web/index.html).
  //
  // DEUX passes, jamais une seule. `auto-fit` collapse a zero-largeur
  // toute colonne sans element place dedans (verifie empiriquement) :
  // mesurer AVANT d'avoir appose la moindre tuile lirait un conteneur
  // vide, donc une taille de tuile nulle, donc un repli permanent sur
  // "aucun plafond" — y compris au tout premier rendu, exactement le
  // defaut que cette fonctionnalite corrige. La 1re passe rend TOUT
  // visible pour que la grille se stabilise a la taille qu'aura sa
  // premiere rangee une fois pleine ; la 2e lit cette geometrie et masque
  // la queue.
  // `derniereListe` retient l'ordre REELLEMENT affiche. Le plafond se
  // recalcule a chaque redimensionnement ; l'ordre, lui, ne se rejoue qu'a
  // un geste explicite (construction, changement de tri). Critique
  // 2026-08-23 (second passage), N1 : sans cette separation,
  // `surRedimensionnement` rappelait `peindre`, donc `trierTuiles`, donc —
  // en tri "aleatoire", qui CONSOMME un tirage a chaque appel — un mur
  // rebattu a chaque evenement `resize`. Or le PRD (§02) fait du rebattage
  // « une action explicite » ; etirer une fenetre, faire pivoter un
  // telephone ou voir la barre d'URL se retracter n'en sont pas, et a
  // capacite reduite le tirage change non pas l'ordre mais QUI est montre.
  // Initialisee vide, jamais par un tri : `peindre` ci-dessous la
  // renseigne au premier rendu, et un tirage de plus ici en consommerait
  // un pour rien.
  let derniereListe: readonly TuileDonnees[] = [];

  // replafonner : le plafond seul (§17 Q9), sans jamais toucher a l'ordre
  // du DOM. Ne PAS re-`append` ici est ce qui repare le second defaut du
  // meme constat : `append` sur un enfant deja place le retire et le
  // reinsere, ce qui RELANCE l'animation `apparition` (.25s, opacite 0 →
  // 1) sur chaque tuile. Un `resize` etant emis en continu pendant un
  // etirement de fenetre, les six tuiles restaient bloquees pres de
  // l'opacite 0 tant que durait le geste (mesure : `currentTime` remis a 0
  // a chaque evenement).
  //
  // DEUX passes, jamais une seule. `auto-fit` collapse a zero-largeur
  // toute colonne sans element place dedans (verifie empiriquement) :
  // mesurer AVANT d'avoir demasque la moindre tuile lirait un conteneur
  // vide, donc une taille de tuile nulle, donc un repli permanent sur
  // "aucun plafond" — y compris au tout premier rendu, exactement le
  // defaut que cette fonctionnalite corrige. La 1re passe rend TOUT
  // visible pour que la grille se stabilise a la taille qu'aura sa
  // premiere rangee une fois pleine ; la 2e lit cette geometrie et masque
  // la queue.
  function replafonner(): void {
    derniereListe.forEach((tuile) => {
      const el = elements.get(tuile);
      if (el) el.hidden = false;
    });
    const capacite = capaciteMur(mesurer(conteneur), derniereListe.length);
    derniereListe.forEach((tuile, index) => {
      const el = elements.get(tuile);
      if (el) el.hidden = index >= capacite;
    });
  }

  // peindre : le tri d'abord, le plafond ensuite (§17 Q9) — le plafond ne
  // fait que couper la QUEUE de la liste deja triee, c'est donc l'ordre
  // qui decide qui reste visible. `hidden` sur `.mur-item` (jamais
  // `display:none` pose ici sur `.tuile` seule) retire la tuile au-dela
  // de la capacite du flux, de la tabulation ET de l'arbre
  // d'accessibilite d'un seul coup (regle globale `[hidden]`,
  // web/index.html).
  function peindre(ordre: OrdreMur): void {
    derniereListe = trierTuiles(tuiles, ordre, alea);
    derniereListe.forEach((tuile) => {
      const el = elements.get(tuile);
      if (!el) return;
      conteneur.append(el); // deplace l'element EXISTANT
      el.hidden = false;
    });
    replafonner();
  }
  peindre(ordreCourant);

  // Reevalue au redimensionnement (§17 Q9) : sans quoi le plafond calcule
  // sur un ecran large survivrait au passage a un ecran etroit. Le
  // plafond SEUL — voir `replafonner`. Retire a detruire() — appele a
  // chaque retour a l'accueil (main.ts) — sinon chaque construction du mur
  // laisse un ecouteur de plus derriere elle.
  function surRedimensionnement(): void {
    replafonner();
  }
  fenetre.addEventListener("resize", surRedimensionnement);

  return {
    get ordre() {
      return ordreCourant;
    },
    definirOrdre(nouveau: OrdreMur) {
      ordreCourant = nouveau;
      memoriserOrdre(nouveau, options.stockage);
      peindre(nouveau); // "aleatoire" relance un NOUVEAU tirage a chaque appel
    },
    replafonner,
    detruire() {
      fenetre.removeEventListener("resize", surRedimensionnement);
      conteneur.replaceChildren();
      elements.clear();
    },
  };
}

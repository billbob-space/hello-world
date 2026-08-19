// apps/ramure-v2/web/src/promotion.ts
//
// Le geste fondamental du produit (PRD §05, PRP 05 tache 5) : "le reste de
// l'interface peut etre mediocre sans que le produit disparaisse ; celui-ci,
// non." Porte F-11 a F-14 et la section "transition de promotion" de §11.
//
// Deux responsabilites separees, deux familles de tests :
//   - GestionnaireLignee / promouvoir : lignee, generations, reponses
//     tardives (§09) — pur, sans DOM, teste sur des promesses controlees.
//   - appliquerTransitionVisuelle : le mouvement lui-meme — DOM, teste avec
//     jsdom via les elements produits par canevas.ts.
// "La scene n'est jamais reconstruite" (F-12) : aucune des deux fonctions
// de ce fichier ne cree ni ne detruit un noeud. Elles deplacent et
// atténuent des elements EXISTANTS.
import type { NoeudDessine } from "./canevas";

// ---------------------------------------------------------------------
// Lignee et generations (F-13, F-14, §09)
// ---------------------------------------------------------------------

/** Resultat d'une navigation immediate dans la lignee (retour, saut). */
export interface Navigation {
  idCentre: string;
  generation: number;
}

// GestionnaireLignee retient le centre courant, ses ancetres (la lignee,
// F-14) et un compteur de generation qui protege des reponses tardives
// (§09) : toute promotion ou navigation bat une nouvelle generation, et
// une reponse portant une generation perimee doit etre ecartee, jamais
// appliquee au centre courant.
export class GestionnaireLignee {
  #generation = 0;
  #lignee: string[] = [];
  #centreId: string | null = null;

  get generation(): number {
    return this.#generation;
  }

  get lignee(): readonly string[] {
    return this.#lignee;
  }

  get centre(): string | null {
    return this.#centreId;
  }

  // commencerPromotion enregistre IMMEDIATEMENT le nouveau centre demande —
  // c'est ce qui fait que deux promotions enchainees a 50 ms d'intervalle
  // aboutissent au SECOND artiste demande (F-13), jamais au premier, sans
  // attendre qu'un reseau reponde. Rend le numero de generation que
  // l'appelant doit reverifier (estPerimee) avant d'appliquer une reponse
  // asynchrone.
  commencerPromotion(idCentre: string): number {
    this.#generation += 1;
    if (this.#centreId !== null) {
      this.#lignee = [...this.#lignee, this.#centreId];
    }
    this.#centreId = idCentre;
    return this.#generation;
  }

  // estPerimee dit si `generation` a ete depassee par une promotion ou une
  // navigation plus recente.
  estPerimee(generation: number): boolean {
    return generation !== this.#generation;
  }

  // naviguerVersAncetre (F-14) remonte directement a l'ancetre d'index
  // `index` de la lignee (0 = le plus ancien). C'est une nouvelle
  // generation a part entiere : toute promotion encore en vol devient
  // perimee, meme si elle resout ensuite (F-13, "naviguer dans la lignee
  // pendant une transition en cours mene a la destination demandee").
  naviguerVersAncetre(index: number): Navigation {
    const cible = this.#lignee[index];
    if (cible === undefined) {
      throw new RangeError(`GestionnaireLignee: aucun ancetre a l'index ${index}`);
    }
    this.#generation += 1;
    this.#lignee = this.#lignee.slice(0, index);
    this.#centreId = cible;
    return { idCentre: cible, generation: this.#generation };
  }
}

export interface ResultatPromotion<T> {
  applique: boolean;
  generation: number;
  donnees?: T;
}

export interface OptionsPromouvoir<T> {
  chargerCentre: (nom: string) => Promise<T>;
  mouvementReduit: boolean;
}

// promouvoir engage une promotion : le centre change de nom IMMEDIATEMENT
// dans le gestionnaire (F-13), puis attend les donnees completes. Si une
// promotion ou une navigation plus recente a eu lieu entre-temps, le
// resultat est ecarte (applique=false) — la reponse tardive n'est jamais
// appliquee au centre courant (§09).
export async function promouvoir<T>(
  lignee: GestionnaireLignee,
  noeud: { id: string; nom: string },
  options: OptionsPromouvoir<T>,
): Promise<ResultatPromotion<T>> {
  const generation = lignee.commencerPromotion(noeud.id);
  const donnees = await options.chargerCentre(noeud.nom);
  if (lignee.estPerimee(generation)) {
    return { applique: false, generation };
  }
  return { applique: true, generation, donnees };
}

// ---------------------------------------------------------------------
// Transition visuelle (§11, F-12)
// ---------------------------------------------------------------------

export interface CibleCentre {
  x: number;
  y: number;
  r: number;
}

export interface OptionsTransitionVisuelle {
  dureeMs: number;
}

// dureePromotion neutralise l'animation sous mouvement reduit — elle ne
// l'accelere pas, elle la supprime (§11 "Preference de mouvement reduit") :
// c'est la difference entre "plus rapide" et "immediat, sans delai
// residuel".
const DUREE_PROMOTION_MS = 260;

export function dureePromotion(mouvementReduit: boolean): number {
  return mouvementReduit ? 0 : DUREE_PROMOTION_MS;
}

// appliquerTransitionVisuelle deplace le noeud CHOISI vers la position et
// la taille du centre, et efface l'ancien centre SUR PLACE :
//   - le noeud choisi n'est JAMAIS recree (F-12) : seuls cx/cy/r de son
//     cercle existant changent, jamais son identite DOM ni son motif
//     d'illustration (deja charge — §11, "le nouveau centre est illustre
//     des sa premiere apparition"), qui n'est jamais touche ici. Le href
//     de l'image ne repasse donc jamais par une valeur vide.
//   - l'ancien centre ne voit JAMAIS ses coordonnees changer : seule son
//     opacite varie ("la generation precedente s'efface sur place").
// Rend une promesse resolue a la fin de la transition ; resolue au meme
// tour de boucle quand dureeMs vaut 0 (mouvement reduit).
export function appliquerTransitionVisuelle(
  choisi: NoeudDessine,
  ancienCentre: NoeudDessine | null,
  cible: CibleCentre,
  options: OptionsTransitionVisuelle,
): Promise<void> {
  const duree = Math.max(0, options.dureeMs);
  const transitionOpacite = duree > 0 ? `opacity ${duree}ms ease` : "";
  const transitionGeometrie =
    duree > 0 ? `cx ${duree}ms ease, cy ${duree}ms ease, r ${duree}ms ease` : "";

  if (ancienCentre) {
    ancienCentre.groupe.style.transition = transitionOpacite;
    ancienCentre.groupe.style.opacity = "0";
  }

  choisi.cercle.style.transition = transitionGeometrie;
  choisi.cercle.setAttribute("cx", String(cible.x));
  choisi.cercle.setAttribute("cy", String(cible.y));
  choisi.cercle.setAttribute("r", String(cible.r));
  // Le motif de repli/illustration (pattern) suit le cercle qu'il remplit :
  // ses dimensions et sa position doivent rester en phase avec cx/cy/r
  // pour que l'image continue d'occuper exactement la pastille.
  choisi.pattern.setAttribute("x", String(cible.x - cible.r));
  choisi.pattern.setAttribute("y", String(cible.y - cible.r));
  choisi.pattern.setAttribute("width", String(2 * cible.r));
  choisi.pattern.setAttribute("height", String(2 * cible.r));
  const image = choisi.pattern.querySelector("image");
  if (image) {
    image.setAttribute("width", String(2 * cible.r));
    image.setAttribute("height", String(2 * cible.r));
  }

  if (duree === 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, duree));
}

// ---------------------------------------------------------------------
// Camera (§11 : "la vue ne se recadre que si l'utilisateur l'avait
// modifiee")
// ---------------------------------------------------------------------

// recadrerSiBouge appelle `appliquer` (typiquement : revenir au cadrage
// neutre) SEULEMENT si `aBouge` est vrai. Une camera qui bouge sans raison
// donne le vertige (§11) : si l'utilisateur n'avait rien modifie, la vue
// est deja centree sur ce qui devient le nouveau centre, et il n'y a rien
// a corriger.
export function recadrerSiBouge(aBouge: boolean, appliquer: () => void): void {
  if (aBouge) {
    appliquer();
  }
}

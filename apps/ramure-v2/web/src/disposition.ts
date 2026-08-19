// apps/ramure-v2/web/src/disposition.ts
//
// Parite stricte, tranchee (PRP 08) : etroit et large sont un SEUL DOM, la
// CSS d'index.html repositionne, jamais une seconde instance d'un
// controle. Ce fichier est le SEUL endroit qui decide, cote client, dans
// quelle disposition on se trouve — decision qui doit rester IDENTIQUE au
// point de rupture CSS `@media (min-width: 60rem)` d'index.html : les
// deux DOIVENT s'accorder, sinon le client demande au serveur un cadrage
// (nombre de branches/heritiers, internal/api/centre.go) qui ne correspond
// pas a la disposition qu'il affiche reellement.
//
// Le SERVEUR choisit toujours le nombre de branches (cadragePour,
// internal/api/centre.go) : ce fichier ne fait que lui transmettre le mot
// "large" ou "etroit" via le parametre `largeur` de GET /api/centre —
// jamais de logique de comptage ici, une seconde source de verite
// divergerait sans bruit (meme regle que cote serveur).

/** 60rem, la valeur du point de rupture CSS d'index.html. 1rem = 16px tant
 * qu'aucune regle ne redefinit la taille de police racine (aucune ici). */
export const SEUIL_LARGE_PX = 960;

export type Disposition = "large" | "etroit";

/** dispositionPour est PURE : aucun acces a `window`, testable sans DOM. */
export function dispositionPour(largeurPx: number): Disposition {
  return largeurPx >= SEUIL_LARGE_PX ? "large" : "etroit";
}

/** dispositionCourante lit `window.innerWidth` — seul point d'entree
 * impur de ce fichier, injectable pour les tests. */
export function dispositionCourante(fenetre: Pick<Window, "innerWidth"> = window): Disposition {
  return dispositionPour(fenetre.innerWidth);
}

/** Taille minimale d'une cible tactile ou de clic, WCAG 2.2 SC 2.5.8 (AA) :
 * 24x24px CSS, sans exception sur l'ecran principal (§12). Partagee par
 * canevas.ts (noeuds) et par les tests qui verifient les boutons de la
 * camera. */
export const CIBLE_TACTILE_MIN_PX = 24;

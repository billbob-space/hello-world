// apps/ramure-v2/web/src/echec.ts
//
// Echec de plantation (PRODUCT.md §17 Q6, decision du 22 aout 2026) :
// "Que voit-on quand une graine ne donne rien ?" Variante retenue C -- une
// bande pleine largeur sous la barre de recherche, l'arbre precedent
// conserve derriere elle, estompe. Jusqu'ici, l'application affichait un
// artiste FANTOME (critique 2026-08-22 C15) : un disque au centre portant
// le nom mal orthographie saisi par le visiteur, dementi seulement par une
// ligne de gris a l'autre bout de l'ecran -- un faux resultat plutot
// qu'une information d'echec.
//
// Module PURE + DOM testable a la jsdom (meme logique que promotion.ts,
// canevas.ts) : main.ts, lui, n'est pas teste unitairement (voir sa propre
// doc) -- tout ce qui peut vivre ici, hors cablage d'evenements, y vit.
import type { CentreAPI } from "./passerelle";
import { textes } from "./textes";

// estEchecDePlantation distingue un centre REELLEMENT resolu (un mbid
// MusicBrainz, meme sans voisin calcule -- EtatAucunVoisin AVEC mbid,
// "aucun voisin connu pour CET artiste", un resultat legitime, F-36) d'un
// centre qui n'a RIEN resolu : ni panne serveur (centrePanne,
// internal/arbre/centre.go, jamais de mbid) ni nom introuvable
// (centreVide, jamais de mbid non plus). C'est ce dernier cas, et lui
// seul, qui affichait l'artiste fantome.
export function estEchecDePlantation(centreAPI: Pick<CentreAPI, "etat" | "artiste">): boolean {
  return centreAPI.etat !== "ok" && !centreAPI.artiste.mbid;
}

// texteEchecPlantation compose le message de la bande : ce qui s'est passe
// (le message du serveur, internal/arbre/centre.go) ET ce qu'on peut faire
// -- jamais un simple constat. La suggestion "verifie l'orthographe" n'a de
// sens QUE pour un nom introuvable (aucun_voisin) ; une panne serveur porte
// deja sa propre invite ("reessayez dans un instant", centre.go), que le
// client n'a pas a completer ni a corriger.
export function texteEchecPlantation(centreAPI: Pick<CentreAPI, "etat" | "message">): string {
  const messageServeur = centreAPI.message || textes.echecPlantationGenerique;
  return centreAPI.etat === "aucun_voisin" ? textes.echecPlantation(messageServeur) : messageServeur;
}

export interface ElementsEchec {
  bande: HTMLElement | null;
  // Element, pas HTMLElement : `arbre` est #canevas, un SVGSVGElement
  // (main.ts) -- seul `classList` (porte par Element) est necessaire ici.
  arbre: Element | null;
}

// afficherEchecPlantation pose le message et estompe l'arbre precedent --
// SI il en existe un (`arbreExistant`). Sur un premier echec depuis
// l'accueil, aucun arbre n'a encore ete dessine : la bande s'affiche
// seule (§17 Q6, "cas a traiter, pas un oubli"), rien a estomper. Le
// role="alert" pose dans index.html (aria-live="assertive" implicite) fait
// l'annonce a une technologie d'assistance des l'apparition -- rien d'autre
// ne signale ce changement d'etat.
export function afficherEchecPlantation(elements: ElementsEchec, message: string, arbreExistant: boolean): void {
  const { bande, arbre } = elements;
  if (bande) {
    bande.textContent = message;
    bande.hidden = false;
  }
  if (arbre && arbreExistant) arbre.classList.add("estompe");
}

// masquerEchecPlantation leve la bande -- jamais toute seule (ce n'est pas
// une alerte qui s'auto-efface) : uniquement sur une plantation reussie
// (reconstruireScene) ou un retour a l'accueil (le visiteur "repart",
// boutonLogo), tous deux dans main.ts.
export function masquerEchecPlantation(elements: ElementsEchec): void {
  const { bande, arbre } = elements;
  if (bande) {
    bande.hidden = true;
    bande.textContent = "";
  }
  arbre?.classList.remove("estompe");
}

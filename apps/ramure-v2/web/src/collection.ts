// apps/ramure-v2/web/src/collection.ts
//
// La collection cote client (PRP 07, tache 3) : garder un artiste, la
// montrer avec la lignee qui y a mene (F-30), replanter d'un clic (F-31),
// et le miroir hors ligne qui la rend utilisable sans reseau (F-33).
// Cablee contre GET/PUT/DELETE /api/collection (internal/api/collection.go)
// par main.ts.
import { textes } from "./textes";

// Forme JSON de internal/collection.Entree : une seule convention
// d'etiquetage — camelCase minuscule — comme partout ailleurs dans
// l'application.
export interface EntreeAPI {
  nom: string;
  mbid: string;
  lignee?: string[];
  ajoute: string; // RFC3339, pose par le serveur
}

// ---------------------------------------------------------------------
// Miroir hors ligne (F-33) — PUR, sans reseau ni DOM : teste directement.
// ---------------------------------------------------------------------

interface MiroirDonnees {
  /** Entrees ajoutees localement, pas encore confirmees par le serveur. */
  ajouts: EntreeAPI[];
  /** MBID retires localement, pas encore confirmes par le serveur. */
  retraits: string[];
}

const CLE_STOCKAGE = "ramure:collection:miroir";

function miroirVide(): MiroirDonnees {
  return { ajouts: [], retraits: [] };
}

function lireMiroir(stockage: Storage): MiroirDonnees {
  try {
    const brut = stockage.getItem(CLE_STOCKAGE);
    if (!brut) return miroirVide();
    const donnees = JSON.parse(brut) as Partial<MiroirDonnees>;
    return { ajouts: donnees.ajouts ?? [], retraits: donnees.retraits ?? [] };
  } catch {
    return miroirVide(); // stockage corrompu ou indisponible : repart a vide, jamais un plantage
  }
}

function ecrireMiroir(stockage: Storage, donnees: MiroirDonnees): void {
  try {
    stockage.setItem(CLE_STOCKAGE, JSON.stringify(donnees));
  } catch {
    // Stockage plein ou indisponible (navigation privee) : le miroir hors
    // ligne se degrade, l'application non — jamais l'inverse.
  }
}

// MiroirHorsLigne porte les changements pas encore confirmes par le
// serveur : REGLE qui tient les trois tests de reconciliation — le
// serveur est la reference, mais la reconciliation ne supprime JAMAIS
// cote serveur une entree que le client ignore simplement. vue() ne fait
// donc jamais table rase de `serveur` : elle le complete (ajouts en
// attente) et le filtre (retraits en attente), sans jamais rien
// supprimer que le client n'ait pas explicitement demande.
export class MiroirHorsLigne {
  #stockage: Storage;
  #donnees: MiroirDonnees;

  constructor(stockage: Storage) {
    this.#stockage = stockage;
    this.#donnees = lireMiroir(stockage);
  }

  get ajoutsEnAttente(): readonly EntreeAPI[] {
    return this.#donnees.ajouts;
  }

  get retraitsEnAttente(): readonly string[] {
    return this.#donnees.retraits;
  }

  /** Enregistre un ajout local (hors ligne, ou en attente de confirmation
   * serveur). Annule un retrait en attente du meme artiste : le dernier
   * geste local fait foi. */
  ajouter(e: EntreeAPI): void {
    this.#donnees.retraits = this.#donnees.retraits.filter((m) => m !== e.mbid);
    if (!this.#donnees.ajouts.some((a) => a.mbid === e.mbid)) {
      this.#donnees.ajouts = [...this.#donnees.ajouts, e];
    }
    ecrireMiroir(this.#stockage, this.#donnees);
  }

  /** Enregistre un retrait local. Annule un ajout en attente du meme
   * artiste. */
  retirer(mbid: string): void {
    this.#donnees.ajouts = this.#donnees.ajouts.filter((a) => a.mbid !== mbid);
    if (!this.#donnees.retraits.includes(mbid)) {
      this.#donnees.retraits = [...this.#donnees.retraits, mbid];
    }
    ecrireMiroir(this.#stockage, this.#donnees);
  }

  // vue() fusionne la DERNIERE collection SERVEUR connue avec les
  // changements locaux non confirmes : c'est ce qui rend la collection
  // utilisable sans reseau (F-33), et ce qui tient les trois tests :
  //   - "un ajout hors ligne remonte a la reconnexion" : ajoutsEnAttente
  //     apparait meme si `serveur` ne le porte pas encore ;
  //   - "un retrait hors ligne ne ressuscite pas a la reconnexion" :
  //     retraitsEnAttente filtre `serveur`, meme si le serveur le porte
  //     encore ;
  //   - "une entree presente des deux cotes ne produit pas de doublon" :
  //     un ajout en attente deja present cote serveur (l'appareil A l'a
  //     confirme pendant que l'appareil B etait hors ligne) n'est ajoute
  //     qu'une fois.
  vue(serveur: readonly EntreeAPI[]): EntreeAPI[] {
    const retires = new Set(this.#donnees.retraits);
    const base = serveur.filter((e) => !retires.has(e.mbid));
    const mbidsBase = new Set(base.map((e) => e.mbid));
    const ajoutsRestants = this.#donnees.ajouts.filter((a) => !mbidsBase.has(a.mbid));
    return [...base, ...ajoutsRestants];
  }

  // confirmer() efface les changements locaux desormais reconnus par le
  // serveur, apres une synchronisation reussie — un ajout confirme
  // (present cote serveur) sort de la file d'attente ; un retrait n'est
  // efface QUE si le serveur ne porte plus l'artiste (la suppression a
  // ete appliquee). Un changement encore inconnu du serveur reste en
  // attente : rien n'est perdu si la synchronisation a echoue en cours de
  // route.
  confirmer(serveur: readonly EntreeAPI[]): void {
    const mbidsServeur = new Set(serveur.map((e) => e.mbid));
    this.#donnees.ajouts = this.#donnees.ajouts.filter((a) => !mbidsServeur.has(a.mbid));
    this.#donnees.retraits = this.#donnees.retraits.filter((m) => mbidsServeur.has(m));
    ecrireMiroir(this.#stockage, this.#donnees);
  }
}

// ---------------------------------------------------------------------
// Construction DOM (F-30 : la lignee et la date, pas seulement le nom)
// ---------------------------------------------------------------------

export interface OptionsCollection {
  entrees: readonly EntreeAPI[];
  /** F-31 : ferme le panneau et recentre l'arbre sur l'artiste choisi,
   * sans passer par l'accueil. */
  surReplanter: (entree: EntreeAPI) => void;
  /** F-28 : retire immediatement l'artiste de la collection affichee. */
  surRetirer: (mbid: string) => void;
}

export interface PanneauCollection {
  actualiser(entrees: readonly EntreeAPI[]): void;
}

function formaterDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR");
}

// construireCollection peint la collection : chaque ligne montre le nom,
// la LIGNEE complete de decouverte (F-30) et la date (F-29 relue, F-30
// affichee) — jamais seulement le nom. Un clic sur la ligne replante
// (F-31) ; un bouton distinct retire (F-28), sans replanter par erreur.
export function construireCollection(
  conteneur: HTMLElement,
  options: OptionsCollection,
): PanneauCollection {
  conteneur.classList.add("collection");
  conteneur.setAttribute("role", "region");
  conteneur.setAttribute("aria-label", textes.collectionTitre);

  const liste = document.createElement("ul");
  liste.className = "collection-liste";
  conteneur.replaceChildren(liste);

  function peindre(entrees: readonly EntreeAPI[]): void {
    liste.replaceChildren();
    if (entrees.length === 0) {
      const vide = document.createElement("p");
      vide.className = "collection-vide";
      vide.textContent = textes.collectionVide;
      liste.append(vide);
      return;
    }

    for (const entree of entrees) {
      const item = document.createElement("li");
      item.className = "collection-item";
      item.dataset.mbid = entree.mbid;

      const bouton = document.createElement("button");
      bouton.type = "button";
      bouton.className = "collection-replanter";
      bouton.setAttribute("aria-label", textes.replanterDepuisLaCollection(entree.nom));

      const nom = document.createElement("span");
      nom.className = "collection-nom";
      nom.textContent = entree.nom;
      bouton.append(nom);

      if (entree.lignee && entree.lignee.length > 0) {
        const lignee = document.createElement("span");
        lignee.className = "collection-lignee";
        lignee.textContent = textes.ligneeDeDecouverte(entree.lignee);
        bouton.append(lignee);
      }

      const date = document.createElement("span");
      date.className = "collection-date";
      date.textContent = textes.gardeLe(formaterDate(entree.ajoute));
      bouton.append(date);

      bouton.addEventListener("click", () => options.surReplanter(entree));
      item.append(bouton);

      const retirer = document.createElement("button");
      retirer.type = "button";
      retirer.className = "collection-retirer";
      retirer.setAttribute("aria-label", textes.retirerDeLaCollection(entree.nom));
      retirer.textContent = "×";
      retirer.addEventListener("click", (evenement) => {
        evenement.stopPropagation(); // ne declenche jamais le replantage du bouton parent
        options.surRetirer(entree.mbid);
      });
      item.append(retirer);

      liste.append(item);
    }
  }

  peindre(options.entrees);

  return {
    actualiser(entrees: readonly EntreeAPI[]) {
      peindre(entrees);
    },
  };
}

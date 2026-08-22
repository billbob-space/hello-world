// apps/ramure-v2/web/src/fiche.ts
//
// La fiche du centre : profil, discographie classee et filtrable, lecteur
// d'extraits, choix du service d'ecoute (PRP 06, tache 3 : F-19, F-21,
// F-22, F-24, F-25, F-40). Alimentee par GET /api/fiche (internal/api/
// fiche.go), jamais au chargement de l'arbre (§07 "ce que la fiche coute,
// et quand").
import { textes } from "./textes";

export interface ProfilAPI {
  presentation: string;
  genres: string[];
  auditeurs: number;
}

export interface AlbumAPI {
  mbid: string;
  titre: string;
  sortie: string;
  type: string;
  note: number;
  votes: number;
}

export interface ExtraitAPI {
  titre: string;
  url: string;
  duree: number;
}

// ---------------------------------------------------------------------
// Discographie et filtre par type (F-20, F-21, F-22)
// ---------------------------------------------------------------------

/** Types distincts REELLEMENT presents dans la discographie donnee. */
export function typesPresents(albums: readonly AlbumAPI[]): string[] {
  return [...new Set(albums.map((a) => a.type))];
}

/** "tous" rend la discographie complete, dans son ordre d'arrivee — deja
 * classee par appreciation cote serveur (MusicBrainz.Discographie). */
export function filtrerParType(albums: readonly AlbumAPI[], type: string): AlbumAPI[] {
  if (type === "tous") return albums.slice();
  return albums.filter((a) => a.type === type);
}

// peindreDiscographie (F-21) : la discographie arrive DEJA classee en un
// seul appel (MusicBrainz repond notes et albums ensemble, PRP 03) — il
// n'y a donc jamais de reclassement en deux temps a orchestrer ici. Ce que
// cette fonction garantit, c'est l'IDEMPOTENCE : repeindre les memes
// donnees ne recree jamais les lignes ni ne rejoue une seconde fois la
// marque d'arrivee ("discographie-classee"), pour qu'un appel accidentel
// pendant un chargement en cours ne produise jamais de reordonnancement
// intermediaire perceptible.
export function peindreDiscographie(
  conteneur: HTMLElement,
  albums: readonly AlbumAPI[],
  filtre: string,
): void {
  const visibles = filtrerParType(albums, filtre);
  const cleVisible = visibles.map((a) => a.mbid).join(",");
  if (conteneur.dataset.discographieCle === cleVisible) {
    return; // memes donnees, meme filtre : rien a repeindre (idempotence)
  }
  conteneur.dataset.discographieCle = cleVisible;

  conteneur.replaceChildren();
  for (const album of visibles) {
    const ligne = document.createElement("div");
    ligne.className = "discographie-album discographie-classee";
    ligne.dataset.type = album.type;
    ligne.dataset.mbid = album.mbid;

    const titre = document.createElement("span");
    titre.className = "discographie-titre";
    titre.textContent = album.titre;

    const annee = document.createElement("span");
    annee.className = "discographie-annee";
    annee.textContent = album.sortie.slice(0, 4);

    ligne.append(titre, annee);
    if (album.votes > 0) {
      const note = document.createElement("span");
      note.className = "discographie-note";
      note.textContent = album.note.toFixed(1);
      ligne.append(note);
    }

    // Lien d'ecoute (F-25, F-26) : cree ici avec un href provisoire, mis a
    // jour par mettreAJourLiens des la construction et a chaque changement
    // de service — c'est ce qui garantit qu'AUCUN album n'est oublie.
    const lien = document.createElement("a");
    lien.className = "discographie-lien";
    lien.target = "_blank";
    lien.rel = "noopener noreferrer";
    ligne.append(lien);

    conteneur.append(ligne);
  }
}

// mettreAJourLiens (F-25) recalcule le href de CHAQUE album affiche pour
// le service donne — appelee a la construction de la fiche ET a chaque
// changement de service (GestionnaireService.observer), independamment de
// l'idempotence de peindreDiscographie : changer de service ne doit
// JAMAIS etre bloque par le garde-fou anti-reclassement de F-21.
export function mettreAJourLiens(
  conteneur: HTMLElement,
  albums: readonly AlbumAPI[],
  artiste: string,
  service: Service,
): void {
  const parMbid = new Map(albums.map((a) => [a.mbid, a]));
  conteneur.querySelectorAll<HTMLElement>(".discographie-album").forEach((ligne) => {
    const album = parMbid.get(ligne.dataset.mbid ?? "");
    const lien = ligne.querySelector<HTMLAnchorElement>(".discographie-lien");
    if (!album || !lien) return;
    lien.href = lienEcoute(service, artiste, album.titre);
    lien.textContent = textes.ecouterSur(album.titre, textes.service[service]);
  });
}

// ---------------------------------------------------------------------
// Lecteur d'extraits (F-24, F-40)
// ---------------------------------------------------------------------

// GestionnaireLecteur porte l'etat du lecteur, sans dependance a
// HTMLAudioElement (teste sans DOM). REINITIALISE a chaque nouveau centre
// (F-24) : definirExtraits() coupe systematiquement toute lecture en
// cours, un extrait qui continuerait appartient a un artiste qui n'est
// plus a l'ecran.
export class GestionnaireLecteur {
  #extraits: ExtraitAPI[] = [];
  #index: number | null = null;
  #enLecture = false;

  get extraits(): readonly ExtraitAPI[] {
    return this.#extraits;
  }

  get extraitCourant(): ExtraitAPI | null {
    return this.#index === null ? null : (this.#extraits[this.#index] ?? null);
  }

  get enLecture(): boolean {
    return this.#enLecture;
  }

  /** F-40 : desactive et EXPLICITE, jamais un bouton simplement inerte. */
  get desactive(): boolean {
    return this.#extraits.length === 0;
  }

  get raisonDesactivation(): string {
    return this.desactive ? textes.lecteurAucunExtrait : "";
  }

  definirExtraits(extraits: ExtraitAPI[]): void {
    this.#extraits = extraits;
    this.reinitialiser();
  }

  jouer(index: number): void {
    if (index < 0 || index >= this.#extraits.length) return;
    this.#index = index;
    this.#enLecture = true;
  }

  pause(): void {
    this.#enLecture = false;
  }

  /** Enchaine l'extrait suivant (§06 "un lecteur enchaine les extraits") ;
   * s'arrete en fin de liste plutot que de boucler indefiniment. */
  suivant(): void {
    if (this.#index === null) return;
    const prochain = this.#index + 1;
    if (prochain >= this.#extraits.length) {
      this.#enLecture = false;
      return;
    }
    this.jouer(prochain);
  }

  reinitialiser(): void {
    this.#index = null;
    this.#enLecture = false;
  }
}

// ---------------------------------------------------------------------
// Service d'ecoute (F-25, close) — cette classe ne porte que le defaut et
// la memoire en session ; le reglage releve du serveur au demarrage
// (chargerReglageServeur, PRP 07, internal/api/reglages.go) l'ecrase des
// que la reponse arrive, pour suivre le proprietaire d'un appareil a
// l'autre.
// ---------------------------------------------------------------------

export const SERVICES = ["deezer", "spotify", "apple", "youtube", "tidal"] as const;
export type Service = (typeof SERVICES)[number];

const SERVICE_PAR_DEFAUT: Service = "deezer";

export class GestionnaireService {
  #service: Service = SERVICE_PAR_DEFAUT;
  #observateurs: Array<(s: Service) => void> = [];

  get service(): Service {
    return this.#service;
  }

  definir(service: Service): void {
    this.#service = service;
    for (const f of this.#observateurs) f(service);
  }

  /** Notifie a chaque changement : c'est ce qui permet a "tous les liens
   * de l'application" (F-25) de se recalculer sans recharger l'ecran. */
  observer(f: (s: Service) => void): void {
    this.#observateurs.push(f);
  }
}

// modeleRecherche mirrors internal/source/odesli.go (RecherchePreRemplie) :
// meme couverture de cinq services, memes gabarits d'URL. Dupliquer ce
// gabarit cote client sert de REPLI IMMEDIAT — le href pose des la
// construction de la fiche, avant tout appel reseau, et la valeur de
// secours si /api/ecouter echoue ou tarde (F-26 : jamais de page vide, ni
// d'attente sans issue). La resolution PRECISE, elle, respecte §07 ("les
// liens d'ecoute ne sont demandes qu'au geste") : elle n'est demandee qu'au
// CLIC, par resoudreLienEcoute() plus bas, qui appelle GET /api/ecouter —
// jamais au chargement de la fiche.
const modeleRecherche: Record<Service, string> = {
  deezer: "https://www.deezer.com/search/%s",
  spotify: "https://open.spotify.com/search/%s",
  apple: "https://music.apple.com/search?term=%s",
  youtube: "https://music.youtube.com/search?q=%s",
  tidal: "https://tidal.com/search?q=%s",
};

/** lienEcoute (F-25, F-26) : jamais une chaine vide — repli systematique
 * en recherche pre-remplie sur le service choisi. */
export function lienEcoute(service: Service, artiste: string, album = ""): string {
  const requete = `${artiste} ${album}`.trim();
  const modele = modeleRecherche[service] ?? modeleRecherche[SERVICE_PAR_DEFAUT];
  return modele.replace("%s", encodeURIComponent(requete));
}

// ---------------------------------------------------------------------
// Resolution PRECISE au clic (F-25, F-26, N-03) — internal/api/ecouter.go
// ---------------------------------------------------------------------

/** Delai au-dela duquel un clic abandonne la resolution precise et suit le
 * repli deja pose : F-26 interdit une attente sans issue, pas seulement une
 * page vide. */
const DELAI_RESOLUTION_MS = 2500;

export interface ParametresResolution {
  artiste: string;
  album?: string;
  service: Service;
  urlDeezer?: string;
}

/** resoudreLienEcoute appelle GET /api/ecouter — jamais au chargement de la
 * fiche, seulement quand cette fonction est invoquee (au clic). Toute panne,
 * lenteur ou reponse invalide retombe silencieusement sur lienEcoute() : ce
 * repli garantit qu'un clic ne mene JAMAIS a une page vide ni a une attente
 * sans issue (F-26), qu'Odesli reponde, tarde, ou ne connaisse pas le
 * service demande. */
export async function resoudreLienEcoute(p: ParametresResolution): Promise<string> {
  const repli = lienEcoute(p.service, p.artiste, p.album ?? "");
  const params = new URLSearchParams({ artiste: p.artiste, service: p.service });
  if (p.album) params.set("album", p.album);
  if (p.urlDeezer) params.set("urlDeezer", p.urlDeezer);

  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_RESOLUTION_MS);
  try {
    const reponse = await fetch(`/api/ecouter?${params.toString()}`, { signal: controleur.signal });
    if (!reponse.ok) return repli;
    const corps = (await reponse.json()) as { lien?: string };
    return corps.lien || repli;
  } catch {
    return repli;
  } finally {
    clearTimeout(minuteur);
  }
}

/** cablerResolutionAuClic intercepte le clic gauche simple sur un lien
 * d'ecoute pour resoudre le lien PRECIS avant d'ouvrir l'onglet — un clic
 * modifie (ctrl/cmd/shift/alt) ou un bouton autre que le gauche n'est PAS
 * intercepte : le navigateur suit alors directement le href deja pose (le
 * repli), qui reste un lien valide, jamais une page vide. parametres() est
 * appelee AU CLIC, pas a l'appel de cette fonction : elle lit donc toujours
 * le service COURANT (options.service.service est un accesseur), meme si
 * l'utilisateur a change de service depuis la construction de la fiche. */
export function cablerResolutionAuClic(
  lien: HTMLAnchorElement,
  parametres: () => ParametresResolution,
): void {
  lien.addEventListener("click", (evenement) => {
    if (evenement.defaultPrevented || evenement.button !== 0) return;
    if (evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.altKey) return;
    evenement.preventDefault();
    const repli = lien.href;
    void resoudreLienEcoute(parametres()).then((resolu) => {
      window.open(resolu || repli, "_blank", "noopener,noreferrer");
    });
  });
}

// ---------------------------------------------------------------------
// Construction DOM (F-19 : panneau distinct de l'apercu de survol)
// ---------------------------------------------------------------------

export interface OptionsFiche {
  nom: string;
  profil: ProfilAPI;
  albums: AlbumAPI[];
  extraits: ExtraitAPI[];
  service: GestionnaireService;
  /** Lien Deezer de l'artiste (ficheJSON.LienDeezer, deja obtenu par
   * /api/fiche a cout nul) : transmis a /api/ecouter au clic sur le lien
   * artiste pour resoudre le lien PRECIS sans refaire l'appel Deezer.
   * Absent, le clic sur le lien artiste retombe sur la recherche
   * pre-remplie — jamais un appel Odesli sans indice a resoudre. */
  lienDeezer?: string;
  /** F-28 : garder/retirer cet artiste de la collection, action
   * disponible DEPUIS LA FICHE. dejaGarde vient du proprietaire de la
   * collection (main.ts) — construireFiche ne connait ni le reseau ni la
   * persistance, seulement l'etat courant et un geste a rapporter.
   * Optionnel : une fiche construite sans collection cablee (tests,
   * ancien appelant) n'affiche simplement pas le bouton. */
  dejaGarde?: boolean;
  surBasculerGarde?: () => void;
}

export interface PanneauFiche {
  lecteur: GestionnaireLecteur;
  definirFiltre(type: string): void;
  /** Reflete un changement d'etat "garde" survenu ailleurs (par exemple :
   * l'artiste a ete retire depuis le panneau collection pendant que sa
   * fiche restait ouverte) sans reconstruire le panneau. */
  actualiserGarde(dejaGarde: boolean): void;
  /** Recalcule tous les liens pour le service COURANT de options.service.
   * L'appelant (main.ts) le cable a options.service.observer() lui-meme,
   * plutot que construireFiche : la fiche est reconstruite a chaque
   * nouveau centre, et un abonnement pris ICI s'accumulerait a chaque
   * promotion sans jamais se desabonner. */
  actualiserLiens(): void;
}

// construireFiche peint LE PROFIL DU CENTRE — jamais ecrase par un survol
// de branche (F-19) : l'apercu de survol vit dans un conteneur DOM
// entierement distinct (construireApercuBranche), jamais dans celui-ci.
export function construireFiche(conteneur: HTMLElement, options: OptionsFiche): PanneauFiche {
  conteneur.replaceChildren();
  conteneur.classList.add("fiche");
  conteneur.setAttribute("role", "region");
  conteneur.setAttribute("aria-label", textes.ficheTitre(options.nom));

  const titre = document.createElement("h2");
  titre.className = "fiche-titre";
  titre.textContent = options.nom;
  conteneur.append(titre);

  // F-28 : garder/retirer, disponible DEPUIS LA FICHE. N'existe que si
  // l'appelant a cable la collection (surBasculerGarde) : construireFiche
  // reste utilisable sans collection (tests, chargement partiel).
  let boutonGarder: HTMLButtonElement | null = null;
  if (options.surBasculerGarde) {
    boutonGarder = document.createElement("button");
    boutonGarder.type = "button";
    boutonGarder.className = "fiche-garder";
    const peindreEtatGarde = (garde: boolean) => {
      boutonGarder!.setAttribute("aria-pressed", String(garde));
      boutonGarder!.textContent = garde ? textes.garde : textes.garder;
    };
    peindreEtatGarde(options.dejaGarde ?? false);
    // Le SEUL effet de ce clic est de rapporter le geste a l'appelant
    // (main.ts) : jamais un appel reseau ici, jamais une touche au
    // lecteur d'extraits — "garder n'interrompt rien" (PRP 07, tache 3).
    boutonGarder.addEventListener("click", () => options.surBasculerGarde!());
    conteneur.append(boutonGarder);
  }

  if (options.profil.presentation) {
    const presentation = document.createElement("p");
    presentation.className = "fiche-presentation";
    presentation.textContent = options.profil.presentation;
    conteneur.append(presentation);
  }

  const lienArtiste = document.createElement("a");
  lienArtiste.className = "fiche-lien-artiste";
  lienArtiste.target = "_blank";
  lienArtiste.rel = "noopener noreferrer";
  conteneur.append(lienArtiste);

  const discographie = document.createElement("div");
  discographie.className = "discographie";
  conteneur.append(discographie);

  function actualiserLiens(): void {
    const service = options.service.service;
    lienArtiste.href = lienEcoute(service, options.nom);
    lienArtiste.textContent = textes.ecouterSur(options.nom, textes.service[service]);
    mettreAJourLiens(discographie, options.albums, options.nom, service);
    cablerResolutionsSiBesoin();
  }

  // cablerResolutionsSiBesoin (F-25, F-26) : cable la resolution PRECISE au
  // CLIC, une seule fois par element (garde dataset.resolutionCablee) — sans
  // quoi chaque changement de service, qui rappelle actualiserLiens(),
  // empilerait un nouvel ecouteur et multiplierait les appels a
  // /api/ecouter sur un seul clic. Le service et l'artiste sont relus EN
  // DIRECT au clic (parametres() ferme sur options, pas sur une valeur
  // figee ici), donc jamais perimes malgre le cablage unique.
  function cablerResolutionsSiBesoin(): void {
    if (!lienArtiste.dataset.resolutionCablee) {
      lienArtiste.dataset.resolutionCablee = "1";
      cablerResolutionAuClic(lienArtiste, () => ({
        artiste: options.nom,
        service: options.service.service,
        urlDeezer: options.lienDeezer,
      }));
    }
    discographie.querySelectorAll<HTMLAnchorElement>(".discographie-lien").forEach((lien) => {
      if (lien.dataset.resolutionCablee) return;
      lien.dataset.resolutionCablee = "1";
      const mbid = lien.closest<HTMLElement>(".discographie-album")?.dataset.mbid;
      cablerResolutionAuClic(lien, () => {
        const album = options.albums.find((a) => a.mbid === mbid);
        return {
          artiste: options.nom,
          album: album?.titre,
          service: options.service.service,
        };
      });
    });
  }

  const filtreVisible = typesPresents(options.albums).length > 1; // F-22
  let filtreCourant = "tous";
  if (filtreVisible) {
    const filtre = document.createElement("select");
    filtre.className = "discographie-filtre";
    filtre.setAttribute("aria-label", textes.filtrerParType);
    const options_ = ["tous", ...typesPresents(options.albums)];
    for (const t of options_) {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t === "tous" ? textes.typeTous : t;
      filtre.append(opt);
    }
    filtre.addEventListener("change", () => {
      filtreCourant = filtre.value;
      peindreDiscographie(discographie, options.albums, filtreCourant);
      actualiserLiens();
    });
    conteneur.insertBefore(filtre, discographie);
  }
  peindreDiscographie(discographie, options.albums, filtreCourant);
  actualiserLiens();

  const lecteur = new GestionnaireLecteur();
  lecteur.definirExtraits(options.extraits);

  const boutonLire = document.createElement("button");
  boutonLire.type = "button";
  boutonLire.className = "lecteur-bouton";
  boutonLire.disabled = lecteur.desactive;
  boutonLire.textContent = lecteur.desactive ? textes.lecteurAucunExtrait : textes.lecteurLire(options.extraits[0]?.titre ?? "");
  if (lecteur.desactive) boutonLire.setAttribute("aria-disabled", "true");
  boutonLire.addEventListener("click", () => lecteur.jouer(0));
  conteneur.append(boutonLire);

  return {
    lecteur,
    definirFiltre(type: string) {
      filtreCourant = type;
      peindreDiscographie(discographie, options.albums, type);
      actualiserLiens();
    },
    actualiserLiens,
    actualiserGarde(dejaGarde: boolean) {
      if (!boutonGarder) return;
      boutonGarder.setAttribute("aria-pressed", String(dejaGarde));
      boutonGarder.textContent = dejaGarde ? textes.garde : textes.garder;
    },
  };
}

// construireApercuBranche (F-19) : le panneau distinct montre au survol
// d'une branche, SANS jamais toucher au conteneur de construireFiche.
export function construireApercuBranche(conteneur: HTMLElement, donnees: { nom: string }): void {
  conteneur.replaceChildren();
  conteneur.classList.add("apercu-branche");
  conteneur.setAttribute("role", "region");
  conteneur.setAttribute("aria-label", textes.apercuBrancheTitre(donnees.nom));

  const nom = document.createElement("p");
  nom.className = "apercu-nom";
  nom.textContent = donnees.nom;
  conteneur.append(nom);
}

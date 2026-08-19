// apps/ramure-v2/web/src/sw.ts
//
// Service worker : installation, fonctionnement hors ligne, mise a jour
// signalee (N-11, N-12, F-42, PRP 08). Compile a PART de main.ts (voir
// web/package.json, "build") : un service worker tourne dans son propre
// contexte global (self), jamais dans window, et esbuild produit
// dist/sw.js en IIFE — un script classique, pas un module ESM, pour la
// plus large compatibilite d'enregistrement.
//
// Regle imperative de ce fichier, rappelee par le PRP : SEULS les
// fichiers STATIQUES et les illustrations sont mis en cache. /api/... ne
// passe JAMAIS par ce worker — un worker qui le mettrait en cache
// masquerait la distinction vide/panne (PRP 04, internal/arbre) et
// servirait un arbre PERIME apres reconnexion, silencieusement.
//
// tsconfig.json ne porte que la lib DOM (main.ts en a besoin) : les types
// du contexte "worker" (ServiceWorkerGlobalScope, ExtendableEvent,
// FetchEvent...) n'y sont donc pas disponibles. Plutot que d'ajouter une
// seconde configuration tsc (deux commandes a maintenir en phase dans
// test.sh, le Dockerfile et la CI), ce fichier declare le sous-ensemble
// EXACT qu'il utilise, ci-dessous.
export {};

interface EvenementExtensible extends Event {
  waitUntil(promesse: Promise<unknown>): void;
}
interface EvenementFetch extends EvenementExtensible {
  readonly request: Request;
  respondWith(reponse: Promise<Response> | Response): void;
}
interface EvenementMessage extends EvenementExtensible {
  readonly data: unknown;
}
interface ClientsDuWorker {
  claim(): Promise<void>;
}
interface PorteeServiceWorker {
  readonly location: Location;
  readonly clients: ClientsDuWorker;
  skipWaiting(): Promise<void>;
  addEventListener(type: "install" | "activate", ecouteur: (e: EvenementExtensible) => void): void;
  addEventListener(type: "fetch", ecouteur: (e: EvenementFetch) => void): void;
  addEventListener(type: "message", ecouteur: (e: EvenementMessage) => void): void;
}
declare const self: PorteeServiceWorker;

// Un SEUL cache, jamais versionne par un identifiant de build : chaque
// "install" recupere des copies FRAICHES ({cache:"reload"}, qui
// contourne le cache HTTP du navigateur) et les ECRASE dans ce meme
// cache — inutile de faire porter la fraicheur par le NOM du cache
// quand cache.put() la porte deja par son CONTENU. Ce choix evite aussi
// le piege "worker mal cadre qui sert indefiniment une version perimee"
// (vigilance du PRP) : il n'y a rien a oublier de nettoyer a l'activation,
// donc rien qui puisse rester bloque sur une ancienne generation de cache.
const CACHE = "ramure-shell";

// Coquille minimale precachee (N-11, "demarre sans reseau sur son ecran
// d'accueil") : "/" est la page d'accueil (main.go, GET /{$}), le reste
// vit sous /dist/ (route statique existante, internal/api/routes.go —
// aucune route ajoutee par ce PRP).
const COQUILLE = ["/", "/dist/app.js", "/dist/manifest.webmanifest", "/dist/icone.svg"];

self.addEventListener("install", (evenement) => {
  evenement.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        COQUILLE.map(async (chemin) => {
          try {
            const reponse = await fetch(chemin, { cache: "reload" });
            if (reponse.ok) await cache.put(chemin, reponse);
          } catch {
            // Hors ligne des la toute premiere installation (rare) : la
            // coquille partielle reste utilisable, jamais une
            // installation cassee dans son ensemble.
          }
        }),
      );
    })(),
  );
});

self.addEventListener("activate", (evenement) => {
  // clients.claim() : la nouvelle version prend le controle des onglets
  // DEJA OUVERTS des son activation — mais l'activation elle-meme n'a
  // lieu qu'apres un skipWaiting() EXPLICITE (message "SAUTER_ATTENTE"
  // ci-dessous, declenche par le clic sur la banniere de main.ts) :
  // jamais automatiquement pendant qu'une exploration est en cours
  // (F-42, "ne casse pas une session en cours").
  evenement.waitUntil(self.clients.claim());
});

self.addEventListener("message", (evenement) => {
  if (evenement.data === "SAUTER_ATTENTE") {
    void self.skipWaiting();
  }
});

/** estAppelAPI : /api/... ne doit JAMAIS repondre depuis ce worker — voir
 * l'entete du fichier. Exportee pour verifier la DECISION DE ROUTAGE par
 * test (jsdom), la mecanique de cache elle-meme restant du ressort d'un
 * vrai navigateur (PRP 09). */
export function estAppelAPI(url: URL): boolean {
  return url.origin === self.location.origin && url.pathname.startsWith("/api/");
}

/** estIllustration : une image (Cover Art Archive, Deezer...) — jamais
 * une reponse JSON, quel que soit son origine (les CDN d'illustrations
 * sont hors domaine, `destination` reste fiable dans les deux cas). */
export function estIllustration(requete: Request): boolean {
  return requete.destination === "image";
}

/** estStatique : la coquille de l'application elle-meme, servie par
 * cette app (jamais un domaine tiers). */
export function estStatique(url: URL): boolean {
  return url.origin === self.location.origin && (url.pathname === "/" || url.pathname.startsWith("/dist/"));
}

self.addEventListener("fetch", (evenement) => {
  const requete = evenement.request;
  if (requete.method !== "GET") return; // jamais PUT/DELETE (collection, reglages) : toujours le reseau

  const url = new URL(requete.url);
  if (estAppelAPI(url)) return; // laisse passer : comportement reseau normal, non intercepte

  if (estIllustration(requete)) {
    // Illustrations deja vues : servies depuis le cache si presentes
    // (N-11, "les illustrations deja vues restent disponibles"), sinon
    // recuperees puis mises en cache pour la prochaine fois. Un echec
    // reseau SANS copie en cache remonte tel quel : la pastille retombe
    // alors sur son repli de couleur deterministe (canevas.ts), jamais
    // sur un ecran casse.
    evenement.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const enCache = await cache.match(requete);
        if (enCache) return enCache;
        const reponse = await fetch(requete);
        if (reponse.ok) await cache.put(requete, reponse.clone());
        return reponse;
      })(),
    );
    return;
  }

  if (estStatique(url)) {
    // Coquille statique : le cache d'abord (demarrage hors ligne
    // instantane, N-11), avec un rafraichissement reseau en
    // ARRIERE-PLAN qui alimente les VISITES SUIVANTES — jamais celle-ci,
    // deja rendue depuis le cache. C'est ce rafraichissement continu, a
    // CHAQUE visite, qui empeche un worker mal cadre de servir une
    // version perimee indefiniment (vigilance du PRP) : le cache ne
    // reste jamais plus vieux qu'une visite, meme si personne ne clique
    // jamais "Mettre a jour".
    evenement.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const enCache = await cache.match(requete);
        const depuisReseau = fetch(requete)
          .then(async (reponse) => {
            if (reponse.ok) await cache.put(requete, reponse.clone());
            return reponse;
          })
          .catch(() => undefined);
        if (enCache) {
          void depuisReseau; // rafraichit sans jamais retarder cette reponse
          return enCache;
        }
        const reseau = await depuisReseau;
        if (reseau) return reseau;
        throw new Error(`ramure-v2 : hors ligne et rien en cache pour ${requete.url}`);
      })(),
    );
  }
});

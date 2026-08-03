// Le service worker — installation, hors-ligne partiel, diffusion des mises a
// jour (N-11, N-12, F-42).
//
// Une regle domine ce fichier, et c'est la meme que celle du cache serveur :
// AUCUNE REPONSE D'API N'EST MISE EN CACHE. La §09 l'exige — "aucun etat
// d'echec n'est conserve" — et la F-37 en fait une des deux exigences
// critiques : "reessayer relance un veritable chargement : aucun resultat vide
// ni aucune erreur transitoire n'est conserve en memoire ou sur le poste".
//
// Un service worker qui mettrait /api/ en cache serait le moyen le plus sur de
// violer les deux : il servirait indefiniment la reponse vide d'une source
// momentanement muette, et le bouton "Reessayer" ne partirait jamais jusqu'au
// reseau. Le cache est donc reserve a la COQUE — page, styles, script, polices —
// et aux ILLUSTRATIONS deja vues, que la N-11 demande explicitement de garder.

const VERSION = "ramure-v1";
const COQUE = `${VERSION}-coque`;
const IMAGES = `${VERSION}-images`;

// La coque : ce qu'il faut pour que l'application demarre sans reseau sur son
// ecran d'accueil (N-11).
const RESSOURCES = [
  "./",
  "index.html",
  "ramure.css",
  "ramure.js",
  "manifest.webmanifest",
  "fonts/bodoni-moda.woff2",
  "fonts/archivo.woff2",
];

// Le cache d'illustrations est borne : un explorateur intensif traverserait
// des centaines d'artistes en une session, et le quota du navigateur n'est pas
// extensible. Au-dela, les plus anciennes sont evincees.
const MAX_IMAGES = 220;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(COQUE).then((c) => c.addAll(RESSOURCES)).catch(() => {})
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    // Les caches des versions precedentes sont retires : sans cela, une mise a
    // jour laisserait l'ancienne coque sur le disque indefiniment.
    const noms = await caches.keys();
    await Promise.all(noms.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// F-42 : la page demande la main quand l'utilisateur accepte la mise a jour.
// Le service worker ne se substitue jamais de lui-meme pendant une session —
// cela rechargerait la page au milieu d'une exploration.
self.addEventListener("message", (e) => {
  if (e.data?.action === "prends-la-main") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const requete = e.request;
  if (requete.method !== "GET") return;

  const url = new URL(requete.url);

  // ── Les appels d'API passent TOUJOURS par le reseau, sans exception ──
  if (url.origin === location.origin && url.pathname.includes("/api/")) return;

  // ── Les illustrations : servies depuis le cache, completees par le reseau ──
  if (requete.destination === "image" && url.origin !== location.origin) {
    e.respondWith(imageEnCache(requete));
    return;
  }

  if (url.origin !== location.origin) return;

  // ── La coque : le reseau d'abord, le cache en filet ──
  //
  // "Le reseau d'abord" et non "le cache d'abord" : c'est ce qui fait qu'une
  // version deployee atteint les installations existantes dans un delai borne
  // (N-12). Le cache ne sert que quand le reseau ne repond pas.
  e.respondWith((async () => {
    try {
      const reponse = await fetch(requete);
      if (reponse.ok) {
        const copie = reponse.clone();
        caches.open(COQUE).then((c) => c.put(requete, copie)).catch(() => {});
      }
      return reponse;
    } catch {
      const enCache = await caches.match(requete);
      if (enCache) return enCache;
      // Une navigation hors ligne retombe sur la page d'accueil, qui sait
      // s'afficher sans reseau.
      if (requete.mode === "navigate") {
        const accueil = await caches.match("index.html");
        if (accueil) return accueil;
      }
      throw new Error("hors ligne");
    }
  })());
});

// imageEnCache sert une illustration deja vue, et la memorise sinon.
// "Les illustrations deja vues restent disponibles" (N-11).
async function imageEnCache(requete) {
  const cache = await caches.open(IMAGES);
  const enCache = await cache.match(requete);
  if (enCache) return enCache;

  try {
    const reponse = await fetch(requete);
    // Une reponse opaque (mode no-cors) a un statut 0 : elle est utilisable
    // par le navigateur mais illisible ici. On la garde quand meme, c'est ce
    // qui rend les pochettes de tiers disponibles hors ligne.
    if (reponse.ok || reponse.type === "opaque") {
      cache.put(requete, reponse.clone()).then(() => elague(cache)).catch(() => {});
    }
    return reponse;
  } catch {
    // Pas d'illustration : le repli graphique deterministe du client prend la
    // place, sans decalage de mise en page (§11).
    return new Response("", { status: 504, statusText: "illustration indisponible" });
  }
}

async function elague(cache) {
  const cles = await cache.keys();
  if (cles.length <= MAX_IMAGES) return;
  // Les cles sont rendues dans l'ordre d'insertion : les premieres sont les
  // plus anciennes.
  await Promise.all(cles.slice(0, cles.length - MAX_IMAGES).map((c) => cache.delete(c)));
}

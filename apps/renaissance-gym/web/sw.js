// sw.js — le service worker de la coque (PRD A12).
//
// INCRÉMENTE `VERSION` À CHAQUE LIVRAISON qui touche web/. C'est ce qui fait
// remplacer l'ancien cache par le nouveau et parvenir le correctif suivant à
// une gymnaste qui a déjà installé l'application : une version qui ne change
// pas est un correctif qui n'arrive jamais chez elle.
const VERSION = '1';
const CACHE_NAME = `renaissance-gym-coque-v${VERSION}`;

// Ce qui est mis en cache l'est parce que la séance en a besoin hors ligne —
// la coque, le CSS, les modules, la police, le programme, les icônes — et
// RIEN DE PLUS. Aucune réponse de /api/ n'apparaît jamais ici, sous aucune
// forme : une fiche périmée qui reviendrait à la place de la vraie ferait
// perdre des séances, ce qui est exactement ce que le serveur existe pour
// éviter (PRD A12).
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/app.js',
  '/badges.js',
  '/chrono.js',
  '/domaine.js',
  '/etat.js',
  '/programme.js',
  '/sonnerie.js',
  '/synchro.js',
  '/vue-detail-seance.js',
  '/vue-entree.js',
  '/vue-grille.js',
  '/vue-jour.js',
  '/vue-reglages.js',
  '/vue-seance.js',
  '/style.css',
  '/archivo.woff2',
  '/programme.json',
  '/icone-192.png',
  '/icone-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      // Règle 2 : une version qui change remplace l'ancienne immédiatement,
      // sans attendre la fermeture des onglets.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(
        noms
          .filter((nom) => nom !== CACHE_NAME)
          .map((nom) => caches.delete(nom)),
      ))
      // L'ancien cache est effacé et cette version prend la main sur tous
      // les onglets déjà ouverts, sans attendre qu'ils se ferment.
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Aucune réponse de /api/ n'est jamais mise en cache, sous aucune
  // stratégie : on ne touche pas à la requête, elle suit son chemin normal
  // vers le réseau, exactement comme si ce fichier n'existait pas.
  if (url.pathname.startsWith('/api/')) return;

  // Règle 1 : le réseau d'abord, le cache seulement en secours. Une
  // correction livrée le matin doit être en place à la première ouverture
  // qui a du réseau — jamais servie périmée depuis le cache alors que le
  // réseau répond.
  event.respondWith(
    fetch(request)
      .then((reponse) => {
        if (reponse && reponse.ok) {
          const copie = reponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copie));
        }
        return reponse;
      })
      .catch(() => caches.match(request).then((mise) => {
        if (mise) return mise;
        throw new Error('renaissance-gym : hors ligne et rien en cache pour ' + url.pathname);
      })),
  );
});

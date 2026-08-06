// Service worker de marcq-handball.
//
// Il sert l'hors-ligne, jamais l'installation : aucun manifest, aucune invite
// « ajouter a l'ecran d'accueil ». Le PRD §11 demande un lien qui s'ouvre.
//
// Le jeton de la ligne VERSION ci-dessous est remplace par la version du
// binaire au moment ou le serveur sert ce fichier. Le nom du cache en depend :
// sans cela, pull_policy: always deploierait une image neuve que le navigateur
// n'afficherait jamais.
const VERSION = '__VERSION__';
const NOM_CACHE = `marcq-${VERSION}`;

// La coque mise en cache a l'installation. Un chemin qui repond 404 fait
// echouer cache.addAll, donc l'installation entiere, et le service worker
// n'active JAMAIS — l'app reste utilisable en ligne, l'hors-ligne disparait
// sans un mot. N'ajoute un chemin ici que le jour ou le fichier existe ;
// tests/coque.test.js verifie cette liste a chaque execution.
const COQUE = [
  '/',
  '/style.css',
  '/programme.json',
  '/app.js',
  '/etat.js',
  '/domaine.js',
  '/vue-prenom.js',
  '/vue-jour.js',
  '/vue-reglages.js',
  '/vue-seance.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(NOM_CACHE).then((cache) => cache.addAll(COQUE)));
  // La version deployee prend la main au rechargement suivant, pas deux
  // rechargements plus tard.
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(
      noms.filter((n) => n.startsWith('marcq-') && n !== NOM_CACHE)
          .map((n) => caches.delete(n)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const requete = e.request;
  if (requete.method !== 'GET') return;

  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;

  // Le classement (lot 2) et la sonde de sante ne se mettent jamais en cache :
  // resservir un rang perime serait pire que d'annoncer qu'il est indisponible.
  if (url.pathname.startsWith('/api/') || url.pathname === '/healthz') return;

  e.respondWith(cacheDAbord(requete));
});

// Cache d'abord : une seance se coche entierement hors ligne (PRD §11), et le
// reseau ne retarde jamais l'affichage. Le cache etant nomme par la version, un
// deploiement le vide de fait — il n'y a donc rien a invalider a la main.
async function cacheDAbord(requete) {
  const cache = await caches.open(NOM_CACHE);
  const enCache = await cache.match(requete, { ignoreSearch: true });
  if (enCache) return enCache;

  try {
    const reponse = await fetch(requete);
    if (reponse.ok && reponse.type === 'basic') {
      await cache.put(requete, reponse.clone());
    }
    return reponse;
  } catch (e) {
    // Hors ligne et rien en cache. Pour une navigation, la coque suffit a faire
    // demarrer l'app, qui relit ensuite sa progression dans localStorage.
    const repli = await cache.match('/');
    if (requete.mode === 'navigate' && repli) return repli;
    throw e;
  }
}

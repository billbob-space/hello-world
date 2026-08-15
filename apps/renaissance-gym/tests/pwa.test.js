// tests/pwa.test.js — A12, « L'application s'installe sur le téléphone ».
// Ce que ce fichier vérifie ne se voit pas non plus à l'écran : le manifeste
// est bien formé et déclare le velours bleu roi et le jersey (DESIGN.md), et
// le service worker tient les deux règles non négociables du PRD — le réseau
// avant le cache, une version qui remplace l'ancienne sans attendre — sans
// jamais mettre en cache une réponse de /api/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const web = join(racine, 'web');
const lire = (nom) => readFileSync(join(web, nom), 'utf8');

test('le manifeste est un JSON valide et porte les couleurs, l’affichage et les deux icônes attendus', () => {
  const manifeste = JSON.parse(lire('manifest.webmanifest'));

  assert.equal(manifeste.display, 'standalone');
  assert.equal(manifeste.orientation, 'portrait');
  assert.equal(manifeste.lang, 'fr');
  assert.equal(manifeste.start_url, '/');
  assert.equal(manifeste.scope, '/');
  // DESIGN.md : velours bleu roi, jersey mat.
  assert.equal(manifeste.theme_color, '#1B2FB5');
  assert.equal(manifeste.background_color, '#F4F1EA');

  assert.equal(manifeste.icons.length, 2);
  for (const icone of manifeste.icons) {
    assert.match(icone.src, /^\/icone-(192|512)\.png$/);
    assert.equal(icone.type, 'image/png');
    // Le contenu des icônes tient dans les 80 % centraux : elles ont été
    // dessinées pour porter le masque des lanceurs Android.
    assert.equal(icone.purpose, 'maskable');
  }
  const tailles = manifeste.icons.map((i) => i.sizes).sort();
  assert.deepEqual(tailles, ['192x192', '512x512']);
});

test('index.html déclare le manifeste', () => {
  const html = lire('index.html');
  assert.match(html, /<link\s+rel="manifest"\s+href="\/manifest\.webmanifest">/);
});

test('sw.js porte un nom de cache versionné, avec une instruction explicite d’incrémenter', () => {
  const source = lire('sw.js');
  assert.match(source, /INCR[ÉE]MENTE.*VERSION/i, 'le fichier doit rappeler qu’il faut changer la version à chaque livraison, sans quoi le correctif suivant n’arrive jamais');
  assert.match(source, /const VERSION\s*=\s*['"][^'"]+['"]/);
  assert.match(source, /CACHE_NAME\s*=\s*`[^`]*\$\{VERSION\}[^`]*`/, 'le nom du cache doit incorporer la version');
});

test('sw.js applique skipWaiting et clients.claim : une version qui change remplace l’ancienne sans attendre', () => {
  const source = lire('sw.js');
  assert.match(source, /self\.skipWaiting\(\)/);
  assert.match(source, /self\.clients\.claim\(\)/);
  // L'ancien cache doit être effacé à l'activation.
  assert.match(source, /caches\.delete\(/);
});

test('sw.js ne sert jamais la coque depuis le cache quand le réseau répond : réseau d’abord, cache en secours', () => {
  const source = lire('sw.js');
  const gestionnaire = source.slice(source.indexOf("addEventListener('fetch'"));
  const indexFetch = gestionnaire.indexOf('fetch(request)');
  const indexCacheMatch = gestionnaire.indexOf('caches.match(request)');
  assert.ok(indexFetch !== -1, 'le gestionnaire fetch doit appeler fetch(request)');
  assert.ok(indexCacheMatch !== -1, 'le gestionnaire fetch doit prévoir un secours par caches.match');
  assert.ok(indexFetch < indexCacheMatch, 'le réseau doit être tenté avant tout recours au cache');
});

// Le garde-fou du PRD A12 : « Aucune réponse de l'API n'est jamais mise en
// cache, sous aucune stratégie. » Le test échoue si /api apparaît dans la
// LISTE de mise en cache (PRECACHE_URLS) ; le gestionnaire de fetch, lui,
// doit au contraire mentionner /api/ pour l'exclure explicitement avant
// toute logique de cache.
test('sw.js ne précache jamais rien sous /api, et l’exclut explicitement du cache', () => {
  const source = lire('sw.js');
  const debut = source.indexOf('PRECACHE_URLS');
  const fin = source.indexOf('];', debut);
  const liste = source.slice(debut, fin);

  assert.doesNotMatch(liste, /\/api\//, 'aucune route /api/ ne doit apparaître dans la liste de mise en cache');
  for (const attendu of ['/style.css', '/archivo.woff2', '/programme.json', '/icone-192.png', '/icone-512.png', '/app.js']) {
    assert.match(liste, new RegExp(attendu.replace('.', '\\.')), `${attendu} doit être précaché pour le hors-ligne`);
  }

  assert.match(source, /pathname\.startsWith\(['"`]\/api\/['"`]\)/, 'le gestionnaire fetch doit exclure /api/ avant toute mise en cache');
});

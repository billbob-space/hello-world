// Ce que la coque doit verifier sans navigateur.
//
// La CI n'en a pas, et les fautes visees ici ne se voient de toute facon pas a
// l'ecran : elles suppriment l'hors-ligne, ou font charger une ressource
// distante sur une page publique. Les tests du domaine, eux, arrivent au PRP 02.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', 'web');
const lire = (nom) => readFileSync(join(web, nom), 'utf8');

// Le piege le plus couteux du service worker : une entree de COQUE qui repond
// 404 fait echouer cache.addAll, donc l'installation, et le service worker
// n'active jamais. Rien ne le signale — l'app marche, simplement plus hors
// ligne. La liste est lue dans le source parce que sw.js n'est pas un module :
// l'importer dans Node executerait self.addEventListener.
test('chaque chemin de la coque correspond a un fichier livre', () => {
  const bloc = lire('sw.js').match(/const COQUE = \[([^\]]*)\]/);
  assert.ok(bloc, 'sw.js ne declare plus de tableau COQUE');

  const chemins = [...bloc[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(chemins.length > 0, 'COQUE vide : plus rien ne serait disponible hors ligne');

  for (const chemin of chemins) {
    const fichier = chemin === '/' ? 'index.html' : chemin.replace(/^\//, '');
    assert.doesNotThrow(
      () => lire(fichier),
      `${chemin} est dans COQUE mais web/${fichier} n'existe pas`,
    );
  }
});

test('le cache du service worker est nomme par la version du binaire', () => {
  const source = lire('sw.js');
  assert.match(
    source,
    /const VERSION = '__VERSION__';/,
    'le jeton remplace par le serveur a disparu : le demarrage echouerait',
  );
  assert.match(
    source,
    /marcq-\$\{VERSION\}/,
    'le nom du cache ne depend plus de la version : un deploiement resterait invisible',
  );
});

test('la coque ne charge rien hors de son origine', () => {
  for (const nom of ['index.html', 'style.css']) {
    const source = lire(nom);
    assert.doesNotMatch(
      source,
      /(?:src|href)\s*=\s*["']https?:\/\//i,
      `${nom} charge une ressource distante : la page est publique, tout doit etre en meme origine`,
    );
    assert.doesNotMatch(
      source,
      /@import\s+(?:url\()?\s*["']?https?:/i,
      `${nom} importe une feuille de style distante`,
    );
  }
});

test('aucune invite d installation', () => {
  const source = lire('index.html');
  assert.doesNotMatch(source, /rel\s*=\s*["']manifest["']/i, 'PRD §11 : un lien qui s ouvre, pas une installation');
  assert.doesNotMatch(source, /beforeinstallprompt/i, 'PRD §11 : aucune banniere « ajouter a l ecran d accueil »');
});

// La portee d'un service worker est celle du repertoire d'ou il est servi :
// enregistre depuis un sous-chemin, il ne prendrait pas en charge la racine.
test('le service worker est enregistre depuis la racine', () => {
  assert.match(lire('index.html'), /navigator\.serviceWorker\.register\('\/sw\.js'\)/);
});

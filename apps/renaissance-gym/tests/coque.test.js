// tests/coque.test.js — ce que la coque doit verifier sans navigateur
// (PRP 02). Ce qui est vise ici ne se voit pas forcement a l'ecran : un
// contrat de direction efface par un remaniement, un angle qui redevient une
// carte arrondie, une police qui redescend sous le plancher de lecture, ou une
// ressource qui part chercher un domaine tiers sur une page publique.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const web = join(racine, 'web');
const lire = (nom) => readFileSync(join(web, nom), 'utf8');

// Le contrat de direction visuelle (ossature §4), reproduit mot pour mot.
const CONTRAT = readFileSync(join(racine, 'prp', '00-ossature.md'), 'utf8')
  .split('\n')
  .slice(108, 136) // lignes 109 a 136 (1-indexees) : de « <!-- » a « --> »
  .join('\n');

test('le contrat de direction visuelle est present, mot pour mot, comme premier commentaire de <body>', () => {
  assert.match(CONTRAT, /^<!--\n/, 'garde-fou : l’extraction depuis l’ossature n’a pas trouve le bon bloc');
  assert.match(CONTRAT, /\n-->$/);

  const html = lire('index.html');
  const corpsOuvert = html.indexOf('<body>');
  assert.ok(corpsOuvert !== -1, 'index.html ne porte pas de <body>');

  const apresBody = html.slice(corpsOuvert + '<body>'.length);
  // Le premier enfant : rien d'autre que du blanc n'est tolere avant le
  // commentaire, sans quoi il ne serait plus « premier enfant de <body> ».
  const premierEnfant = apresBody.replace(/^\s*/, '');
  assert.ok(
    premierEnfant.startsWith(CONTRAT),
    'le premier enfant de <body> n’est pas le contrat de direction, mot pour mot',
  );
});

test('index.html porte la coque minimale du PRP 02 : <main id="ecran"> et rien d’ecrit en dur', () => {
  const html = lire('index.html');
  assert.match(html, /<main id="ecran"><\/main>/, 'la balise hote des vues doit exister et rester vide');
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/);
  assert.match(html, /<meta name="theme-color" content="#1B2FB5">/);
  assert.match(html, /<link rel="preload" href="\/archivo\.woff2" as="font" type="font\/woff2" crossorigin>/);
  assert.match(html, /<script type="module" src="\/app\.js"><\/script>/);
});

// L'ossature §5.3 : « Le rayon de 24 px des cartes empilees est precisement ce
// que le contrat refuse. » Le plancher retenu est 4 px (ossature §5.3, PRP 02).
test('aucun border-radius superieur a 4px dans style.css', () => {
  const source = lire('style.css');
  const declarations = [...source.matchAll(/border-radius\s*:\s*([^;]+);/g)].map((m) => m[1]);
  assert.ok(declarations.length > 0, 'aucune declaration border-radius trouvee : le test ne verifierait rien');

  for (const valeur of declarations) {
    for (const jeton of valeur.trim().split(/\s+/)) {
      if (jeton === '0' || jeton === '0px') continue;
      const enPx = jeton.match(/^([\d.]+)px$/);
      const enRem = jeton.match(/^([\d.]+)rem$/);
      const enVar = jeton.startsWith('var(');
      if (enPx) {
        assert.ok(Number(enPx[1]) <= 4, `border-radius de ${jeton} depasse 4px`);
      } else if (enRem) {
        assert.ok(Number(enRem[1]) * 16 <= 4, `border-radius de ${jeton} depasse 4px`);
      } else if (!enVar) {
        assert.fail(`border-radius avec une unite non reconnue : ${jeton}`);
      }
    }
  }

  // Une variable utilisee comme border-radius doit elle-meme respecter le
  // plancher : on la retrouve et on la verifie a son tour.
  for (const nomVar of ['--angle']) {
    const def = source.match(new RegExp(`${nomVar}\\s*:\\s*([\\d.]+)px`));
    if (def) assert.ok(Number(def[1]) <= 4, `${nomVar} depasse 4px`);
  }
});

// PRD §5 : la lecture a un metre exige un plancher de police, y compris les
// mentions legeres. clamp() est exempte : sa borne basse reste au-dessus du
// plancher par construction de ce fichier.
test('aucune taille de police inferieure a 1.0625rem (17px) hors clamp() dans style.css', () => {
  const source = lire('style.css');
  const declarations = [...source.matchAll(/font-size\s*:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.ok(declarations.length > 0, 'aucune declaration font-size trouvee : le test ne verifierait rien');

  for (const valeur of declarations) {
    if (valeur.includes('clamp(')) continue;
    if (valeur.startsWith('var(')) continue; // resolue via les variables ci-dessous
    const enRem = valeur.match(/^([\d.]+)rem$/);
    assert.ok(enRem, `taille de police exprimee dans une unite non prevue par le test : ${valeur}`);
    assert.ok(Number(enRem[1]) >= 1.0625, `${valeur} est sous le plancher de 17px`);
  }

  // Les variables de taille elles-memes, y compris celles referencees par
  // font-size via var(...).
  for (const nomVar of ['--taille-texte', '--taille-etiquette']) {
    const def = source.match(new RegExp(`${nomVar}\\s*:\\s*([\\d.]+)rem`));
    assert.ok(def, `${nomVar} n’est pas definie en rem : le test ne peut pas la verifier`);
    assert.ok(Number(def[1]) >= 1.0625, `${nomVar} est sous le plancher de 17px`);
  }
});

// La page se charge sans reseau apres une premiere visite (PRD §11.2) : rien
// dans les sources ne doit dependre d'un domaine tiers.
test('aucune URL absolue vers un domaine tiers dans les sources', () => {
  const fichiers = readdirSync(web).filter((f) => ['.html', '.css', '.js'].includes(extname(f)));
  assert.ok(fichiers.length >= 3, 'garde-fou : peu de fichiers trouves dans web/');

  for (const nom of fichiers) {
    const source = lire(nom);
    assert.doesNotMatch(source, /https?:\/\//i, `${nom} porte une URL absolue : la page est publique, tout doit rester en meme origine`);
  }
});

// A12 precise le PRD §11.3, il ne le contredit pas : ce qui reste interdit,
// c'est l'invite faite PAR l'application (une banniere, un
// `beforeinstallprompt` detourne en pop-up) — l'installation est un geste
// offert par le navigateur, jamais reclame. Le manifeste, lui, est desormais
// demande : le test cesse de l'interdire, PRD A12 « ce que cela retire du
// contrat ».
test('aucune invite d’installation faite par l’application ; le manifeste, lui, est demande', () => {
  const html = lire('index.html');
  assert.match(html, /<link\s+rel="manifest"\s+href="\/manifest\.webmanifest">/, 'A12 : le manifeste doit etre declare depuis index.html');
  for (const nom of readdirSync(web).filter((f) => extname(f) === '.js')) {
    assert.doesNotMatch(lire(nom), /beforeinstallprompt/i, `${nom} : aucune invite d’installation faite par l’application`);
  }
});

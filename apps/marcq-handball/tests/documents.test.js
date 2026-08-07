// Les documents de l'app affirment des nombres — 53 exercices, 24 rebours,
// 19 jours. Ils sont TOUS calculables depuis web/programme.json, qui est la
// source. Ce fichier compare les deux, et il existe pour un rendez-vous connu :
// la page 3 sur 3 de la note du coach (PRD §12.3) ajoutera des seances, et sans
// ce test les neuf phrases ci-dessous resteraient a leur ancienne valeur sans
// que rien ne le signale.
//
// UN MOTIF PAR AFFIRMATION, avec son contexte : chercher « 24 » dans le README
// attrape aussi « ~24 minutes de gainage » et « 24 caracteres au plus ». Le
// filet large est la bonne technique pour du code, jamais pour de la prose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { secondesDe } from '../web/chrono.js';

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
// Les documents sont retailles a 80 colonnes : une affirmation traverse les
// retours a la ligne. On compare donc sur un texte a espaces normalises.
const prose = (chemin) => lire(chemin).replace(/\s+/g, ' ');

const programme = JSON.parse(lire('web/programme.json'));
const exercices = programme.seances.flatMap((s) => s.blocs.flatMap((b) => b.exercices));

const CHIFFRES = {
  exercices: exercices.length,
  rebours: exercices.filter((e) => secondesDe(e) !== null).length,
  chrono: exercices.filter((e) => secondesDe(e) === null).length,
  seances: programme.seances.length,
  jours: Math.round(
    (Date.parse(programme.fin) - Date.parse(programme.debut)) / 86400000,
  ) + 1,
};

// document, motif a UNE capture, et le chiffre que la capture doit valoir.
const AFFIRMATIONS = [
  ['PRODUCT.md', /Environ \*\*(\d+) exercices cochables\*\*/g, 'exercices'],
  ['README.md', /pas sur les (\d+) du programme entier/g, 'exercices'],
  ['README.md', /jamais sur les (\d+) du programme entier/g, 'exercices'],
  ['README.md', /participants × (\d+) identifiants/g, 'exercices'],
  ['README.md', /aucun des (\d+) exercices/g, 'exercices'],
  ['README.md', /(\d+) requêtes sur un programme/g, 'exercices'],
  ['README.md', /compte à rebours\*\* — (\d+) des \d+ cases/g, 'rebours'],
  ['README.md', /compte à rebours\*\* — \d+ des (\d+) cases/g, 'exercices'],
  ['README.md', /des \d+ cases ; les (\d+) autres/g, 'chrono'],
];

test('les nombres ecrits dans les documents sont ceux du programme', () => {
  for (const [document, motif, chiffre] of AFFIRMATIONS) {
    const trouves = [...prose(document).matchAll(motif)];
    // Un motif qui n'attrape plus rien est un garde-fou mort : la phrase a ete
    // reecrite, et le nombre qu'elle porte n'est plus verifie par personne.
    assert.notEqual(
      trouves.length, 0,
      `${document} : le motif ${motif} n'attrape plus rien — la phrase a change, corrige le motif`,
    );
    for (const t of trouves) {
      assert.equal(
        Number(t[1]), CHIFFRES[chiffre],
        `${document} ecrit ${t[1]} la ou le programme dit ${CHIFFRES[chiffre]} (${chiffre}) : « ${t[0]} »`,
      );
    }
  }
});

// Deux nombres sont ecrits EN TOUTES LETTRES, et aucune capture ne les lit. Le
// test se contente donc de figer la valeur attendue : le jour ou le programme
// change, il echoue en disant exactement quoi relire.
test('les nombres ecrits en toutes lettres tiennent encore', () => {
  assert.equal(
    CHIFFRES.jours, 19,
    'le programme ne dure plus dix-neuf jours : PRODUCT.md §9 et README.md l ecrivent en toutes lettres',
  );
  assert.equal(
    CHIFFRES.seances, 7,
    'le programme ne compte plus sept seances : PRODUCT.md §8 et §9 l ecrivent en toutes lettres',
  );
  for (const document of ['PRODUCT.md', 'README.md']) {
    assert.match(prose(document), /dix-neuf jours/, `${document} : « dix-neuf jours »`);
  }
  assert.match(prose('PRODUCT.md'), /sept séances/, 'PRODUCT.md : « sept séances »');
});

// Le README est la notice de l'app : un module qu'il ne nomme jamais est un
// module dont personne ne saura ce qu'il fait avant de l'ouvrir.
test('chaque fichier de web/ est nomme au moins une fois dans le README', () => {
  const readme = lire('README.md');
  const fichiers = readdirSync(new URL('../web', import.meta.url))
    .filter((f) => /\.(js|css|json|html|webp|woff2|txt)$/.test(f));
  assert.ok(fichiers.length > 20, 'la liste des fichiers de web/ est suspecte');
  for (const f of fichiers) {
    assert.ok(readme.includes(f), `web/${f} n est nomme nulle part dans le README`);
  }
});

// Et l'inverse : un fichier cite mais disparu envoie le lecteur nulle part.
test('chaque fichier de web/ cite par un document existe', () => {
  const presents = new Set(readdirSync(new URL('../web', import.meta.url)));
  for (const document of ['README.md', 'PRODUCT.md']) {
    for (const t of lire(document).matchAll(/web\/([A-Za-z0-9._-]+\.[a-z0-9]+)/g)) {
      assert.ok(presents.has(t[1]), `${document} cite web/${t[1]}, qui n existe pas`);
    }
  }
});

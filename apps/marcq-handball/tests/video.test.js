// tests/video.test.js — le lien qui montre le mouvement.
//
// Le seul endroit de l'app qui envoie ailleurs. Ce qui se teste : qu'AUCUN
// exercice ne reste sans lien, que le mouvement reconnu est le bon — un enfant
// a qui l'on montre le mouvement voisin est plus mal servi qu'un enfant a qui
// l'on ne montre rien — et que le lien sort proprement de l'application.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as video from '../web/video.js';

const source = (nom) => readFileSync(new URL(`../web/${nom}`, import.meta.url), 'utf8');
const programme = JSON.parse(readFileSync(new URL('../web/programme.json', import.meta.url), 'utf8'));

const exercices = programme.seances.flatMap((s) => s.blocs.flatMap((b) => b.exercices));

test('AUCUN des 53 exercices ne reste sans lien', () => {
  assert.equal(exercices.length, 53);
  const orphelins = exercices.filter((ex) => video.video(ex) === null);
  assert.deepEqual(
    orphelins.map((ex) => `${ex.id} — ${ex.libelle}`), [],
    'ajouter une seance sans ajouter son mouvement laisse un exercice muet',
  );
});

test('le mouvement reconnu est le bon, y compris quand deux se ressemblent', () => {
  // L'ORDRE DES MOTIFS EST LA REGLE. « squats sautes » doit passer avant
  // « squats », et « gainage de chaque cote » avant « gainage » : montrer le
  // mouvement voisin est pire que ne rien montrer, parce que l'enfant croit
  // avoir compris.
  const attendu = {
    's1-r4': 'gainage ventral',
    's1-r5': 'gainage latéral',
    's6-r6': 'gainage latéral',
    's1-r1': 'pompes',
    's1-r2': 'squats',
    's2-r3': 'squats sautés',
    's3-r2': 'squats sautés',
    's1-r3': 'fentes',
    's3-r3': 'fentes sautées',
    's1-r6': 'burpees',
    's2-r1': 'mountain climbers',
    's2-r2': 'dips sur une chaise',
    's3-r4': 'chaise contre un mur',
    's2-r4': 'abdos',
    's4-r4': 'abdos',
    's1-c1': 'footing',
    's1-c2': 'sprint',
    's4-c2': 'fractionné',
    's6-c2': 'fractionné',
    's3-c1': 'sport au choix',
  };
  for (const [id, nom] of Object.entries(attendu)) {
    const ex = exercices.find((e) => e.id === id);
    assert.notEqual(ex, undefined, id);
    assert.equal(video.video(ex).nom, nom, `${id} — ${ex.libelle}`);
  }
});

test('une adresse choisie par un adulte gagne sur la recherche', () => {
  const ex = { id: 's1-r1', libelle: '15 pompes', video: 'https://exemple.test/pompes' };
  const v = video.video(ex);
  assert.equal(v.href, 'https://exemple.test/pompes');
  assert.equal(v.epingle, true);
  // Le nom du mouvement reste lu depuis le libelle : c'est lui qui nomme le
  // lien a voix haute, quelle que soit la source de l'adresse.
  assert.equal(v.nom, 'pompes');
  assert.equal(video.titreVideo(v), 'Voir la vidéo : pompes');

  // Un champ vide, blanc ou d'un autre type ne compte pas pour une adresse.
  for (const mauvais of ['', '   ', null, 42, {}]) {
    assert.equal(video.video({ libelle: '15 pompes', video: mauvais }).epingle, false, JSON.stringify(mauvais));
  }
});

test('le repli est une RECHERCHE, et il ne promet pas autre chose', () => {
  const v = video.video({ libelle: '45 s de gainage ventral' });
  assert.equal(v.epingle, false);
  assert.match(v.href, /^https:\/\/www\.youtube\.com\/results\?search_query=/);
  // Deux promesses differentes, deux phrases differentes : proposer une video
  // precise que personne n'a visionnee serait la mettre sous les yeux d'un
  // enfant sur la foi de son titre.
  assert.equal(video.titreVideo(v), 'Chercher une vidéo qui montre : gainage ventral');
  assert.notEqual(video.titreVideo(v), video.titreVideo({ ...v, epingle: true }));
});

test('la requete est encodee, jamais concatenee', () => {
  assert.equal(
    video.lienRecherche('gainage 100 % & co'),
    'https://www.youtube.com/results?search_query=gainage%20100%20%25%20%26%20co',
  );
  const code = source('video.js');
  assert.match(code, /encodeURIComponent\(requete\)/);
});

test('le lien sort proprement de l application', () => {
  const code = source('video.js');
  // Sans `noopener`, la page ouverte garde une poignee sur celle-ci. La seance
  // doit rester ouverte derriere, avec ses cases et son minuteur en cours.
  assert.match(code, /lien\.target = '_blank'/);
  assert.match(code, /lien\.rel = 'noopener noreferrer'/);
  // Aucune ressource distante n'est CHARGEE : l'ossature §2 l'interdit, et un
  // lien n'est pas un chargement. Rien n'est integre dans la page.
  for (const interdit of ['<iframe', 'createElement(\'iframe\')', 'innerHTML', '<script']) {
    assert.equal(code.includes(interdit), false, `« ${interdit} » n appartient pas a ce module`);
  }
});

test('le lien est HORS de l etiquette, comme le minuteur', () => {
  const code = source('vue-seance.js');
  // Meme raison qu'au minuteur : l'etiquette couvre toute la ligne, un lien
  // pose dedans cocherait l'exercice au lieu d'ouvrir la video.
  assert.ok(
    code.indexOf('item.append(etiquette)') < code.indexOf('monterVideo(actions'),
    'le lien rejoint la ligne, pas l etiquette',
  );
  assert.equal(/etiquette\.append\([^)]*monterVideo/.test(code), false);
  // La video vient AVANT le minuteur : on regarde comment faire, puis on
  // declenche le temps.
  assert.ok(code.indexOf('monterVideo(actions') < code.indexOf('monterChrono(actions'));

  assert.match(source('sw.js'), /'\/video\.js'/);
  const css = source('style.css');
  for (const classe of ['.video-exercice', '.actions-exercice']) {
    assert.ok(css.includes(classe), `${classe} manque dans style.css`);
  }
  // Une zone de tap pleine, comme tout ce qui se touche ici (PRD §11).
  assert.match(css, /\.video-exercice\b[^}]*min-height:\s*var\(--marcq-tap\)/s);
});

test('programme.json accepte un champ video sans le reclamer', () => {
  // Le champ est FACULTATIF : le programme livre n'en porte aucun, et
  // l'application fonctionne. Il existe pour qu'un adulte puisse figer une
  // adresse verifiee sans toucher a une ligne de code.
  const avec = exercices.filter((ex) => typeof ex.video === 'string');
  assert.equal(avec.length, 0, 'aucune adresse epinglee pour l instant — le repli suffit');
  for (const ex of exercices) {
    assert.equal(video.video(ex).epingle, false);
  }
});

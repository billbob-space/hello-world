// tests/vues.test.js — ce que les ecrans disent, sans navigateur.
//
// Les fonctions de montage touchent au DOM et ne se testent pas ici. Ce qui se
// teste : les modeles — purs — et les phrases que le PRD fixe au mot pres. Aucun
// module de vue ne touche au DOM a l'evaluation ; c'est ce qui les rend
// importables par `node --test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PHRASE_RASSURANTE } from '../web/vue-prenom.js';
import * as domaine from '../web/domaine.js';
import { dateEnToutesLettres, modeleJour } from '../web/vue-jour.js';

const source = (nom) => readFileSync(new URL(`../web/${nom}`, import.meta.url), 'utf8');

const prog = domaine.chargerProgramme(
  JSON.parse(readFileSync(new URL('../web/programme.json', import.meta.url), 'utf8')),
);
const contexte = (aujourdhui, faits = {}) => ({ prog, aujourdhui, prenom: 'Lucas', faits });

test('le premier lancement ne demande que le prenom (PRD §7.1)', () => {
  assert.equal(PHRASE_RASSURANTE, 'Ton prénom reste sur ton téléphone.');

  const code = source('vue-prenom.js');
  assert.equal(
    (code.match(/createElement\('input'\)/g) ?? []).length,
    1,
    'un champ, et un seul',
  );
  assert.equal(
    (code.match(/createElement\('button'\)/g) ?? []).length,
    1,
    'un bouton, et un seul',
  );
  for (const interdit of ["'password'", "'email'", "'date'", "'tel'", "'number'"]) {
    assert.equal(code.includes(interdit), false, `le premier lancement ne demande pas ${interdit}`);
  }
});

test('jour de seance : le titre du coach, le compte de cases, le lien vers la seance', () => {
  const m = modeleJour(contexte('2026-08-03'));
  assert.equal(m.cas, 'aujourd-hui');
  assert.equal(m.salutation, 'Salut Lucas');
  assert.equal(m.titre, 'Endurance + Renforcement');
  assert.equal(m.details, '8 exercices · lundi 3 août');
  assert.deepEqual(m.lien, { texte: 'Commencer la séance', href: '#/seance/2026-08-03' });
  assert.deepEqual(m.etat, { statut: 'aujourd-hui', cochable: true, total: 8, coches: 0 });
});

test('seance entamee : on reprend, on ne recommence pas', () => {
  const m = modeleJour(contexte('2026-08-03', { 's1-r1': '2026-08-03T18:22:11.000Z' }));
  assert.equal(m.lien.texte, 'Reprendre la séance');
  assert.equal(m.etat.coches, 1);
});

test('jour de repos : on annonce la prochaine seance (PRD §6, lot 1)', () => {
  const m = modeleJour(contexte('2026-08-04'));
  assert.equal(m.cas, 'repos');
  assert.equal(m.titre, 'Repos aujourd’hui');
  assert.equal(m.details, 'Prochaine séance mercredi 5 août : Fractionné.');
  assert.equal(m.lien.href, '#/seance/2026-08-05');
  assert.equal(m.etat, null, 'aucune barre de progression un jour de repos');
});

test('apres la derniere seance mais avant la fin, il n y a plus rien a annoncer', () => {
  const m = modeleJour(contexte('2026-08-20'));
  assert.equal(m.cas, 'repos');
  assert.equal(m.lien, null, 'aucun ecran a ouvrir');
  assert.match(m.details, /^Plus de séance/);
});

test('apres le 21 aout, l ecran annonce la fin du programme (PRD §9)', () => {
  const m = modeleJour(contexte('2026-08-22'));
  assert.equal(m.cas, 'terminee');
  assert.equal(m.titre, 'Programme terminé');
  assert.equal(m.lien, null);
});

test('la date en toutes lettres ne glisse pas d un jour selon le fuseau', () => {
  assert.equal(dateEnToutesLettres('2026-08-03'), 'lundi 3 août');
  assert.equal(dateEnToutesLettres('2026-08-01'), 'samedi 1er août');
  assert.equal(dateEnToutesLettres('2026-08-21'), 'vendredi 21 août');
});

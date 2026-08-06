// L'ecran perso, prouve sans navigateur.
//
// Meme coupure qu'a l'ecran de seance (PRP 04) : tout ce qui DECIDE est dans le
// modele, donc teste ici ; ce qui reste — poser le modele dans le DOM — se
// verifie a la main a la tache 5. La CI n'a pas de navigateur et n'en aura pas,
// l'app n'ayant aucune dependance (ossature §2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chargerProgramme } from '../web/domaine.js';
import { MOTIF_SEANCE } from '../web/vue-seance.js';
import * as vue from '../web/vue-perso.js';

const source = (nom) => readFileSync(new URL(`../web/${nom}`, import.meta.url), 'utf8');
const prog = chargerProgramme(JSON.parse(source('programme.json')));

// Le contexte d'ecran du PRP 03, reduit a ce que cet ecran lit.
const contexte = (aujourdhui, faits = {}) => ({ prog, aujourdhui, prenom: 'Lucas', faits });

// Les identifiants d'une seance, et ceux du programme entier. Les scenarios
// « tout coche » partent de la donnee, jamais d'une liste recopiee.
const casesDe = (date) =>
  prog.seances.find((s) => s.date === date).blocs.flatMap((b) => b.exercices).map((e) => e.id);
const toutesLesCases = prog.seances.flatMap((s) =>
  s.blocs.flatMap((b) => b.exercices.map((e) => e.id)));
const cocher = (ids) => Object.fromEntries(ids.map((id) => [id, '2026-08-10T08:00:00.000Z']));

test('les durees se lisent comme un ado les raconte (PRD §7.5)', () => {
  assert.equal(vue.formaterDuree(0), '0 s');
  assert.equal(vue.formaterDuree(45), '45 s', 'sous la minute, la seconde est l unite du gainage');
  assert.equal(vue.formaterDuree(60), '1 min');
  // Le gainage du programme entier. Le PRD §8 l'arrondit lui-meme a la minute.
  assert.equal(vue.formaterDuree(1425), '24 min');
  assert.equal(vue.formaterDuree(3600), '1 h', 'jamais « 60 min »');
  assert.equal(vue.formaterDuree(65 * 60), '1 h 05', 'les minutes se lisent sur deux chiffres');
  assert.equal(vue.formaterDuree(130 * 60), '2 h 10', 'la duree de la phrase du PRD §7.5');
  assert.equal(vue.formaterDuree(235 * 60), '3 h 55', 'la course du programme entier');
});

test('les repetitions restent des entiers, et le pluriel suit', () => {
  const lignes = vue.lignesVolume({ pompes: 1, squats: 20 });
  assert.deepEqual(lignes.map((l) => l.phrase), ['1 pompe', '20 squats']);
  assert.deepEqual(lignes.map((l) => l.unite), ['pompes', 'squats']);
});

test('la phrase du PRD §7.5 se reproduit au mot pres', () => {
  const totaux = { pompes: 112, squats: 165, burpees: 45, min_course: 130 };
  assert.equal(
    vue.lignesVolume(totaux).map((l) => l.phrase).join(', '),
    '112 pompes, 165 squats, 45 burpees, 2 h 10 de course',
  );
});

test('une unite a zero ne raconte rien', () => {
  assert.deepEqual(vue.lignesVolume({ pompes: 0, squats: 0, min_course: 0 }), []);
  // `cases` compte les cases cochees : c'est une mesure de progression, pas un
  // volume. Il n'entre jamais dans le recit.
  assert.deepEqual(vue.lignesVolume({ cases: 53 }), []);
});

test('la part se mesure sur ce qui est programme a ce jour (PRD §9)', () => {
  const m = vue.modelePerso(contexte('2026-08-05', cocher(casesDe('2026-08-03'))));
  assert.equal(m.titre, 'Ma progression');
  assert.equal(m.part.cochees, 8);
  assert.equal(m.part.programmees, 16, 'les seances du 3 et du 5, pas les 53 cases du programme');
  assert.equal(m.part.pourcent, 50);
  assert.equal(m.part.echelle, 16);
  assert.equal(m.part.phrase, '8 exercices sur 16 programmés à ce jour.');
});

test('avant la premiere seance, la part ne divise pas par zero', () => {
  const m = vue.modelePerso(contexte('2026-08-02'));
  assert.equal(m.part.cochees, 0);
  assert.equal(m.part.programmees, 0);
  assert.equal(m.part.pourcent, 0);
  assert.equal(m.part.echelle, 1, '<progress max="0"> est invalide');
  assert.equal(m.part.phrase, 'Le programme commence lundi 3 août.');
});

test('tout coche, le volume raconte le programme entier (PRD §8)', () => {
  const m = vue.modelePerso(contexte('2026-08-21', cocher(toutesLesCases)));
  const phrases = m.volume.lignes.map((l) => l.phrase);
  assert.deepEqual(phrases.filter((p) => !p.endsWith('fentes')), [
    '226 pompes', '345 squats', '105 burpees', '210 abdos',
    '24 min de gainage', '3 h 55 de course',
  ]);
  // Le total de fentes n'est verrouille par aucune section du PRD : « 15 fentes
  // par jambe » se saisit en une valeur ou en deux, et c'est le PRP 02 qui
  // tranche. On verifie la forme, pas le nombre.
  assert.match(phrases.find((p) => p.endsWith('fentes')), /^\d+ fentes$/);
  assert.equal(m.part.pourcent, 100);
  assert.equal(m.volume.vide, null);
});

test('sans rien de coche, l ecran dit par ou ca commence', () => {
  const m = vue.modelePerso(contexte('2026-08-03'));
  assert.deepEqual(m.volume.lignes, []);
  assert.equal(m.volume.vide, 'Rien de coché pour l’instant. La première case ouvre le compteur.');
});

test('le calendrier couvre les dix-neuf jours, jamais un trou (PRD §9)', () => {
  const { jours } = vue.modelePerso(contexte('2026-08-10')).calendrier;
  assert.equal(jours.length, 19);
  assert.equal(jours[0].date, prog.debut);
  assert.equal(jours.at(-1).date, prog.fin);
  assert.equal(jours.filter((j) => j.estSeance).length, 7);
  assert.equal(jours.filter((j) => j.statut === 'repos').length, 12);
});

test('les quatre etats du PRD §7.5, plus les deux que le domaine distingue', () => {
  const faits = { ...cocher(casesDe('2026-08-03')), ...cocher(casesDe('2026-08-07').slice(0, 2)) };
  const { jours } = vue.modelePerso(contexte('2026-08-10', faits)).calendrier;
  const par = (date) => jours.find((j) => j.date === date);
  assert.equal(par('2026-08-03').statut, 'faite');
  assert.equal(par('2026-08-05').statut, 'manquee');
  assert.equal(par('2026-08-07').statut, 'partielle', 'deux cases sur six : ni faite, ni manquee');
  assert.equal(par('2026-08-10').statut, 'aujourd-hui');
  assert.equal(par('2026-08-12').statut, 'a-venir');
  assert.equal(par('2026-08-11').statut, 'repos');
  // La marque double la couleur : au soleil, et pour qui distingue mal le rouge
  // du vert, la forme doit suffire.
  assert.equal(par('2026-08-03').marque, '✓');
  assert.equal(par('2026-08-11').marque, '');
  assert.equal(par('2026-08-10').estAujourdhui, true);
  assert.equal(par('2026-08-11').estAujourdhui, false);
});

test('chaque jour porte son compte, son lien et son nom lisible', () => {
  const { jours } = vue.modelePerso(contexte('2026-08-10', cocher(casesDe('2026-08-03')))).calendrier;

  const lundi = jours.find((j) => j.date === '2026-08-03');
  assert.equal(lundi.numero, 3);
  assert.equal(lundi.detail, '8 sur 8');
  assert.equal(lundi.href, '#/seance/2026-08-03');
  // Le calendrier ne peut pas mener a une route que le routeur ignore.
  assert.match(lundi.href, MOTIF_SEANCE);
  assert.equal(lundi.nom, 'lundi 3 août · Endurance + Renforcement · faite · 8 sur 8');

  const mardi = jours.find((j) => j.date === '2026-08-04');
  assert.equal(mardi.href, null, 'un jour de repos n ouvre aucune seance');
  assert.equal(mardi.detail, null);
  assert.equal(mardi.nom, 'mardi 4 août · repos');
});

test('la grille s aligne sur le lundi, quel que soit le jour de depart', () => {
  assert.equal(vue.decalageInitial('2026-08-03'), 0, 'le programme commence un lundi');
  assert.equal(vue.decalageInitial('2026-08-05'), 2);
  assert.equal(vue.decalageInitial('2026-08-09'), 6, 'un dimanche ferme la semaine');
  // programme.json est editable : la saison suivante peut commencer un mercredi.
  assert.equal(vue.modelePerso(contexte('2026-08-10')).calendrier.decalage, 0);
});

test('la legende ne montre que les etats presents ce jour-la', () => {
  const debut = vue.modelePerso(contexte('2026-08-03')).calendrier;
  assert.deepEqual(debut.legende.map((e) => e.libelle), ['aujourd’hui', 'à venir', 'repos']);
  assert.equal(debut.resume, '19 jours · 7 séances');

  const fin = vue.modelePerso(contexte('2026-08-21', cocher(toutesLesCases))).calendrier;
  assert.deepEqual(fin.legende.map((e) => e.libelle), ['faite', 'repos']);
});

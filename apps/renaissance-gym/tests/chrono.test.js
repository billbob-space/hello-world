// tests/chrono.test.js — le minuteur (PRP 04 chantier B, PRD §7.3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creerChrono, formater, ETATS } from '../web/chrono.js';

const source = readFileSync(new URL('../web/chrono.js', import.meta.url), 'utf8');

// --- formater ------------------------------------------------------------

test('formater rend « m:ss », chiffres tabulaires', () => {
  assert.equal(formater(0), '0:00');
  assert.equal(formater(45000), '0:45');
  assert.equal(formater(60000), '1:00');
  assert.equal(formater(90000), '1:30');
  assert.equal(formater(-500), '0:00', 'jamais de negatif');
});

test('ETATS est exactement pret, en-cours, pause, termine', () => {
  assert.deepEqual(ETATS, ['pret', 'en-cours', 'pause', 'termine']);
});

test('creerChrono refuse une duree non positive', () => {
  assert.throws(() => creerChrono({ duree: 0 }));
  assert.throws(() => creerChrono({ duree: -1 }));
  assert.throws(() => creerChrono({ duree: NaN }));
});

// --- ossature §7 point 4 : AUCUNE fonction publique ne reduit le temps ----

test('aucune fonction publique de chrono.js ne reduit le temps restant : pas de avancer/sauter/reglerRestant', () => {
  assert.doesNotMatch(
    source,
    /\b(export\s+function\s+)?(avancer|sauter|reglerRestant|raccourcir|reduireRestant|forcerFin|terminerMaintenant|passerAuSuivant)\s*[(:]/i,
    'une fonction au nom evocateur d’un raccourci du minuteur a ete trouvee',
  );
});

test('l’objet rendu par creerChrono ne porte que demarrer, pause, remettreAZero, restant, etat', () => {
  const chrono = creerChrono({ duree: 1000, horloge: () => 0 });
  assert.deepEqual(Object.keys(chrono).sort(), ['demarrer', 'etat', 'pause', 'remettreAZero', 'restant'].sort());
});

// --- l’horloge murale, pas les tics ---------------------------------------

test('le decompte suit l’horloge murale : un grand saut de temps, meme sans tic recu, vide le restant', () => {
  let t = 0;
  const horloge = () => t;
  const tics = [];
  const chrono = creerChrono({ duree: 60000, horloge, tic: (r, e) => tics.push([r, e]) });

  assert.equal(chrono.restant(), 60000);
  chrono.demarrer();
  // Un onglet en arriere-plan ralentit setInterval : on simule un bond d’une
  // minute entiere sur L'HORLOGE, sans qu’aucun battement supplementaire
  // n’ait eu le temps de se produire.
  t += 61000;
  assert.equal(chrono.restant(), 0, 'le decompte doit suivre l’horloge murale, pas le nombre de tics recus');
  chrono.pause(); // nettoyage : arrete le battement reel avant la fin du test
});

test('pause fige le temps ecoule ; l’horloge continue d’avancer pendant la pause sans que cela compte', () => {
  let t = 0;
  const horloge = () => t;
  const chrono = creerChrono({ duree: 10000, horloge });

  chrono.demarrer();
  t = 3000;
  assert.equal(chrono.restant(), 7000);

  chrono.pause();
  assert.equal(chrono.etat(), 'pause');
  t = 9000; // le temps reel passe pendant la pause
  assert.equal(chrono.restant(), 7000, 'le temps ne s’ecoule pas pendant la pause');

  chrono.demarrer();
  t = 9500;
  assert.equal(chrono.restant(), 6500);
  chrono.pause();
});

// --- remettreAZero : le SEUL retour en arriere autorise --------------------

test('remettreAZero ramene le restant a la duree complete — c’est la seule facon d’« augmenter » le restant', () => {
  let t = 0;
  const horloge = () => t;
  const chrono = creerChrono({ duree: 10000, horloge });
  chrono.demarrer();
  t = 4000;
  assert.equal(chrono.restant(), 6000);

  chrono.remettreAZero();
  assert.equal(chrono.restant(), 10000);
  assert.equal(chrono.etat(), 'pret');

  // Redemarrer apres remise a zero repart bien du debut, pas d’une valeur
  // intermediaire.
  t = 4000; // horloge inchangee : demarrer() capture un nouveau depart
  chrono.demarrer();
  t = 4001;
  assert.equal(chrono.restant(), 9999);
  chrono.pause();
});

// --- le chrono atteint « termine » tout seul, porte par l’horloge reelle --

test('le chrono passe a « termine » tout seul, sans action supplementaire', async () => {
  await new Promise((resolve, reject) => {
    const chrono = creerChrono({
      duree: 300,
      tic: (restant, etatChrono) => {
        if (etatChrono === 'termine') {
          try {
            assert.equal(restant, 0);
            assert.equal(chrono.etat(), 'termine');
            resolve();
          } catch (err) {
            reject(err);
          }
        }
      },
    });
    chrono.demarrer();
  });
});

test('demarrer() est sans effet une fois termine : pas de reprise qui redonnerait du temps', async () => {
  const chrono = await new Promise((resolve) => {
    const c = creerChrono({
      duree: 50,
      tic: (restant, etatChrono) => { if (etatChrono === 'termine') resolve(c); },
    });
    c.demarrer();
  });
  assert.equal(chrono.etat(), 'termine');
  assert.equal(chrono.restant(), 0);
  chrono.demarrer();
  assert.equal(chrono.etat(), 'termine', 'demarrer() ne doit rien faire une fois termine');
  assert.equal(chrono.restant(), 0);
});

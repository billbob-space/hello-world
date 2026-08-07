// tests/chrono.test.js — le minuteur d'un exercice, sans navigateur.
//
// Le montage touche au DOM et ne se teste pas ici. Ce qui se teste : quel
// exercice merite un rebours, comment un temps s'ecrit, et la machine a etats —
// la seule piece ou une erreur produirait un minuteur faux plutot que laid.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as chrono from '../web/chrono.js';

const source = (nom) => readFileSync(new URL(`../web/${nom}`, import.meta.url), 'utf8');
const programme = JSON.parse(readFileSync(new URL('../web/programme.json', import.meta.url), 'utf8'));

test('c est le PROGRAMME qui decide du mode, pas l enfant', () => {
  // Les deux seules unites de temps : le gainage en secondes, la course en
  // minutes. Elles donnent un compte a rebours.
  assert.equal(chrono.secondesPrescrites({ unite: 'gainage_s', valeur: 45 }), 45);
  assert.equal(chrono.secondesPrescrites({ unite: 'min_course', valeur: 30 }), 1800);
  assert.equal(chrono.secondesPrescrites({ unite: 'min_course', valeur: 19 }), 1140);

  // Tout le reste se compte en repetitions : un rebours y inventerait une
  // limite que le coach n'a pas donnee.
  for (const unite of ['pompes', 'squats', 'burpees', 'abdos', 'fentes', 'autre']) {
    assert.equal(chrono.secondesPrescrites({ unite, valeur: 15 }), null, unite);
  }
  // Une mesure absente, vide ou a zero ne prescrit rien.
  for (const mesure of [null, undefined, {}, { unite: 'gainage_s', valeur: 0 }, { unite: 'gainage_s' }]) {
    assert.equal(chrono.secondesPrescrites(mesure), null, JSON.stringify(mesure));
  }
});

test('la duree ECRITE dans le libelle gagne sur la mesure', () => {
  // Le defaut signale : « 45 s de chaise contre un mur » porte
  // `unite: autre, valeur: 0` — le programme ne le compte dans aucun total — et
  // recevait donc un chronometre qui monte, alors que son libelle prescrit
  // quarante-cinq secondes en toutes lettres.
  const chaise = { libelle: '45 s de chaise contre un mur', mesure: { unite: 'autre', valeur: 0 } };
  assert.equal(chrono.secondesPrescrites(chaise.mesure), null, 'la mesure ne prescrit rien');
  assert.equal(chrono.secondesDe(chaise), 45, 'le libelle, lui, prescrit 45 s');

  // La mesure sert les TOTAUX, le libelle sert l'ENFANT. Quand les deux
  // different, c'est le second qui a raison, parce que c'est celui qu'il lit.
  assert.equal(chrono.dureeEcrite('30 s de gainage de chaque côté'), 30, 'on tient 30 s, puis on change de côté');
  assert.equal(chrono.dureeEcrite('6 × 2 minutes rapides, récupération 1 minute'), 120, 'l effort, pas la recuperation');
  assert.equal(chrono.dureeEcrite('2 séries de 8 × (30 s rapides à fond / 30 s lentes)'), 30, 'l intervalle, pas la seance');
  assert.equal(chrono.dureeEcrite('1 min de gainage'), 60);
  assert.equal(chrono.dureeEcrite('1 min 30 entre les tours'), 90, 'l appoint se lit en secondes');
  // Une fourchette rend son PLANCHER : un rebours est une cible a atteindre, et
  // la borne haute en ferait une cible qu'on rate en ayant fait ce qu'on demandait.
  assert.equal(chrono.dureeEcrite("30 à 40 minutes d'un autre sport"), 1800);
});

test('ce qui n est pas une duree n en devient pas une', () => {
  // LE PIEGE DES ACCENTS, constate a l'essai. En JavaScript, `\b` ignore les
  // accents : « 2 séries » se lit alors « 2 s » suivi d'une frontiere de mot
  // devant le « é ». Le motif garde donc la fin de son unite avec un lookahead
  // Unicode, et ce test est la seule chose qui empeche ce retour en arriere.
  assert.equal(chrono.dureeEcrite('2 séries de 8 répétitions'), null);
  assert.equal(chrono.dureeEcrite('15 squats'), null, '« 15 s » n est pas dans « 15 squats »');
  assert.equal(chrono.dureeEcrite('20 abdos'), null);
  assert.equal(chrono.dureeEcrite('15 secondes'), 15, 'le mot entier compte, lui');
  // Le metre n'est pas une minute.
  assert.equal(chrono.dureeEcrite('6 × 100 m à 80 %, récupération en marchant'), null);
  assert.equal(chrono.dureeEcrite('10 min de 30-30 m à 80 %'), 600, 'la premiere duree, et le metre ignore');
  for (const rien of [null, undefined, '', '0 min', '0 s', 'quinze minutes']) {
    assert.equal(chrono.dureeEcrite(rien), null, JSON.stringify(rien));
  }
});

test('le programme reel donne un rebours a vingt-quatre de ses exercices', () => {
  let rebours = 0;
  let repetitions = 0;
  const ecrases = [];
  for (const seance of programme.seances) {
    for (const bloc of seance.blocs) {
      for (const ex of bloc.exercices) {
        const vu = chrono.secondesDe(ex);
        if (vu === null) repetitions++; else rebours++;
        if (vu !== chrono.secondesPrescrites(ex.mesure)) ecrases.push(ex.id);
      }
    }
  }
  // Comptes depuis programme.json et non recopies. Le programme est clos depuis
  // le 7 aout (PRD §12.3) : ces trois nombres sont donc definitifs, et ce test
  // est desormais un garde-fou de non-regression — il dira lequel a bouge si le
  // fichier de donnees change, ce qui n'est plus attendu.
  assert.equal(rebours, 24);
  assert.equal(repetitions, 29);
  assert.equal(rebours + repetitions, 53, 'les 53 cases du programme');

  // Les SEPT exercices dont le libelle corrige la mesure, nommes un par un : ce
  // sont eux que le defaut signale a fait apparaitre, et les relire est le seul
  // moyen de voir qu'aucun ne prend une duree absurde.
  assert.deepEqual(ecrases, ['s1-r5', 's2-c2', 's3-c1', 's3-r4', 's5-c2', 's6-r6', 's7-c2']);
});

test('un temps s ecrit comme sur une horloge', () => {
  assert.equal(chrono.formaterChrono(45), '0:45');
  assert.equal(chrono.formaterChrono(0), '0:00');
  assert.equal(chrono.formaterChrono(9), '0:09');
  assert.equal(chrono.formaterChrono(60), '1:00');
  assert.equal(chrono.formaterChrono(1800), '30:00');
  assert.equal(chrono.formaterChrono(3900), '1:05:00');
  // Jamais de negatif affiche, meme si l'horloge du telephone recule.
  assert.equal(chrono.formaterChrono(-12), '0:00');
});

// --- la machine a etats -----------------------------------------------------

const S = 1000;

test('le rebours descend, s arrete a zero, et n y repart pas tout seul', () => {
  let etat = chrono.creerChrono(45);
  assert.equal(etat.mode, 'rebours');
  assert.deepEqual(chrono.lireChrono(etat, 0), { secondes: 45, fini: false, actif: false, demarre: false });

  etat = chrono.basculerChrono(etat, 0);
  assert.equal(chrono.lireChrono(etat, 10 * S).secondes, 35);
  assert.equal(chrono.lireChrono(etat, 10 * S).actif, true);

  // A zero il n'est plus actif, meme si personne ne l'a arrete : sans cela il
  // continuerait a battre pour afficher zero indefiniment.
  const arrivee = chrono.lireChrono(etat, 45 * S);
  assert.deepEqual(arrivee, { secondes: 0, fini: true, actif: false, demarre: true });
  assert.equal(chrono.lireChrono(etat, 90 * S).secondes, 0, 'il ne passe jamais sous zero');

  // Un tap distrait sur un rebours fini ne relance pas quarante-cinq secondes
  // de gainage : il se contente d'arreter.
  const apresTap = chrono.basculerChrono(etat, 45 * S);
  assert.equal(chrono.lireChrono(apresTap, 46 * S).actif, false);
  assert.equal(chrono.lireChrono(apresTap, 46 * S).fini, true);
});

test('le chronometre monte, sans fin', () => {
  let etat = chrono.creerChrono(null);
  assert.equal(etat.mode, 'chrono');
  assert.equal(chrono.lireChrono(etat, 0).secondes, 0);

  etat = chrono.basculerChrono(etat, 0);
  assert.equal(chrono.lireChrono(etat, 12 * S).secondes, 12);
  assert.equal(chrono.lireChrono(etat, 3600 * S).fini, false, 'un chronometre ne finit pas');
});

test('pause, reprise, et remise a zero', () => {
  let etat = chrono.basculerChrono(chrono.creerChrono(60), 0);

  etat = chrono.basculerChrono(etat, 20 * S); // pause a 20 s ecoulees
  assert.equal(chrono.lireChrono(etat, 20 * S).secondes, 40);
  // LE TEMPS NE COURT PAS EN PAUSE : c'est ce que dix minutes plus tard prouve.
  assert.equal(chrono.lireChrono(etat, 600 * S).secondes, 40);
  assert.equal(chrono.lireChrono(etat, 600 * S).actif, false);
  assert.equal(chrono.lireChrono(etat, 600 * S).demarre, true, 'la remise reste proposee');

  etat = chrono.basculerChrono(etat, 600 * S); // reprise
  assert.equal(chrono.lireChrono(etat, 610 * S).secondes, 30, 'la reprise repart de 40, pas de 60');

  etat = chrono.remettreChrono(etat);
  assert.deepEqual(chrono.lireChrono(etat, 999 * S), { secondes: 60, fini: false, actif: false, demarre: false });
});

test('le temps se CALCULE, il ne s incremente pas', () => {
  // Un onglet mis en veille cesse de recevoir ses battements. Un minuteur qui
  // compterait ses battements afficherait alors 3 s au bout de 30 ; celui-ci
  // lit l'horloge, et ne rate rien.
  const etat = chrono.basculerChrono(chrono.creerChrono(null), 0);
  assert.equal(chrono.lireChrono(etat, 30 * S).secondes, 30);

  const source_ = source('chrono.js');
  assert.equal(/acquis\s*\+\+|secondes\s*\+\+|\+=\s*1\b/.test(source_), false,
    'aucun compteur incremente a chaque battement');
});

test('figer un minuteur garde son temps — c est ce qui permet le un-a-la-fois', () => {
  let etat = chrono.basculerChrono(chrono.creerChrono(60), 0);
  etat = chrono.figerChrono(etat, 15 * S);
  assert.equal(chrono.lireChrono(etat, 15 * S).secondes, 45);
  assert.equal(chrono.lireChrono(etat, 900 * S).secondes, 45, 'fige, il ne bouge plus');
  // Figer ce qui est deja arrete ne change rien, et rend le MEME objet.
  assert.equal(chrono.figerChrono(etat, 20 * S), etat);
});

test('l orchestre ne laisse tourner qu un seul minuteur', () => {
  const orchestre = chrono.creerOrchestre();
  const figes = [];
  const a = { figer: () => figes.push('a') };
  const b = { figer: () => figes.push('b') };

  orchestre.prendreLaMain(a);
  assert.deepEqual(figes, [], 'le premier ne fige personne');
  orchestre.prendreLaMain(b);
  assert.deepEqual(figes, ['a'], 'le second fige le premier');
  orchestre.prendreLaMain(b);
  assert.deepEqual(figes, ['a'], 'reprendre la main ne se fige pas soi-meme');

  orchestre.rendreLaMain(a); // pas le porteur courant : sans effet
  orchestre.prendreLaMain(a);
  assert.deepEqual(figes, ['a', 'b']);
});

// --- ce que le montage promet, lu dans la source ----------------------------

test('le minuteur est HORS de l etiquette, sinon le demarrer cocherait l exercice', () => {
  const code = source('vue-seance.js');
  // L'etiquette couvre toute la ligne — c'est ce qui donne au PRP 04 sa zone de
  // tap pleine largeur. Un bouton pose dedans basculerait la case a chaque tap.
  // Le minuteur vit desormais dans `.actions-exercice`, la colonne de droite
  // qu'il partage avec le lien video. Ce qui compte n'a pas bouge : ce
  // conteneur est pose SUR LA LIGNE, apres l'etiquette, et jamais dedans.
  assert.ok(
    code.indexOf('item.append(etiquette)') < code.indexOf('item.append(actions)'),
    'la colonne d actions rejoint la ligne, pas l etiquette',
  );
  assert.ok(code.indexOf('item.append(actions)') < code.indexOf('monterChrono(actions'));
  assert.equal(/etiquette\.append\([^)]*(monterChrono|actions)/.test(code), false);

  // Un seul orchestre pour toute la seance, et le demontage de chaque minuteur
  // est conserve : sans lui, un battement tourne sur un ecran qui n'existe plus.
  assert.match(code, /creerOrchestre\(\)/);
  assert.match(code, /demontages\.push\(monterChrono\(/);
  assert.match(code, /for \(const arreter of demontages\) arreter\(\)/);
});

test('le minuteur n ECRIT rien et ne parle a personne', () => {
  const code = source('chrono.js');
  // Aucune persistance : un rebours qui reprendrait a 12 s deux jours plus tard
  // serait plus deroutant qu'utile, et le PRD §5 garde le telephone pour ce qui
  // compte.
  for (const interdit of ['localStorage', 'fetch(', 'innerHTML']) {
    assert.equal(code.includes(interdit), false, `« ${interdit} » n appartient pas au minuteur`);
  }
  // UNE SEULE lecture du telephone, et c'est une preference : quelle sonnerie
  // l'enfant a choisie. Rien d'autre de `etat.js` n'entre ici — surtout pas une
  // ecriture, qui ferait de ce module un second endroit ou la progression
  // change.
  const depuisEtat = [...code.matchAll(/import \{([^}]*)\} from '\.\/etat\.js'/g)]
    .flatMap(([, liste]) => liste.split(',').map((n) => n.trim()).filter(Boolean));
  assert.deepEqual(depuisEtat, ['lireSonnerie']);
  // La coque hors ligne doit le connaitre, sinon le premier passage sans reseau
  // sur une seance echoue et rien ne le signale tant qu'on reste connecte.
  assert.match(source('sw.js'), /'\/chrono\.js'/);

  const css = source('style.css');
  for (const classe of ['.chrono', '.chrono-groupe', '.chrono-actif', '.chrono-fini',
    '.chrono-remise', '.chrono-remise-dort']) {
    assert.ok(css.includes(classe), `${classe} manque dans style.css`);
  }
  // Une zone de tap pleine, comme tout ce qui se touche dans cette app (PRD §11).
  assert.match(css, /\.chrono\b[^}]*min-height:\s*var\(--marcq-tap\)/s);
  // La remise est masquee par `visibility` et jamais par `hidden` : `hidden`
  // retrecirait la ligne tant que le minuteur dort, et son apparition au premier
  // tap decalerait le libelle sous le pouce qui vient d'appuyer.
  assert.match(css, /\.chrono-remise-dort\s*\{\s*visibility:\s*hidden/);
  assert.equal(/remise\.hidden/.test(source('chrono.js')), false);
});

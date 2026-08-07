// tests/sonnerie.test.js — ce qu'on entend a zero, et ce qu'on peut choisir.
//
// L'oscillateur du navigateur n'existe pas sous `node --test` : il est remplace
// par un double qui NOTE ce qu'on lui demande. C'est suffisant, parce que ce qui
// peut se tromper ici n'est pas le timbre — c'est le nombre de notes, leur
// ordre, et surtout le moment ou l'audio est reveille.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as sonnerie from '../web/sonnerie.js';

const source = (nom) => readFileSync(new URL(`../web/${nom}`, import.meta.url), 'utf8');

// Un contexte audio factice : il enregistre les oscillateurs demarres et son
// propre etat, et rien de plus.
function fauxContexte(etat = 'running') {
  const joues = [];
  return {
    state: etat,
    currentTime: 0,
    reveils: 0,
    joues,
    resume() { this.state = 'running'; this.reveils++; },
    createOscillator() {
      const o = { type: null, frequency: { value: 0 }, connect() {}, start(t) { joues.push({ hz: o.frequency.value, a: t, type: o.type }); }, stop() {} };
      return o;
    },
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
      };
    },
    destination: {},
  };
}

test('quatre sonneries, dont le silence, et aucune ne s eternise', () => {
  assert.deepEqual(sonnerie.SONNERIES.map((s) => s.cle), ['bip', 'cloche', 'sifflet', 'silence']);
  assert.equal(sonnerie.SONNERIE_PAR_DEFAUT, 'bip');

  for (const s of sonnerie.SONNERIES) {
    assert.notEqual(s.nom, '', s.cle);
    assert.notEqual(s.description, '', s.cle);
    // Au-dela d'une seconde et demie, ce n'est plus un signal, c'est une alarme
    // qu'on cherche a faire taire.
    assert.ok(sonnerie.dureeSonnerie(s.cle) <= 1.5, `${s.cle} dure ${sonnerie.dureeSonnerie(s.cle)} s`);
  }
  // LE SILENCE EST UNE VRAIE OPTION : une seance se fait aussi en cours, dans un
  // salon, a cote de quelqu'un qui dort.
  assert.deepEqual(sonnerie.sonnerieDe('silence').notes, []);
  assert.equal(sonnerie.dureeSonnerie('silence'), 0);
});

test('une cle inconnue retombe sur le defaut, jamais sur rien', () => {
  // Une preference ecrite par une version future, ou une cle a la main dans le
  // stockage : le minuteur doit sonner quand meme.
  for (const inconnue of ['klaxon', '', null, undefined, 42]) {
    assert.equal(sonnerie.sonnerieDe(inconnue).cle, 'bip', JSON.stringify(inconnue));
  }
});

test('jouer produit une note par note, dans l ordre', () => {
  const ctx = fauxContexte();
  const sonneur = sonnerie.creerSonneur({ fabriquer: () => ctx });

  assert.equal(sonneur.jouer('sifflet'), true);
  assert.equal(ctx.joues.length, 3, 'trois coups de sifflet');
  assert.deepEqual(ctx.joues.map((n) => n.hz), [2100, 2100, 2100]);
  // Les departs se suivent, ils ne se superposent pas : trois notes lancees au
  // meme instant ne font pas un sifflet, elles font un accord.
  assert.ok(ctx.joues[0].a < ctx.joues[1].a && ctx.joues[1].a < ctx.joues[2].a);
  // Une sinusoide : un creneau grince dans un haut-parleur de telephone.
  assert.deepEqual([...new Set(ctx.joues.map((n) => n.type))], ['sine']);
});

test('le silence ne joue rien, et le dit', () => {
  const ctx = fauxContexte();
  const sonneur = sonnerie.creerSonneur({ fabriquer: () => ctx });
  assert.equal(sonneur.jouer('silence'), false);
  assert.equal(ctx.joues.length, 0);
});

test('un navigateur sans audio ne fait pas tomber le minuteur', () => {
  const sonneur = sonnerie.creerSonneur({ fabriquer: () => null });
  assert.equal(sonneur.preparer(), false);
  assert.equal(sonneur.jouer('bip'), false, 'aucune exception, un faux');
});

test('preparer REVEILLE un contexte suspendu — sans quoi le telephone reste muet', () => {
  // Un navigateur de telephone rend un contexte `suspended` tant que rien n'a
  // ete touche, et il ne leve pas d'erreur : il se tait. Le zero d'un rebours
  // n'etant pas un geste, c'est le tap de DEMARRAGE qui doit le reveiller.
  const ctx = fauxContexte('suspended');
  const sonneur = sonnerie.creerSonneur({ fabriquer: () => ctx });

  assert.equal(sonneur.preparer(), true);
  assert.equal(ctx.reveils, 1);
  assert.equal(ctx.state, 'running');

  // Le contexte n'est fabrique QU'UNE FOIS : en ouvrir un par exercice en
  // ouvrirait cinquante-trois.
  let fabriques = 0;
  const unique = sonnerie.creerSonneur({ fabriquer: () => { fabriques++; return fauxContexte(); } });
  unique.preparer(); unique.jouer('bip'); unique.preparer();
  assert.equal(fabriques, 1);
});

test('la sonnerie choisie est celle qui sonne, sans qu on la nomme', () => {
  const ctx = fauxContexte();
  let choix = 'cloche';
  const sonneur = sonnerie.creerSonneur({ fabriquer: () => ctx, lire: () => choix });

  sonneur.jouer();
  assert.deepEqual(ctx.joues.map((n) => Math.round(n.hz)), [1047], 'la cloche');

  choix = 'silence';
  assert.equal(sonneur.jouer(), false, 'le choix est relu a chaque fois, jamais capture');
});

// --- ce que le branchement promet, lu dans la source ------------------------

test('le minuteur sonne ET vibre, et reveille l audio au demarrage', () => {
  const code = source('chrono.js');
  // Les deux ensemble, jamais l'un a la place de l'autre : le telephone est
  // souvent pose a terre pendant un gainage, et la poche etouffe la vibration
  // comme le vacarme d'un gymnase couvre le bip.
  assert.ok(code.indexOf('vibrer();') < code.indexOf('sonner();'));
  assert.match(code, /if \(vu\.fini && !etaitFini\)/);

  // Le reveil est dans le gestionnaire du BOUTON, donc dans un geste — et avant
  // que l'etat ne bascule, pour qu'un demarrage donne toute la duree du rebours
  // d'avance a l'audio.
  const clic = code.indexOf("bouton.addEventListener('click'");
  const reveil = code.indexOf('sonneur.preparer()');
  assert.ok(clic !== -1 && reveil > clic, 'le reveil vit dans le geste');
  assert.ok(reveil < code.indexOf('etat = basculerChrono(etat, maintenant());', clic));
});

test('les reglages proposent les quatre sonneries, et les font entendre', () => {
  const code = source('vue-reglages.js');
  // CHOISIR, C'EST ENTENDRE : sans cela il faudrait revenir a une seance, lancer
  // un rebours et attendre son zero pour savoir ce qu'on vient de choisir.
  assert.match(code, /ecrireSonnerie\(bouton\.value\)/);
  assert.match(code, /sonneurDesReglages\.jouer\(bouton\.value\)/);
  assert.ok(
    code.indexOf('ecrireSonnerie(bouton.value)') < code.indexOf('sonneurDesReglages.jouer(bouton.value)'),
    'on enregistre avant de jouer : un son qui part et une preference perdue seraient le pire des deux',
  );
  // La liste vient du module, elle n'est pas recopiee : ajouter une sonnerie ne
  // demande pas de retoucher cet ecran.
  assert.match(code, /for \(const s of SONNERIES\)/);
  assert.match(code, /role', 'radiogroup'/);

  assert.match(source('sw.js'), /'\/sonnerie\.js'/);
  const css = source('style.css');
  for (const classe of ['.choix-sonnerie', '.ligne-sonnerie', '.case-sonnerie', '.nom-sonnerie']) {
    assert.ok(css.includes(classe), `${classe} manque dans style.css`);
  }
  assert.match(css, /\.ligne-sonnerie\b[^}]*min-height:\s*var\(--marcq-tap\)/s);
});

test('aucun fichier audio n entre dans l application', () => {
  // Le son est synthetise a la volee : rien a telecharger, rien a mettre dans la
  // coque hors ligne, rien a charger depuis un autre domaine — l'ossature §2
  // l'interdit —, et l'image ne grossit pas d'un octet.
  const code = source('sonnerie.js');
  for (const interdit of ['.mp3', '.wav', '.ogg', 'new Audio(', 'http://', 'https://']) {
    assert.equal(code.includes(interdit), false, `« ${interdit} » n appartient pas a ce module`);
  }
  assert.match(code, /createOscillator\(\)/);
});

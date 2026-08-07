// tests/sonnerie.test.js — ce qu'on entend a zero, et ce qu'on peut choisir.
//
// L'oscillateur du navigateur n'existe pas sous `node --test` : il est remplace
// par un double qui NOTE ce qu'on lui demande. C'est suffisant, parce que ce qui
// peut se tromper ici n'est pas le timbre — c'est le nombre de notes, leur
// ordre, ce qui se superpose, et surtout le moment ou l'audio est reveille.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as sonnerie from '../web/sonnerie.js';

const source = (nom) => readFileSync(new URL(`../web/${nom}`, import.meta.url), 'utf8');

// Le decodage de l'echantillon passe par des promesses : rendre la main au
// noyau vide la file des microtaches, sans quoi rien n'a encore ete joue.
const tourDeBoucle = () => new Promise((r) => setTimeout(r, 0));

// Un contexte audio factice : il enregistre les oscillateurs demarres, les
// echantillons lances, et son propre etat. Rien de plus.
function fauxContexte(etat = 'running') {
  const joues = [];
  const coups = [];
  return {
    state: etat,
    currentTime: 0,
    reveils: 0,
    joues,
    coups,
    resume() { this.state = 'running'; this.reveils++; },
    createOscillator() {
      const o = { type: null, frequency: { value: 0 }, connect() {}, start(t) { joues.push({ hz: o.frequency.value, a: t, type: o.type }); }, stop() {} };
      return o;
    },
    createGain() {
      return {
        gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
      };
    },
    createBufferSource() {
      const s = { buffer: null, connect() {}, start(t) { coups.push({ tampon: s.buffer, a: t }); } };
      return s;
    },
    decodeAudioData(octets) { return Promise.resolve({ decode: octets }); },
    destination: {},
  };
}

// Un sonneur cable sur un faux contexte et un faux telechargement. `octets`
// vaut null pour le cas ou le fichier ne repond pas.
function sonneurDeTest(ctx, octets = 'wav') {
  const demandes = [];
  const sonneur = sonnerie.creerSonneur({
    fabriquer: () => ctx,
    chercher: (url) => {
      demandes.push(url);
      return octets === null ? Promise.reject(new Error('404')) : Promise.resolve(octets);
    },
  });
  return { sonneur, demandes };
}

test('quatre sonneries, dont le silence, et aucune ne s eternise', () => {
  assert.deepEqual(sonnerie.SONNERIES.map((s) => s.cle), ['bip', 'cloche', 'sifflet', 'silence']);
  assert.equal(sonnerie.SONNERIE_PAR_DEFAUT, 'bip');

  for (const s of sonnerie.SONNERIES) {
    assert.notEqual(s.nom, '', s.cle);
    assert.notEqual(s.description, '', s.cle);
    // Au-dela d'une seconde et demie, ce n'est plus un signal, c'est une alarme
    // qu'on cherche a faire taire. La duree du sifflet compte celle du fichier,
    // pas seulement celle de son repli.
    assert.ok(sonnerie.dureeSonnerie(s.cle) <= 1.5, `${s.cle} dure ${sonnerie.dureeSonnerie(s.cle)} s`);
  }
  assert.ok(sonnerie.dureeSonnerie('sifflet') > sonnerie.SIFFLET.duree, 'les deux coups comptent, pas un seul');
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

test('le bip monte, et ses deux notes se suivent', () => {
  const ctx = fauxContexte();
  const { sonneur } = sonneurDeTest(ctx);

  assert.equal(sonneur.jouer('bip'), true);
  assert.equal(ctx.joues.length, 2);
  // La seconde note est PLUS HAUTE : deux notes identiques disent « attention »,
  // deux notes qui montent disent « c'est fini ».
  assert.ok(ctx.joues[1].hz > ctx.joues[0].hz, 'la seconde note doit monter');
  assert.ok(ctx.joues[0].a < ctx.joues[1].a, 'elles se suivent, elles ne se superposent pas');
  // Une sinusoide : un creneau grince dans un haut-parleur de telephone.
  assert.deepEqual([...new Set(ctx.joues.map((n) => n.type))], ['sine']);
});

test('la cloche frappe tous ses partiels au meme instant', () => {
  const ctx = fauxContexte();
  const { sonneur } = sonneurDeTest(ctx);

  assert.equal(sonneur.jouer('cloche'), true);
  assert.ok(ctx.joues.length >= 4, 'une seule sinusoide ne fait pas une cloche, elle fait un bip tenu');
  // TOUS AU MEME INSTANT : joues l'un apres l'autre, les memes partiels
  // feraient une gamme. C'est leur simultaneite qui fait entendre du metal.
  assert.deepEqual([...new Set(ctx.joues.map((n) => n.a))], [0]);
  assert.equal(Math.round(ctx.joues[0].hz), 1047, 'le fondamental est le premier');
  // Des rapports inharmoniques : des multiples entiers feraient un orgue.
  const rapports = ctx.joues.map((n) => n.hz / ctx.joues[0].hz);
  assert.ok(rapports.some((r) => Math.abs(r - Math.round(r)) > 0.1), 'aucun partiel desaccorde');
});

test('le sifflet joue l ENREGISTREMENT, deux coups espaces', async () => {
  // Trois sinusoides a 2100 Hz font un bip aigu, jamais un coup de sifflet :
  // ce qui fait le sifflet est le battement de la bille et le souffle.
  const ctx = fauxContexte();
  const { sonneur, demandes } = sonneurDeTest(ctx);

  assert.equal(sonneur.jouer('sifflet'), true);
  await tourDeBoucle();

  assert.deepEqual(demandes, [sonnerie.SIFFLET.fichier], 'le fichier est demande une fois');
  assert.equal(ctx.joues.length, 0, 'aucun oscillateur : le fichier a repondu');
  assert.equal(ctx.coups.length, sonnerie.SIFFLET.coups);
  assert.ok(ctx.coups.every((c) => c.tampon !== null), 'un coup lance sans tampon ne fait aucun bruit');
  // Espaces, jamais superposes : deux coups au meme instant ne font pas deux
  // coups de sifflet, ils font un coup deux fois plus fort.
  assert.ok(ctx.coups[1].a - ctx.coups[0].a >= sonnerie.SIFFLET.duree * 0.9);
});

test('le sifflet retombe sur des notes quand le fichier manque', async () => {
  // Un navigateur qui ne sait pas decoder, ou une premiere ouverture hors ligne
  // avant la mise en cache de la coque. Un minuteur muet a zero serait pire
  // qu'un sifflet approximatif.
  const ctx = fauxContexte();
  const { sonneur } = sonneurDeTest(ctx, null);

  assert.equal(sonneur.jouer('sifflet'), true, 'aucune exception, un vrai');
  await tourDeBoucle();

  assert.equal(ctx.coups.length, 0);
  assert.equal(ctx.joues.length, sonnerie.sonnerieDe('sifflet').notes.length, 'le repli synthetise a sonne');
});

test('le silence ne joue rien, et le dit', async () => {
  const ctx = fauxContexte();
  const { sonneur, demandes } = sonneurDeTest(ctx);
  assert.equal(sonneur.jouer('silence'), false);
  await tourDeBoucle();
  assert.equal(ctx.joues.length, 0);
  assert.equal(ctx.coups.length, 0);
  // Le silence ne reveille meme pas l'audio : il n'a rien a jouer, il n'a donc
  // rien a telecharger.
  assert.deepEqual(demandes, []);
});

test('un navigateur sans audio ne fait pas tomber le minuteur', () => {
  const sonneur = sonnerie.creerSonneur({ fabriquer: () => null });
  assert.equal(sonneur.preparer(), false);
  assert.equal(sonneur.jouer('bip'), false, 'aucune exception, un faux');
  assert.equal(sonneur.jouer('sifflet'), false);
});

test('preparer REVEILLE un contexte suspendu — sans quoi le telephone reste muet', async () => {
  // Un navigateur de telephone rend un contexte `suspended` tant que rien n'a
  // ete touche, et il ne leve pas d'erreur : il se tait. Le zero d'un rebours
  // n'etant pas un geste, c'est le tap de DEMARRAGE qui doit le reveiller.
  const ctx = fauxContexte('suspended');
  const { sonneur, demandes } = sonneurDeTest(ctx);

  assert.equal(sonneur.preparer(), true);
  assert.equal(ctx.reveils, 1);
  assert.equal(ctx.state, 'running');
  // Le meme geste va chercher le coup de sifflet : le zero est trop tard pour
  // decouvrir qu'il manque.
  await tourDeBoucle();
  assert.deepEqual(demandes, [sonnerie.SIFFLET.fichier]);

  // Le contexte n'est fabrique QU'UNE FOIS, et le fichier demande une seule
  // fois : en ouvrir un par exercice en ouvrirait cinquante-trois.
  let fabriques = 0;
  const compte = [];
  const unique = sonnerie.creerSonneur({
    fabriquer: () => { fabriques++; return fauxContexte(); },
    chercher: (url) => { compte.push(url); return Promise.resolve('wav'); },
  });
  unique.preparer(); unique.jouer('bip'); unique.preparer(); unique.jouer('sifflet');
  await tourDeBoucle();
  assert.equal(fabriques, 1);
  assert.equal(compte.length, 1, 'le fichier est telecharge une fois, pas a chaque coup');
});

test('la sonnerie choisie est celle qui sonne, sans qu on la nomme', () => {
  const ctx = fauxContexte();
  let choix = 'cloche';
  const sonneur = sonnerie.creerSonneur({ fabriquer: () => ctx, lire: () => choix, chercher: () => Promise.resolve('wav') });

  sonneur.jouer();
  assert.equal(Math.round(ctx.joues[0].hz), 1047, 'la cloche');

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
  // d'avance a l'audio, telechargement du sifflet compris.
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

  const sw = source('sw.js');
  assert.match(sw, /'\/sonnerie\.js'/);
  const css = source('style.css');
  for (const classe of ['.choix-sonnerie', '.ligne-sonnerie', '.case-sonnerie', '.nom-sonnerie']) {
    assert.ok(css.includes(classe), `${classe} manque dans style.css`);
  }
  assert.match(css, /\.ligne-sonnerie\b[^}]*min-height:\s*var\(--marcq-tap\)/s);
});

test('le seul fichier audio est livre par l application, jamais par un tiers', () => {
  // Le bip et la cloche restent synthetises : rien a telecharger pour eux. Le
  // sifflet est un enregistrement, en MEME ORIGINE — l'ossature §2 interdit le
  // domaine tiers, pas le fichier livre — et il est dans la coque hors ligne.
  const code = source('sonnerie.js');
  for (const interdit of ['new Audio(', 'http://', 'https://']) {
    assert.equal(code.includes(interdit), false, `« ${interdit} » n appartient pas a ce module`);
  }
  assert.match(code, /createOscillator\(\)/);
  assert.match(sonnerie.SIFFLET.fichier, /^\/[\w.-]+\.wav$/, 'un chemin absolu de meme origine');
  assert.match(source('sw.js'), /'\/sifflet\.wav'/, 'hors du cache, une seance sans reseau perdrait le sifflet');
});

// L'ecran de seance, prouve sans navigateur.
//
// Tout ce qui DECIDE quelque chose est dans le modele, donc teste ici. Ce qui
// reste — poser le modele dans le DOM — se verifie a la main, une fois, a la
// tache 5 : la CI n'a pas de navigateur et n'en aura pas, l'app n'ayant aucune
// dependance (ossature §2).
//
// L'import est un import d'espace de noms — `import * as vue` — et non des
// imports nommes : un export encore absent devient alors `undefined` et donne un
// TypeError sur l'appel, la ou un import nomme ferait echouer le CHARGEMENT du
// fichier entier et masquerait les tests deja verts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chargerProgramme } from '../web/domaine.js';
import * as vue from '../web/vue-seance.js';
import { modeleJour } from '../web/vue-jour.js';

const prog = chargerProgramme(JSON.parse(
  readFileSync(new URL('../web/programme.json', import.meta.url), 'utf8'),
));

const seanceDu = (date) => prog.seances.find((s) => s.date === date);

test('un bloc porte le nom que le coach lui a donne', () => {
  const [course, renforcement] = seanceDu('2026-08-03').blocs;
  assert.equal(vue.titreBloc(course), 'Course');
  assert.equal(vue.titreBloc(renforcement), 'Renforcement');
  // Un seul bloc du programme porte un titre a lui : le vendredi 7 aout, ou le
  // coach a ecrit « 30 a 40 minutes d'un autre sport » sans le ranger sous
  // « Course » (PRP 02, decision 2).
  assert.equal(vue.titreBloc(seanceDu('2026-08-07').blocs[0]), 'Autre sport');
});

test('le nombre de tours est affiche, jamais « 1 tour » (PRD §7.3)', () => {
  const [course, renforcement] = seanceDu('2026-08-03').blocs;
  assert.equal(vue.sousTitreBloc(course), '', 'un bloc a un tour n a rien a annoncer');
  assert.equal(vue.sousTitreBloc(renforcement), '2 tours · repos 1 min 30 entre les tours');
  // Les six autres seances n'ont pas de repos ecrit : le sous-titre s'arrete aux tours.
  assert.equal(vue.sousTitreBloc(seanceDu('2026-08-10').blocs[1]), '4 tours');
});

test('la date courte retire le jour de semaine, elle ne le recalcule pas', () => {
  assert.equal(vue.dateCourte('2026-08-05'), '5 août');
  assert.equal(vue.dateCourte('2026-08-01'), '1er août');
  assert.equal(vue.dateCourte('2026-08-17'), '17 août');
});

// Le contexte du contrat d'ecran (PRP 03), reduit a ce que le modele lit.
const contexte = (aujourdhui, faits = {}) => ({ prog, aujourdhui, prenom: 'Lucas', faits });

const T = '2026-08-03T18:22:11.000Z';

test('la liste est complete, groupee comme le coach l a ecrite (PRD §7.3)', () => {
  const m = vue.modeleSeance(contexte('2026-08-03'), '2026-08-03');
  assert.equal(m.titre, 'Endurance + Renforcement');
  assert.equal(m.semaine, 1);
  assert.equal(m.dateLisible, 'lundi 3 août');
  assert.deepEqual(m.blocs.map((b) => b.titre), ['Course', 'Renforcement']);
  assert.deepEqual(m.blocs.map((b) => b.exercices.length), [2, 6]);
  assert.equal(m.total, 8, 'les huit cases sont la avant de commencer');
  assert.equal(m.blocs[1].exercices[0].id, 's1-r1');
  assert.equal(m.blocs[1].exercices[0].libelle, '15 pompes');
});

test('la progression de la seance se lit en direct', () => {
  const m = vue.modeleSeance(contexte('2026-08-05', { 's1-r1': T, 's1-r2': T }), '2026-08-03');
  assert.equal(m.coches, 2);
  assert.equal(m.total, 8);
  assert.equal(m.part, 0.25);
  assert.deepEqual(m.blocs[1].exercices.map((e) => e.fait), [true, true, false, false, false, false]);
  assert.deepEqual(m.blocs[0].exercices.map((e) => e.fait), [false, false]);
});

test('l avenir ne se coche pas, et l ecran dit pourquoi (PRD §9)', () => {
  const m = vue.modeleSeance(contexte('2026-08-10'), '2026-08-12');
  assert.equal(m.cochable, false);
  assert.equal(m.motif, 'Séance à venir. Elle s’ouvrira mercredi 12 août.');
  assert.equal(m.total, 7, 'elle reste entierement lisible : on vient lire ce qui arrive');
});

test('le passe se rattrape jusqu a la fin du programme (PRD §9)', () => {
  for (const jour of ['2026-08-03', '2026-08-10', '2026-08-21']) {
    const m = vue.modeleSeance(contexte(jour), '2026-08-03');
    assert.equal(m.cochable, true, `le 3 aout se coche encore le ${jour}`);
    assert.equal(m.motif, null);
  }
});

test('apres le 21 aout, plus rien ne se coche (PRD §9)', () => {
  const m = vue.modeleSeance(contexte('2026-08-22'), '2026-08-03');
  assert.equal(m.cochable, false);
  assert.equal(m.motif, 'Le programme est terminé. Rien ne se coche plus.');
});

test('le verrou et son motif disent toujours la meme chose', () => {
  // L'invariant qui compte : une case fermee sans phrase, ou une phrase sur un
  // ecran ouvert, sont deux facons de mentir a l'enfant.
  for (const seance of prog.seances) {
    for (const jour of ['2026-08-01', '2026-08-10', '2026-08-21', '2026-08-22']) {
      const m = vue.modeleSeance(contexte(jour), seance.date);
      assert.equal(m.motif === null, m.cochable, `${seance.date} vu le ${jour}`);
    }
  }
});

test('un jour sans seance n a pas de modele', () => {
  assert.equal(vue.modeleSeance(contexte('2026-08-10'), '2026-08-04'), null);
  assert.equal(vue.modeleSeance(contexte('2026-08-10'), null), null);
});

test('chaque seance connait ses deux voisines', () => {
  assert.deepEqual(vue.voisines(prog, '2026-08-14'), {
    precedente: '2026-08-12',
    suivante: '2026-08-17',
  });
  // Depuis un jour de repos aussi : les voisines sont les seances qui
  // l'encadrent, ce qui rendra le calendrier du PRP 05 navigable sans cas
  // particulier.
  assert.deepEqual(vue.voisines(prog, '2026-08-04'), {
    precedente: '2026-08-03',
    suivante: '2026-08-05',
  });
});

test('les bords du programme n inventent pas de voisine', () => {
  assert.deepEqual(vue.voisines(prog, '2026-08-03'), { precedente: null, suivante: '2026-08-05' });
  assert.deepEqual(vue.voisines(prog, '2026-08-17'), { precedente: '2026-08-14', suivante: null });
  assert.deepEqual(vue.voisines(prog, '2026-08-21'), { precedente: '2026-08-17', suivante: null });
  assert.deepEqual(vue.voisines(prog, '2026-08-01'), { precedente: null, suivante: '2026-08-03' });
});

// Node n'expose `localStorage` que derriere un drapeau. Le double est ecrit ici
// plutot qu'importe de tests/etat.test.js : y toucher pour l'exporter
// modifierait le fichier d'un autre PRP sans rien gagner, et douze lignes se
// relisent plus vite qu'une dependance entre fichiers de test.
function poserMagasin() {
  const donnees = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      get length() { return donnees.size; },
      key(i) { return [...donnees.keys()][i] ?? null; },
      getItem(cle) { return donnees.has(cle) ? donnees.get(cle) : null; },
      setItem(cle, valeur) { donnees.set(String(cle), String(valeur)); },
      removeItem(cle) { donnees.delete(cle); },
    },
  });
  return donnees;
}

test('un tap ecrit immediatement, pas a la sortie d ecran (PRD §6, lot 1, point 6)', () => {
  const donnees = poserMagasin();

  const apres = vue.basculerFait({}, 's1-r1', T);
  assert.deepEqual(apres, { 's1-r1': T }, 'les faits a jour sont RENDUS, jamais mutes sur place');
  // Ce qui compte : le stockage est deja a jour, avant tout changement d'ecran.
  assert.deepEqual(JSON.parse(donnees.get('marcq.v1.faits')), { 's1-r1': T });
});

test('decocher coute un tap et efface la cle (PRD §7.3)', () => {
  const donnees = poserMagasin();

  const coche = vue.basculerFait({}, 's1-r1', T);
  const decoche = vue.basculerFait(coche, 's1-r1');
  assert.deepEqual(decoche, {});
  assert.deepEqual(JSON.parse(donnees.get('marcq.v1.faits')), {});
});

test('l objet recu n est jamais mute (regle 1 du contrat d ecran)', () => {
  poserMagasin();
  const depart = { 's1-r1': T };
  vue.basculerFait(depart, 's1-r2', T);
  assert.deepEqual(depart, { 's1-r1': T }, 'ctx.faits doit survivre intact au tap');
});

const source = readFileSync(new URL('../web/vue-seance.js', import.meta.url), 'utf8');

test('la route d une seance porte sa date', () => {
  assert.equal(vue.dateDeLaRoute('#/seance/2026-08-03'), '2026-08-03');
  assert.equal(vue.dateDeLaRoute('#/seance/2026-08-17'), '2026-08-17');
});

test('une date impossible n atteint jamais le rendu', () => {
  for (const route of [
    '#/seance/2026-13-45', '#/seance/2026-00-10', '#/seance/2026-08-32',
    '#/seance/2026-8-3', '#/seance/', '#/seance/2026-08-03/', '#/perso', '#/', '',
  ]) {
    assert.equal(vue.dateDeLaRoute(route), null, route);
    assert.equal(vue.MOTIF_SEANCE.test(route), false, route);
  }
});

test('la vue accroche le PRP 06 par deux evenements nommes', () => {
  // Le PRP 06 ecoute ces deux noms sur `document` pour poser ses animations sans
  // toucher a ce fichier. Les renommer casserait les recompenses sans casser un
  // seul test de comportement : d'ou cette assertion.
  assert.equal(vue.EVT_COCHAGE, 'marcq:exercice-coche');
  assert.equal(vue.EVT_SEANCE_COMPLETE, 'marcq:seance-complete');
  // bubbles : sans quoi un ecouteur pose sur `document` ne verrait jamais rien.
  assert.match(source, /bubbles:\s*true/, 'les evenements doivent remonter');
});

test('aucun dialogue ne s interpose entre le tap et le decochage (PRD §7.3)', () => {
  for (const interdit of ['confirm(', 'alert(', 'prompt(']) {
    assert.equal(
      source.includes(interdit),
      false,
      `${interdit} : l erreur de tap doit couter un tap, pas un dialogue`,
    );
  }
});

test('la vue ne compose jamais de HTML a partir du programme', () => {
  // programme.json est une donnee editable a la main : un libelle contenant un
  // chevron casserait la page, ou pire.
  assert.equal(source.includes('innerHTML'), false, 'le texte passe par textContent');
});

test('le lien de l ecran du jour correspond a la route de la seance', () => {
  // Le PRP 03 pose ce lien, le PRP 04 pose la route. Rien d'autre ne verifie
  // qu'ils parlent de la meme chose — et l'ecart se solderait par un retour
  // silencieux a l'ecran du jour.
  const m = modeleJour({ prog, aujourdhui: '2026-08-03', prenom: 'Lucas', faits: {} });
  assert.ok(m.lien, 'l ecran du jour propose bien d ouvrir la seance');
  assert.match(m.lien.href, vue.MOTIF_SEANCE);
});

test('le service worker met l ecran de seance en cache', () => {
  // Une seance se coche entierement hors ligne (PRD §11). Sans cette entree, le
  // premier passage hors ligne sur une seance jamais ouverte echoue — et rien
  // ne le signale tant qu'on est connecte.
  assert.match(
    readFileSync(new URL('../web/sw.js', import.meta.url), 'utf8'),
    /'\/vue-seance\.js'/,
    'ajoute /vue-seance.js a la liste de coque de sw.js',
  );
});

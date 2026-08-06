// Les recompenses, prouvees sans navigateur.
//
// Ce qui DECIDE quelque chose — la preference du systeme, la valeur d'un
// compteur en cours de route, ce que le panneau annonce — est pur et teste ici.
// Ce qui reste est de l'assemblage d'elements, verifie a la main aux taches 5
// et 6 : la CI n'a pas de navigateur et n'en aura pas, l'app n'ayant aucune
// dependance (ossature §2).
//
// L'import est un import d'espace de noms — `import * as rec` — et non des
// imports nommes : un export encore absent devient alors `undefined` et donne un
// TypeError sur l'appel, la ou un import nomme ferait echouer le CHARGEMENT du
// fichier entier et masquerait les tests deja verts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chargerProgramme, totauxAccomplis } from '../web/domaine.js';
import * as rec from '../web/recompenses.js';

const lire = (nom) => readFileSync(new URL(`../web/${nom}`, import.meta.url), 'utf8');
const css = lire('style.css');

// Une fenetre qui repond ce qu'on lui dit, et qui verifie au passage qu'on lui
// pose LA bonne question : une faute de frappe dans la requete media rendrait
// `matches` toujours faux, sans qu'aucun symptome n'apparaisse.
const fenetreQuiRepond = (matches) => ({
  matchMedia(requete) {
    assert.equal(requete, rec.REQUETE_MOUVEMENT_REDUIT, 'requete media inattendue');
    return { matches };
  },
});

test('la preference du systeme est lue, pas devinee (PRD §10)', () => {
  assert.equal(rec.mouvementReduit(fenetreQuiRepond(true)), true);
  assert.equal(rec.mouvementReduit(fenetreQuiRepond(false)), false);
});

test('un navigateur sans matchMedia n est pas prive d animation', () => {
  // L'absence de matchMedia ne veut pas dire « mouvement reduit », elle veut
  // dire « on ne sait pas ». Le second appel prouve en plus que le module se
  // charge sous Node sans toucher au DOM.
  assert.equal(rec.mouvementReduit({}), false);
  assert.equal(rec.mouvementReduit(), false);
});

test('style.css neutralise tout mouvement quand le systeme le demande (PRD §10)', () => {
  // Un seul bloc dans toute la feuille. Le PRP 01 en avait pose un ; ce PRP le
  // REMPLACE. En laisser deux serait le pire cas : la recherche ci-dessous
  // extrait le premier, les assertions porteraient sur le bloc du PRP 01, et
  // l'echec ne designerait pas le fichier fautif. On le verrouille ici plutot
  // que de le recommander en prose.
  const blocs = css.match(/@media \(prefers-reduced-motion: reduce\)/g) || [];
  assert.equal(blocs.length, 1,
    `style.css doit porter exactement un bloc de mouvement reduit, ${blocs.length} trouve(s) — celui du PRP 01 a-t-il ete supprime ?`);

  const bloc = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(css);
  assert.ok(bloc, 'le bloc prefers-reduced-motion manque dans style.css');
  // Les deux proprietes, pas une seule : une transition oubliee suffit a faire
  // bouger un ecran qu'on a demande immobile.
  assert.match(bloc[1], /animation-duration:\s*\.001ms\s*!important/);
  assert.match(bloc[1], /transition-duration:\s*\.001ms\s*!important/);
  assert.match(bloc[1], /animation-iteration-count:\s*1\s*!important/);
});

test('cocher fait rebondir la barre et barre la ligne, sans une ligne de JavaScript', () => {
  assert.match(
    css,
    /\.barre::-webkit-progress-value\s*\{[^}]*transition:/,
    'le remplissage de la barre doit rebondir, pas sauter',
  );
  // Le trait existe des le depart, en transparent : c'est sa COULEUR qui
  // s'anime. Un trait qui pousse de gauche a droite se casse des que le libelle
  // passe sur deux lignes, ce qui arrive au premier telephone etroit.
  assert.match(css, /\.libelle-exercice\s*\{[^}]*text-decoration-color:\s*transparent/);
  assert.match(css, /\.libelle-exercice\s*\{[^}]*transition:[^};]*text-decoration-color/);
});

// Toutes les durees de transition du fichier, en millisecondes.
const dureesDeTransition = () =>
  [...css.matchAll(/transition(?:-duration)?:([^;}]*)/g)]
    .flatMap(([, declaration]) => [...declaration.matchAll(/([\d.]+)(ms|s)\b/g)])
    .map(([, nombre, unite]) => Number(nombre) * (unite === 's' ? 1000 : 1));

test('aucune transition ne depasse 400 ms — premier interdit du PRD §10', () => {
  const durees = dureesDeTransition();
  assert.ok(durees.length >= 3, 'la lecture de style.css a echoue si le compte est bas');
  for (const ms of durees) {
    assert.ok(ms <= 400, `une transition de ${ms} ms retarde la main de l enfant`);
  }
});

test('rien ne bouge tout seul : aucune animation ne boucle — deuxieme interdit', () => {
  // Une animation en boucle est du mouvement pendant l'effort, sur un ecran que
  // personne n'a touche. C'est la moitie testable du deuxieme interdit ; l'autre
  // se constate a la tache 5.
  assert.equal(css.includes('infinite'), false, 'aucune animation ne doit tourner en boucle');
});

test('valeurRoulee part du depart et arrive exactement a l arrivee', () => {
  assert.equal(rec.valeurRoulee(100, 140, 0), 100);
  assert.equal(rec.valeurRoulee(100, 140, 1), 140, 'jamais 139 par arrondi');
  assert.equal(rec.valeurRoulee(0, 226, 1), 226);
});

test('valeurRoulee borne la part : jamais avant le depart, jamais apres l arrivee', () => {
  assert.equal(rec.valeurRoulee(100, 140, -1), 100);
  assert.equal(rec.valeurRoulee(100, 140, 2), 140);
});

test('un compteur passe par des valeurs intermediaires, croissantes et entieres', () => {
  let precedent = 100;
  for (let i = 1; i <= 20; i += 1) {
    const valeur = rec.valeurRoulee(100, 140, i / 20);
    assert.ok(Number.isInteger(valeur), `un compteur affiche des entiers, vu ${valeur}`);
    assert.ok(valeur >= precedent, `un compteur ne recule pas : ${precedent} -> ${valeur}`);
    precedent = valeur;
  }
  assert.equal(precedent, 140);
});

test('rouler avance image par image, puis s arrete', () => {
  const noeud = { textContent: '' };
  const images = [];
  let horloge = 0;

  const annuler = rec.rouler(noeud, 100, 140, {
    duree: 400,
    reduit: false,
    planifier: (rappel) => images.push(rappel),
    maintenant: () => horloge,
  });

  assert.equal(noeud.textContent, '100', 'il part de la valeur d avant, pas de zero');
  horloge = 200;
  images.pop()();
  const milieu = Number(noeud.textContent);
  assert.ok(milieu > 100 && milieu < 140, `valeur intermediaire attendue, vu ${milieu}`);

  horloge = 400;
  images.pop()();
  assert.equal(noeud.textContent, '140');
  assert.equal(images.length, 0, 'la boucle ne redemande pas d image apres l arrivee');
  annuler();
});

test('mouvement reduit : le compteur affiche sa valeur, sans demander une seule image', () => {
  // Le troisieme interdit du PRD §10, prouve. Le CSS ne suffirait pas : une
  // boucle requestAnimationFrame reste une boucle meme quand les transitions
  // durent une microseconde.
  const noeud = { textContent: '' };
  let demandes = 0;
  rec.rouler(noeud, 100, 140, { reduit: true, planifier: () => { demandes += 1; } });
  assert.equal(noeud.textContent, '140');
  assert.equal(demandes, 0);
});

const prog = chargerProgramme(JSON.parse(lire('programme.json')));
const T = '2026-08-03T18:22:11.000Z';

const idsDe = (date) =>
  prog.seances.find((s) => s.date === date).blocs.flatMap((b) => b.exercices.map((e) => e.id));
const faitsDe = (dates) => Object.fromEntries(dates.flatMap(idsDe).map((id) => [id, T]));
const toutesLesDates = prog.seances.map((s) => s.date);

test('une seance n est terminee que si toutes ses cases sont tombees', () => {
  assert.equal(rec.seancesTerminees(prog, {}), 0);
  assert.equal(rec.seancesTerminees(prog, faitsDe(['2026-08-03'])), 1);
  assert.equal(rec.seancesTerminees(prog, faitsDe(['2026-08-03', '2026-08-12'])), 2);
  assert.equal(rec.seancesTerminees(prog, faitsDe(toutesLesDates)), 7);

  const presque = faitsDe(['2026-08-03']);
  delete presque[idsDe('2026-08-03').at(-1)];
  assert.equal(rec.seancesTerminees(prog, presque), 0, 'une seule case manquante suffit');
});

test('faitsSansSeance retire une seance, et ne mute pas ce qu on lui donne', () => {
  const faits = faitsDe(['2026-08-03', '2026-08-05']);
  const sans = rec.faitsSansSeance(prog, faits, '2026-08-05');

  assert.equal('s1-r1' in sans, true, 'la seance du 3 aout reste entiere');
  for (const id of idsDe('2026-08-05')) {
    assert.equal(id in sans, false, `${id} devait sortir`);
  }
  assert.equal(Object.keys(faits).length, Object.keys(faitsDe(['2026-08-03', '2026-08-05'])).length,
    'l objet recu survit intact');
  // Une date sans seance ne retire rien plutot que de lever : l'evenement vient
  // de notre propre code, mais un appel egare ne doit pas casser la page.
  assert.deepEqual(rec.faitsSansSeance(prog, faits, '2026-08-04'), faits);
});

test('les compteurs du panneau sont calcules, jamais recopies (PRD §8)', () => {
  const faits = faitsDe(toutesLesDates);
  const resume = rec.resumeDeFin(prog, faits);
  const totaux = totauxAccomplis(prog, faits);

  assert.equal(resume.seances, 7);
  assert.equal(resume.seancesTotal, 7, 'le total vient du fichier, pas d une constante');
  for (const compteur of resume.compteurs) {
    assert.equal(compteur.valeur, totaux[compteur.cle], `${compteur.cle} doit venir du domaine`);
  }
  // Programme entierement coche : les totaux prescrits de l'ossature §4. Cette
  // assertion relie le panneau au fichier de donnees d'un bout a l'autre.
  assert.deepEqual(
    resume.compteurs.map((c) => [c.cle, c.valeur]),
    [['pompes', 226], ['squats', 345], ['burpees', 105], ['min_course', 235]],
  );
});

test('un compteur a zero ne s affiche pas', () => {
  // Une seule case cochee — « 15 pompes », deux tours, donc 30. Afficher
  // « 0 burpees » a cet instant n'apprend rien et donne l'impression d'un
  // tableau de bord vide.
  const resume = rec.resumeDeFin(prog, { 's1-r1': T });
  assert.deepEqual(resume.compteurs, [{ cle: 'pompes', libelle: 'pompes', valeur: 30 }]);
  assert.equal(resume.seances, 0);
});

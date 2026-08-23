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
import { AVERTISSEMENT_SAUVEGARDE, CONFIRMATION_SUPPRESSION_PROFIL } from '../web/vue-reglages.js';
import { ECRANS, LIENS, choisirEcran } from '../web/app.js';

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
  // Rien de coche : la phrase le dit sans chiffre, rien a comparer.
  assert.equal(m.phrase, 'Pas encore commencée');
});

test('seance entamee : on reprend, on ne recommence pas', () => {
  const m = modeleJour(contexte('2026-08-03', { 's1-r1': '2026-08-03T18:22:11.000Z' }));
  assert.equal(m.lien.texte, 'Reprendre la séance');
  assert.equal(m.etat.coches, 1);
  // En cours : la phrase ne compte plus ce qui est fait mais ce qui reste
  // (critique du 22 aout, §P2, variante C) — 8 - 1 = 7. Le total, lui, reste
  // ecrit une seule fois, dans `details` au-dessus.
  assert.equal(m.phrase, 'Il t’en reste 7');
  // L'oeil et la voix ne divergent pas : la barre annonce le meme texte.
  assert.equal(m.texteVoix, m.phrase);
});

test('seance bien avancee : la phrase dit ce qui reste, jamais ce qui est deja ecrit dans details', () => {
  const faits = Object.fromEntries(
    ['s1-c1', 's1-c2', 's1-r1'].map((id) => [id, '2026-08-03T18:22:11.000Z']),
  );
  const m = modeleJour(contexte('2026-08-03', faits));
  assert.equal(m.etat.coches, 3);
  assert.equal(m.details, '8 exercices · lundi 3 août', 'details garde le total, une seule fois sur l ecran');
  assert.equal(m.phrase, 'Il t’en reste 5');
  assert.equal(m.texteVoix, 'Il t’en reste 5');
  assert.equal(m.lien.texte, 'Reprendre la séance');
});

// Le singulier : « reste » ne s'accorde qu'avec « il », jamais avec ce qu'il
// compte, donc aucun accord a gerer — mais un test le dit, plutot que de le
// supposer.
test('un seul exercice restant : « Il t’en reste 1 », pas de pluriel invente', () => {
  const tousSaufUn = ['s1-c1', 's1-c2', 's1-r1', 's1-r2', 's1-r3', 's1-r4', 's1-r5'];
  const faits = Object.fromEntries(tousSaufUn.map((id) => [id, '2026-08-03T18:22:11.000Z']));
  const m = modeleJour(contexte('2026-08-03', faits));
  assert.equal(m.etat.coches, 7);
  assert.equal(m.etat.total, 8);
  assert.equal(m.phrase, 'Il t’en reste 1');
  assert.equal(m.texteVoix, 'Il t’en reste 1');
});

// Le defaut d'origine (critique du 2026-08-22, §P2) : a 7 sur 7 (ici 8 sur 8),
// l'ecran etait IDENTIQUE a 0 sur 8 — meme phrase de bouton, aucune phrase ne
// disait « fini ». Cette branche etait invisible : aucun test ne la nommait.
test('seance finie, une autre suit dans le programme : le bloc bleu pointe vers elle', () => {
  const tousLesExercices = ['s1-c1', 's1-c2', 's1-r1', 's1-r2', 's1-r3', 's1-r4', 's1-r5', 's1-r6'];
  const faits = Object.fromEntries(tousLesExercices.map((id) => [id, '2026-08-03T18:22:11.000Z']));
  const finie = modeleJour(contexte('2026-08-03', faits));
  const jamaisCommencee = modeleJour(contexte('2026-08-03'));

  assert.equal(finie.etat.coches, finie.etat.total, 'les 8 exercices sont coches');
  assert.equal(finie.etat.statut, 'faite');
  assert.equal(finie.phrase, 'Séance terminée');
  // Ce n'est plus « Revoir la séance » — le bloc bleu ne dit plus « va faire
  // ta seance » une fois qu'elle est faite (critique du 22 aout, §P2, variante
  // C) : il pointe vers la prochaine seance du programme, sans date inventee.
  assert.deepEqual(finie.lien, { texte: 'Prochaine séance : mercredi 5 août', href: '#/seance/2026-08-05' });

  // Le defaut precis : un ecran a 7/7 (ici 8/8) ne doit RIEN afficher de commun
  // avec un ecran a 0/7, ni le mot du bouton ni la phrase — c'etait pourtant
  // exactement le cas avant ce correctif.
  assert.notEqual(finie.lien.texte, jamaisCommencee.lien.texte);
  assert.notEqual(finie.phrase, jamaisCommencee.phrase);
});

// Le cas que la critique laissait ouvert : plus aucune seance apres celle du
// jour (17 aout, la derniere du programme de web/programme.json — le
// programme continue jusqu'au 21, mais plus aucune seance n'y est plannifiee).
// Rien n'invente une date : le bloc bleu retombe sur son comportement
// d'origine, relire la seance du jour.
test('derniere seance du programme, finie : aucune date inventee, on relit la seance', () => {
  const derniere = prog.seances.at(-1);
  assert.equal(prog.seances.some((s) => s.date > derniere.date), false, 'verifie que c est bien la derniere');

  const faits = {};
  for (const bloc of derniere.blocs) {
    for (const ex of bloc.exercices) faits[ex.id] = '2026-08-17T18:22:11.000Z';
  }
  const m = modeleJour({ prog, aujourdhui: derniere.date, prenom: 'Lucas', faits });
  assert.equal(m.cas, 'aujourd-hui');
  assert.equal(m.phrase, 'Séance terminée');
  assert.deepEqual(m.lien, { texte: 'Revoir la séance', href: `#/seance/${derniere.date}` });
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

test('les phrases que le PRD fixe sont intactes', () => {
  // PRD §14 : le risque est « assume et annonce ».
  assert.match(AVERTISSEMENT_SAUVEGARDE, /pas de compte, donc pas de sauvegarde/);
  assert.match(AVERTISSEMENT_SAUVEGARDE, /perdue/);
  // PRD §7.2 : « le second repart a zero et le dit clairement avant d'agir ».
  assert.match(CONFIRMATION_SUPPRESSION_PROFIL, /efface le prénom et toute la progression/);
  assert.match(CONFIRMATION_SUPPRESSION_PROFIL, /\?$/, 'une confirmation pose une question');
});

test('les deux gestes des reglages sont distincts (PRD §7.2)', () => {
  const code = source('vue-reglages.js');
  // Corriger le prenom n'appelle que `ecrirePrenom` : la progression vit sous
  // une autre cle et n'est meme pas lue.
  assert.ok(code.includes('ecrirePrenom('), 'le premier geste ecrit le prenom');
  // Supprimer son profil efface tout, et jamais sans confirmation.
  assert.ok(code.includes('toutEffacer()'), 'le second geste efface tout');
  // La question posee gagne une phrase quand un nom au classement part avec le
  // reste, mais elle part toujours de CONFIRMATION_SUPPRESSION_PROFIL et elle
  // passe toujours avant l'effacement.
  assert.ok(code.includes('CONFIRMATION_SUPPRESSION_PROFIL'), 'la phrase du PRD est celle qui est posee');
  assert.ok(
    /confirm\(question\)/.test(code),
    'toutEffacer n est jamais atteint sans confirmation',
  );
  assert.ok(
    code.indexOf('confirm(question)') < code.indexOf('toutEffacer()'),
    'la confirmation vient avant l effacement',
  );
});

test('la coque porte l hote des ecrans, la navigation et le module d amorcage', () => {
  const coque = source('index.html');
  assert.match(coque, /<html lang="fr">/);
  assert.match(coque, /<main id="ecran"/, 'le point de montage des ecrans');
  assert.match(coque, /<nav id="nav"[^>]*hidden/, 'la navigation est masquee avant le prenom');
  assert.match(coque, /<script type="module" src="\/app\.js">/, 'un module ES, servi a la racine');
  assert.match(coque, /<link rel="stylesheet" href="\/style\.css">/);
  // Ossature §2 : aucun asset distant, la page est publique et ne charge que sa
  // propre origine.
  assert.equal(/(src|href)="(https?:)?\/\//.test(coque), false, 'aucune ressource distante');
});

test('le routeur connait les ecrans de ce lot, et rejette les autres', () => {
  assert.deepEqual(ECRANS.map((e) => e.nom), ['reglages', 'seance', 'perso', 'equipe', 'rejoindre', 'coach', 'bilan', 'jour']);
  assert.equal(choisirEcran('#/').nom, 'jour');
  assert.equal(choisirEcran('').nom, 'jour', 'une adresse sans ancre ouvre le jour');
  assert.equal(choisirEcran('#').nom, 'jour');
  assert.equal(choisirEcran('#/reglages').nom, 'reglages');
  assert.equal(choisirEcran('#/seance/2026-08-03').nom, 'seance');
  assert.equal(choisirEcran('#/seance/2026-13-45'), null, 'une date impossible reste inconnue');
  assert.equal(choisirEcran('#/perso').nom, 'perso');
  assert.equal(choisirEcran('#/equipe').nom, 'equipe');
  assert.equal(choisirEcran('#/equipe/'), null, 'le motif est exact');
  assert.equal(choisirEcran('#/rejoindre').nom, 'rejoindre');
  assert.equal(choisirEcran('#/coach').nom, 'coach');
  assert.equal(choisirEcran('#/coach/'), null, 'le motif est exact');
  assert.equal(choisirEcran('#/bilan').nom, 'bilan');
  assert.equal(choisirEcran('#/bilan/'), null);
  assert.equal(choisirEcran('#/nimporte-quoi'), null);

  // Un seul ecran traverse le verrou de prenom, et c'est celui du coach : il ne
  // lit rien du telephone. Le jour ou un second le merite, cette assertion le
  // fait remarquer.
  assert.deepEqual(ECRANS.filter((e) => e.sansPrenom === true).map((e) => e.nom), ['coach']);

  // Un onglet vers l'ecran de LECTURE de l'equipe, et c'est tout : podium,
  // position, jauge, et le bouton qui mene au consentement. Il a fallu le poser
  // parce que ce bloc, au bas de « Ma progression », etait derriere un
  // calendrier de dix-neuf jours a derouler.
  assert.deepEqual(
    LIENS.map((l) => l.href),
    ['#/', '#/perso', '#/equipe', '#/reglages'],
    'l onglet de l equipe vient apres la progression, avant les reglages',
  );

  // AUCUN onglet vers le consentement : un onglet permanent en ferait un ecran
  // d'accueil de plus, exactement ce que le PRD §7.4 refuse. On y arrive par le
  // bouton de #/equipe, « au moment ou il y a un vrai choix a faire ». C'est
  // toute la difference entre l'onglet ci-dessus et celui-ci : le premier mene a
  // ce qu'on regarde, le second aurait mene a ce qu'on decide.
  assert.equal(LIENS.some((l) => l.href.includes('rejoindre')), false);
  // Ni vers la page du coach : un onglet permanent mettrait sa vue dans la
  // barre de navigation des enfants.
  assert.equal(LIENS.some((l) => l.href.includes('coach')), false);
  // Ni vers le bilan : un onglet pose des le 3 aout serait un lien vers un ecran
  // vide pendant dix-neuf jours, et le faire apparaitre un jour donne remettrait
  // une seconde regle de date dans le routeur.
  assert.equal(LIENS.some((l) => l.href.includes('bilan')), false);
});

test('toute classe posee par un ecran existe dans style.css', () => {
  const css = source('style.css');
  const classes = new Set();
  const fichiers = ['app.js', 'vue-prenom.js', 'vue-jour.js', 'vue-reglages.js',
    'vue-seance.js', 'vue-perso.js', 'vue-rejoindre.js', 'vue-classement.js'];
  for (const nom of fichiers) {
    const code = source(nom);
    const avant = classes.size;
    // Deux ecritures a lire, et il faut les deux : l'affectation litterale
    // `className = '...'`, et l'appel au raccourci `el('tag', 'classes')` que
    // les ecrans du PRP 04 et suivants utilisent. Ne lire que la premiere
    // rendrait ce test VIDE sur un ecran qui passe par le raccourci — il
    // passerait sans rien verifier, ce qui est pire que de ne pas exister.
    for (const motif of [/\.className\s*=\s*'([^']*)'/g, /\bel\(\s*'[a-z]+'\s*,\s*'([^']*)'/g]) {
      for (const [, liste] of code.matchAll(motif)) {
        for (const classe of liste.split(/\s+/).filter(Boolean)) classes.add(classe);
      }
    }
    // FICHIER PAR FICHIER, et pas seulement en total : un ecran dont on ne lit
    // aucune classe passe ce test sans rien verifier, et c'est le pire mode de
    // defaillance d'un garde-fou — il ne se tait pas, il rassure. Le seuil
    // global d'en dessous ne l'a pas vu pendant quatre PRP.
    assert.ok(classes.size > avant, `aucune classe lue dans ${nom} : le motif a cesse de correspondre`);
  }
  assert.ok(classes.size >= 20, 'la lecture des sources a echoue si le compte est bas');
  // Les noms construits par gabarit, que les motifs ci-dessus ne peuvent pas
  // voir : ils s'ecrivent ici a la main.
  const parGabarit = ['cas-aujourd-hui', 'cas-repos', 'cas-terminee',
    'etat-a-jour', 'etat-en-attente', 'etat-hors-ligne', 'etat-jamais', 'etat-echec'];
  for (const classe of [...classes, ...parGabarit]) {
    assert.ok(css.includes(`.${classe}`), `.${classe} manque dans style.css`);
  }
});

test('les zones de tap et la taille du champ tiennent la promesse du PRD §11', () => {
  const css = source('style.css');
  assert.match(css, /--marcq-tap:\s*4[8-9]px|--marcq-tap:\s*5\dpx/, 'au moins 48 px de tap');
  // En dessous de 16 px, iOS zoome a la mise au point et l'ecran part de travers.
  assert.match(css, /\.champ\b[^}]*font-size:\s*1[7-9]px/s);
  assert.match(
    css,
    /\.bouton\b[^}]*min-height:\s*var\(--marcq-tap\)/s,
    'un bouton occupe une zone de tap pleine',
  );
});

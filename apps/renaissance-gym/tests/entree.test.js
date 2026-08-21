// tests/entree.test.js — les trois écrans d'entrée (PRP 03).
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as vueEntree from '../web/vue-entree.js';
import * as etat from '../web/etat.js';
import { poserDocumentFactice, creerHote } from './dom-factice.js';

const source = readFileSync(new URL('../web/vue-entree.js', import.meta.url), 'utf8');
const product = readFileSync(new URL('../PRODUCT.md', import.meta.url), 'utf8');

function poserMagasin(magasin) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: magasin });
}
function fauxMagasin(initial = {}) {
  const donnees = new Map(Object.entries(initial));
  return {
    get length() { return donnees.size; },
    key(i) { return [...donnees.keys()][i] ?? null; },
    getItem(cle) { return donnees.has(cle) ? donnees.get(cle) : null; },
    setItem(cle, valeur) { donnees.set(String(cle), String(valeur)); },
    removeItem(cle) { donnees.delete(cle); },
    contenu() { return Object.fromEntries(donnees); },
  };
}

beforeEach(() => {
  poserMagasin(fauxMagasin());
  etat.effacerEtat();
  poserDocumentFactice();
  globalThis.location = { hash: '' };
});

function ctxDe(extra = {}) {
  return { maintenant: () => new Date('2026-08-14T09:00:00.000Z'), ...extra };
}

function saisirCode(cases, chaine) {
  chaine.split('').forEach((chiffre, i) => { cases[i].value = chiffre; });
}

// --- 200 prénoms courants (fixture de test, PRP 03 : « aucun ne figure dans
// une liste de 200 prénoms courants »). --------------------------------------
const PRENOMS = [
  'Marie', 'Sophie', 'Camille', 'Emma', 'Léa', 'Chloé', 'Manon', 'Inès', 'Sarah', 'Julie',
  'Laura', 'Anna', 'Lucie', 'Clara', 'Louise', 'Alice', 'Jade', 'Zoé', 'Lola', 'Nina',
  'Eva', 'Lisa', 'Elsa', 'Margaux', 'Charlotte', 'Juliette', 'Pauline', 'Céline', 'Aurore', 'Amélie',
  'Claire', 'Élise', 'Émilie', 'Estelle', 'Fanny', 'Gabrielle', 'Hélène', 'Iris', 'Jeanne', 'Justine',
  'Karine', 'Laurie', 'Marion', 'Nadia', 'Ophélie', 'Perrine', 'Quitterie', 'Romane', 'Salomé', 'Tiphaine',
  'Ursule', 'Valentine', 'Wendy', 'Yasmine', 'Zélie', 'Adèle', 'Béatrice', 'Constance', 'Delphine', 'Élodie',
  'Florence', 'Ghislaine', 'Huguette', 'Isabelle', 'Josiane', 'Karen', 'Laëtitia', 'Muriel', 'Nathalie', 'Océane',
  'Priscilla', 'Roxane', 'Sabine', 'Thérèse', 'Ursula', 'Véronique', 'Wanda', 'Xaviera', 'Yolande', 'Zoélie',
  'Agathe', 'Blanche', 'Coralie', 'Dorothée', 'Émeline', 'Faustine', 'Gaëlle', 'Honorine', 'Imane', 'Judith',
  'Kenza', 'Lorraine', 'Mathilde', 'Noémie', 'Odile', 'Prune', 'Rachel', 'Solène', 'Tatiana', 'Uranie',
  'Lucas', 'Hugo', 'Louis', 'Gabriel', 'Arthur', 'Jules', 'Adam', 'Raphaël', 'Nathan', 'Léo',
  'Ethan', 'Théo', 'Tom', 'Enzo', 'Nolan', 'Noah', 'Sacha', 'Antoine', 'Baptiste', 'Clément',
  'Damien', 'Étienne', 'Fabien', 'Grégoire', 'Henri', 'Ivan', 'Jérôme', 'Kevin', 'Laurent', 'Mathis',
  'Nicolas', 'Olivier', 'Patrick', 'Quentin', 'Rémi', 'Simon', 'Thibault', 'Ulysse', 'Victor', 'William',
  'Xavier', 'Yanis', 'Zacharie', 'Alexandre', 'Benjamin', 'Cédric', 'Dorian', 'Édouard', 'Florian', 'Guillaume',
  'Hector', 'Isaac', 'Jean', 'Kylian', 'Loïc', 'Marc', 'Noé', 'Oscar', 'Paul', 'Romain',
  'Samuel', 'Timothée', 'Ugo', 'Valentin', 'Wesley', 'Yann', 'Zack', 'Aurélien', 'Bastien', 'Corentin',
  'David', 'Émile', 'Franck', 'Gaspard', 'Hippolyte', 'Ismaël', 'Jonathan', 'Killian', 'Ludovic', 'Maxime',
  'Nathanaël', 'Octave', 'Pierre', 'Rodolphe', 'Stéphane', 'Tristan', 'Valère', 'Wilfried', 'Yohann', 'Zéphyr',
  'Adrien', 'Brice', 'Cyril', 'Denis', 'Émeric', 'Fabrice', 'Gontran', 'Hervé', 'Igor', 'Justin',
];

test('la liste de prénoms de test tient bien ses 200 entrées, sans doublon', () => {
  assert.equal(PRENOMS.length, 200);
  assert.equal(new Set(PRENOMS.map((p) => p.toLowerCase())).size, 200);
});

// --- proposerPseudo ----------------------------------------------------------

test('MOTS_PSEUDO tient 24 noms communs, aucun n’est un prénom de la liste de test', () => {
  assert.equal(vueEntree.MOTS_PSEUDO.length, 24);
  const prenomsMinuscules = new Set(PRENOMS.map((p) => p.toLowerCase()));
  for (const mot of vueEntree.MOTS_PSEUDO) {
    assert.ok(!prenomsMinuscules.has(mot.toLowerCase()), `« ${mot} » ressemble à un prénom`);
  }
});

test('proposerPseudo() n’accepte AUCUN paramètre de prénom', () => {
  const signature = /export function proposerPseudo\(([^)]*)\)/.exec(source);
  assert.ok(signature, 'signature de proposerPseudo introuvable dans les sources');
  assert.doesNotMatch(signature[1], /prenom/i, 'un paramètre nommé « prenom » a été trouvé');
  assert.match(signature[1].trim(), /^alea\b/, 'le seul paramètre attendu est « alea »');
});

test('500 tirages de proposerPseudo ne rendent jamais un prénom de la liste de test', () => {
  const prenomsMinuscules = new Set(PRENOMS.map((p) => p.toLowerCase()));
  for (let i = 0; i < 500; i += 1) {
    const pseudo = vueEntree.proposerPseudo();
    assert.match(pseudo, /^.+-\d{1,2}$/, `pseudo mal formé : ${pseudo}`);
    const mot = pseudo.replace(/-\d{1,2}$/, '');
    assert.ok(!prenomsMinuscules.has(mot.toLowerCase()), `${pseudo} ressemble à un prénom`);
  }
});

test('proposerPseudo est déterministe avec un alea injecté', () => {
  const alea = () => 0; // toujours le premier mot, le nombre 0
  assert.equal(vueEntree.proposerPseudo(alea), `${vueEntree.MOTS_PSEUDO[0]}-0`);
});

// --- le bloc du PRD §7.1, mot pour mot --------------------------------------

test('EXPLICATION_CODE reproduit MOT POUR MOT le bloc de citation du PRD §7.1', () => {
  const trouve = /en une phrase :\n\n((?:>.*\n?)+)/.exec(product);
  assert.ok(trouve, 'garde-fou : le bloc de citation du PRD §7.1 est introuvable dans PRODUCT.md');
  const bloc = trouve[1]
    .split('\n')
    .filter((l) => l.startsWith('>'))
    .map((l) => l.replace(/^>\s?/, ''))
    .join(' ')
    .trim();
  assert.ok(bloc.length > 0, 'garde-fou : le bloc extrait est vide');
  assert.equal(vueEntree.EXPLICATION_CODE, bloc);
});

// --- validation ---------------------------------------------------------------

test('validerPrenom accepte lettres, espace, tiret, apostrophe, 1 à 20 caractères', () => {
  assert.equal(vueEntree.validerPrenom('Léa').erreur, null);
  assert.equal(vueEntree.validerPrenom('  Marie-Ange ').valeur, 'Marie-Ange');
  assert.equal(vueEntree.validerPrenom("Anne-So d'Ecosse").erreur, null);
  assert.notEqual(vueEntree.validerPrenom('').erreur, null);
  assert.notEqual(vueEntree.validerPrenom('L3a').erreur, null);
  assert.notEqual(vueEntree.validerPrenom('Un-prenom-beaucoup-trop-long-pour-tenir').erreur, null);
});

test('validerPseudo accepte lettres, chiffres, espace, point, tiret, souligné, 16 caractères au plus', () => {
  assert.equal(vueEntree.validerPseudo('Comète-7').erreur, null);
  assert.equal(vueEntree.validerPseudo('Renarde_14').erreur, null);
  assert.notEqual(vueEntree.validerPseudo('').erreur, null);
  assert.notEqual(vueEntree.validerPseudo('un-pseudo-beaucoup-trop-long').erreur, null);
  assert.notEqual(vueEntree.validerPseudo('a@b').erreur, null);
});

test('validerCode exige six chiffres identiques dans les deux champs', () => {
  assert.equal(vueEntree.validerCode('482913', '482913').valeur, '482913');
  assert.notEqual(vueEntree.validerCode('4829', '4829').erreur, null, 'moins de six chiffres');
  assert.notEqual(vueEntree.validerCode('abcdef', 'abcdef').erreur, null, 'pas des chiffres');
  assert.notEqual(vueEntree.validerCode('482913', '482914').erreur, null, 'les deux codes diffèrent');
});

// --- delaiApresRefus et le limiteur, sur une horloge injectée -----------------

test('delaiApresRefus rend 5s, 15s, 45s, et plafonne au dernier palier', () => {
  assert.equal(vueEntree.delaiApresRefus(0), 0);
  assert.equal(vueEntree.delaiApresRefus(1), 5000);
  assert.equal(vueEntree.delaiApresRefus(2), 15000);
  assert.equal(vueEntree.delaiApresRefus(3), 45000);
  assert.equal(vueEntree.delaiApresRefus(4), 45000);
  assert.equal(vueEntree.delaiApresRefus(10), 45000);
});

test('un code refusé trois fois de suite produit des délais de 5, 15 puis 45 s, mesurés sur une horloge injectée', () => {
  let t = 1_700_000_000_000;
  const limiteur = vueEntree.creerLimiteurReprise(() => t);

  assert.equal(limiteur.peutEssayer(), true);
  assert.equal(limiteur.refuser(), 5000);
  assert.equal(limiteur.peutEssayer(), false);
  t += 5000;
  assert.equal(limiteur.peutEssayer(), true);

  assert.equal(limiteur.refuser(), 15000);
  t += 15000;
  assert.equal(limiteur.peutEssayer(), true);

  assert.equal(limiteur.refuser(), 45000);
  t += 45000;
  assert.equal(limiteur.refuser(), 45000, 'un quatrième refus reste au dernier palier');

  limiteur.reussir();
  assert.equal(limiteur.refusConsecutifs(), 0);
  assert.equal(limiteur.peutEssayer(), true);
});

// --- helpers de navigation dans les écrans, pour les tests DOM ci-dessous ----

function avancerVersEcran3(hote, ctx, prenom = 'Léa', semaineIndex = 0) {
  vueEntree.monterEntree(hote, ctx);
  hote.querySelector('input').value = prenom;
  hote.querySelector('.bouton').declencher('click'); // écran 1 -> 2
  const semaines = hote.querySelectorAll('.cible-semaine');
  semaines[semaineIndex].declencher('click');
  hote.querySelector('.bouton').declencher('click'); // écran 2 -> 3 (Continuer)
}

// --- le code : six cases distinctes -------------------------------------------

test('le code se saisit en six cases distinctes, pas un champ unique', () => {
  const hote = creerHote();
  avancerVersEcran3(hote, ctxDe());

  const cases = hote.querySelectorAll('.saisie-code__case');
  assert.equal(cases.length, 12, 'deux groupes de six cases : le code et sa confirmation');
  for (const c of cases) {
    assert.equal(c.tagName, 'INPUT');
    assert.equal(c.maxLength, 1);
  }
});

// --- le parcours complet, sans aucun fetch ------------------------------------

test('l’écran 2 présélectionne la semaine 1 et permet d’en choisir une autre', () => {
  const hote = creerHote();
  vueEntree.monterEntree(hote, ctxDe());
  hote.querySelector('input').value = 'Léa';
  hote.querySelector('.bouton').declencher('click');

  const semaines = hote.querySelectorAll('.cible-semaine');
  assert.equal(semaines.length, 8);
  assert.ok(semaines[0].classList.contains('choisi'), 'la semaine 1 est présélectionnée');
  semaines[2].declencher('click');
  assert.ok(semaines[2].classList.contains('choisi'));
  assert.ok(!semaines[0].classList.contains('choisi'));
});

test('le parcours des trois écrans écrit prénom, semaine et compte dans l’état local, sans fetch', () => {
  const hote = creerHote();
  avancerVersEcran3(hote, ctxDe(), 'Léa', 2); // semaine 3

  const explication = hote.querySelector('.explication-code');
  assert.equal(explication.textContent, vueEntree.EXPLICATION_CODE);

  const champPseudo = hote.querySelectorAll('input')[0];
  const cases = hote.querySelectorAll('.saisie-code__case');
  saisirCode(cases.slice(0, 6), '482913');
  saisirCode(cases.slice(6, 12), '482913');

  hote.querySelector('.bouton').declencher('click');

  const e = etat.lireEtat();
  assert.equal(e.prenom, 'Léa');
  assert.equal(e.semaineDeDepart, 3);
  assert.equal(e.pseudo, champPseudo.value);
  assert.equal(e.code, '482913');
  assert.equal(e.debut, '2026-08-14T09:00:00.000Z');
  assert.equal(e.dernierSucces, null, 'aucun succès de synchronisation : c’est le marqueur « à créer » du PRP 07');
  assert.equal(globalThis.location.hash, '#/jour');
});

test('un code et sa confirmation différents refusent la création, sans rien écrire', () => {
  const hote = creerHote();
  avancerVersEcran3(hote, ctxDe());

  const cases = hote.querySelectorAll('.saisie-code__case');
  saisirCode(cases.slice(0, 6), '482913');
  saisirCode(cases.slice(6, 12), '482914');

  hote.querySelector('.bouton').declencher('click');

  assert.equal(etat.lireEtat().prenom, null, 'rien ne doit être écrit tant que le code ne se confirme pas');
  const erreurs = hote.querySelectorAll('.erreur-champ').filter((p) => p.textContent !== '');
  assert.ok(erreurs.length > 0, 'une erreur doit s’afficher sous le champ');
});

test('« j’ai déjà un pseudo » mène à la reprise : pseudonyme, code, et rien d’autre', () => {
  const hote = creerHote();
  avancerVersEcran3(hote, ctxDe());

  const lien = hote.querySelectorAll('.bouton--discret').find((b) => b.textContent === 'J’ai déjà un pseudo');
  assert.ok(lien, 'l’action discrète « j’ai déjà un pseudo » doit exister sur l’écran 3');
  lien.declencher('click');

  const champs = hote.querySelectorAll('input');
  assert.equal(champs.length, 1 + 6, 'un champ pseudo, six cases de code — rien d’autre');
});

test('un mauvais format de pseudo ou de code affiche un message qui dit à quoi ils ressemblent, sans révéler lequel cloche', () => {
  const message = 'Pseudo ou code invalide. Ton pseudo ressemble à « Galaxie-5 », et ton code est six chiffres.';

  // pseudo invalide (caractère non autorisé), code valide.
  const hotePseudo = creerHote();
  vueEntree.monterReprise(hotePseudo, ctxDe());
  hotePseudo.querySelector('input').value = '@@@';
  saisirCode(hotePseudo.querySelectorAll('.saisie-code__case'), '482913');
  hotePseudo.querySelector('.bouton').declencher('click');

  const erreurPseudo = hotePseudo.querySelectorAll('.erreur-champ').find((p) => p.textContent !== '');
  assert.ok(erreurPseudo, 'un pseudo au mauvais format doit afficher un message');
  assert.equal(erreurPseudo.textContent, message);
  assert.equal(globalThis.location.hash, '', 'un format invalide ne doit déclencher aucune navigation');

  // pseudo valide, code invalide (cinq chiffres au lieu de six).
  globalThis.location = { hash: '' };
  const hoteCode = creerHote();
  vueEntree.monterReprise(hoteCode, ctxDe());
  hoteCode.querySelector('input').value = 'Comète-7';
  saisirCode(hoteCode.querySelectorAll('.saisie-code__case'), '48291');
  hoteCode.querySelector('.bouton').declencher('click');

  const erreurCode = hoteCode.querySelectorAll('.erreur-champ').find((p) => p.textContent !== '');
  assert.ok(erreurCode, 'un code au mauvais format doit afficher un message');
  // Même règle que pour le refus serveur : le message ne doit jamais dire
  // lequel des deux champs est en cause, qu'il s'agisse du pseudo ou du code.
  assert.equal(erreurCode.textContent, erreurPseudo.textContent);
});

test('la reprise sans ctx.reprendreCompte reste inerte : aucun fetch, un message', () => {
  const hote = creerHote();
  vueEntree.monterReprise(hote, ctxDe());
  hote.querySelector('input').value = 'Comète-7';
  saisirCode(hote.querySelectorAll('.saisie-code__case'), '482913');
  hote.querySelector('.bouton').declencher('click');

  const erreur = hote.querySelectorAll('.erreur-champ').find((p) => p.textContent !== '');
  assert.ok(erreur, 'un message doit apparaître');
  assert.equal(globalThis.location.hash, '', 'sans handler, aucune navigation ne doit avoir lieu');
});

test('un refus de reprise ne dit jamais si c’est le pseudo ou le code qui est faux', async () => {
  const hote = creerHote();
  const ctx = ctxDe({ reprendreCompte: async () => ({ ok: false }) });
  vueEntree.monterReprise(hote, ctx);
  hote.querySelector('input').value = 'Comète-7';
  saisirCode(hote.querySelectorAll('.saisie-code__case'), '482913');
  hote.querySelector('.bouton').declencher('click');

  await new Promise((r) => { setTimeout(r, 0); });

  const erreur = hote.querySelectorAll('.erreur-champ').find((p) => p.textContent !== '');
  assert.ok(erreur);
  assert.match(erreur.textContent, /^Pseudo ou code incorrect\./);
  // Le refus ne se contente pas de constater : il dit à quoi ressemble un
  // pseudonyme, et nomme le geste qui reste (« Retour »). Sans cette phrase,
  // l'écran est un cul-de-sac pour celle qui a perdu son pseudonyme.
  assert.match(erreur.textContent, /Retour/);
});

test('une reprise réussie navigue vers #/jour', async () => {
  const hote = creerHote();
  const ctx = ctxDe({ reprendreCompte: async () => ({ ok: true, fiche: {} }) });
  vueEntree.monterReprise(hote, ctx);
  hote.querySelector('input').value = 'Comète-7';
  saisirCode(hote.querySelectorAll('.saisie-code__case'), '482913');
  hote.querySelector('.bouton').declencher('click');

  await new Promise((r) => { setTimeout(r, 0); });

  assert.equal(globalThis.location.hash, '#/jour');
});

// --- A18 (« Ajouté après les PRP », défaut de production remonté le
// 15 août 2026) : un pseudonyme déjà pris n'est plus un cul-de-sac silencieux

test('A18 : un pseudonyme déjà pris (409) tente la reprise avec le code tapé, et navigue si elle réussit', async () => {
  const hote = creerHote();
  const appelsReprise = [];
  const ctx = ctxDe({
    surCompteCree: async () => ({ ok: false, code: 'pseudo-pris' }),
    reprendreCompte: async (pseudo, code) => {
      appelsReprise.push([pseudo, code]);
      return { ok: true, fiche: {} };
    },
  });
  avancerVersEcran3(hote, ctx);
  const champPseudo = hote.querySelectorAll('input')[0];
  const cases = hote.querySelectorAll('.saisie-code__case');
  saisirCode(cases.slice(0, 6), '482913');
  saisirCode(cases.slice(6, 12), '482913');

  hote.querySelector('.bouton').declencher('click');
  await new Promise((r) => { setTimeout(r, 0); });

  // La reprise reçoit EXACTEMENT ce qu'elle vient de taper — jamais un
  // second formulaire, jamais un code redemandé (PRD A18).
  assert.deepEqual(appelsReprise, [[champPseudo.value, '482913']]);
  assert.equal(globalThis.location.hash, '#/jour');
});

test('A18 : pseudonyme déjà pris et code qui ne correspond pas — un message apparaît, rien ne navigue', async () => {
  const hote = creerHote();
  const ctx = ctxDe({
    surCompteCree: async () => ({ ok: false, code: 'pseudo-pris' }),
    reprendreCompte: async () => ({ ok: false }),
  });
  avancerVersEcran3(hote, ctx);
  const cases = hote.querySelectorAll('.saisie-code__case');
  saisirCode(cases.slice(0, 6), '482913');
  saisirCode(cases.slice(6, 12), '482913');

  hote.querySelector('.bouton').declencher('click');
  await new Promise((r) => { setTimeout(r, 0); });

  assert.equal(globalThis.location.hash, '', 'aucune navigation tant que le pseudo reste pris sans reprise possible');
  const erreur = hote.querySelectorAll('.erreur-champ').find((p) => p.textContent !== '');
  assert.ok(erreur, 'un message doit apparaître');
  assert.match(erreur.textContent, /existe déjà/);
  // « Un autre pseudo » reste disponible juste au-dessus (PRD A18).
  assert.ok(hote.querySelectorAll('.bouton--discret').some((b) => b.textContent === 'Un autre pseudo'));
});

test('A18 : sans reprendreCompte fourni, un pseudonyme déjà pris affiche quand même le message, sans naviguer', async () => {
  const hote = creerHote();
  const ctx = ctxDe({ surCompteCree: async () => ({ ok: false, code: 'pseudo-pris' }) });
  avancerVersEcran3(hote, ctx);
  const cases = hote.querySelectorAll('.saisie-code__case');
  saisirCode(cases.slice(0, 6), '482913');
  saisirCode(cases.slice(6, 12), '482913');

  hote.querySelector('.bouton').declencher('click');
  await new Promise((r) => { setTimeout(r, 0); });

  assert.equal(globalThis.location.hash, '');
  assert.ok(hote.querySelectorAll('.erreur-champ').some((p) => /existe déjà/.test(p.textContent)));
});

test('A18 : un succès de création navigue vers #/jour', async () => {
  const hote = creerHote();
  const ctx = ctxDe({ surCompteCree: async () => ({ ok: true, fiche: {} }) });
  avancerVersEcran3(hote, ctx);
  const cases = hote.querySelectorAll('.saisie-code__case');
  saisirCode(cases.slice(0, 6), '482913');
  saisirCode(cases.slice(6, 12), '482913');

  hote.querySelector('.bouton').declencher('click');
  await new Promise((r) => { setTimeout(r, 0); });

  assert.equal(globalThis.location.hash, '#/jour');
});

test('A18 : un serveur injoignable à la création ne bloque jamais l’entrée (compte différé, PRD §7.1)', async () => {
  const hote = creerHote();
  const ctx = ctxDe({ surCompteCree: async () => ({ ok: false, code: 'reseau' }) });
  avancerVersEcran3(hote, ctx);
  const cases = hote.querySelectorAll('.saisie-code__case');
  saisirCode(cases.slice(0, 6), '482913');
  saisirCode(cases.slice(6, 12), '482913');

  hote.querySelector('.bouton').declencher('click');
  await new Promise((r) => { setTimeout(r, 0); });

  assert.equal(globalThis.location.hash, '#/jour');
});

test('monterEntree rend un démonteur qui ne lève jamais, quel que soit l’écran affiché', () => {
  const hote = creerHote();
  const demonter = vueEntree.monterEntree(hote, ctxDe());
  assert.doesNotThrow(() => demonter());
});

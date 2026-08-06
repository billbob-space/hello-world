// tests/rejoindre.test.js — ce que l'ecran de consentement DIT.
//
// Les fonctions de montage touchent au DOM et ne se testent pas ici. Ce qui se
// teste : les phrases que le PRD fixe au mot pres, et les fonctions pures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as rejoindre from '../web/vue-rejoindre.js';

const source = (nom) => readFileSync(new URL(`../web/${nom}`, import.meta.url), 'utf8');

// Le bloc de citation du PRD §7.4, lu DANS LE DEPOT. Si le PRD est deplace ou
// renomme, ce test echoue — c'est le comportement voulu : le texte est une
// decision produit, et le reparer consiste a corriger le chemin, jamais a
// recopier le texte ici, ce qui reviendrait a ne plus rien verifier.
function blocConsentementDuPRD() {
  const prd = readFileSync(new URL('../PRODUCT.md', import.meta.url), 'utf8');
  const lignes = prd.split('\n');
  const debutSection = lignes.findIndex((l) => l.startsWith('#### 7.4'));
  assert.notEqual(debutSection, -1, 'la section 7.4 du PRD est introuvable');

  const citation = [];
  let dedans = false;
  for (const ligne of lignes.slice(debutSection)) {
    if (ligne.startsWith('>')) { dedans = true; citation.push(ligne.replace(/^>\s?/, '')); continue; }
    if (dedans) break;
  }
  assert.notEqual(citation.length, 0, 'le bloc de citation du §7.4 est introuvable');

  // Trois normalisations, et pas une de plus : l'apostrophe ASCII du PRD devient
  // la typographique de l'interface, les marqueurs de gras sont retires, et les
  // retours a la ligne et suites d'espaces deviennent une espace unique.
  return citation.join('\n').split(/\n\s*\n/)
    .map((p) => p.replace(/'/g, '’').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim())
    .filter((p) => p !== '');
}

test('les cinq phrases du consentement reproduisent le PRD §7.4, mot pour mot', () => {
  const { titre, avertissement, surLeTelephone, parent, continuer, refuser } = rejoindre.CONSENTEMENT;
  assert.deepEqual(blocConsentementDuPRD(), [
    titre,
    avertissement,
    surLeTelephone,
    parent,
    `[ ${continuer} ] [ ${refuser} ]`,
  ]);
});

test('le fragment mis en gras par le PRD est bien dans la phrase', () => {
  assert.equal(
    rejoindre.CONSENTEMENT.avertissement.includes(rejoindre.CONSENTEMENT.fort), true,
    'le <strong> du montage ne trouverait rien a entourer',
  );
});

test('l ecran de consentement ne connait pas le nom garde sur le telephone (PRD §5)', () => {
  // Le pendant de cette assertion sur web/classement.js vit dans
  // tests/classement.test.js. Les deux ensemble ferment le seul chemin par
  // lequel ce nom pourrait atteindre le reseau — et il ne sera jamais emprunte
  // par accident, il le sera par commodite, le jour ou quelqu'un voudra ecrire
  // « Salut Lucas » au-dessus du formulaire.
  //
  // La chaine visible par l'enfant porte son accent : « prénom » ne contient
  // pas la sous-chaine ASCII cherchee, et c'est pour cela que la cle de
  // CONSENTEMENT ne s'appelle pas comme elle.
  const code = source('vue-rejoindre.js');
  assert.equal(code.includes('prenom'), false, 'sous-chaine interdite dans l ecran');
  assert.equal(code.includes('ctx.prenom'), false);
  assert.equal(code.includes('lirePrenom'), false);
});

// --- le pseudonyme propose -------------------------------------------------

test('proposerPseudo ne recoit que sa source d alea — c est la garantie', () => {
  assert.ok(rejoindre.proposerPseudo.length <= 1, 'un seul parametre, l alea');

  // Avec un alea fige, la proposition est un mot de la liste suivi de deux
  // chiffres.
  for (const valeur of [0, 0.25, 0.5, 0.999]) {
    const propose = rejoindre.proposerPseudo(() => valeur);
    const [mot, nombre] = propose.split('-');
    assert.ok(rejoindre.MOTS_PSEUDO.includes(mot), `${propose} : ${mot} n est pas dans la liste`);
    assert.match(nombre, /^\d{2}$/, `${propose} : deux chiffres attendus`);
    // Ce qui est propose doit etre acceptable par le champ qui le recoit.
    assert.equal(rejoindre.validerPseudo(propose).erreur, null, `${propose} refuse par sa propre validation`);
  }
});

test('aucun mot propose n est un nom de personne ni ne renvoie au club', () => {
  assert.equal(new Set(rejoindre.MOTS_PSEUDO).size, rejoindre.MOTS_PSEUDO.length, 'aucun doublon');
  for (const interdit of ['Marcq', 'Handball', 'Lucas', 'Lille']) {
    assert.equal(rejoindre.MOTS_PSEUDO.includes(interdit), false);
  }
});

// --- la validation ---------------------------------------------------------

test('validerPseudo refuse ce que le serveur refuserait', () => {
  const refuses = {
    '': 'vide',
    '   ': 'vide',
    R: 'trop-court',
    'dix-sept-caracter': 'trop-long',
    // Un saut de ligne interne survit au nettoyage et fait echouer le motif :
    // coller trois lignes depuis une note n est pas un pseudonyme.
    'a\nb': 'caracteres',
    // Le point n'est pas dans le jeu du serveur : un motif client plus large
    // ferait tomber une saisie valide a l'ecran en 400 au retour du reseau.
    'Renard.14': 'caracteres',
    'Renard!': 'caracteres',
    '<script>': 'caracteres',
  };
  for (const [saisie, erreur] of Object.entries(refuses)) {
    assert.equal(rejoindre.validerPseudo(saisie).erreur, erreur, `${JSON.stringify(saisie)}`);
  }
});

test('validerPseudo accepte, nettoie et ramene l apostrophe a la droite', () => {
  for (const saisie of ['Léo-7', 'Renard 14', "L'Ours", 'K7', 'jean_luc']) {
    assert.equal(rejoindre.validerPseudo(saisie).erreur, null, saisie);
  }
  // Un clavier de telephone produit la typographique, que le serveur n'accepte
  // pas.
  assert.equal(rejoindre.validerPseudo('L’Ours').valeur, "L'Ours");
  assert.equal(rejoindre.validerPseudo('  Le  Renard  ').valeur, 'Le Renard');

  // NFC : « e » + accent combinant devient le « é » precompose. Sans lui, le
  // serveur — qui refuse les marques combinantes faute de pouvoir normaliser en
  // Go — rendrait 400 sur une saisie qui s'affiche correctement.
  const decompose = 'Léo';
  assert.equal([...decompose].length, 4, 'la saisie decomposee compte bien une rune de plus');
  assert.equal(rejoindre.validerPseudo(decompose).valeur, 'Léo');
  assert.equal(rejoindre.validerPseudo(decompose).erreur, null);
});

test('validerCode veut exactement quatre chiffres ASCII', () => {
  for (const mauvais of ['', '12', '12a4', '12345', '12 4', '١٢٣٤']) {
    assert.equal(rejoindre.validerCode(mauvais).erreur, 'longueur', JSON.stringify(mauvais));
  }
  // Aucun code n'est interdit — ni 0000, ni 1234. Interdire serait de la
  // friction sur un jeton qui ne protege rien, et donnerait a croire l'inverse.
  for (const bon of ['0000', '1234', '4821']) {
    assert.equal(rejoindre.validerCode(bon).erreur, null, bon);
  }
});

// --- les phrases d echec ---------------------------------------------------

test('messageErreur a une phrase pour chaque code du PRP 07, et pour l inconnu', () => {
  const codes = [
    'json-invalide', 'pseudo-invalide', 'code-invalide', 'faits-invalide',
    'ressentis-invalide', 'code-refuse', 'trop-d-essais', 'classement-plein',
    'classement-fige', 'classement-indisponible',
  ];
  assert.equal(codes.length, 10, 'dix codes distincts — code-refuse couvre l envoi et la suppression');

  const phrases = new Set();
  for (const code of codes) {
    const phrase = rejoindre.messageErreur(400, code);
    assert.notEqual(phrase, '', code);
    phrases.add(phrase);
  }
  assert.equal(phrases.size, codes.length, 'dix phrases distinctes');

  assert.equal(rejoindre.messageErreur(0, null), 'Pas de réseau. Réessaie quand tu en auras.');
  assert.notEqual(rejoindre.messageErreur(418, 'inconnu'), '');
  assert.notEqual(rejoindre.messageErreur(405, null), '', 'le 405 en texte brut n a pas d enveloppe');
});

test('la phrase du 403 est EXACTEMENT celle du serveur', () => {
  // Ecrite en dur des deux cotes : c'est ce qui fait tomber le test le jour ou
  // l'un des deux documents bouge sans l'autre. Deux vocabulaires qui
  // divergeraient seraient le defaut que le PRP 07 nomme en posant son message.
  assert.equal(
    rejoindre.messageErreur(403, 'code-refuse'),
    'Ce nom est déjà pris, ou le code ne correspond pas.',
  );
});

test('statut 0 gagne sur tout, y compris sur un code d erreur traine', () => {
  assert.equal(
    rejoindre.messageErreur(0, 'code-refuse'),
    'Pas de réseau. Réessaie quand tu en auras.',
  );
});

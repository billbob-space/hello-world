// tests/rejoindre.test.js — ce que l'ecran de consentement DIT.
//
// Les fonctions de montage touchent au DOM et ne se testent pas ici. Ce qui se
// teste : les phrases que le PRD fixe au mot pres, et les fonctions pures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as rejoindre from '../web/vue-rejoindre.js';
import { sansCommentaires, interdits } from './source.js';

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

// --- l etat visible du classement ------------------------------------------

const AVEC_RANG = (recuA, moi = null) => ({
  pseudo: 'Faucon-12', code: '4821', dernierEnvoi: null,
  dernierRangConnu: { recuA, instantane: { jour: '2026-08-07', participants: 9 }, moi },
});

test('sans rien de recu, on ne fait pas passer un ecran vide pour un classement a zero', () => {
  const { statut, phrase, fraicheur } = rejoindre.etatSynchro(
    { pseudo: null, code: null, dernierEnvoi: null, dernierRangConnu: null },
    new Date('2026-08-07T18:00:00.000Z'), true,
  );
  assert.equal(statut, 'jamais');
  assert.equal(fraicheur, null);
  assert.equal(phrase, rejoindre.PHRASES_SYNCHRO.jamais);
});

test('hors ligne, on affiche la derniere valeur connue ET on le dit (PRD §11)', () => {
  const maintenant = new Date('2026-08-07T18:00:00.000Z');
  const { statut, phrase } = rejoindre.etatSynchro(
    AVEC_RANG('2026-08-07T16:00:00.000Z'), maintenant, false,
  );
  assert.equal(statut, 'hors-ligne');
  assert.equal(phrase, 'Pas de réseau. Dernière mise à jour il y a 2 h.');
});

test('en ligne avec des cases non envoyees, la ligne annonce le depart', () => {
  const maintenant = new Date('2026-08-07T18:00:00.000Z');
  const local = AVEC_RANG('2026-08-07T17:59:00.000Z');
  // dernierEnvoi est null et le stockage est vide : envoiNecessaire compare ''
  // a '', donc rien n'est en attente.
  assert.equal(rejoindre.etatSynchro(local, maintenant, true).statut, 'a-jour');

  local.dernierEnvoi = { at: '2026-08-07T10:00:00.000Z', empreinte: '3:2026-08-05T10:00:00.000Z' };
  const { statut, phrase } = rejoindre.etatSynchro(local, maintenant, true);
  assert.equal(statut, 'en-attente');
  assert.match(phrase, /Dernière mise à jour/);
});

test('un echec se dit, plutot que de laisser croire que tout va bien', () => {
  const { statut, phrase } = rejoindre.etatSynchro(
    AVEC_RANG('2026-08-07T17:59:30.000Z'), new Date('2026-08-07T18:00:00.000Z'), true, true,
  );
  assert.equal(statut, 'echec');
  assert.match(phrase, /Ça repartira tout seul\./);
});

test('a jour, la ligne ne repete pas la fraicheur — il n y a rien a excuser', () => {
  const { statut, phrase } = rejoindre.etatSynchro(
    AVEC_RANG('2026-08-07T17:59:30.000Z'), new Date('2026-08-07T18:00:00.000Z'), true,
  );
  assert.equal(statut, 'a-jour');
  assert.equal(phrase, 'Classement à jour.');
});

test('formaterFraicheur couvre les cinq paliers', () => {
  const maintenant = new Date('2026-08-07T18:00:00.000Z');
  const ilYA = (ms) => rejoindre.formaterFraicheur(new Date(maintenant.getTime() - ms).toISOString(), maintenant);

  assert.equal(ilYA(30 * 1000), 'à l’instant');
  assert.equal(ilYA(7 * 60000), 'il y a 7 min');
  assert.equal(ilYA(2 * 3600000), 'il y a 2 h');
  // Vingt-quatre heures en arriere, c'est la veille a Paris — et c'est le jour
  // calendaire du club qui tranche, pas un ecart en heures.
  assert.equal(ilYA(24 * 3600000), 'hier');
  // Au-dela, c'est le jour qui compte, en toutes lettres.
  assert.equal(rejoindre.formaterFraicheur('2026-08-03T12:00:00.000Z', maintenant), 'le lundi 3 août');
  // Une date illisible ne fait pas tomber l'ecran.
  assert.equal(rejoindre.formaterFraicheur('jamais', maintenant), null);
});

test('phraseIgnores dit le decalage sans s excuser, au singulier comme au pluriel', () => {
  assert.equal(rejoindre.phraseIgnores(0), null);
  assert.equal(rejoindre.phraseIgnores(-1), null);
  assert.equal(rejoindre.phraseIgnores(undefined), null);
  assert.equal(
    rejoindre.phraseIgnores(1),
    '1 exercice ne compte pas encore : sa séance n’est pas encore arrivée.',
  );
  assert.equal(
    rejoindre.phraseIgnores(3),
    '3 exercices ne comptent pas encore : leur séance n’est pas encore arrivée.',
  );
});

// --- la sortie (PRD §14) ---------------------------------------------------

test('les deux phrases de sortie nomment le pseudonyme entre guillemets francais', () => {
  assert.equal(rejoindre.phraseSuppression('Renard-14'), 'Supprimer « Renard-14 » du classement ?');
  assert.match(rejoindre.avertissementChangementEnfant('Renard-14'), /« Renard-14 »/);
});

test('ce que la suppression promet, et ce qu elle ne promet pas', () => {
  const texte = rejoindre.EXPLICATION_SUPPRESSION;
  // Ce qui part.
  assert.match(texte, /disparaissent du classement, pour tout le monde/);
  // Ce qui reste, et c'est le point : l'enfant ne perd rien de ce qu'il a fait.
  assert.match(texte, /restent sur ton téléphone/);
  // Ce qui n'est PAS promis. Une page publique a pu etre lue, capturee,
  // indexee : promettre un effacement total serait faux, et le PRD §5 construit
  // tout le produit sur le fait que ce qui est publie est public.
  assert.match(texte, /ne s’efface pas/);
});

test('changer d enfant previent qu il laisserait un nom orphelin', () => {
  const phrase = rejoindre.avertissementChangementEnfant('Renard-14');
  assert.match(phrase, /plus personne\s+ne pourra le supprimer/);
  assert.match(phrase, /Supprime-le d’abord/, 'le geste de sortie est nomme, pas seulement le risque');
});

test('hors ligne, la suppression n agit pas et le dit', () => {
  // Effacer localement d'abord, en comptant sur une reprise, ferait perdre le
  // code — donc le seul moyen de retirer un nom qui, lui, resterait affiche.
  assert.equal(rejoindre.SANS_RESEAU_SUPPRESSION, 'Il faut du réseau pour supprimer ton nom.');

  const code = source('vue-rejoindre.js');
  assert.ok(
    code.indexOf('SANS_RESEAU_SUPPRESSION') < code.indexOf('await retirer('),
    'le garde hors ligne passe avant l appel reseau',
  );
});

test('les deux issues d une suppression aboutie se distinguent, sans erreur', () => {
  // Le PRP 07 rappelle qu'un enfant qui appuie deux fois, ou dont le reseau a
  // rejoue la requete, ne doit pas voir une erreur pour une action qui a abouti.
  assert.equal(rejoindre.RETIRE, 'Ton nom a été retiré du classement.');
  assert.equal(rejoindre.DEJA_RETIRE, 'Ce nom n’était plus au classement. C’est réglé.');
  assert.notEqual(rejoindre.RETIRE, rejoindre.DEJA_RETIRE);
});

test('rejoindre depuis un second telephone recupere, et n efface pas', () => {
  const code = source('vue-rejoindre.js');

  // La demande de reprise part d'ici, et de nulle part ailleurs : c'est le seul
  // ecran ou l'on saisit un code, donc le seul moment ou un telephone peut se
  // rattacher a une fiche qu'il ne connait pas encore.
  assert.match(code, /reprise:\s*true/, 'l envoi de cet ecran demande la reprise');
  assert.equal(
    (source('classement.js').match(/reprise:\s*true/g) ?? []).length, 0,
    'les envois automatiques ne la demandent jamais — sinon decocher ne se rattraperait plus',
  );

  // Ce que le serveur rend entre dans la progression locale.
  assert.ok(code.includes('fusionnerFaits('), 'la fiche rendue est fusionnee');
  assert.ok(
    code.indexOf('fusionnerFaits(') < code.indexOf('empreinte(apres)'),
    'on fusionne AVANT de calculer l empreinte',
  );
  // L'empreinte doit etre celle d'apres la fusion. Prise sur les faits envoyes,
  // elle ferait repartir aussitot un envoi ordinaire — donc un remplacement —
  // avec un ensemble plus petit que la fiche : la reprise serait defaite dans
  // la seconde qui suit.
  assert.equal(
    /empreinte\(faits\)/.test(code), false,
    'l empreinte ne se calcule plus sur ce qui a ete envoye',
  );
});

test('un telephone qui a deja un nom peut encore reprendre sa progression', () => {
  // LE DEFAUT QUE CE TEST INTERDIT. L'ecran de saisie n'est atteignable que tant
  // qu'aucun nom n'est enregistre : passe l'inscription, le bouton qui y mene
  // disparait. La reprise n'avait donc de porte que pour celui qui n'en avait
  // pas besoin — et aucune pour celui qui venait de perdre sa progression, qui
  // a justement un nom enregistre. Livrer la reprise sans ce second geste
  // revenait a ne pas la livrer.
  assert.equal(rejoindre.TEXTE_RECUPERER, 'Récupérer ma progression');
  assert.equal(rejoindre.AIDE_RECUPERER, 'Si tu as coché des séances sur un autre téléphone.');

  const code = source('vue-rejoindre.js');
  // Le geste vit dans la branche « un nom est connu », celle-la meme ou le
  // bouton d inscription n'existe plus. On lit l'APPEL, pas la constante : les
  // deux declarations sont en tete de fichier, leur ordre n'apprend rien.
  const pose = code.indexOf('bloc.append(boutonRecuperer(');
  assert.ok(pose !== -1, 'le geste est pose dans l ecran');
  assert.ok(
    code.indexOf("el('p', 'nom-classement'") < pose && pose < code.indexOf("'Gérer ce nom'"),
    'le bouton de reprise accompagne le nom deja enregistre',
  );
  // Et JAMAIS dans l'autre branche : sans nom stocke, il n'y a ni code a
  // renvoyer ni fiche a reprendre — c'est l'inscription qu'il faut.
  assert.ok(code.indexOf('TEXTE_REJOINDRE)') < code.indexOf("el('p', 'nom-classement'"));
  // Il ne redemande ni nom ni code : il renvoie ceux qui sont deja la. Un
  // second formulaire serait une seconde occasion de se tromper de code, donc
  // de se voir refuser sa propre fiche.
  assert.equal(
    /pseudo:\s*local\.pseudo,\s*code:\s*local\.code/.test(code), true,
    'la reprise repart du nom et du code stockes',
  );
  // Deux envois de reprise dans ce fichier, et deux seulement : l'inscription
  // et ce geste. Aucun autre chemin ne doit en poser un.
  assert.equal((code.match(/reprise:\s*true/g) ?? []).length, 2);
});

test('la reprise a vide ne remonte pas l ecran, celle qui rapporte le fait', () => {
  // L'anomalie 7 du journal, deja payee une fois : remonter l'ecran emporte le
  // bloc qui porte la reponse. Ici la regle se dedouble, et c'est voulu — quand
  // des seances reviennent, la progression retrouvee EST le message, et elle ne
  // s'affiche qu'en remontant.
  assert.equal(rejoindre.RECUPERATION_A_JOUR, 'Rien de plus à récupérer : cet appareil est à jour.');

  const code = source('vue-rejoindre.js');
  const remonte = code.indexOf('ctx.rafraichir()');
  const aJour = code.indexOf('RECUPERATION_A_JOUR;');
  assert.ok(remonte !== -1 && aJour !== -1);
  assert.ok(remonte < aJour, 'on remonte AVANT de sortir, et seulement si quelque chose est revenu');
  assert.match(code, /Object\.keys\(apres\)\.length > avant/, 'la decision se prend sur un compte, pas sur un statut');
});

test('hors ligne, la reprise n agit pas et le dit', () => {
  assert.equal(rejoindre.SANS_RESEAU_RECUPERATION, 'Il faut du réseau pour récupérer ta progression.');
  const code = source('vue-rejoindre.js');
  assert.ok(
    code.indexOf('SANS_RESEAU_RECUPERATION') < code.indexOf('reprise: true'),
    'le garde hors ligne passe avant le premier appel reseau du fichier',
  );
});

// --- les cas d erreur -------------------------------------------------------
//
// Signale apres la mise en ligne : « il a ajoute un espace et un emoji dans le
// nom, rien ne se passe ». Le message s'affichait pourtant. Il etait au BAS du
// formulaire, a un champ, un bouton et une explication de distance du regard —
// et derriere le clavier du telephone. Un message qu'on ne voit pas n'existe
// pas, et un refus sans issue est une impasse.

test('un emoji ne refuse pas la saisie, il propose ce qui en reste', () => {
  assert.deepEqual(rejoindre.nettoyerPseudo('Tom 🐐'), { valeur: 'Tom', aRetire: true });
  assert.deepEqual(rejoindre.nettoyerPseudo('Tom 👨‍👩‍👦'), { valeur: 'Tom', aRetire: true });
  assert.deepEqual(rejoindre.nettoyerPseudo('Tom 🇫🇷'), { valeur: 'Tom', aRetire: true });
  // Un separateur retire laisse un ESPACE : « Tom.le.chevre » vaut mieux que
  // « Tomlechevre », qui n'est plus le nom que l'enfant a voulu.
  assert.deepEqual(rejoindre.nettoyerPseudo('Tom.le.chevre'), { valeur: 'Tom le chevre', aRetire: true });
  // Une saisie deja valide n'est pas « nettoyee » : sans quoi l'ecran poserait
  // une question a quelqu'un qui n'a rien fait de mal.
  assert.deepEqual(rejoindre.nettoyerPseudo('Chevre-07'), { valeur: 'Chevre-07', aRetire: false });
  assert.deepEqual(rejoindre.nettoyerPseudo('L’ours'), { valeur: "L'ours", aRetire: false });
  // Ce qui ne laisse rien ne laisse rien : le repli n'existe pas toujours.
  assert.deepEqual(rejoindre.nettoyerPseudo('🐐'), { valeur: '', aRetire: true });
  // Et la coupe reste a seize runes, comme la validation.
  assert.equal([...rejoindre.nettoyerPseudo('Abcdefghijklmnopqrstuvwxyz🐐').valeur].length, 16);
});

test('ce que la proposition dit, et ce qu elle ne fait pas', () => {
  assert.equal(
    rejoindre.phraseNettoyage('Tom'),
    'Les emojis et les caractères spéciaux ne passent pas. On garde « Tom » ?',
  );
  // Le nom propose est CITE. Sans lui, la phrase demande de comparer deux etats
  // du champ de memoire, au moment precis ou le clavier cache le champ.
  assert.match(rejoindre.phraseNettoyage('Tom le chevre'), /« Tom le chevre »/);
  // Une question, pas une annonce : le nom est public, il ne se corrige pas dans
  // le dos de celui qui le porte. Un second appui l'envoie.
  assert.match(rejoindre.phraseNettoyage('Tom'), /\?$/);
  assert.equal(rejoindre.RIEN_A_GARDER, 'Il ne reste rien à garder. Écris un nom en lettres ou en chiffres.');

  const code = source('vue-rejoindre.js');
  // La proposition ARRIVE DANS LE CHAMP, et l'envoi s'arrete la.
  assert.ok(
    code.indexOf('champPseudo.value = propre.valeur') < code.indexOf('phraseNettoyage(propre.valeur)'),
    'le champ porte la proposition avant que la phrase ne la commente',
  );
  assert.equal(
    /nettoyerPseudo\([^)]*\)[\s\S]{0,400}?await envoyer\(/.test(code), false,
    'aucun envoi ne suit un nettoyage sans un nouveau geste',
  );
});

test('un message d erreur se lit sous son champ, et le marque', () => {
  const code = source('vue-rejoindre.js');
  // Quatre signaux, et aucun ne suffit seul. La bordure est le seul qui survive
  // a un message pousse hors de l'ecran par le clavier du telephone.
  assert.match(code, /role', 'alert'/, 'un lecteur d ecran l annonce comme une alerte');
  assert.match(code, /aria-invalid/);
  assert.match(code, /aria-describedby/);
  assert.match(code, /champ-en-erreur/);
  assert.match(code, /champ\.focus\(\)/, 'le champ fautif vient sous les yeux');
  assert.match(code, /scrollIntoView/, 'et le message vient avec lui');

  // Il part des que l'enfant retouche sa saisie : un message qui reste sous un
  // champ corrige devient un reproche.
  assert.match(code, /champ\.addEventListener\('input', effacer\)/);

  // La zone d'erreur generale existe toujours, pour ce qui ne vient pas d'un
  // champ : reseau coupe, delai depasse, refus du serveur.
  assert.match(code, /retour\.textContent = phraseDe\(resultat\)/);

  const css = source('style.css');
  for (const classe of ['.erreur-champ', '.champ-en-erreur']) {
    assert.ok(css.includes(classe), `${classe} manque dans style.css`);
  }
});

test('l equipe a son onglet, et le consentement n en a toujours pas', () => {
  assert.equal(rejoindre.TITRE_ECRAN_CLASSEMENT, 'L’équipe');
  assert.equal(rejoindre.RETOUR_CLASSEMENT, '#/equipe');
  // On revient d ou l on vient : le bouton qui mene au consentement est sur cet
  // ecran-la, et nulle part ailleurs.
  assert.deepEqual(
    interdits(sansCommentaires(source('vue-rejoindre.js')), ["ctx.aller('#/perso')"]), [],
  );

  const app = sansCommentaires(source('app.js'));
  assert.match(app, /#\/equipe/);
  // « L'equipe » et non « Classement » : on y lit un podium, une position ET une
  // jauge de groupe — la seule mesure ou personne n'est dernier. « Classement »
  // promettrait le tableau complet que le PRD §9 refuse d'afficher.
  assert.deepEqual(interdits(app, ["texte: 'Classement'"]), []);

  const ecran = source('vue-classement.js');
  // L'ecran est un CONTENANT : il ne calcule rien et n'appelle personne.
  assert.equal(/fetch\(/.test(ecran), false);
  assert.equal(ecran.includes('./etat.js'), false, 'il ne lit pas le telephone lui-meme');
});

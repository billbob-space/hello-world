// Le commun des garde-fous de source, mis en defaut expres. Trois fois sur
// marcq-handball, un COMMENTAIRE portant le mot interdit a fait echouer le test
// cense surveiller le CODE ; a chaque fois le commentaire a ete reecrit, et le
// defaut est reste. Ces quatre cas sont sa description.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sansCommentaires, interdits } from './source.js';

test('un commentaire de ligne ne declenche plus le garde-fou', () => {
  const code = "// le texte passe par textContent, jamais par innerHTML\nel.textContent = x\n";
  assert.deepEqual(interdits(sansCommentaires(code), ['innerHTML']), []);
});

test('un commentaire de bloc non plus', () => {
  const code = "/* ni confirm( ni alert( ici */\nel.addEventListener('click', f)\n";
  assert.deepEqual(interdits(sansCommentaires(code), ['confirm(', 'alert(']), []);
});

test('un emploi reel declenche toujours le garde-fou', () => {
  const code = "el.innerHTML = titre\nif (confirm('sur ?')) f()\n";
  assert.deepEqual(interdits(sansCommentaires(code), ['innerHTML', 'confirm(']),
    ['innerHTML', 'confirm(']);
});

test('une adresse http ne perd pas sa fin', () => {
  // Le double slash d'une URL n'ouvre pas un commentaire : le tronquer
  // supprimerait du code reel, et un garde-fou muet ne se voit pas.
  const code = "const AIDE = 'https://exemple.test/aide#innerHTML'\n";
  assert.deepEqual(interdits(sansCommentaires(code), ['innerHTML']), ['innerHTML']);
});

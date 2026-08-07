// Le commun des garde-fous qui lisent le CODE d'un module. Voir
// tests/source.test.js pour ce qu'il doit et ne doit pas attraper.

// Les commentaires retires, le reste intact — chaines de caracteres comprises :
// plusieurs garde-fous cherchent justement une chaine, les retirer les rendrait
// muets. Le « [^:] » devant le double slash epargne les adresses web.
export function sansCommentaires(texte) {
  return texte
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// Ceux des mots que le code contient, dans l'ordre donne. Rendre la LISTE
// plutot qu'un booleen : le message d'echec nomme alors le fautif.
export function interdits(code, mots) {
  return mots.filter((m) => code.includes(m));
}

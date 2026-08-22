// La barre de progression : le seul calcul qu'elle porte, et les deux pieges
// qu'il evite. Le montage lui-meme n'est pas teste ici — il n'a aucune decision,
// et il demanderait un navigateur.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { partDe } from '../web/barre.js';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', 'web');
const lire = (nom) => readFileSync(join(web, nom), 'utf8');

test('la part est le rapport, entre 0 et 1', () => {
  assert.equal(partDe(0, 6), 0);
  assert.equal(partDe(3, 6), 0.5);
  assert.equal(partDe(6, 6), 1);
});

// Le 3 aout au matin, aucune seance n'est programmee : `echelle` vaut 0 chez qui
// oublierait le Math.max des modeles. Une division par zero rendrait Infinity ou
// NaN, que le CSS ignore en silence — la barre resterait vide, ou pleine, sans
// que rien ne le dise.
test('une echelle nulle ou absurde ne rend jamais NaN', () => {
  for (const echelle of [0, -4, null, undefined, NaN, 'sept']) {
    const part = partDe(2, echelle);
    assert.ok(Number.isFinite(part), `echelle ${String(echelle)} rend ${part}`);
    assert.ok(part >= 0 && part <= 1, `echelle ${String(echelle)} sort des bornes`);
  }
  assert.equal(partDe('trois', 6), 0, 'un compte illisible vaut zero, jamais NaN');
});

// Le rattrapage peut cocher plus que ce qui est programme a ce jour si le
// programme change entre deux ouvertures. La barre se remplit, elle ne deborde
// pas du cadre.
test('la part est ecretee a 1 et jamais negative', () => {
  assert.equal(partDe(9, 6), 1);
  assert.equal(partDe(-2, 6), 0);
});

// La barre ne s'anime qu'en `translate`. Une transition sur `width`, `height` ou
// `padding` obligerait le navigateur a refaire la mise en page a chaque image ;
// c'est exactement ce que ce module a supprime, et rien ne le signalerait si
// elle revenait.
test('le remplissage ne s anime que par deplacement', () => {
  const css = lire('style.css');
  const bloc = css.match(/\.barre-remplissage \{([^}]*)\}/);
  assert.ok(bloc, '.barre-remplissage a disparu de la feuille de style');
  assert.match(bloc[1], /transition: translate /, 'le remplissage n anime plus son deplacement');
  assert.doesNotMatch(
    bloc[1],
    /transition:[^;]*\b(width|height|padding|margin|inset|top|left)\b/,
    'une propriete de mise en page est animee : la barre saccade sur un telephone',
  );
});

// L'ancienne barre etait un <progress> natif, annonce tout seul. Le remplacer
// par un div sans role laisserait une barre invisible aux lecteurs d'ecran, et
// personne ne le verrait a l'ecran.
test('la barre garde un role annonce, sauf quand elle est declaree muette', () => {
  const source = lire('barre.js');
  assert.match(source, /setAttribute\('role', 'progressbar'\)/);
  assert.match(source, /aria-valuenow/);
  assert.match(source, /aria-hidden/);
});

// Sans `aria-valuetext`, un lecteur d'ecran annonce un POURCENTAGE calcule a
// partir de valuenow/valuemin/valuemax — « 43 % » quand l'ecran ecrit « 3 / 7 ».
// L'unite entendue n'existe alors sur aucun ecran de l'app, et rien a l'oeil ne
// signalerait le retour de ce decalage. Il est pose par `reglerBarre` et non par
// `creerBarre` : c'est le seul des deux qui soit rejoue a chaque coche.
test('la barre dicte le compte, et non un pourcentage', () => {
  const source = lire('barre.js');
  const regler = source.match(/export function reglerBarre[\s\S]*?\n\}/);
  assert.ok(regler, 'reglerBarre a disparu de barre.js');
  assert.match(regler[0], /aria-valuetext/,
    'la barre laisse le lecteur d ecran recalculer un pourcentage');
});

// Le nom accessible est pose UNE FOIS, a la creation, et `reglerBarre` ne le
// rejoue pas. Un nom qui porterait le compte se figerait donc au compte du
// montage — « 0 sur 7 » pour toute la seance sur le seul ecran ou la barre
// bouge — sans que rien a l'ecran ne le montre.
test('aucun ecran ne met le compte dans le nom de la barre', () => {
  for (const vue of ['vue-jour.js', 'vue-seance.js', 'vue-perso.js',
    'vue-bilan.js', 'vue-equipe.js', 'vue-coach.js']) {
    const source = lire(vue);
    // Le nom d'une barre est ce qui est passe a `creerBarre`, directement ou par
    // une variable `nom` que l'appel reprend. Les deux formes sont lues ; les
    // autres `nom:` du fichier — une case de calendrier, par exemple — ne sont
    // pas des noms de barre et n'ont rien a voir ici.
    const parNom = /creerBarre\([^)]*\bnom\b/.test(source)
      ? (source.match(/const nom = ('[^']*'|`[^`]*`)/g) ?? [])
      : [];
    const enLigne = source.match(/creerBarre\([^)]*nom: *('[^']*'|`[^`]*`)/g) ?? [];
    for (const nom of [...parNom, ...enLigne]) {
      assert.doesNotMatch(nom, /\$\{/,
        `${vue} interpole une valeur dans le nom de la barre : elle se figera au montage`);
    }
  }
});

// Six ecrans affichent une barre ; aucun ne doit la reconstruire a la main.
test('aucun ecran ne fabrique sa propre barre', () => {
  for (const vue of ['vue-jour.js', 'vue-seance.js', 'vue-perso.js',
    'vue-bilan.js', 'vue-equipe.js', 'vue-coach.js']) {
    assert.doesNotMatch(
      lire(vue),
      /'progress'/,
      `${vue} construit encore un <progress> : la mecanique de la barre vit dans barre.js`,
    );
  }
});

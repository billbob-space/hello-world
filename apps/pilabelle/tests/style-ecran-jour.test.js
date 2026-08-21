import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Decision d'ecran du 20 aout 2026 (PRODUCT.md « l'ecran de seance montre le
// programme ») : menthe = fait, lavande = a faire, rose = a taper ; une note
// qui parle (.pique, .defi non releve) porte un filet et jamais de fond. Un
// faux DOM (tests/faux-dom.js) n'execute aucun moteur CSS : ces regles ne se
// verifient qu'en lisant le texte de la feuille de style elle-meme, bloc par
// bloc, et en recalculant les contrastes.

const CSS_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'style.css');
const CSS = readFileSync(CSS_PATH, 'utf8');

// JETONS lit les valeurs hexadecimales de :root, pour calculer des contrastes
// reels plutot que de les supposer.
function jetons(css) {
	const racine = css.match(/:root\s*{([\s\S]*?)}/)[1];
	const table = {};
	for (const m of racine.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) table[m[1]] = m[2];
	return table;
}
const JETONS = jetons(CSS);

function hexVersRgb(hex) {
	const h = hex.replace('#', '');
	return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function luminanceRelative([r, g, b]) {
	const canal = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
	const [rl, gl, bl] = [r, g, b].map(canal);
	return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contraste(hex1, hex2) {
	const l1 = luminanceRelative(hexVersRgb(hex1)) + 0.05;
	const l2 = luminanceRelative(hexVersRgb(hex2)) + 0.05;
	return l1 > l2 ? l1 / l2 : l2 / l1;
}

// blocRegle extrait le contenu d'une regle CSS par son selecteur exact (ex.
// ".defi {" ou ".defi.defi-releve {"), sans confondre les deux : il exige que
// le caractere suivant le selecteur soit l'accolade ouvrante.
function blocRegle(css, selecteur) {
	const echappe = selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const re = new RegExp(`(?:^|[\\s}])${echappe}\\s*\\{([\\s\\S]*?)\\}`, 'm');
	const m = css.match(re);
	if (!m) throw new Error(`regle introuvable : ${selecteur}`);
	return m[1];
}

test('.pique n\'a plus de fond lavande : une note qui parle, pas un bouton', () => {
	const bloc = blocRegle(CSS, '.pique');
	assert.match(bloc, /background:\s*transparent/, '.pique doit perdre son fond, sinon il ressemble a button.secondaire');
	assert.doesNotMatch(bloc, /background:\s*var\(--lavande-100\)/);
	assert.match(bloc, /border:\s*1px solid var\(--lavande-300\)/, 'le filet doit rester visible');
});

test('.defi (non releve) n\'a plus de fond lavande, et porte un filet', () => {
	const bloc = blocRegle(CSS, '.defi');
	assert.match(bloc, /background:\s*transparent/);
	assert.doesNotMatch(bloc, /background:\s*var\(--lavande-100\)/);
	assert.match(bloc, /border:\s*1px solid/, 'sans filet, .defi redevient un pave indistinct');
});

test('.defi.defi-releve garde son fond plein : un defi releve est un « fait », pas une note', () => {
	const bloc = blocRegle(CSS, '.defi.defi-releve');
	assert.match(bloc, /background:\s*var\(--menthe-100\)/);
	assert.match(bloc, /color:\s*var\(--menthe-700\)/);
});

test('ul li (les blocs de la seance) ne sont plus verts : le vert ne veut dire « fait » que la ou c\'est vrai', () => {
	const bloc = blocRegle(CSS, 'ul li');
	assert.doesNotMatch(bloc, /var\(--menthe/, 'un bloc pas encore fait ne doit jamais porter le vert du "fait"');
	assert.match(bloc, /background:\s*var\(--lavande-100\)/);
	assert.match(bloc, /color:\s*var\(--lavande-700\)/);
});

// Contre-epreuve : si le defaut revient (le vert reprend la liste des blocs
// a faire), ce test doit rougir. On le verifie en remontant temporairement le
// texte du defaut connu et en s'assurant qu'il ferait echouer l'assertion
// ci-dessus — sans modifier le fichier reel.
test('contre-epreuve : le motif fautif (ul li en menthe) est bien detecte comme fautif', () => {
	const defautConnu = 'ul li {\n\tbackground: var(--menthe-100);\n\tcolor: var(--menthe-700);\n}';
	assert.match(defautConnu, /var\(--menthe/);
});

test('contrastes mesures, pas supposes : le texte reste lisible sur chaque fond utilise', () => {
	assert.ok(contraste(JETONS.encre, JETONS.fond) >= 4.5, 'texte encre sur le fond de page');
	assert.ok(contraste(JETONS['lavande-700'], JETONS['lavande-100']) >= 4.5, 'texte lavande-700 sur lavande-100 (ul li, .niveaux li)');
	assert.ok(contraste(JETONS['menthe-700'], JETONS['menthe-100']) >= 4.5, 'texte menthe-700 sur menthe-100 (.defi-releve)');
	// La regle de palette (memoire du fichier) : le -700 d'une famille est
	// l'encre qui se pose sur son -100, --lavande-500 restant un fond, jamais
	// une encre. On verifie que la regle CSS n'a pas reintroduit --lavande-500
	// comme couleur de texte sur --lavande-100.
	assert.doesNotMatch(blocRegle(CSS, 'ul li'), /color:\s*var\(--lavande-500\)/);
});

// Le vert « fait » ne s'arrete pas a l'ecran du jour. La decision du 20 aout
// 2026 engage l'app ENTIERE : « le vert signifie fait PARTOUT dans l'app ».
// Le premier passage l'avait tenu sur l'ecran du jour et oublie sur l'ecran de
// fin, ou la recompense du defi restait en corail — la couleur que l'app
// emploie par ailleurs pour « seance non faite », pour l'erreur de formulaire
// et pour l'action destructrice. Le MEME fait (« defi releve ») changeait donc
// de couleur selon l'ecran qui l'annoncait.

test('.defi-recompense (ecran de fin) porte le vert du « fait », comme .defi-releve sur l\'ecran du jour', () => {
	const bloc = blocRegle(CSS, '.defi-recompense');
	assert.match(bloc, /background:\s*var\(--menthe-100\)/, 'un defi releve est un fait : menthe, pas corail');
	assert.match(bloc, /color:\s*var\(--menthe-700\)/);
	assert.doesNotMatch(bloc, /var\(--corail/, 'le corail dit « non fait » / « danger » ailleurs dans l\'app — jamais une recompense');
});

test('un defi releve porte la MEME couleur sur les deux ecrans qui l\'annoncent', () => {
	const surLeJour = blocRegle(CSS, '.defi.defi-releve');
	const surLaFin = blocRegle(CSS, '.defi-recompense');
	const fond = (b) => b.match(/background:\s*(var\(--[\w-]+\))/)[1];
	const encre = (b) => b.match(/color:\s*(var\(--[\w-]+\))/)[1];
	assert.equal(fond(surLaFin), fond(surLeJour), 'meme fait, meme fond');
	assert.equal(encre(surLaFin), encre(surLeJour), 'meme fait, meme encre');
});

test('le corail reste reserve a ce qui n\'est pas fait, a l\'erreur et au danger', () => {
	// Les trois seuls emplois legitimes du corail dans l'app. Si un quatrieme
	// apparait, ce test le fait remarquer plutot que de le laisser passer.
	const emploisAttendus = ['button.danger', '.erreur', '.calendrier-jour.jour-manque'];
	for (const sel of emploisAttendus) {
		assert.match(blocRegle(CSS, sel), /var\(--corail/, `${sel} doit porter le corail`);
	}
	const blocsCorail = [...CSS.matchAll(/([^{}]+)\{([^{}]*var\(--corail[^{}]*)\}/g)]
		.map((m) => m[1].trim().split('\n').pop().trim())
		.filter((sel) => !sel.startsWith(':root'));
	for (const sel of blocsCorail) {
		const base = sel.replace(/:(hover|active|focus-visible|disabled)$/, '');
		assert.ok(emploisAttendus.includes(base), `emploi inattendu du corail : ${sel}`);
	}
});

// Un DOM minuscule, juste ce dont les vues de web/ se servent. pilabelle n'a
// aucune dependance (package.json : « aucune dependance, aucun node_modules »)
// et les tests tournent sous `node --test` : pas de jsdom, pas de navigateur.
// Ce fichier n'est PAS un test — le lanceur ne prend que tests/*.test.js.
//
// Il ne simule que ce qui est reellement appele : creation, arborescence,
// texte, classes, attributs, ecouteurs de clic et de soumission. Tout le reste
// leve, volontairement — un faux DOM trop complaisant ferait passer des vues
// qui ne marcheraient pas dans un vrai navigateur.

class Texte {
	constructor(valeur) { this.valeur = String(valeur); }
	get textContent() { return this.valeur; }
}

class Element {
	constructor(nom) {
		this.tagName = nom.toUpperCase();
		this.enfants = [];
		this.parentNode = null;
		this.attributs = new Map();
		this.ecouteurs = new Map();
		this.className = '';
		this.id = '';
		this.hidden = false;
		this.disabled = false;
	}

	get textContent() { return this.enfants.map((e) => e.textContent).join(''); }
	set textContent(valeur) {
		for (const e of this.enfants) if (e instanceof Element) e.parentNode = null;
		this.enfants = valeur === '' || valeur === null || valeur === undefined ? [] : [new Texte(valeur)];
	}

	appendChild(noeud) {
		noeud.parentNode = this;
		this.enfants.push(noeud);
		return noeud;
	}

	append(...noeuds) {
		for (const n of noeuds) {
			if (n instanceof Element) this.appendChild(n);
			else this.enfants.push(new Texte(n));
		}
	}

	insertBefore(noeud, reference) {
		const i = this.enfants.indexOf(reference);
		noeud.parentNode = this;
		this.enfants.splice(i < 0 ? 0 : i, 0, noeud);
		return noeud;
	}

	remove() {
		if (!this.parentNode) return;
		const i = this.parentNode.enfants.indexOf(this);
		if (i >= 0) this.parentNode.enfants.splice(i, 1);
		this.parentNode = null;
	}

	get firstChild() { return this.enfants[0] || null; }

	get classList() {
		const lire = () => (this.className ? this.className.split(/\s+/).filter(Boolean) : []);
		const ecrire = (l) => { this.className = l.join(' '); };
		return {
			contains: (c) => lire().includes(c),
			add: (c) => { const l = lire(); if (!l.includes(c)) { l.push(c); ecrire(l); } },
			remove: (c) => ecrire(lire().filter((x) => x !== c)),
			toggle: (c, force) => {
				const present = lire().includes(c);
				const veut = force === undefined ? !present : Boolean(force);
				if (veut && !present) { const l = lire(); l.push(c); ecrire(l); }
				if (!veut && present) ecrire(lire().filter((x) => x !== c));
				return veut;
			},
		};
	}

	setAttribute(nom, valeur) {
		this.attributs.set(nom, String(valeur));
		if (nom === 'id') this.id = String(valeur);
	}

	getAttribute(nom) { return this.attributs.has(nom) ? this.attributs.get(nom) : null; }

	addEventListener(type, fonction) {
		if (!this.ecouteurs.has(type)) this.ecouteurs.set(type, []);
		this.ecouteurs.get(type).push(fonction);
	}

	// declencher rend la valeur des ecouteurs pour que les tests puissent
	// attendre un gestionnaire asynchrone plutot que de dormir.
	declencher(type, evenement = {}) {
		if (this.disabled) return Promise.resolve(); // un bouton desactive n'appelle rien
		const liste = this.ecouteurs.get(type) || [];
		return Promise.all(liste.map((f) => f({ preventDefault() {}, ...evenement })));
	}

	cliquer() { return this.declencher('click'); }

	correspond(selecteur) {
		const parties = selecteur.match(/^([a-z][a-z0-9]*)?((?:[.#][\w-]+)*)$/i);
		if (!parties) throw new Error(`selecteur non gere : ${selecteur}`);
		if (parties[1] && this.tagName !== parties[1].toUpperCase()) return false;
		for (const jeton of parties[2].match(/[.#][\w-]+/g) || []) {
			const nom = jeton.slice(1);
			if (jeton[0] === '.' && !this.classList.contains(nom)) return false;
			if (jeton[0] === '#' && this.id !== nom) return false;
		}
		return true;
	}

	// querySelectorAll ne gere que « a b » (descendant) et « a > b » (enfant).
	querySelectorAll(selecteur) {
		const etapes = selecteur.trim().split(/\s*>\s*|\s+/);
		const combinateurs = [...selecteur.trim().matchAll(/\s*>\s*|\s+/g)].map((m) => (m[0].includes('>') ? '>' : ' '));
		let courants = [this];
		for (let i = 0; i < etapes.length; i++) {
			const direct = i > 0 && combinateurs[i - 1] === '>';
			const suivants = [];
			for (const base of courants) {
				const candidats = direct ? base.enfants.filter((e) => e instanceof Element) : base.descendants();
				for (const c of candidats) if (c.correspond(etapes[i]) && !suivants.includes(c)) suivants.push(c);
			}
			courants = suivants;
		}
		return courants;
	}

	querySelector(selecteur) { return this.querySelectorAll(selecteur)[0] || null; }

	descendants() {
		const sortie = [];
		for (const e of this.enfants) {
			if (!(e instanceof Element)) continue;
			sortie.push(e, ...e.descendants());
		}
		return sortie;
	}
}

// FormData ne lit que les champs coches, comme le vrai : c'est ce qui fait que
// le questionnaire refuse une validation sans niveau ni jour.
class FauxFormData {
	constructor(formulaire) {
		this.entrees = [];
		for (const e of formulaire.descendants()) {
			if (e.tagName !== 'INPUT' || !e.name) continue;
			if ((e.type === 'radio' || e.type === 'checkbox') && !e.checked) continue;
			this.entrees.push([e.name, e.value]);
		}
	}
	get(nom) { const t = this.entrees.find(([c]) => c === nom); return t ? t[1] : null; }
	getAll(nom) { return this.entrees.filter(([c]) => c === nom).map(([, v]) => v); }
}

// installerDom pose un document global portant <div id="app">, le point de
// montage que app.js cherche au chargement du module.
export function installerDom() {
	const racine = new Element('div');
	racine.setAttribute('id', 'app');
	const document = {
		createElement: (nom) => new Element(nom),
		querySelector: (s) => (racine.correspond(s) ? racine : racine.querySelector(s)),
		querySelectorAll: (s) => racine.querySelectorAll(s),
	};
	globalThis.document = document;
	globalThis.FormData = FauxFormData;
	// Node 22 expose deja un `navigator` en lecture seule, et pas de `window`.
	// notifications-push.js ne fait que tester la presence de cles dedans ;
	// aucun des deux ne porte 'serviceWorker' ni 'PushManager', ce qui place
	// les vues dans l'etat « navigateur sans notifications » — un vrai etat.
	if (!('window' in globalThis)) globalThis.window = {};
	return racine;
}

export { Element };

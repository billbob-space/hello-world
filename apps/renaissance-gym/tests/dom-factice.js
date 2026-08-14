// tests/dom-factice.js — un DOM minimal, suffisant pour monter les vues sans
// navigateur (le meme choix que `marcq-handball` : ce n'est pas un shim
// general, juste ce que les vues de renaissance-gym utilisent). Ce fichier
// ne finit pas en « .test.js » : `node --test tests/*.test.js` ne l'execute
// jamais comme un test.

export class ElementFactice {
  constructor(balise) {
    this.tagName = String(balise).toUpperCase();
    this.children = [];
    this.attrs = {};
    this._classes = new Set();
    this._handlers = new Map();
    this.style = {};
    this.value = '';
    this._text = '';
    this.disabled = false;
    this.hidden = false;
    this.parent = null;
  }

  get className() { return [...this._classes].join(' '); }

  set className(v) { this._classes = new Set(String(v ?? '').split(/\s+/).filter(Boolean)); }

  get classList() {
    const self = this;
    return {
      add: (...cs) => cs.forEach((c) => self._classes.add(c)),
      remove: (...cs) => cs.forEach((c) => self._classes.delete(c)),
      toggle(c, force) {
        if (force === undefined) {
          if (self._classes.has(c)) self._classes.delete(c); else self._classes.add(c);
        } else if (force) self._classes.add(c);
        else self._classes.delete(c);
      },
      contains: (c) => self._classes.has(c),
    };
  }

  get textContent() { return this._text; }

  set textContent(v) {
    this._text = v === undefined || v === null ? '' : String(v);
    this.children = [];
  }

  append(...noeuds) {
    for (const n of noeuds) {
      if (typeof n === 'string') { this._text += n; continue; }
      n.parent = this;
      this.children.push(n);
    }
  }

  appendChild(n) { this.append(n); return n; }

  replaceChildren(...noeuds) {
    this.children = [];
    this._text = '';
    this.append(...noeuds);
  }

  setAttribute(k, v) { this.attrs[k] = String(v); }

  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }

  removeAttribute(k) { delete this.attrs[k]; }

  addEventListener(nom, fn) {
    if (!this._handlers.has(nom)) this._handlers.set(nom, []);
    this._handlers.get(nom).push(fn);
  }

  removeEventListener(nom, fn) {
    const liste = this._handlers.get(nom);
    if (!liste) return;
    const i = liste.indexOf(fn);
    if (i !== -1) liste.splice(i, 1);
  }

  // Simule l'evenement : appelle chaque gestionnaire pose par addEventListener.
  declencher(nom, evt = {}) {
    (this._handlers.get(nom) ?? []).slice().forEach((fn) => fn(evt));
  }

  focus() {}

  querySelectorAll(selecteur) {
    return listerDescendants(this).filter((n) => correspond(n, selecteur));
  }

  querySelector(selecteur) {
    return this.querySelectorAll(selecteur)[0] ?? null;
  }
}

function listerDescendants(noeud) {
  const sortie = [];
  for (const enfant of noeud.children) {
    sortie.push(enfant);
    sortie.push(...listerDescendants(enfant));
  }
  return sortie;
}

function correspond(noeud, selecteur) {
  if (selecteur.startsWith('.')) return noeud._classes instanceof Set && noeud._classes.has(selecteur.slice(1));
  if (selecteur.startsWith('#')) return noeud.id === selecteur.slice(1);
  return noeud.tagName === selecteur.toUpperCase();
}

// Pose `globalThis.document` pour la duree d'un test. `web/*.js` n'appelle
// jamais `document.createElement` au chargement du module (seulement a
// l'interieur des fonctions `monterX`) : poser le document APRES l'import
// est donc sans risque.
export function poserDocumentFactice() {
  globalThis.document = { createElement: (balise) => new ElementFactice(balise) };
}

export function creerHote() {
  return new ElementFactice('main');
}

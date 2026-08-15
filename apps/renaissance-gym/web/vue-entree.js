// vue-entree.js — les trois écrans d'entrée, et « j'ai déjà un pseudo »
// (PRP 03, PRD §7.1, §7.5, §10.1, §10.2, §14).
//
// Écrans 1 et 2 sont du lot 1. L'écran 3 écrit le compte dans l'état LOCAL
// et s'arrête là : AUCUN `fetch` ici. La création réelle sur le serveur, la
// reprise sur un second appareil et la file d'attente « à créer » sont le lot
// du PRP 07 ; ce module lui laisse deux points d'accroche documentés plus
// bas (`ctx.surCompteCree`, `ctx.reprendreCompte`).

import { ecrireEtat } from './etat.js';

function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

// 24 noms communs — animaux, astres, phénomènes naturels. AUCUN prénom,
// aucune marque, aucun mot lisible comme un jugement sur le corps (PRP 03
// chantier B).
export const MOTS_PSEUDO = [
  'Renarde', 'Hirondelle', 'Loutre', 'Salamandre', 'Libellule', 'Bergeronnette',
  'Comète', 'Nébuleuse', 'Météore', 'Éclipse', 'Galaxie', 'Pulsar',
  'Orage', 'Tempête', 'Cascade', 'Bourrasque', 'Frimas', 'Embrun',
  'Rafale', 'Marée', 'Bruine', 'Grêle', 'Foudre', 'Tourbillon',
];

// Repris du PRD §10.1 : lettres, chiffres, espace, point, tiret, souligné,
// seize caractères au plus.
export const MOTIF_PSEUDO = /^[\p{L}\p{N}][\p{L}\p{N} .\-_]{0,15}$/u;
export const MOTIF_CODE = /^\d{6}$/;
// 1 à 20 caractères, lettres, espace, tiret, apostrophe (PRP 03 chantier A).
export const MOTIF_PRENOM = /^[\p{L}][\p{L} '\-]{0,19}$/u;

// Le bloc du PRD §7.1, MOT POUR MOT (tests/entree.test.js le compare à
// PRODUCT.md). Il est affiché AU-DESSUS des champs, pas en dessous : il
// explique avant de demander.
export const EXPLICATION_CODE = 'C\'est ce qui te permettra de retrouver tes séances si tu changes de téléphone. '
  + 'Note-le quelque part, ou demande à un parent de le noter : personne ne peut te le redonner.';

// PRD §7.5 : quatre essais par minute au plus.
export const REPRISES_MS = [5000, 15000, 45000];

// AUCUN PARAMÈTRE DE PRÉNOM : c'est la garantie mécanique qu'un prénom ne
// fuit jamais dans un pseudonyme (PRP 03 chantier B).
export function proposerPseudo(alea = Math.random) {
  const mot = MOTS_PSEUDO[Math.floor(alea() * MOTS_PSEUDO.length)];
  const nombre = Math.floor(alea() * 100);
  return `${mot}-${nombre}`;
}

function nettoyer(saisie) {
  return typeof saisie === 'string' ? saisie.trim() : '';
}

export function validerPrenom(saisie) {
  const valeur = nettoyer(saisie);
  if (!MOTIF_PRENOM.test(valeur)) {
    return { valeur: null, erreur: 'Écris ton prénom : des lettres, un espace, un tiret ou une apostrophe, vingt caractères au plus.' };
  }
  return { valeur, erreur: null };
}

export function validerPseudo(saisie) {
  const valeur = nettoyer(saisie);
  if (!MOTIF_PSEUDO.test(valeur)) {
    return { valeur: null, erreur: 'Ce pseudo ne convient pas : lettres, chiffres, espace, point, tiret ou souligné, seize caractères au plus.' };
  }
  return { valeur, erreur: null };
}

export function validerCode(saisie, confirmation) {
  const valeur = nettoyer(saisie);
  const conf = nettoyer(confirmation);
  if (!MOTIF_CODE.test(valeur)) {
    return { valeur: null, erreur: 'Le code doit être composé de six chiffres.' };
  }
  if (valeur !== conf) {
    return { valeur: null, erreur: 'Les deux codes que tu as tapés ne sont pas identiques.' };
  }
  return { valeur, erreur: null };
}

// Le délai après N refus consécutifs, plafonné au dernier palier de
// REPRISES_MS (PRD §7.5 : cinq, quinze puis quarante-cinq secondes).
export function delaiApresRefus(refusConsecutifs) {
  if (!Number.isInteger(refusConsecutifs) || refusConsecutifs <= 0) return 0;
  const index = Math.min(refusConsecutifs, REPRISES_MS.length) - 1;
  return REPRISES_MS[index];
}

// Le limiteur d'essais de la reprise, pur et testable sur une horloge
// injectée (PRP 03 : « mesurés sur une horloge injectée »). Un compteur de
// refus consécutifs, jamais un compte de tentatives lié à un tic.
export function creerLimiteurReprise(horloge = Date.now) {
  let refus = 0;
  let attendreJusqua = 0;
  return {
    peutEssayer: () => horloge() >= attendreJusqua,
    attenteMs: () => Math.max(0, attendreJusqua - horloge()),
    refusConsecutifs: () => refus,
    refuser() {
      refus += 1;
      const delai = delaiApresRefus(refus);
      attendreJusqua = horloge() + delai;
      return delai;
    },
    reussir() {
      refus = 0;
      attendreJusqua = 0;
    },
  };
}

// --- la saisie du code, en six cases distinctes (PRP 03 chantier A) --------
//
// « Sur un téléphone posé par terre, on voit combien de chiffres il reste » :
// six cases plutôt qu'un champ unique.
function creerSaisieCode({ id, etiquette }) {
  const bloc = el('div', 'saisie-code');
  bloc.append(el('span', 'etiquette saisie-code__etiquette', etiquette));
  const cases = el('div', 'saisie-code__cases');
  const entrees = [];

  for (let i = 0; i < 6; i += 1) {
    const entree = document.createElement('input');
    entree.type = 'text';
    entree.inputMode = 'numeric';
    entree.autocomplete = 'off';
    entree.pattern = '\\d';
    entree.maxLength = 1;
    entree.className = 'saisie-code__case';
    entree.id = `${id}-${i}`;
    entree.setAttribute('aria-label', `${etiquette} — chiffre ${i + 1} sur 6`);
    entree.addEventListener('input', () => {
      entree.value = String(entree.value ?? '').replace(/\D/g, '').slice(0, 1);
      if (entree.value !== '' && entrees[i + 1]) entrees[i + 1].focus();
    });
    entree.addEventListener('keydown', (evt) => {
      if (evt && evt.key === 'Backspace' && entree.value === '' && entrees[i - 1]) entrees[i - 1].focus();
    });
    entrees.push(entree);
    cases.append(entree);
  }

  bloc.append(cases);

  return {
    noeud: bloc,
    valeur: () => entrees.map((e) => (typeof e.value === 'string' ? e.value : '')).join(''),
    definir(chaine) {
      const s = String(chaine ?? '');
      entrees.forEach((e, i) => { e.value = /\d/.test(s[i] ?? '') ? s[i] : ''; });
    },
  };
}

// --- l'écran 3, et « j'ai déjà un pseudo » ----------------------------------

// PRP 03 chantier C : depuis l'écran 3, une action discrète mène ici.
// pseudonyme, code, et rien d'autre.
//
// POINT D'ACCROCHE PRP 07 : cette vue ne fait AUCUN appel réseau. Si
// `ctx.reprendreCompte(pseudo, code)` est fourni, il doit rendre une Promise
// résolue en `{ ok: true, fiche }` ou `{ ok: false }` — c'est le PRP 07 qui le
// branchera sur `synchro.js`. En son absence, l'écran reste utilisable mais
// dit qu'il n'est pas encore raccordé.
export function monterReprise(hote, ctx) {
  const section = el('section', 'ecran-entree ecran-reprise zone-surete');
  const empiecement = el('div', 'empiecement');
  empiecement.append(el('h1', null, 'Retrouve ton pseudo'));
  section.append(empiecement);

  const corps = el('div', 'jersey corps-entree');

  const labelPseudo = el('label', 'etiquette', 'Ton pseudo');
  labelPseudo.setAttribute('for', 'reprise-pseudo');
  const champPseudo = document.createElement('input');
  champPseudo.type = 'text';
  champPseudo.id = 'reprise-pseudo';
  champPseudo.autocomplete = 'off';

  const saisieCode = creerSaisieCode({ id: 'reprise-code', etiquette: 'Ton code' });
  const erreur = el('p', 'erreur-champ');

  const bouton = el('button', 'bouton', 'Retrouver mes séances');
  bouton.type = 'button';

  const limiteur = creerLimiteurReprise(typeof ctx.horloge === 'function' ? ctx.horloge : Date.now);

  bouton.addEventListener('click', () => {
    if (!limiteur.peutEssayer()) {
      erreur.textContent = `Trop d’essais. Réessaie dans ${Math.ceil(limiteur.attenteMs() / 1000)} s.`;
      return;
    }
    const pseudo = nettoyer(champPseudo.value);
    const code = saisieCode.valeur();
    if (!MOTIF_PSEUDO.test(pseudo) || !MOTIF_CODE.test(code)) {
      // Le message ne dit JAMAIS si c'est le pseudo ou le code qui cloche :
      // distinguer les deux offrirait un oracle d'existence de pseudonymes
      // (PRP 03 chantier C).
      erreur.textContent = 'Pseudo ou code invalide.';
      return;
    }
    if (typeof ctx.reprendreCompte !== 'function') {
      erreur.textContent = 'La reprise n’est pas encore raccordée sur cette page.';
      return;
    }
    Promise.resolve(ctx.reprendreCompte(pseudo, code)).then((reponse) => {
      if (reponse && reponse.ok) {
        limiteur.reussir();
        if (typeof location !== 'undefined') location.hash = '#/jour';
      } else {
        limiteur.refuser();
        erreur.textContent = 'Pseudo ou code incorrect.';
      }
    }).catch(() => {
      erreur.textContent = 'Pas de réseau — réessaie plus tard.';
    });
  });

  let demonterSuivant = null;
  const retour = el('button', 'bouton--discret', 'Retour');
  retour.type = 'button';
  retour.addEventListener('click', () => {
    hote.replaceChildren();
    demonterSuivant = monterEntree(hote, ctx);
  });

  corps.append(labelPseudo, champPseudo, saisieCode.noeud, erreur, bouton, retour);
  section.append(corps);
  hote.append(section);

  return function demonter() {
    if (typeof demonterSuivant === 'function') demonterSuivant();
  };
}

// Les trois écrans du PRD §7.1 : prénom, semaine de départ, compte.
export function monterEntree(hote, ctx) {
  const donnees = {
    prenom: '',
    semaine: 1,
    pseudo: proposerPseudo(),
  };

  let demonterSuivant = null;

  function definirEcran(construire) {
    if (typeof demonterSuivant === 'function') demonterSuivant();
    hote.replaceChildren();
    const resultat = construire();
    demonterSuivant = typeof resultat === 'function' ? resultat : null;
  }

  // Écran 1 — le prénom. Un champ, un bouton (PRP 03 chantier A).
  function ecran1() {
    const section = el('section', 'ecran-entree zone-surete');
    const empiecement = el('div', 'empiecement');
    empiecement.append(el('h1', null, 'Salut, c’est quoi ton prénom ?'));
    section.append(empiecement);

    const corps = el('div', 'jersey corps-entree');
    const label = el('label', 'etiquette', 'Ton prénom');
    label.setAttribute('for', 'entree-prenom');
    const champ = document.createElement('input');
    champ.type = 'text';
    champ.id = 'entree-prenom';
    champ.autocomplete = 'given-name';
    champ.value = donnees.prenom;

    const erreur = el('p', 'erreur-champ');
    const bouton = el('button', 'bouton', 'C’est parti');
    bouton.type = 'button';
    bouton.addEventListener('click', () => {
      const r = validerPrenom(champ.value);
      if (r.erreur !== null) {
        erreur.textContent = r.erreur;
        return;
      }
      erreur.textContent = '';
      donnees.prenom = r.valeur;
      definirEcran(ecran2);
    });

    corps.append(label, champ, erreur, bouton);
    section.append(corps);
    hote.append(section);
  }

  // Écran 2 — la semaine de départ. Huit cibles de 56 px minimum, deux rangs
  // de quatre (PRP 03 chantier A).
  function ecran2() {
    const section = el('section', 'ecran-entree zone-surete');
    const empiecement = el('div', 'empiecement');
    empiecement.append(el('h1', null, 'Tu commences à quelle semaine ?'));
    section.append(empiecement);

    const corps = el('div', 'jersey corps-entree');
    const grille = el('div', 'grille-semaines');
    const boutons = [];
    for (let s = 1; s <= 8; s += 1) {
      const b = el('button', 'cible-semaine', String(s));
      b.type = 'button';
      if (s === donnees.semaine) b.classList.add('choisi');
      b.addEventListener('click', () => {
        donnees.semaine = s;
        boutons.forEach((autre, i) => autre.classList.toggle('choisi', i + 1 === s));
      });
      boutons.push(b);
      grille.append(b);
    }
    corps.append(grille);
    corps.append(el('p', null, 'Si tu as déjà commencé sur ta feuille, choisis la semaine où tu en es.'));

    const bouton = el('button', 'bouton', 'Continuer');
    bouton.type = 'button';
    bouton.addEventListener('click', () => definirEcran(ecran3));
    corps.append(bouton);

    section.append(corps);
    hote.append(section);
  }

  // Écran 3 — le compte. Le texte du PRD §7.1 est AU-DESSUS des champs.
  //
  // AUCUN FETCH ICI : la fiche est écrite dans l'état local, et
  // `ctx.surCompteCree(...)` — s'il est fourni par le PRP 07 — est appelé
  // ensuite. `etat.dernierSucces` restant `null` EST le marqueur « à créer »
  // (PRP 03 chantier D, PRD §7.5 tableau) : le PRP 07 sait qu'un pseudo/code
  // présents sans succès de synchronisation doivent encore être créés côté
  // serveur.
  //
  // A18 (« Ajouté après les PRP ») : sa réponse est désormais ATTENDUE, pas
  // lancée puis oubliée — un serveur qui ne répond pas ne bloque toujours pas
  // l'entrée, mais un serveur qui répond « pseudo déjà pris » doit être
  // entendu, voir le gestionnaire de clic plus bas.
  function ecran3() {
    const section = el('section', 'ecran-entree ecran-entree-compte zone-surete');
    const empiecement = el('div', 'empiecement');
    empiecement.append(el('h1', null, 'Pour te retrouver sur un autre téléphone'));
    section.append(empiecement);

    const corps = el('div', 'jersey corps-entree');
    corps.append(el('p', 'explication-code', EXPLICATION_CODE));

    const labelPseudo = el('label', 'etiquette', 'Ton pseudo');
    labelPseudo.setAttribute('for', 'entree-pseudo');
    const champPseudo = document.createElement('input');
    champPseudo.type = 'text';
    champPseudo.id = 'entree-pseudo';
    champPseudo.autocomplete = 'off';
    champPseudo.value = donnees.pseudo;

    const autrePseudo = el('button', 'bouton--discret', 'Un autre pseudo');
    autrePseudo.type = 'button';
    autrePseudo.addEventListener('click', () => {
      donnees.pseudo = proposerPseudo();
      champPseudo.value = donnees.pseudo;
    });

    const erreurPseudo = el('p', 'erreur-champ');

    const code = creerSaisieCode({ id: 'entree-code', etiquette: 'Ton code (six chiffres)' });
    const confirmation = creerSaisieCode({ id: 'entree-code-confirme', etiquette: 'Confirme ton code' });
    const erreurCode = el('p', 'erreur-champ');

    const bouton = el('button', 'bouton', 'Créer mon compte');
    bouton.type = 'button';
    // A18 (« Ajouté après les PRP », défaut de production remonté le
    // 15 août 2026) : un pseudonyme déjà pris n'est PLUS un succès silencieux.
    // Avant, `ctx.surCompteCree(...)` était lancé sans attendre sa réponse, et
    // la navigation vers « #/jour » partait aussitôt — un 409 (pseudo pris)
    // laissait un compte purement local, bon pseudonyme et bon code, qui ne
    // synchroniserait jamais. Ici, la création est ATTENDUE ; un pseudonyme
    // déjà pris tente la REPRISE avec exactement ce qu'elle vient de taper
    // (presque toujours elle-même qui revient), sans lui redemander son code.
    bouton.addEventListener('click', async () => {
      const rPseudo = validerPseudo(champPseudo.value);
      if (rPseudo.erreur !== null) {
        erreurPseudo.textContent = rPseudo.erreur;
        return;
      }
      erreurPseudo.textContent = '';

      const rCode = validerCode(code.valeur(), confirmation.valeur());
      if (rCode.erreur !== null) {
        erreurCode.textContent = rCode.erreur;
        return;
      }
      erreurCode.textContent = '';

      ecrireEtat({
        prenom: donnees.prenom,
        semaineDeDepart: donnees.semaine,
        debut: ctx.maintenant().toISOString(),
        pseudo: rPseudo.valeur,
        code: rCode.valeur,
      });

      // Sans point d'accroche (lot 1 seul, ou tests qui ne le fournissent
      // pas) : le compte reste local, comme avant A18, et l'entrée n'est
      // jamais bloquée.
      if (typeof ctx.surCompteCree !== 'function') {
        if (typeof location !== 'undefined') location.hash = '#/jour';
        return;
      }

      bouton.disabled = true;
      const resultat = await Promise.resolve(ctx.surCompteCree({
        pseudo: rPseudo.valeur, code: rCode.valeur, prenom: donnees.prenom, semaineDeDepart: donnees.semaine,
      })).catch(() => ({ ok: false, code: 'reseau' }));
      bouton.disabled = false;

      if (resultat && resultat.ok === false && resultat.code === 'pseudo-pris') {
        const reprise = typeof ctx.reprendreCompte === 'function'
          ? await Promise.resolve(ctx.reprendreCompte(rPseudo.valeur, rCode.valeur)).catch(() => ({ ok: false }))
          : { ok: false };
        if (reprise && reprise.ok) {
          if (typeof location !== 'undefined') location.hash = '#/jour';
          return;
        }
        // « Si le code ne correspond pas, elle propose un autre pseudonyme,
        // comme prévu » (PRD A18) : le bouton « Un autre pseudo » reste juste
        // au-dessus, inchangé.
        erreurPseudo.textContent = 'Ce pseudo existe déjà. Si c’est le tien, vérifie ton code — sinon, choisis-en un autre.';
        return;
      }

      // Tout le reste — un succès, ou un serveur injoignable — ne bloque
      // JAMAIS l'entrée (PRD §7.1 : « un serveur qui ne répond pas ne bloque
      // pas l'entrée »). Seul un refus EXPLICITE et NON AMBIGU (pseudo pris,
      // et la reprise ne l'a pas résolu) arrête la navigation.
      if (typeof location !== 'undefined') location.hash = '#/jour';
    });

    const lienReprise = el('button', 'bouton--discret', 'J’ai déjà un pseudo');
    lienReprise.type = 'button';
    lienReprise.addEventListener('click', () => {
      definirEcran(() => monterReprise(hote, ctx));
    });

    corps.append(
      labelPseudo,
      champPseudo,
      autrePseudo,
      erreurPseudo,
      code.noeud,
      confirmation.noeud,
      erreurCode,
      bouton,
      lienReprise,
    );
    section.append(corps);
    hote.append(section);
  }

  definirEcran(ecran1);

  return function demonter() {
    if (typeof demonterSuivant === 'function') demonterSuivant();
  };
}

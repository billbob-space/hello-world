// vue-reglages.js — prénom, pseudonyme, sauvegarde, effacement (PRP 05
// chantier D, PRP 07 chantier D, PRD §7.5, §10, §11.2).
//
// C'est le SEUL endroit de l'application ou l'etat d'une synchronisation
// s'affiche (PRP 07 chantier D) : l'ecran de seance est en gainage, l'etat
// d'une requete HTTP ne le regarde pas.

import {
  lireEtat, ecrireEtat, effacerEtat, EVT_ETAT,
} from './etat.js';
import { effacer as effacerSurLeServeur, etatSynchro, EVT_SYNCHRO } from './synchro.js';
import { EXPLICATION_CODE, validerPrenom } from './vue-entree.js';
import {
  SONNERIES, SONNERIE_PAR_DEFAUT, debloquerAudio, sonnerie as jouerSonnerie,
} from './sonnerie.js';
import { verrouEcranDisponible } from './app.js';

function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

// Une icone en trait, jamais un glyphe de police (finition, correctif 8) :
// un seul poids de trait, une seule taille optique (`.icone-fleche`,
// style.css). Le HTML est analyse par le parseur HTML (innerHTML), qui
// bascule seul dans l'espace de noms SVG : `xmlns` n'est donc pas
// necessaire ici, et sa presence litterale casserait le test « aucune URL
// absolue » (tests/coque.test.js).
function iconeFleche() {
  const span = el('span', 'icone-fleche');
  span.innerHTML = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 5 8 12 15 19"/></svg>';
  return span;
}

// La phrase exacte de ce qui part (PRP 05 chantier D) : la fiche du serveur
// ET ce que garde le telephone, et c'est irreversible — dit comme tel.
export const PHRASE_EFFACEMENT = 'Ta fiche sur le serveur, et tout ce que garde ce téléphone, vont disparaître. '
  + 'C’est définitif : personne ne pourra te les rendre.';

// A7 (« Ajouté après les PRP ») : ce qui dit QUOI FAIRE si l'écoute ne sort
// aucun son. Sur Android, le son d'une page web suit le volume MÉDIA, qui ne
// bouge avec les boutons de volume que pendant qu'un son joue — le seul
// moment où ils règlent le bon canal. Aucune page web ne peut lever ça ;
// cette phrase la rend au moins constatable.
export const PHRASE_VOLUME_MEDIA = 'Tu n’entends rien ? Appuie sur les boutons de volume du téléphone PENDANT '
  + 'que le son joue : c’est le seul moment où ils règlent le bon volume.';

// A11 (« Ajouté après les PRP ») : dit franchement ce que ce navigateur sait
// tenir. Une promesse qu'on ne tient pas est pire que pas de promesse — elle
// fait poser le téléphone loin, en confiance.
export const PHRASE_ECRAN_INDISPONIBLE = 'Ce téléphone ne sait pas garder l’écran allumé automatiquement : '
  + 'pense à vérifier qu’il ne s’éteint pas tout seul pendant une séance.';

function estEnLigne() {
  if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') return true;
  return navigator.onLine;
}

export function monterReglages(hote, ctx) {
  const { maintenant } = ctx;

  const section = el('section', 'ecran-reglages zone-surete');
  const empiecement = el('div', 'empiecement empiecement--compact');
  empiecement.append(el('h1', null, 'Réglages'));
  section.append(empiecement);

  const corps = el('div', 'jersey corps-reglages');
  const retour = document.createElement('a');
  retour.className = 'bouton--discret lien-retour';
  retour.href = '#/jour';
  retour.append(iconeFleche(), el('span', 'lien-retour__libelle', 'Aujourd’hui'));
  corps.append(retour);

  // 1. Le prenom. Un champ, un bouton, AUCUNE confirmation : c'est
  // reversible (PRP 05 chantier D).
  const blocPrenom = el('div', 'reglage-bloc');
  blocPrenom.append(el('span', 'etiquette', 'Ton prénom'));
  const champPrenom = document.createElement('input');
  champPrenom.type = 'text';
  champPrenom.id = 'reglages-prenom';
  champPrenom.autocomplete = 'given-name';
  champPrenom.value = lireEtat().prenom ?? '';
  const erreurPrenom = el('p', 'erreur-champ');
  const boutonPrenom = el('button', 'bouton--discret', 'Enregistrer');
  boutonPrenom.type = 'button';
  boutonPrenom.addEventListener('click', () => {
    const r = validerPrenom(champPrenom.value);
    if (r.erreur !== null) {
      erreurPrenom.textContent = r.erreur;
      return;
    }
    erreurPrenom.textContent = '';
    ecrireEtat({ prenom: r.valeur });
  });
  blocPrenom.append(champPrenom, erreurPrenom, boutonPrenom);

  // 2. Le pseudonyme, affiche en clair. Le code, lui, n'est JAMAIS affiche
  // (PRP 05 chantier D) : il vit sur l'appareil, le montrer n'aiderait qu'a
  // le laisser trainer.
  //
  // « TON PSEUDO » en surtitre au-dessus du pseudonyme est banni par le
  // plancher de qualite (finition, correctif 6) : ce n'est pas l'etiquette
  // d'un champ de formulaire, contrairement a « Ton prenom » ci-dessus. Le
  // mot reste, mais dans la phrase elle-meme, pas au-dessus d'elle.
  const blocPseudo = el('div', 'reglage-bloc');
  blocPseudo.append(el('p', 'reglage-pseudo', `Ton pseudo : ${lireEtat().pseudo ?? '—'}`));
  blocPseudo.append(el('p', 'explication-code', EXPLICATION_CODE));

  // 2 bis. La sonnerie (A7, « Ajouté après les PRP ») : un choix parmi
  // plusieurs timbres, et un bouton pour l'écouter TOUT DE SUITE, sans lancer
  // de séance — c'est l'essentiel du correctif, on découvre en trois
  // secondes que le téléphone est muet, au lieu de le découvrir en plein
  // gainage.
  const blocSonnerie = el('div', 'reglage-bloc');
  blocSonnerie.append(el('span', 'etiquette', 'Ta sonnerie'));

  const listeSonneries = el('div', 'liste-sonneries');
  const boutonsSonnerie = [];
  let sonnerieChoisie = SONNERIES.some((s) => s.id === lireEtat().sonnerie)
    ? lireEtat().sonnerie
    : SONNERIE_PAR_DEFAUT;

  for (const s of SONNERIES) {
    const choix = el('button', 'choix-sonnerie', s.nom);
    choix.type = 'button';
    choix.setAttribute('aria-pressed', String(s.id === sonnerieChoisie));
    choix.classList.toggle('choix-sonnerie--choisie', s.id === sonnerieChoisie);
    choix.addEventListener('click', () => {
      sonnerieChoisie = s.id;
      ecrireEtat({ sonnerie: s.id });
      boutonsSonnerie.forEach(({ bouton, id }) => {
        const choisie = id === sonnerieChoisie;
        bouton.setAttribute('aria-pressed', String(choisie));
        bouton.classList.toggle('choix-sonnerie--choisie', choisie);
      });
    });
    boutonsSonnerie.push({ bouton: choix, id: s.id });
    listeSonneries.append(choix);
  }
  blocSonnerie.append(listeSonneries);

  const boutonEcouter = el('button', 'bouton--discret', 'L’écouter maintenant');
  boutonEcouter.type = 'button';
  boutonEcouter.addEventListener('click', () => {
    debloquerAudio();
    jouerSonnerie(sonnerieChoisie);
  });
  blocSonnerie.append(boutonEcouter);
  blocSonnerie.append(el('p', null, PHRASE_VOLUME_MEDIA));

  // 2 ter. L'écran allumé pendant les séances (A11, « Ajouté après les
  // PRP ») : active par défaut (PRD §5). Coupée, aucun verrou n'est demandé
  // (vue-seance.js lit `etat.ecranAllume` au montage). Si ce navigateur ne
  // sait pas tenir l'écran allumé, l'écran le dit franchement plutôt que de
  // laisser croire que l'option marche.
  const blocEcran = el('div', 'reglage-bloc');
  blocEcran.append(el('span', 'etiquette', 'Pendant les séances'));
  const boutonEcran = el('button', 'bouton--discret', '');
  boutonEcran.type = 'button';

  function libelleEcran(actif) {
    return actif ? 'Garder l’écran allumé : activé' : 'Garder l’écran allumé : désactivé';
  }

  function rafraichirEcran() {
    const actif = lireEtat().ecranAllume !== false;
    boutonEcran.textContent = libelleEcran(actif);
    boutonEcran.setAttribute('aria-pressed', String(actif));
  }
  rafraichirEcran();

  boutonEcran.addEventListener('click', () => {
    ecrireEtat({ ecranAllume: !(lireEtat().ecranAllume !== false) });
    rafraichirEcran();
  });
  blocEcran.append(boutonEcran);
  if (!verrouEcranDisponible()) {
    blocEcran.append(el('p', null, PHRASE_ECRAN_INDISPONIBLE));
  }

  // 3. L'etat de la sauvegarde — la phrase du PRP 07, en francais, sans
  // jargon, et qui ne bloque jamais rien.
  const blocSynchro = el('div', 'reglage-bloc');
  blocSynchro.append(el('span', 'etiquette', 'Ta sauvegarde'));
  const phraseSynchro = el('p', 'etat-synchro');
  blocSynchro.append(phraseSynchro);

  function rafraichirSynchro() {
    const info = etatSynchro(lireEtat(), maintenant, estEnLigne());
    phraseSynchro.textContent = info.phrase;
    phraseSynchro.className = `etat-synchro etat-synchro--${info.statut}`;
  }
  rafraichirSynchro();

  // 4. Effacer la fiche — confirmation explicite, irreversible, dit comme
  // tel (PRP 05 chantier D).
  const blocEffacement = el('div', 'reglage-bloc');
  const boutonEffacer = el('button', 'bouton--discret', 'Effacer ma fiche');
  boutonEffacer.type = 'button';
  const confirmation = el('div', 'confirmation-case');
  confirmation.hidden = true;

  function fermerConfirmation() {
    confirmation.hidden = true;
    confirmation.replaceChildren();
  }

  boutonEffacer.addEventListener('click', () => {
    confirmation.replaceChildren();
    confirmation.hidden = false;
    confirmation.append(el('p', 'confirmation-case__question', PHRASE_EFFACEMENT));
    const rangee = el('div', 'confirmation-case__boutons');
    const oui = el('button', 'bouton', 'Oui, tout effacer');
    oui.type = 'button';
    const non = el('button', 'bouton--discret', 'Non');
    non.type = 'button';
    oui.addEventListener('click', () => {
      const etatActuel = lireEtat();
      // Un refus du code cote serveur n'empeche JAMAIS le geste d'aboutir
      // cote appareil (PRP 05 chantier D) : `effacerEtat()` s'execute quoi
      // qu'il arrive au reseau.
      Promise.resolve(effacerSurLeServeur(etatActuel, {})).catch(() => {}).then(() => {
        effacerEtat();
        fermerConfirmation();
        if (typeof location !== 'undefined') location.hash = '#/entree';
      });
    });
    non.addEventListener('click', fermerConfirmation);
    rangee.append(oui, non);
    confirmation.append(rangee);
  });
  blocEffacement.append(boutonEffacer, confirmation);

  corps.append(blocPrenom, blocPseudo, blocSonnerie, blocEcran, blocSynchro, blocEffacement);
  section.append(corps);
  hote.append(section);

  function surEvenement() { rafraichirSynchro(); }
  const cible = globalThis;
  if (typeof cible.addEventListener === 'function') {
    cible.addEventListener(EVT_SYNCHRO, surEvenement);
    cible.addEventListener(EVT_ETAT, surEvenement);
    cible.addEventListener('online', surEvenement);
    cible.addEventListener('offline', surEvenement);
  }

  return function demonter() {
    if (typeof cible.removeEventListener === 'function') {
      cible.removeEventListener(EVT_SYNCHRO, surEvenement);
      cible.removeEventListener(EVT_ETAT, surEvenement);
      cible.removeEventListener('online', surEvenement);
      cible.removeEventListener('offline', surEvenement);
    }
  };
}

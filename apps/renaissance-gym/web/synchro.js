// synchro.js — le client de l'API (PRP 07, PRD §7.5, §9.8, §9.9, §11.2, §14).
//
// Le réseau n'est jamais une dépendance de fonctionnement : chaque fonction
// d'ici rattrape ses propres erreurs et ne lève jamais (PRD §11.2). La
// réponse du serveur est toujours FUSIONNÉE, jamais substituée — c'est
// l'ossature §7 point 3, et c'est le test le plus important de ce fichier :
// aucune réponse serveur ne peut retirer un fait local.

import { ecrireEtat, lireEtat, EVT_ETAT } from './etat.js';
import { fusionner, progression } from './domaine.js';

export const CHEMIN_API = '/api/fiche';
export const DELAI_MS = 8000; // au-dela, un portail captif ment
export const INTERVALLE_MIN_MS = 30000; // debit des declenchements automatiques
export const REPRISES_MS = [5000, 15000, 45000];
export const EVT_SYNCHRO = 'gym:synchro-maj';

export const PHRASES = {
  'a-jour': 'Sauvegardé',
  'en-attente': 'Ce sera sauvegardé au prochain réseau',
  'hors-ligne': 'Pas de réseau — ce sera sauvegardé plus tard',
  jamais: 'Pas encore sauvegardé',
  echec: 'La sauvegarde n’a pas marché. On réessaiera tout seul.',
};

function listeUnie(a, b) {
  return [...new Set([...(a ?? []), ...(b ?? [])])];
}

// --- les corps envoyés : le code ne voyage JAMAIS ailleurs que dans son
// propre champ (PRP 07 : « le corps envoyé ne contient jamais le code en
// clair hors du champ code lui-même »). ----------------------------------

export function corpsSynchronisation(etat) {
  return {
    operation: 'synchroniser',
    pseudo: etat.pseudo,
    code: etat.code,
    prenom: etat.prenom ?? '',
    semaineDepart: etat.semaineDeDepart ?? 0,
    faits: etat.faits ?? [],
    badges: etat.badges ?? [],
  };
}

function corpsCreation(etat) {
  return {
    operation: 'creer',
    pseudo: etat.pseudo,
    code: etat.code,
    prenom: etat.prenom ?? '',
    semaineDepart: etat.semaineDeDepart ?? 1,
  };
}

function corpsEffacement(etat) {
  return { operation: 'effacer', pseudo: etat.pseudo, code: etat.code };
}

// Y a-t-il un compte, et quelque chose qui n'a pas encore été confirmé
// sauvegardé ? Un fait plus récent que le dernier succès, ou aucun succès du
// tout, valent tous les deux « oui ».
export function envoiNecessaire(etat) {
  if (!etat.pseudo || !etat.code) return false;
  if (etat.dernierSucces === null || etat.dernierSucces === undefined) return true;
  const dernierFait = (etat.faits ?? []).reduce((max, f) => (max === null || f.a > max ? f.a : max), null);
  return dernierFait !== null && dernierFait > etat.dernierSucces;
}

// --- l'appel réseau, commun aux trois opérations --------------------------

function estFonction(v) {
  return typeof v === 'function';
}

async function requete(corps, options) {
  const fetchImpl = estFonction(options.fetch) ? options.fetch : globalThis.fetch;
  if (!estFonction(fetchImpl)) return { ok: false, code: 'reseau-indisponible' };

  const delaiMs = Number.isFinite(options.delaiMs) ? options.delaiMs : DELAI_MS;
  const controleur = estFonction(globalThis.AbortController) ? new globalThis.AbortController() : null;
  const minuteur = controleur ? setTimeout(() => controleur.abort(), delaiMs) : null;

  try {
    const reponse = await fetchImpl(CHEMIN_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
      signal: controleur ? controleur.signal : undefined,
    });

    if (reponse.status === 204) return { ok: true, corps: null };

    let donnees = null;
    try {
      donnees = await reponse.json();
    } catch {
      donnees = null;
    }

    if (!reponse.ok) {
      const code = donnees && typeof donnees.erreur === 'string' ? donnees.erreur : 'erreur-inconnue';
      return { ok: false, code, statut: reponse.status };
    }
    return { ok: true, corps: donnees };
  } catch {
    // Coupure reseau, portail captif, delai depasse : jamais d'exception qui
    // remonte a l'appelant (PRD §11.2).
    return { ok: false, code: 'reseau' };
  } finally {
    if (minuteur !== null) clearTimeout(minuteur);
  }
}

// La réponse du serveur ne remplace JAMAIS l'état local : elle s'y fusionne
// (ossature §7 point 3). `prenom` et `semaineDeDepart` suivent le dernier
// écrit (PRD §9.9), avec la précision du PRP 07 chantier C : l'appareil
// n'adopte la valeur du serveur que si la sienne est vide, ou si le serveur a
// été mis à jour plus récemment que son propre dernier succès. `debut`, que
// le serveur ne connaît pas, s'ancre sur la date de création de la fiche
// quand l'appareil n'en a pas encore une à lui — c'est ce qui permet à un
// second téléphone de retrouver la même semaine courante que le premier.
function fusionnerReponse(etat, reponse, maintenant) {
  const localVide = etat.prenom === null || etat.prenom === undefined || etat.prenom === '';
  const succesPrecedent = etat.dernierSucces ?? null;
  const serveurPlusRecent = succesPrecedent === null
    || (typeof reponse.majLe === 'string' && new Date(reponse.majLe).getTime() > new Date(succesPrecedent).getTime());
  const adopteDuServeur = localVide || serveurPlusRecent;

  const maintenantISO = maintenant().toISOString();
  return {
    pseudo: reponse.pseudo ?? etat.pseudo,
    // Le serveur ne rend jamais le code (PRD §10.3) : c'est celui deja
    // connu localement qui doit survivre a la fusion, sans quoi une reprise
    // reussie effacerait le seul moyen de la refaire sur un troisieme
    // appareil.
    code: etat.code,
    prenom: adopteDuServeur ? reponse.prenom : etat.prenom,
    semaineDeDepart: adopteDuServeur ? reponse.semaineDepart : etat.semaineDeDepart,
    debut: etat.debut ?? reponse.creeeLe ?? null,
    faits: fusionner(etat.faits ?? [], reponse.faits ?? []),
    badges: listeUnie(etat.badges, reponse.badges),
    dernierEnvoi: maintenantISO,
    dernierSucces: maintenantISO,
  };
}

function emettreSynchro() {
  if (typeof globalThis.dispatchEvent !== 'function') return;
  try {
    const Evenement = typeof globalThis.CustomEvent === 'function' ? globalThis.CustomEvent : globalThis.Event;
    globalThis.dispatchEvent(new Evenement(EVT_SYNCHRO));
  } catch (err) {
    console.warn('renaissance-gym : l’evenement de synchro n’a pas pu etre emis', err);
  }
}

function maintenantDe(options) {
  return estFonction(options.maintenant) ? options.maintenant : () => new Date();
}

// creer() enregistre le compte marqué « à créer » (PRP 03 chantier D,
// PRP 07 chantier E) : `etat.dernierSucces === null` est ce marqueur.
export async function creer(etat, options = {}) {
  const maintenant = maintenantDe(options);
  const resultat = await requete(corpsCreation(etat), options);

  if (!resultat.ok) {
    ecrireEtat({ dernierEnvoi: maintenant().toISOString() });
    emettreSynchro();
    return { ok: false, code: resultat.code };
  }

  const etatMaj = ecrireEtat(fusionnerReponse(etat, resultat.corps, maintenant));
  emettreSynchro();
  return { ok: true, fiche: resultat.corps, etat: etatMaj };
}

// synchroniser() lit, fusionne et fait reconnaitre l'appareil (PRD §10.4).
// C'est aussi l'operation de la REPRISE sur un second telephone (chantier E
// du PRD §10.4 : « pseudonyme + code -> la fiche fusionnee avec ce que
// l'appareil apporte » — un appareil neuf apporte des faits vides, et repart
// avec tout ce que le serveur gardait).
export async function synchroniser(etat, options = {}) {
  const maintenant = maintenantDe(options);
  const resultat = await requete(corpsSynchronisation(etat), options);

  if (!resultat.ok) {
    ecrireEtat({ dernierEnvoi: maintenant().toISOString() });
    emettreSynchro();
    return { ok: false, code: resultat.code };
  }

  const etatMaj = ecrireEtat(fusionnerReponse(etat, resultat.corps, maintenant));
  emettreSynchro();
  return { ok: true, fiche: resultat.corps, etat: etatMaj };
}

// effacer() n'ecrit RIEN localement : l'effacement du telephone est un geste
// distinct, decide par l'ecran qui appelle cette fonction, qui doit aboutir
// meme si le serveur refuse (PRP 05 chantier D : un code qui n'est plus le
// bon ne doit jamais garder l'appareil prisonnier d'une fiche inaccessible).
export async function effacer(etat, options = {}) {
  const resultat = await requete(corpsEffacement(etat), options);
  emettreSynchro();
  if (!resultat.ok) return { ok: false, code: resultat.code };
  return { ok: true };
}

// --- l'affichage, reserve aux reglages (PRP 07 chantier D) ----------------

function commeDate(v) {
  return v instanceof Date ? v : new Date(v);
}

export function formaterFraicheur(recuA, maintenant) {
  if (recuA === null || recuA === undefined) return '';
  const base = estFonction(maintenant) ? maintenant() : maintenant;
  const ecouleMs = commeDate(base).getTime() - commeDate(recuA).getTime();
  const minutes = Math.floor(ecouleMs / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  if (jours === 1) return 'hier';
  return `il y a ${jours} j`;
}

// Statut ET phrase, en un seul appel pur (aucun DOM, aucun reseau). Ordre des
// verifications : d'abord « jamais tente » (compte absent ou aucun envoi),
// puis « hors ligne » (ce que l'appareil sait de lui-meme, prioritaire sur le
// reste), puis « le dernier essai a echoue », puis « quelque chose attend
// encore d'etre envoye », enfin « a jour ».
export function etatSynchro(etat, maintenant, enLigne) {
  const compte = Boolean(etat.pseudo) && Boolean(etat.code);
  if (!compte || etat.dernierEnvoi === null || etat.dernierEnvoi === undefined) {
    return { statut: 'jamais', phrase: PHRASES.jamais, fraicheur: null };
  }

  if (!enLigne) {
    return { statut: 'hors-ligne', phrase: PHRASES['hors-ligne'], fraicheur: null };
  }

  const dernierEssaiAEchoue = etat.dernierSucces === null || etat.dernierSucces === undefined
    || etat.dernierEnvoi > etat.dernierSucces;
  if (dernierEssaiAEchoue) {
    return { statut: 'echec', phrase: PHRASES.echec, fraicheur: null };
  }

  if (envoiNecessaire(etat)) {
    return { statut: 'en-attente', phrase: PHRASES['en-attente'], fraicheur: null };
  }

  const fraicheur = formaterFraicheur(etat.dernierSucces, maintenant);
  return { statut: 'a-jour', phrase: `${PHRASES['a-jour']} ${fraicheur}`, fraicheur };
}

// --- quand ça part : les trois declencheurs (PRP 07 chantier B) -----------
//
// 1. A la fin d'une seance : detecte sans toucher a vue-seance.js, en
//    observant le nombre total de seances faites transiter d'une valeur a
//    une valeur plus haute a chaque `EVT_ETAT` (emis par etat.js a CHAQUE
//    ecriture, y compris chaque exercice valide). Un exercice seul ne fait
//    jamais franchir ce seuil : seul le dernier exercice d'une seance le
//    fait, puisque c'est lui qui fait passer `seanceEstFaite` de faux a vrai.
// 2. Au retour du reseau (`online`).
// 3. A l'ouverture de l'application : un appel immediat au branchement.
//
// `INTERVALLE_MIN_MS` borne le debit des trois a la fois : jamais deux
// tentatives a moins de trente secondes d'ecart, quelle qu'en soit la cause.
export function brancher(ctx, options = {}) {
  const { programme } = ctx;
  const maintenant = maintenantDe(options);
  const lireEtatActuel = estFonction(options.lireEtat) ? options.lireEtat : lireEtat;

  let dernierDeclenchement = 0;
  let totalSeancesConnu = programme ? progression(programme, lireEtatActuel().faits).seancesFaites : 0;
  let enCours = false;

  function peutDeclencher() {
    return maintenant().getTime() - dernierDeclenchement >= INTERVALLE_MIN_MS;
  }

  async function tenter() {
    if (enCours || !peutDeclencher()) return;
    const etat = lireEtatActuel();
    if (!envoiNecessaire(etat)) return;
    enCours = true;
    dernierDeclenchement = maintenant().getTime();
    try {
      if (etat.dernierSucces === null || etat.dernierSucces === undefined) {
        await creer(etat, options);
      } else {
        await synchroniser(etat, options);
      }
    } finally {
      enCours = false;
    }
  }

  function surEtatModifie() {
    if (!programme) return;
    const etat = lireEtatActuel();
    const total = progression(programme, etat.faits).seancesFaites;
    const uneSeanceVientDeSeTerminer = total > totalSeancesConnu;
    totalSeancesConnu = total;
    if (uneSeanceVientDeSeTerminer) tenter().catch(() => {});
  }

  function surRetourReseau() {
    tenter().catch(() => {});
  }

  if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener(EVT_ETAT, surEtatModifie);
    globalThis.addEventListener('online', surRetourReseau);
  }

  // Declencheur 3 : l'ouverture de l'application elle-meme.
  tenter().catch(() => {});

  return function debrancher() {
    if (typeof globalThis.removeEventListener === 'function') {
      globalThis.removeEventListener(EVT_ETAT, surEtatModifie);
      globalThis.removeEventListener('online', surRetourReseau);
    }
  };
}

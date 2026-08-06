// classement.js — ce qui est ENVOYE au serveur, et quand.
//
// Ce module ne dit rien a l'ecran : vue-rejoindre.js s'en charge. La separation
// n'est pas de l'esthetique, c'est ce qui rend verifiable, sans navigateur ni
// reseau, la garantie du PRD §5 — le nom qui reste sur le telephone ne peut pas
// atteindre la couche reseau, parce que la couche reseau ne le lit nulle part.
//
// Il n'y a pas de file de messages, il y a une COMPARAISON. Le corps envoye
// porte l'etat complet — la liste des identifiants coches — et non un delta :
// un envoi est donc idempotent, deux envois successifs ne se composent pas, et
// le second suffit. On enregistre la derniere confirmation recue, et un envoi
// est du des que l'etat local en differe. La reprise apres coupure n'est pas un
// mecanisme, c'est une consequence.

import { ecrireClassement, effacerClassement, lireClassement, lireFaits } from './etat.js';
import { EVT_SEANCE_COMPLETE } from './vue-seance.js';

export const CHEMIN_API = '/api/classement';

// Au-dela, un portail captif ment : sans delai, sa promesse reste en suspens
// pour toujours et l'interface annonce « a jour » alors que rien n'est parti.
export const DELAI_MS = 8000;

// Debit des declenchements automatiques. Le rate-limit du palier public — 50
// requetes par seconde et par IP — s'applique a un enfant comme a un robot, et
// une famille derriere un partage de connexion sort de la meme adresse.
export const INTERVALLE_MIN_MS = 30000;

// Reprises apres echec, puis abandon jusqu'au declencheur suivant : un telephone
// hors reseau ne doit pas passer la nuit a reessayer. L'evenement `online` le
// reveillera.
export const REPRISES_MS = [5000, 15000, 45000];

// Le point d'accroche du PRP 09. CustomEvent sur document, bubbles: true,
// detail { instantane, moi, statut }.
export const EVT_CLASSEMENT = 'marcq:classement-maj';

// --- ce qui declenche un envoi --------------------------------------------

// `${nombre de cles}:${horodatage maximum}`, '' si rien n'est coche. Cocher
// augmente le maximum — etat.js pose new Date().toISOString() —, decocher
// diminue le nombre : toute modification change donc l'empreinte, sans hachage.
export function empreinte(faits) {
  const ids = Object.keys(faits ?? {});
  if (ids.length === 0) return '';
  let max = '';
  for (const id of ids) {
    const quand = faits[id];
    if (typeof quand === 'string' && quand > max) max = quand;
  }
  return `${ids.length}:${max}`;
}

// Trois cles sur les cinq que le serveur accepte : le PRP 10 elargira cette
// signature avec `ressentis`, et corpsSuppression porte `supprimer`. Les
// identifiants sont tries pour qu'un meme etat produise un meme corps — ce qui
// se relit dans les journaux d'un navigateur sans avoir a trier a l'oeil.
export function corpsEnvoi({ pseudo, code, faits }) {
  return { pseudo, code, faits: Object.keys(faits ?? {}).sort() };
}

export function corpsSuppression({ pseudo, code }) {
  return { pseudo, code, supprimer: true };
}

export function envoiNecessaire(local, faits) {
  if (local?.pseudo == null) return false;
  return empreinte(faits) !== (local.dernierEnvoi?.empreinte ?? '');
}

// --- les trois appels ------------------------------------------------------

// Le corps d'une reponse n'est decode que si elle s'annonce en JSON : le 405 de
// http.ServeMux repond en texte brut, et un JSON.parse dessus jetterait dans le
// chemin d'erreur, c'est-a-dire la ou plus rien ne rattrape.
async function corpsJson(reponse) {
  const type = reponse.headers?.get?.('content-type') ?? '';
  if (!type.includes('application/json')) return null;
  try {
    return await reponse.json();
  } catch {
    return null;
  }
}

// Aucun parametre d'URL, jamais : le pseudonyme et le code ne circulent que dans
// le corps d'un POST. Une URL part dans les journaux d'acces et dans l'en-tete
// Referer, et l'ossature §9 impose des journaux qui n'apprennent aucune
// identite.
async function requete(init, options) {
  const appeler = options.fetch ?? globalThis.fetch;
  let reponse;
  try {
    reponse = await appeler(CHEMIN_API, {
      cache: 'no-store',
      signal: AbortSignal.timeout(DELAI_MS),
      ...init,
    });
  } catch {
    // Pas de reseau, delai depasse, requete avortee : statut 0. Jamais une
    // promesse rejetee — l'appelant n'a qu'une forme a lire.
    return { ok: false, statut: 0, erreur: null, message: null };
  }

  const corps = await corpsJson(reponse);
  if (!reponse.ok) {
    return {
      ok: false,
      statut: reponse.status,
      erreur: corps?.erreur ?? null,
      message: corps?.message ?? null,
    };
  }
  if (corps === null) {
    // Un 200 sans corps lisible n'est pas un succes exploitable.
    return { ok: false, statut: reponse.status, erreur: null, message: null };
  }
  return { ok: true, statut: reponse.status, corps };
}

const ENTETES_JSON = { 'Content-Type': 'application/json', Accept: 'application/json' };

export async function relever(options = {}) {
  const r = await requete({ method: 'GET', headers: { Accept: 'application/json' } }, options);
  if (!r.ok) return r;
  return { ok: true, statut: r.statut, instantane: r.corps, moi: null, suppression: null, cree: false };
}

export async function envoyer({ pseudo, code, faits }, options = {}) {
  const r = await requete({
    method: 'POST',
    headers: ENTETES_JSON,
    body: JSON.stringify(corpsEnvoi({ pseudo, code, faits })),
  }, options);
  if (!r.ok) return r;
  // 201 a la creation du pseudonyme, 200 a chaque mise a jour : le corps est le
  // meme, plat, dans les deux cas. `cree` sert a l'ecran, jamais au stockage.
  return { ok: true, statut: r.statut, instantane: null, moi: r.corps, suppression: null, cree: r.statut === 201 };
}

export async function supprimer({ pseudo, code }, options = {}) {
  const r = await requete({
    method: 'POST',
    headers: ENTETES_JSON,
    body: JSON.stringify(corpsSuppression({ pseudo, code })),
  }, options);
  if (!r.ok) return r;
  return { ok: true, statut: r.statut, instantane: null, moi: null, suppression: r.corps, cree: false };
}

// retirer enchaine la suppression et ses consequences locales. Elle vit ici et
// non dans l'ecran pour deux raisons : le critere d'acceptation du PRP la place
// dans tests/classement.test.js, et un ecran qui ecrirait lui-meme dans le
// stockage serait un second endroit ou l'ordre des operations peut se defaire.
//
// Cet ordre n'est pas negociable. Le serveur d'abord, le local ensuite :
// effacer localement en comptant sur une reprise ferait perdre le code, donc le
// seul moyen de retirer un nom qui, lui, resterait affiche.
//
// Sur 200, on efface QUE `supprime` vaille true ou false. `true` : la fiche
// vient de partir. `false` : le serveur ne connait pas ce nom — dans les deux
// cas il n'y a plus rien au classement a quoi ce telephone se rattache, et
// garder la cle ne servirait qu'a proposer un second geste sans effet.
export async function retirer({ pseudo, code }, options = {}) {
  const effacer = options.effacer ?? effacerClassement;
  const resultat = await supprimer({ pseudo, code }, options);
  if (!resultat.ok) return resultat;

  effacer();
  // Le bloc du PRP 09 doit cesser de montrer un rang qui n'existe plus.
  emettre(documentCourant(options), { instantane: null, moi: null, statut: resultat.statut });
  return resultat;
}

// --- ce que synchroniser decide -------------------------------------------

function emettre(doc, detail) {
  if (doc === null || typeof doc.dispatchEvent !== 'function') return;
  doc.dispatchEvent(new CustomEvent(EVT_CLASSEMENT, { bubbles: true, detail }));
}

function documentCourant(options) {
  if (options.doc !== undefined) return options.doc;
  return typeof document === 'undefined' ? null : document;
}

// ctx.faits n'est pas relu : le contexte du PRP 03 est un instantane du dernier
// rendu, et une seance peut avoir ete cochee depuis.
export async function synchroniser(ctx, options = {}) {
  const lire = options.lire ?? lireClassement;
  const ecrire = options.ecrire ?? ecrireClassement;
  const maintenant = options.maintenant ?? (() => new Date());

  const local = lire();
  const faits = lireFaits();

  let resultat;
  if (local.pseudo === null) {
    // Situer sans rejoindre : le PRD §7.4 promet a qui refuse qu'il « continue
    // a voir sa position ».
    resultat = await relever(options);
  } else if (envoiNecessaire(local, faits)) {
    resultat = await envoyer({ pseudo: local.pseudo, code: local.code, faits }, options);
    if (resultat.ok) {
      // Un POST accepte est suivi d'un GET, DANS LE MEME APPEL. La reponse
      // d'envoi est plate : elle donne `moi`, jamais l'instantane. Sans ce
      // releve, le podium et la jauge du PRP 09 resteraient sur la valeur
      // d'avant l'envoi alors que le rang, lui, vient de changer — l'ecran se
      // contredirait a l'oeil nu. L'echec du releve ne fait pas echouer
      // l'envoi, qui a abouti.
      const suite = await relever(options);
      if (suite.ok) resultat = { ...resultat, instantane: suite.instantane };
    }
  } else {
    resultat = await relever(options);
  }

  const doc = documentCourant(options);

  if (!resultat.ok) {
    const connu = local.dernierRangConnu;
    emettre(doc, {
      instantane: connu?.instantane ?? null,
      moi: connu?.moi ?? null,
      statut: resultat.statut,
    });
    return resultat;
  }

  // La fusion se fait AUSSI a l'interieur de dernierRangConnu. Ecraser la cle
  // entiere a chaque releve effacerait `moi`, donc le seul rang que le serveur
  // ait tranche ; l'ecraser a chaque envoi effacerait `instantane`, donc le
  // podium et la jauge. Les deux corps ont des durees de vie distinctes.
  const recuA = maintenant().toISOString();
  const precedent = local.dernierRangConnu ?? { instantane: null, moi: null };
  const dernierRangConnu = {
    recuA,
    instantane: resultat.instantane ?? precedent.instantane ?? null,
    moi: resultat.moi ?? precedent.moi ?? null,
  };

  const partiel = { dernierRangConnu };
  // dernierEnvoi n'est ecrit qu'apres une reponse acceptee : un envoi perdu ne
  // laisse aucune trace, et le declencheur suivant le refait tout seul.
  if (resultat.moi !== null) partiel.dernierEnvoi = { at: recuA, empreinte: empreinte(faits) };
  ecrire(partiel);

  // UNE SEULE fois par appel, succes comme echec. Un POST suivi de son GET
  // n'emet donc pas deux evenements — le PRP 09 remonterait son bloc deux fois,
  // dont une avec un podium d'avant l'envoi.
  emettre(doc, {
    instantane: dernierRangConnu.instantane,
    moi: dernierRangConnu.moi,
    statut: resultat.statut,
  });
  return resultat;
}

// --- le debit et la reprise ------------------------------------------------

// Le debit vit ici et pas dans synchroniser : un geste explicite « Actualiser »
// (PRP 09) doit pouvoir appeler synchroniser sans passer par l'intervalle, une
// main etant son propre garde-fou.
//
// Les declencheurs, et eux seuls : une fois au branchement — apres le premier
// rendu —, a la fin d'une seance, et au retour du reseau. JAMAIS a chaque
// cochage : cinquante-trois POST sur un programme, c'est ce qui ferait mordre
// le rate-limit du palier sur un enfant reel plutot que sur un robot.
export function brancherSynchronisation(ctx, options = {}) {
  const doc = documentCourant(options);
  const fenetre = options.fenetre ?? (typeof window === 'undefined' ? null : window);
  const minuterie = options.minuterie ?? { poser: setTimeout, annuler: clearTimeout };
  const maintenant = options.maintenant ?? (() => new Date());

  let enVol = false;
  let dernierDepart = -Infinity;
  let reprise = null;
  let debranche = false;

  function annulerReprise() {
    if (reprise === null) return;
    minuterie.annuler(reprise);
    reprise = null;
  }

  async function lancer(essai) {
    if (debranche || enVol) return;
    enVol = true;
    dernierDepart = maintenant().getTime();
    try {
      const resultat = await synchroniser(ctx, options);
      if (!resultat.ok && !debranche && essai < REPRISES_MS.length) {
        reprise = minuterie.poser(() => {
          reprise = null;
          lancer(essai + 1);
        }, REPRISES_MS[essai]);
      }
    } catch (err) {
      // synchroniser ne rejette pas ; ce garde existe pour qu'un defaut de
      // stockage ne remonte jamais en erreur non rattrapee dans la console.
      console.warn('marcq : synchronisation impossible', err);
    } finally {
      enVol = false;
    }
  }

  // Un seul appel en vol a la fois, et au moins INTERVALLE_MIN_MS entre deux
  // declenchements automatiques. Une reprise en attente est abandonnee : le
  // declencheur qui arrive est plus frais qu'elle.
  function declencher() {
    if (debranche) return;
    if (maintenant().getTime() - dernierDepart < INTERVALLE_MIN_MS) return;
    annulerReprise();
    lancer(0);
  }

  if (doc !== null) doc.addEventListener(EVT_SEANCE_COMPLETE, declencher);
  if (fenetre !== null) fenetre.addEventListener('online', declencher);
  declencher();

  return function debrancherSynchronisation() {
    debranche = true;
    annulerReprise();
    if (doc !== null) doc.removeEventListener(EVT_SEANCE_COMPLETE, declencher);
    if (fenetre !== null) fenetre.removeEventListener('online', declencher);
  };
}

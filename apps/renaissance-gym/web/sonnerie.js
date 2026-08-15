// sonnerie.js — le son du minuteur, synthétisé (PRP 04 chantier D, PRD §7.3,
// §11.3, §15.3).
//
// AUCUNE INFORMATION N'EST PORTÉE PAR LE SEUL SON (PRD §15.3) : le visuel
// (chrono.js, vue-seance.js) porte toujours l'information complète, et aucun
// test — de ce module ou d'un autre — ne dépend du son pour vérifier qu'un
// exercice s'est terminé. Ce module ne lève jamais en environnement sans
// audio (tests `node --test`, navigateur qui refuse l'audio, iOS
// récalcitrant §15.3) : il dégrade en silence.
//
// Le son est SYNTHÉTISÉ, jamais un fichier : un `.wav` de plus dans l'image
// pour trois notes ne se justifie pas, et la synthèse ne dépend d'aucun
// décodeur.

// Les trois dernières secondes, en montant (3 s, 2 s, 1 s avant la fin).
export const FREQUENCES_BIP = [440, 554.37, 659.25];
export const DUREE_BIP_MS = 120;
export const GAIN_BIP = 0.2;

// Le zéro : ANCIENNEMENT une note grave unique, sous le plancher qu'un
// haut-parleur de téléphone restitue — remonté après coup (« Ajouté après
// les PRP », A2) : elle distingue les deux sons par le RYTHME, jamais par la
// hauteur, seul critère qu'un petit haut-parleur transmet fidèlement. La
// sonnerie reprend donc une fréquence de la même bande que les bips, mais en
// impulsions répétées et sensiblement plus fortes.
export const FREQUENCE_SONNERIE = 1046.5; // dans la bande efficace d'un petit haut-parleur
export const NB_IMPULSIONS_SONNERIE = 4;
export const DUREE_IMPULSION_SONNERIE_MS = 140;
export const SILENCE_ENTRE_IMPULSIONS_MS = 90;
export const GAIN_SONNERIE = 0.55; // sensiblement plus fort que GAIN_BIP

// Le second canal (A2) : le seul qui traverse un téléphone en silencieux.
// Le motif alterne vibration et repos, au rythme de la sonnerie plutôt qu'en
// un seul long buzz indifférencié.
export const MOTIF_VIBRATION = [160, 90, 160, 90, 160, 90, 160];

let contexteAudio = null;

function constructeurContexte() {
  return globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null;
}

function obtenirContexte() {
  const Ctor = constructeurContexte();
  if (typeof Ctor !== 'function') return null;
  if (contexteAudio === null) {
    try {
      contexteAudio = new Ctor();
    } catch (err) {
      console.warn('renaissance-gym : contexte audio indisponible', err);
      contexteAudio = null;
    }
  }
  return contexteAudio;
}

// À appeler au PREMIER geste de la séance (PRD §11.3) : les navigateurs
// mobiles n'autorisent le son qu'après une interaction utilisateur, et ne
// rendent jamais d'erreur s'il n'est pas débloqué — ils se taisent.
export function debloquerAudio() {
  const ctx = obtenirContexte();
  if (ctx === null) return;
  if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
    Promise.resolve(ctx.resume()).catch(() => {});
  }
}

export function estDisponible() {
  const ctx = obtenirContexte();
  return ctx !== null && ctx.state === 'running';
}

// `gainMax` porte le volume perçu (A2 : la sonnerie doit être sensiblement
// plus forte que les bips, pas seulement plus longue) ; `depart` permet de
// planifier plusieurs impulsions à l'avance sur la même horloge audio,
// plutôt que de les faire toutes partir au même instant.
function jouer(frequence, dureeMs, gainMax, depart) {
  const ctx = obtenirContexte();
  if (ctx === null) return;
  try {
    const oscillateur = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillateur.frequency.value = frequence;
    oscillateur.connect(gain);
    gain.connect(ctx.destination);

    const debut = depart ?? ctx.currentTime;
    const fin = debut + dureeMs / 1000;
    gain.gain.setValueAtTime(0.0001, debut);
    gain.gain.exponentialRampToValueAtTime(gainMax, debut + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, fin);

    oscillateur.start(debut);
    oscillateur.stop(fin + 0.02);
  } catch (err) {
    console.warn('renaissance-gym : son indisponible', err);
  }
}

// Le second canal (A2) : le seul qui traverse un téléphone en silencieux.
// Ne lève jamais et ne lance rien si l'interface manque — un navigateur qui
// ne connaît pas `navigator.vibrate` doit se taire, pas échouer.
function vibrer() {
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(MOTIF_VIBRATION);
  } catch (err) {
    console.warn('renaissance-gym : vibration indisponible', err);
  }
}

// Les trois dernières secondes, en montant (chantier D). `hauteur` est une
// fréquence en Hz : c'est vue-seance.js qui choisit dans FREQUENCES_BIP selon
// le nombre de secondes restantes — ce module ne devine jamais le mode d'un
// exercice, il ne fait que jouer la note qu'on lui donne.
export function bip(hauteur) {
  jouer(hauteur, DUREE_BIP_MS, GAIN_BIP);
}

// Le zéro (A2) : elle se distingue des bips par le RYTHME — une série
// d'impulsions dans la bande où un petit haut-parleur reste efficace,
// nettement plus fortes — jamais par la hauteur, que le haut-parleur visé ne
// restitue pas fidèlement en dessous de cette bande. La vibration l'accompagne
// systématiquement, en second canal, sans jamais devenir une condition pour
// que le son lui-même joue.
export function sonnerie() {
  const ctx = obtenirContexte();
  if (ctx !== null) {
    for (let i = 0; i < NB_IMPULSIONS_SONNERIE; i += 1) {
      const ecart = i * (DUREE_IMPULSION_SONNERIE_MS + SILENCE_ENTRE_IMPULSIONS_MS) / 1000;
      jouer(FREQUENCE_SONNERIE, DUREE_IMPULSION_SONNERIE_MS, GAIN_SONNERIE, ctx.currentTime + ecart);
    }
  }
  vibrer();
}

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
// Le zéro : plus bas que le plus grave des bips — « elle distingue deux sons,
// pas trois nuances ».
export const FREQUENCE_ZERO = 220;
export const DUREE_BIP_MS = 120;
// Plus long que le bip, pour que le zéro se reconnaisse sans le voir.
export const DUREE_ZERO_MS = 500;

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

function jouer(frequence, dureeMs) {
  const ctx = obtenirContexte();
  if (ctx === null) return;
  try {
    const oscillateur = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillateur.frequency.value = frequence;
    oscillateur.connect(gain);
    gain.connect(ctx.destination);

    const depart = ctx.currentTime;
    const fin = depart + dureeMs / 1000;
    gain.gain.setValueAtTime(0.0001, depart);
    gain.gain.exponentialRampToValueAtTime(0.2, depart + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, fin);

    oscillateur.start(depart);
    oscillateur.stop(fin + 0.02);
  } catch (err) {
    console.warn('renaissance-gym : son indisponible', err);
  }
}

// Les trois dernières secondes, en montant (chantier D). `hauteur` est une
// fréquence en Hz : c'est vue-seance.js qui choisit dans FREQUENCES_BIP selon
// le nombre de secondes restantes — ce module ne devine jamais le mode d'un
// exercice, il ne fait que jouer la note qu'on lui donne.
export function bip(hauteur) {
  jouer(hauteur, DUREE_BIP_MS);
}

// Le zéro : plus bas et plus long.
export function sonnerie() {
  jouer(FREQUENCE_ZERO, DUREE_ZERO_MS);
}

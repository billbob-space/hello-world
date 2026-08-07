// sonnerie.js — ce qu'on entend quand un compte a rebours arrive a zero.
//
// AUCUN FICHIER AUDIO. Le son est synthetise a la volee par l'oscillateur du
// navigateur : rien a telecharger, rien a mettre dans la coque hors ligne, rien
// a charger depuis un autre domaine — l'ossature §2 l'interdit —, et l'image ne
// grossit pas d'un octet. Trois notes suffisent a faire une sonnerie.
//
// LE SON NE PART QU'APRES UN GESTE. Un navigateur de telephone refuse de jouer
// quoi que ce soit tant que l'utilisateur n'a rien touche, et il ne rend pas
// d'erreur : il se tait. Or le zero d'un rebours n'est pas un geste. C'est donc
// le tap qui DEMARRE le minuteur qui reveille l'audio, quarante-cinq secondes
// plus tot — `preparer()` existe pour cela, et pour cela seulement.

// Les sonneries, dans l'ordre ou les reglages les proposent. `notes` est une
// suite de { hz, duree, apres } en secondes : rien d'autre n'est necessaire pour
// decrire un bip, une cloche ou un coup de sifflet.
//
// La derniere est le silence, et elle est une VRAIE option : une seance se fait
// aussi en cours, dans un salon, a cote de quelqu'un qui dort.
export const SONNERIES = [
  {
    cle: 'bip', nom: 'Bip', description: 'Deux notes courtes.',
    notes: [{ hz: 880, duree: 0.12, apres: 0.16 }, { hz: 880, duree: 0.12, apres: 0 }],
  },
  {
    cle: 'cloche', nom: 'Cloche', description: 'Une note qui résonne.',
    notes: [{ hz: 1046.5, duree: 0.9, apres: 0 }],
  },
  {
    cle: 'sifflet', nom: 'Sifflet', description: 'Comme au gymnase.',
    notes: [
      { hz: 2100, duree: 0.18, apres: 0.1 },
      { hz: 2100, duree: 0.18, apres: 0.1 },
      { hz: 2100, duree: 0.34, apres: 0 },
    ],
  },
  { cle: 'silence', nom: 'Silencieux', description: 'Le téléphone vibre, sans un bruit.', notes: [] },
];

export const SONNERIE_PAR_DEFAUT = 'bip';

export function sonnerieDe(cle) {
  return SONNERIES.find((s) => s.cle === cle) ?? SONNERIES.find((s) => s.cle === SONNERIE_PAR_DEFAUT);
}

// La duree totale d'une sonnerie, en secondes. Sert au test qui verifie
// qu'aucune ne s'eternise : au-dela d'une seconde et demie, ce n'est plus un
// signal, c'est une alarme qu'on cherche a faire taire.
export function dureeSonnerie(cle) {
  return sonnerieDe(cle).notes.reduce((total, n) => total + Math.max(n.duree, n.apres), 0);
}

// --- le sonneur -------------------------------------------------------------

// Fabrique le joueur de sonnerie. Le contexte audio est cree PARESSEUSEMENT, au
// premier `preparer()` : en creer un au chargement de la page en laisserait un
// ouvert chez tous ceux qui n'ouvrent jamais une seance.
//
// `options` n'existe que pour les tests : la fabrique du contexte s'injecte.
export function creerSonneur(options = {}) {
  const fabriquer = options.fabriquer ?? (() => {
    // Nomme `Contexte` et non `Audio` : sous ce second nom, la construction
    // designerait l'element <audio> du navigateur, qui chargerait un FICHIER. Un
    // test cherche cette ecriture-la pour garantir qu'aucun son n'entre dans
    // l'application par un telechargement — et il la cherche jusque dans les
    // commentaires, d'ou cette periphrase.
    const Contexte = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    return typeof Contexte === 'function' ? new Contexte() : null;
  });
  const lire = options.lire ?? (() => SONNERIE_PAR_DEFAUT);

  let contexte = null;

  // A appeler DEPUIS UN GESTE, et le plus tot possible. Un contexte suspendu —
  // ce qu'un telephone rend tant que rien n'a ete touche — se reveille ici.
  function preparer() {
    if (contexte === null) contexte = fabriquer();
    if (contexte === null) return false;
    if (contexte.state === 'suspended' && typeof contexte.resume === 'function') contexte.resume();
    return true;
  }

  function jouer(cle = lire()) {
    const { notes } = sonnerieDe(cle);
    if (notes.length === 0) return false;
    if (!preparer()) return false;

    let depart = contexte.currentTime;
    for (const note of notes) {
      const oscillateur = contexte.createOscillator();
      const gain = contexte.createGain();
      // Une sinusoide, et une enveloppe qui monte et redescend. Un creneau —
      // le defaut de certains navigateurs — grince dans un haut-parleur de
      // telephone, et une note coupee net y produit un claquement.
      oscillateur.type = 'sine';
      oscillateur.frequency.value = note.hz;
      gain.gain.setValueAtTime(0.0001, depart);
      gain.gain.exponentialRampToValueAtTime(0.28, depart + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, depart + note.duree);
      oscillateur.connect(gain);
      gain.connect(contexte.destination);
      oscillateur.start(depart);
      oscillateur.stop(depart + note.duree + 0.02);
      depart += Math.max(note.duree, note.apres);
    }
    return true;
  }

  return { preparer, jouer };
}

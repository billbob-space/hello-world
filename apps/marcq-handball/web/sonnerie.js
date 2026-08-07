// sonnerie.js — ce qu'on entend quand un compte a rebours arrive a zero.
//
// DEUX FACONS DE FAIRE UN SON, ET UNE SEULE RAISON DE LES MELANGER. Le bip et
// la cloche sont synthetises a la volee par l'oscillateur du navigateur : rien
// a telecharger, rien a mettre dans la coque hors ligne, et l'image ne grossit
// pas d'un octet. Le sifflet, LUI, est un enregistrement — 25 Ko livres avec
// l'application. Trois sinusoides a 2100 Hz font un bip aigu, jamais un coup de
// sifflet : ce qui fait le sifflet est le battement de la bille et le souffle,
// qu'aucun empilement d'oscillateurs simples ne reproduit. Le fichier est en
// MEME ORIGINE, servi par l'app elle-meme — l'ossature §2 interdit le domaine
// tiers, pas le fichier livre.
//
// LE SON NE PART QU'APRES UN GESTE. Un navigateur de telephone refuse de jouer
// quoi que ce soit tant que l'utilisateur n'a rien touche, et il ne rend pas
// d'erreur : il se tait. Or le zero d'un rebours n'est pas un geste. C'est donc
// le tap qui DEMARRE le minuteur qui reveille l'audio, quarante-cinq secondes
// plus tot — `preparer()` existe pour cela, et pour cela seulement. C'est aussi
// lui qui va chercher le coup de sifflet, pour la meme raison : le zero est
// trop tard pour decouvrir qu'il manque.

// L'enregistrement du sifflet : un coup d'arbitre pris dans un gymnase, du
// domaine public (CC0). Le fichier ne porte QU'UN coup — le second est le meme,
// rejoue `ecart` seconde plus tard : deux coups dans le fichier pesaient le
// double pour le meme son.
export const SIFFLET = { fichier: '/sifflet.wav', duree: 0.53, coups: 2, ecart: 0.6 };

// Les sonneries, dans l'ordre ou les reglages les proposent. `notes` est une
// suite de { hz, a, duree, gain } — `a` est le depart en secondes, compte depuis
// le debut de la sonnerie. Des notes qui partent au MEME instant se superposent :
// c'est ainsi que la cloche est faite, et c'est la difference entre une cloche
// et un bip tenu.
//
// La derniere est le silence, et elle est une VRAIE option : une seance se fait
// aussi en cours, dans un salon, a cote de quelqu'un qui dort.
export const SONNERIES = [
  {
    cle: 'bip', nom: 'Bip', description: 'Deux notes courtes.',
    // La seconde note MONTE. Deux notes identiques disent « attention », deux
    // notes qui montent disent « c'est fini » — et c'est ce qui vient d'arriver.
    notes: [
      { hz: 880, a: 0, duree: 0.12, gain: 1 },
      { hz: 1318.5, a: 0.16, duree: 0.14, gain: 1 },
    ],
  },
  {
    cle: 'cloche', nom: 'Cloche', description: 'Une note qui résonne.',
    // Cinq partiels frappes ENSEMBLE, aux rapports inharmoniques d'une cloche
    // reelle (1, 2, 2.76, 5.40, 8.93) : c'est leur desaccord qui fait entendre
    // du metal. Les aigus s'eteignent les premiers, comme sur une vraie cloche
    // ou seul le fondamental traine.
    notes: [
      { hz: 1046.5, a: 0, duree: 1.1, gain: 1 },
      { hz: 2093, a: 0, duree: 0.7, gain: 0.55 },
      { hz: 2888.3, a: 0, duree: 0.55, gain: 0.42 },
      { hz: 5651.1, a: 0, duree: 0.3, gain: 0.22 },
      { hz: 9345.2, a: 0, duree: 0.18, gain: 0.12 },
    ],
  },
  {
    cle: 'sifflet', nom: 'Sifflet', description: 'Comme au gymnase.',
    echantillon: SIFFLET,
    // Le repli, et rien d'autre : un navigateur qui ne sait pas decoder le
    // fichier, ou une premiere ouverture hors ligne avant que la coque ne soit
    // en cache. Trois bips aigus ne sont pas un sifflet, mais un minuteur qui
    // se tait a zero est pire.
    notes: [
      { hz: 2100, a: 0, duree: 0.18, gain: 1 },
      { hz: 2100, a: 0.28, duree: 0.18, gain: 1 },
      { hz: 2100, a: 0.56, duree: 0.34, gain: 1 },
    ],
  },
  { cle: 'silence', nom: 'Silencieux', description: 'Le téléphone vibre, sans un bruit.', notes: [] },
];

export const SONNERIE_PAR_DEFAUT = 'bip';

export function sonnerieDe(cle) {
  return SONNERIES.find((s) => s.cle === cle) ?? SONNERIES.find((s) => s.cle === SONNERIE_PAR_DEFAUT);
}

// La duree totale d'une sonnerie, en secondes : la derniere chose qu'on entend
// s'y termine. Sert au test qui verifie qu'aucune ne s'eternise — au-dela d'une
// seconde et demie, ce n'est plus un signal, c'est une alarme qu'on cherche a
// faire taire.
export function dureeSonnerie(cle) {
  const s = sonnerieDe(cle);
  const notes = s.notes.reduce((fin, n) => Math.max(fin, n.a + n.duree), 0);
  if (!s.echantillon) return notes;
  const { duree, coups, ecart } = s.echantillon;
  return Math.max(notes, ecart * (coups - 1) + duree);
}

// --- le sonneur -------------------------------------------------------------

// Fabrique le joueur de sonnerie. Le contexte audio est cree PARESSEUSEMENT, au
// premier `preparer()` : en creer un au chargement de la page en laisserait un
// ouvert chez tous ceux qui n'ouvrent jamais une seance.
//
// `options` n'existe que pour les tests : la fabrique du contexte et le
// telechargement de l'echantillon s'y injectent.
export function creerSonneur(options = {}) {
  const fabriquer = options.fabriquer ?? (() => {
    // Nomme `Contexte` et non `Audio` : sous ce second nom, la construction
    // designerait l'element <audio> du navigateur, qui chargerait le fichier
    // hors du contexte — donc hors du reveil obtenu par le geste, et le
    // telephone resterait muet a zero. Un test cherche cette ecriture-la, et il
    // la cherche jusque dans les commentaires, d'ou cette periphrase.
    const Contexte = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    return typeof Contexte === 'function' ? new Contexte() : null;
  });
  const chercher = options.chercher ?? ((url) => fetch(url).then((r) => r.arrayBuffer()));
  const lire = options.lire ?? (() => SONNERIE_PAR_DEFAUT);

  let contexte = null;
  // Une promesse, jamais rompue : elle rend l'echantillon decode, ou `null` si
  // quoi que ce soit a echoue. Le repli synthetise se decide a la lecture, pas
  // ici — le chargement, lui, ne doit jamais faire tomber le minuteur.
  let echantillon = null;

  // A appeler DEPUIS UN GESTE, et le plus tot possible. Un contexte suspendu —
  // ce qu'un telephone rend tant que rien n'a ete touche — se reveille ici, et
  // le coup de sifflet part au telechargement dans la foulee.
  function preparer() {
    if (contexte === null) contexte = fabriquer();
    if (contexte === null) return false;
    if (contexte.state === 'suspended' && typeof contexte.resume === 'function') contexte.resume();
    if (echantillon === null) {
      echantillon = Promise.resolve()
        .then(() => chercher(SIFFLET.fichier))
        .then((octets) => contexte.decodeAudioData(octets))
        .catch(() => null);
    }
    return true;
  }

  // Une sortie par son, ouverte au dernier moment : un GainNode par note ou par
  // coup, jamais partage. Deux sonneries qui se chevauchent — le tap suivant
  // dans les reglages — ne se coupent alors pas l'une l'autre.
  function sortie() {
    const gain = contexte.createGain();
    gain.connect(contexte.destination);
    return gain;
  }

  function jouerNotes(notes, depart) {
    for (const note of notes) {
      const oscillateur = contexte.createOscillator();
      const gain = sortie();
      // Une sinusoide, et une enveloppe qui monte et redescend. Un creneau —
      // le defaut de certains navigateurs — grince dans un haut-parleur de
      // telephone, et une note coupee net y produit un claquement.
      oscillateur.type = 'sine';
      oscillateur.frequency.value = note.hz;
      const pic = 0.28 * note.gain;
      gain.gain.setValueAtTime(0.0001, depart + note.a);
      gain.gain.exponentialRampToValueAtTime(pic, depart + note.a + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, depart + note.a + note.duree);
      oscillateur.connect(gain);
      oscillateur.start(depart + note.a);
      oscillateur.stop(depart + note.a + note.duree + 0.02);
    }
  }

  function jouerEchantillon(tampon, depart, combien, ecart) {
    for (let i = 0; i < combien; i++) {
      const source = contexte.createBufferSource();
      const gain = sortie();
      gain.gain.value = 0.9;
      source.buffer = tampon;
      source.connect(gain);
      source.start(depart + i * ecart);
    }
  }

  function jouer(cle = lire()) {
    const sonnerie = sonnerieDe(cle);
    if (sonnerie.notes.length === 0 && !sonnerie.echantillon) return false;
    if (!preparer()) return false;

    if (!sonnerie.echantillon) {
      jouerNotes(sonnerie.notes, contexte.currentTime);
      return true;
    }

    // Le decodage est une promesse : la sonnerie part donc au tour de boucle
    // suivant, quelques millisecondes plus tard. Personne ne l'entend a zero —
    // le rebours a eu quarante-cinq secondes pour la charger — et cela evite de
    // rendre `jouer` asynchrone pour tout le monde.
    const { coups, ecart } = sonnerie.echantillon;
    echantillon.then((tampon) => {
      if (contexte === null) return;
      if (tampon) jouerEchantillon(tampon, contexte.currentTime, coups, ecart);
      else jouerNotes(sonnerie.notes, contexte.currentTime);
    });
    return true;
  }

  return { preparer, jouer };
}

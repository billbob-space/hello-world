// vue-coach.js — l'ecran #/coach : dans quel etat le coach recupere son groupe.
//
// CE FICHIER NE LIT RIEN DU TELEPHONE. Il n'importe ni le module de stockage,
// ni celui du classement, ni aucun module qui les importe : rien du nom garde
// en local, ni des cases cochees, ni du pseudonyme, ni du ressenti d'un enfant.
// (Le test qui tient cette propriete cherche des sous-chaines dans CE fichier,
// commentaires compris : il ne s'y nomme donc aucun de ces modules.)
// C'est ce qui rend acceptable qu'il n'ait aucune
// protection — la contrainte du PRD §7.6 n'est pas « la page est protegee »,
// c'est « la page n'a rien a proteger ». Quatre assertions de source la tiennent
// dans le temps, dans tests/coach.test.js.
//
// Aucun tutoiement : le ton du PRD §10 vise des joueurs de 13-14 ans, et il n'y
// a personne a tutoyer ici. Aucune animation non plus — « le changement de
// position est anime » concerne l'enfant qui grimpe, pas un tableau lu une fois.

import { creerBarre } from './barre.js';
import { dateEnToutesLettres } from './vue-jour.js';
import { RESSENTIS } from './ressenti.js';

export const ROUTE_COACH = '#/coach';
export const MOTIF_COACH = /^#\/coach$/;
export const CHEMIN_COACH = '/api/coach';
export const TITRE_COACH = 'État du groupe';
export const DELAI_COACH_MS = 8000;
export const TEXTE_ACTUALISER_COACH = 'Actualiser';

// Le PRD §13 ecarte le mot de passe. Ne rien dire laisserait croire a une
// protection, ce qui est exactement le reproche fait au mot de passe : un lien
// recu sans contexte se lit comme un tableau de bord prive.
export const MENTION_PUBLIQUE = 'Cette page est publique : elle n’affiche que ce que les enfants voient déjà — des pseudonymes choisis, des pourcentages, aucun nom d’enfant.';

// Les quatre paliers du serveur, TOUJOURS les quatre, meme a zero : masquer un
// palier vide masquerait precisement « aucune », la seule ligne qui demande une
// action.
export const SEUILS_ASSIDUITE = [
  { cle: 'aucune', libelle: 'Aucun exercice', aide: '0 %' },
  { cle: 'faible', libelle: 'Peu', aide: 'moins de 30 %' },
  { cle: 'moyenne', libelle: 'Moyen', aide: 'de 30 à 60 %' },
  // Libelle en clair, pour que le coach lise sa cible sans la recalculer (PRD §4).
  { cle: 'forte', libelle: 'Assidus', aide: '60 % et plus — la cible' },
];

export const PHRASES_COACH = {
  'hors-ligne': 'Pas de réseau. Cette page a besoin d’une connexion.',
  indisponible: 'Le classement n’est pas encore activé sur ce serveur.',
  echec: 'Le serveur n’a pas répondu.',
  vide: 'Personne n’a encore rejoint le classement.',
};

export function libelleAssiduite(cle) {
  return SEUILS_ASSIDUITE.find((s) => s.cle === cle)?.libelle ?? cle;
}

// L'heure d'un releve qu'on vient de faire, dans le fuseau du club. Elle n'est
// pas empruntee a la fraicheur relative de l'ecran des enfants — « il y a 2 h »
// ne dit rien au coach, et cet import entrainerait le stockage dans une page
// dont toute la garantie est de n'y toucher jamais.
export function heureDuReleve(instant) {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
  }).format(instant).replace(':', ' h ');
}

// Les phrases de cette page ne reutilisent pas celles des enfants : celles-la
// tutoient (« Reessaie quand tu en auras »), et il n'y a personne a tutoyer ici.
export function messageCoach(statut, erreur) {
  if (statut === 0) return PHRASES_COACH['hors-ligne'];
  // C'est l'etat par defaut du serveur tant qu'aucun repertoire de donnees n'est
  // monte : la page doit le DIRE correctement, pas le traiter comme une panne.
  if (erreur === 'classement-indisponible') return PHRASES_COACH.indisponible;
  return PHRASES_COACH.echec;
}

// --- le modele, pur --------------------------------------------------------

const pourcent = (part) => Math.round((part ?? 0) * 100);

export function modeleCoach(reponse) {
  const participants = reponse.participants ?? 0;
  const groupe = reponse.groupe ?? { cochees: 0, programmees: 0, part: 0 };
  const assiduite = reponse.assiduite ?? {};
  const brut = reponse.ressentis ?? {};
  const total = RESSENTIS.reduce((n, r) => n + (brut[r.cle] ?? 0), 0);

  return {
    entete: {
      jour: reponse.jour,
      jourLisible: dateEnToutesLettres(reponse.jour),
      participants,
      programmees: reponse.programmees ?? 0,
      // Le denominateur est honnete : c'est le nombre de participants au
      // classement, jamais un effectif d'equipe — et la phrase le dit.
      phrase: `${participants} participant${participants > 1 ? 's' : ''} au classement · `
        + `${reponse.programmees ?? 0} exercices programmés à ce jour`,
    },
    groupe: {
      cochees: groupe.cochees ?? 0,
      programmees: groupe.programmees ?? 0,
      part: groupe.part ?? 0,
      pourcent: pourcent(groupe.part),
      echelle: Math.max(1, groupe.programmees ?? 0),
      phrase: `${groupe.cochees ?? 0} exercices cochés sur ${groupe.programmees ?? 0} possibles.`,
    },
    assiduite: SEUILS_ASSIDUITE.map((s) => {
      const nombre = assiduite[s.cle] ?? 0;
      return {
        cle: s.cle,
        libelle: s.libelle,
        aide: s.aide,
        nombre,
        part: participants === 0 ? 0 : nombre / participants,
      };
    }),
    // Le modele ne fabrique JAMAIS un nom absent : au-dela de la troisieme
    // ligne, le serveur n'en envoie pas, et l'etiquette dit le rang.
    classement: (reponse.classement ?? []).map((l) => ({
      rang: l.rang,
      pseudo: l.pseudo ?? null,
      nomme: typeof l.pseudo === 'string' && l.pseudo !== '',
      etiquette: typeof l.pseudo === 'string' && l.pseudo !== '' ? l.pseudo : `Rang ${l.rang}`,
      cochees: l.cochees ?? 0,
      part: l.part ?? 0,
      pourcent: pourcent(l.part),
    })),
    // Aucune date n'est ecrite en dur : programme.json est editable, et une date
    // figee dans le code mentirait des qu'une seance s'ajoute. La deuxieme
    // mesure du PRD §4 se lit sur la DERNIERE ligne.
    seances: (reponse.seances ?? []).map((s) => ({
      date: s.date,
      dateLisible: dateEnToutesLettres(s.date),
      titre: s.titre,
      exercices: s.exercices ?? 0,
      cochees: s.cochees ?? 0,
      possibles: (s.exercices ?? 0) * participants,
      actifs: s.participantsActifs ?? 0,
      finis: s.participantsAyantFini ?? 0,
    })),
    ressentis: {
      total,
      lignes: RESSENTIS.map((r) => {
        const nombre = brut[r.cle] ?? 0;
        return {
          cle: r.cle,
          libelle: r.libelle,
          emoji: r.emoji,
          nombre,
          part: total === 0 ? 0 : nombre / total,
          pourcent: total === 0 ? 0 : Math.round((nombre / total) * 100),
        };
      }),
      // On ne dessine pas une repartition de rien.
      vide: total === 0 ? 'Aucun ressenti reçu pour l’instant.' : null,
    },
  };
}

// --- le releve -------------------------------------------------------------

// Aucun parametre d'URL, aucun en-tete, aucun cookie. Aucun rafraichissement
// automatique non plus : un bouton, et rien d'autre — une page laissee ouverte
// sur un onglet ne doit pas marteler une route publique.
export async function releverCoach(options = {}) {
  const appeler = options.fetch ?? globalThis.fetch;
  const delaiMs = options.delaiMs ?? DELAI_COACH_MS;

  let reponse;
  try {
    reponse = await appeler(CHEMIN_COACH, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(delaiMs),
    });
  } catch {
    return { ok: false, statut: 0, erreur: null };
  }

  // Le corps n'est decode que s'il s'annonce en JSON : le 405 de la
  // bibliotheque standard repond en texte brut.
  const type = reponse.headers?.get?.('content-type') ?? '';
  const corps = type.includes('application/json') ? await reponse.json().catch(() => null) : null;

  if (!reponse.ok || corps === null) {
    return { ok: false, statut: reponse.status, erreur: corps?.erreur ?? null };
  }
  return { ok: true, coach: corps };
}

// --- le montage ------------------------------------------------------------

function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  // Les pseudonymes viennent d'un champ public : ils s'affichent, ils ne
  // s'interpretent pas.
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

function blocAssiduite(modele) {
  const bloc = el('section', 'bloc-coach');
  bloc.append(el('h2', 'titre-bloc', 'Assiduité'));
  const liste = el('ul', 'liste-coach');
  for (const l of modele.assiduite) {
    const item = el('li', 'ligne-coach');
    item.append(
      el('span', 'coach-nombre', String(l.nombre)),
      el('span', 'coach-libelle', l.libelle),
      el('span', 'coach-aide', l.aide),
    );
    liste.append(item);
  }
  bloc.append(liste);
  return bloc;
}

function blocClassement(modele) {
  const bloc = el('section', 'bloc-coach');
  bloc.append(el('h2', 'titre-bloc', 'Classement'));
  if (modele.classement.length === 0) {
    bloc.append(el('p', 'aide', PHRASES_COACH.vide));
    return bloc;
  }
  const liste = el('ol', 'liste-coach');
  for (const l of modele.classement) {
    const item = el('li', l.nomme ? 'ligne-coach ligne-nommee' : 'ligne-coach');
    item.append(
      el('span', 'coach-nombre', String(l.rang)),
      el('span', 'coach-libelle', l.etiquette),
      el('span', 'coach-aide', `${l.cochees} · ${l.pourcent} %`),
    );
    liste.append(item);
  }
  bloc.append(liste);
  return bloc;
}

function blocSeances(modele) {
  const bloc = el('section', 'bloc-coach');
  bloc.append(el('h2', 'titre-bloc', 'Séance par séance'));
  const liste = el('ul', 'liste-coach');
  for (const s of modele.seances) {
    const item = el('li', 'ligne-seance-coach');
    item.append(
      el('span', 'coach-libelle', `${s.dateLisible} · ${s.titre}`),
      el('span', 'coach-aide',
        `${s.cochees} cochés sur ${s.possibles} · ${s.actifs} actifs · ${s.finis} ont tout fait`),
    );
    liste.append(item);
  }
  bloc.append(liste);
  return bloc;
}

function blocRessentis(modele) {
  const bloc = el('section', 'bloc-coach');
  bloc.append(el('h2', 'titre-bloc', 'Ressenti'));
  if (modele.ressentis.vide !== null) {
    bloc.append(el('p', 'aide', modele.ressentis.vide));
    return bloc;
  }
  const liste = el('ul', 'liste-coach');
  for (const l of modele.ressentis.lignes) {
    const item = el('li', 'ligne-coach');
    const emoji = el('span', 'coach-emoji', l.emoji);
    emoji.setAttribute('aria-hidden', 'true');
    item.append(
      emoji,
      el('span', 'coach-libelle', l.libelle),
      el('span', 'coach-aide', `${l.nombre} · ${l.pourcent} %`),
    );
    liste.append(item);
  }
  bloc.append(liste);
  return bloc;
}

export function monterCoach(hote) {
  const section = el('section', 'ecran ecran-coach');
  section.append(el('h1', 'titre-ecran', TITRE_COACH));

  const corps = el('div', 'corps-coach');
  const etat = el('p', 'etat-coach');
  etat.setAttribute('role', 'status');

  const bouton = el('button', 'bouton actualiser-coach', TEXTE_ACTUALISER_COACH);
  bouton.type = 'button';

  async function charger() {
    bouton.disabled = true;
    etat.textContent = 'Relevé en cours…';
    const r = await releverCoach();
    bouton.disabled = false;
    corps.replaceChildren();

    if (!r.ok) {
      // Aucune valeur mise en cache, jamais : un chiffre d'hier presente au
      // coach le 21 aout est pire qu'une page qui dit qu'elle n'a pas pu se
      // rafraichir.
      etat.textContent = messageCoach(r.statut, r.erreur);
      return;
    }

    const modele = modeleCoach(r.coach);
    etat.textContent = `Relevé à ${heureDuReleve(new Date())} · ${modele.entete.jourLisible}`;

    const entete = el('section', 'bloc-coach');
    entete.append(el('p', 'coach-entete', modele.entete.phrase));
    const jauge = creerBarre(modele.groupe.cochees, modele.groupe.echelle, { muette: true });
    entete.append(jauge, el('p', 'coach-aide', modele.groupe.phrase));

    corps.append(
      entete,
      blocAssiduite(modele),
      blocClassement(modele),
      blocSeances(modele),
      blocRessentis(modele),
    );
  }

  bouton.addEventListener('click', charger);
  section.append(el('p', 'mention-publique', MENTION_PUBLIQUE), etat, bouton, corps);
  hote.append(section);
  charger();
}

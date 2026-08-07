// vue-bilan.js — le 22 aout au matin, ce que l'enfant a fait pendant trois
// semaines.
//
// CE FICHIER N'AJOUTE AUCUNE LOGIQUE DE DATE, et c'est ce qui le rend petit.
// `seanceDuJour` sait deja dire qu'un programme est fini, `etatSeance` sait deja
// qu'on ne coche plus, le serveur fige deja le classement. Ce module branche un
// ecran sur des cas deja modelises.
//
// La date de fin n'est jamais ecrite ici : elle vient de `prog.fin`. Editer
// programme.json pour la saison prochaine defait la bascule tout seul.
//
// LA REGLE DE TON, en une phrase : le bilan raconte ce qui a ete fait, il ne
// compte pas ce qui a manque. Quelqu'un qui a fait trois seances sur sept doit
// avoir envie de lire cet ecran ; trois seances, c'est trois de plus que zero,
// et c'est le seul cadrage a la fois vrai et lisible.

import { creerBarre } from './barre.js';
import { etatSeance, progression, seanceDuJour, totauxAccomplis } from './domaine.js';
import { dateEnToutesLettres } from './vue-jour.js';
import { ETATS, lignesVolume } from './vue-perso.js';
import { seancesTerminees } from './recompenses.js';
import { monterEquipe } from './vue-equipe.js';

export const ROUTE_BILAN = '#/bilan';
export const MOTIF_BILAN = /^#\/bilan$/;
// Le motif de l'adresse sans ancre. `ECRANS` l'utilise pour son entree `jour`,
// et la bascule pour savoir ce qu'elle capture : UNE SEULE SOURCE. Deux copies
// divergeraient au premier ajustement, et l'ecart serait muet — le bilan ne
// prendrait pas la main sur le lien que les enfants ont recu.
export const MOTIF_RACINE = /^(#\/?)?$/;

export const TITRE_BILAN = 'Ton bilan';
export const PHRASE_RIEN = 'Aucune case cochée sur cette période. Le programme reste là, séance par séance, si tu veux le relire.';
export const PHRASE_VOLUME_VIDE = 'Rien à additionner cette fois.';
export const TEXTE_DETAIL = 'Voir le détail jour par jour';

// Les quatre statuts qu'etatSeance peut rendre sur une seance dont la date est
// <= aujourd'hui, et eux seuls : 'a-venir' est impossible ici. Deux ecarts avec
// le calendrier, et ils portent tout le ton de cet ecran : `manquee` devient
// « non faite », `aujourd-hui` devient « en cours ». Le domaine constate,
// l'ecran ne reproche pas.
export const LIBELLES_BILAN = {
  faite: 'faite',
  'aujourd-hui': 'en cours',
  partielle: 'commencée',
  manquee: 'non faite',
};

// --- la bascule -------------------------------------------------------------

// Rend ROUTE_BILAN quand la racine doit mener au bilan, null sinon. Aucune
// comparaison de date ici — seanceDuJour porte deja la regle — et `aujourdhui`
// est un parametre : c'est ce qui rend la bascule testable un mois avant la date
// ou elle compte.
//
// SEULE LA RACINE BASCULE. #/perso, #/reglages et #/seance/<date> continuent de
// repondre : le PRD §9 dit que l'application bascule, pas qu'elle ferme — apres
// le 21 aout on doit encore pouvoir corriger un prenom et relire une seance.
export function bascule(prog, aujourdhui, route) {
  if (!MOTIF_RACINE.test(route)) return null;
  return seanceDuJour(prog, aujourdhui).cas === 'terminee' ? ROUTE_BILAN : null;
}

// --- le modele, pur ---------------------------------------------------------

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export function phraseBilan({ seances, cases }) {
  if (cases === 0) return PHRASE_RIEN;
  const fin = 'Voilà ce que tu ramènes à la reprise.';
  // Quelqu'un qui a coche douze cases sans jamais finir une seance ne doit pas
  // lire « 0 séance bouclée » : le zero serait la seule information de la
  // phrase, et elle serait fausse — il s'est entraine.
  if (seances === 0) return `${pluriel(cases, 'exercice')} coché${cases > 1 ? 's' : ''}. ${fin}`;
  return `${pluriel(seances, 'séance')} bouclée${seances > 1 ? 's' : ''} `
    + `et ${pluriel(cases, 'exercice')} coché${cases > 1 ? 's' : ''}. ${fin}`;
}

export function ligneSeance(prog, seance, aujourdhui, faits) {
  const { statut, coches, total } = etatSeance(prog, seance.date, aujourdhui, faits);
  const dateLisible = dateEnToutesLettres(seance.date);
  const libelle = LIBELLES_BILAN[statut];

  // `detail` vaut null des que rien n'est coche, et c'est le choix de ton pris
  // ici : « 0 exercices sur 6 » est un reproche chiffre, l'absence de chiffre
  // est un fait. La ligne reste presente, datee, titree, avec sa marque et son
  // lien — rien n'est cache, rien n'est compte.
  let detail = null;
  if (statut === 'faite') detail = pluriel(total, 'exercice');
  else if (coches > 0) detail = `${pluriel(coches, 'exercice')} sur ${total}`;

  return {
    date: seance.date,
    dateLisible,
    // Tel quel : chargerProgramme refuse deja un titre absent, donc un repli ici
    // serait du code mort qui laisserait croire que le champ est facultatif.
    titre: seance.titre,
    statut,
    libelle,
    // La marque double la couleur, pour qui lit au soleil ou distingue mal le
    // rouge du vert. Une seule source pour ce qui se dessine : ETATS.
    marque: ETATS[statut].marque,
    coches,
    total,
    detail,
    // Toujours un lien, y compris sur une seance non faite : la relire est le
    // seul geste qui reste, et le verrouiller serait punir apres coup.
    href: `#/seance/${seance.date}`,
    nom: `${dateLisible} · ${seance.titre} · ${libelle}${detail === null ? '' : ` · ${detail}`}`,
  };
}

export function modeleBilan(ctx) {
  const { prog, aujourdhui, faits = {} } = ctx;
  // progression() et non totauxPrescrits() : apres prog.fin les deux donnent le
  // meme total, mais avant, seul le premier respecte le PRD §9 — « pas sur le
  // total du programme, sinon tout le monde est a 15 % le 5 aout ». Le bilan
  // ouvert en avance reste donc juste, sans un seul cas particulier.
  const p = progression(prog, aujourdhui, faits);
  const seances = seancesTerminees(prog, faits);

  // Le <= inclut la seance du jour, comme progression le fait : un < mettrait
  // sur le meme ecran un denominateur qui la compte et une liste qui ne la
  // montre pas.
  const lignes = prog.seances
    .filter((s) => s.date <= aujourdhui)
    .map((s) => ligneSeance(prog, s, aujourdhui, faits));

  const restantes = prog.seances.filter((s) => s.date > aujourdhui).length;
  const enCours = aujourdhui <= prog.fin;
  let avis = null;
  if (enCours && restantes > 0) {
    avis = `Le programme n’est pas fini. Il reste ${pluriel(restantes, 'séance')} `
      + `d’ici au ${dateEnToutesLettres(prog.fin)}.`;
  } else if (enCours) {
    // Les 18, 19, 20 et 21 aout : le programme n'est pas fini mais n'a plus rien
    // a proposer. Une phrase unique mentirait quatre jours d'affilee.
    avis = `Le programme se termine le ${dateEnToutesLettres(prog.fin)}. Plus aucune séance d’ici là.`;
  }

  // totauxAccomplis, jamais totauxPrescrits : le bilan additionne ce qui a ete
  // coche. Afficher le prescrit reviendrait a feliciter quelqu'un pour le
  // programme qu'un autre a ecrit.
  const volume = lignesVolume(totauxAccomplis(prog, faits));
  // PHRASE_VOLUME_VIDE ne sert QUE dans un cas : des cases cochees, mais aucune
  // qui porte un volume mesurable. Quand rien n'est coche du tout, PHRASE_RIEN a
  // deja tout dit, et deux messages de vide empiles sont exactement le ton que
  // cet ecran refuse.
  const vide = volume.length === 0 && p.cochees > 0 ? PHRASE_VOLUME_VIDE : null;

  return {
    titre: TITRE_BILAN,
    periode: `du ${dateEnToutesLettres(prog.debut)} au ${dateEnToutesLettres(prog.fin)}`,
    enCours,
    avis,
    resume: {
      seances,
      seancesTotal: prog.seances.length,
      cases: p.cochees,
      casesTotal: p.programmees,
      pourcent: Math.round(p.part * 100),
      // <progress max="0"> est invalide.
      echelle: Math.max(1, p.programmees),
      phrase: phraseBilan({ seances, cases: p.cochees }),
    },
    // « montrer » est une REGLE, donc elle vit dans le modele : posee dans le
    // montage, elle serait hors de portee de node --test.
    volume: { lignes: volume, vide, montrer: volume.length > 0 || vide !== null },
    seances: lignes,
    detail: { texte: TEXTE_DETAIL, href: '#/perso' },
  };
}

// --- le montage -------------------------------------------------------------
//
// AUCUNE ANIMATION sur cet ecran. Le PRD §10 fonde le mouvement comme une
// recompense qui vient apres l'action ; ici rien ne vient de se produire, la
// derniere case a ete cochee il y a des jours. Un compteur qui roule a l'arrivee
// ferait attendre pour lire.

function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  // textContent, jamais du HTML compose : programme.json est edite a la main, un
  // chevron dans un titre casserait la page.
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

export function monterBilan(hote, ctx) {
  const m = modeleBilan(ctx);
  const section = el('section', 'ecran ecran-bilan');

  section.append(el('h1', 'titre-ecran', m.titre), el('p', 'periode-bilan', m.periode));
  if (m.avis !== null) section.append(el('p', 'avis-bilan', m.avis));

  const resume = el('div', 'resume-bilan');
  // Muette : le pourcentage est ecrit en toutes lettres juste au-dessus, et
  // l'annoncer deux fois n'apprend rien.
  const ligneBarre = el('p', 'progression-bilan');
  ligneBarre.append(creerBarre(m.resume.cases, m.resume.echelle, { muette: true }));
  resume.append(
    el('p', 'chiffre-bilan', `${m.resume.pourcent} %`),
    ligneBarre,
    el('p', 'phrase-bilan', m.resume.phrase),
  );
  section.append(resume);

  if (m.volume.montrer) {
    const bloc = el('section', 'volume-bilan');
    bloc.append(el('h2', 'titre-bloc', 'Ce que tu as accumulé'));
    if (m.volume.vide !== null) {
      bloc.append(el('p', 'aide', m.volume.vide));
    } else {
      const liste = el('ul', 'liste-volume');
      for (const l of m.volume.lignes) {
        const item = el('li', 'item-volume', l.phrase);
        item.dataset.unite = l.unite;
        liste.append(item);
      }
      bloc.append(liste);
    }
    section.append(bloc);
  }

  const blocSeances = el('section', 'seances-bilan');
  blocSeances.append(el('h2', 'titre-bloc', 'Tes séances'));
  const liste = el('ul', 'liste-seances');
  for (const s of m.seances) {
    const item = el('li', 'ligne-seance');
    const lien = el('a', `lien-seance jour-${s.statut}`);
    lien.href = s.href;
    const marque = el('span', 'marque-seance', s.marque);
    marque.setAttribute('aria-hidden', 'true');
    const texte = el('span', 'texte-seance', s.titre);
    texte.setAttribute('aria-hidden', 'true');
    lien.append(marque, texte);
    if (s.detail !== null) {
      const detail = el('span', 'detail-seance', s.detail);
      detail.setAttribute('aria-hidden', 'true');
      lien.append(detail);
    }
    // Une seule phrase pour un lecteur d'ecran, la ou l'oeil lit une colonne.
    lien.append(el('span', 'lu-seul', s.nom));
    item.append(lien);
    liste.append(item);
  }
  blocSeances.append(liste);
  section.append(blocSeances);

  // Le classement fige. Aucun gel n'est implemente ici : le serveur ecrete le
  // jour a la fin du programme et refuse tout envoi posterieur, donc le
  // classement affiche est constant PAR CONSTRUCTION.
  //
  // Le bloc d'action de #/perso n'est PAS monte ici — un test le verifie en
  // cherchant son nom dans ce fichier, commentaires compris, d'ou la periphrase.
  // « Apparaitre au classement » proposerait de rejoindre un classement ferme :
  // la requete partirait, le serveur refuserait, et l'enfant lirait une erreur
  // pour un geste que l'ecran venait de lui proposer.
  const equipe = el('section', 'bloc-equipe');
  const demonterEquipe = monterEquipe(equipe, ctx);
  section.append(equipe);

  const lien = el('a', 'bouton', m.detail.texte);
  lien.href = m.detail.href;
  section.append(lien);

  hote.append(section);
  // L'ecouteur de l'equipe vit sur `document`, que le routeur ne vide pas.
  return demonterEquipe;
}

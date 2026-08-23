// vue-jour.js — l'ecran du jour : la seance d'aujourd'hui, le repos qui annonce
// la prochaine, ou la fin du programme.
//
// `modeleJour` calcule tout ce qui s'affiche et ne touche a rien ; `monterJour`
// l'ecrit dans le DOM et ne calcule rien. C'est ce partage qui rend les trois
// cas du PRD §6 verifiables sans navigateur.

import { creerBarre } from './barre.js';
import { etatSeance, seanceDuJour, seanceSuivante } from './domaine.js';

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// La date en toutes lettres, a partir du jour calendaire seul. On ancre a midi
// UTC et on relit les composantes en UTC : aucun fuseau ne peut alors faire
// glisser le jour d'un cran, ce qu'un `new Date('2026-08-03')` lu en heure
// locale fait des qu'on est a l'ouest de Greenwich.
export function dateEnToutesLettres(dateISO) {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const jour = d.getUTCDate();
  return `${JOURS[d.getUTCDay()]} ${jour === 1 ? '1er' : jour} ${MOIS[d.getUTCMonth()]}`;
}

// Le modele de l'ecran. `lien` et `etat` valent null quand il n'y a rien a
// ouvrir ni rien a mesurer — un jour de repos n'a pas de barre de progression.
export function modeleJour(ctx) {
  const { prog, aujourdhui, prenom, faits } = ctx;
  const { seance, cas } = seanceDuJour(prog, aujourdhui);
  const salutation = `Salut ${prenom}`;

  if (cas === 'terminee') {
    return {
      cas,
      salutation,
      titre: 'Programme terminé',
      details: `Le programme s’est arrêté le ${dateEnToutesLettres(prog.fin)}.`,
      lien: null,
      etat: null,
    };
  }

  if (cas === 'repos') {
    // Entre la derniere seance et la fin du programme, `seance` vaut null : il
    // reste du repos, mais plus rien a annoncer.
    if (seance === null) {
      return {
        cas,
        salutation,
        titre: 'Repos aujourd’hui',
        details: `Plus de séance d’ici la fin du programme, le ${dateEnToutesLettres(prog.fin)}.`,
        lien: null,
        etat: null,
      };
    }
    return {
      cas,
      salutation,
      titre: 'Repos aujourd’hui',
      details: `Prochaine séance ${dateEnToutesLettres(seance.date)} : ${seance.titre}.`,
      // Une seance a venir est visible, pas cochable (PRD §9) : on peut lire ce
      // qui arrive.
      lien: { texte: 'Voir la séance', href: `#/seance/${seance.date}` },
      etat: null,
    };
  }

  const etat = etatSeance(prog, seance.date, aujourdhui, faits);
  const av = avancement(etat);
  return {
    cas,
    salutation,
    titre: seance.titre,
    details: `${etat.total} exercices · ${dateEnToutesLettres(seance.date)}`,
    // Remplace le score « n / total », qui repetait un total deja ecrit dans
    // `details` juste au-dessus. Couvre les trois etats et se lit sans avoir a
    // comparer deux chiffres : c'etait le defaut d'origine, ou 7/7 s'affichait
    // exactement comme 0/7 (rien dans l'ecran ne disait « fini »).
    phrase: PHRASE_AVANCEMENT[av](etat),
    // Ce que la voix annonce a cote de la barre — critique du 22 aout, §P2 :
    // sur l'etat « en-cours », c'est litteralement la meme fonction que la
    // phrase (VOIX_AVANCEMENT le reference, ne le recopie pas), donc l'oeil et
    // la voix ne peuvent pas se mettre a dire deux choses differentes avec le
    // temps.
    texteVoix: VOIX_AVANCEMENT[av](etat),
    lien: LIEN_AVANCEMENT[av](seance, prog),
    etat,
  };
}

// Le mot du bouton et la phrase d'avancement partagent le MEME avancement,
// calcule une seule fois : aucun des deux ne relit `etat.coches` de son cote,
// donc ils ne peuvent jamais se contredire l'un l'autre.
function avancement(etat) {
  if (etat.coches === 0) return 'aucune';
  if (etat.coches === etat.total) return 'complete';
  return 'en-cours';
}

// Le lien du bloc bleu, un par etat, et un seul endroit qui decide : avant le
// premier correctif, le bouton disait « Reprendre » y compris sur une seance
// jamais commencee et sur une seance finie.
//
// `complete` ne relit plus la seance du jour (critique du 22 aout, §P2,
// variante C tranchee par l'utilisateur, contre le simple retrait du bouton
// et la felicitation a sa place) : le bloc bleu reste fort, mais pointe la
// PROCHAINE seance du programme — il ne dit plus « va faire ta seance » une
// fois qu'elle est faite. `seanceSuivante` est le meme calcul que celui du
// jour de repos (domaine.js) : aucune date n'est devinee ici. S'il n'y en a
// plus — la derniere seance du programme vient de se terminer — rien
// n'invente une date de remplacement : le bouton retombe sur son
// comportement d'origine, relire la seance qu'on vient de finir.
const LIEN_AVANCEMENT = {
  aucune: (seance) => ({ texte: 'Commencer la séance', href: `#/seance/${seance.date}` }),
  'en-cours': (seance) => ({ texte: 'Reprendre la séance', href: `#/seance/${seance.date}` }),
  complete: (seance, prog) => {
    const suivante = seanceSuivante(prog, seance.date);
    return suivante
      ? { texte: `Prochaine séance : ${dateEnToutesLettres(suivante.date)}`, href: `#/seance/${suivante.date}` }
      : { texte: 'Revoir la séance', href: `#/seance/${seance.date}` };
  },
};

// Les trois phrases. `aucune` et `complete` ne portent pas de chiffre : elles
// n'ont rien a faire comparer, ce que « 0 sur 7 » ou « 7 sur 7 »
// demanderaient encore. `en-cours` ne compte plus ce qui est fait mais ce qui
// RESTE (critique du 22 aout, §P2, variante C) : c'est le seul endroit ecrit
// qui porte encore un chiffre sur cet ecran, et ce chiffre n'est ecrit nulle
// part ailleurs — la ligne au-dessus (`details`) garde le TOTAL, jamais le
// reste, donc rien ne se repete plus. Un seul nombre : aucun accord n'est a
// gerer, « reste » ne s'accorde qu'avec « il », jamais avec ce qu'il compte —
// « Il t’en reste 1 » se lit aussi juste que « Il t’en reste 4 ».
const PHRASE_AVANCEMENT = {
  aucune: () => 'Pas encore commencée',
  'en-cours': (etat) => `Il t’en reste ${etat.total - etat.coches}`,
  complete: () => 'Séance terminée',
};

// Ce que la voix annonce a cote de la barre (barre.js, `aria-valuetext`).
// `en-cours` REFERENCE la meme fonction que PHRASE_AVANCEMENT au lieu de
// recalculer un texte voisin : l'oeil et la voix ne peuvent alors pas
// diverger, meme si l'un des deux textes change plus tard sans que l'autre
// suive. `aucune` et `complete` gardent le format « n sur total » : leur
// phrase ne porte aucun chiffre, il n'y a donc rien avec quoi il pourrait se
// contredire.
const VOIX_AVANCEMENT = {
  aucune: (etat) => `${etat.coches} sur ${etat.total}`,
  'en-cours': (etat) => PHRASE_AVANCEMENT['en-cours'](etat),
  complete: (etat) => `${etat.coches} sur ${etat.total}`,
};

export function monterJour(hote, ctx) {
  const m = modeleJour(ctx);

  const section = document.createElement('section');
  section.className = 'ecran ecran-jour';
  section.classList.add(`cas-${m.cas}`);

  const salutation = document.createElement('p');
  salutation.className = 'salutation';
  // `textContent`, jamais `innerHTML` : le prenom vient du champ de l'enfant, il
  // s'affiche, il ne s'interprete pas.
  salutation.textContent = m.salutation;

  const titre = document.createElement('h1');
  titre.className = 'titre-jour';
  titre.textContent = m.titre;

  const details = document.createElement('p');
  details.className = 'details-jour';
  details.textContent = m.details;

  section.append(salutation, titre, details);
  if (m.etat !== null) section.append(barreProgression(m.etat, m.phrase, m.texteVoix));

  if (m.lien !== null) {
    // Un vrai lien, pas un bouton : le bouton retour du telephone doit ramener
    // ici depuis l'ecran de seance.
    const lien = document.createElement('a');
    lien.className = 'bouton bouton-principal';
    lien.href = m.lien.href;
    lien.textContent = m.lien.texte;
    section.append(lien);
  }

  hote.append(section);
}

// La barre commune de barre.js, pleine largeur, et la phrase d'avancement
// dessous (calculee par `modeleJour`, jamais ici : cette fonction ne fait que
// l'ecrire dans le DOM). C'est un etat, pas une recompense : le mouvement du
// PRD §10 est celui de l'ecran de seance, qui recoche.
//
// Un <div>, pas un <p> : la phrase ci-dessous est elle-meme un <p>, et un <p>
// n'accueille pas de bloc.
//
// La barre n'est pas muette : c'est la seule de l'ecran, et la phrase juste en
// dessous n'est pas reliee a elle (aria-labelledby y perdrait l'annonce « ce
// qu'elle mesure », que porte cette phrase-ci).
//
// Le nom de la barre ne porte PAS le compte, et c'est deliberé : `reglerBarre`
// tient les deux nombres a jour dans `aria-valuetext`, jamais dans le nom. Les
// mettre ici les aurait dits deux fois de suite a la voix — « 3 sur 7, barre
// de progression, 3 sur 7 ».
//
// `texteVoix` (calcule par `modeleJour`, via VOIX_AVANCEMENT) remplace ce que
// `creerBarre` aurait dicte par defaut : sans lui, un etat « en-cours »
// afficherait « Il t’en reste 4 » a l'oeil et annoncerait « 3 sur 7 » a la
// voix — l'oeil et la voix ne divergent pas, c'est ce que ce parametre
// garantit.
function barreProgression(etat, phrase, texteVoix) {
  const bloc = document.createElement('div');
  bloc.className = 'progression-jour';

  const nom = 'Avancement des exercices de la séance';
  const barre = creerBarre(etat.coches, etat.total, { nom, texte: texteVoix });

  const texte = document.createElement('p');
  texte.className = 'avancement-jour';
  texte.textContent = phrase;

  bloc.append(barre, texte);
  return bloc;
}

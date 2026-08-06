// vue-jour.js — l'ecran du jour : la seance d'aujourd'hui, le repos qui annonce
// la prochaine, ou la fin du programme.
//
// `modeleJour` calcule tout ce qui s'affiche et ne touche a rien ; `monterJour`
// l'ecrit dans le DOM et ne calcule rien. C'est ce partage qui rend les trois
// cas du PRD §6 verifiables sans navigateur.

import { etatSeance, seanceDuJour } from './domaine.js';

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
  return {
    cas,
    salutation,
    titre: seance.titre,
    details: `${etat.total} exercices · ${dateEnToutesLettres(seance.date)}`,
    lien: {
      texte: etat.coches === 0 ? 'Commencer la séance' : 'Reprendre la séance',
      href: `#/seance/${seance.date}`,
    },
    etat,
  };
}

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
  if (m.etat !== null) section.append(barreProgression(m.etat));

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

// `<progress>` natif : annonce par les lecteurs d'ecran, sans calcul de largeur
// ni bibliotheque. C'est un etat, pas une recompense — la barre a ressort du
// PRD §10 est celle de l'ecran de seance, et elle appartient au PRP 06.
function barreProgression(etat) {
  const bloc = document.createElement('p');
  bloc.className = 'progression-jour';

  const barre = document.createElement('progress');
  barre.className = 'barre';
  barre.max = etat.total;
  barre.value = etat.coches;

  const compte = document.createElement('span');
  compte.className = 'compte';
  compte.textContent = `${etat.coches} / ${etat.total}`;

  bloc.append(barre, compte);
  return bloc;
}

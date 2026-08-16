// vue-jour.js — l'écran du jour (PRP 04 chantier A, PRD §7.2).
//
// Un seul écran pour les deux cas du PRD §7.2, parce que ce sont deux états
// du même écran et non deux écrans. `modeleJour` calcule tout ce qui
// s'affiche et ne touche à rien ; `monterJour` l'écrit dans le DOM et ne
// calcule rien — c'est ce partage qui rend les cas vérifiables sans
// navigateur (comme `marcq-handball`).
//
// L'écran ne montre JAMAIS de rouge, de retard, ni de compte de ce qui n'a
// pas été fait (PRD §14 : l'abandon est le risque principal).

import { seance, seanceContenant } from './programme.js';
import {
  exerciceAuHasard, prochaineSeance, semaineCourante, semaineVenantDetreBouclee,
} from './domaine.js';
import { ecrireEtat } from './etat.js';
import { construireBilan } from './bilan.js';

const SEMAINES_DU_PROGRAMME = 8;

function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

// Les noms de familles, dans l'ordre d'apparition dans la séance, sans
// doublon — jamais écrits en dur : dérivés de `programme.json` (ossature §7
// point 2).
function famillesDeSeance(programme, s) {
  const nomParId = new Map(programme.familles.map((f) => [f.id, f.nom]));
  const exParId = new Map(programme.exercices.map((ex) => [ex.id, ex]));
  const vues = new Set();
  const noms = [];
  for (const idEx of s.exercices) {
    const ex = exParId.get(idEx);
    if (ex !== undefined && !vues.has(ex.famille)) {
      vues.add(ex.famille);
      noms.push(nomParId.get(ex.famille) ?? ex.famille);
    }
  }
  return noms;
}

// A9 (« Ajouté après les PRP ») : une ligne discrète, jamais un chiffre ni une
// promesse chiffrée — juste le nom de ce qui vient ensuite. Sur la dernière
// séance de la semaine (numero 4), il n'y a plus de séance suivante DANS
// cette semaine : la ligne annonce la semaine suivante, ou la fin du
// programme si celle-ci est la huitième.
function texteApres(programme, semaineActuelle, numero) {
  if (numero < 4) {
    const suivante = seance(programme, numero + 1);
    return `Après, ce sera ${suivante.nom}.`;
  }
  if (semaineActuelle >= SEMAINES_DU_PROGRAMME) {
    return 'Après, ton programme sera terminé.';
  }
  return `Après, ce sera la semaine ${semaineActuelle + 1}.`;
}

// Le modèle de l'écran, pur (ossature §6). `semaine` est celle qui compte
// pour l'affichage — bornée à huit, le cas au-delà étant « terminé ».
//
// A5 (« Ajouté après les PRP ») : la semaine ne se déduit plus de l'horloge —
// `semaineCourante` ne lit que les faits et la semaine de départ. Un exercice
// dont la séance venait de boucler la semaine n'atterrit donc plus jamais
// directement dans la séance suivante : tant qu'elle n'a RIEN commencé de la
// nouvelle semaine, `semaineVenantDetreBouclee` la retient sur le palier
// « bouclée », qui ne se quitte que d'un geste explicite et confirmé
// (vue-jour.js, cas « bouclee »).
export function modeleJour(ctx) {
  const { etat, programme } = ctx;
  const semaineBrute = semaineCourante(programme, etat.faits, etat.semaineDeDepart);

  if (semaineBrute > SEMAINES_DU_PROGRAMME) {
    return { cas: 'termine', semaine: SEMAINES_DU_PROGRAMME };
  }

  const bouclee = semaineVenantDetreBouclee(programme, etat.faits, etat.semaineDeDepart);
  if (bouclee !== null) {
    const premiere = seance(programme, 1);
    return {
      cas: 'bouclee',
      semaine: bouclee,
      semaineSuivante: semaineBrute,
      nomSuivant: premiere.nom,
    };
  }

  const semaine = semaineBrute;
  // Garanti non null : `semaine` est par construction une semaine dont les
  // quatre séances ne sont pas toutes faites (voir `semaineCourante`).
  const numero = prochaineSeance(programme, etat.faits, semaine);
  const s = seance(programme, numero);
  return {
    cas: 'a-faire',
    semaine,
    numero,
    nom: s.nom,
    familles: famillesDeSeance(programme, s),
    apres: texteApres(programme, semaine, numero),
  };
}

// Le mot le plus long de `nom`, sans espace (finition, correctif C) : la
// taille d'affichage doit se plier a l'unite qui ne peut jamais se couper en
// fin de ligne, pas a la longueur totale — sinon « Le socle », qui se replie
// deja proprement sur deux lignes ("Le" / "socle"), ratatinerait pour rien.
function plusLongMot(nom) {
  return nom.split(/\s+/).reduce((max, mot) => Math.max(max, mot.length), 1);
}

function construireStrass(nombreDeFacettes = 6) {
  const conteneur = el('div', 'strass strass--balaie');
  for (let i = 0; i < nombreDeFacettes; i += 1) conteneur.append(el('span', 'strass__facette'));
  return conteneur;
}

// L'accueil est le seul carrefour de l'application (PRP 05, PRP 07) : c'est
// d'ici, et de nulle part d'autre en dehors d'un « Retour », qu'on rejoint la
// grille et les reglages. Deux vrais liens (`<a>`), pas des boutons : le
// bouton retour du telephone doit fonctionner, et un appui long doit pouvoir
// les ouvrir dans un autre onglet.
function construireNavigationSecondaire(afficherLienBilan) {
  const nav = el('div', 'nav-secondaire');
  const versGrille = document.createElement('a');
  versGrille.className = 'bouton--discret';
  versGrille.href = '#/grille';
  versGrille.textContent = 'Ta grille';
  // Lot ludique, A13 (« Ajouté après les PRP ») : le justaucorps se regarde
  // depuis son propre écran, atteignable depuis celui-ci — jamais pendant une
  // séance (même règle que `.strass`, voir vue-seance.js).
  const versJustaucorps = document.createElement('a');
  versJustaucorps.className = 'bouton--discret';
  versJustaucorps.href = '#/justaucorps';
  versJustaucorps.textContent = 'Ton justaucorps';
  const versReglages = document.createElement('a');
  versReglages.className = 'bouton--discret';
  versReglages.href = '#/reglages';
  versReglages.textContent = 'Réglages';
  nav.append(versGrille, versJustaucorps, versReglages);
  // A17 (lot ludique) : « le bilan reste accessible après » — dès qu'il
  // existe, il reste atteignable depuis l'écran du jour, quel que soit son
  // état courant (y compris après un nouveau programme redémarré).
  if (afficherLienBilan) {
    const versBilan = document.createElement('a');
    versBilan.className = 'bouton--discret';
    versBilan.href = '#/bilan';
    versBilan.textContent = 'Ton été';
    nav.append(versBilan);
  }
  return nav;
}

// A15 (lot ludique, « Ajouté après les PRP ») : « Un exercice au hasard »,
// atteignable depuis l'écran du jour quel que soit son état — une semaine
// bouclée ou un programme terminé n'empêchent pas d'avoir cinq minutes à
// tuer. Discret : le geste principal de l'écran reste celui qui fait avancer
// le programme, jamais ce bouton-ci.
function construireBoutonHasard(ctx, semaine) {
  const { programme, etat, alea } = ctx;
  const bouton = el('button', 'bouton--discret', 'Un exercice au hasard');
  bouton.type = 'button';
  bouton.addEventListener('click', () => {
    const ex = exerciceAuHasard(programme, etat.faits, semaine, alea);
    if (ex === null) return; // garde-fou : le programme porte toujours des exercices
    const numero = seanceContenant(programme, ex.id) ?? 1;
    if (typeof location !== 'undefined') location.hash = `#/seance/${numero}/${ex.id}/${semaine}/hasard`;
  });
  return bouton;
}

export function monterJour(hote, ctx) {
  const m = modeleJour(ctx);

  const section = el('section', 'ecran-jour zone-surete');
  // Le passepoil et la couture sont un seul element (style.css,
  // `.empiecement::before`) : rien a monter ici a part l'empiecement
  // lui-meme (finition, correctif 2).
  const empiecement = el('div', 'empiecement');
  // Les deux etiquettes vivent chacune sur sa ligne (finition, correctif A) :
  // deux `span` inline-block juxtaposes sans texte entre eux se collent sans
  // le moindre espace — semaine et seance venaient s'accoler tout court,
  // sans espace ni separateur. Ce n'etait pas un probleme de contenu mais de
  // mise en page, ce conteneur le tranche.
  const etiquettes = el('div', 'empiecement__etiquettes');
  etiquettes.append(el('span', 'etiquette', `Semaine ${m.semaine}`));
  // « Séance X sur 4 » vit desormais dans l'empiecement, a cote de la
  // semaine : ce n'est plus un surtitre pose au-dessus du nom de la seance
  // (finition, correctifs 5 et 6) — seul le nom occupe le champ jersey.
  if (m.cas === 'a-faire') {
    etiquettes.append(el('span', 'etiquette', `Séance ${m.numero} sur 4`));
  }
  empiecement.append(etiquettes);
  section.append(empiecement);

  const corps = el('div', 'jersey corps-jour');

  // A17 (lot ludique, « Ajouté après les PRP ») : l'instantané se fige UNE
  // SEULE FOIS, au moment précis où le cas « termine » se constate pour la
  // première fois — jamais recalculé ensuite, jamais effacé par un programme
  // qui redémarre (`bilan.js`). `bilanPresent` reste local à ce rendu :
  // `ecrireEtat` lit et écrit le magasin, jamais `ctx.etat` lui-même.
  let bilanPresent = Boolean(ctx.etat.bilan);
  if (m.cas === 'termine' && !bilanPresent) {
    ecrireEtat({ bilan: construireBilan(ctx.programme, ctx.etat, ctx.maintenant) });
    bilanPresent = true;
  }

  if (m.cas === 'termine') {
    corps.append(el('h1', 'titre-jour', 'Ton programme est terminé'));
    corps.append(el(
      'p',
      null,
      'Les huit semaines sont passées — bravo. Ta grille reste là pour la revoir.',
    ));
    const versBilan = el('button', 'bouton', 'Voir ton été');
    versBilan.type = 'button';
    versBilan.addEventListener('click', () => {
      if (typeof location !== 'undefined') location.hash = '#/bilan';
    });
    corps.append(versBilan);
  } else if (m.cas === 'bouclee') {
    // Meme traitement que le cas « a-faire » (finition) : un seul objet
    // focal, dans le meme emplacement — `.objectif-seance`, qui grandit et se
    // centre dans le champ jersey — plutot qu'un simple `h1.titre-jour` suivi
    // de ~900px de vide. Le rang de strass reste sous le titre : c'est le
    // seul ecran, avec les badges, ou il est permis (ossature §5.3).
    const objectifNoeud = el('h1', 'objectif-seance');
    const texteBoucle = 'Ta semaine est bouclée.';
    const nomNoeud = el('span', 'objectif-seance__nom', texteBoucle);
    nomNoeud.style.setProperty('--plus-long-mot', String(plusLongMot(texteBoucle)));
    objectifNoeud.append(nomNoeud);
    objectifNoeud.append(construireStrass());
    corps.append(objectifNoeud);

    // A5 : la semaine n'avance plus toute seule — elle avance quand elle le
    // decide, d'un geste explicite ET confirme (le calendrier ne pousse
    // plus rien). Tant qu'elle ne l'a pas fait, ce palier reste affiche
    // indefiniment : rien ne la bouscule (PRD §14, l'abandon est le risque
    // principal). Le nom de la semaine suivante (A9) est deja porte par le
    // bouton lui-meme, pas besoin d'une ligne de plus qui le repeterait.
    const continuerBouton = el('button', 'bouton', `Semaine suivante : ${m.nomSuivant}`);
    continuerBouton.type = 'button';
    const confirmationNoeud = el('div', 'confirmation-case');
    confirmationNoeud.hidden = true;

    function fermerConfirmation() {
      confirmationNoeud.hidden = true;
      confirmationNoeud.replaceChildren();
    }

    continuerBouton.addEventListener('click', () => {
      confirmationNoeud.replaceChildren();
      confirmationNoeud.hidden = false;
      confirmationNoeud.append(el(
        'p',
        'confirmation-case__question',
        `Passer à la semaine ${m.semaineSuivante} ? Elle commence par ${m.nomSuivant}.`,
      ));
      const rangee = el('div', 'confirmation-case__boutons');
      const oui = el('button', 'bouton', 'Oui');
      oui.type = 'button';
      const non = el('button', 'bouton--discret', 'Non');
      non.type = 'button';
      oui.addEventListener('click', () => {
        if (typeof location !== 'undefined') location.hash = '#/seance/1';
      });
      non.addEventListener('click', fermerConfirmation);
      rangee.append(oui, non);
      confirmationNoeud.append(rangee);
    });

    // A21 (« Ajouté après les PRP ») : « Refaire une séance » avait disparu
    // (A5) parce que « #/seance/<numero> » désignait une séance SANS SA
    // SEMAINE, et visait donc la semaine SUIVANTE dès que la semaine
    // courante ne se déduit plus du calendrier — un doublon exact du bouton
    // ci-dessus. La route « #/seance/<numero>/<semaine> » porte les deux :
    // elle rejoue la première séance de LA SEMAINE QU'ELLE VIENT DE FINIR
    // (`m.semaine`, jamais `m.semaineSuivante`), avec les objectifs de cette
    // semaine-là (vue-seance.js, `rejeuDepuisHash`), et la ramène ici — «
    // #/jour » — une fois faite.
    const refaireBouton = el('button', 'bouton--discret', 'Refaire une séance');
    refaireBouton.type = 'button';
    refaireBouton.addEventListener('click', () => {
      if (typeof location !== 'undefined') location.hash = `#/seance/1/${m.semaine}`;
    });
    corps.append(continuerBouton, confirmationNoeud, refaireBouton);
  } else {
    // Un seul objet focal (finition, correctif 5) : le nom de la séance,
    // seul, à la taille d'affichage, dans l'emplacement que `.objectif-seance`
    // occupe sur l'écran de séance — jamais un simple `h1.titre-jour`, bien
    // plus petit que le plus grand texte de l'application.
    const objectifNoeud = el('h1', 'objectif-seance');
    const nomNoeud = el('span', 'objectif-seance__nom', m.nom);
    // La taille d'affichage se plie au panneau (finition, correctif C) : sans
    // borne derivee du mot le plus long, « L'équilibre » et « L'acrobatie »
    // — plus longs que « Le socle » — debordent des deux cotes de l'ecran.
    nomNoeud.style.setProperty('--plus-long-mot', String(plusLongMot(m.nom)));
    objectifNoeud.append(nomNoeud);
    objectifNoeud.append(el('span', 'familles-jour', m.familles.join(' · ')));
    corps.append(objectifNoeud);
    // A9 (« Ajouté après les PRP ») : une ligne discrète, elle ne concurrence
    // pas l'objet focal ci-dessus.
    corps.append(el('p', 'apres-jour', m.apres));
    const bouton = el('button', 'bouton', 'Commencer');
    bouton.type = 'button';
    bouton.addEventListener('click', () => {
      if (typeof location !== 'undefined') location.hash = `#/seance/${m.numero}`;
    });
    corps.append(bouton);
  }

  // A15 (lot ludique) : l'objectif du tirage suit la semaine COURANTE, bornée
  // à huit comme partout ailleurs (vue-liste.js) — un programme terminé
  // continue de proposer l'objectif du dernier palier plutôt que de
  // désactiver le bouton.
  const semaineHasard = Math.min(
    semaineCourante(ctx.programme, ctx.etat.faits, ctx.etat.semaineDeDepart),
    8,
  );
  corps.append(construireBoutonHasard(ctx, semaineHasard));

  corps.append(construireNavigationSecondaire(bilanPresent));

  section.append(corps);
  hote.append(section);

  return function demonter() {};
}

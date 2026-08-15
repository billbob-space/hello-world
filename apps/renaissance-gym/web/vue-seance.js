// vue-seance.js — la séance : un exercice à l'écran, jamais deux (PRP 04
// chantier C, PRD §5, §7.3, §9.1, §9.2, §11.3, §15.3).
//
// LE RANG DE STRASS EST INTERDIT ICI (ossature §5.3) : c'est l'écran de
// l'effort, pas celui de la récompense. Ce fichier ne monte jamais `.strass`.
//
// LE MODE VIENT DE LA DONNÉE, JAMAIS DU LIBELLÉ : `ex.mesure === 'tenue'`
// monte un minuteur, `'repetitions'` n'en monte pas — ce module ne lit
// jamais `ex.libelle` pour décider quoi que ce soit.
//
// A3 bis (« Ajouté après les PRP ») : le même écran sert aussi à « Lancer »
// un seul exercice depuis le détail d'une séance de la grille — jamais un
// second écran réécrit. La sous-route « #/seance/<numero>/<exercice>/<semaine> »
// (`cibleUniqueDepuisHash`) réduit la file à ce seul exercice, prend son
// objectif dans LA SEMAINE DE LA CASE plutôt que la semaine courante, et
// renvoie au détail de cette séance plutôt qu'à l'écran du jour une fois
// validé — c'est de là qu'elle est venue, il lui en reste peut-être d'autres
// à rattraper. « Passer » n'a pas de sens sur une file d'un seul exercice
// choisi exprès : il ne se monte pas dans ce mode.
//
// A6 (« Ajouté après les PRP ») : le §7.3 promettait « elle peut quitter en
// cours de séance » depuis le premier jour — la file gardée, la reprise
// fonctionnelle — mais aucun bouton ne le permettait. « Sortir » l'ajoute :
// discret (`.bouton--discret`, jamais le geste principal) et TOUJOURS visible
// (jamais masqué par `hidden`, contrairement à « Passer » en mode cible
// unique) sur l'écran d'un exercice en cours. Elle ramène à
// `destinationRetour()` — l'écran du jour, ou le détail de la séance d'où
// elle vient en mode cible unique, exactement comme la validation. Rien à
// persister de plus : ce qui est validé l'est déjà (`ajouterFait`), et la
// file n'a pas bougé depuis le dernier rendu.

import { exercicesDeSeance, objectif, objectifTexte } from './programme.js';
import {
  faitsDeSeance, prochaineSeance, semaineCourante,
  fileInitiale, passerEnFile, fileNeContientQueDesPasses,
} from './domaine.js';
import { ajouterFait, ecrireEtat, ecrireFileSeance } from './etat.js';
import { creerChrono, formater } from './chrono.js';
import { debloquerAudio, bip, FREQUENCES_BIP, sonnerie } from './sonnerie.js';
import { garderEcranAllume } from './app.js';
import { RECORDS_VIDES, fusionnerRecords, recordsDepuisFaits } from './records.js';

function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

// Sous-route « #/seance/<numero> » : force la séance à rejouer (écran du
// jour, « Refaire une séance », PRD §9.5). Sans suffixe valide, `null` — la
// séance vient alors de `domaine.prochaineSeance`. Le numéro se lit aussi
// quand la sous-route porte en plus une cible unique (voir
// `cibleUniqueDepuisHash` juste en dessous) : le segment optionnel n'est
// jamais capturé ici, seul le premier compte.
export function numeroDepuisHash(hash) {
  const trouve = /^#\/seance\/(\d+)(?:\/.*)?$/.exec(String(hash ?? ''));
  if (trouve === null) return null;
  const n = Number(trouve[1]);
  return n >= 1 && n <= 4 ? n : null;
}

// Sous-route « #/seance/<numero>/<exercice>/<semaine> » : A3 bis, « Lancer »
// un seul exercice depuis le détail d'une séance de la grille. `null` quand
// la route ne porte pas cette forme précise — c'est alors la file entière de
// la séance qui se monte, comme avant.
//
// Le suffixe optionnel « /hasard » (A15, lot ludique, « Ajouté après les
// PRP ») marque le même mode cible unique, mais lancé depuis l'écran du jour
// plutôt que depuis le détail d'une séance de la grille : c'est le SEUL
// terrain qui change, la mécanique — un exercice, un minuteur, une sonnerie —
// est intégralement réutilisée. `cibleUniqueDepuisHash` ne rend le marqueur
// `hasard: true` QUE quand ce suffixe est présent — un appel sans lui rend
// exactement l'objet à deux clés d'avant, inchangé.
export function cibleUniqueDepuisHash(hash) {
  const trouve = /^#\/seance\/\d+\/([^/]+)\/(\d+)(\/hasard)?$/.exec(String(hash ?? ''));
  if (trouve === null) return null;
  const semaine = Number(trouve[2]);
  if (!Number.isInteger(semaine) || semaine < 1 || semaine > 8) return null;
  return trouve[3] ? { exercice: trouve[1], semaine, hasard: true } : { exercice: trouve[1], semaine };
}

// PRD §9.1 : une séance interrompue à mi-parcours reprend au premier exercice
// non validé — jamais au premier de la liste.
export function indexPremierNonFait(programme, faits, semaine, numero) {
  const exercices = exercicesDeSeance(programme, numero);
  const faitsSet = faitsDeSeance(faits, semaine, numero);
  const idx = exercices.findIndex((ex) => !faitsSet.has(ex.id));
  return idx === -1 ? exercices.length : idx;
}

export function monterSeance(hote, ctx) {
  const { etat, programme, maintenant } = ctx;
  // A5 (« Ajouté après les PRP ») : la semaine courante se déduit désormais
  // des faits, jamais de l'horloge (voir domaine.js).
  const semaineActuelle = Math.min(semaineCourante(programme, etat.faits, etat.semaineDeDepart), 8);
  const hash = typeof location !== 'undefined' ? location.hash : '';
  const cibleUnique = cibleUniqueDepuisHash(hash);
  const numero = numeroDepuisHash(hash) ?? prochaineSeance(programme, etat.faits, semaineActuelle) ?? 1;
  // A3 bis : « Lancer » un seul exercice prend l'objectif de LA SEMAINE DE LA
  // CASE d'où il vient, jamais celle en cours (§4 du contrat qui a demandé
  // cette vue).
  const semaine = cibleUnique !== null ? cibleUnique.semaine : semaineActuelle;
  const exercicesSeance = exercicesDeSeance(programme, numero);
  const exercices = cibleUnique !== null
    ? exercicesSeance.filter((ex) => ex.id === cibleUnique.exercice)
    : exercicesSeance;
  const exParId = new Map(exercices.map((ex) => [ex.id, ex]));
  const total = exercices.length;
  const modeUnique = cibleUnique !== null;
  // A15 (lot ludique, « Ajouté après les PRP ») : « Un exercice au hasard »
  // est lancé depuis l'écran du jour, jamais depuis la grille — c'est ce que
  // change le suffixe « /hasard » sur `destinationRetour()` plus bas.
  const hasard = modeUnique && cibleUnique.hasard === true;

  // A1 (« Ajouté après les PRP ») : la file de la séance en cours — les
  // exercices non encore validés, dans leur ordre de présentation. Elle
  // reprend celle qu'`etat.js` a gardée SI elle correspond à cette même
  // semaine et cette même séance ; sinon elle repart du programme, dans son
  // ordre, moins ce qui est déjà validé (même reprise qu'`indexPremierNonFait`,
  // sous forme de file entière). Toute entrée qui ne correspond plus à un
  // exercice restant de CETTE séance (correction faite depuis la grille
  // pendant que la séance était interrompue, par exemple) est écartée, et ce
  // qui manquerait à la file est ajouté à la fin, dans l'ordre naturel.
  //
  // A3 bis : en mode « cible unique », la file ne porte que l'exercice
  // choisi, DÉJÀ VALIDÉ OU NON — refaire un exercice déjà coché est permis
  // (même règle que refaire une séance entière), et cette file-là n'est
  // jamais écrite dans `etat.fileSeance` : c'est un aparté d'un seul geste,
  // pas la file partagée d'une séance qui pourrait être en cours par
  // ailleurs, à une autre semaine ou une autre séance.
  let file;
  let passes;
  if (modeUnique) {
    file = exercices.map((ex) => ex.id);
    passes = new Set();
  } else {
    const faitsSet = faitsDeSeance(etat.faits, semaine, numero);
    const enAttente = fileInitiale(exercices, faitsSet);
    const gardee = etat.fileSeance;
    const reprendCetteSeance = gardee !== null && gardee.semaine === semaine && gardee.numero === numero;
    file = reprendCetteSeance
      ? [...gardee.file.filter((id) => enAttente.includes(id)), ...enAttente.filter((id) => !gardee.file.includes(id))]
      : [...enAttente];
    passes = new Set(reprendCetteSeance ? gardee.passes.filter((id) => enAttente.includes(id)) : []);
  }

  let chronoCourant = null; // pour l'arreter proprement au demontage (PRD §5)
  let audioDebloque = false;
  let avisMontre = false; // l'écran « il ne reste que des exercices passés » ne s'affiche qu'une fois

  // A11 (« Ajouté après les PRP ») : l'option des réglages, active par
  // défaut — coupée, aucun verrou n'est demandé du tout.
  if (etat.ecranAllume !== false) garderEcranAllume(true);

  const section = el('section', 'ecran-seance zone-surete');
  hote.append(section);

  function debloquerAuPremierGeste() {
    if (audioDebloque) return;
    audioDebloque = true;
    debloquerAudio();
  }

  function persisterFile() {
    // A3 bis : la file d'un aparté d'un seul exercice n'est jamais la file
    // partagée d'`etat.js` — l'écrire écraserait sinon la reprise d'une
    // séance en cours ailleurs, à une autre semaine ou une autre séance.
    if (modeUnique) return;
    ecrireFileSeance(semaine, numero, file, passes);
  }

  // A16 (lot ludique, « Ajouté après les PRP ») : les trois records ne
  // peuvent que monter (records.js) — cet appel les met à jour au moment même
  // où un fait vient d'être ajouté, à partir de CE QUE LES FAITS RACONTENT
  // MAINTENANT (`recordsDepuisFaits`), fusionné avec ce qui est déjà
  // enregistré. `tenueSecondes` n'est fourni que par le chemin « minuteur » :
  // c'est la seule information qu'aucun fait ne porte (un fait ne garde pas
  // la durée tenue), donc la seule qui ne peut pas se déduire après coup.
  function enregistrerRecords(etatApres, tenueSecondes) {
    const depuisFaits = recordsDepuisFaits(etatApres.faits);
    const instantane = tenueSecondes === undefined
      ? depuisFaits
      : { ...depuisFaits, plusLongueTenue: Math.max(depuisFaits.plusLongueTenue, tenueSecondes) };
    ecrireEtat({ records: fusionnerRecords(etatApres.records ?? RECORDS_VIDES, instantane) });
  }

  function valider(ex) {
    return ajouterFait({ seance: numero, semaine, exercice: ex.id, a: maintenant().toISOString() });
  }

  // A3 bis : le geste de retour ne ramène JAMAIS à l'écran du jour depuis un
  // aparté lancé de la grille — elle y revient d'où elle est partie, le
  // détail de CETTE séance, où il lui reste peut-être d'autres exercices à
  // rattraper. A15 (lot ludique) : un aparté « au hasard » y revient TOUJOURS,
  // puisqu'elle n'est jamais partie de la grille.
  function destinationRetour() {
    if (modeUnique && hasard) return '#/jour';
    return modeUnique ? `#/grille/seance/${semaine}/${numero}` : '#/jour';
  }

  function terminerSeance() {
    chronoCourant = null;
    section.replaceChildren();
    const empiecement = el('div', 'empiecement');
    empiecement.append(el('h1', null, modeUnique ? 'Exercice terminé !' : 'Séance terminée !'));
    section.append(empiecement);

    const corps = el('div', 'jersey corps-seance-fin');
    corps.append(el('p', null, 'Bien joué. C’est noté dans ta grille.'));
    const retour = el('button', 'bouton', 'Retour');
    retour.type = 'button';
    retour.addEventListener('click', () => {
      if (typeof location !== 'undefined') location.hash = destinationRetour();
    });
    corps.append(retour);
    section.append(corps);
  }

  // A1 : elle a choisi de s'arrêter avec des exercices passés encore en
  // file. Ce qui est fait reste fait ; la file — donc l'ordre où elle
  // reprendra — reste gardée telle quelle, pour la fois suivante (PRD §7.3 :
  // une séance interrompue reprend où elle en était). La séance n'est PAS
  // « terminée » : la règle §9.1 ne bouge pas, elle ne se coche jamais tant
  // que tous ses exercices ne sont pas validés.
  function terminerSansEux() {
    chronoCourant = null;
    section.replaceChildren();
    const empiecement = el('div', 'empiecement');
    empiecement.append(el('h1', null, 'Séance arrêtée'));
    section.append(empiecement);

    const corps = el('div', 'jersey corps-seance-fin');
    corps.append(el('p', null, 'Ce que tu as fait est gardé. Les exercices passés t’attendent la prochaine fois.'));
    const retour = el('button', 'bouton', 'Retour');
    retour.type = 'button';
    retour.addEventListener('click', () => {
      if (typeof location !== 'undefined') location.hash = destinationRetour();
    });
    corps.append(retour);
    section.append(corps);
  }

  // A1 : « il ne reste que des exercices passés » — affichée une seule fois,
  // au moment où la file bascule dans cet état (elle y reste ensuite tant
  // que la séance dure, puisque rien ne peut plus y faire entrer un exercice
  // jamais passé). Elle propose de continuer — la file reprend son cours
  // normal — ou de s'arrêter là, sans les exercices restants.
  function dessinerAvis() {
    section.replaceChildren();
    const empiecement = el('div', 'empiecement');
    empiecement.append(el('h1', null, 'Encore un peu'));
    section.append(empiecement);

    const corps = el('div', 'jersey corps-seance-fin');
    const n = file.length;
    // Le champ jersey porte un objet focal, jamais une ligne perdue en haut
    // d'un grand vide : c'est la regle que DESIGN.md tire de l'ecran du jour.
    // Mais l'objet focal est un NOM COURT, jamais une phrase — une phrase
    // entiere a la taille d'affichage crie au lieu d'informer. C'est donc le
    // NOMBRE qui porte, et la phrase qui l'explique en dessous, a la taille du
    // texte courant.
    const avis = el('div', 'objectif-seance');
    avis.append(el('p', 'objectif-seance__nom', String(n)));
    avis.append(el('p', 'avis-passes__phrase', n === 1
      ? 'exercice que tu as passé, et qui t’attend'
      : 'exercices que tu as passés, et qui t’attendent'));
    corps.append(avis);

    const continuer = el('button', 'bouton', 'Continuer');
    continuer.type = 'button';
    continuer.addEventListener('click', () => dessinerExercice());
    corps.append(continuer);

    const arreter = el('button', 'bouton--discret', 'Terminer la séance sans eux');
    arreter.type = 'button';
    arreter.addEventListener('click', () => terminerSansEux());
    corps.append(arreter);

    section.append(corps);
  }

  // A1 : « Passer » ne valide rien et ne retire rien — l'exercice courant
  // repart à la fin de la file (domaine.js, `passerEnFile`). Un minuteur en
  // cours est mis en pause avant, comme au démontage : sinon son battement
  // continuerait sur un décompte qu'elle a quitté, jusqu'à sonner pour un
  // exercice qu'elle n'est plus en train de faire.
  function passer() {
    if (chronoCourant !== null) {
      chronoCourant.pause();
      chronoCourant = null;
    }
    passes.add(file[0]);
    file = passerEnFile(file);
    persisterFile();
    dessiner();
  }

  function avancer() {
    chronoCourant = null;
    // L'exercice qui vient d'être validé quitte la file : ce n'est jamais un
    // index qu'on avance, puisque « Passer » a pu réordonner ce qui reste.
    file = file.slice(1);
    persisterFile();
    if (file.length === 0) {
      terminerSeance();
      return;
    }
    dessiner();
  }

  function dessiner() {
    // Garde-fou : une file vide dès l'entrée (refaire une séance déjà
    // entièrement faite, ou — A3 bis — un exercice cible introuvable dans
    // cette séance) n'a rien à montrer ; `avancer()` gère déjà ce cas une
    // fois la séance en cours, mais le premier appel n'y passe jamais.
    if (file.length === 0) {
      terminerSeance();
      return;
    }
    if (!avisMontre && fileNeContientQueDesPasses(file, passes)) {
      avisMontre = true;
      dessinerAvis();
      return;
    }
    dessinerExercice();
  }

  // Composition de haut en bas (chantier C) : la progression, le libellé, le
  // grand objectif (x16 ou le décompte), le geste unique.
  function dessinerExercice() {
    section.replaceChildren();
    const ex = exParId.get(file[0]);
    const compteFait = total - file.length;

    const empiecement = el('div', 'empiecement empiecement-seance');
    empiecement.append(el('span', 'etiquette', `${compteFait + 1} / ${total}`));
    const barre = el('div', 'barre-couture');
    const remplissage = el('div', 'barre-couture__remplissage');
    remplissage.style.transform = `scaleX(${compteFait / total})`;
    barre.append(remplissage);
    empiecement.append(barre);
    section.append(empiecement);

    const corps = el('div', 'jersey corps-seance');
    corps.append(el('h1', 'nom-exercice', ex.libelle));

    const objectifNoeud = el('p', 'objectif-seance');
    const bouton = el('button', 'bouton', '');
    bouton.type = 'button';
    const remise = el('button', 'bouton--discret', 'Remettre à zéro');
    remise.type = 'button';
    remise.hidden = true;
    // A1 : « Passer » est une action SECONDAIRE — `.bouton--discret`, jamais
    // un second bouton principal — disponible quel que soit le mode ou la
    // phase de l'exercice courant. A3 bis : elle n'a aucun sens sur une file
    // d'un seul exercice choisi exprès depuis la grille — rien à passer,
    // vers rien — et ne se monte donc jamais en mode cible unique.
    const passerBouton = el('button', 'bouton--discret', 'Passer');
    passerBouton.type = 'button';
    passerBouton.hidden = modeUnique;
    passerBouton.addEventListener('click', () => passer());

    // A6 : toujours visible, jamais masqué — à la différence de « Passer »
    // ci-dessus, qui n'a pas de sens en mode cible unique.
    const sortirBouton = el('button', 'bouton--discret', 'Sortir de la séance');
    sortirBouton.type = 'button';
    sortirBouton.addEventListener('click', () => {
      if (typeof location !== 'undefined') location.hash = destinationRetour();
    });

    if (ex.mesure === 'tenue') {
      objectifNoeud.classList.add('objectif-seance--minuteur');
      const decompte = el('span', 'decompte');
      objectifNoeud.append(decompte);

      const { valeur } = objectif(ex, semaine);
      let derniereSecondeAnnoncee = null;
      let zeroJoue = false;
      let phase = 'attente'; // 'attente' | 'en-cours' | 'suivant'

      const chrono = creerChrono({
        duree: valeur * 1000,
        horloge: () => maintenant().getTime(),
        tic: (restant, etatChrono) => {
          decompte.textContent = formater(restant);
          if (etatChrono === 'en-cours') {
            const secondesRestantes = Math.ceil(restant / 1000);
            if (secondesRestantes >= 1 && secondesRestantes <= 3 && secondesRestantes !== derniereSecondeAnnoncee) {
              derniereSecondeAnnoncee = secondesRestantes;
              bip(FREQUENCES_BIP[3 - secondesRestantes]);
            }
          }
          if (etatChrono === 'termine' && !zeroJoue) {
            zeroJoue = true;
            sonnerie();
            // A16 (lot ludique) : c'est ICI, au moment precis ou le minuteur
            // se termine SANS remise a zero, que « la plus longue tenue
            // menee a son terme » se constate — nulle part ailleurs, et
            // jamais dans chrono.js (qui reste pur, PRD lot ludique A16).
            enregistrerRecords(valider(ex), valeur);
            phase = 'suivant';
            // Le fuchsia ne dit plus « en cours » une fois l'effort fini
            // (finition, correctif 7) : le décompte revient à --bleu-nuit.
            decompte.classList.remove('decompte--actif');
            bouton.disabled = false;
            bouton.textContent = 'Suivant';
          }
        },
      });
      chronoCourant = chrono;
      decompte.textContent = formater(chrono.restant());
      bouton.textContent = 'Démarrer';

      remise.hidden = false;
      remise.addEventListener('click', () => {
        chrono.remettreAZero();
        derniereSecondeAnnoncee = null;
        zeroJoue = false;
        phase = 'attente';
        decompte.classList.remove('decompte--actif');
        bouton.textContent = 'Démarrer';
        bouton.disabled = false;
        decompte.textContent = formater(chrono.restant());
      });

      bouton.addEventListener('click', () => {
        debloquerAuPremierGeste();
        if (phase === 'attente') {
          phase = 'en-cours';
          // Le fuchsia n'apparaît qu'ici, au moment ou le minuteur démarre
          // vraiment (ossature §5.1 : « ce qui est EN COURS, et rien
          // d'autre » — finition, correctif 7) : c'est CE changement de
          // couleur qui signale le départ, jamais une teinte posée à l'arrêt.
          decompte.classList.add('decompte--actif');
          bouton.disabled = true;
          bouton.textContent = 'Tiens bon…';
          chrono.demarrer();
        } else if (phase === 'suivant') {
          avancer();
        }
      });
    } else {
      objectifNoeud.classList.add('objectif-seance--repetitions');
      objectifNoeud.textContent = objectifTexte(ex, semaine);
      bouton.textContent = 'C’est fait';
      bouton.addEventListener('click', () => {
        debloquerAuPremierGeste();
        enregistrerRecords(valider(ex));
        avancer();
      });
    }

    corps.append(objectifNoeud, remise, passerBouton, sortirBouton, bouton);
    section.append(corps);
  }

  dessiner();

  return function demonter() {
    // Un chrono encore « en-cours » a un battement reel (setInterval) qui ne
    // s'arrete jamais tout seul si on quitte en cours de decompte — par le
    // bouton retour du navigateur, notamment (PRD §5, PRP 04 chantier C).
    if (chronoCourant !== null) chronoCourant.pause();
    garderEcranAllume(false);
  };
}

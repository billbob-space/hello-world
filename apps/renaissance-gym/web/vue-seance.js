// vue-seance.js — la séance : un exercice à l'écran, jamais deux (PRP 04
// chantier C, PRD §5, §7.3, §9.1, §9.2, §11.3, §15.3).
//
// LE RANG DE STRASS EST INTERDIT ICI (ossature §5.3) : c'est l'écran de
// l'effort, pas celui de la récompense. Ce fichier ne monte jamais `.strass`.
//
// LE MODE VIENT DE LA DONNÉE, JAMAIS DU LIBELLÉ : `ex.mesure === 'tenue'`
// monte un minuteur, `'repetitions'` n'en monte pas — ce module ne lit
// jamais `ex.libelle` pour décider quoi que ce soit.

import { exercicesDeSeance, objectif, objectifTexte } from './programme.js';
import { faitsDeSeance, prochaineSeance, semaineCourante } from './domaine.js';
import { ajouterFait } from './etat.js';
import { creerChrono, formater } from './chrono.js';
import { debloquerAudio, bip, FREQUENCES_BIP, sonnerie } from './sonnerie.js';
import { garderEcranAllume } from './app.js';

function el(balise, classe, texte) {
  const noeud = document.createElement(balise);
  if (classe) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

// Sous-route « #/seance/<numero> » : force la séance à rejouer (écran du
// jour, « Refaire une séance », PRD §9.5). Sans suffixe valide, `null` — la
// séance vient alors de `domaine.prochaineSeance`.
export function numeroDepuisHash(hash) {
  const trouve = /^#\/seance\/(\d+)$/.exec(String(hash ?? ''));
  if (trouve === null) return null;
  const n = Number(trouve[1]);
  return n >= 1 && n <= 4 ? n : null;
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
  const semaine = Math.min(semaineCourante(etat.debut, maintenant(), etat.semaineDeDepart), 8);
  const hash = typeof location !== 'undefined' ? location.hash : '';
  const numero = numeroDepuisHash(hash) ?? prochaineSeance(programme, etat.faits, semaine) ?? 1;
  const exercices = exercicesDeSeance(programme, numero);

  let index = indexPremierNonFait(programme, etat.faits, semaine, numero);
  let chronoCourant = null; // pour l'arreter proprement au demontage (PRD §5)
  let audioDebloque = false;

  garderEcranAllume(true);

  const section = el('section', 'ecran-seance zone-surete');
  hote.append(section);

  function debloquerAuPremierGeste() {
    if (audioDebloque) return;
    audioDebloque = true;
    debloquerAudio();
  }

  function valider(ex) {
    ajouterFait({ seance: numero, semaine, exercice: ex.id, a: maintenant().toISOString() });
  }

  function terminerSeance() {
    chronoCourant = null;
    section.replaceChildren();
    const empiecement = el('div', 'empiecement');
    empiecement.append(el('h1', null, 'Séance terminée !'));
    section.append(empiecement, el('hr', 'passepoil'));

    const corps = el('div', 'jersey corps-seance-fin');
    corps.append(el('p', null, 'Bien joué. C’est noté dans ta grille.'));
    const retour = el('button', 'bouton', 'Retour');
    retour.type = 'button';
    retour.addEventListener('click', () => {
      if (typeof location !== 'undefined') location.hash = '#/jour';
    });
    corps.append(retour);
    section.append(corps);
  }

  function avancer() {
    chronoCourant = null;
    index += 1;
    if (index >= exercices.length) {
      terminerSeance();
      return;
    }
    dessiner();
  }

  // Composition de haut en bas (chantier C) : la progression, le libellé, le
  // grand objectif (x16 ou le décompte), le geste unique.
  function dessiner() {
    section.replaceChildren();
    const ex = exercices[index];
    const total = exercices.length;

    const empiecement = el('div', 'empiecement empiecement-seance');
    empiecement.append(el('span', 'etiquette', `${index + 1} / ${total}`));
    const barre = el('div', 'barre-couture');
    const remplissage = el('div', 'barre-couture__remplissage');
    remplissage.style.width = `${Math.round((index / total) * 100)}%`;
    barre.append(remplissage);
    empiecement.append(barre);
    section.append(empiecement, el('hr', 'passepoil'));

    const corps = el('div', 'jersey corps-seance');
    corps.append(el('h1', 'nom-exercice', ex.libelle));

    const objectifNoeud = el('p', 'objectif-seance');
    const bouton = el('button', 'bouton', '');
    bouton.type = 'button';
    const remise = el('button', 'bouton--discret', 'Remettre à zéro');
    remise.type = 'button';
    remise.hidden = true;

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
            valider(ex);
            phase = 'suivant';
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
        bouton.textContent = 'Démarrer';
        bouton.disabled = false;
        decompte.textContent = formater(chrono.restant());
      });

      bouton.addEventListener('click', () => {
        debloquerAuPremierGeste();
        if (phase === 'attente') {
          phase = 'en-cours';
          bouton.disabled = true;
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
        valider(ex);
        avancer();
      });
    }

    corps.append(objectifNoeud, remise, bouton);
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

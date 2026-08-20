import { creerMinuteur } from './minuteur.js';
import { urlIntegree } from './video.js';

// L'ecran de seance (PRD §7.3) : un exercice a la fois, jamais la liste
// complete a l'avance. Chaque exercice affiche sa video (absente si non
// verifiee, ossature §4 — jamais un lecteur casse), sa consigne, et son
// chronometre, qui ne demarre que sur un geste explicite.
export function vueSeance(conteneur, { seance, onSeanceTerminee }) {
	const exercices = seance.blocs.flatMap((b) => b.exercices);
	const idsFaits = [];
	let index = 0;

	function progression() {
		const barre = document.createElement('div');
		barre.className = 'progression';
		for (let i = 0; i < exercices.length; i++) {
			const segment = document.createElement('span');
			if (i < index) segment.className = 'faite';
			else if (i === index) segment.className = 'courante';
			barre.appendChild(segment);
		}
		return barre;
	}

	function afficherExercice() {
		conteneur.textContent = '';
		const exercice = exercices[index];

		const carte = document.createElement('div');
		carte.className = 'carte';
		conteneur.appendChild(carte);

		carte.appendChild(progression());

		const video = urlIntegree(exercice.video && exercice.video.url);
		if (video) {
			const iframe = document.createElement('iframe');
			iframe.src = video;
			iframe.setAttribute('allow', 'autoplay');
			// Nom accessible obligatoire pour un frame (WCAG 4.1.2, detecte par
			// le bout en bout, e2e/tests/pilabelle.spec.js) : sans lui, un
			// lecteur d'ecran annonce une iframe muette.
			iframe.title = `Vidéo de démonstration : ${exercice.nom}`;
			iframe.className = 'video';
			carte.appendChild(iframe);
		}

		const titre = document.createElement('h2');
		titre.textContent = exercice.nom;
		carte.appendChild(titre);

		const consigne = document.createElement('p');
		consigne.className = 'consigne';
		consigne.textContent = exercice.consigne;
		carte.appendChild(consigne);

		const minutage = exercice.minutage || { effort_s: 20, repos_s: 15, tours: 1 };
		const minuteur = creerMinuteur(minutage);

		const labelPhase = document.createElement('p');
		labelPhase.className = 'phase';
		carte.appendChild(labelPhase);

		const etatAffiche = document.createElement('p');
		etatAffiche.className = 'minuteur';
		carte.appendChild(etatAffiche);

		const boutonPrincipal = document.createElement('button');
		boutonPrincipal.type = 'button';
		boutonPrincipal.textContent = 'Prête';
		carte.appendChild(boutonPrincipal);

		minuteur.abonner(({ etat, phase, restant }) => {
			if (etat === 'attente') {
				labelPhase.textContent = '';
				etatAffiche.textContent = '';
				etatAffiche.classList.remove('repos');
			} else if (etat === 'en_cours') {
				labelPhase.textContent = phase === 'effort' ? '💪 Effort' : '😮‍💨 Repos';
				labelPhase.classList.toggle('repos', phase === 'repos');
				etatAffiche.textContent = `${restant}`;
				etatAffiche.classList.toggle('repos', phase === 'repos');
				boutonPrincipal.textContent = 'Pause';
			} else if (etat === 'pause') {
				boutonPrincipal.textContent = 'Reprendre';
			} else if (etat === 'termine') {
				// Pendant le repit de 2s, l'ecran continuait d'afficher « 😮‍💨 Repos »,
				// un decompte fige sur « 1 » (l'intervalle s'arrete avant de
				// notifier zero) et un bouton « Pause » inerte : un tap ne
				// declenchait rien, aucun etat du minuteur ne correspondant.
				// L'ecran dit maintenant ce qui se passe, et le bouton le dit aussi.
				labelPhase.textContent = '';
				labelPhase.classList.remove('repos');
				etatAffiche.textContent = '';
				etatAffiche.classList.remove('repos');
				boutonPrincipal.disabled = true;
				boutonPrincipal.textContent = index + 1 >= exercices.length
					? 'Séance terminée ✓'
					: 'Exercice suivant…';
				idsFaits.push(exercice.id);
				index += 1;
				setTimeout(() => {
					if (index >= exercices.length) {
						onSeanceTerminee(idsFaits);
					} else {
						afficherExercice();
					}
				}, 2000); // court repit avant l'exercice suivant (PRD §7.3)
			}
		});

		boutonPrincipal.addEventListener('click', () => {
			const e = minuteur.etat();
			if (e === 'attente') minuteur.demarrer();
			else if (e === 'en_cours') minuteur.pause();
			else if (e === 'pause') minuteur.reprendre();
		});
	}

	afficherExercice();
}

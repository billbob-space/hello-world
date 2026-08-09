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

		const etatAffiche = document.createElement('p');
		etatAffiche.className = 'minuteur';
		carte.appendChild(etatAffiche);

		const boutonPrincipal = document.createElement('button');
		boutonPrincipal.type = 'button';
		boutonPrincipal.textContent = 'Prête';
		carte.appendChild(boutonPrincipal);

		minuteur.abonner(({ etat, phase, restant }) => {
			if (etat === 'attente') {
				etatAffiche.textContent = '';
				etatAffiche.classList.remove('repos');
			} else if (etat === 'en_cours') {
				etatAffiche.textContent = `${restant}`;
				etatAffiche.classList.toggle('repos', phase === 'repos');
				boutonPrincipal.textContent = phase === 'effort' ? 'Pause' : 'Pause (repos)';
			} else if (etat === 'pause') {
				boutonPrincipal.textContent = 'Reprendre';
			} else if (etat === 'termine') {
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

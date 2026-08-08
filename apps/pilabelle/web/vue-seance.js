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

	function afficherExercice() {
		conteneur.textContent = '';
		const exercice = exercices[index];

		const video = urlIntegree(exercice.video && exercice.video.url);
		if (video) {
			const iframe = document.createElement('iframe');
			iframe.src = video;
			iframe.setAttribute('allow', 'autoplay');
			iframe.className = 'video';
			conteneur.appendChild(iframe);
		}

		const consigne = document.createElement('p');
		consigne.textContent = exercice.consigne;
		conteneur.appendChild(consigne);

		const minutage = exercice.minutage || { effort_s: 20, repos_s: 15, tours: 1 };
		const minuteur = creerMinuteur(minutage);

		const etatAffiche = document.createElement('p');
		etatAffiche.className = 'minuteur';
		conteneur.appendChild(etatAffiche);

		const boutonPrincipal = document.createElement('button');
		boutonPrincipal.type = 'button';
		boutonPrincipal.textContent = 'Prête';
		conteneur.appendChild(boutonPrincipal);

		minuteur.abonner(({ etat, phase, restant }) => {
			if (etat === 'attente') {
				etatAffiche.textContent = '';
			} else if (etat === 'en_cours') {
				etatAffiche.textContent = `${phase === 'effort' ? 'Effort' : 'Repos'} — ${restant}s`;
				boutonPrincipal.textContent = 'Pause';
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

// La machine a etats du chronometre (PRD §7.3). Pur : ni DOM ni horloge
// implicite injectee — setInterval est le seul appel navigateur, isole ici
// pour que le reste de l'ecran de seance n'ait jamais a le connaitre.

export function creerMinuteur({ effort_s, repos_s, tours }) {
	let etat = 'attente'; // attente | en_cours | pause | termine
	let phase = null; // effort | repos, absent tant que etat === 'attente'
	let tour = 0;
	let restant = 0;
	let idIntervalle = null;
	const abonnes = new Set();

	function notifier() {
		for (const f of abonnes) f({ etat, phase, restant });
	}

	function demarrerPhase(p, duree) {
		phase = p;
		restant = duree;
		notifier();
		idIntervalle = setInterval(() => {
			restant -= 1;
			if (restant <= 0) {
				clearInterval(idIntervalle);
				avancer();
				return;
			}
			notifier();
		}, 1000);
	}

	function avancer() {
		if (phase === 'effort') {
			demarrerPhase('repos', repos_s);
			return;
		}
		tour += 1;
		if (tour >= tours) {
			etat = 'termine';
			phase = null;
			notifier();
			return;
		}
		demarrerPhase('effort', effort_s);
	}

	return {
		abonner(f) {
			abonnes.add(f);
			return () => abonnes.delete(f);
		},
		// Ne demarre jamais seul (PRD §7.3) : seul un appel explicite lance le decompte.
		demarrer() {
			if (etat !== 'attente') return;
			etat = 'en_cours';
			demarrerPhase('effort', effort_s);
		},
		// Pause et reprise sans confirmation : une pause pour souffler ne coute rien.
		pause() {
			if (etat !== 'en_cours') return;
			clearInterval(idIntervalle);
			etat = 'pause';
			notifier();
		},
		reprendre() {
			if (etat !== 'pause') return;
			etat = 'en_cours';
			demarrerPhase(phase, restant);
		},
		etat: () => etat,
		estTermine: () => etat === 'termine',
	};
}

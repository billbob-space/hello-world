// Le ressenti de fin de seance (PRD §7.4) : un tap parmi trois emojis,
// jamais un chiffre, jamais optionnel.

const CHOIX = [
	['facile', '😊', 'Facile'],
	['correct', '🙂', 'Correct'],
	['difficile', '😮‍💨', 'Difficile'],
];

export function vueRessenti(conteneur, { onChoix }) {
	conteneur.textContent = '';

	const titre = document.createElement('p');
	titre.textContent = 'Comment tu as trouvé la séance ?';
	conteneur.appendChild(titre);

	const rangee = document.createElement('div');
	rangee.className = 'ressenti';
	for (const [valeur, emoji, libelle] of CHOIX) {
		const b = document.createElement('button');
		b.type = 'button';
		b.textContent = `${emoji} ${libelle}`;
		b.addEventListener('click', () => onChoix(valeur));
		rangee.appendChild(b);
	}
	conteneur.appendChild(rangee);
}

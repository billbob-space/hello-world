// Le ressenti de fin de seance (PRD §7.4) : un tap parmi trois emojis,
// jamais un chiffre, jamais optionnel.

const CHOIX = [
	['facile', '😊', 'Facile'],
	['correct', '🙂', 'Correct'],
	['difficile', '😮‍💨', 'Difficile'],
];

export function vueRessenti(conteneur, { onChoix }) {
	conteneur.textContent = '';

	const carte = document.createElement('div');
	carte.className = 'carte';
	conteneur.appendChild(carte);

	carte.appendChild(Object.assign(document.createElement('h1'), { textContent: 'Séance terminée' }));
	carte.appendChild(Object.assign(document.createElement('p'), { className: 'sous-titre', textContent: 'Comment tu as trouvé la séance ?' }));

	const rangee = document.createElement('div');
	rangee.className = 'ressenti';
	for (const [valeur, emoji, libelle] of CHOIX) {
		const b = document.createElement('button');
		b.type = 'button';
		if (valeur !== 'facile') b.className = 'secondaire';
		b.textContent = `${emoji}  ${libelle}`;
		b.addEventListener('click', () => onChoix(valeur));
		rangee.appendChild(b);
	}
	carte.appendChild(rangee);
}

// L'ecran de fin de seance (PRD §7.4, §9, §10) : la serie, l'encouragement,
// un mot doux s'il y en a un, et — seule fois ou une animation est
// declenchee — le passage de niveau. Une serie remise a zero n'affiche
// aucune penalite : le fait, jamais un jugement.

export function vueFin(conteneur, { recap }) {
	conteneur.textContent = '';

	const carte = document.createElement('div');
	carte.className = 'carte';
	conteneur.appendChild(carte);

	if (recap.deja_compte) {
		carte.appendChild(Object.assign(document.createElement('h1'), { textContent: 'Bravo pour cette reprise !' }));
		carte.appendChild(Object.assign(document.createElement('p'), {
			className: 'sous-titre',
			textContent: 'Séance déjà comptée pour aujourd\'hui — merci d\'être revenue.',
		}));
		return;
	}

	const encouragement = document.createElement('p');
	encouragement.className = 'encouragement';
	encouragement.textContent = recap.encouragement;
	carte.appendChild(encouragement);

	const serie = document.createElement('p');
	serie.className = 'serie';
	serie.append('Série : ');
	const fort = document.createElement('strong');
	fort.textContent = `${recap.serie.actuelle} jour${recap.serie.actuelle > 1 ? 's' : ''}`;
	serie.append(fort, ` — record ${recap.serie.record}`);
	carte.appendChild(serie);

	if (recap.niveau_monte && (recap.niveau_monte.ventre || recap.niveau_monte.cuisses)) {
		const zones = [];
		if (recap.niveau_monte.ventre) zones.push('ventre');
		if (recap.niveau_monte.cuisses) zones.push('cuisses');
		const p = document.createElement('p');
		p.className = 'niveau-monte';
		p.textContent = `🎉 Niveau supérieur débloqué : ${zones.join(' et ')} !`;
		carte.appendChild(p);
	}

	if (recap.mot_doux) {
		const p = document.createElement('p');
		p.className = 'mot-doux';
		p.textContent = recap.mot_doux;
		carte.appendChild(p);
	}
}

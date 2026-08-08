// L'ecran de fin de seance (PRD §7.4, §9, §10) : la serie, l'encouragement,
// un mot doux s'il y en a un, et — seule fois ou une animation est
// declenchee — le passage de niveau. Une serie remise a zero n'affiche
// aucune penalite : le fait, jamais un jugement.

export function vueFin(conteneur, { recap }) {
	conteneur.textContent = '';

	if (recap.deja_compte) {
		const p = document.createElement('p');
		p.textContent = 'Séance déjà comptée pour aujourd\'hui — merci pour cette reprise libre !';
		conteneur.appendChild(p);
		return;
	}

	const encouragement = document.createElement('p');
	encouragement.className = 'encouragement';
	encouragement.textContent = recap.encouragement;
	conteneur.appendChild(encouragement);

	const serie = document.createElement('p');
	serie.className = 'serie';
	serie.textContent = `Série : ${recap.serie.actuelle} jour(s) — record ${recap.serie.record}`;
	conteneur.appendChild(serie);

	if (recap.niveau_monte && (recap.niveau_monte.ventre || recap.niveau_monte.cuisses)) {
		const zones = [];
		if (recap.niveau_monte.ventre) zones.push('ventre');
		if (recap.niveau_monte.cuisses) zones.push('cuisses');
		const p = document.createElement('p');
		p.className = 'niveau-monte';
		p.textContent = `Niveau supérieur débloqué : ${zones.join(' et ')} ! 🎉`;
		conteneur.appendChild(p);
	}

	if (recap.mot_doux) {
		const p = document.createElement('p');
		p.className = 'mot-doux';
		p.textContent = recap.mot_doux;
		conteneur.appendChild(p);
	}
}

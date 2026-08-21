// L'ecran de fin de seance (PRD §7.4, §9, §10) : la serie, l'encouragement,
// un mot doux s'il y en a un, et — seule fois ou une animation est
// declenchee — le passage de niveau. Une serie remise a zero n'affiche
// aucune penalite : le fait, jamais un jugement.

// Le texte de recompense du defi de la semaine (PRD §9, §10 ; PRP 06) :
// fonction pure, testee independamment du DOM. `defi_releve` n'arrive dans
// `Recap` que sur la transition non-releve -> releve — jamais d'etat
// "manque" a afficher, donc jamais de cas negatif ici.
export function texteRecompenseDefi(recap) {
	return recap && recap.defi_releve ? '🏆 Défi de la semaine relevé !' : null;
}

export function vueFin(conteneur, { recap, onRetour }) {
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
	} else {
		// Titre de l'ecran : c'etait un <p>, donc l'ecran de fin n'avait aucun
		// element de titre — rien a atteindre pour un lecteur d'ecran, sur le
		// seul ecran que chaque seance termine. .encouragement garde le rendu
		// (une classe l'emporte sur le selecteur d'element h1).
		const encouragement = document.createElement('h1');
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

		// Recompense du defi de la semaine : s'ajoute a l'encouragement, ne le
		// remplace jamais ; absente si le defi n'est pas releve (PRP 06).
		const recompenseDefi = texteRecompenseDefi(recap);
		if (recompenseDefi) {
			const p = document.createElement('p');
			p.className = 'defi-recompense';
			p.textContent = recompenseDefi;
			carte.appendChild(p);
		}
	}

	// Le mot doux se montre aussi sur une reprise libre (PRD §10.1) : le
	// serveur en tire un dans les deux cas, le taire ici l'aurait gaspille.
	if (recap.mot_doux) {
		const p = document.createElement('p');
		p.className = 'mot-doux';
		p.textContent = recap.mot_doux;
		carte.appendChild(p);
	}

	// Sortie de l'ecran de fin. Sans elle, la derniere image d'une seance
	// reussie etait un ecran sans un seul bouton : le seul moyen d'en sortir
	// etait de recharger la page ou de fermer l'application — dans une app
	// dont toute la these est qu'elle revienne demain.
	if (onRetour) {
		const retour = document.createElement('button');
		retour.type = 'button';
		retour.className = 'secondaire';
		retour.textContent = 'Retour à l\'accueil';
		retour.addEventListener('click', onRetour);
		carte.appendChild(retour);
	}
}

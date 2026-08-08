// L'ecran du jour (PRD §6 item 2, §7.2) : trois rendus selon `cas`, jamais
// un menu ni un choix a faire.

const NOM_ZONE = {
	mise_en_route: 'Mise en route',
	ventre: 'Ventre',
	cuisses: 'Cuisses et fessiers',
	retour_au_calme: 'Retour au calme',
};

function bouton(texte, onClic) {
	const b = document.createElement('button');
	b.type = 'button';
	b.textContent = texte;
	b.addEventListener('click', onClic);
	return b;
}

function paragraphe(texte, classe) {
	const p = document.createElement('p');
	p.textContent = texte;
	if (classe) p.className = classe;
	return p;
}

export function vueJour(conteneur, { jour, onCommencer }) {
	conteneur.textContent = '';

	// La pique se montre une seule fois au premier rendu de cet ecran, jamais
	// relue au re-rendu (PRD §7.2 : « s'affiche une fois puis laisse place a
	// la seance »).
	if (jour.pique) {
		conteneur.appendChild(paragraphe(jour.pique, 'pique'));
	}

	if (jour.cas === 'repos') {
		conteneur.appendChild(paragraphe('Aujourd\'hui, jour de repos. À demain !'));
		return;
	}

	if (jour.cas === 'deja-faite') {
		conteneur.appendChild(paragraphe('Séance déjà faite aujourd\'hui.'));
		conteneur.appendChild(bouton('Refaire la séance', () => onCommencer(jour.seance)));
		return;
	}

	// cas === 'a-faire'
	const nbBlocs = jour.seance.blocs.length;
	conteneur.appendChild(paragraphe(`Séance du jour — ${nbBlocs} étapes`));
	const liste = document.createElement('ul');
	for (const bloc of jour.seance.blocs) {
		const li = document.createElement('li');
		li.textContent = NOM_ZONE[bloc.zone] || bloc.zone;
		liste.appendChild(li);
	}
	conteneur.appendChild(liste);
	conteneur.appendChild(bouton('Commencer', () => onCommencer(jour.seance)));
}

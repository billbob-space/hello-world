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

function lienReglages(onReglages) {
	const lien = document.createElement('button');
	lien.type = 'button';
	lien.className = 'lien-discret';
	lien.textContent = 'Réglages';
	lien.addEventListener('click', onReglages);
	return lien;
}

export function vueJour(conteneur, { jour, onCommencer, onReglages }) {
	conteneur.textContent = '';
	conteneur.appendChild(lienReglages(onReglages));

	// La pique se montre une seule fois au premier rendu de cet ecran, jamais
	// relue au re-rendu (PRD §7.2 : « s'affiche une fois puis laisse place a
	// la seance »).
	if (jour.pique) {
		conteneur.appendChild(paragraphe(jour.pique, 'pique'));
	}

	const carte = document.createElement('div');
	carte.className = 'carte';
	conteneur.appendChild(carte);

	if (jour.cas === 'repos') {
		carte.appendChild(Object.assign(document.createElement('h1'), { textContent: 'Jour de repos' }));
		carte.appendChild(paragraphe('Rien à faire aujourd\'hui. À demain !', 'sous-titre'));
		return;
	}

	if (jour.cas === 'deja-faite') {
		carte.appendChild(Object.assign(document.createElement('h1'), { textContent: 'Séance déjà faite ✓' }));
		carte.appendChild(paragraphe('Tu peux la refaire librement, ça ne compte pas deux fois.', 'sous-titre'));
		carte.appendChild(bouton('Refaire la séance', () => onCommencer(jour.seance)));
		return;
	}

	// cas === 'a-faire'
	const nbBlocs = jour.seance.blocs.length;
	carte.appendChild(Object.assign(document.createElement('h1'), { textContent: 'Séance du jour' }));
	carte.appendChild(paragraphe(`${nbBlocs} étapes, guidées pas à pas`, 'sous-titre'));
	const liste = document.createElement('ul');
	for (const bloc of jour.seance.blocs) {
		const li = document.createElement('li');
		li.textContent = NOM_ZONE[bloc.zone] || bloc.zone;
		liste.appendChild(li);
	}
	carte.appendChild(liste);
	carte.appendChild(bouton('Commencer', () => onCommencer(jour.seance)));
}

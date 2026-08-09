// L'ecran personnel (PRD §6 item 11, PRP 07) : lecture seule, rien de
// nouveau a calculer — serie, niveaux et calendrier viennent deja tels
// quels de GET /api/personnel, recuperes par l'appelant (app.js) avant le
// montage, meme patron que vue-jour.js/vue-fin.js : cette vue ne fait aucun
// appel reseau elle-meme.

const INFOS_STATUT = {
	fait: { icone: '✓', classe: 'jour-fait' },
	manque: { icone: '·', classe: 'jour-manque' },
	repos: { icone: '', classe: 'jour-repos' },
	avenir: { icone: '', classe: 'jour-avenir' },
};

// decoupeEnSemaines groupe un calendrier plat, chronologique et sans trou
// (garanti par Calendrier cote serveur) en lignes de 7 jours pour l'affichage
// compact (PRD §11). La derniere ligne peut etre incomplete si la fenetre ne
// se termine pas un dimanche ; jamais de ligne vide.
export function decoupeEnSemaines(calendrier) {
	const semaines = [];
	let semaine = [];
	for (const jour of calendrier) {
		semaine.push(jour);
		if (semaine.length === 7) {
			semaines.push(semaine);
			semaine = [];
		}
	}
	if (semaine.length > 0) semaines.push(semaine);
	return semaines;
}

function retourBouton(onRetour) {
	const retour = document.createElement('button');
	retour.type = 'button';
	retour.className = 'lien-discret';
	retour.textContent = '← Retour';
	retour.addEventListener('click', onRetour);
	return retour;
}

function carteSerieEtRecord(serie) {
	const carte = document.createElement('div');
	carte.className = 'carte';
	carte.appendChild(Object.assign(document.createElement('h1'), {
		textContent: `${serie.actuelle} jour${serie.actuelle > 1 ? 's' : ''} de suite`,
	}));
	carte.appendChild(Object.assign(document.createElement('p'), {
		className: 'sous-titre',
		textContent: `Record : ${serie.record} jour${serie.record > 1 ? 's' : ''}`,
	}));
	return carte;
}

function carteNiveaux(niveaux) {
	const carte = document.createElement('div');
	carte.className = 'carte';
	carte.appendChild(Object.assign(document.createElement('h2'), { textContent: 'Tes niveaux' }));
	const liste = document.createElement('ul');
	liste.className = 'niveaux';
	liste.appendChild(Object.assign(document.createElement('li'), { textContent: `Ventre — niveau ${niveaux.ventre}` }));
	liste.appendChild(Object.assign(document.createElement('li'), { textContent: `Cuisses et fessiers — niveau ${niveaux.cuisses}` }));
	carte.appendChild(liste);
	return carte;
}

function carteCalendrier(calendrier) {
	const carte = document.createElement('div');
	carte.className = 'carte';
	carte.appendChild(Object.assign(document.createElement('h2'), { textContent: 'Ton calendrier' }));
	const grille = document.createElement('div');
	grille.className = 'calendrier';
	for (const semaine of decoupeEnSemaines(calendrier)) {
		const ligne = document.createElement('div');
		ligne.className = 'calendrier-semaine';
		for (const jour of semaine) {
			const infos = INFOS_STATUT[jour.statut] || { icone: '', classe: '' };
			const cellule = document.createElement('span');
			cellule.className = `calendrier-jour ${infos.classe}`;
			cellule.textContent = infos.icone;
			cellule.title = jour.date;
			ligne.appendChild(cellule);
		}
		grille.appendChild(ligne);
	}
	carte.appendChild(grille);
	return carte;
}

export function vuePersonnel(conteneur, { donnees, onRetour }) {
	conteneur.textContent = '';
	conteneur.appendChild(retourBouton(onRetour));
	conteneur.appendChild(carteSerieEtRecord(donnees.serie));
	conteneur.appendChild(carteNiveaux(donnees.niveaux));
	conteneur.appendChild(carteCalendrier(donnees.calendrier));
}

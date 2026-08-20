// L'ecran personnel (PRD §6 item 11, PRP 07) : lecture seule, rien de
// nouveau a calculer — serie, niveaux et calendrier viennent deja tels
// quels de GET /api/personnel, recuperes par l'appelant (app.js) avant le
// montage, meme patron que vue-jour.js/vue-fin.js : cette vue ne fait aucun
// appel reseau elle-meme.

// Le calendrier ne disait nulle part ce que ses couleurs veulent dire : une
// grille de carres verts, roses, vides et pointilles, sans legende, dont le
// seul texte alternatif etait la date brute dans un `title` (invisible au
// doigt). `libelle` sert aux deux manques a la fois : le nom accessible de
// chaque case et la legende sous la grille.
const INFOS_STATUT = {
	fait: { icone: '✓', classe: 'jour-fait', libelle: 'Séance faite' },
	manque: { icone: '·', classe: 'jour-manque', libelle: 'Séance non faite' },
	repos: { icone: '', classe: 'jour-repos', libelle: 'Jour de repos' },
	avenir: { icone: '', classe: 'jour-avenir', libelle: 'À venir' },
};

const ORDRE_LEGENDE = ['fait', 'manque', 'repos', 'avenir'];

// legende n'affiche que les statuts reellement presents dans la fenetre
// affichee : une legende qui explique une couleur absente de l'ecran fait
// chercher ce qui n'y est pas.
function legende(calendrier) {
	const presents = new Set(calendrier.map((j) => j.statut));
	const bloc = document.createElement('p');
	bloc.className = 'calendrier-legende';
	for (const statut of ORDRE_LEGENDE) {
		if (!presents.has(statut)) continue;
		const infos = INFOS_STATUT[statut];
		const entree = document.createElement('span');
		const pastille = document.createElement('i');
		pastille.className = `calendrier-jour ${infos.classe}`;
		pastille.setAttribute('aria-hidden', 'true');
		entree.appendChild(pastille);
		entree.append(infos.libelle);
		bloc.appendChild(entree);
	}
	return bloc;
}

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
			const infos = INFOS_STATUT[jour.statut] || { icone: '', classe: '', libelle: '' };
			const cellule = document.createElement('span');
			cellule.className = `calendrier-jour ${infos.classe}`;
			cellule.textContent = infos.icone;
			// Deux cases sur quatre n'avaient aucun contenu : sans nom
			// accessible, la moitie du calendrier etait muette, et l'autre
			// moitie annoncait « coche » ou « point ».
			cellule.setAttribute('role', 'img');
			cellule.setAttribute('aria-label', `${jour.date} — ${infos.libelle}`);
			cellule.title = `${jour.date} — ${infos.libelle}`;
			ligne.appendChild(cellule);
		}
		grille.appendChild(ligne);
	}
	carte.appendChild(grille);
	carte.appendChild(legende(calendrier));
	return carte;
}

export function vuePersonnel(conteneur, { donnees, onRetour }) {
	conteneur.textContent = '';
	conteneur.appendChild(retourBouton(onRetour));
	conteneur.appendChild(carteSerieEtRecord(donnees.serie));
	conteneur.appendChild(carteNiveaux(donnees.niveaux));
	conteneur.appendChild(carteCalendrier(donnees.calendrier));
}

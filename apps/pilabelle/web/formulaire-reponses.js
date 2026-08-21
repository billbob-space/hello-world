// Le formulaire des reponses (PRD §7.1) : trois questions a choix simples,
// aucun champ libre. Partage entre le questionnaire initial (vue-
// questionnaire.js) et les reglages (vue-reglages.js), qui ne different que
// par les valeurs de depart et le texte du bouton.

const DOULEURS = [
	['genou', 'Genou'],
	['dos', 'Dos'],
	['epaule', 'Épaule'],
	['cheville', 'Cheville'],
	['equilibre', 'Équilibre'],
	['poignet', 'Poignet'],
	['hanche', 'Hanche'],
	['cou', 'Cou'],
];

const JOURS = [
	['lundi', 'Lundi'],
	['mardi', 'Mardi'],
	['mercredi', 'Mercredi'],
	['jeudi', 'Jeudi'],
	['vendredi', 'Vendredi'],
	['samedi', 'Samedi'],
	['dimanche', 'Dimanche'],
];

// messageManque dit CE QUI manque, pas la regle entiere : un formulaire qui
// repond « choisis un niveau et au moins un jour » a quelqu'un qui a deja
// choisi son niveau lui demande de relire les trois sections pour trouver
// laquelle est en faute. Retourne null quand rien ne manque.
export function messageManque(reponses) {
	const sansNiveau = !reponses.niveau_depart;
	const sansJour = reponses.jours_actifs.length === 0;
	if (sansNiveau && sansJour) return 'Choisis ton niveau de départ et au moins un jour de la semaine.';
	if (sansNiveau) return 'Choisis ton niveau de départ.';
	if (sansJour) return 'Choisis au moins un jour de la semaine.';
	return null;
}

function creerCase(type, name, valeur, libelle, coche) {
	const label = document.createElement('label');
	const input = document.createElement('input');
	input.type = type;
	input.name = name;
	input.value = valeur;
	input.checked = coche;
	label.appendChild(input);
	label.append(' ' + libelle);
	return label;
}

export function construireFormulaireReponses(conteneur, { reponsesInitiales, onValider, libelleBouton, titre }) {
	const r = reponsesInitiales || { niveau_depart: '', douleurs: [], jours_actifs: [] };
	conteneur.textContent = '';

	const carte = document.createElement('div');
	carte.className = 'carte';
	conteneur.appendChild(carte);

	if (titre) carte.appendChild(Object.assign(document.createElement('h1'), { textContent: titre }));

	const form = document.createElement('form');
	carte.appendChild(form);

	const fsNiveau = document.createElement('fieldset');
	fsNiveau.appendChild(Object.assign(document.createElement('legend'), { textContent: 'Ton niveau de départ' }));
	fsNiveau.appendChild(creerCase('radio', 'niveau', 'debutante', 'Débutante', r.niveau_depart === 'debutante'));
	fsNiveau.appendChild(creerCase('radio', 'niveau', 'a_deja_pratique', "J'ai déjà pratiqué le pilates", r.niveau_depart === 'a_deja_pratique'));
	form.appendChild(fsNiveau);

	const fsDouleurs = document.createElement('fieldset');
	fsDouleurs.appendChild(Object.assign(document.createElement('legend'), { textContent: 'Douleurs ou limitations' }));
	for (const [v, l] of DOULEURS) fsDouleurs.appendChild(creerCase('checkbox', 'douleur', v, l, r.douleurs.includes(v)));
	form.appendChild(fsDouleurs);

	const fsJours = document.createElement('fieldset');
	fsJours.appendChild(Object.assign(document.createElement('legend'), { textContent: 'Jours disponibles dans la semaine' }));
	for (const [v, l] of JOURS) fsJours.appendChild(creerCase('checkbox', 'jour', v, l, r.jours_actifs.includes(v)));
	form.appendChild(fsJours);

	const bouton = document.createElement('button');
	bouton.type = 'submit';
	bouton.textContent = libelleBouton;
	form.appendChild(bouton);

	const erreur = document.createElement('p');
	erreur.className = 'erreur';
	// role="alert" : sans lui, le message apparait a l'ecran sans etre annonce
	// — un lecteur d'ecran laisse l'utilisatrice devant un formulaire qui
	// refuse sans dire pourquoi. L'element reste dans le DOM en permanence
	// (hidden), condition pour qu'une region live signale son remplissage.
	erreur.setAttribute('role', 'alert');
	erreur.hidden = true;
	form.appendChild(erreur);

	form.addEventListener('submit', async (evenement) => {
		evenement.preventDefault();
		const donnees = new FormData(form);
		const reponses = {
			niveau_depart: donnees.get('niveau') || '',
			douleurs: donnees.getAll('douleur'),
			jours_actifs: donnees.getAll('jour'),
		};
		const manque = messageManque(reponses);
		if (manque) {
			erreur.textContent = manque;
			erreur.hidden = false;
			return;
		}
		try {
			await onValider(reponses);
		} catch (e) {
			erreur.textContent = 'Une erreur est survenue, réessaie.';
			erreur.hidden = false;
		}
	});
}

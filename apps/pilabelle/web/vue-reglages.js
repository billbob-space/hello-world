import { construireFormulaireReponses } from './formulaire-reponses.js';
import { mettreAJourProfil, supprimerProfil } from './api.js';

export function vueReglages(conteneur, { profil, onEnregistre, onReinitialise, onRetour }) {
	construireFormulaireReponses(conteneur, {
		reponsesInitiales: profil.reponses,
		titre: 'Réglages',
		libelleBouton: 'Enregistrer',
		onValider: async (reponses) => {
			const profilMisAJour = await mettreAJourProfil(reponses);
			onEnregistre(profilMisAJour);
		},
	});

	const retour = document.createElement('button');
	retour.type = 'button';
	retour.className = 'lien-discret';
	retour.textContent = '← Retour';
	retour.addEventListener('click', onRetour);
	conteneur.insertBefore(retour, conteneur.firstChild);

	// Ajoute apres les PRP (PRODUCT.md, "Ajoute apres les PRP") : demande
	// explicite en usage reel, absente du PRD initial. Confirmation native
	// avant un geste irreversible — efface serie, historique et niveaux.
	const carteDanger = document.createElement('div');
	carteDanger.className = 'carte zone-danger';

	carteDanger.appendChild(Object.assign(document.createElement('h3'), { textContent: 'Zone sensible' }));

	const avertissement = document.createElement('p');
	avertissement.textContent = 'Repartir de zéro efface ta série, ton historique et tes niveaux. Cette action est irréversible.';
	carteDanger.appendChild(avertissement);

	const boutonReset = document.createElement('button');
	boutonReset.type = 'button';
	boutonReset.className = 'danger';
	boutonReset.textContent = 'Réinitialiser mon profil';
	boutonReset.addEventListener('click', async () => {
		if (!window.confirm('Vraiment repartir de zéro ? Série, historique et niveaux seront effacés.')) return;
		await supprimerProfil();
		onReinitialise();
	});
	carteDanger.appendChild(boutonReset);

	conteneur.appendChild(carteDanger);
}

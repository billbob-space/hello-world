import { construireFormulaireReponses } from './formulaire-reponses.js';
import { mettreAJourProfil } from './api.js';

export function vueReglages(conteneur, { profil, onEnregistre }) {
	construireFormulaireReponses(conteneur, {
		reponsesInitiales: profil.reponses,
		libelleBouton: 'Enregistrer',
		onValider: async (reponses) => {
			const profilMisAJour = await mettreAJourProfil(reponses);
			onEnregistre(profilMisAJour);
		},
	});
}

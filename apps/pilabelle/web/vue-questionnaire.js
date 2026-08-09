import { construireFormulaireReponses } from './formulaire-reponses.js';
import { creerProfil, lireProfil } from './api.js';

export function vueQuestionnaire(conteneur, { onCree }) {
	construireFormulaireReponses(conteneur, {
		titre: 'Bienvenue 👋',
		libelleBouton: 'Commencer',
		onValider: async (reponses) => {
			try {
				const profil = await creerProfil(reponses);
				onCree(profil);
			} catch (e) {
				// Double onglet : le profil a ete cree entre-temps par l'autre (409).
				const profil = await lireProfil();
				if (profil) { onCree(profil); return; }
				throw e;
			}
		},
	});
}

// Le rattrapage des actions reseau. Sorti de app.js pour exister comme une
// unite a part entiere : c'est le seul chemin de l'application que l'usage
// normal ne traverse jamais, donc le seul qui puisse se defaire sans que
// personne ne le voie.
//
// avecPanne enveloppe une action asynchrone. Tant qu'elle reussit, rien ne
// change. Quand elle echoue, `surEchec` recoit de quoi la REJOUER A
// L'IDENTIQUE — memes arguments — et se re-arme si la seconde tentative
// echoue aussi : une panne reseau dure rarement une seule requete.
export function avecPanne(action, surEchec, textes) {
	const enveloppee = async (...args) => {
		try {
			await action(...args);
		} catch {
			surEchec(() => enveloppee(...args), textes);
		}
	};
	return enveloppee;
}

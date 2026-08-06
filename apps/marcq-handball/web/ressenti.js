// ressenti.js — le vocabulaire du ressenti, son filtrage, et sa ligne d'emojis.
//
// CE MODULE N'IMPORTE RIEN. C'est la decision de decoupage la plus rentable du
// lot 2, et elle a trois consequences : il se teste sans double de localStorage ;
// il ne peut structurellement pas lire une autre cle que celle qu'on lui tend —
// `monterRessenti` recoit `lire` et `ecrire` de son appelant ; et la page du
// coach peut lui emprunter RESSENTIS, les memes emojis et les memes libelles,
// SANS emporter le moindre acces au telephone de qui que ce soit.

// Trois choix, dans l'ordre d'affichage, du plus leger au plus dur (PRD §7.3).
// L'emoji est une DONNEE et non un `content:` CSS : il doit pouvoir porter
// aria-hidden, et un lecteur d'ecran doit annoncer « Facile », pas le nom
// Unicode du caractere.
export const RESSENTIS = [
  { cle: 'facile', emoji: '🙂', libelle: 'Facile' },
  { cle: 'correct', emoji: '😐', libelle: 'Correct' },
  { cle: 'dur', emoji: '🥵', libelle: 'Dur' },
];

// Derive, jamais recopie : deux listes divergeraient au premier changement.
export const CLES_RESSENTI = RESSENTIS.map((r) => r.cle);

export const QUESTION_RESSENTI = 'C’était comment ?';
// Un enfant devant trois boutons ne devine pas qu'il peut ne pas repondre.
export const AIDE_RESSENTI = 'Tu peux fermer sans répondre.';

export function estRessentiValide(valeur) {
  return CLES_RESSENTI.includes(valeur);
}

// Ne garde que ce que le serveur accepte : une cle qui est une date de seance du
// programme, une valeur parmi les trois.
//
// C'est le SEUL rempart, et il ne s'omet pas « parce que la valeur vient d'une
// constante » : elle vient du stockage du navigateur, qui a pu etre ecrit par une
// version anterieure de l'application. Le serveur refuse le champ EN BLOC — une
// entree deformee ne perd pas le ressenti, elle perd l'envoi ENTIER, classement
// compris, et l'enfant sort du podium sans qu'aucun ecran ne l'explique.
export function ressentisPourEnvoi(prog, ressentis) {
  const dates = new Set((prog?.seances ?? []).map((s) => s.date));
  const garde = {};
  for (const [date, valeur] of Object.entries(ressentis ?? {})) {
    if (dates.has(date) && estRessentiValide(valeur)) garde[date] = valeur;
  }
  return garde;
}

// Le pendant de `empreinte` du classement : pas de hachage, une chaine qui
// change des que quelque chose change. Les entrees sont triees par date, donc
// deux objets de memes couples rendent la meme chaine quel que soit l'ordre
// d'insertion.
export function empreinteRessentis(ressentis) {
  const entrees = Object.entries(ressentis ?? {});
  if (entrees.length === 0) return '';
  return entrees
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, valeur]) => `${date}=${valeur}`)
    .join(',');
}

// La ligne de trois boutons, posee DANS le panneau de fin du PRP 06 — jamais
// dans un second <dialog>. Deux panneaux modaux ouverts sur le meme evenement,
// c'est un panneau invisible et un enfant coince.
//
// `lire` et `ecrire` sont fournis par l'appelant : ce module ne connait aucun
// stockage.
export function monterRessenti(hote, dateISO, { lire, ecrire, surChoix }) {
  const bloc = document.createElement('fieldset');
  bloc.className = 'ressenti';

  const question = document.createElement('legend');
  question.className = 'ressenti-question';
  question.textContent = QUESTION_RESSENTI;
  bloc.append(question);

  const choix = document.createElement('div');
  choix.className = 'ressenti-choix';

  const dejaDit = lire()[dateISO];

  for (const r of RESSENTIS) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = r.cle === dejaDit ? 'choix-ressenti choisi' : 'choix-ressenti';
    bouton.dataset.ressenti = r.cle;
    // Une reponse deja donnee se voit : la seance a pu etre decochee puis
    // recochee, et le panneau se rouvre alors.
    bouton.setAttribute('aria-pressed', r.cle === dejaDit ? 'true' : 'false');

    const emoji = document.createElement('span');
    emoji.className = 'ressenti-emoji';
    emoji.textContent = r.emoji;
    emoji.setAttribute('aria-hidden', 'true');

    const mot = document.createElement('span');
    mot.className = 'ressenti-mot';
    // Chaque bouton porte son mot : trois emojis nus se lisent differemment
    // d'un telephone a l'autre.
    mot.textContent = r.libelle;

    bouton.append(emoji, mot);
    bouton.addEventListener('click', () => {
      // Un seul tap : on ecrit, puis on ferme. Fermer immediatement est sur —
      // le `fermer()` du PRP 06 pose la valeur finale des compteurs avant de
      // retirer le panneau.
      ecrire(dateISO, r.cle);
      surChoix();
    });
    choix.append(bouton);
  }

  const aide = document.createElement('p');
  aide.className = 'aide';
  aide.textContent = AIDE_RESSENTI;

  bloc.append(choix, aide);
  hote.append(bloc);
  return bloc;
}

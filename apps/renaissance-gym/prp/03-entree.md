# PRP 03 — L'entrée : prénom, semaine, compte

| | |
|---|---|
| **Lot** | 1 pour les écrans 1 et 2, 2 pour l'écran 3 |
| **Dépend de** | PRP 02 (contrat d'écran, jetons, `etat.js`) ; **l'écran 3 attend le PRP 06** |
| **Débloque** | tout : sans prénom enregistré, aucune autre route ne s'affiche |
| **PRD** | §7.1, §7.5, §10.1, §10.2, §14 |

## Objectif

Moins d'une minute entre le premier chargement et la première séance, et une
sauvegarde qui existe dès la première case cochée.

## Ce qui est vérifiable à la fin

- `node --test tests/entree.test.js` passe.
- Un test assert que le texte d'explication du code reproduit **mot pour mot**
  le bloc de citation du PRD §7.1, lu dans `PRODUCT.md`. Une reformulation fait
  tomber le test.
- Un test assert que `proposerPseudo()` n'accepte **aucun paramètre de prénom** :
  c'est la garantie mécanique qu'un prénom ne fuit pas dans un pseudonyme.
- Un test parcourt 500 tirages de `proposerPseudo` et assert qu'aucun ne figure
  dans une liste de 200 prénoms courants.
- Un code refusé trois fois de suite produit des délais de 5, 15 puis 45 s,
  mesurés sur une horloge injectée.

## Chantier A — les trois écrans

**Écran 1 — le prénom.** Un champ, un bouton. Motif accepté : 1 à 20
caractères, lettres, espace, tiret, apostrophe. Le refus s'affiche **sous le
champ fautif** et non dans une bannière — c'est la correction qu'a demandée
`marcq-handball` après mise en ligne, et elle est acquise ici d'entrée.

**Écran 2 — la semaine de départ.** Les huit semaines en huit cibles de 56 px
minimum, disposées en deux rangs de quatre. La semaine 1 est présélectionnée.
Sous les cibles, une phrase : « Si tu as déjà commencé sur ta feuille, choisis
la semaine où tu en es. »

**Écran 3 — le compte.** Un pseudonyme pré-rempli par `proposerPseudo()` et
modifiable, un code à six chiffres saisi deux fois. Le texte du PRD §7.1 est
au-dessus des champs, pas en dessous : il explique avant de demander.

Le champ de code est `inputmode="numeric"`, `autocomplete="off"`,
`pattern="\d{6}"`. Six cases distinctes plutôt qu'un champ unique : sur un
téléphone posé par terre, on voit combien de chiffres il reste.

## Chantier B — `web/vue-entree.js`

```js
export const MOTS_PSEUDO;        // 24 noms communs — animaux, astres, phenomenes. AUCUN prenom.
export const MOTIF_PSEUDO = /^[\p{L}\p{N}][\p{L}\p{N} .\-_]{0,15}$/u;
export const MOTIF_CODE   = /^\d{6}$/;
export const MOTIF_PRENOM = /^[\p{L}][\p{L} '\-]{0,19}$/u;
export const EXPLICATION_CODE;   // le bloc du PRD §7.1, mot pour mot
export const REPRISES_MS = [5000, 15000, 45000];

export function proposerPseudo(alea = Math.random)  // AUCUN parametre de prenom
export function validerPrenom(saisie)   // -> { valeur, erreur }
export function validerPseudo(saisie)   // -> { valeur, erreur }
export function validerCode(saisie, confirmation)  // -> { valeur, erreur }
export function delaiApresRefus(refusConsecutifs)  // -> ms, plafonne au dernier palier

export function monterEntree(hote, ctx)     // -> demonter()
export function monterReprise(hote, ctx)    // « J'ai deja un pseudo » -> demonter()
```

`MOTS_PSEUDO` tient 24 noms communs — « Renarde », « Comète », « Orage »,
« Hirondelle »… — suffixés d'un nombre à deux chiffres. Aucun prénom, aucune
marque, aucun mot pouvant se lire comme un jugement sur le corps.

## Chantier C — la reprise sur un second appareil

Depuis l'écran 3, une action discrète : « J'ai déjà un pseudo ». Elle mène à
`monterReprise` : pseudonyme, code, et rien d'autre.

Au succès, l'appareil **reçoit la fiche entière** — prénom, semaine de départ,
faits, badges — et la fusionne avec ce qu'il portait déjà, selon le PRD §9.8 et
§9.9. Si l'appareil n'avait rien, la fusion est une copie.

Au refus, le message est sous le champ, et le délai du PRD §7.5 s'installe. Le
message ne dit **jamais** si c'est le pseudonyme ou le code qui est faux :
distinguer les deux revient à offrir un oracle d'existence de pseudonymes.

## Chantier D — l'ordre, et pourquoi il est celui-là

Le compte est troisième et non premier. Le PRD §7.1 le dit : « un formulaire
d'inscription en premier écran fait fermer l'onglet ». Il est en revanche
**obligatoire** — on n'atteint pas `#/jour` sans l'avoir franchi (PRD §13).

Deux cas d'échec à l'écran 3, tous deux sans issue borgne :

| Échec | Conduite |
|---|---|
| Pseudonyme déjà pris | Refus immédiat, avec une proposition de remplacement d'un clic |
| Le serveur ne répond pas | L'application **continue quand même** : le compte est gardé sur l'appareil, marqué « à créer », et la création repart à la première synchronisation réussie. Elle ne perd pas sa séance parce qu'un serveur redémarrait |

Le second cas est ce qui empêche un compte obligatoire de devenir un mur. Il est
sûr : le pseudonyme n'est réservé qu'à la création réussie, et un conflit
découvert plus tard se règle en proposant un autre pseudonyme, sans rien perdre
des faits déjà enregistrés.

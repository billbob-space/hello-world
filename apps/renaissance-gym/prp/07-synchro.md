# PRP 07 — La synchronisation

| | |
|---|---|
| **Lot** | 2 |
| **Dépend de** | PRP 02 (`etat.js`), PRP 06 (l'API) |
| **Débloque** | rien |
| **PRD** | §7.5, §9.8, §9.9, §11.2, §14 |

## Objectif

Que la progression suive la gymnaste d'un téléphone à l'autre, sans qu'elle y
pense, et sans que le réseau puisse jamais l'empêcher de s'entraîner.

## Ce qui est vérifiable à la fin

- `node --test tests/synchro.test.js` passe.
- **Réseau coupé** : une séance entière se coche, l'écran affiche « Pas de
  réseau — ce sera sauvegardé plus tard », et la console ne montre aucune
  exception non rattrapée.
- Le réseau revenant, l'envoi part **seul**, sans geste de l'utilisatrice.
- Un test assert qu'aucune réponse serveur ne peut **retirer** un fait local :
  la réponse est fusionnée par union, jamais substituée. C'est l'ossature §7
  point 3, et c'est la propriété qui rend deux téléphones sûrs.
- Un test assert que le corps envoyé ne contient **jamais** le code en clair
  hors du champ `code` lui-même, et qu'aucun journal navigateur ne l'écrit.

## Chantier A — `web/synchro.js`

```js
export const CHEMIN_API = '/api/fiche';
export const DELAI_MS = 8000;            // au-dela, un portail captif ment
export const INTERVALLE_MIN_MS = 30000;  // debit des declenchements automatiques
export const REPRISES_MS = [5000, 15000, 45000];
export const EVT_SYNCHRO = 'gym:synchro-maj';

export function corpsSynchronisation(etat)   // -> { operation:'synchroniser', pseudo, code, … }
export function envoiNecessaire(etat)        // -> boolean
export async function creer(etat, options)
export async function synchroniser(etat, options)
export async function effacer(etat, options)
export function brancher(ctx, options)       // -> debrancher()

export const PHRASES;      // { 'a-jour', 'en-attente', 'hors-ligne', 'jamais', 'echec' }
export function etatSynchro(etat, maintenant, enLigne)  // -> { statut, phrase, fraicheur }
export function formaterFraicheur(recuA, maintenant)    // 'à l’instant' | 'il y a 2 h' | 'hier'
```

## Chantier B — quand ça part

Trois déclencheurs, et pas un de plus :

1. **À la fin d'une séance.** C'est le moment où quelque chose vaut d'être
   sauvegardé.
2. **Au retour du réseau** (`online`), s'il reste quelque chose à envoyer.
3. **À l'ouverture de l'application**, pour récupérer ce qu'un autre appareil
   aurait fait.

Jamais à chaque exercice validé : vingt requêtes par séance sur une 4G de
vacances, pour une donnée qui ne sert qu'à la fin, est un gaspillage qui se paie
en batterie.

`INTERVALLE_MIN_MS` borne le débit : deux déclenchements rapprochés n'envoient
qu'une fois.

## Chantier C — la fusion, côté client

La réponse du serveur est **fusionnée**, jamais substituée :

```js
etat.faits = fusionner(etat.faits, reponse.faits)   // domaine.js, PRP 01
```

`prenom` et `semaineDepart` suivent le PRD §9.9 — le dernier écrit gagne — avec
une précision qui compte : **l'appareil ne remplace sa valeur locale que si la
sienne est vide, ou si celle du serveur est plus récente**. Sans cela, un
téléphone laissé au fond d'un sac depuis trois semaines réimposerait un prénom
changé depuis.

## Chantier D — ce qui s'affiche

L'état de la sauvegarde apparaît dans les réglages, en une phrase, et **nulle
part ailleurs** :

| Statut | Phrase |
|---|---|
| `a-jour` | Sauvegardé à l'instant / il y a 2 h |
| `en-attente` | Ce sera sauvegardé au prochain réseau |
| `hors-ligne` | Pas de réseau — ce sera sauvegardé plus tard |
| `jamais` | Pas encore sauvegardé |
| `echec` | La sauvegarde n'a pas marché. On réessaiera tout seul. |

**Aucune de ces phrases ne bloque quoi que ce soit**, aucune n'est une erreur
rouge, aucune ne demande une action. Le PRD §11.2 l'exige : le serveur est une
sauvegarde, jamais une dépendance de fonctionnement.

L'écran de séance n'affiche **rien** de tout cela. Elle est en gainage ; l'état
d'une requête HTTP ne la regarde pas.

## Chantier E — la création différée

Le PRP 03 chantier D pose qu'un compte peut naître « à créer » quand le serveur
ne répond pas. `synchro.js` en tient la conséquence : à chaque déclenchement, si
l'état porte un compte marqué à créer, l'opération tentée est `creer` et non
`synchroniser`.

Un `409` reçu à ce moment-là — le pseudonyme a été pris entre-temps — n'efface
rien : l'application propose un autre pseudonyme, garde tous les faits, et
retente. C'est le seul cas où l'utilisatrice est interrompue par la
synchronisation, et il est rare au point d'être théorique pour une application à
une utilisatrice.

# PRP 08 — Rejoindre le classement, en connaissance de cause

> **Pour l'agent qui exécute :** applique ce PRP avec
> `superpowers:subagent-driven-development` ou `superpowers:executing-plans`.
> Les étapes sont des cases à cocher.
>
> **Ossature :** `apps/marcq-handball/prp/00-ossature.md` — lu avant de commencer.
> **PRD :** `docs/superpowers/specs/2026-08-03-marcq-handball-prd.md`

| | |
|---|---|
| **Lot** | 2 |
| **Branche** | `marcq-handball/rejoindre` |
| **Dépend de** | PRP 07 (`GET` et `POST /api/classement`, le magasin de scores), et par lui du point d'arrêt PRD §12.1 ; PRP 03 (`app.js`, `etat.js`, le contrat d'écran, `dateEnToutesLettres`) ; PRP 04 (`EVT_SEANCE_COMPLETE`) ; PRP 05 (`#/perso`, où vit le point de déclenchement) |
| **Débloque** | PRP 09 (podium, position, jauge de groupe : il lit `dernierRangConnu` et écoute `EVT_CLASSEMENT`) |
| **Sections du PRD** | §5 (le principe directeur), §7.4 (l'écran de consentement, mot pour mot), §11 (hors ligne, aucun compte), §14 (pseudonyme identifiant, perte du téléphone), §6 lot 2 item 8 |

> ⛔ **Verrou** — ce PRP ne démarre pas avant que le PRP 07 soit livré, et le
> PRP 07 ne démarre pas avant que la survie des scores à un redéploiement soit
> tranchée. Le PRD §12.1 le pose ; il se tranche côté exploitation du serveur,
> pas dans ce dépôt. Tant qu'il tient, tout ce qui suit est un contrat : les
> interfaces sont exactes et utilisables le jour où le verrou saute, mais aucune
> ligne de code ne s'écrit avant, sous peine d'être jetée si l'API change de
> forme.

## Objectif

Un enfant décide, au moment où le choix se pose et non avant, de publier ou non
un nom sur Internet — et, dans les deux cas, il repart avec une application
complète, qui fonctionne réseau coupé et dont il peut sortir.

## Ce qui est vérifiable à la fin

- `node --test tests/rejoindre.test.js` prouve que les cinq chaînes de
  `CONSENTEMENT` reproduisent le bloc de citation du PRD §7.4, **lu dans le
  fichier du dépôt**, après la seule normalisation déclarée au chantier C. Une
  reformulation, même heureuse, fait tomber le test.
- Un test construit le corps d'envoi depuis un contexte portant
  `prenom: 'Lucas'` et assert que `Object.keys(corps)` vaut exactement
  `['pseudo', 'code', 'faits']` et que `JSON.stringify(corps)` ne contient pas
  `Lucas` ; un second test lit les sources de `web/classement.js` et
  `web/vue-rejoindre.js` et échoue si la sous-chaîne `prenom` y apparaît, y
  compris en commentaire.
- Réseau coupé (outils de développement → Réseau → Hors ligne) : une séance
  entière se coche, `#/perso` affiche `Pas de réseau. Dernière mise à jour il y
  a 2 h.`, et la console ne montre aucune exception non rattrapée.
- Hors ligne, le bouton de suppression n'efface **rien** localement et dit
  pourquoi ; en ligne, il fait disparaître `marcq.v1.classement` de
  `localStorage` **et** le pseudonyme de `GET /api/classement`.
- Face à un serveur qui répond `409 {"erreur":"pseudo-pris"}`, l'écran affiche
  `Ce nom est déjà pris. Choisis-en un autre.`, propose un autre nom, et le code
  déjà saisi reste dans son champ.
- `./apps/marcq-handball/test.sh` est vert, `./init.sh --check` aussi — la
  chaîne `x-forwarded-user` n'apparaît dans aucun fichier ajouté.

## Périmètre

**Dedans :** l'état local du classement dans `etat.js` ; le client réseau, la
reprise et le débit dans `web/classement.js` ; l'écran de consentement, le choix
du pseudonyme et du code, la ligne d'état et la sortie dans
`web/vue-rejoindre.js` ; le point de déclenchement dans `web/vue-perso.js` ; le
bloc de suppression et l'avertissement de « changer d'enfant » dans
`web/vue-reglages.js` ; la route `#/rejoindre` dans `app.js` ; le style ;
`tests/classement.test.js` et `tests/rejoindre.test.js` ; une section du
`README.md`.

**Dehors, et pourquoi :**

- **Le podium, la position, la jauge de groupe — PRP 09.** Ce PRP produit la
  donnée (`dernierRangConnu`, `EVT_CLASSEMENT`) et le conteneur `.bloc-equipe` ;
  il n'affiche aucun rang. La frontière est nette : ici on décide et on envoie,
  là-bas on regarde.
- **Le magasin, le calcul du rang, la relecture serveur de `programme.json` —
  PRP 07.** Le rang n'est jamais calculé ici : un rang calculé par le client est
  un rang déclaré par le client (ossature §2).
- **La vue coach — PRP 10.** `GET /api/coach` n'est ni appelé ni défini ici.
- **Le ressenti de fin de séance — PRP 10.** Il écoute le même
  `EVT_SEANCE_COMPLETE`, sans interférence : ce PRP n'ouvre aucun panneau.

## Interfaces

**Consomme — de l'ossature et des PRP amont :**

```js
// web/etat.js — PRP 03
lireFaits()                                 // -> { [idExercice]: horodatageISO }, {} si illisible
toutEffacer()                               // -> nombre de cles `marcq.` effacees
PREFIXE_CLES                                // 'marcq.'

// web/app.js — PRP 03
ECRANS                                      // [{ nom, motif, monter }]
// ctx = { prog, aujourdhui, prenom, faits, route, aller(route), rafraichir() }
// Regle 1 : un ecran ne mute JAMAIS ctx.  Regle 2 : un ecran n'en monte jamais un autre.

// web/vue-jour.js — PRP 03
dateEnToutesLettres(dateISO)                // '2026-08-03' -> 'lundi 3 août'

// web/vue-seance.js — PRP 04
EVT_SEANCE_COMPLETE                         // 'marcq:seance-complete', CustomEvent { date, total }

// web/domaine.js — PRP 02
progression(prog, aujourdhui, faits)        // -> { cochees, programmees, part }

// web/vue-perso.js — PRP 05
monterPerso(hote, ctx)                      // c'est lui qui recevra le conteneur .bloc-equipe

// web/style.css — PRP 01 et 03
// --marcq-encre --marcq-encre-douce --marcq-fond --marcq-carte --marcq-accent
// --marcq-sur-accent --marcq-danger --marcq-trait --marcq-tap (48px)
// .ecran  .titre-ecran  .titre-bloc  .aide  .bouton  .bouton-principal  .panne
```

**Consomme — du PRP 07, contrat exact exigé.** L'API appartient au PRP 07 ; ce
PRP en énonce la forme dont il a besoin. En cas d'écart, c'est ce document qui
s'aligne, et les fonctions à corriger sont nommées au chantier B.

```
GET /api/classement
  aucun parametre, aucune en-tete, aucun cookie — l'URL ne porte JAMAIS de pseudo
  200 application/json, Cache-Control: no-store
```

```json
{
  "date": "2026-08-10",
  "programmees": 24,
  "participants": 9,
  "podium": [
    { "rang": 1, "pseudo": "Renard-14", "cochees": 23, "part": 0.958 },
    { "rang": 2, "pseudo": "Sirocco",   "cochees": 21, "part": 0.875 },
    { "rang": 3, "pseudo": "Tornade-31","cochees": 20, "part": 0.833 }
  ],
  "parts": [0.958, 0.875, 0.833, 0.791, 0.75, 0.708, 0.625, 0.5, 0.333],
  "groupe": { "cochees": 154, "programmees": 216, "part": 0.713 }
}
```

`parts` est trié décroissant, de longueur `participants`, et **ne porte aucun
pseudonyme**. C'est lui qui rend tenable la dernière phrase du PRD §7.4 — *« il
continue à voir sa position »* — sans que le serveur connaisse celui qui n'a pas
rejoint : le client compare sa propre part à cette liste et en déduit son rang,
localement.

```
POST /api/classement
  application/json, exactement trois cles, aucune autre acceptee
```

```json
{ "pseudo": "Renard-14", "code": "4821", "faits": ["s1-c1", "s1-c2", "s1-r1"] }
```

Réponse `200` : **le corps du `GET` ci-dessus**, plus une clé `moi` :

```json
{ "moi": { "pseudo": "Renard-14", "rang": 3, "cochees": 17, "part": 0.708 } }
```

Aucun horodatage n'est envoyé : le départage du PRD §9 — *« le premier arrivé à
ce score est devant »* — se fait sur l'horloge de réception du serveur. Une date
fournie par le client serait déclarative, ce que l'ossature §2 refuse
explicitement pour le rang.

Suppression, sur la même route et le même verbe :

```json
{ "pseudo": "Renard-14", "code": "4821", "supprimer": true }
```

Réponse `200` : le corps du `GET` recalculé **sans** l'intéressé, plus
`{ "supprime": true }`. Un pseudonyme inconnu rend `{ "supprime": false }` et
`200` : la suppression est idempotente, un second tap ne doit pas inquiéter.

Erreurs, toujours en JSON `{ "erreur": "<code>" }` :

| Statut | `erreur` | Quand |
|---|---|---|
| `400` | `corps-invalide` | JSON illisible, clé manquante ou en trop, pseudo ou code hors format |
| `409` | `pseudo-pris` | le pseudonyme existe avec un autre code |
| `429` | `trop-de-requetes` | garde-fou de débit du serveur |
| `503` | `magasin-indisponible` | le magasin de scores est inaccessible |

**Produit :**

```js
// web/etat.js — completé
export const CLE_CLASSEMENT = 'marcq.v1.classement';
export const CLASSEMENT_VIDE = { pseudo: null, code: null, dernierEnvoi: null, dernierRangConnu: null };
export function lireClassement()            // -> la forme ci-dessus, JAMAIS null
export function ecrireClassement(partiel)   // FUSIONNE puis ecrit ; -> l'objet a jour
export function effacerClassement()         // -> true si la cle existait
```

```js
// web/classement.js — ce qui est ENVOYE
export const CHEMIN_API = '/api/classement';
export const DELAI_MS = 8000;               // au-dela, un portail captif ment
export const INTERVALLE_MIN_MS = 30000;     // debit des declenchements automatiques
export const REPRISES_MS = [5000, 15000, 45000];
export const EVT_CLASSEMENT = 'marcq:classement-maj';
// CustomEvent sur document, bubbles: true, detail { instantane, moi, statut }

export function empreinte(faits)                        // -> '17:2026-08-10T18:22:11.000Z' | ''
export function corpsEnvoi({ pseudo, code, faits })     // -> { pseudo, code, faits: [ids tries] }
export function corpsSuppression({ pseudo, code })      // -> { pseudo, code, supprimer: true }
export function envoiNecessaire(local, faits)           // -> boolean
export async function relever(options = {})             // GET  -> Resultat
export async function envoyer({ pseudo, code, faits }, options = {})   // POST -> Resultat
export async function supprimer({ pseudo, code }, options = {})        // POST -> Resultat
export async function synchroniser(ctx, options = {})   // choisit GET ou POST, ecrit l'etat, emet l'evenement
export function brancherSynchronisation(ctx, options = {})             // -> debrancher()

// Resultat — une seule forme, succes comme echec. Jamais de promesse rejetee.
// { ok: true,  instantane, moi }            moi === null hors POST
// { ok: false, statut, erreur }             statut 0 = pas de reseau ou delai depasse
// options injectables : { fetch, maintenant, lire, ecrire, doc, fenetre, minuterie }
```

```js
// web/vue-rejoindre.js — ce qui est DIT
export const CONSENTEMENT;          // les cinq chaines du PRD §7.4, mot pour mot
export const RAPPEL_CHOIX;          // le rappel d'une ligne de l'etape 2
export const EXPLICATION_CODE;
export const TEXTE_REJOINDRE = 'Apparaître au classement';
export const EXPLICATION_SUPPRESSION;
export const MOTS_PSEUDO;           // 24 noms communs, aucun prenom
export const MOTIF_PSEUDO;          // /^[\p{L}\p{N}][\p{L}\p{N} .\-_]{0,15}$/u
export const MOTIF_CODE = /^\d{4}$/;
export const PHRASES_SYNCHRO;       // { 'a-jour', 'en-attente', 'hors-ligne', 'jamais', 'echec' }

export function proposerPseudo(alea = Math.random)   // AUCUN parametre de prenom : c'est la garantie
export function validerPseudo(saisie)                // -> { valeur, erreur }
export function validerCode(saisie)                  // -> { valeur, erreur }
export function messageErreur(statut, erreur)        // -> phrase francaise
export function formaterFraicheur(recuA, maintenant) // -> 'à l’instant' | 'il y a 2 h' | 'hier' | 'le lundi 3 août'
export function etatSynchro(local, maintenant, enLigne)  // -> { statut, phrase, fraicheur }
export function phraseSuppression(pseudo)            // -> 'Supprimer « Renard-14 » du classement ?'
export function avertissementChangementEnfant(pseudo)// -> la phrase ajoutee a la confirmation du PRP 03
export function monterRejoindre(hote, ctx)           // l'ecran #/rejoindre, au contrat du PRP 03
export function monterActionClassement(hote, ctx)    // le bloc d'action de #/perso -> demontage
export function monterSuppression(hote, ctx)         // le bloc de #/reglages -> demontage
```

```
route  #/rejoindre        une entree dans ECRANS, AUCUNE dans LIENS
.bloc-equipe              la <section> posee sous le calendrier de #/perso ;
                          le PRP 09 pose podium, position et jauge AU-DESSUS
                          de l'appel a monterActionClassement, dans ce meme conteneur
```

**Les noms introduits ici, absents de `00-ossature.md` :**

| Nom | Ce que c'est, et pourquoi |
|---|---|
| `web/classement.js`, `web/vue-rejoindre.js` | Deux modules et non un : l'un décide **ce qui est envoyé**, l'autre **ce qui est dit**. La séparation est ce qui rend testable, sans navigateur ni réseau, la garantie que le prénom ne part pas. |
| `CLE_CLASSEMENT`, `CLASSEMENT_VIDE` | La clé de l'ossature §6, plus sa valeur par défaut. `lireClassement()` rend `CLASSEMENT_VIDE` et jamais `null`, comme `lireFaits()` rend `{}` : l'appelant n'a pas de branche à écrire. |
| `dernierEnvoi = { at, empreinte }` | L'ossature nomme la clé, pas sa forme. `empreinte` est ce qui fait de la file d'attente une comparaison — voir chantier B. |
| `dernierRangConnu = { recuA, instantane, moi }` | L'ossature nomme la clé ; elle porte ici **l'instantané entier** du serveur, pas un entier. Le nom reste celui de l'ossature : le renommer forkerait le contrat pour de l'esthétique. |
| `EVT_CLASSEMENT` | Le point d'accroche du PRP 09, sur le modèle des deux événements du PRP 04. Sans lui, le podium devrait interroger `localStorage` en boucle. |
| `.bloc-equipe` | Le conteneur partagé avec le PRP 09, et le seul point de contact entre les deux branches. |
| `MOTS_PSEUDO`, `proposerPseudo` | La proposition de pseudonyme. Sa signature est le contrat : elle ne reçoit que la source d'aléa, donc elle **ne peut pas** dériver du prénom. |
| `supprimer: true` sur `POST` | La suppression garde la route et le verbe de la mise à jour — c'est une mise à jour vers rien, avec exactement la même authentification. La liste de routes de l'ossature §7 reste intacte. |

## Fichiers

- Créer : `apps/marcq-handball/web/classement.js`,
  `apps/marcq-handball/web/vue-rejoindre.js`,
  `apps/marcq-handball/tests/classement.test.js`,
  `apps/marcq-handball/tests/rejoindre.test.js`
- Modifier : `apps/marcq-handball/web/etat.js`,
  `apps/marcq-handball/web/app.js`,
  `apps/marcq-handball/web/vue-perso.js`,
  `apps/marcq-handball/web/vue-reglages.js`,
  `apps/marcq-handball/web/style.css`,
  `apps/marcq-handball/web/sw.js`,
  `apps/marcq-handball/tests/etat.test.js`,
  `apps/marcq-handball/README.md`
- Tester : `apps/marcq-handball/tests/classement.test.js`,
  `apps/marcq-handball/tests/rejoindre.test.js`,
  `apps/marcq-handball/tests/etat.test.js`, plus les deux contrôles à la main du
  chantier B (hors ligne) et du chantier E (suppression) — la CI n'a ni
  navigateur ni interrupteur réseau.

---

# Ce qu'il faut construire

## Chantier A — L'état local du classement

**Ce qu'il fait.** Ajoute à `etat.js` la quatrième clé de l'ossature §6 et ses
trois accès. Rien d'autre : aucun réseau, aucun DOM.

**Interfaces exactes.**

```js
export const CLE_CLASSEMENT = 'marcq.v1.classement';
export const CLASSEMENT_VIDE = { pseudo: null, code: null, dernierEnvoi: null, dernierRangConnu: null };

export function lireClassement()
// -> { pseudo: string|null, code: string|null,
//      dernierEnvoi: { at: isoString, empreinte: string } | null,
//      dernierRangConnu: { recuA: isoString, instantane: object, moi: object|null } | null }
// JSON illisible, quota plein, navigation privee : rend CLASSEMENT_VIDE apres une
// trace console, jamais une exception (ossature §6).

export function ecrireClassement(partiel)   // -> l'objet complet apres fusion
export function effacerClassement()         // -> true si la cle existait
```

**Règle métier.** `ecrireClassement` **fusionne** : `{ ...lireClassement(),
...partiel }`. Un remplacement complet serait le défaut le plus coûteux du
produit — le rafraîchissement du rang, qui n'écrit que `dernierRangConnu`,
effacerait `code`, et l'enfant perdrait pour toujours le moyen de supprimer son
pseudonyme (PRD §14). C'est silencieux : rien ne casse, l'app continue, et le
dégât n'apparaît qu'au moment où il est irréparable.

`toutEffacer()` du PRP 03 efface déjà toutes les clés `marcq.` : « changer
d'enfant » emporte donc le classement local. Ce comportement est conservé, et
ses conséquences sont traitées au chantier E.

**Critère d'acceptation.** `tests/etat.test.js` prouve, sur le double de
`localStorage` déjà en place au PRP 03 : que `lireClassement()` rend
`CLASSEMENT_VIDE` sur une clé absente et sur une clé contenant `{{`, que
`ecrireClassement({ dernierRangConnu: x })` laisse `code` intact, et que
`toutEffacer()` fait disparaître `CLE_CLASSEMENT`.

## Chantier B — Le client, la file d'attente et la reprise

**Ce qu'il fait.** Parle au serveur, et décide **quand**. C'est le chantier qui
tient le PRD §11 : *« l'absence de réseau n'empêche jamais de s'entraîner ; le
classement affiche la dernière valeur connue et le dit »*.

**La décision centrale : il n'y a pas de file de messages, il y a une
comparaison.** Le corps envoyé porte l'**état complet** — la liste des
identifiants cochés —, pas un delta. Un envoi est donc idempotent, et deux
envois successifs ne se composent pas : le second suffit. On ne met donc rien en
file. On enregistre la dernière confirmation reçue, et un envoi est dû dès que
l'état local en diffère.

```js
export function empreinte(faits)
// -> `${nombre de cles}:${horodatage maximum}`, '' si faits est vide.
// Cocher augmente le maximum (etat.js pose new Date().toISOString()) ; decocher
// diminue le nombre. Toute modification change donc l'empreinte, sans hachage.

export function envoiNecessaire(local, faits)
// -> local.pseudo !== null && empreinte(faits) !== (local.dernierEnvoi?.empreinte ?? '')
```

`dernierEnvoi` n'est écrit **qu'après une réponse `200`**. Un envoi perdu ne
laisse donc aucune trace, et le déclencheur suivant le refait tout seul : la
reprise après coupure n'est pas un mécanisme, c'est une conséquence.

**Les déclencheurs, et eux seuls.**

| Déclencheur | Pourquoi |
|---|---|
| Une fois, après le premier rendu et après l'enregistrement du service worker | Le réseau ne doit pas concourir avec le premier affichage (PRD §4 : l'entrée sans friction se joue sur la première seconde) |
| `EVT_SEANCE_COMPLETE` du PRP 04 | Le score ne devient intéressant qu'à la séance terminée |
| `online` sur `window` | C'est la reprise, et elle ne coûte rien quand il n'y a rien à envoyer |
| Un geste explicite « Actualiser » (PRP 09) | Une main est son propre garde-fou de débit |

**Jamais sur `EVT_COCHAGE`.** Cinquante-trois `POST` sur un programme, c'est ce
qui ferait mordre le rate-limit du palier public sur un enfant réel plutôt que
sur un robot (PRD §11).

**Débit et reprise.** Le débit vit dans `brancherSynchronisation`, pas dans
`synchroniser` : les déclencheurs automatiques sont espacés d'au moins
`INTERVALLE_MIN_MS`, un seul appel est en vol à la fois, et un échec est repris
selon `REPRISES_MS` puis abandonné jusqu'au déclencheur suivant. Un téléphone
hors réseau ne doit pas passer la nuit à réessayer ; `online` le réveillera.

Chaque requête porte `signal: AbortSignal.timeout(DELAI_MS)` et
`cache: 'no-store'`. Sans délai, un portail captif d'hôtel laisse la promesse en
suspens pour toujours, et l'interface annonce « à jour » alors que rien n'est
parti.

**Ce que `synchroniser` décide.**

```js
export async function synchroniser(ctx, options = {})
// 1. local = lireClassement()
// 2. local.pseudo === null            -> relever()          (GET : situer sans rejoindre)
//    envoiNecessaire(local, faits)    -> envoyer(...)       (POST)
//    sinon                            -> relever()          (rafraichir le rang des autres)
// 3. sur ok : ecrireClassement({ dernierRangConnu: { recuA, instantane, moi } })
//             et, si POST : dernierEnvoi = { at: recuA, empreinte: empreinte(faits) }
// 4. emet EVT_CLASSEMENT sur document, succes comme echec
```

`ctx.faits` n'est pas relu ici : `synchroniser` appelle `lireFaits()`. Le
contexte du PRP 03 est un instantané du dernier rendu, et une séance peut avoir
été cochée depuis.

**Aucun paramètre d'URL, jamais.** Le pseudonyme et le code ne circulent que
dans le corps d'un `POST`. Une URL part dans les journaux d'accès et dans
l'en-tête `Referer` ; l'ossature §9 impose des journaux qui n'apprennent aucune
identité, et un `?pseudo=` la leur donnerait.

**Critère d'acceptation.** `tests/classement.test.js` tourne sans réseau, avec un
`fetch` injecté : `empreinte` change à chaque cochage et à chaque décochage ;
`envoiNecessaire` est faux juste après un envoi confirmé et vrai après un
cochage ; un `fetch` qui rejette rend `{ ok: false, statut: 0 }` sans jeter ;
`dernierEnvoi` reste inchangé après un `503` ; deux appels rapprochés à travers
`brancherSynchronisation` ne produisent qu'une requête. À la main, hors ligne :
cocher une séance entière n'affiche aucune erreur et ne bloque aucun tap.

**Si le PRP 07 diverge du contrat ci-dessus**, seules `corpsEnvoi`,
`corpsSuppression` et la lecture de la réponse dans `relever` / `envoyer` /
`supprimer` changent. Ni les déclencheurs, ni l'empreinte, ni un seul écran n'en
dépendent — c'est la raison de cette découpe.

## Chantier C — L'écran de consentement

**Ce qu'il fait.** L'écran `#/rejoindre`, en deux étapes sur une seule route.

**Étape 1 — le message, mot pour mot.** Le PRD §7.4 l'a pesé ; il ne se
reformule pas.

```js
export const CONSENTEMENT = {
  titre: 'Avant de rejoindre le classement',
  avertissement: 'Le nom que tu choisis ici sera visible par tout le monde sur Internet, avec ta progression. Cette page n’est pas protégée par un mot de passe.',
  fort: 'par tout le monde sur Internet',   // le fragment que le PRD met en gras
  prenom: 'Ton prénom, lui, reste sur ton téléphone.',
  parent: 'Montre cet écran à un parent avant de continuer.',
  continuer: 'Choisir un nom et rejoindre',
  refuser: 'Non merci',
};
```

Le montage entoure `CONSENTEMENT.fort` d'un `<strong>` à l'intérieur de
`avertissement`, et `parent` d'un `<strong>` entier — c'est le gras du PRD.

**Le test qui rend cette exigence tenable** lit
`../../../docs/superpowers/specs/2026-08-03-marcq-handball-prd.md`, extrait le
bloc de citation de §7.4, et le compare aux constantes après **trois
normalisations, et pas une de plus** : les apostrophes `'` deviennent `’` (le
PRD est écrit en ASCII, l'interface en typographie française, comme
`Aujourd’hui` au PRP 03) ; les marqueurs `**` sont retirés ; les retours à la
ligne et les suites d'espaces deviennent une espace unique. Le chemin sort du
répertoire de l'application, ce qui est admis : `tests/` n'est jamais embarqué
et n'entre pas dans le contexte de construction (ossature §3).

**Étape 2 — le nom et le code.** Elle remplace l'étape 1 dans le même hôte, sans
changer de route. Elle rappelle en une ligne ce qui est en jeu :

```js
export const RAPPEL_CHOIX = 'Ce nom sera visible par tout le monde sur Internet.';
```

Le bloc entier répété serait du bruit ; le bloc entier scrollé hors de l'écran
laisserait le champ décisif sans contexte, au moment précis où un parent regarde.

**Le pseudonyme proposé.**

```js
export const MOTS_PSEUDO = ['Renard', 'Faucon', 'Comète', 'Bourrasque', 'Silex',
  'Cyclone', 'Panthère', 'Aigle', 'Tornade', 'Orage', 'Éclair', 'Braise',
  'Requin', 'Vipère', 'Lynx', 'Bison', 'Cobra', 'Météore', 'Mirage', 'Sirocco',
  'Granit', 'Obsidienne', 'Mustang', 'Typhon'];

export function proposerPseudo(alea = Math.random)   // -> 'Renard-14'
// <Mot>-<10..99>. 24 x 90 = 2160 tirages : dans un groupe de vingt, une
// collision arrive une fois sur onze — le serveur repond alors `pseudo-pris`
// et l'ecran propose un autre nom. Aucun mot n'est un prenom, aucun ne
// renvoie au club ni a la ville.
```

**La signature est la garantie.** `proposerPseudo` ne reçoit que sa source
d'aléa. Elle ne peut pas dériver du prénom parce qu'elle ne le voit pas — c'est
plus solide qu'une consigne, et c'est vérifiable par un test d'arité.

Le champ est **pré-rempli et entièrement modifiable**, y compris par le prénom :
le PRD §7.4 le dit, *« c'est son choix, il a été informé de ce qu'il implique »*.

**Validation.**

```js
export const MOTIF_PSEUDO = /^[\p{L}\p{N}][\p{L}\p{N} .\-_]{0,15}$/u;
export function validerPseudo(saisie)
// Normalise : trim, suites d'espaces reduites a une, normalize('NFC').
// -> { valeur, erreur } avec erreur ∈ { null, 'vide', 'trop-long', 'caracteres' }
// NFC evite qu'un « é » compose cree un jumeau invisible d'un pseudo existant.
// 16 caracteres : au-dela, le podium deborde sur un ecran de 320 px.
```

**Aucune liste de mots interdits.** Le PRD §14 nomme l'atténuation du risque
« pseudonyme injurieux ou identifiant » : *« le pseudonyme proposé par défaut
n'est pas le prénom ; il reste modifiable par l'enfant, et supprimable »*. Un
filtre serait un jeu à battre dans un groupe d'ados qui se connaissent, et la
modération est celle du coach, pas celle du code.

**Le code à 4 chiffres, sans exagération.**

```js
export const MOTIF_CODE = /^\d{4}$/;
export const EXPLICATION_CODE = 'Ce code empêche quelqu’un d’autre de modifier ton score depuis un autre téléphone. Ce n’est pas un mot de passe : il n’y a rien de sensible sur le serveur.';
export function validerCode(saisie)   // -> { valeur, erreur }, erreur ∈ { null, 'longueur' }
```

Le champ porte `inputmode="numeric"`, `pattern="[0-9]{4}"`, `maxlength="4"`,
`autocomplete="off"`. **Pas de second champ de confirmation, pas d'indicateur de
robustesse, pas de « choisis un code difficile ».** Le PRD §7.4 exige que la
fonction soit énoncée « sans exagération » ; un appareillage de mot de passe
autour de quatre chiffres dirait le contraire de la phrase qui l'accompagne.

**« Non merci » n'écrit rien.** Le bouton ramène à `#/perso`, et c'est tout :
aucun refus n'est mémorisé. Deux raisons — un refus stocké serait un schéma de
plus à migrer pour un seul usage, moins insister ; et rien n'insiste, le bouton
« Apparaître au classement » étant un bouton posé sur un écran, pas une
sollicitation. Revenir sur son refus coûte un tap.

**Ce que `messageErreur` dit.**

| Cas | Phrase |
|---|---|
| `409 pseudo-pris`, à l'inscription | `Ce nom est déjà pris. Choisis-en un autre.` |
| `409 pseudo-pris`, alors qu'un pseudonyme est déjà enregistré ici | `Ce nom existe déjà avec un autre code. Vérifie ton code.` |
| `400 corps-invalide` | `Le nom ou le code n’a pas été accepté.` |
| `429 trop-de-requetes` | `Trop de demandes d’un coup. Réessaie dans une minute.` |
| `503 magasin-indisponible` | `Le classement est indisponible. Ta progression, elle, est bien enregistrée sur ton téléphone.` |
| `statut 0` | `Pas de réseau. Réessaie quand tu en auras.` |

Le serveur ne distingue pas les deux `409` : c'est le client qui sait s'il
détenait déjà ce pseudonyme, et qui choisit la phrase. Aucune sémantique
supplémentaire n'est demandée au PRP 07.

**Un échec ne vide aucun champ.** Le nom et le code saisis restent en place :
retaper quatre chiffres après un `409` est la friction qui fait abandonner
(PRD §14, « abandon après deux séances »).

**Critère d'acceptation.** `tests/rejoindre.test.js` : les cinq chaînes de
`CONSENTEMENT` reproduisent le bloc du PRD ; `proposerPseudo` avec un aléa figé
rend un membre de `MOTS_PSEUDO` suivi de deux chiffres, et son arité est ≤ 1 ;
`validerPseudo` refuse `''`, `'   '`, dix-sept caractères et `'a\nb'`, accepte
`'Léo-7'` et `'Renard 14'` ; `validerCode` refuse `'12'`, `'12a4'`, `'12345'` ;
`messageErreur` couvre les six cas.

## Chantier D — Le point de déclenchement et l'état visible

**Ce qu'il fait.** Pose le bouton là où le PRD §7.4 le met — sur l'écran de
stats, *« au moment où il y a un vrai choix à faire, pas noyé dans un écran
d'accueil que personne ne lit »* — et montre l'état du classement en une ligne.

**Le conteneur.** `monterPerso` (PRP 05) ajoute, **après** le calendrier :

```js
const equipe = document.createElement('section');
equipe.className = 'bloc-equipe';
// Le PRP 09 posera podium, position et jauge ICI, au-dessus de l'appel suivant.
monterActionClassement(equipe, ctx);
```

C'est le seul point de contact entre cette branche et celle du PRP 09, et le
seul endroit où leurs diffs se croisent.

**Ce que `monterActionClassement` affiche.**

- Pas encore rejoint : un bouton `.bouton-principal` portant `TEXTE_REJOINDRE`
  (`Apparaître au classement`), qui pose `<a href="#/rejoindre">` — jamais un
  montage direct, la règle 2 du contrat d'écran du PRP 03 l'interdit.
- Rejoint : `Tu apparais sous le nom « Renard-14 ».`, la ligne d'état de
  synchronisation, et un lien `Gérer ce nom` vers `#/reglages`.
- Dans les deux cas, la ligne d'état.

**La ligne d'état — c'est elle qui tient le « et le dit » du PRD §11.**

```js
export const PHRASES_SYNCHRO = {
  'a-jour':     'Classement à jour.',
  'en-attente': 'Ta progression part dès que tu auras du réseau.',
  'hors-ligne': 'Pas de réseau.',
  'jamais':     'Classement jamais reçu. Reviens quand tu auras du réseau.',
  'echec':      'Le classement n’a pas répondu. Ça repartira tout seul.',
};

export function formaterFraicheur(recuA, maintenant)
// < 2 min      -> 'à l’instant'
// < 60 min     -> 'il y a 7 min'
// < 12 h       -> 'il y a 2 h'
// jour de la veille -> 'hier'
// au-dela      -> 'le lundi 3 août'   (dateEnToutesLettres, PRP 03)

export function etatSynchro(local, maintenant, enLigne)
// -> { statut, phrase, fraicheur }
// phrase = PHRASES_SYNCHRO[statut], suivie de `Dernière mise à jour ${fraicheur}.`
//          des que dernierRangConnu existe et que le statut n'est pas 'a-jour'.
```

Sans `dernierRangConnu`, `statut` vaut `'jamais'` : on n'affiche pas un
classement vide en le faisant passer pour un classement à zéro.

**La route.** `ECRANS` reçoit `{ nom: 'rejoindre', motif: /^#\/rejoindre$/,
monter: monterRejoindre }`, inséré avant l'entrée `jour` comme toutes les routes
spécifiques. **Aucune entrée dans `LIENS` :** un onglet permanent ferait du
consentement un écran d'accueil de plus, exactement ce que le PRD §7.4 refuse.

**Le service worker.** `COQUE` reçoit `/classement.js` et `/vue-rejoindre.js`.
`/api/` est déjà exclu du cache par le `fetch` du PRP 01 — **ne l'y remets
pas** : un rang resservi depuis le cache s'afficherait comme frais, et la
promesse du PRD §11 (« la dernière valeur connue **et le dit** ») serait rompue
sans le moindre symptôme.

**Le branchement.** `app.js`, dans `demarrer()`, appelle
`brancherSynchronisation(ctx)` **après** `rendre(hote, ctx)` et après
`enregistrerServiceWorker()`.

**Critère d'acceptation.** `tests/rejoindre.test.js` : `etatSynchro` rend
`'jamais'` sur `CLASSEMENT_VIDE`, `'hors-ligne'` avec `enLigne` faux et un
instantané présent, `'en-attente'` quand `envoiNecessaire` est vrai et le réseau
présent ; `formaterFraicheur` couvre les cinq paliers. `tests/vues.test.js` :
`choisirEcran('#/rejoindre')` rend l'entrée `rejoindre`, et `LIENS` ne la
contient pas. Dans un navigateur : le bouton apparaît sous le calendrier, la
zone de tap fait au moins 44 px, et rien ne bouge sur `#/perso` avant le premier
tap.

## Chantier E — La sortie

**Ce qu'il fait.** Rend le pseudonyme supprimable, comme le PRD §14 l'exige, et
dit exactement ce que la suppression efface et ce qu'elle laisse.

**Où.** Dans `#/reglages`, sous les gestes existants du PRP 03. C'est là que
vivent les actions destructrices, et c'est là qu'on les cherche. Le bloc est
monté par `monterSuppression(hote, ctx)`, exporté par `vue-rejoindre.js` et
appelé depuis `vue-reglages.js` — le code du classement reste dans un seul
module, et le diff sur l'écran des réglages tient en trois lignes.

**Ce qui est dit avant d'agir.**

```js
export const EXPLICATION_SUPPRESSION = 'Ton nom et ton score disparaissent du classement, pour tout le monde. Ta progression et tes séances cochées restent sur ton téléphone : tu ne perds rien de ce que tu as fait. Le nom redevient libre, et ce qui a déjà été vu par d’autres ne s’efface pas.';
export function phraseSuppression(pseudo)   // -> 'Supprimer « Renard-14 » du classement ?'
```

La dernière proposition n'est pas une précaution juridique : une page publique a
pu être lue, capturée, indexée. Promettre un effacement total serait faux, et le
PRD §5 construit tout le produit sur le fait que ce qui est publié est public.

**L'ordre des opérations, et il n'est pas négociable.**

1. `supprimer({ pseudo, code })` part au serveur.
2. `200` seulement : `effacerClassement()`.
3. Autre chose : rien n'est effacé localement, `messageErreur` s'affiche.

**La suppression est la seule opération qui ne se met jamais en attente.** Effacer
localement d'abord, en comptant sur une reprise, ferait perdre le code — donc le
seul moyen de retirer un nom qui, lui, resterait affiché. Hors ligne, le bouton
n'agit pas et dit `Il faut du réseau pour supprimer ton nom.`

**Changer de nom, c'est supprimer puis rejoindre.** Il n'y a pas de renommage :
un `POST` avec un nouveau pseudonyme créerait une seconde entrée et laisserait la
première orpheline. Le prix est le départage du PRD §9 (« le premier arrivé à ce
score »), qui repart de la date de la nouvelle inscription. C'est dit dans le
`README`, pas dans l'interface : la situation est rare, et un avertissement de
plus sur cet écran noierait celui qui compte.

**« Changer d'enfant » orpheline le pseudonyme.** `toutEffacer()` efface la clé
locale mais ne touche pas au serveur : le nom reste au classement et plus
personne ne détient le code. La confirmation du PRP 03 gagne donc une phrase,
et seulement lorsqu'un pseudonyme existe :

```js
export function avertissementChangementEnfant(pseudo)
// -> 'Ton nom au classement (« Renard-14 ») restera visible, et plus personne ne
//     pourra le supprimer. Supprime-le d’abord si tu ne veux pas le laisser.'
```

`vue-reglages.js` l'ajoute à `CONFIRMATION_CHANGEMENT` quand
`lireClassement().pseudo !== null`, et ne change rien sinon.

**Critère d'acceptation.** `tests/rejoindre.test.js` : `phraseSuppression` et
`avertissementChangementEnfant` contiennent le pseudonyme entre guillemets
français ; un `fetch` injecté qui rend `503` laisse `CLE_CLASSEMENT` présente ;
un `fetch` qui rend `200 { "supprime": true }` la fait disparaître. À la main,
en ligne : après suppression, `curl -s https://marcq-handball.apps.billbob.ovh/api/classement`
ne contient plus le pseudonyme et `participants` a diminué de un.

---

## Points d'attention

**Le prénom entre par la porte de `ctx`.** Le contexte du PRP 03 porte
`ctx.prenom`, et il est passé à `monterRejoindre` comme à tout écran. C'est le
seul chemin par lequel le prénom peut atteindre le réseau, et il ne sera jamais
emprunté par accident — il le sera par commodité, un jour où quelqu'un voudra
écrire « Salut Lucas » au-dessus du formulaire. Le test qui refuse la
sous-chaîne `prenom` dans les deux modules est là pour ce jour-là. Il lit aussi
les commentaires : c'est voulu, un mot entré par la porte du commentaire finit
dans une chaîne à la retouche suivante.

**`ecrireClassement` fusionne, et une seule ligne suffit à le défaire.** Écrire
`localStorage.setItem(CLE_CLASSEMENT, JSON.stringify({ dernierRangConnu }))`
quelque part — c'est plus court, et ça marche — supprime `code` sans aucun
symptôme. L'enfant ne s'en aperçoit qu'au moment où il veut retirer son nom, et
il est alors trop tard : le serveur exige un code que plus personne n'a.

**Un second téléphone écrase le score, il ne le fusionne pas.** Le même
pseudonyme et le même code saisis ailleurs, c'est exactement ce que le code sert
à permettre (PRD §7.4). Mais `POST` porte l'état complet : le téléphone qui
envoie en dernier gagne, et s'il a moins de cases cochées, le score baisse.
L'alternative — un serveur qui garde le maximum — casserait le
« le passé se corrige » du PRD §9, décocher n'ayant alors plus aucun effet. Le
comportement est donc assumé et documenté dans le `README`.

**Le `409` révèle qu'un pseudonyme existe.** C'est le seul moyen d'écrire un
message utilisable — « ce nom est déjà pris » — et l'information est déjà
publique dès que le porteur atteint le podium. C'est le PRP 07 qui décide si
l'énumération mérite un garde-fou de débit ; ce PRP n'ajoute aucune surface.

**L'empreinte dépend d'un détail de `etat.js`.** `empreinte` tient parce que
`cocher()` écrit `new Date().toISOString()` : le maximum augmente à chaque
cochage. Le jour où un rattrapage écrira la date de la séance plutôt que celle
du tap, cocher une séance ancienne ne changera plus ni le nombre ni le maximum
si un décochage l'accompagne, et l'envoi ne partira pas. Le couplage est réel ;
il est nommé ici pour qu'on le voie avant de changer `cocher`.

**Le test du consentement lit un fichier hors de l'application.** Si le PRD est
déplacé ou renommé, `tests/rejoindre.test.js` échoue. C'est le comportement
voulu : le texte est une décision produit, et le réparer consiste à corriger le
chemin — jamais à recopier le texte dans le test, ce qui reviendrait à ne plus
rien vérifier.

**Le PRD se contredit sur le caractère optionnel du code.** Le §7.4 le présente
comme une étape de l'inscription — *« il choisit aussi un code à 4 chiffres »* ;
le §11 parle du *« code à 4 chiffres optionnel du classement »*. Lecture retenue,
et c'est celle qui rend les deux phrases vraies : ce qui est optionnel, c'est le
classement — on traverse tout le produit sans jamais avoir de code. Une fois
qu'on rejoint, le code est exigé, faute de quoi le pseudonyme est écrasable par
n'importe qui et n'est supprimable par personne. Si cet arbitrage doit être
rediscuté, c'est une modification du PRD, pas de ce document.

**Le rate-limit du palier public s'applique à un enfant comme à un robot.**
50 req/s par IP, rafale 100 : une famille derrière un partage de connexion 4G
sort de la même IP. Le débit de `brancherSynchronisation` n'est pas une
politesse envers le serveur, c'est ce qui garantit qu'un enfant ne se fait pas
limiter au moment où il termine sa séance.

**Le code vit en clair dans `localStorage`.** Sur un téléphone partagé, un frère
peut supprimer le pseudonyme. C'est cohérent avec le PRD §14, qui assume déjà
qu'il n'y a ni compte ni sauvegarde ; le chiffrer demanderait un secret, que le
palier `public` interdit de faire descendre au navigateur (PRD §11).

**Rien ici ne lit `X-Forwarded-User`.** L'ossature §2 l'interdit et
`./init.sh --check` (`init.sh:1444-1452`) refuse la chaîne dans tout fichier
suivi de `apps/marcq-handball/` hors `.md`. L'identité, dans cette application,
est un pseudonyme choisi et un code à quatre chiffres — rien d'autre, à aucun
étage.

**Aucune animation n'appartient à ce PRP.** Le PRD §10 réserve le mouvement à
« grimper au classement », qui est du ressort du PRP 09. Un écran de
consentement qui s'anime demanderait d'attendre pour lire ce qu'il faut lire.

## Ce qui reste à trancher avant d'exécuter

| Question | Qui tranche | Effet si la réponse diffère |
|---|---|---|
| Les scores survivent-ils à un redéploiement (PRD §12.1) ? | L'exploitation du serveur | Bloque le PRP 07, donc celui-ci en entier. C'est le verrou en tête de document. |
| Le verbe de la suppression : `POST` + `supprimer: true`, ou `DELETE /api/classement` ? | PRP 07, propriétaire de l'API | Seule `corpsSuppression` et l'appel dans `supprimer` changent. L'interface, les effets locaux et l'ordre des opérations du chantier E sont identiques dans les deux cas. |
| `GET /api/classement` rend-il bien `parts` ? | PRP 07 | Sans cette liste anonyme, un enfant qui n'a pas rejoint ne peut pas voir sa position, et la dernière phrase du PRD §7.4 — *« Non merci est un choix complet »* — devient intenable. Il faudrait alors rouvrir le §7.4, pas contourner l'API. |
| Le dénominateur affiché à un non-participant : `participants` ou `participants + 1` ? | PRP 09 | Ce PRP fournit les deux nombres et ne tranche pas ; c'est une décision d'affichage, et le PRD §9 (« le dénominateur est honnête ») s'applique aux deux lectures. |

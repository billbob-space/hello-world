# PRP 10 — Le ressenti de fin de séance et la vue coach

> **Pour l'agent qui exécute :** applique ce PRP avec
> `superpowers:subagent-driven-development` ou `superpowers:executing-plans`.
>
> **Ossature :** `apps/marcq-handball/prp/00-ossature.md` — lu avant de commencer.
> **PRD :** `apps/marcq-handball/PRODUCT.md`

| | |
|---|---|
| **Lot** | 2 |
| **Branche** | `marcq-handball/ressenti-et-coach` |
| **Dépend de** | PRP 04 (`EVT_SEANCE_COMPLETE`), PRP 06 (`ouvrirPanneauDeFin`, `brancherRecompenses`, `mouvementReduit`), PRP 07 (`GET /api/coach`, le champ `ressentis` du `POST /api/classement`), PRP 08 (`web/classement.js`, `corpsEnvoi`, `envoiNecessaire`, `lireClassement`), PRP 03 (le contrat d'écran, `app.js`, `etat.js`, `dateEnToutesLettres`), PRP 05 (`.lu-seul`, `.barre`) |
| **Débloque** | rien |
| **Sections du PRD** | §7.3 (le ressenti), §7.6 (le coach), §13 (le mot de passe écarté), §15.3 (le verrou), §6 lot 2 items 10-11, et par ricochet §4 (les deux mesures que la page coach rend lisibles), §5, §10, §11 |

---

> ⛔ **Verrou** — ce PRP ne démarre pas avant que **le coach ait dit s'il
> regardera son écran**. Le PRD §15.3 le pose : *« Le lot 2 lui destine un
> écran. Savoir s'il compte le regarder décide s'il vaut le travail, et si le
> ressenti mérite d'exister. »* Il se tranche **auprès du coach, par le décideur
> du PRD** — une question, une réponse, aucun code. Tant qu'il tient, le travail
> en aval est spéculatif.
>
> **C'est le seul PRP dont la réponse au verrou peut être « on ne le fait
> pas ».** Un « non » ne réduit pas son périmètre : il le supprime en entier,
> les deux livrables ensemble. La vue coach n'a qu'un lecteur, et le ressenti
> n'a pratiquement pas d'autre consommateur — il ne produit aucun rang (PRD §9 :
> *« le volume est un récit, pas un rang »*, et le ressenti encore moins), il
> n'apparaît ni sur `#/perso` ni au calendrier (voir Périmètre), et sa seule
> restitution est la répartition de la page coach. Livrer le ressenti sans la
> page coach reviendrait à demander un tap de plus à un enfant pour que
> personne ne le lise.
>
> Le PRP 07 a déjà tranché sa moitié : `GET /api/coach` et le champ `ressentis`
> du `POST` sont construits **quoi qu'il arrive**, parce que rouvrir plus tard
> une route publique d'écriture coûte plus cher que quarante lignes. Un « non »
> du coach supprime **ce PRP**, pas ces quarante lignes. Le second verrou reste
> celui du PRP 07 : sans volume persistant (PRD §12.1), `/api/coach` répond
> `503` et la page n'a rien à montrer.

## Objectif

Un enfant dit en un tap, et seulement s'il en a envie, comment il a vécu sa
séance ; et le coach ouvre un lien qui lui dit dans quel état il récupère son
groupe, sans jamais lui apprendre un nom qu'il ne pourrait pas déjà lire.

## Ce qui est vérifiable à la fin

- `cd apps/marcq-handball && node --test tests/ressenti.test.js tests/coach.test.js`
  est vert, et `./apps/marcq-handball/test.sh` aussi.
- `./init.sh --check` est vert, dont la ligne
  `[marcq-handball] aucune lecture de X-Forwarded-User` : `ressenti.js` et
  `vue-coach.js` ne nomment cet en-tête ni dans le code, ni dans un commentaire.
- Un test lit les sources de `web/ressenti.js` et `web/vue-coach.js` et échoue si
  la sous-chaîne `prenom` y apparaît, commentaires compris — le même garde-fou
  que le PRP 08 pose sur `classement.js` et `vue-rejoindre.js`.
- Un test prouve que l'assertion du PRP 08 tient toujours : sans ressenti local,
  `Object.keys(corpsEnvoi({ pseudo, code, faits }))` vaut exactement
  `['pseudo', 'code', 'faits']`. Un second test prouve que la clé `ressentis`
  n'apparaît **que** lorsqu'il y a quelque chose à envoyer.
- `ressentisPourEnvoi(prog, { '2026-08-03': 'correct', '2026-08-04': 'dur',
  '2026-08-05': 'bof' })` rend `{ '2026-08-03': 'correct' }` : la date du 4 n'est
  pas une séance, `bof` n'est pas une valeur. C'est ce qui interdit qu'un
  ressenti déformé fasse répondre `400 ressentis-invalide` à **tous** les envois
  du classement.
- Dans un navigateur, sur `#/seance/2026-08-03` : la dernière case cochée ouvre
  le panneau du PRP 06, les trois émojis apparaissent **entre** les compteurs et
  le bouton `Continuer`, un tap sur l'un d'eux ferme le panneau, et
  `localStorage.getItem('marcq.v1.ressenti')` vaut
  `{"2026-08-03":"facile"}`. Fermer par `Continuer` n'écrit rien.
- `choisirEcran('#/coach').nom` vaut `coach`, et `LIENS` ne le contient pas.
- Dans un navigateur **où aucun prénom n'a jamais été saisi** (fenêtre privée),
  ouvrir `…/#/coach` affiche la page coach — pas l'écran de premier lancement.
- Serveur avec `MARCQ_DONNEES` non défini : `#/coach` affiche
  `Le classement n’est pas encore activé sur ce serveur.` et aucune exception
  n'apparaît dans la console.
- Réseau coupé : `#/coach` affiche `Pas de réseau.` et la page ne montre aucun
  chiffre périmé sans le dire.

## Périmètre

**Dedans :** la clé `marcq.v1.ressenti` dans `etat.js` ; le vocabulaire du
ressenti, son filtrage et son empreinte dans `web/ressenti.js` ; la ligne des
trois émojis à l'intérieur du panneau de fin de `web/recompenses.js` ; l'ajout du
champ `ressentis` au corps d'envoi de `web/classement.js` ; l'écran `#/coach`
dans `web/vue-coach.js` et son entrée dans `ECRANS` ; l'exception de prénom dans
`app.js` ; le style des deux blocs ; `tests/ressenti.test.js` et
`tests/coach.test.js` ; deux sections du `README.md`.

**Dehors, et pourquoi :**

- **`GET /api/coach` — PRP 07.** Ce PRP livre la page qui la lit, pas la route.
  Le calcul du rang, de l'assiduité et de l'agrégat des ressentis se fait côté
  serveur et ne se recalcule nulle part ici : *« un rang calculé par le client
  serait un rang déclaré par le client »* (ossature §2), et la page coach n'a
  aucune raison d'être la seule exception.
- **Le podium, la position et la jauge de `#/perso` — PRP 09.** La page coach
  affiche le **même** tableau de classement que les enfants, mais elle le monte
  chez elle : elle n'a ni `dernierRangConnu`, ni `EVT_CLASSEMENT`, ni pseudonyme
  local. Aucun fichier du PRP 09 n'est touché.
- **Le ressenti sur `#/perso` et dans le calendrier.** Décision, pas oubli :
  afficher une pastille d'humeur à côté d'une séance transformerait une réponse
  en note, sur l'écran que le PRD §7.5 fait exactement pour *« se lire sans se
  comparer »*. Le ressenti se dit une fois, il se lit agrégé, il ne se
  collectionne pas.
- **Le bilan du 22 août — PRP 11.** Il peut lire `marcq.v1.ressenti` s'il le
  veut ; ce PRP ne lui pose ni fonction ni classe.
- **Toute forme d'authentification sur la page coach — PRD §13.** Voir le
  chantier E : c'est une décision écrite, pas une limite constatée.

## Interfaces

**Consomme — exactement, sans rien redéfinir :**

```js
// web/vue-seance.js — PRP 04
EVT_SEANCE_COMPLETE                 // 'marcq:seance-complete', CustomEvent { date, total }

// web/recompenses.js — PRP 06. ouvrirPanneauDeFin est INTERNE au module :
// ce PRP l'edite sur place, il ne l'exporte pas.
mouvementReduit(fenetre = globalThis)          // -> boolean
TEXTE_FERMETURE                                // 'Continuer'
el(balise, classe, texte)                      // l'aide locale du module

// web/etat.js — PRP 03 et 08
PREFIXE_CLES                        // 'marcq.'  — toutEffacer() emporte deja marcq.v1.ressenti
lireClassement()                    // -> { pseudo, code, dernierEnvoi, dernierRangConnu }
ecrireClassement(partiel)           // FUSIONNE puis ecrit

// web/classement.js — PRP 08
CHEMIN_API                          // '/api/classement'
DELAI_MS                            // 8000
empreinte(faits)                    // -> '17:2026-08-10T18:22:11.000Z' | ''
corpsEnvoi({ pseudo, code, faits }) // ELARGI par ce PRP, voir Produit
envoiNecessaire(local, faits)       // ELARGI par ce PRP, voir Produit
synchroniser(ctx, options = {})     // c'est lui qui compose l'envoi

// web/vue-jour.js — PRP 03
dateEnToutesLettres(dateISO)        // '2026-08-03' -> 'lundi 3 août'

// web/app.js — PRP 03
ECRANS                              // [{ nom, motif, monter }] — le premier motif qui correspond gagne
choisirEcran(route)
```

```
Jetons et classes de web/style.css — PRP 03, 05, 06
  --marcq-encre --marcq-encre-douce --marcq-fond --marcq-carte --marcq-accent
  --marcq-sur-accent --marcq-danger --marcq-trait --marcq-tap (48px)
  .ecran  .titre-ecran  .titre-bloc  .aide  .barre  .compte  .bouton
  .bouton-principal  .panne  .lu-seul  .carte-fin  .fin-volume  .fin-fermer
```

**Consomme — du PRP 07, `GET /api/coach`, contrat exact.** L'API appartient au
PRP 07 (ossature §7) ; ce PRP la lit et n'en redéfinit pas un champ. Réponse
`200`, `Content-Type: application/json; charset=utf-8`, `Cache-Control:
no-store`, `X-App-Version` :

```json
{
  "jour": "2026-08-07",
  "programmees": 22,
  "participants": 9,
  "classement": [
    { "rang": 1, "cochees": 22, "part": 1,     "pseudo": "Renard" },
    { "rang": 2, "cochees": 20, "part": 0.909, "pseudo": "K7" },
    { "rang": 3, "cochees": 19, "part": 0.864, "pseudo": "Bibou" },
    { "rang": 4, "cochees": 19, "part": 0.864 }
  ],
  "groupe": { "cochees": 121, "programmees": 198, "part": 0.611 },
  "assiduite": { "aucune": 1, "faible": 2, "moyenne": 3, "forte": 3 },
  "seances": [
    {
      "date": "2026-08-03",
      "titre": "Endurance + Renforcement",
      "exercices": 8,
      "cochees": 61,
      "participantsActifs": 8,
      "participantsAyantFini": 6
    }
  ],
  "ressentis": { "facile": 4, "correct": 11, "dur": 6 }
}
```

Erreurs, enveloppe unique du PRP 07 —
`{ "erreur": "<code>", "message": "<phrase française>" }` — dont
`503 classement-indisponible` avec `Retry-After: 60` quand le magasin est absent
ou non inscriptible. `pseudo` n'est présent que sur les trois premières lignes :
la règle du PRD §9 est appliquée **par le serveur**, et c'est elle qui rend la
page coach incapable de nommer un quatrième même par bogue d'affichage.

**Consomme — du PRP 07, `POST /api/classement`, champ `ressentis`.** Facultatif.
Validation serveur : au plus une entrée par séance du programme, la clé doit être
une **date de séance**, la valeur ∈ `{facile, correct, dur}`. Hors de ces règles,
`400 ressentis-invalide` — et l'envoi entier est perdu, classement compris. C'est
la raison d'être de `ressentisPourEnvoi` au chantier A.

```json
{ "pseudo": "Renard", "code": "4821", "faits": ["s1-c1"],
  "ressentis": { "2026-08-03": "correct", "2026-08-05": "dur" } }
```

**Produit :**

```js
// web/etat.js — complete
export const CLE_RESSENTI = 'marcq.v1.ressenti';
export function lireRessentis()                  // -> { [dateSeanceISO]: string }, {} si illisible
export function ecrireRessenti(dateISO, valeur)  // -> les ressentis A JOUR
export function effacerRessenti(dateISO)         // -> les ressentis A JOUR
```

```js
// web/ressenti.js — le vocabulaire, le filtrage, l'empreinte, la ligne d'emojis
export const RESSENTIS;             // les trois choix, dans l'ordre d'affichage
export const CLES_RESSENTI;         // ['facile', 'correct', 'dur']
export const QUESTION_RESSENTI = 'C’était comment ?';
export const AIDE_RESSENTI = 'Tu peux fermer sans répondre.';
export function estRessentiValide(valeur)             // -> boolean
export function ressentisPourEnvoi(prog, ressentis)   // -> { [dateSeance]: cle } filtre
export function empreinteRessentis(ressentis)         // -> '2026-08-03=correct', '' si vide
export function monterRessenti(hote, dateISO, { lire, ecrire, surChoix })  // -> le <fieldset> pose
// lire et ecrire sont FOURNIS par l'appelant, jamais importes ici : c'est ce qui
// laisse `ressenti.js` sans aucune dependance au stockage — voir chantier A.
```

```js
// web/classement.js — deux signatures elargies, aucun nom nouveau
export function corpsEnvoi({ pseudo, code, faits, ressentis })
// -> { pseudo, code, faits: [ids tries] }                        si ressentis est vide
// -> { pseudo, code, faits: [ids tries], ressentis }             sinon
export function envoiNecessaire(local, faits, ressentis = {})
// dernierEnvoi = { at, empreinte, empreinteRessentis }
```

```js
// web/vue-coach.js — l'ecran #/coach
export const ROUTE_COACH = '#/coach';
export const MOTIF_COACH = /^#\/coach$/;
export const CHEMIN_COACH = '/api/coach';
export const TITRE_COACH = 'État du groupe';
export const MENTION_PUBLIQUE;      // PRD §13, affichee en clair sur la page
export const SEUILS_ASSIDUITE;      // les quatre paliers du PRP 07, libelles
export const PHRASES_COACH;         // { 'hors-ligne', 'indisponible', 'echec', 'vide' }
export function libelleAssiduite(cle)                 // -> string
export function heureDuReleve(instant)                // Date -> '19 h 04', fuseau Europe/Paris
export function messageCoach(statut, erreur)          // -> phrase francaise, ton neutre
export function modeleCoach(reponse)                  // -> ModeleCoach — PUR
export async function releverCoach(options = {})      // -> { ok: true, coach } | { ok: false, statut, erreur }
export function monterCoach(hote, ctx)                // l'ecran, au contrat du PRP 03
```

```js
// ModeleCoach — tout ce que le montage doit savoir, et rien de plus
{
  entete:   { jour, jourLisible, participants, programmees, phrase },
  groupe:   { cochees, programmees, part, pourcent, phrase },
  assiduite: [{ cle, libelle, aide, nombre, part }],          // les quatre paliers, toujours
  classement: [{ rang, pseudo, etiquette, cochees, part, pourcent, nomme }],
  seances:  [{ date, dateLisible, titre, exercices, cochees, actifs, finis }],
  ressentis: { total, lignes: [{ cle, libelle, emoji, nombre, part, pourcent }], vide },
}
```

**Les noms introduits ici, absents de l'ossature et des PRP amont :**

| Nom | Ce que c'est, et pourquoi |
|---|---|
| `web/ressenti.js` | Le vocabulaire du ressenti et sa ligne d'émojis, dans un module à part, **sans aucun import** hors de lui-même. Ni `etat.js` (qui ne connaît aucun vocabulaire métier, `lireFaits` en est le précédent), ni `recompenses.js` (qui appartient au PRP 06 et n'a pas à porter une règle du lot 2), ni `classement.js` (qui décide *quand* on envoie, pas *ce que* le ressenti est). |
| `RESSENTIS`, `CLES_RESSENTI` | Les trois choix, une seule fois. `CLES_RESSENTI` est dérivé de `RESSENTIS`, jamais recopié : deux listes divergeraient au premier changement d'émoji. |
| `ressentisPourEnvoi` | Le filtre qui garantit au serveur ce qu'il accepte. Il existe parce que le PRP 07 refuse `ressentis` **en bloc** : une entrée déformée ferait échouer aussi le classement de l'envoi. |
| `empreinteRessentis` | Le pendant de `empreinte` (PRP 08) pour la seconde moitié du corps. Même principe : pas de hachage, une chaîne qui change dès que quelque chose change. |
| `dernierEnvoi.empreinteRessentis` | Un troisième champ dans un objet dont le PRP 08 a écrit *« l'ossature nomme la clé, pas sa forme »*. La clé `marcq.v1.classement` ne bouge pas, son schéma s'étend. |
| `web/vue-coach.js`, route `#/coach` | Un écran de plus dans `ECRANS`, pas un fichier HTML de plus. Un `coach.html` demanderait une route au serveur Go et un ajout à la liste de l'ossature §7 ; `#/coach` est servi par `GET /vue-*.js`, déjà là, et ne coûte pas une ligne de Go. |
| `sansPrenom: true` sur une entrée d'`ECRANS` | L'exception minimale au verrou de prénom de `app.js`. Voir le chantier D : sans elle, le coach tombe sur l'écran de premier lancement d'un enfant. |
| `MENTION_PUBLIQUE` | La phrase qui dit au coach que sa page est publique. Le PRD §13 écarte le mot de passe ; ne rien dire laisserait croire à une protection, ce qui est exactement le reproche fait au mot de passe. |
| `messageCoach`, `PHRASES_COACH` | Les phrases de la page coach. Elles ne réutilisent pas `messageErreur` du PRP 08 : celles-là tutoient un enfant (« Réessaie quand tu en auras »), et il n'y a personne à tutoyer ici. |
| `heureDuReleve` | L'heure du relevé, en clair. Elle ne réutilise pas `formaterFraicheur` (PRP 08) pour deux raisons : cette fonction rend une fraîcheur relative — « à l'instant », « hier » — quand la page coach affiche l'heure d'un relevé qu'elle vient de faire ; et l'importer entraînerait `vue-rejoindre.js`, donc `etat.js`, dans un écran dont la garantie est justement de ne rien lire du téléphone (chantier E). Le fuseau est `Europe/Paris`, celui du club, comme partout ailleurs (ossature §5). |
| `tests/ressenti.test.js`, `tests/coach.test.js` | Deux fichiers, comme `seance.test.js` et `perso.test.js` : deux branches qui écrivent chacune dans son fichier fusionnent sans conflit. |

## Fichiers

- **Créer :** `apps/marcq-handball/web/ressenti.js`,
  `apps/marcq-handball/web/vue-coach.js`,
  `apps/marcq-handball/tests/ressenti.test.js`,
  `apps/marcq-handball/tests/coach.test.js`
- **Modifier :** `apps/marcq-handball/web/etat.js` (la cinquième clé),
  `apps/marcq-handball/web/recompenses.js` (la ligne dans `ouvrirPanneauDeFin`),
  `apps/marcq-handball/web/classement.js` (`corpsEnvoi`, `envoiNecessaire`,
  `synchroniser`), `apps/marcq-handball/web/app.js` (l'entrée `coach`,
  l'exception de prénom), `apps/marcq-handball/web/sw.js` (deux lignes de coque),
  `apps/marcq-handball/web/style.css`,
  `apps/marcq-handball/tests/etat.test.js`,
  `apps/marcq-handball/tests/classement.test.js`,
  `apps/marcq-handball/tests/vues.test.js` (une assertion sur `#/coach`),
  `apps/marcq-handball/README.md`
- **Tester :** `apps/marcq-handball/test.sh` — **inchangé**. Il lance déjà
  `node --test tests/*.test.js` ; les deux fichiers ajoutés y entrent sans qu'une
  ligne bouge.

---

# Ce qu'il faut construire

## Chantier A — La clé du ressenti, son vocabulaire et ce qui a le droit de partir

**Ce qu'il fait.** Il pose la cinquième clé de l'ossature §6 et le module qui sait
ce qu'un ressenti est. Aucun DOM, aucun réseau : c'est la moitié du PRP qui se
prouve entièrement par `node --test`.

**Le stockage** (`etat.js`), décalqué de `lireFaits` / `cocher` / `decocher` :

```js
export const CLE_RESSENTI = 'marcq.v1.ressenti';

// -> { [dateSeanceISO]: string }. Stockage vide, refuse ou illisible : {}.
// Les couples mal formes sont ignores, les autres survivent — la meme regle que
// lireFaits, et pour la meme raison : un schema etranger ne doit pas emporter
// les reponses valides qui l'accompagnent.
export function lireRessentis()

// Ecrit et rend les ressentis a jour. La valeur REMPLACE celle du jour, la ou
// `cocher` refuse de rajeunir une marque : un horodatage departage un
// classement (PRD §9), une reponse est juste la derniere donnee.
export function ecrireRessenti(dateISO, valeur)
export function effacerRessenti(dateISO)
```

**`etat.js` ne connaît pas le vocabulaire.** Il n'accepte qu'une chaîne non vide,
exactement comme pour les horodatages de `faits`. Les trois valeurs admises
vivent dans `ressenti.js`, et c'est `ressentisPourEnvoi` qui garantit au serveur
ce qu'il accepte.

**Et `ressenti.js` n'importe pas `etat.js` non plus** — c'est la décision de
découpage la plus rentable de ce PRP, et elle se prend ici. `monterRessenti`
reçoit `lire` et `ecrire` de son appelant (`recompenses.js`, chantier B) au lieu
de les importer. Trois conséquences : le module se teste sans le double de
`localStorage` ; il ne peut structurellement pas lire une autre clé que celle
qu'on lui tend ; et `vue-coach.js` peut lui emprunter `RESSENTIS` — les mêmes
émojis, les mêmes libellés — **sans emporter le moindre accès au stockage**, ce
qui est exactement la garantie que le chantier E met sous test. C'est
`classement.js`, qui importe déjà `etat.js`, qui appelle `lireRessentis()`.

**`toutEffacer()` n'a pas une ligne à changer.** Il énumère `marcq.` (PRP 03) :
« changer d'enfant » emporte déjà le ressenti. Une assertion l'épingle dans
`tests/etat.test.js`, à côté de celle qui existe pour `marcq.v1.classement`.

**Le vocabulaire** (`ressenti.js`) :

```js
// Trois choix, dans l'ordre d'affichage, du plus leger au plus dur (PRD §7.3).
// L'emoji est une donnee et non un `content:` CSS : il doit pouvoir porter
// `aria-hidden`, et un lecteur d'ecran doit annoncer « Facile », pas
// « visage legerement souriant ».
export const RESSENTIS = [
  { cle: 'facile',  emoji: '🙂', libelle: 'Facile' },
  { cle: 'correct', emoji: '😐', libelle: 'Correct' },
  { cle: 'dur',     emoji: '🥵', libelle: 'Dur' },
];
export const CLES_RESSENTI = RESSENTIS.map((r) => r.cle);
export const QUESTION_RESSENTI = 'C’était comment ?';
export const AIDE_RESSENTI = 'Tu peux fermer sans répondre.';

export function estRessentiValide(valeur)   // -> CLES_RESSENTI.includes(valeur)

// Ne garde que ce que le PRP 07 accepte : une cle qui est une date de seance du
// programme, une valeur des trois. Le serveur refuse `ressentis` EN BLOC — une
// entree deformee ferait repondre 400 a tout l'envoi, classement compris.
export function ressentisPourEnvoi(prog, ressentis)

// Le pendant de `empreinte` (PRP 08) : pas de hachage, une chaine qui change des
// que quelque chose change. Les entrees sont triees par date, deux objets de
// memes couples rendent donc la meme chaine quel que soit l'ordre d'insertion.
// -> '2026-08-03=correct,2026-08-05=dur' ; '' si vide.
export function empreinteRessentis(ressentis)
```

**Les trois valeurs sont celles du serveur, au caractère près.** `facile`,
`correct`, `dur` : le PRP 07 les valide en dur. Un test les compare à la liste
écrite dans ce document et dans le PRD §7.3 — les renommer côté client ferait
répondre `400` à chaque envoi d'un enfant qui a répondu, sans qu'aucun test de
comportement ne tombe.

**Un ressenti pour une séance à venir n'est pas filtré.** Il ne peut pas arriver
par le produit — l'avenir ne se coche pas (PRD §9), donc aucune séance future ne
se complète — et le PRP 07 l'accepte : une clé de séance suffit. Le filtrer
demanderait une horloge dans un module pur, pour un cas qu'une horloge de
téléphone avancée est seule à produire, et qui ne rapporte aucun point.

**Règles du PRD appliquées.** §7.3 (trois émojis, facile / correct / dur) ;
ossature §6 (`marcq.v1.ressenti`, clé = date de séance, valeur = le ressenti) ;
ossature §6 encore (un stockage refusé ne casse jamais l'app).

**Critère d'acceptation.** `tests/ressenti.test.js`, sur le double de
`localStorage` du PRP 03 : `lireRessentis()` rend `{}` sur une clé absente et sur
`{{` ; `ecrireRessenti('2026-08-03', 'dur')` écrit exactement
`{"2026-08-03":"dur"}` sous `marcq.v1.ressenti` ; une seconde écriture sur la
même date remplace ; `effacerRessenti` retire la clé ; `ressentisPourEnvoi` rend
l'exemple de la section « Ce qui est vérifiable » ; `empreinteRessentis({})` vaut
`''` et deux objets d'ordre d'insertion différent rendent la même chaîne.
`tests/etat.test.js` gagne l'assertion `toutEffacer()` emporte `CLE_RESSENTI`.

---

## Chantier B — Trois émojis dans le panneau de fin, jamais un péage

**Ce qu'il fait.** Il pose la question à l'endroit exact que le PRP 06 lui a
réservé, et nulle part ailleurs.

**Où, et pas ailleurs.** Le PRP 06 l'écrit sans ambiguïté : *« Le PRP 10 doit
poser ses trois émojis dans `ouvrirPanneauDeFin`, entre les compteurs et le
bouton — pas ouvrir un second `<dialog>`. Deux panneaux modaux ouverts sur le
même événement, c'est un panneau invisible et un enfant coincé. »* Une seule
ligne s'ajoute donc à `ouvrirPanneauDeFin`, après `carte.append(liste)` et avant
la création du bouton :

```js
monterRessenti(carte, dateISO, {
  lire: lireRessentis, ecrire: ecrireRessenti, surChoix: () => panneau.close(),
});
```

`recompenses.js` importe déjà `lireFaits` de `etat.js` : les deux accès au
stockage s'ajoutent à la même ligne d'import, et c'est ce module — qui connaît
déjà le téléphone — qui les fournit, jamais `ressenti.js`.

Le point d'accroche reste `EVT_SEANCE_COMPLETE` (PRP 04), consommé par
`brancherRecompenses` (PRP 06). Ce PRP n'écoute rien lui-même : un second
écouteur sur le même événement rouvrirait la course que le PRP 06 a déjà tranchée.

**Ce que ça garantit, et c'est le PRD §7.3 et §10 littéralement.** Le panneau
n'existe qu'après la validation de la séance ; le ressenti est donc *« proposé
après la validation, jamais avant »*, et l'animation reste *« une récompense,
jamais un péage »* — la question arrive dans un écran qui célèbre, pas dans un
écran qui retient.

**L'interface :**

```js
export function monterRessenti(hote, dateISO, { lire, ecrire, surChoix })
// lire()          -> { [dateISO]: cle }        fourni par l'appelant
// ecrire(d, cle)  -> les ressentis a jour      fourni par l'appelant
// surChoix()      appele apres l'ecriture, jamais avant
// Pose un <fieldset class="ressenti"> : une <legend> QUESTION_RESSENTI, trois
// <button type="button" class="choix-ressenti" data-ressenti="<cle>">, puis
// AIDE_RESSENTI dans un <p class="aide">. Rend le <fieldset>.
```

- **Un seul tap.** Le tap écrit par `ecrire(dateISO, cle)` puis appelle
  `surChoix()`, qui ferme le panneau. Fermer immédiatement est sûr : le
  `fermer()` du PRP 06 pose la valeur finale des compteurs avant de retirer le
  panneau, un roulement interrompu ne laisse donc jamais un nombre faux.
- **Jamais obligatoire.** `Continuer` (`TEXTE_FERMETURE`), le fond du `<dialog>`
  et la touche Échap ferment sans rien écrire — les trois sorties que le PRP 06 a
  déjà branchées. `AIDE_RESSENTI` le dit en toutes lettres, parce qu'un enfant
  devant trois boutons ne devine pas qu'il peut ne pas répondre.
- **`Continuer` garde le focus initial.** Il porte `autofocus`. Sans cela,
  `showModal()` donne le focus au premier élément focalisable — un émoji — et une
  touche Entrée machinale enregistrerait « Facile ». Un tap doit être un choix,
  pas un réflexe.
- **Chaque bouton porte son mot.** L'émoji est dans un `<span aria-hidden="true">`,
  le libellé (`Facile`, `Correct`, `Dur`) est du texte visible sous l'émoji. Trois
  émojis nus se lisent différemment d'un téléphone à l'autre, et un lecteur
  d'écran en dirait le nom Unicode.
- **Une réponse déjà donnée se voit.** Si `lire()[dateISO]` existe — la séance a
  été décochée puis recochée — le bouton correspondant porte
  `aria-pressed="true"` et la classe `.choisi`. Taper un autre bouton remplace.
- **Zone de tap ≥ 48 px** (`--marcq-tap`), les trois boutons sur une rangée qui
  se replie sous 320 px. Ossature §9.
- **Aucune animation.** Le bloc `prefers-reduced-motion` universel du PRP 06 la
  couvrirait de toute façon ; il n'y a rien à couvrir. Le PRD §10 réserve le
  mouvement à ce qui récompense, et une question n'est pas une récompense.

**Ce qu'on n'ajoute pas :** pas de « merci ! », pas de confirmation, pas de
quatrième choix « je ne sais pas ». Fermer *est* le quatrième choix, et il ne
coûte pas un tap de plus.

**Critère d'acceptation.** `tests/ressenti.test.js` : `monterRessenti` appelé
avec un `hote` factice minimal — un objet portant `append` — et des `lire` /
`ecrire` injectés écrit la bonne clé au bon appel et déclenche `surChoix` une
fois ; un test de source vérifie que `recompenses.js` appelle `monterRessenti`
**entre** `carte.append(liste)` et la création du bouton de fermeture (comparaison
d'index, comme le PRP 03 le fait pour `confirm` avant `toutEffacer`), et que
`web/ressenti.js` ne contient ni `innerHTML`, ni `confirm(`, ni la sous-chaîne
`prenom`. À la main, dans un navigateur : les six points de la section « Ce qui
est vérifiable à la fin » qui parlent du panneau.

---

## Chantier C — Ce qui part vers le serveur, et ce qui reste sur le téléphone

**Ce qu'il fait.** Il ajoute le ressenti au corps d'envoi du PRP 08 — pour ceux
qui ont rejoint le classement, et pour eux seuls.

**Le principe, énoncé par le PRD §5 et par rien d'autre.** *« Aucune donnée
nominative de mineur ne quitte le téléphone sans un acte volontaire, précédé d'un
message de consentement. »* Un ressenti n'est rattachable qu'à un pseudonyme
choisi après l'écran de consentement du §7.4 : il n'est nominatif ni par lui-même
— trois valeurs closes — ni par ce qu'il accompagne. Il part donc **par le même
canal, sous la même autorisation, et jamais séparément**.

**Celui qui n'a pas rejoint garde son ressenti, et l'app ne lui reproche rien.**
`lireClassement().pseudo === null` : `synchroniser` fait un `GET`, aucun corps ne
part, le ressenti reste dans `marcq.v1.ressenti` et n'est lu par personne. Le
panneau de fin pose la question **de la même façon aux deux** : aucune phrase du
type « rejoins le classement pour partager ton ressenti », aucun bouton grisé,
aucune mention du classement. Le PRD §7.4 est explicite — *« Non merci est un
choix complet, pas une punition »* — et transformer le ressenti en levier
d'inscription serait exactement la punition.

**Les deux signatures élargies, dans `web/classement.js` :**

```js
export function corpsEnvoi({ pseudo, code, faits, ressentis })
// -> { pseudo, code, faits: [ids tries] }             quand ressentis est vide
// -> { pseudo, code, faits: [ids tries], ressentis }  sinon
```

**La clé n'apparaît que lorsqu'il y a quelque chose à dire.** Le PRP 07 la déclare
facultative ; envoyer `"ressentis": {}` passerait aussi. L'omettre garde le corps
**identique** à celui du PRP 08 pour un enfant qui n'a jamais répondu — donc
l'assertion du PRP 08, *« `Object.keys(corps)` vaut exactement `['pseudo',
'code', 'faits']` »*, reste vraie et n'est **pas modifiée**. Elle est la garantie
que le prénom ne part pas ; la relâcher pour ajouter un champ aurait été le prix
le plus mal payé de ce PRP. Un second test l'accompagne pour le cas non vide.

```js
export function envoiNecessaire(local, faits, ressentis = {})
// -> local.pseudo !== null
//    && (   empreinte(faits) !== (local.dernierEnvoi?.empreinte ?? '')
//        || empreinteRessentis(ressentis) !== (local.dernierEnvoi?.empreinteRessentis ?? ''))
```

**Pourquoi le ressenti doit déclencher un envoi, et non attendre le suivant.** Le
PRP 08 pose le principe : *« un envoi est dû dès que l'état local diffère de la
dernière confirmation »*. Ce PRP ne fait qu'élargir « l'état local » à ce que le
corps transporte désormais. Sans cela, le ressenti tapé le lundi soir ne
partirait qu'au prochain cochage — mercredi —, et la répartition de la page coach
aurait un jour de retard permanent, c'est-à-dire serait vide le soir où le coach
regarde. Le troisième argument a une valeur par défaut : les appels à deux
arguments des tests du PRP 08 continuent de passer sans retouche.

**Dans `synchroniser`, l'ordre est imposé :**

1. `const ressentis = ressentisPourEnvoi(ctx.prog, lireRessentis());` — le filtre
   d'abord, comme `lireFaits()` est relu et non pris dans `ctx` (PRP 08 : le
   contexte est un instantané du dernier rendu).
2. `envoiNecessaire(local, faits, ressentis)` décide `GET` ou `POST`.
3. `corpsEnvoi({ pseudo, code, faits, ressentis })`.
4. Sur `200` **ou `201`** : `dernierEnvoi = { at: recuA, empreinte: empreinte(faits),
   empreinteRessentis: empreinteRessentis(ressentis) }`.
   Les deux codes, sans exception. Le PRP 07 rend `201` à la création du
   pseudonyme et `200` à chaque mise à jour : le `201` est donc exactement le
   **premier** envoi d'un enfant qui vient de rejoindre. Ne l'écrire que sur
   `200` laisserait `dernierEnvoi` vide à ce moment-là, `envoiNecessaire`
   resterait vrai, et chaque déclencheur re-posterait le même corps
   indéfiniment. Le PRP 08 le dit déjà — « un `fetch` qui rend `201` est traité
   comme un `200` » — et c'est lui qui fait foi sur `synchroniser`.

**L'empreinte est celle de la carte *filtrée*, pas de la carte lue.** Une entrée
écartée par le filtre — une date qui n'est plus une séance après une mise à jour
de `programme.json` — resterait sinon éternellement absente de la confirmation,
et chaque déclencheur relancerait un envoi identique jusqu'à la fin du programme.

**Un `dernierEnvoi` écrit avant ce PRP n'a pas de `empreinteRessentis`.** Le
`?? ''` le traite comme « rien n'a jamais été envoyé », ce qui provoque un envoi
de plus au premier déclencheur pour les enfants qui avaient déjà répondu. C'est
correct et ça se produit une fois.

**Ni le prénom, ni un identifiant client.** `ressenti.js` et `classement.js`
n'importent jamais `lirePrenom` (PRP 07, chantier 5, point 6) ; le corps garde
exactement quatre champs, et `DisallowUnknownFields` refuse tout le reste. Le
ressenti n'ajoute aucune surface : il ajoute une valeur dans un champ que le
serveur connaissait déjà.

**Critère d'acceptation.** `tests/classement.test.js` : `corpsEnvoi` sans
ressenti rend trois clés, avec ressenti en rend quatre et la quatrième est la
carte filtrée ; `envoiNecessaire` est faux juste après un envoi confirmé, vrai
après un ressenti nouveau **sans qu'aucune case n'ait bougé**, et vrai après un
ressenti **changé** sur une date déjà envoyée ; un `fetch` injecté rendant `503`
laisse `dernierEnvoi` inchangé, `empreinteRessentis` comprise.

---

## Chantier D — La page coach

**Ce qu'il fait.** Il livre `#/coach` : un lien à envoyer au coach, qui affiche
`GET /api/coach` et rien d'autre.

**La route, et son exception.** `ECRANS` reçoit
`{ nom: 'coach', motif: MOTIF_COACH, monter: monterCoach, sansPrenom: true }`,
inséré **avant** l'entrée `jour` comme toute route spécifique. **Aucune entrée
dans `LIENS` :** un onglet permanent mettrait la vue du coach dans la barre de
navigation des enfants, ce qui n'a aucun sens et ferait de la comparaison un
écran de plus.

`rendre()` (PRP 03) refuse aujourd'hui toute route tant que `ctx.prenom === null`.
La règle protège l'entrée de l'enfant : *« un lien partagé vers `#/reglages` ne
doit pas court-circuiter l'accueil »*. Le coach, lui, n'a pas de prénom à saisir
et n'en aura jamais — il tomberait sur l'écran de premier lancement d'un enfant,
et le seul chemin serait d'inventer un prénom. Trois lignes changent :

```js
const ecran = choisirEcran(ctx.route);
if (ctx.prenom === null && ecran?.sansPrenom !== true) { …monterPrenom… }
```

`choisirEcran` remonte donc **avant** le verrou de prénom. L'exception est portée
par une donnée de l'entrée d'écran, pas par une comparaison de chaîne dans
`rendre()` : le jour où un second écran la mérite, il pose son drapeau, et le
routeur ne bouge pas. Elle reste sûre parce que `monterCoach` ne lit **rien** du
stockage local : ni prénom, ni faits, ni classement — la barre de navigation
reste masquée (`nav.hidden = ctx.prenom === null`) et le coach ne voit aucun
onglet vers l'application d'un enfant.

**Le relevé.**

```js
export async function releverCoach(options = {})
// options : { fetch = globalThis.fetch, delaiMs = DELAI_MS }
// GET CHEMIN_COACH, cache: 'no-store', signal: AbortSignal.timeout(delaiMs)
// -> { ok: true, coach }  |  { ok: false, statut, erreur }
// Jamais de promesse rejetee, statut 0 = pas de reseau ou delai depasse.
// L'enveloppe d'erreur n'est decodee que si le Content-Type est application/json
// (PRP 07 : le 405 de http.ServeMux repond en texte brut).
```

Aucun paramètre d'URL, aucun en-tête, aucun cookie — la même règle qu'au PRP 08.
**Aucun rafraîchissement automatique** : un bouton `Actualiser`, et rien d'autre.
Une main est son propre garde-fou de débit, et une page laissée ouverte sur un
onglet ne doit pas marteler une route publique.

**Le modèle**, pur, testable sans navigateur ni réseau — la coupure des PRP 04 et
05, pour la même raison : tout ce qui décide y est.

```js
export function modeleCoach(reponse)   // -> ModeleCoach, forme donnee en Interfaces
```

Ce qu'il met en forme, section par section, et la règle du PRD que chacune sert :

| Section | Contenu | Règle |
|---|---|---|
| En-tête | `jour` en toutes lettres, `participants` participants, `programmees` exercices programmés à ce jour | PRD §9 : *« le dénominateur est honnête »* — c'est le nombre de participants au classement, jamais un effectif d'équipe, et la phrase le dit |
| Le groupe | `groupe.part` en pourcentage, avec `<progress class="barre">` et `cochees / programmees` | PRD §7.5 : *« une jauge collective, la seule mesure où personne n'est dernier »* |
| L'assiduité | les quatre paliers du PRP 07, **toujours les quatre**, même à zéro | PRD §4, première mesure. Le palier `forte` est libellé `60 % et plus — la cible`, pour que le coach lise sa cible sans la recalculer. Masquer un palier vide masquerait précisément `aucune`, la seule ligne qui demande une action |
| Le classement | le tableau tel qu'il arrive : `pseudo` sur les trois premiers, `Rang 4`, `Rang 5`… ensuite | PRD §9 : *« le podium nomme trois personnes, la position en nomme zéro »*. Le modèle ne fabrique jamais un nom absent — `nomme: false` et `etiquette: 'Rang 4'` |
| Les séances | une ligne par séance déjà programmée : titre, `cochees` sur `exercices × participants`, `participantsActifs`, `participantsAyantFini` | PRD §4, deuxième mesure — *« part de l'effectif encore active à la séance du 17 août »* — qui se lit sur la **dernière ligne**. Aucune date n'est écrite en dur : `programme.json` est éditable (PRD §8), et une date figée dans le code mentirait dès qu'une séance s'ajoute |
| Les ressentis | les trois nombres, leur part du total des réponses, avec les émojis et libellés de `RESSENTIS` | PRD §7.6 : *« répartition des ressentis »*. `total === 0` ⇒ `vide` porte `Aucun ressenti reçu pour l’instant.` — on ne dessine pas une répartition de rien |

**Aucun taux de réponse n'est affiché.** `/api/coach` ne rend pas le nombre de
séances terminées ; « 21 réponses » sur un dénominateur inconnu se lirait comme
un taux, et serait faux. La page affiche des nombres et une répartition entre
eux, jamais une proportion de participants.

**Les états dégradés, tous nommés :**

```js
export const PHRASES_COACH = {
  'hors-ligne':   'Pas de réseau. Cette page a besoin d’une connexion.',
  'indisponible': 'Le classement n’est pas encore activé sur ce serveur.',
  'echec':        'Le serveur n’a pas répondu.',
  'vide':         'Personne n’a encore rejoint le classement.',
};
export function messageCoach(statut, erreur)
// statut 0                        -> 'hors-ligne'
// 503 classement-indisponible     -> 'indisponible'
// tout autre statut               -> 'echec'
```

- **`503 classement-indisponible` est l'état par défaut du serveur tant que le
  verrou du PRP 07 tient** (`MARCQ_DONNEES` vide). La page doit donc le dire
  correctement dès son premier jour en ligne, pas le traiter comme une panne.
- **`participants === 0` n'est pas une erreur.** La réponse est valide, la page
  affiche `PHRASES_COACH.vide` à la place du classement et garde l'en-tête.
- **Pas de valeur mise en cache.** Contrairement au classement de l'enfant (PRD
  §11 : *« il affiche la dernière valeur connue et le dit »*), la page coach
  n'écrit rien dans `localStorage` — elle n'a pas d'enfant à qui appartenir, et
  un chiffre d'hier présenté au coach le 21 août est pire qu'une page qui dit
  qu'elle n'a pas pu se rafraîchir. Elle affiche `Relevé à 19 h 04`
  (`heureDuReleve`) et rien de périmé.

**Le service worker, et pas une ligne de Go.** `COQUE` reçoit `/vue-coach.js` et
`/ressenti.js`. Aucune route HTTP n'est ajoutée : le serveur sert tout `web/` à la
racine depuis `//go:embed web` (PRP 03), et ajouter un module ne lui demande rien.
`/api/` reste exclu du cache par le `fetch` du PRP 01 — **ne l'y remets pas** : un
état de groupe resservi depuis le cache s'afficherait comme frais.

**Ton et mouvement.** Aucun tutoiement — le PRD §10 fixe le ton pour des joueurs
de 13-14 ans, il n'y a personne à tutoyer ici. Aucune animation : *« le
changement de position est animé »* (§10) concerne l'enfant qui grimpe, pas un
tableau lu une fois. Mobile d'abord quand même : le coach lit sur son téléphone
comme tout le monde, les tableaux se replient en listes sous 480 px.

**Critère d'acceptation.** `tests/coach.test.js` : `modeleCoach` sur la réponse
d'exemple de la section Interfaces rend quatre paliers d'assiduité, un classement
dont seules les trois premières lignes portent `nomme: true`, une ligne de séance
par entrée reçue, et une répartition de ressentis dont les parts somment à 1 ;
`modeleCoach` avec `participants: 0` rend `ressentis.vide` non nul et un
classement vide sans lever ; `messageCoach` couvre les trois cas ; `releverCoach`
avec un `fetch` injecté qui rejette rend `{ ok: false, statut: 0 }` sans jeter, et
avec un `503` portant l'enveloppe JSON rend `erreur: 'classement-indisponible'`.
`tests/vues.test.js` : `choisirEcran('#/coach').nom` vaut `coach` et
`choisirEcran('#/coach/')` vaut `null`. À la main : les trois contrôles de
navigateur de la section « Ce qui est vérifiable à la fin ».

---

## Chantier E — Ce que la page n'expose pas, et pourquoi elle n'a pas de mot de passe

**Ce qu'il fait.** Il rend vérifiable la seule contrainte qui borne la page coach,
et il écrit la décision du PRD §13 là où elle sera relue.

**La contrainte, mot pour mot.** PRD §7.6 : la page coach montre *« exactement ce
qui est déjà public : classement des pseudonymes, progression du groupe,
répartition des ressentis. Elle n'expose rien de plus que la page de stats —
c'est ce qui rend son absence de protection acceptable. »* La contrainte n'est
pas « la page est protégée » : c'est « la page n'a rien à protéger ». Elle ne
tient que si elle est vérifiée, pas seulement voulue.

**Comment on la vérifie.** Un test lit `web/vue-coach.js` et affirme :

- aucune autre chaîne de chemin réseau que `CHEMIN_COACH` — pas de
  `/api/classement`, pas de `fetch('/` ailleurs ;
- aucun import de `etat.js`, **ni direct ni transitif** : les deux seuls modules
  importés sont `web/vue-jour.js` (pour `dateEnToutesLettres`, qui n'importe que
  `domaine.js`) et `web/ressenti.js` — dont seules `RESSENTIS` et
  `CLES_RESSENTI` sont utilisées, jamais `monterRessenti`. La page ne lit donc
  ni `lirePrenom`, ni `lireFaits`, ni `lireClassement`, ni `lireRessentis` :
  elle n'a **aucun** accès au téléphone de qui que ce soit. C'est aussi la
  raison pour laquelle `heureDuReleve` est écrite ici plutôt qu'empruntée à
  `vue-rejoindre.js` ;
- aucune occurrence de la sous-chaîne `prenom`, commentaires compris ;
- aucun `innerHTML` : les pseudonymes viennent d'un champ public, ils s'affichent,
  ils ne s'interprètent pas.

Ces quatre assertions sont ce qui empêche la dérive la plus probable de cette
page : « puisqu'on y est, montrons aussi… ». Chaque ajout devra passer par elles.

**La décision du §13, écrite comme une décision.** Dans le `README.md`, sous un
titre « La vue coach n'a pas de mot de passe », et reprise en une phrase visible
sur la page elle-même :

```js
export const MENTION_PUBLIQUE = 'Cette page est publique : elle n’affiche que ce que les enfants voient déjà — des pseudonymes choisis, des pourcentages, aucun nom d’enfant.';
```

Le raisonnement, à écrire dans le `README` et dans le message de commit :

> Le mot de passe statique a été **écarté** (PRD §13). Sur une page publique il
> donnerait l'apparence d'une protection sans en être une, et devrait de toute
> façon être injecté par l'environnement — donc être un secret de plus, que le
> contrat de la fabrique interdit dans le dépôt et dans l'image. Un mot de passe
> aurait en outre un effet inverse à celui qu'on lui prête : il ferait croire au
> coach que cette page peut recevoir un jour des données nominatives.
>
> **Si le coach veut le détail nominatif par enfant, ce sera une seconde
> application, en `exposure: private`.** Le palier `private` n'admet que les
> comptes de la liste blanche du serveur et pose `X-Forwarded-User` de façon non
> usurpable (CLAUDE.md) : c'est la seule forme correcte de cette demande. Elle
> n'est pas un durcissement de celle-ci — elle est un autre répertoire sous
> `apps/`, avec son `app.yml`, son image et son URL. La stack étant unique, une
> app privée voisine ne change rien à celle-ci.

La mention affichée dit au coach ce qu'il regarde. Sans elle, un lien reçu sans
contexte se lit comme un tableau de bord privé, et le coach pourrait raisonner —
ou parler à un parent — comme si ces chiffres ne sortaient pas du club.

**Ce que le `README` gagne aussi**, dans la section du lot 2 : le lien à envoyer
au coach (`https://marcq-handball.apps.billbob.ovh/#/coach`), le fait qu'il n'est
pas listé dans la navigation de l'application, et la phrase du chantier C — le
ressenti d'un enfant qui n'a pas rejoint le classement ne quitte jamais son
téléphone, ce qui rend la répartition affichée au coach partielle par
construction. Un coach qui lirait « 4 facile / 11 correct / 6 dur » comme le
compte de son effectif se tromperait ; le `README` et la page le disent tous les
deux.

**Critère d'acceptation.** Les quatre assertions de source passent ;
`MENTION_PUBLIQUE` apparaît dans le rendu de `monterCoach` (assertion de source
sur son usage) ; `./init.sh --check` est vert, y compris sa ligne sur
`X-Forwarded-User` — ce document est un `.md` et a le droit de nommer cet
en-tête, `vue-coach.js` ne l'a pas ; le `README` porte les deux sections.

---

## Ce qui reste à trancher avant d'exécuter

| Question | Qui tranche | Ce qui bouge selon la réponse |
|---|---|---|
| **Le coach est-il au courant, et regardera-t-il son écran ?** (PRD §15.3) | le coach, par le décideur du PRD | Tout. C'est le verrou en tête de document, et c'est le seul de la fabrique dont la réponse peut être « on ne le fait pas » : un « non » supprime les cinq chantiers, pas seulement le chantier D |
| **Les scores survivent-ils à un redéploiement ?** (PRD §12.1) | l'exploitation du serveur | Reprise telle quelle du PRP 08. Bloque le PRP 07, donc `GET /api/coach`, donc la page. Le code de ce PRP se relit et se fusionne quand même : `503 classement-indisponible` est un état affiché, pas une panne |
| **`/api/coach` doit-il rendre les ressentis *par séance* et non seulement en agrégat global ?** | le PRP 07, propriétaire de l'API | Demande formulée ici, pas contournée. En l'état, `ressentis` agrège toutes les dates et tous les participants : le coach lit *« le groupe a trouvé ça dur »*, jamais *« la séance du 12 a été dure »*. C'est une lecture fidèle du §7.6, et une information nettement moins utile. Si le PRP 07 ajoute un champ `ressentis` par entrée de `seances`, seuls `modeleCoach` et le montage du bloc changent ; rien du chantier A, B ou C ne bouge |
| **`GET /api/classement` : la forme du PRP 07 (`jour`, `classement[]`) ou celle du PRP 08 (`date`, `podium`, `parts`) ?** | le PRP 07, propriétaire de l'API | Rien dans ce PRP — il ne lit que `/api/coach`. La contradiction est réelle entre deux documents amont et doit être tranchée avant le PRP 09, sans quoi `relever()` du PRP 08 lira des champs absents. Signalée ici parce qu'elle se voit d'ici, pas parce qu'elle s'arbitre ici |
| **Page 3 sur 3 de la note du coach** (PRD §12.3) | le coach, avant le 17 août | Rien dans ce code. `programme.json` gagne des séances, `ressentisPourEnvoi` accepte alors leurs dates, la page coach affiche une ligne de plus. Aucun ressenti déjà stocké n'est invalidé |

## Points d'attention

**Un « non » du coach ne se contourne pas en gardant le ressenti « au cas où ».**
Le ressenti coûte un tap à chaque séance terminée à chaque enfant ; sans lecteur,
c'est du frottement pur sur le geste que le PRD §4 mesure. Si le verrou tombe du
mauvais côté, la bonne action est de ne rien livrer et de le noter dans le
`README` — pas de livrer la moitié la moins visible.

**Deux panneaux modaux sur le même événement, c'est un enfant coincé.** Le PRP 06
l'écrit et ce PRP s'y tient : `monterRessenti` est appelé **dans**
`ouvrirPanneauDeFin`, et rien de ce PRP n'écoute `EVT_SEANCE_COMPLETE`. Ouvrir un
second `<dialog>` par-dessus le premier donnerait un écran inerte — `showModal`
rend le reste du document inerte — et le symptôme ne ressemblerait pas à un
problème de ressenti.

**Le champ `ressentis` du `POST` est refusé en bloc.** Le PRP 07 valide au plus
une entrée par séance, une clé qui est une date de séance, une valeur des trois ;
sinon `400 ressentis-invalide`. Un ressenti déformé ne perd donc pas *le
ressenti*, il perd **l'envoi entier**, classement compris, et l'enfant sort du
podium sans qu'aucun écran ne l'explique. `ressentisPourEnvoi` est le seul rempart
et il ne s'omet pas « parce que la valeur vient d'une constante » : elle vient du
`localStorage`, qui a pu être écrit par une version antérieure de l'application.

**Le décodeur du serveur refuse les champs inconnus.** `DisallowUnknownFields`
(PRP 07, chantier 5) : ajouter un cinquième champ au corps — un horodatage de
ressenti, une version de client — ferait échouer **tous** les envois, y compris
ceux qui ne portent aucun ressenti. Le corps a exactement quatre champs, et le
ressenti tient dans le quatrième.

**Ne recopie pas les trois valeurs.** `facile`, `correct`, `dur` existent dans
`ressenti.js` et dans le validateur Go du PRP 07. Une troisième copie — dans un
test, dans le CSS, dans un `switch` du montage — divergerait au premier
changement. Le montage lit `RESSENTIS`, la page coach aussi : c'est ce qui fait
que l'émoji du panneau et celui de la page du coach sont le même.

**N'écris pas le nom de l'en-tête d'identité, même pour dire qu'on ne le lit
pas.** `init.sh:1444-1452` grep les fichiers suivis non-`.md` de
`apps/marcq-handball/` sans distinguer code et commentaire. Un commentaire
explicatif dans `vue-coach.js` ferait échouer `./init.sh --check` avec un message
qui ressemble à un faux positif alors qu'il est exact. Ce document est un `.md`,
il a le droit ; le code ne l'a pas. C'est particulièrement tentant sur ce PRP,
qui est celui où l'on parle de « qui a le droit de regarder ».

**La page coach est publique et sera trouvée.** CLAUDE.md : *« l'URL finira par
être trouvée. Ne compte jamais sur le fait qu'elle n'est pas publiée. »* Un
enfant qui tape `#/coach` verra la page, et c'est sans conséquence — par
construction elle ne montre que ce qu'il voit déjà. C'est la propriété qu'il faut
préserver à chaque ajout ; c'est ce que les quatre assertions du chantier E
protègent.

**L'exception `sansPrenom` est une porte, et elle ne doit rester ouverte que pour
cet écran.** Elle contourne la seule garantie que le PRP 03 pose sur l'entrée —
*« tant que le prénom manque, aucune route n'est honorée »*. Elle est sûre ici
parce que `monterCoach` ne lit rien du stockage local ; elle cesserait de l'être
le jour où un écran « sans prénom » lirait `marcq.v1.*`. Le test qui interdit
l'import de `etat.js` dans `vue-coach.js` est ce qui tient cette propriété dans
le temps.

**`autofocus` sur `Continuer` n'est pas un détail d'ergonomie.** Sans lui,
`showModal()` focalise le premier bouton du panneau — un émoji — et un enfant
qui appuie sur Entrée pour fermer enregistre « Facile ». Le ressenti serait alors
une donnée fabriquée par l'interface, et la répartition affichée au coach en
serait faussée dans le sens le plus flatteur.

**Le ressenti n'est pas modifiable après coup, et c'est assumé.** Il n'existe
aucun écran pour revenir dessus : la seule façon de le changer est de décocher
puis recocher la dernière case de la séance, ce qui rouvre le panneau. C'est
cohérent avec ce qu'il mesure — une humeur datée, pas une déclaration —, et un
écran d'édition transformerait une réponse d'un tap en un objet à gérer.

**Aucun secret, aucune variable nouvelle.** Ce PRP n'introduit aucune variable
d'environnement : `MARCQ_DONNEES` (PRP 07) est la seule du lot 2, et son nom seul
figure au `README`. La page coach ne porte aucune clé, aucun jeton, aucun
identifiant — c'est la conséquence directe du §13, pas une économie.

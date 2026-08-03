# PRP 09 — L'équipe : podium, position, jauge

> **Pour l'agent qui exécute :** applique ce PRP avec
> `superpowers:subagent-driven-development` ou `superpowers:executing-plans`.
>
> **Ossature :** `apps/marcq-handball/prp/00-ossature.md` — lu avant de commencer.
> **PRD :** `docs/superpowers/specs/2026-08-03-marcq-handball-prd.md`

| | |
|---|---|
| **Lot** | 2 |
| **Branche** | `marcq-handball/equipe` |
| **Dépend de** | PRP 07 (les corps JSON de `GET` et `POST /api/classement`), PRP 08 (`lireClassement`, `dernierRangConnu`, `EVT_CLASSEMENT`, `synchroniser`, le conteneur `.bloc-equipe`), PRP 05 (`monterPerso`, `#/perso`), PRP 06 (`rouler`, `mouvementReduit`, le bloc `prefers-reduced-motion` universel), PRP 03 (le contrat d'écran, `dateEnToutesLettres`), PRP 02 (`progression`) |
| **Débloque** | rien — c'est une feuille du graphe de l'ossature §10 |
| **Sections du PRD** | §7.5 (« L'équipe »), §9 (le podium nomme trois personnes ; le dénominateur est honnête ; pas de second classement sur le volume), §10 (« le changement de position est animé »), §11 (hors ligne), §4 et §15.2 (l'effectif n'est pas une donnée du produit), §13, §6 lot 2 item 9 |

---

> ⛔ **Verrou** — ce PRP ne démarre pas avant que **la survie des scores à un
> redéploiement** soit tranchée. Le PRD §12.1 le pose : *« Un classement remis à
> zéro à chaque publication d'image serait pire que pas de classement. »* Il se
> tranche **côté exploitation du serveur**, hors de ce dépôt, et le contrat de la
> fabrique le dit sans ambiguïté : *« Si tu as besoin de […] un volume persistant
> […] écris-le dans le `README` et arrête-toi. »* Le verrou tient sur le PRP 07,
> puis sur le PRP 08, puis sur celui-ci. Tant qu'il tient, le travail en aval est
> spéculatif : cet écran n'a rien à afficher, parce qu'il n'a rien à lire.

**Le second verrou est levé.** Les PRP 07 et 08 décrivaient deux corps JSON
différents — le PRP 08 avait été rédigé en parallèle du PRP 07, sans pouvoir lire
le contrat que celui-ci écrivait, et consommait donc une API imaginée (`date`
pour `jour`, `podium` et `parts` pour `classement`). Le PRP 08 a depuis été
aligné sur la forme du PRP 07, qui est propriétaire de l'API. Ce PRP consomme
cette même forme, et n'a plus d'écart à rattraper.

Il reste de ce verrou une **dépendance d'exécution**, pas de contenu : le PRP 08
doit être fusionné avant celui-ci, puisque c'est lui qui pose
`web/classement.js`. Tant qu'il ne l'est pas, `instantane.classement` vaut
`undefined` et l'échec est silencieux — le podium est vide, la position est
nulle, et l'écran ne montre rien sans se plaindre.

## Objectif

L'enfant voit où il se situe dans son équipe — trois noms sur un podium, sa
propre position sans que personne d'autre ne soit nommé, et une jauge collective
où personne n'est dernier — que le réseau réponde ou non, et qu'il ait rejoint le
classement ou non.

## Ce qui est vérifiable à la fin

- `cd apps/marcq-handball && node --test tests/equipe.test.js` affiche `# fail 0`,
  et couvre les cinq fonctions pures du chantier 1, les quatre conditions
  d'animation du chantier 4 et les cinq refus du chantier 5.
- Sur un instantané à 9 participants, `podiumDe` rend **exactement trois
  lignes**, toutes porteuses d'un `pseudo` ; le même instantané amputé de ses
  pseudonymes au-delà du troisième rend toujours trois lignes, et aucune ligne
  anonyme n'entre jamais dans le podium.
- `positionDe` rend `{ rang: 10, participants: 10 }` pour un non-participant
  moins avancé que les neuf inscrits, et `{ rang: 1, participants: 10 }` pour un
  non-participant plus avancé que tous — le rang atteint donc le dénominateur, ce
  qui est impossible avec `participants` seul.
- Trois instantanés à 3, 9 et 20 participants rendent pour un même
  non-participant `sur 4`, `sur 10` et `sur 21` : aucun effectif d'équipe n'est
  écrit nulle part (PRD §4, §15.2).
- Un test lit `web/vue-equipe.js` et échoue si l'une des sous-chaînes
  `totauxAccomplis`, `lignesVolume`, `pompes`, `effectif` y apparaît, commentaires
  compris — le second classement du §13 ne peut pas revenir par la porte du
  volume, ni le total d'équipe par celle d'un commentaire.
- Réseau coupé (outils de développement → Réseau → Hors ligne), `F5`, puis
  `#/perso` : le podium, la position et la jauge s'affichent avec la ligne
  `Classement de vendredi 7 août — pas encore actualisé aujourd’hui.`, et la
  console ne montre aucune exception non rattrapée.
- Dans un navigateur, en ligne : taper « Actualiser » après qu'un autre téléphone
  a dépassé le sien fait **rouler** le numéro de rang de son ancienne valeur à la
  nouvelle, sans que rien ne soit bloqué pendant le roulement.
- Outils de développement → Rendering → `prefers-reduced-motion: reduce` : le
  même geste pose le nouveau rang d'un coup, et tout reste lisible et utilisable.
- `./apps/marcq-handball/test.sh` est vert, `./init.sh --check` aussi.

## Périmètre

**Dedans :** `web/vue-equipe.js` en entier — le modèle pur, le montage, la mise à
jour en place et l'animation du rang ; le style de l'équipe dans `web/style.css` ;
les deux lignes d'accrochage dans `web/vue-perso.js` ; `/vue-equipe.js` dans la
coque de `web/sw.js` ; `tests/equipe.test.js` ; une section du `README.md`.

**Dehors, et pourquoi :**

- **L'API — PRP 07.** Ce PRP ne définit aucune route, aucun corps de requête,
  aucun calcul de rang serveur. Il **consomme** ce que le PRP 07 publie. Un rang
  recalculé par le client serait un rang déclaré par le client (ossature §2) — la
  seule exception est le cas où le serveur ne connaît pas l'enfant, traité au
  chantier 1 et nommé comme tel à l'écran.
- **Le consentement, le pseudonyme, le code, l'envoi, la suppression — PRP 08.**
  Ce PRP n'écrit **jamais** dans `marcq.v1.classement` et n'appelle jamais
  `envoyer`, `supprimer` ni `ecrireClassement`. Il lit `lireClassement()` et
  appelle `synchroniser` — rien d'autre.
- **Le champ `ignores` de la réponse d'envoi — PRP 08.** *« 3 exercices ne
  comptent pas encore »* accompagne un envoi ; c'est le retour d'un geste, pas
  une donnée de comparaison.
- **La page du coach — PRP 10.** `GET /api/coach` n'est ni appelé ni lu ici.
- **Le volume cumulé — PRP 05.** Il reste sur « Ma progression », au-dessus, et
  ne produit **aucun second classement** (PRD §9, §13).
- **Les récompenses de fin de séance — PRP 06.** Ce PRP réutilise `rouler` et
  `mouvementReduit` ; il n'ajoute ni confettis ni panneau.

## Interfaces

**Consomme — du PRP 07, la forme qui fait foi.** `GET /api/classement`, corps de
réponse `200`, tel que le chantier 4 du PRP 07 l'écrit :

```json
{
  "jour": "2026-08-07",
  "programmees": 22,
  "participants": 9,
  "classement": [
    { "rang": 1, "cochees": 22, "part": 1,     "pseudo": "Renard" },
    { "rang": 2, "cochees": 20, "part": 0.909, "pseudo": "K7" },
    { "rang": 3, "cochees": 19, "part": 0.864, "pseudo": "Bibou" },
    { "rang": 4, "cochees": 19, "part": 0.864 },
    { "rang": 9, "cochees":  0, "part": 0 }
  ],
  "groupe": { "cochees": 121, "programmees": 198, "part": 0.611 }
}
```

`POST /api/classement`, corps de réponse `200` ou `201` :

```json
{ "pseudo": "Renard", "jour": "2026-08-07", "rang": 2, "participants": 9,
  "cochees": 20, "programmees": 22, "part": 0.909, "ignores": 3 }
```

Trois propriétés de cette forme sont les seules sur lesquelles ce PRP s'appuie,
et elles viennent toutes du PRP 07 : `classement` porte **toutes** les lignes,
anonymes au-delà de la troisième ; les rangs sont **stricts**, de 1 à N, jamais
répétés ; `participants` vaut `len(classement)`.

**Consomme — des PRP amont :**

```js
// web/etat.js — PRP 08
lireClassement()          // -> { pseudo, code, dernierEnvoi, dernierRangConnu }, JAMAIS null
CLASSEMENT_VIDE           // { pseudo: null, code: null, dernierEnvoi: null, dernierRangConnu: null }

// web/classement.js — PRP 08
EVT_CLASSEMENT            // 'marcq:classement-maj', CustomEvent sur document, bubbles: true
synchroniser(ctx, options = {})   // -> Promise<Resultat> ; ecrit l'etat, emet l'evenement

// web/domaine.js — PRP 02, ossature §5
progression(prog, jour, faits)    // -> { cochees, programmees, part } ; `jour` est un PARAMETRE

// web/vue-jour.js — PRP 03
dateEnToutesLettres(dateISO)      // '2026-08-07' -> 'vendredi 7 août'

// web/recompenses.js — PRP 06
rouler(noeud, depart, arrivee, options = {})   // -> annuler() ; respecte deja prefers-reduced-motion
mouvementReduit(fenetre = globalThis)          // -> boolean

// web/vue-perso.js — PRP 05
monterPerso(hote, ctx)    // l'ecran ; ce PRP y ajoute deux lignes

// web/vue-rejoindre.js — PRP 08
monterActionClassement(hote, ctx)   // -> demontage ; reste SOUS le bloc de ce PRP
```

Le **contrat d'écran** du PRP 03 s'applique sans modification :
`ctx = { prog, aujourdhui, prenom, faits, route, aller(route), rafraichir() }`,
un écran ne mute jamais `ctx`, un écran n'en monte jamais un autre, et la valeur
rendue par un montage sert à démonter **ce qui déborde de `hote`** — ce qui est
exactement le cas ici, puisque l'écouteur de `EVT_CLASSEMENT` vit sur `document`.

Jetons et classes de `web/style.css` réutilisés, jamais redéfinis :
`--marcq-encre`, `--marcq-encre-douce`, `--marcq-fond`, `--marcq-carte`,
`--marcq-accent`, `--marcq-sur-accent`, `--marcq-trait`, `--marcq-tap`,
`.titre-bloc`, `.aide`, `.barre`, `.bouton`, `.lu-seul`.

**Produit :**

```js
// web/vue-equipe.js
export const TITRE_EQUIPE = 'L’équipe';
export const PODIUM_MAX = 3;
export const PHRASE_PERSONNE = 'Personne n’a encore rejoint le classement.';
export const TEXTE_ACTUALISER = 'Actualiser';

export function rangOrdinal(n)                  // 1 -> '1er' ; 2 -> '2e' ; 10 -> '10e'
export function podiumDe(instantane, monPseudo) // -> [{ rang, ordinal, pseudo, pourcent, moi }] 0..3
export function positionDe({ instantane, moi, cochees, inscrit })
                                                // -> { rang, ordinal, participants, inscrit } | null
export function phrasePosition(position)        // -> 'Tu es 3e sur 10.'
export function modeleGroupe(instantane)        // -> { cochees, programmees, pourcent, echelle, phrase }
export function datationEquipe(instantane, aujourdhui)   // -> string
export function modeleEquipe(ctx, local)        // -> ModeleEquipe | null
export function monterEquipe(hote, ctx)         // -> debrancher()
export function majEquipe(bloc, modele, options = {})    // met a jour EN PLACE, anime le rang
```

```js
// ModeleEquipe — tout ce que le montage doit savoir, et rien de plus
{
  titre: 'L’équipe',
  jour: '2026-08-07',          // le jour du serveur : celui du denominateur
  datation: 'Classement de vendredi 7 août.',
  podium: [{ rang, ordinal, pseudo, pourcent, moi }],   // 0 a 3 lignes, toujours nommees
  position: { rang, ordinal, participants, inscrit, phrase } | null,
  groupe: { cochees, programmees, pourcent, echelle, phrase },
  vide: string | null,         // PHRASE_PERSONNE quand participants vaut 0
}
```

```
data-rang    sur le nombre de la position — le point de depart du roulement
data-jour    sur le bloc — le garde-fou de minuit (PRP 07, points d'attention)
.bloc-equipe le conteneur pose par le PRP 08 dans monterPerso ; ce PRP ecrit
             AU-DESSUS de l'appel a monterActionClassement, dans ce meme conteneur
```

**Les noms introduits ici, absents de `00-ossature.md` et des PRP amont :**

| Nom | Ce que c'est, et pourquoi |
|---|---|
| `web/vue-equipe.js` | Le second niveau du PRD §7.5. Un module à part de `vue-rejoindre.js` parce que la frontière est celle du PRP 08 : *« ici on décide et on envoie, là-bas on regarde »*. Deux branches, deux fichiers, un seul point de contact — `.bloc-equipe`. Le serveur sert tout `web/` à la racine depuis `//go:embed web` (ossature §7) : le fichier arrive sans une ligne de Go. |
| `tests/equipe.test.js` | Un fichier par PRP, comme `seance.test.js` et `perso.test.js` : deux branches parallèles fusionnent sans conflit. |
| `rangOrdinal`, `phrasePosition` | Le « 3e » du PRD §7.5. Exporté et pur, donc épinglé par un test : `1er` et jamais `1e`, `2e` et jamais `2ème`. |
| `podiumDe`, `PODIUM_MAX` | Le podium du §9. La constante existe pour que la règle « trois personnes » soit un nombre nommé qu'un test lit, pas un `3` perdu dans une tranche. |
| `positionDe` | Le seul calcul de rang admis côté client, et uniquement pour quelqu'un que le serveur ne connaît pas. Ses arguments sont **nommés** : quatre paramètres positionnels dont deux entiers s'inversent un jour sans qu'aucun test ne le voie. |
| `modeleGroupe` | La jauge du §7.5, mise en forme depuis le champ `groupe` du serveur, sans recomposition. |
| `datationEquipe` | La date du classement affiché. C'est elle qui tient la moitié « **et le dit** » du PRD §11. |
| `majEquipe` | La mise à jour **en place** d'un bloc déjà monté. C'est elle, et elle seule, qui anime : voir le chantier 4. |
| `TEXTE_ACTUALISER` | Le geste explicite que le PRP 08 range dans ses quatre déclencheurs et attribue nommément à ce PRP. |

## Fichiers

- **Créer :** `apps/marcq-handball/web/vue-equipe.js`,
  `apps/marcq-handball/tests/equipe.test.js`
- **Modifier :** `apps/marcq-handball/web/vue-perso.js` (un import, un appel, et
  le retour du démontage), `apps/marcq-handball/web/style.css`,
  `apps/marcq-handball/web/sw.js`, `apps/marcq-handball/README.md`
- **Ne pas modifier :** `apps/marcq-handball/tests/perso.test.js` — voir les
  points d'attention, le seul ajustement qu'il demande appartient au PRP 08.
- **Tester :** `apps/marcq-handball/tests/equipe.test.js`, plus les trois
  contrôles à la main du chantier 4 (roulement, mouvement réduit) et du
  chantier 5 (hors ligne) — la CI n'a ni navigateur ni interrupteur réseau.

---

# Ce qu'il faut construire

## Chantier 1 — Le modèle : trois nombres, et un dénominateur honnête

**Ce qu'il fait.** Il transforme l'instantané du serveur en ce que l'écran
affiche. Fonctions pures : aucun DOM, aucune horloge, aucun `fetch`. C'est ici
que vivent les trois règles du PRD §9, et c'est ce qui les rend prouvables par
`node --test`.

### L'écart entre le PRP 07 et le PRP 08, chiffré

| Ce que le PRP 08 avait supposé | Ce que le PRP 07 publie | Ce que ça change |
|---|---|---|
| `date` | `jour` | Le nom du champ de datation, lu par `datationEquipe` |
| `podium: [3 lignes nommées]` | `classement: [N lignes, nommées jusqu'à la 3ᵉ]` | Le podium se **dérive** du tableau au lieu d'être un champ |
| `parts: [nombres triés]` | `classement[i].cochees` et `.part` | La position d'un non-participant se déduit du même tableau, en mieux : il porte les rangs déjà tranchés par le serveur |
| `POST` rend le corps du `GET` + `moi` | `POST` rend **huit champs plats**, sans le tableau | La réponse d'envoi ne porte pas le tableau ; le PRP 08 fait donc suivre un `GET` dans le même appel à `synchroniser`, et le podium est frais après chaque envoi |

Les trois premières lignes sont des renommages : `web/classement.js` s'y est
aligné. La quatrième n'est plus une décision à prendre ici — le PRP 08 l'a
tranchée en enchaînant le `GET` de rafraîchissement derrière l'envoi, de sorte
que `dernierRangConnu.instantane` porte le tableau d'**après** l'envoi. Cet écran
lit donc toujours un instantané frais, et n'a aucun rafraîchissement à déclencher
de son côté.

**Ce que ce PRP exige de `dernierRangConnu` :** `{ recuA, instantane, moi }` où
`instantane` est **le corps du dernier `GET` reçu, entier et non transformé**, et
`moi` **le corps de la dernière réponse d'envoi acceptée, entier** — donc avec
son champ `jour`. Stocker un sous-ensemble « pour faire propre » casserait le
garde-fou de minuit du chantier 4, qui compare précisément `moi.jour` à
`instantane.jour`.

### Le dénominateur d'un non-participant — la question que le PRP 08 laisse ouverte

Le PRP 08 la pose et ne la tranche pas : *« Le dénominateur affiché à un
non-participant : `participants` ou `participants + 1` ? »*

**Tranché : `participants + 1`.** Le PRD §9 exige que *« le dénominateur soit
honnête »* — qu'il compte *« les participants au classement »* et jamais *« un
effectif qu'on ne mesure pas »*. Un enfant qui n'a pas rejoint n'est pas un
effectif qu'on ne mesure pas : c'est la seule personne que l'application mesure
**exactement**, puisque ses cases sont sur son téléphone. L'ensemble comparé
compte donc les 9 inscrits **plus lui** : dix personnes, dix positions.

Trois conséquences, et la première suffirait :

1. **Avec `participants`, le rang peut dépasser le dénominateur.** Un
   non-participant moins avancé que les neuf inscrits est dixième ; « 10e sur 9 »
   est faux au sens le plus simple du terme. La seule façon de l'éviter serait
   d'écrêter le rang à 9 — c'est-à-dire de promettre à un enfant qu'il n'est pas
   dernier alors qu'il l'est, et de le placer devant un participant réel.
2. **Deux enfants différents seraient « 3e sur 9 » en même temps qu'un
   participant l'est aussi.** Trois troisièmes, sur un écran dont toute la valeur
   tient à ce que le rang veuille dire quelque chose.
3. **Le dénominateur ne bouge pas quand on rejoint.** Avant : `9 + 1 = 10`.
   Après : `participants = 10`, donc `10`. C'est la propriété qui rend l'écran
   cohérent de part et d'autre du seul acte que le PRD §7.4 demande — *« Non
   merci est un choix complet, pas une punition »* — et qui garantit que rejoindre
   n'est jamais présenté comme un moyen de mieux se classer.

**Cet arbitrage doit remonter au PRD, il ne peut pas vivre ici seul.** Le §7.5
chiffre la situation par *« tu es 3e sur 9, affichée même sans avoir rejoint »*,
et le §9 pose que le dénominateur *« compte les participants au classement »* :
un enfant qui n'a pas rejoint lira donc « 3e sur 10 » là où la source annonce
« 3e sur 9 ». L'écart est délibéré et démontré ci-dessus, mais il se règle dans
la source, pas dans un PRP aval : le décideur du PRD valide, et une phrase entre
au §7.5 et au §9 — **« le dénominateur inclut celui qui regarde »**. Tant qu'elle
n'y est pas, le prochain lecteur du PRD prendra l'écran pour un défaut.

### Les fonctions

```js
// '1er' et jamais '1e' ; '2e' et jamais '2ème'. Le PRD §7.5 ecrit « 3e ».
export function rangOrdinal(n)          // -> string

// Les trois premieres lignes NOMMEES du classement, et rien d'autre.
// `monPseudo` vient de lireClassement().pseudo ; il marque MA ligne, il ne la cree pas.
export function podiumDe(instantane, monPseudo)
// -> [{ rang: 1, ordinal: '1er', pseudo: 'Renard', pourcent: 100, moi: false }, …]
//    0 a PODIUM_MAX lignes. Une ligne sans `pseudo` n'entre JAMAIS dans le podium,
//    meme si elle est dans les trois premieres — c'est le garde-fou de redondance
//    du §9, cote client, la ou la regle se lit.
//    `pourcent` vaut Math.round(ligne.part * 100) : le serveur a deja arrondi
//    `part` a trois decimales (PRP 07, chantier 2) pour que le podium et l'ecran
//    perso n'affichent pas 90,9 % et 91 % pour le meme enfant.

// Le rang, et l'ensemble sur lequel il porte.
export function positionDe({ instantane, moi, cochees, inscrit })
// instantane : le corps du dernier GET, ou null
// moi        : le corps de la derniere reponse d'envoi acceptee, ou null
// cochees    : mes cases cochees parmi celles programmees au jour de l'instantane,
//              ou null si le compte n'est pas comparable (voir plus bas)
// inscrit    : lireClassement().pseudo !== null
// -> { rang, ordinal, participants, inscrit } | null

export function phrasePosition(position)   // -> 'Tu es 3e sur 10.'
```

**Les quatre cas de `positionDe`, dans cet ordre :**

| Cas | Résultat | Motif |
|---|---|---|
| `instantane === null` ou `instantane.participants === 0` | `null` | Il n'y a pas de classement, donc pas de position. On n'affiche pas « 1er sur 1 » à quelqu'un qui est seul avec lui-même |
| `moi !== null` et `moi.jour === instantane.jour` | `{ rang: moi.rang, participants: instantane.participants, inscrit: true }` | Le serveur seul peut trancher les ex æquo — PRD §9, *« à égalité, le premier arrivé à ce score est devant »* — et il a déjà tranché |
| `inscrit === true`, mais `moi` absent ou d'un autre jour | `{ rang: 1 + nb(l.cochees > cochees), participants: instantane.participants, inscrit: true }` | Ma propre ligne est **dans** le tableau : la comparaison est stricte, sinon je me compte comme quelqu'un qui me devance. Le dénominateur reste `participants` : je suis déjà dedans |
| `inscrit === false` | `{ rang: 1 + nb(l.cochees >= cochees), participants: instantane.participants + 1, inscrit: false }` | Je ne suis pas dans le tableau. Comparaison **large** : à égalité, le §9 met devant *« le premier arrivé à ce score »*, et quelqu'un qui n'a rien publié n'a aucune date d'arrivée à faire valoir. Le rang le moins flatteur est le seul honnête |

Si `cochees === null` dans les deux derniers cas, `positionDe` rend `null` : le
compte n'est pas comparable, et un rang incomparable est pire qu'un rang absent.

**D'où vient `cochees`, et pourquoi il peut être `null`.**

```js
const p = progression(ctx.prog, instantane.jour, ctx.faits);
const cochees = p.programmees === instantane.programmees ? p.cochees : null;
```

Deux décisions dans ces deux lignes. **On compte au jour du serveur**, pas au
`ctx.aujourdhui` du téléphone : le tableau auquel on se compare a été calculé
avec le dénominateur de `instantane.jour`, et `progression` prend le jour en
paramètre exactement pour ça (ossature §5). **On refuse de comparer deux
programmes différents** : le service worker peut servir un `programme.json`
antérieur (le PRP 07 le prévoit et ignore alors les identifiants inconnus) ; deux
dénominateurs qui diffèrent signalent ce cas, et la position se tait plutôt que
de mentir. Le podium et la jauge, eux, restent affichés : ils ne dépendent pas de
mes cases.

### La jauge et la datation

```js
export function modeleGroupe(instantane)
// -> { cochees, programmees, pourcent, echelle, phrase }
// pourcent = Math.round(instantane.groupe.part * 100)
// echelle  = Math.max(1, instantane.groupe.programmees)   // <progress max="0"> est invalide
// phrase   = `Ensemble, ceux qui ont rejoint ont coché ${cochees} exercices sur ${programmees}.`

export function datationEquipe(instantane, aujourdhui)
// instantane.jour === aujourdhui -> `Classement de ${dateEnToutesLettres(jour)}.`
// sinon                          -> `Classement de ${dateEnToutesLettres(jour)} — pas encore actualisé aujourd’hui.`
```

`echelle` reprend la garde de `modelePerso` (PRP 05) pour la même raison :
`<progress max="0">` est invalide, et la décision vit dans le modèle, jamais dans
le montage.

**La jauge est le champ `groupe` du serveur, affiché tel quel.** On ne lui ajoute
pas les cases d'un enfant qui n'a pas rejoint, alors même que le dénominateur de
sa position, lui, le compte. La dissymétrie est assumée et la phrase la nomme —
*« ceux qui ont rejoint »* : un nombre public, identique sur tous les téléphones
et sur l'écran du coach, vaut mieux qu'une jauge recomposée par appareil, donc
invérifiable, et qui rouvrirait ce que l'ossature §2 ferme.

`modeleEquipe(ctx, local)` assemble le tout et rend `null` quand
`local.dernierRangConnu === null` : rien n'a jamais été reçu, donc rien ne
s'affiche. Un podium vide se lit comme un podium où personne n'est monté, et une
jauge à zéro comme une équipe qui n'a rien fait. La ligne d'état du PRP 08 dit
déjà `Classement jamais reçu. Reviens quand tu auras du réseau.` ; c'est elle qui
parle, et une seule fois.

Quand `instantane.participants === 0`, le modèle existe mais `podium` est vide,
`position` vaut `null` et `vide` porte `PHRASE_PERSONNE`. La jauge est alors à
zéro sur une échelle de 1 et n'est pas montée — voir chantier 2.

**Critère d'acceptation.** `tests/equipe.test.js`, sans navigateur ni réseau, sur
des instantanés écrits à la main : `rangOrdinal` couvre 1, 2, 3, 10, 21 ;
`podiumDe` rend trois lignes nommées et jamais une quatrième, marque `moi` sur la
bonne ligne, et rend deux lignes quand seuls deux pseudonymes sont présents ; les
quatre cas de `positionDe` rendent les quatre résultats du tableau ci-dessus ;
`positionDe` rend `null` sur `cochees: null` ; `phrasePosition` rend
`Tu es 3e sur 10.` ; `datationEquipe` rend les deux phrases ; les trois
instantanés à 3, 9 et 20 participants rendent `sur 4`, `sur 10`, `sur 21`.

---

## Chantier 2 — Le montage : trois noms, zéro nom, une jauge

**Ce qu'il fait.** Il pose le modèle dans le DOM. **Aucune décision** — pas même
un `Math.max` de garde : elles sont toutes au chantier 1, où `node --test` les
attrape (la coupure du PRP 04 et du PRP 05, appliquée telle quelle).

**L'ordre est celui du PRD §7.5**, et il n'est pas négociable : « Ma progression »
occupe tout l'écran au-dessus ; « L'équipe » vient après le calendrier, dans
`.bloc-equipe` ; et à l'intérieur du bloc, **podium, puis position, puis jauge** —
la comparaison la plus nominative en premier, la mesure où personne n'est dernier
en dernier, pour que ce soit elle qu'on lise en refermant.

**La structure, exactement :**

```
<section class="bloc-equipe">                            ← posee par le PRP 08
  <div class="equipe" data-jour="2026-08-07">            ← posee par CE PRP
    <h2 class="titre-bloc">L’équipe</h2>
    <p class="datation-equipe">Classement de vendredi 7 août.</p>
    <ol class="podium">
      <li class="ligne-podium podium-moi">
        <span class="rang-podium" aria-hidden="true">1er</span>
        <span class="pseudo-podium">Renard</span>
        <span class="part-podium">100 %</span>
        <span class="lu-seul">1er : Renard, 100 %. C’est toi.</span>
      </li>
      …
    </ol>
    <p class="position-equipe">
      <span class="rang-position" data-rang="3">3e</span>
      <span class="phrase-position">Tu es 3e sur 10.</span>
    </p>
    <p class="groupe-equipe">
      <progress class="barre jauge-groupe" max="198" value="121"></progress>
      <span class="phrase-groupe">Ensemble, ceux qui ont rejoint ont coché 121 exercices sur 198.</span>
    </p>
    <button class="bouton actualiser-equipe" type="button">Actualiser</button>
  </div>
  …                                                       ← monterActionClassement (PRP 08)
</section>
```

**Le `<div class="equipe">` intermédiaire n'est pas décoratif.** `hote` est le
`.bloc-equipe` du PRP 08, et il contiendra aussi le bloc d'action de ce PRP-là.
Tout ce que ce PRP écrit vit donc dans un conteneur qui lui appartient, que
`majEquipe` peut vider et réécrire sans risque. Sans lui, la mise à jour en place
du chantier 4 n'aurait d'autre choix que d'aller chercher ses nœuds un par un
dans le DOM d'un voisin — ou, pire, d'appeler `hote.replaceChildren()` et
d'emporter le bouton « Apparaître au classement » du PRP 08 au premier
rafraîchissement. C'est aussi lui qui porte `data-jour`, plutôt que d'écrire un
attribut sur l'élément d'une autre branche.

**Les règles que ce montage applique :**

- **`textContent`, jamais `innerHTML`.** Un pseudonyme est du texte saisi par un
  enfant sur une page publique : il s'affiche, il ne s'interprète pas. C'est la
  même règle qu'aux écrans du jour, de séance et perso, et ici elle protège
  d'autre chose que d'un chevron dans `programme.json` — d'un pseudonyme forgé.
- **Le rang du podium est `aria-hidden`, la ligne `lu-seul` porte le sens.**
  « 1er Renard 100 % » lu à la file par un lecteur d'écran ne dit pas ce que
  l'œil comprend d'une colonne ; la ligne cachée le dit en une phrase, et la
  classe `.lu-seul` existe déjà (PRP 05).
- **Aucune zone tapable en dehors d'« Actualiser ».** Le podium n'ouvre rien : il
  n'y a aucun profil à consulter, et le §13 a écarté le classement nominatif
  complet. Le bouton porte `min-height: var(--marcq-tap)` (48 px), au-dessus du
  minimum de 44 px de l'ossature §9.
- **`participants === 0` : ni podium, ni position, ni jauge.** Une seule ligne,
  `PHRASE_PERSONNE`, dans un `<p class="aide">`. Une jauge à 0 % le 3 août au
  soir découragerait exactement au moment où il ne faut pas.
- **La position s'affiche même sans avoir rejoint** (PRD §7.5 : *« affichée même
  sans avoir rejoint »*), et rien à l'écran ne distingue les deux cas. Le champ
  `inscrit` du modèle ne sert **pas** à afficher un badge : il sert au chantier 1
  à choisir la bonne comparaison. Signaler « position estimée » ferait de
  « Non merci » un choix de seconde classe, ce que le §7.4 refuse.

**Le geste « Actualiser ».** Le PRP 08 range les quatre déclencheurs de
synchronisation et attribue le quatrième à ce PRP — *« un geste explicite
"Actualiser" (PRP 09) : une main est son propre garde-fou de débit »*. Le bouton
appelle `synchroniser(ctx)` **directement**, sans passer par
`brancherSynchronisation` dont le débit vise les déclencheurs automatiques. Il se
désactive le temps de l'appel et se réactive dans les deux issues : `synchroniser`
ne rejette jamais, il rend un `Resultat`. La mise à jour de l'écran, elle, ne vient
pas de la valeur rendue mais de `EVT_CLASSEMENT` — un seul chemin de rendu,
qu'on ait tapé le bouton ou qu'un autre déclencheur ait tiré.

**Le style** ajoute à `web/style.css`, sous les règles de l'écran perso :
`.equipe`, `.datation-equipe`, `.podium`, `.ligne-podium`, `.podium-moi`, `.rang-podium`,
`.pseudo-podium`, `.part-podium`, `.position-equipe`, `.rang-position`,
`.phrase-position`, `.groupe-equipe`, `.jauge-groupe`, `.phrase-groupe`,
`.actualiser-equipe`, plus les deux classes d'animation du chantier 4. Les
couleurs viennent des jetons `--marcq-*` du PRP 03 — jamais des jetons du PRP 01,
dont le PRP 05 rappelle qu'ils coexistent dans la même feuille. Un pseudonyme de
16 runes doit tenir : la ligne de podium est une grille à trois colonnes dont
celle du pseudonyme porte `min-width: 0` et `overflow-wrap: anywhere`, sans quoi
elle pousse le pourcentage hors de l'écran à 360 px.

**Critère d'acceptation.** `tests/equipe.test.js` lit `web/vue-equipe.js` et
`web/style.css` : `innerHTML` n'y apparaît pas ; toute classe littérale posée par
le montage existe comme sélecteur dans la feuille — la même assertion qu'au
PRP 05, transposée sur ce fichier, puisque celle du PRP 05 ne lit que
`vue-perso.js`. Dans un navigateur, à 360 px : le bloc apparaît sous le
calendrier, un pseudonyme de seize caractères ne provoque aucun défilement
horizontal, et le bouton « Actualiser » mesure au moins 44 px de haut.

---

## Chantier 3 — Le branchement : deux lignes dans `#/perso`, et un démontage

**Ce qu'il fait.** Il accroche le bloc à l'écran perso, l'abonne à
`EVT_CLASSEMENT`, et rend le démontage que le contrat d'écran du PRP 03 attend.

**Les deux lignes de `vue-perso.js`**, dans `monterPerso`, à l'intérieur du
`.bloc-equipe` créé par le PRP 08 et **avant** son appel :

```js
const demonterEquipe = monterEquipe(equipe, ctx);
monterActionClassement(equipe, ctx);
```

C'est le seul endroit où les diffs des branches `marcq-handball/rejoindre` et
`marcq-handball/equipe` se croisent, et le PRP 08 l'a annoncé — *« le PRP 09
posera podium, position et jauge ICI, au-dessus de l'appel suivant »*.

**`monterPerso` rend désormais une fonction de démontage.** Elle appelle celle de
`monterEquipe` et celle de `monterActionClassement`. Le contrat du PRP 03 le
prévoit sans amendement : *« La valeur rendue, si c'est une fonction, est appelée
avant le montage suivant. Elle ne sert qu'à ce qui déborde de `hote`. »* Ici,
c'est le cas : l'écouteur vit sur `document`, que le routeur ne vide pas. Sans ce
retour, quitter `#/perso` puis y revenir empilerait un écouteur par visite, et
chaque événement redessinerait des blocs détachés du document — une fuite qui ne
se voit qu'après une demi-heure d'usage.

**Ce que `monterEquipe` fait, dans l'ordre :**

1. Il pose **toujours** le conteneur `<div class="equipe">` dans `hote`, même
   vide. C'est l'ancre de toutes les mises à jour ultérieures : un conteneur créé
   plus tard demanderait à `majEquipe` de savoir où l'insérer par rapport au bloc
   du PRP 08, donc de connaître l'ordre des enfants d'un voisin.
2. `local = lireClassement()` — jamais `null`, le PRP 08 le garantit.
3. `modele = modeleEquipe(ctx, local)`, puis `majEquipe(equipe, modele)`. Un
   modèle `null` laisse le conteneur vide : rien ne s'affiche, et la ligne d'état
   du PRP 08 parle seule.
4. Il pose l'écouteur : `document.addEventListener(EVT_CLASSEMENT, surClassement)`.
   Il le pose **même quand le modèle est `null`**, sans quoi un enfant ouvrant
   `#/perso` avant la première réponse ne verrait jamais le classement arriver.
5. `surClassement` relit `lireClassement()`, recalcule le modèle et rappelle
   `majEquipe(equipe, modele)` — jamais un remontage d'écran : voir chantier 4.
6. Il rend `() => document.removeEventListener(EVT_CLASSEMENT, surClassement)`.

Le montage et la mise à jour passent donc par **le même chemin de rendu**,
`majEquipe`. C'est ce qui garantit qu'un cas traité à l'ouverture l'est aussi au
rafraîchissement, et l'inverse : deux fonctions de rendu divergent au premier
ajout de champ.

**L'écouteur relit l'état, il ne lit pas `detail`.** `EVT_CLASSEMENT` porte
`{ instantane, moi, statut }`, mais `synchroniser` a déjà écrit dans
`marcq.v1.classement` avant d'émettre. Relire est une source unique ; lire
`detail` en serait une seconde, et les deux divergeraient le jour où un envoi
échoue après un relevé réussi.

**`ctx.faits` est celui du dernier rendu** et suffit : ce PRP ne coche rien, et
un cochage passe par `ctx.rafraichir()` du PRP 04, qui remonte l'écran. Ne pas
appeler `lireFaits()` ici est délibéré — le contrat du PRP 03 dit que `ctx` est
relu par le routeur avant chaque rendu, et un écran qui court-circuite `ctx`
crée un second état.

**`web/sw.js`** reçoit `'/vue-equipe.js'` dans la liste de coque, après
`'/vue-rejoindre.js'`. Sans cette entrée, le premier passage hors ligne sur
`#/perso` échoue, et rien ne le signale tant qu'on reste connecté. **Ne pas y
ajouter `/api/`** : le PRP 01 l'exclut déjà du cache, et le PRP 08 le répète — un
rang resservi depuis le cache s'afficherait comme frais, et la promesse du §11
serait rompue sans le moindre symptôme.

**`README.md`** gagne une section « L'équipe » : les trois blocs dans leur ordre,
la règle des trois noms, le dénominateur `participants + 1` avec sa raison, et le
fait que la jauge est celle du serveur.

**Critère d'acceptation.** `tests/equipe.test.js` : la source de `vue-perso.js`
contient `monterEquipe(` et l'appelle **avant** `monterActionClassement(` ; la
source de `sw.js` correspond à `/'\/vue-equipe\.js'/`. Dans un navigateur :
naviguer `#/perso` → `#/` → `#/perso` dix fois, puis déclencher une
synchronisation ; le bloc n'est mis à jour qu'une fois, ce qui se vérifie en
posant un `console.count` temporaire dans `surClassement`.

---

## Chantier 4 — Le changement de position, animé

**Ce qu'il fait.** Il applique le PRD §10 : *« Grimper au classement : le
changement de position est animé, pas simplement affiché. »* Cet écran est le
seul de l'application qui affiche un rang ; l'animation lui appartient donc
entièrement, et le PRP 06 l'a explicitement laissée ici.

**La règle qui décide s'il faut animer, et elle tient en une phrase :** on anime
un changement qu'on a vu arriver, jamais un changement qu'on découvre.

```js
export function majEquipe(equipe, modele, options = {})
// equipe  : le <div class="equipe"> du chantier 2 — jamais le .bloc-equipe du PRP 08
// options : { rouler, reduit }  — injectables, pour prouver la regle sans navigateur
```

Quatre conditions, toutes nécessaires :

1. **Le conteneur portait déjà un rang.** Le point de départ est lu dans
   `equipe.querySelector('.rang-position')?.dataset.rang`, **avant** que
   `majEquipe` ne réécrive le contenu. Au premier appel — celui du montage — il
   n'y en a pas : le rang est posé, pas animé. C'est ce qui évite d'animer l'ouverture de
   l'écran — arriver sur une page n'est pas grimper.
2. **Le jour n'a pas changé.** `equipe.dataset.jour === modele.jour`, lu lui aussi
   avant réécriture. Le PRP 07 le
   dit sans détour : *« À 00 h 00 heure de Paris, `programmees` augmente d'un jour
   de séance et toutes les `part` chutent […] Le PRP 09 ne doit pas animer un
   changement de position qu'il n'a pas causé. »* Un rang qui bouge parce que la
   date a tourné est mis à jour sans un mouvement.
3. **Le rang a réellement changé.** `rouler` traite déjà `depart === arrivee` en
   posant la valeur ; la condition est écrite quand même, parce que la classe
   d'animation CSS, elle, n'a pas cette garde.
4. **La position existe avant et après.** Passer de `null` à un rang, c'est une
   apparition, pas une montée.

**Ce que l'animation fait :**

```js
rouler(noeudRang, ancien, nouveau, { format: (n) => rangOrdinal(n) });
equipe.classList.add(nouveau < ancien ? 'rang-monte' : 'rang-descend');
// retire au premier `animationend`, sinon la classe collerait jusqu'au demontage
```

`rouler` vient de `web/recompenses.js` (PRP 06) et n'est **pas** réécrit : il
porte déjà la courbe, l'arrondi, le bornage, l'interruption qui pose la valeur
finale, et le respect de `prefers-reduced-motion` par son option `reduit`, dont
le défaut est `mouvementReduit()`. Écrire une seconde boucle de roulement dans ce
fichier créerait deux courbes qui divergeraient au premier ajustement.

`format` rend l'ordinal : le nombre roule de `5e` à `3e`, jamais de `5` à `3`
suivi d'un suffixe qui apparaît à la fin. `rangOrdinal` est pur et déjà testé au
chantier 1.

**Les deux classes CSS et leur image-clé** vivent dans `style.css` :
`marcq-rang-monte` (translation verticale courte vers le haut puis retour) et
`marcq-rang-descend` (la même vers le bas, plus sobre). Elles durent 400 ms,
n'appliquent que `transform` et `opacity` — jamais une propriété qui provoque un
recalcul de mise en page — et **ne bloquent rien** : le bouton « Actualiser », le
défilement et les liens du calendrier restent utilisables pendant tout le
roulement. C'est le premier des trois interdits du §10, *« rien qui bloque
l'interaction pendant plus d'une demi-seconde »*.

**`prefers-reduced-motion` est couvert deux fois, et c'est voulu.** Le bloc
universel posé par le PRP 06 neutralise déjà toute animation de la feuille — le
PRP 06 précise qu'il *« doit le rester »* et qu'il couvre les animations des PRP
suivants —, et `rouler` refuse de rouler quand `mouvementReduit()` est vrai. Le
premier protège le CSS, le second le JavaScript ; ni l'un ni l'autre ne suffit
seul, puisque le texte du compteur n'est pas une animation CSS.

**Le second interdit du §10 est respecté par construction :** *« aucune animation
sur un écran consulté pendant l'effort »*. L'écran consulté entre deux séries est
`#/seance/<date>` ; `#/perso` se lit après, et le §7.5 en fait le second niveau
de lecture.

**Critère d'acceptation.** `tests/equipe.test.js`, avec un `rouler` injecté qui
enregistre ses appels : un montage suivi d'une `majEquipe` de rang 5 vers 3
appelle `rouler(noeud, 5, 3, …)` et ajoute `rang-monte` ; la même mise à jour avec
`equipe.dataset.jour` différent de `modele.jour` n'appelle pas `rouler` et pose le
texte ; un rang inchangé n'ajoute aucune classe ; une position passant de `null`
à `3` n'anime pas ; et une `majEquipe` quelconque laisse intact un nœud témoin
posé dans le `.bloc-equipe` à côté du `.equipe` — la preuve que le bloc du PRP 08
n'est jamais emporté. À la main, dans un navigateur : le roulement se voit, puis
avec `prefers-reduced-motion: reduce` le nombre est posé d'un coup et l'écran
reste entièrement utilisable.

---

## Chantier 5 — Hors ligne, et les trois choses que cet écran refuse d'afficher

**Ce qu'il fait.** Il transforme trois règles du PRD en tests qu'on ne peut pas
contourner par mégarde, et il tient le critère hors ligne du §11.

**Hors ligne, c'est un critère d'acceptation, pas une option.** PRD §11 : *« Seul
le classement demande le réseau, et son absence n'empêche jamais de s'entraîner :
il affiche la dernière valeur connue et le dit. »* Trois mécanismes le tiennent,
et aucun n'est de ce chantier seul :

- **la dernière valeur connue** — `dernierRangConnu.instantane`, écrit par le
  PRP 08 après chaque réponse, lu ici sans réseau ;
- **sa date** — `datationEquipe`, qui affiche le jour du classement et signale
  qu'il n'a pas été actualisé aujourd'hui ;
- **et l'app le dit** — la ligne d'état du PRP 08, juste sous ce bloc, qui donne
  `Pas de réseau.` et la fraîcheur de réception.

**Les deux lignes ne disent pas la même chose et ne doivent pas se recouvrir.**
Celle-ci date **les nombres affichés** — le jour dont le dénominateur est celui
du classement. Celle du PRP 08 date **la réception** et l'état du téléphone. Un
podium sans sa date se lit comme un podium en direct ; une fraîcheur sans le jour
ne dit pas sur quel dénominateur porte le « 3e sur 10 ».

**Les trois refus, chacun avec son test.**

**1. Le podium nomme trois personnes, la position en nomme zéro** (PRD §9). Le
serveur applique déjà la règle — il n'envoie pas le pseudonyme du quatrième —, et
`podiumDe` la réapplique en ne retenant que les lignes porteuses d'un `pseudo`.
Deux gardes valent mieux qu'une quand la règle protège un enfant : la première
empêche le nom de transiter, la seconde empêche de l'afficher s'il transitait un
jour. **Le test** vérifie qu'un instantané dont les neuf lignes portent toutes un
pseudonyme — un serveur mal configuré, ou un test mal écrit — ne produit toujours
que `PODIUM_MAX` lignes.

**2. Aucun second classement sur le volume** (PRD §9, §13). Le cumul de pompes et
de kilomètres est *« un récit, pas un rang »* ; il classerait dans le même ordre
que la régularité, *« à du bruit près »*, et *« deux podiums qui disent la même
chose, c'est un podium plus de la confusion »*. **Le test** lit la source de
`web/vue-equipe.js` et échoue si `totauxAccomplis`, `lignesVolume` ou `pompes` y
apparaît, commentaires compris — le même contrôle littéral que le PRP 05 applique
à `vue-perso.js`, et pour la même raison : ni analyseur syntaxique, ni dépendance.

**3. Aucun total d'équipe** (PRD §4 et §15.2, tranché). *« L'effectif exact n'est
pas connu et le produit n'en dépend pas. […] Une équipe de dix comme de vingt doit
fonctionner sans changer une ligne. »* Tout dénominateur affiché par cet écran
vient de `instantane.participants`, éventuellement augmenté de un, et de nulle
part ailleurs. **Deux tests** : la source ne contient pas la sous-chaîne
`effectif` ; et les trois instantanés à 3, 9 et 20 participants rendent `sur 4`,
`sur 10` et `sur 21` pour un même non-participant, ce qui ne peut pas passer si
un nombre est écrit en dur.

**Critère d'acceptation.** Les cinq assertions ci-dessus passent. À la main,
réseau coupé depuis les outils de développement puis `F5` : `#/perso` affiche le
podium, la position, la jauge, la ligne `Classement de vendredi 7 août — pas
encore actualisé aujourd’hui.`, la ligne d'état `Pas de réseau. Dernière mise à
jour il y a 2 h.` du PRP 08 ; taper « Actualiser » ne jette rien et laisse les
nombres inchangés ; le reste de l'application reste entièrement utilisable, une
séance se coche de bout en bout.

---

## Ce qui reste à trancher avant d'exécuter

**Trois questions que ce document posait ne se posent plus.** Le PRP 08 a été
aligné sur le contrat du PRP 07 et a tranché ce qu'il laissait ouvert :
`web/classement.js` lit désormais la forme du PRP 07 ; `synchroniser` fait suivre
un `GET` après un `POST` accepté, donc le podium est frais après chaque envoi et
le troisième cas de `positionDe` ne se produit jamais ; et
`dernierRangConnu.moi` porte le corps entier de la réponse d'envoi, `jour` et
`ignores` compris, donc le garde-fou de minuit du chantier 4 a bien de quoi
comparer.

| Question | Qui tranche | Ce qui bouge selon la réponse |
|---|---|---|
| **Les scores survivent-ils à un redéploiement ?** (PRD §12.1) | l'exploitation du serveur | Tout. C'est le verrou en tête de document : « non » fait tomber le PRP 07, donc le 08, donc celui-ci |
| **« Le dénominateur inclut celui qui regarde » entre-t-il au PRD §7.5 et §9 ?** | le décideur du PRD | Rien dans le code : ce PRP tranche `participants + 1` et la démonstration est au chantier 1. Ce qui bouge est la source — sans cette phrase, l'exemple chiffré du §7.5 (« 3e sur 9 ») contredit l'écran (« 3e sur 10 » pour qui n'a pas rejoint), et la règle survivra moins longtemps que le document qui la porte |
| **Page 3 sur 3 de la note du coach** (PRD §12.3) | le coach, avant le 17 août | Rien dans cet écran. `programme.json` gagne des séances, `progression` suit, `instantane.programmees` suit, et le garde-fou de comparabilité du chantier 1 signale le seul cas gênant — un téléphone dont le service worker sert encore l'ancien fichier |

**Ce que ce PRP tranche et ne renvoie donc pas plus loin :** le dénominateur
affiché à un non-participant, que le PRP 08 lui laissait explicitement, vaut
`participants + 1`. La démonstration est au chantier 1, et la phrase qui doit
remonter au PRD §7.5 et §9 y est écrite telle qu'elle s'y insère.

## Points d'attention

**Le PRP 05 interdit trois mots dans `vue-perso.js`, et le PRP 08 en casse un.**
`tests/perso.test.js` porte l'assertion *« l ecran perso ne parle a personne et ne
compare a personne »*, qui refuse les sous-chaînes `fetch(`, `classement` et
`podium` dans `web/vue-perso.js`. Le PRP 08 y ajoute
`import { monterActionClassement } from './vue-rejoindre.js'` : la sous-chaîne
`classement` y est, et le test tombe sur **sa** branche, pas sur celle-ci.
L'ajustement lui appartient. Ce PRP, lui, n'introduit aucun des trois mots —
`monterEquipe`, `vue-equipe.js` — et il doit veiller à ce que l'assertion amendée
continue d'interdire `fetch(` : l'écran perso ne parle toujours à personne, c'est
`vue-equipe.js` qui appelle `synchroniser`. Si tu trouves `tests/perso.test.js`
rouge en ouvrant cette branche, c'est le symptôme de cet ordre-là, pas un défaut
de ce PRP.

**Ne recalcule pas un rang que le serveur a déjà tranché.** Le deuxième cas de
`positionDe` prend `moi.rang` tel quel. La tentation de tout unifier — un seul
calcul local pour tout le monde — produirait un rang qui ignore le départage du
PRD §9, *« à égalité, le premier arrivé à ce score est devant »*, que seul le
serveur peut connaître : il stocke les horodatages de réception, et le client n'a
aucun champ où les lire. Deux enfants à 19 cases verraient tous les deux « 3e »,
et le podium, lui, en montrerait un devant l'autre.

**Le rang change à minuit sans que personne n'ait bougé.** À 00 h 00 heure de
Paris, `programmees` augmente d'un jour de séance et toutes les `part` chutent.
L'écran doit s'en accommoder sans mentir : `datationEquipe` dit le jour du
classement affiché, et l'animation se tait quand `bloc.dataset.jour` a changé.
Une app ouverte toute la nuit ne doit pas annoncer une dégringolade à 00 h 01.

**Le pourcentage du podium peut reculer, comme celui de l'écran perso.** Le PRP 05
le dit pour « Ma progression » et la cause est la même ici : le dénominateur
grandit à chaque nouvelle séance programmée. La phrase de la jauge porte donc
toujours ses deux nombres — *« 121 exercices sur 198 »* — et jamais le seul
pourcentage. Ne l'abrège pas : c'est ce qu'elle explique qui disparaîtrait.

**Un pseudonyme est du texte hostile jusqu'à preuve du contraire.** Il vient d'une
page publique, sans authentification. `textContent` partout, et rien d'autre — pas
d'`innerHTML`, pas de `insertAdjacentHTML`, pas de gabarit assemblé. Le PRP 07
refuse déjà les catégories Unicode `Cc`, `Cf`, `Co`, `Cs` et `Mn` à l'entrée ; ce
n'est pas une raison pour relâcher la sortie, la validation d'entrée et le rendu
n'étant pas déployés au même moment.

**`X-Forwarded-User` n'a rien à faire ici, pas même dans un commentaire.**
`./init.sh --check` (`init.sh:1444-1452`) refuse la chaîne dans tout fichier suivi
de `apps/marcq-handball/` **hors `.md`**. Ce document a le droit de la nommer ;
`vue-equipe.js` ne l'a pas — même pour expliquer qu'on ne la lit pas. L'identité,
dans cette application, est un pseudonyme choisi et un code à quatre chiffres.

**`vue-equipe.js` importe `vue-jour.js` pour `dateEnToutesLettres`, et
`recompenses.js` pour `rouler`.** Deux conséquences : ce bloc ne se charge pas si
l'un des deux manque de la coque hors ligne — ils y sont depuis les PRP 03 et 06 —
et renommer l'un de ces exports casse cet écran. C'est le prix à ne pas payer une
seconde table de mois ni une seconde courbe de roulement dans l'application.

**Les accents vont dans ce que l'enfant lit, pas dans le code.** Règle de
l'ossature §9, valable pour les onze PRP : les libellés, les phrases affichées et
les messages portent leurs accents ; les commentaires, les noms de fonctions, de
variables et de tests restent en ASCII.

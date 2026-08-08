# marcq-handball

URL : https://marcq-handball.apps.billbob.ovh — palier d'exposition : `public`.

Le programme d'été U15 du Marcq Handball, du 3 au 21 août 2026 : les séances du
coach, cochables d'un tap, sur le téléphone de l'enfant.

## Le partage serveur / navigateur

Le serveur ne connaît **aucun** utilisateur. Il sert la coque embarquée par
`go:embed`, une sonde de santé, et — depuis le lot 2 — **un seul état** : le
classement. Le domaine, la progression et le prénom vivent dans le navigateur,
en modules ES natifs : pas de bundler, pas de `node_modules`, pas de
transpilation.

Le palier est `public` : Traefik n'authentifie personne, ne pose donc aucun
en-tête d'identité, et l'application n'en lit aucun. Ce qui est propre à un
visiteur reste sur son appareil (`localStorage`), à l'exception de ce qu'il
choisit d'envoyer au classement : un pseudonyme, un code à 4 chiffres et des
identifiants d'exercices.

**Le prénom de l'enfant ne quitte jamais son appareil** (PRD §5), et c'est la
*forme* de l'API qui le garantit, pas une consigne : le corps accepté a
exactement cinq champs, tout champ inconnu fait échouer la requête entière,
aucun en-tête n'est lu, les journaux ne portent que méthode, chemin, statut,
durée et des **nombres** — jamais une valeur reçue, pas même refusée — et la
fiche stockée n'a aucun champ pour accueillir un nom. Ce que les journaux disent
de l'usage, et ce qu'ils n'en diront jamais : « Savoir si quelqu'un s'en sert ».

## Routes

| Route | Réponse |
|---|---|
| `GET /` | `web/index.html` |
| `GET /<fichier>` | le fichier de `web/`, servi à la racine |
| `GET /programme.json` | `application/json`, `Cache-Control: no-cache` |
| `GET /sw.js` | `application/javascript`, `Cache-Control: no-cache`, version injectée |
| `GET /healthz` | `200 ok`, `text/plain` |
| `GET /api/classement` | le classement du jour, `no-store` |
| `POST /api/classement` | un envoi, ou un retrait — voir plus bas |
| `GET /api/coach` | le même tableau, plus des agrégats, `no-store` |
| tout le reste | `404` |

Toutes les réponses portent `X-App-Version` : vérifier un déploiement ne
demande pas d'ouvrir la page.

## Le classement

### Ce qu'il classe

La **part d'exercices accomplis parmi ceux déjà programmés à la date du
serveur** — pas sur les 53 du programme entier, sinon tout le monde est à 15 %
le 5 août (PRD §9). Le dénominateur est le même pour tous et change à minuit,
heure de Paris ; c'est pourquoi chaque réponse porte son champ `jour`.

Trois règles sont appliquées **par le serveur**, donc inviolables par un bogue
d'affichage :

- **le podium nomme trois marches**, pas trois personnes — une marche est un
  score, et tous ceux qui la partagent y sont nommés. Le champ `pseudo` n'est
  émis pour aucune autre ligne, ni pour une marche de plus de **huit** : celle-là
  se lit à son effectif, que le client déduit du nombre de lignes portant le même
  rang. Chaque marche est jugée seule — une marche courte sous une marche muette
  nomme quand même ;
- **à égalité, personne n'est devant** : deux enfants au même nombre de cases
  portent le même `rang`, et l'heure à laquelle ils ont coché n'y change rien. Le
  rang compte les enfants devant et non les scores : après trois premiers ex
  aequo vient un 4e, jamais un 2e. La réponse à un envoi porte `exAequo`, le
  nombre des autres à ce rang, moi excepté ;
- les identifiants d'une séance future ou inconnus du programme sont **ignorés**,
  ni comptés ni stockés.

Après le 21 août, l'envoi répond `409 classement-fige` : le classement ne bouge
plus. Le **retrait**, lui, reste ouvert — le gel protège le rang, pas le droit
d'effacer sa fiche (PRD §14).

### `POST /api/classement`

`Content-Type: application/json`, **exactement six champs**, aucun autre
accepté :

```json
{
  "pseudo": "Renard",
  "code": "4821",
  "faits": ["s1-c1", "s1-c2"],
  "ressentis": { "2026-08-03": "correct" },
  "supprimer": false,
  "reprise": false
}
```

`pseudo` et `code` sont toujours obligatoires ; `faits` l'est sauf en
suppression ; `ressentis`, `supprimer` et `reprise` sont facultatifs. Réponse
`201` à la création du pseudonyme, `200` à chaque mise à jour.

**L'envoi remplace, il n'ajoute pas.** L'ensemble reçu *devient* l'ensemble du
participant : décocher se propage. Les horodatages serveur, eux, survivent au
remplacement, sans quoi chaque envoi remettrait à zéro le départage des ex æquo.

**Sauf un : `"reprise": true`.** C'est le seul envoi qui n'enlève rien — il
prend l'**union** de ce qu'il reçoit et de ce qui est déjà stocké, et il est le
seul dont la réponse porte `faits`, un objet `{ identifiant: horodatage }` qui
rend la fiche entière. C'est ce qui permet à un enfant d'ouvrir l'application sur
un second téléphone, de saisir son nom et son code, et d'y **retrouver** sa
progression. Sans ce drapeau, son ensemble vide écraserait la fiche — le défaut
constaté en production le 2026-08-07, anomalie 17 du journal.

Deux propriétés le tiennent, et aucune ne se relâche :

- **Le drapeau ne change pas qui a le droit d'écrire.** Le code est vérifié
  avant, exactement comme sur un envoi ordinaire ; un code refusé rend `403` et
  ne touche à rien. `reprise` n'est donc pas une porte pour lire la fiche d'un
  nom lu sur le podium.
- **Un seul écran le pose** : celui où l'on saisit un nom et un code. Les envois
  automatiques gardent le remplacement — c'est lui qui fait qu'une case décochée
  par erreur se rattrape. Le serveur ne le devine jamais : il ne sait pas
  distinguer « nouveau téléphone » de « téléphone qui a tout décoché », et
  deviner reviendrait à choisir la mauvaise moitié du temps.

`{"pseudo": "…", "code": "…", "supprimer": true}` efface la fiche entière et
**libère le pseudonyme**. L'opération est idempotente : un second appel rend
`200` et `"supprime": false`, jamais une erreur.

**Le code à 4 chiffres n'est pas un mot de passe.** Il attache un pseudonyme au
premier envoi qui le crée, et n'ouvre qu'une seule lecture : la fiche de ce
pseudonyme, sur un envoi de reprise, c'est-à-dire ce que l'enfant a lui-même
coché. Il ne protège aucune autre donnée et n'identifie personne — ce qu'il
rend, un ensemble d'identifiants d'exercices, est déjà résumé publiquement par le
nombre de cases affiché au classement. Il n'est jamais stocké en clair —
pbkdf2-sha256, sel de 16 octets, 100 000 itérations — non pour protéger le
serveur, où il n'y a rien à protéger, mais parce qu'un ado saisira très
probablement le code de déverrouillage de son téléphone. Un code oublié **ne se
récupère pas** : le recours est de choisir un autre pseudonyme.

### Les erreurs

Une seule enveloppe, `{"erreur": "<code>", "message": "<français>"}`, le
`message` étant destiné à être affiché **tel quel**.

| Cas | Statut | `erreur` |
|---|---|---|
| corps illisible, > 8 Kio, ou champ inconnu | `400` | `json-invalide` |
| pseudonyme vide, trop long, caractère refusé | `400` | `pseudo-invalide` |
| code différent de quatre chiffres | `400` | `code-invalide` |
| `faits` absent (hors suppression) ou trop long | `400` | `faits-invalide` |
| `ressentis` mal formé | `400` | `ressentis-invalide` |
| pseudonyme existant, code différent | `403` | `code-refuse` |
| 5 codes refusés en 15 min sur ce pseudonyme | `429` + `Retry-After: 900` | `trop-d-essais` |
| 200 participants atteints, pseudonyme nouveau | `409` | `classement-plein` |
| envoi après le 21 août | `409` | `classement-fige` |
| magasin absent ou non inscriptible | `503` + `Retry-After: 60` | `classement-indisponible` |

Le `405` d'une mauvaise méthode vient de `http.ServeMux` et ne porte **pas**
cette enveloppe : ne décoder le JSON que si le `Content-Type` de la réponse est
`application/json`.

### Où il est stocké

Un fichier `classement.json` dans le volume `marcq-handball-donnees`, réécrit
atomiquement à chaque modification. Le magasin est un **cache de ce que les
téléphones détiennent déjà** : chaque envoi transmet l'ensemble complet d'un
participant, donc un fichier perdu se répare tout seul au prochain envoi de
chacun, en une journée d'usage. Ce qui ne se répare pas est l'ordre des ex æquo.

**Un seul processus écrit ce fichier.** La stack ne déclare aucune réplique et
`container_name: marcq-handball` interdit le second exemplaire ; le `sync.Mutex`
du magasin suffit tant que cela reste vrai. Le jour où deux exemplaires
tourneraient, le dernier écrivain écraserait l'autre **sans qu'aucun test ne le
détecte**.

Trois pannes ne mettent jamais l'application à terre — `/healthz` répond `200`
dans tous les cas, parce qu'un conteneur malsain retirerait du service une app
qui, à 95 %, fonctionne hors ligne dans le navigateur :

| Panne | Ce qui se passe |
|---|---|
| `MARCQ_DONNEES` non défini | classement désactivé, les trois routes `/api` rendent `503`, le reste sert normalement |
| volume appartenant à root | une sonde d'écriture le dit **au démarrage** dans les journaux, avant tout trafic ; puis même comportement que ci-dessus |
| `classement.json` illisible | renommé en `classement.corrompu-<date>.json`, on repart vide, trace sur la sortie standard |

## Savoir si quelqu'un s'en sert

Question posée le 8 août, à laquelle les journaux du conteneur ne savaient pas
répondre. Deux raisons, et deux réponses.

**Les journaux ne survivent pas au déploiement.** `dockhand` recrée la stack
entière à chaque livraison — y compris les apps qu'on n'a pas touchées — et les
lignes d'avant disparaissent. Sur un programme de trois semaines, lire l'usage
dans les journaux revient à lire les heures écoulées depuis le dernier
redémarrage. Un fichier `activite.json`, dans le même volume que le classement,
tient donc des **compteurs par journée** qui, eux, traversent :

```json
"2026-08-08": { "ouvertures": 12, "consultations": 27, "inscriptions": 1,
                "misesAJour": 2, "envoisVides": 1, "refus": { "code-refuse": 2 } }
```

Que des entiers, par jour et par événement. Le fichier **n'a aucun champ où un
nom, un identifiant d'exercice ou une adresse pourrait entrer** : il dit combien
de fois, jamais par qui — c'est la promesse du PRD §5, tenue par la forme du
fichier et non par une consigne. `ouvertures` compte des chargements de la
coque, pas des personnes : un rechargement en vaut un autre, et rien ici ne
distingue deux visiteurs.

Les compteurs montent en mémoire et descendent sur le disque **au plus une fois
toutes les 30 secondes**, plus une dernière fois à l'arrêt. C'est ce qui les
sépare d'une amplification d'écriture : `/api/classement` est une route publique
sans limite de débit, et écrire à chaque requête donnerait à n'importe qui le
moyen de faire travailler le disque aussi vite qu'il sait demander. Le fichier
est mis de côté et la mesure repart de zéro s'il devient illisible, comme
`classement.json`. Un `MARCQ_DONNEES` absent ou un volume en lecture seule
désactivent la mesure et rien d'autre : compter combien d'enfants s'entraînent
ne vaut pas d'empêcher l'un d'eux de s'entraîner.

**Les journaux ne disaient pas ce qu'un envoi portait.** Un `POST /api/classement
200` se lisait pareil qu'un envoi ait apporté douze exercices ou zéro, et un
`403` ne disait pas si un enfant s'était trompé de code ou si le nom était déjà
pris. Deux lignes le disent maintenant, toujours sans rien d'identifiant :

```
envoi : inscription, 3 cochees, 0 ignorees, 5 participants
envoi : mise a jour, 0 cochees, 2 ignorees, 5 participants
envoi : suppression effectuee, 4 participants
envoi refuse : code-refuse
```

Ce qu'elles permettent de voir : une fiche acceptée **à zéro exercice** — donc
un écran qui n'envoie pas ce qu'il croit envoyer, ou un enfant qui ne
s'entraîne pas ; un `ignorees` qui monte — donc un téléphone servant un
`programme.json` périmé depuis le cache de son service worker ; et une rafale
de `code-refuse` — donc quelqu'un bloqué à la porte du classement.

Une ligne de résumé tombe aussi dans les journaux au changement de jour, ce qui
rend la veille lisible sans ouvrir le fichier :

```
activite 2026-08-08 : 12 ouvertures, 27 consultations, 1 inscriptions, 2 code-refuse
```

Ce qu'aucune de ces deux mesures ne dira jamais : **où les gens abandonnent**.
Quelqu'un qui ouvre l'app, tape son prénom, hésite et referme ne laisse qu'une
`ouverture`. Le savoir demanderait que l'app envoie des traces de parcours — ce
que le PRD §5 interdit par défaut, et qui n'a pas été fait.

Pour lire tout ça depuis un poste de développement :

    ./scripts/prod.sh journaux marcq-handball 500
    ./scripts/prod.sh lire marcq-handball /var/lib/marcq-handball/activite.json

## Développement

```bash
./apps/marcq-handball/test.sh          # go vet, go test, node --test

cd apps/marcq-handball
go run .                               # sur http://localhost:8080
PORT=3000 go run .                     # ailleurs
MARCQ_DONNEES=/tmp/marcq go run .      # avec le classement (le répertoire doit exister)
```

**`web/` est figé dans le binaire** par `go:embed` : après toute modification
d'un fichier de `web/`, il faut relancer `go run .`, sinon le serveur continue
de servir la version qu'il avait au démarrage. C'est la contrepartie — voulue —
de l'absence de chaîne de construction.

Sans `MARCQ_DONNEES`, le serveur local est exactement celui du lot 1 : les trois
routes `/api` rendent `503` et le reste fonctionne. C'est aussi l'état sous
`go test`, sauf dans les tests qui ouvrent leur propre magasin.

Le service worker met la coque en cache par version. En développement local la
version vaut `dev` et le cache ne change donc jamais de nom : recharger avec le
cache désactivé, ou vider `marcq-dev` dans les outils du navigateur.

## Variables d'environnement

Aucun secret n'est attendu, et rien de sensible ne doit transiter : tout ce que
le navigateur reçoit est public par construction.

| Nom | Rôle | Défaut |
|---|---|---|
| `PORT` | port d'écoute HTTP en clair dans le conteneur | `8080` |
| `MARCQ_DONNEES` | répertoire du classement. **Vide ou absent : le classement est désactivé** et les trois routes `/api` rendent `503`. Posée par le `Dockerfile` à `/var/lib/marcq-handball`, le point de montage du volume | *(vide en local)* |

## Besoins d'infrastructure

**Un volume nommé, et rien d'autre** : ni base de données, ni cache, ni port
supplémentaire, ni secret. Il est déclaré dans `app.yml` et `docker compose up`
le crée tout seul — aucune action sur le serveur, jamais.

| | |
|---|---|
| Volume | `donnees:/var/lib/marcq-handball`, soit `marcq-handball-donnees` |
| Propriétaire | uid `10001`, donné par le `Dockerfile` **avant** `USER` |
| Taille attendue | ~500 Kio : 200 participants × 53 identifiants × ~40 octets |
| Sauvegarde | **non demandée** — voir ci-dessous |

Le motif est le PRD §12.1 : *« Les scores du classement doivent survivre à un
redéploiement. Un classement remis à zéro à chaque publication d'image serait
pire que pas de classement. »* La demande porte donc sur la **persistance entre
deux déploiements**, pas sur la durabilité des données — une exigence beaucoup
plus faible, et il faut la lire ainsi : le magasin est un cache de ce que les
téléphones détiennent déjà.

`docker volume rm marcq-handball-donnees` n'est pourtant pas gratuit : chaque
enfant repart à zéro jusqu'à son prochain envoi, et l'ordre des ex æquo se
reconstruit dans l'ordre des renvois. Pour le sauvegarder :

```bash
docker run --rm -v marcq-handball-donnees:/d -v "$PWD":/sortie alpine \
  tar czf /sortie/marcq-handball-donnees.tgz -C /d .
```

## Modifier le programme

Le programme vit dans `web/programme.json` et nulle part ailleurs. Le changer ne
demande de toucher à aucune ligne de code : les totaux affichés en sont
recalculés (`web/domaine.js`), et `tests/domaine.test.js` les vérifie.

Le format est fixé par `prp/00-ossature.md` §4. Trois règles suffisent à ne pas
se tromper :

- **Une ligne d'exercice est une case à cocher**, quel que soit le nombre de
  tours. `tours` multiplie le volume, jamais le nombre de cases.
- **`id` est stable et ne se réattribue jamais.** C'est la clé de la progression
  enregistrée sur le téléphone de chaque enfant : renuméroter un identifiant
  efface la progression de tout le monde. Un exercice retiré laisse son
  identifiant à la retraite.
- **`mesure.valeur` est le volume d'un seul tour**, et `mesure.unite` vaut
  `pompes`, `squats`, `burpees`, `abdos`, `gainage_s`, `min_course`, `fentes` ou
  `autre`. Un exercice sans volume calculable — une distance sans durée, une
  chaise contre un mur — porte `autre` et n'entre dans aucun total.

Pour les blocs de course, on retient la durée totale du bloc, récupérations
comprises, dès que le coach a écrit les durées ; `autre` dès qu'il n'a écrit
qu'une distance. On ne convertit jamais une distance en durée.

Après toute modification :

```bash
./test.sh
```

Les assertions de totaux échoueront tant que le fichier ne se recalcule pas sur
les valeurs attendues. Si le programme change vraiment de contenu, ce sont ces
valeurs attendues qu'il faut mettre à jour — dans le test, jamais dans le code.

### Le programme est complet, et il ne bougera plus

**Tranché le 7 août : il n'y a pas de programme après le 17 août** (PRD §12.3,
clos). La capture s'arrêtait après le lundi 17 parce que le programme s'arrête
là — elle n'était pas incomplète. Les sept séances, les 53 exercices et les
dix-neuf jours sont définitifs.

Ce que ça change pour qui touche à `web/programme.json` : plus rien n'oblige à y
ajouter des séances, mais **le code n'a pas été refermé pour autant**. Les
identifiants `s8-*` restent valides, les dénominateurs restent calculés, et
`tests/documents.test.js` recalcule les cinq nombres depuis le fichier plutôt que
de les figer. Un programme qui change resterait donc correct — il n'est
simplement plus attendu.

## Les écrans et leurs routes

Le navigateur porte tout : le domaine, l'état et les écrans. Le serveur sert des
fichiers statiques et une sonde de santé, et ne connaît aucun utilisateur.

| Route | Écran | Fichier |
|---|---|---|
| `#/` (ou adresse sans ancre) | la séance du jour, ou le repos, ou la fin | `web/vue-jour.js` |
| `#/seance/<YYYY-MM-DD>` | une séance : la liste complète, cochable si sa date est passée ou en cours (PRD §9) | `web/vue-seance.js` |
| `#/perso` | ma progression : la part, le volume accompli, le calendrier | `web/vue-perso.js` |
| `#/equipe` | l'équipe : podium, position, jauge de groupe, et le geste pour rejoindre ou récupérer | `web/vue-classement.js` |
| `#/reglages` | corriger le prénom, changer d'enfant | `web/vue-reglages.js` |

**`#/equipe` a un onglet, `#/rejoindre` n'en a pas**, et la distinction est la
règle : un onglet mène à ce qu'on **regarde**, jamais à ce qu'on **décide**. Le
consentement reste derrière un bouton, « au moment où il y a un vrai choix à
faire » (PRD §7.4). L'écran de l'équipe est un simple contenant — il ne calcule
rien et n'appelle personne : tout ce qu'il montre vient de `web/vue-equipe.js`,
tout ce qu'il fait vient de `web/vue-rejoindre.js`. Il ne pose pas non plus de
titre : `monterEquipe` écrit déjà le sien, et un second l'affichait deux fois.

Tant qu'aucun prénom n'est enregistré, aucune route n'est honorée :
`web/vue-prenom.js` s'affiche à la place. C'est le seul péage de l'application.

**Ajouter un écran** demande trois lignes dans `web/app.js` — un `import`, une
entrée dans `ECRANS`, et un lien dans `LIENS` si l'écran mérite un onglet — plus
son fichier `web/vue-*.js`. Un écran est une fonction `(hote, ctx) => démontage`,
`hote` étant vidé par le routeur avant chaque montage. Le contexte `ctx` porte
`prog`, `aujourdhui`, `prenom`, `faits`, `route`, `aller(route)` et
`rafraichir()` ; il est relu à chaque rendu, et un écran ne le mute jamais.

**Ce qui est enregistré sur le téléphone**, et rien d'autre (`web/etat.js`) :

| Clé | Valeur |
|---|---|
| `marcq.v1.prenom` | le prénom, 24 caractères au plus |
| `marcq.v1.faits` | `{ "<id d'exercice>": "<horodatage ISO>" }` |
| `marcq.v1.classement` | `{ pseudo, code, dernierEnvoi, dernierRangConnu }` — écrite seulement si l'enfant a rejoint |

Un stockage refusé — navigation privée — ou plein ne casse rien : les valeurs
sont gardées en mémoire pour la durée de l'onglet. Elles ne survivent alors pas
à la fermeture, ce que la page de réglages annonce.

## Le minuteur d'un exercice

Chaque exercice porte un minuteur, à droite de sa ligne — `web/chrono.js`, monté
par `web/vue-seance.js`.

**C'est le programme qui décide du mode, jamais l'enfant.** Un exercice dont la
durée est prescrite reçoit un **compte à rebours** — 24 des 53 cases ; les 29
autres, comptées en répétitions, reçoivent un **chronomètre** qui monte.

**La durée écrite dans le libellé gagne sur la mesure**, et c'est la leçon d'un
défaut signalé : « 45 s de chaise contre un mur » porte `unite: autre,
valeur: 0` — le programme ne le compte dans aucun total — et recevait donc un
chronomètre, alors que son libellé prescrit quarante-cinq secondes en toutes
lettres. **La mesure sert les totaux, le libellé sert l'enfant** ; quand les deux
diffèrent, c'est le second qui a raison, parce que c'est celui qu'il lit. On
retient la **première** durée écrite — l'effort, jamais la récupération qui le
suit ni le total qui l'englobe — et le **plancher** d'une fourchette. Sept
exercices sont dans ce cas, nommés un par un dans `tests/chrono.test.js`.

Le motif exige une unité explicite (`s`, `sec`, `min`, `mn`, `minute(s)`) et
garde sa fin avec un **lookahead Unicode, jamais `\b`** : en JavaScript, `\b`
ignore les accents, « 2 séries » se lisait donc « 2 s » et prescrivait deux
secondes. Ni le mètre de « 6 × 100 m » ni celui de « 30-30 m à 80 % » ne compte. Un rebours sur « 15 pompes » inventerait une limite
que le coach n'a pas donnée ; un chronomètre sur un gainage de 45 s demanderait à
l'enfant de surveiller un nombre au lieu de tenir sa position.

Quatre décisions valent d'être connues avant de toucher à ce fichier :

- **Le bouton est HORS de l'étiquette**, et c'est structurel : l'étiquette couvre
  toute la ligne — c'est ce qui donne sa zone de tap pleine largeur — donc un
  bouton posé dedans **cocherait l'exercice à chaque démarrage**. Un test lit
  l'ordre des `append` pour l'interdire.
- **Le temps se calcule, il ne s'incrémente pas.** L'état garde l'instant du
  dernier démarrage et le temps déjà acquis ; un onglet mis en veille cesse de
  recevoir ses battements, et un minuteur qui les compterait afficherait 3 s au
  bout de 30.
- **Un seul minuteur tourne à la fois.** L'écran crée un « orchestre » et le
  passe à chacun : en démarrer un fige celui qui tournait. Deux comptes à rebours
  concurrents sur un téléphone tenu à bout de bras ne se lisent pas.
- **Aucune persistance, aucun réseau.** Un rebours qui reprendrait à 12 s deux
  jours plus tard serait plus déroutant qu'utile. Il ne coche rien tout seul :
  cocher reste le geste de l'enfant (PRD §7.3). Le minuteur ne lit du téléphone
  qu'**une** chose, et c'est une préférence : la sonnerie choisie.
- **À zéro, il sonne ET il vibre** — jamais l'un à la place de l'autre : le
  téléphone est souvent posé à terre pendant un gainage, et la poche étouffe la
  vibration comme le vacarme d'un gymnase couvre le bip.

### La sonnerie : deux synthétisées, une enregistrée

`web/sonnerie.js` porte quatre choix : *Bip*, *Cloche*, *Sifflet*, et
*Silencieux* — une vraie option, une séance se faisant aussi dans un salon à côté
de quelqu'un qui dort. Aucune ne dépasse une seconde et demie ; au-delà, ce n'est
plus un signal, c'est une alarme qu'on cherche à faire taire.

**Le bip et la cloche sont synthétisés à la volée** par l'oscillateur du
navigateur : rien à télécharger, et l'image ne grossit pas d'un octet. Le bip est
deux notes qui *montent* — deux notes identiques disent « attention », deux notes
qui montent disent « c'est fini ». La cloche est cinq partiels frappés **au même
instant**, aux rapports inharmoniques d'une cloche réelle (1, 2, 2.76, 5.40,
8.93) : c'est leur désaccord qui fait entendre du métal, et jouer les mêmes
partiels l'un après l'autre ferait une gamme.

**Le sifflet, lui, est un enregistrement** — `web/sifflet.wav`, 25 Ko, un coup
d'arbitre pris dans un gymnase, du domaine public
([CC0, SpliceSound](https://freesound.org/people/SpliceSound/sounds/218318/), via
Wikimedia Commons ; ramené à un seul coup, mono, 24 kHz). Il a remplacé trois
sinusoïdes à 2100 Hz qui ne ressemblaient pas à un sifflet : ce qui fait le
sifflet est le battement de la bille et le souffle, qu'aucun empilement
d'oscillateurs simples ne reproduit. Le fichier est en **même origine**, servi
par l'app elle-même — l'ossature §2 interdit le domaine tiers, pas le fichier
livré — et il est dans la coque hors ligne de `sw.js`. Le second coup n'est pas
dans le fichier : c'est le même, rejoué 0,6 s plus tard, deux coups enregistrés
pesant le double pour le même son. **Repli** si le fichier ne se décode pas ou
n'a pas encore été mis en cache : les trois bips d'avant. Un sifflet approximatif
vaut mieux qu'un minuteur muet à zéro.

**Le son ne part qu'après un geste, et c'est la seule vraie difficulté.** Un
navigateur de téléphone refuse de jouer quoi que ce soit tant que rien n'a été
touché, et il ne rend pas d'erreur : il se tait. Or le zéro d'un rebours n'est
pas un geste. C'est donc le **tap qui démarre le minuteur** qui réveille l'audio
— `preparer()` n'existe que pour cela — ce qui donne toute la durée du rebours
d'avance. Un test lit la source pour vérifier que ce réveil vit bien dans le
gestionnaire du bouton, et avant que l'état ne bascule. **C'est ce même geste qui
va chercher le fichier du sifflet** : le zéro est trop tard pour découvrir qu'il
manque, et le décodage étant une promesse, la sonnerie part au tour de boucle
suivant plutôt que d'imposer un `jouer` asynchrone à tout le monde.

Le choix vit sous `marcq.v1.sonnerie` et se règle dans **Réglages**, juste après
le prénom. **Choisir, c'est entendre** : cocher une sonnerie la joue aussitôt —
sans quoi il faudrait revenir à une séance, lancer un rebours et attendre son
zéro pour savoir ce qu'on vient de choisir. Une clé inconnue — écrite par une
version future, ou à la main — retombe sur *Bip* : le minuteur sonne quand même.

Le bouton de remise à zéro est masqué par `visibility` et jamais par `hidden` :
`hidden` rétrécirait la ligne tant que le minuteur dort, et son apparition au
premier tap décalerait le libellé sous le pouce qui vient d'appuyer.

## Le lien vidéo d'un exercice

Un enfant de treize ans qui lit « 15 dips sur une chaise » a besoin de **voir** le
mouvement. Chaque exercice porte donc un lien `▶` — `web/video.js`, monté par
`web/vue-seance.js`, dans la même colonne de droite que le minuteur.

**Deux sources, et la première gagne :**

1. **`ex.video` dans `programme.json`** — une adresse choisie et *vérifiée par un
   adulte*. Le champ est **facultatif** et n'est rempli nulle part aujourd'hui ;
   il existe pour qu'une réponse puisse être donnée sans toucher à une ligne de
   code. Le lien annonce alors « Voir la vidéo : *mouvement* ».
2. **à défaut, une recherche** sur le mouvement reconnu. Le lien annonce
   « Chercher une vidéo qui montre : *mouvement* » — deux promesses différentes,
   deux phrases différentes.

Le repli est un choix assumé : **proposer une vidéo précise que personne n'a
visionnée reviendrait à la mettre sous les yeux d'un enfant sur la foi de son
titre.** Une recherche laisse ce dernier pas à l'humain qui regarde l'écran.

`MOUVEMENTS` est une liste **ordonnée, du plus précis au plus général** : le
premier motif qui correspond gagne. « squats sautés » passe donc avant
« squats », et « gainage de chaque côté » avant « gainage » — montrer le
mouvement voisin est pire que ne rien montrer, parce que l'enfant croit avoir
compris. Deux tests tiennent cette liste : l'un vérifie qu'**aucun des 53
exercices** ne reste sans lien — ajouter une séance sans ajouter son mouvement le
fait échouer —, l'autre épingle vingt correspondances attendues.

Le lien sort de l'application : `target="_blank"` et `rel="noopener noreferrer"`,
la séance restant ouverte derrière avec ses cases et son minuteur en cours. Rien
n'est **chargé** depuis un domaine tiers : pas d'`iframe`, pas de lecteur
intégré — l'ossature §2 l'interdit, et un lien n'est pas un chargement.

## L'écran « Ma progression »

Trois choses, dans cet ordre (PRD §7.5) : la **part** des exercices accomplis
parmi ceux **programmés à ce jour** — jamais sur les 53 du programme entier,
sinon tout le monde est à 15 % le 5 août (PRD §9) ; le **volume cumulé
accompli**, somme de ce qui a été coché, en langage d'ado (« 112 pompes, …
2 h 10 de course ») ; et le **calendrier des dix-neuf jours**, où les jours sans
séance sont du repos et non un trou.

Les six états d'une case viennent du domaine et ne sont ni fusionnés ni
inventés : `faite`, `commencée`, `aujourd’hui`, `à venir`, `manquée`, `repos`.
Une case de séance ouvre sa séance ; une case de repos n'est pas cliquable.

Le volume ne produit **aucun classement** (PRD §9) : il est déduit du programme,
il classerait dans le même ordre que la régularité. La comparaison à l'équipe est
le second niveau du §7.5 et arrive au lot 2, sous le calendrier.

## Rejoindre le classement, côté navigateur

Deux modules, et la séparation est le sujet : `web/classement.js` décide **ce
qui est envoyé**, `web/vue-rejoindre.js` **ce qui est dit**. C'est ce qui rend
vérifiable, sans navigateur ni réseau, que le prénom ne peut pas atteindre la
couche réseau — deux tests lisent la source des deux fichiers et échouent si le
mot y apparaît, commentaires compris.

**Le consentement n'est pas un écran d'accueil.** On y arrive par un bouton posé
sous le calendrier de « Ma progression », jamais par un onglet : le PRD §7.4 le
veut « au moment où il y a un vrai choix à faire ». `#/rejoindre` existe dans le
routeur et dans aucun menu.

**Il n'y a pas de file d'attente, il y a une comparaison.** Chaque envoi porte
l'ensemble complet des cases cochées, jamais un delta : il est donc idempotent,
et deux envois successifs ne se composent pas. On garde l'empreinte du dernier
envoi *accepté* — nombre de cases, plus horodatage le plus récent — et un envoi
est dû dès que l'état local en diffère. Un envoi perdu ne laisse aucune trace, et
le déclencheur suivant le refait tout seul.

Quatre déclencheurs, et eux seuls : une fois au démarrage (après le premier
rendu), à la fin d'une séance, au retour du réseau, et sur un geste explicite.
**Jamais à chaque case cochée** — 53 requêtes sur un programme, c'est ce qui
ferait mordre la limite de débit du palier public sur un enfant réel plutôt que
sur un robot.

### Ce qu'un refus doit faire, et où il doit s'écrire

**Un message d'erreur se lit sous son champ.** Le formulaire portait une seule
ligne de retour, au bas de l'écran ; un refus s'y affichait bien, mais à un
champ, un bouton et une explication de distance du regard, et derrière le clavier
du téléphone. Le rapport correspondant disait « rien ne se passe ». Chaque champ
a donc désormais son message, sous lui, avec quatre signaux dont aucun ne suffit
seul : `role="alert"` pour l'annonce vocale, `aria-describedby` pour le rattacher
au champ, `aria-invalid` et la classe `.champ-en-erreur` pour la bordure rouge —
**le seul signal qui survit à un message poussé hors de l'écran par le clavier**
— et le focus sur le champ fautif, qui l'amène dans la fenêtre avec son message.
Le message part au premier `input` : il a fait son travail.

**Un refus propose une issue.** Un emoji dans un pseudonyme n'est pas une faute à
corriger, c'est une envie que le serveur ne sait pas stocker ; renvoyer l'enfant à
son clavier pour qu'il devine *lequel* de ses caractères dérange est une impasse.
`nettoyerPseudo` retire ce qui ne passe pas — en le remplaçant par une espace,
pour que `Tom.le.chevre` rende `Tom le chevre` et non `Tomlechevre` — et l'écran
**propose** le reste : la proposition arrive dans le champ, et c'est un second
appui qui l'envoie. Rien n'est corrigé en silence, un nom public ne se modifie pas
dans le dos de celui qui le porte. Quand il ne reste rien à garder, le refus est
dit franchement.

### Trois comportements à connaître avant de les découvrir

**Un second téléphone récupère au moment où il rejoint, et écrase ensuite.** Le
même pseudonyme et le même code saisis ailleurs, c'est exactement ce que le code
sert à permettre — et la saisie du code est un envoi de **reprise** : elle prend
l'union, ne retire rien, et rend la fiche, que l'écran fusionne dans la
progression locale. L'enfant retrouve donc ses séances sur le nouveau téléphone.

**La reprise a deux portes, et la seconde est celle qui sert vraiment.** L'écran
de saisie n'est atteignable que tant qu'aucun nom n'est enregistré sur
l'appareil : passé l'inscription, le bouton qui y mène disparaît, par
construction. La reprise n'aurait donc eu de porte que pour celui qui n'en a pas
besoin. D'où le second geste, **« Récupérer ma progression »**, posé sous le nom
dans « Ma progression » : il renvoie une reprise avec le nom et le code **déjà
stockés**, sans rien redemander. Un test compte exactement deux `reprise: true`
dans `vue-rejoindre.js` — l'inscription et ce geste, pas un de plus.

Il remonte l'écran **quand des séances sont revenues**, et seulement dans ce
cas : la progression retrouvée est alors le message, et elle ne s'affiche qu'en
remontant. Sinon il l'écrit — « rien de plus à récupérer » —, car un remontage
qui n'affiche rien de neuf se lit comme un bouton qui n'a pas marché.

Passé ce moment, les deux téléphones sont ordinaires et l'envoi porte l'état
complet : celui qui envoie en dernier gagne, et s'il a moins de cases cochées, le
score baisse. C'est voulu, et c'est ce qui fait tenir « le passé se corrige » du
PRD §9 — un serveur qui garderait le maximum en permanence rendrait le décochage
sans effet. Le partage à long terme d'un pseudonyme entre deux téléphones reste
donc ce qu'il était : une mauvaise idée que rien n'empêche.

**Changer de nom, c'est supprimer puis rejoindre.** Il n'y a pas de renommage :
un envoi sous un nouveau pseudonyme créerait une seconde entrée et laisserait la
première orpheline. La séquence est sûre — la fiche supprimée libère le
pseudonyme, qui peut être repris avec un autre code. Le prix : le départage des
ex æquo repart de la date de la nouvelle inscription, et les cases cochées sont
renvoyées au premier envoi qui suit.

**« Changer d'enfant » orpheline le pseudonyme.** Ce geste efface les clés
locales mais ne touche pas au serveur : le nom reste au classement et plus
personne n'en détient le code. La confirmation gagne donc une phrase — et
seulement lorsqu'un pseudonyme existe — qui invite à le supprimer d'abord.

**Le code vit en clair dans `localStorage`.** Sur un téléphone partagé, un frère
peut supprimer le pseudonyme. C'est cohérent avec le PRD §14, qui assume déjà
qu'il n'y a ni compte ni sauvegarde ; le chiffrer demanderait un secret, que le
palier `public` interdit de faire descendre au navigateur.

## L'équipe : podium, position, jauge

Le second niveau du PRD §7.5, sous le calendrier de « Ma progression ». Trois
blocs, dans cet ordre : le **podium**, qui nomme trois marches ; la
**position**, qui n'en nomme aucune ; la **jauge collective**, la seule mesure où
personne n'est dernier — et c'est elle qu'on lit en refermant.

Une marche partagée porte tous ses prénoms — *« 1er : Léa, Renard, Tom, 100 % »*
— ou, si le serveur ne l'a pas nommée, son effectif : *« 1er : 14 enfants,
100 % »*. La position dit qui partage la place : *« Tu es 4e sur 12, avec
1 autre. »*, et se tait quand il n'y a personne.

**Le dénominateur inclut celui qui regarde.** Un enfant qui n'a pas rejoint lit
« 4e sur 4 » et non « 4e sur 3 » : l'ensemble comparé, ce sont les inscrits *plus
lui*. Trois raisons, et la première suffirait — sans le « + 1 », quelqu'un de
moins avancé que tous les inscrits serait « 10e sur 9 », et écrêter son rang
reviendrait à lui promettre qu'il n'est pas dernier alors qu'il l'est. Corollaire
qui compte : **le dénominateur ne bouge pas quand on rejoint**, donc rejoindre
n'est jamais présenté comme un moyen de mieux se classer, et « Non merci » reste
un choix complet.

*(À reporter dans le PRD §7.5 et §9, dont l'exemple chiffré dit encore « 3e sur
9 » : sans cette phrase, le prochain lecteur prendra l'écran pour un défaut.)*

**Le rang tranché par le serveur n'est jamais recalculé.** Le client ne calcule
une position que pour quelqu'un que le serveur ne connaît pas — et le rang et son
dénominateur viennent alors *de la même réponse*, jamais l'un du serveur et
l'autre d'un instantané plus ancien.

**Deux lignes datent deux choses différentes.** « Classement de vendredi 7 août »
date les *nombres affichés* — le jour dont le dénominateur est celui du
classement. La ligne juste dessous date la *réception*. Un podium sans sa date se
lit comme un podium en direct.

**Le rang s'anime, mais seulement quand on a vu le changement arriver** (PRD §10).
Quatre conditions : le bloc portait déjà un rang, le jour n'a pas changé, le rang
a réellement changé, et la position existait avant. À minuit, toutes les parts
chutent parce que le dénominateur grandit — une app ouverte toute la nuit ne doit
pas annoncer une dégringolade à 00 h 01.

**Deux choses que cet écran refuse d'afficher**, et deux tests le tiennent : un
second classement fondé sur le volume — il classerait dans le même ordre que la
régularité, à du bruit près, et deux podiums qui disent la même chose font un
podium plus de la confusion (PRD §13) — et un effectif d'équipe : tout
dénominateur vient de `participants`, jamais d'un nombre écrit en dur (PRD §4).

## Le ressenti de fin de séance

`web/ressenti.js` porte les trois émojis et leur envoi.

Trois émojis — 🙂 Facile, 😐 Correct, 🥵 Dur — **dans** le panneau qui célèbre la
fin d'une séance, entre les compteurs et le bouton. Jamais un second panneau :
deux fenêtres modales ouvertes sur le même événement, c'est un écran inerte et un
enfant coincé.

**Jamais obligatoire, et l'écran le dit.** « Tu peux fermer sans répondre » est
écrit sous les trois boutons. `Continuer` garde le focus initial — sans cela, une
touche Entrée machinale enregistrerait « Facile », et la répartition lue par le
coach serait faussée dans le sens le plus flatteur.

**Le ressenti part par le même canal que le score, sous la même autorisation, et
jamais séparément.** Celui d'un enfant qui n'a pas rejoint le classement ne quitte
donc **jamais** son téléphone. Le panneau pose pourtant la question de la même
façon aux deux : aucune phrase du type « rejoins pour partager ton ressenti »,
aucun bouton grisé. « Non merci » est un choix complet, pas une punition.

Un ressenti déclenche un envoi **tout de suite** : sinon celui tapé le lundi soir
n'arriverait qu'au prochain cochage — mercredi — et la répartition serait vide le
soir où le coach regarde.

**Il ne se modifie pas après coup**, et c'est assumé : la seule façon de le
changer est de décocher puis recocher la dernière case, ce qui rouvre le panneau.
C'est cohérent avec ce qu'il mesure — une humeur datée, pas une déclaration.

## La vue coach — et pourquoi elle n'a pas de mot de passe

`web/vue-coach.js` monte cet écran.

Le lien à envoyer au coach : **https://marcq-handball.apps.billbob.ovh/#/coach**.
Il n'est listé nulle part dans la navigation de l'application.

Elle montre l'assiduité en quatre paliers, le classement, une ligne par séance et
la répartition des ressentis. Les deux mesures du PRD §4 s'y lisent directement :
le palier haut est libellé « 60 % et plus — la cible », et la part de l'effectif
encore active se lit sur la dernière ligne de séance.

**Le mot de passe statique a été écarté** (PRD §13). Sur une page publique il
donnerait l'apparence d'une protection sans en être une, et devrait de toute façon
être injecté par l'environnement — donc être un secret de plus, que le contrat de
la fabrique interdit dans le dépôt et dans l'image. Il aurait en outre un effet
inverse à celui qu'on lui prête : il ferait croire au coach que cette page peut
recevoir un jour des données nominatives.

Ce qui rend son absence acceptable n'est pas une promesse, c'est une propriété
**vérifiée** : la page n'a rien à protéger. Quatre assertions de source la
tiennent — elle n'importe aucun module qui touche au stockage du navigateur, ni
directement ni transitivement ; elle ne parle qu'à sa propre route ; elle ne
nomme jamais le prénom ; elle n'utilise pas `innerHTML`. Chaque ajout futur devra
passer par elles, et c'est ce qui empêche la dérive la plus probable de cette
page : « puisqu'on y est, montrons aussi… ».

**Si le coach veut le détail nominatif par enfant, ce sera une seconde
application**, en `exposure: private` — un autre répertoire sous `apps/`, avec son
image et son URL. Ce n'est pas un durcissement de celle-ci.

**La répartition affichée est partielle par construction** : elle ne compte que
les enfants qui ont rejoint le classement. Un coach qui lirait « 4 facile /
11 correct / 6 dur » comme le compte de son effectif se tromperait — la page le
dit, ce README aussi.

## Le bilan, après le 21 août

`web/vue-bilan.js` monte cet écran.

Le 22 août au matin, ouvrir le lien ne montre plus un programme terminé : il
montre ce que l'enfant a fait pendant trois semaines. **La bascule se produit
sans qu'un humain touche à quoi que ce soit et sans déploiement ce jour-là** —
elle ne dépend que de `fin` dans `programme.json` et de l'horloge du téléphone.
Aucune date n'est écrite dans le code : éditer le programme pour la saison
prochaine défait la bascule tout seul.

**Seule la racine bascule.** « Ma progression », les réglages et chaque séance
continuent de répondre : le PRD §9 dit que l'application bascule, pas qu'elle
ferme. Après le 21 août on peut encore corriger un prénom, relire une séance et
changer d'enfant.

**`#/bilan` est ouvrable à toute date**, et c'est délibéré : une route qui
n'existerait qu'à partir du 22 août ne pourrait être essayée pour la première
fois que le 22 août — le jour où il est trop tard pour la corriger. Ouvert en
avance, l'écran dit en une ligne que ce n'est pas fini.

**Le ton est la seule vraie décision de cet écran** : le bilan raconte ce qui a
été fait, il ne compte pas ce qui a manqué. « 3 séances bouclées et 22 exercices
cochés » et non « tu n'as fait que 3 séances sur 7 » — même donnée, lecture
opposée. Une séance non ouverte n'affiche aucun chiffre : « 0 exercice sur 6 »
est un reproche chiffré, l'absence de chiffre est un fait. Le mot du domaine
reste `manquee` — il pilote la couleur — mais l'écran écrit « non faite ». Un
test lit les phrases de trois bilans, dont celui de quelqu'un qui n'a rien fait,
et échoue sur `manqu`, `dommage`, `seulement`, `raté`, `bravo`, `champion` ou
`guerrier`.

**Aucune animation, aucun rien qui bouge.** Le mouvement est une récompense qui
vient après l'action ; ici la dernière case a été cochée il y a des jours.

Le classement gelé s'affiche, sans le bouton pour le rejoindre : il proposerait
d'entrer dans un classement fermé, et le serveur répondrait par une erreur pour
un geste que l'écran venait de proposer. Le gel lui-même n'est implémenté nulle
part côté navigateur — le serveur écrête le jour à la fin du programme et refuse
tout envoi postérieur, donc le classement est constant par construction.

## Les récompenses

`web/recompenses.js` est branché une seule fois, à l'amorçage, par `web/app.js`.
Il écoute `marcq:seance-complete` et ouvre le panneau de fin de séance.

Deux des récompenses n'ont **aucun JavaScript** : la ligne qui se barre et la
barre de progression qui avance — d'un trait, sans rebond depuis que le ressort
a été retiré — sont des transitions CSS. C'est ce qui
garantit qu'un tap ne peut pas être retardé par ce module — il ne l'exécute pas.

Trois règles s'appliquent, et ce sont des critères d'acceptation (PRD §10) :

- rien ne bloque l'interaction plus d'une demi-seconde — aucune transition ne
  dépasse 400 ms ;
- rien ne bouge tout seul : aucune animation en boucle, aucune animation sans
  geste. Ouvrir une séance déjà cochée n'anime rien ;
- `prefers-reduced-motion: reduce` supprime tout mouvement et l'application
  reste entièrement utilisable : les compteurs affichent leur valeur, le panneau
  s'affiche sans confettis, et il se ferme des trois mêmes façons.

## Le thème visuel

`web/style.css` porte un thème unique, décrit en tête de fichier. Deux sources,
et aucune autre : le **blason du club** (`web/mhb.webp`), dont les couleurs sont
relevées au pixel près, et le **terrain de handball**, dont on reprend la surface
de but et ses deux lignes. Trois règles s'y tiennent, et une modification qui les
enfreint fera diverger l'application sans qu'aucun test ne s'en aperçoive :

- **Une couleur, une fonction.** `--marcq-bleu` (#0a67a6) ne désigne que ce qui
  est vivant maintenant : la séance du jour, le bouton, aujourd'hui au
  calendrier, le minuteur qui tourne. `--marcq-fait` désigne l'accompli.
  `--marcq-danger` est réservé aux gestes destructifs. Rien d'autre n'est coloré.
- **L'accompli prend le plus fort contraste du fond** — d'où `--marcq-fait:
  var(--marcq-nuit)` sur les écrans clairs, et le blanc posé explicitement sur le
  bandeau sombre de l'écran du jour et sur le panneau de fin de séance. C'est une
  règle, pas une exception : un écran sombre futur doit faire de même.
- **Le trait plein est la ligne des 6 m, le pointillé celle des 9 m.** Plein :
  atteint (un exercice fait, une séance faite). Pointillé : hors d'atteinte
  aujourd'hui (une séance à venir, un jour à venir, un avis de bilan anticipé).

Le bleu du club existe en deux valeurs, et le choix ne se fait pas au goût : sur
fond clair `--marcq-bleu` (6,0:1 avec du blanc) ; sur les trois surfaces de nuit
— l'écran du jour, la barre d'onglets, le panneau de fin — il tomberait à 3:1 et
c'est `--marcq-bleu-clair` (8,6:1) qui prend le relais, anneau de focus compris.

Trois familles, trois registres : `--marcq-titre` (Anton) pour les titres, les
grands nombres et les onglets ; `--marcq-texte` (pile système) pour tout ce qui
se lit comme une phrase ; `--marcq-tableau` (chasse fixe) pour ce qui **se
mesure** — minuteurs, comptes, pourcentages, dates. Jamais pour donner un air
technique à une phrase : « Salut Lucas » est en pile système, « Semaine 1 ·
vendredi 7 août » en chasse fixe, et la différence est délibérée.

**La police et le blason sont servis par l'application.** `web/anton.woff2`
(sous-ensemble latin, 18 Ko, SIL Open Font License 1.1 — le texte de la licence
est dans `web/anton-OFL.txt` et doit rester livré avec le fichier) et
`web/mhb.webp` (32 Ko). Tous deux sont déclarés dans `COQUE` (`web/sw.js`), la
police est préchargée par `web/index.html`, et `main.go` enregistre les types
MIME `font/woff2` et `image/webp` : Alpine n'embarque aucune table
`/etc/mime.types` et celle que Go compile en dur ne les couvre pas, si bien que
le préchargement serait rejeté sans ces lignes. Aucune ressource n'est chargée
hors de l'origine, et `tests/coque.test.js` le vérifie.

**Le blason apparaît à trois endroits et à trois titres**, et nulle part
ailleurs : image du document au premier lancement (`web/vue-prenom.js`, avec un
texte de remplacement — là, il répond à une question), fond de l'écran du jour
(`.cas-aujourd-hui`, purement décoratif, donc invisible aux lecteurs d'écran), et
icône d'onglet. Ce n'est pas la mascotte que le PRD § 10 refuse : voir § 16.5.

## La barre de progression

Six écrans en affichent une, et une seule mécanique les sert : `web/barre.js`.
Elle n'est plus un `<progress>` natif mais un cadre qui rogne un bloc pleine
largeur, déplacé par `translate` selon la propriété `--part`. Une largeur animée
obligerait le navigateur à refaire la mise en page à chaque image ; un
déplacement ne touche ni la mise en page ni le dessin.

Deux conséquences à connaître avant d'y toucher :

- **le déplacement, et non `scaleX`** : une mise à l'échelle écraserait aussi les
  extrémités arrondies, et le bout de la barre serait d'autant plus pincé que la
  progression est faible ;
- **le rôle et les valeurs ARIA sont posés à la main**, puisque `<progress>` ne
  les fournit plus. C'est la seule raison pour laquelle ce module existe plutôt
  que quatre lignes recopiées : recopiées, l'une des six les aurait perdues.
  `creerBarre(..., { muette: true })` retire la barre de la restitution là où le
  nombre est déjà écrit juste à côté — le bilan, la jauge de groupe, la page du
  coach.

`tests/barre.test.js` tient les deux : le calcul de la part (division par zéro,
écrêtage, valeurs illisibles) et le fait qu'aucun écran ne reconstruise sa propre
barre.

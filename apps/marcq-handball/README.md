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
aucun en-tête n'est lu, les journaux ne portent que méthode, chemin, statut et
durée, et la fiche stockée n'a aucun champ pour accueillir un nom.

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
d'affichage : le podium nomme trois personnes et le champ `pseudo` n'est pas
émis au-delà de la troisième ligne ; les rangs sont stricts, de 1 à N, jamais
répétés — à égalité, le premier arrivé à ce score est devant ; les identifiants
d'une séance future ou inconnus du programme sont ignorés, ni comptés ni
stockés.

Après le 21 août, l'envoi répond `409 classement-fige` : le classement ne bouge
plus. Le **retrait**, lui, reste ouvert — le gel protège le rang, pas le droit
d'effacer sa fiche (PRD §14).

### `POST /api/classement`

`Content-Type: application/json`, **exactement cinq champs**, aucun autre
accepté :

```json
{
  "pseudo": "Renard",
  "code": "4821",
  "faits": ["s1-c1", "s1-c2"],
  "ressentis": { "2026-08-03": "correct" },
  "supprimer": false
}
```

`pseudo` et `code` sont toujours obligatoires ; `faits` l'est sauf en
suppression ; `ressentis` et `supprimer` sont facultatifs. Réponse `201` à la
création du pseudonyme, `200` à chaque mise à jour.

**L'envoi remplace, il n'ajoute pas.** L'ensemble reçu *devient* l'ensemble du
participant : décocher se propage. Deux conséquences à annoncer à l'enfant —
c'est le rôle du PRP 08 : deux téléphones sous le même pseudonyme s'écrasent
mutuellement, ce que le code à 4 chiffres empêche ; et un navigateur vidé qui
renvoie un ensemble vide retombe à zéro. Les horodatages serveur, eux, survivent
au remplacement, sans quoi chaque envoi remettrait à zéro le départage des ex
æquo.

`{"pseudo": "…", "code": "…", "supprimer": true}` efface la fiche entière et
**libère le pseudonyme**. L'opération est idempotente : un second appel rend
`200` et `"supprime": false`, jamais une erreur.

**Le code à 4 chiffres n'est pas un mot de passe.** Il attache un pseudonyme au
premier envoi qui le crée, et rien d'autre : il n'ouvre aucune lecture, ne
protège aucune donnée, n'identifie personne. Il n'est jamais stocké en clair —
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

## Développement

```bash
./apps/marcq-handball/test.sh          # go vet, go test, node --test

cd apps/marcq-handball
go run .                               # sur http://localhost:8080
PORT=3000 go run .                     # ailleurs
MARCQ_DONNEES=/tmp/marcq go run .      # avec le classement (le répertoire doit exister)
```

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

### Reste à recevoir

La page 3 sur 3 de la note du coach manque (PRD §12.3). La capture reçue
s'arrête après le lundi 17 août ; les sept séances saisies ici couvrent tout ce
qui est connu. Si la troisième page ajoute des séances, elles s'ajoutent à
`web/programme.json` — dates, identifiants `s8-*` et suivants, volumes — et les
totaux attendus du test se recalculent. À lever **avant le 17 août**.

## Les écrans et leurs routes

Le navigateur porte tout : le domaine, l'état et les écrans. Le serveur sert des
fichiers statiques et une sonde de santé, et ne connaît aucun utilisateur.

| Route | Écran | Fichier |
|---|---|---|
| `#/` (ou adresse sans ancre) | la séance du jour, ou le repos, ou la fin | `web/vue-jour.js` |
| `#/seance/<YYYY-MM-DD>` | une séance : la liste complète, cochable si sa date est passée ou en cours (PRD §9) | `web/vue-seance.js` |
| `#/perso` | ma progression : la part, le volume accompli, le calendrier | `web/vue-perso.js` |
| `#/reglages` | corriger le prénom, changer d'enfant | `web/vue-reglages.js` |

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

Un stockage refusé — navigation privée — ou plein ne casse rien : les valeurs
sont gardées en mémoire pour la durée de l'onglet. Elles ne survivent alors pas
à la fermeture, ce que la page de réglages annonce.

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

## Les récompenses

`web/recompenses.js` est branché une seule fois, à l'amorçage, par `web/app.js`.
Il écoute `marcq:seance-complete` et ouvre le panneau de fin de séance.

Deux des récompenses n'ont **aucun JavaScript** : la ligne qui se barre et la
barre de progression qui rebondit sont des transitions CSS. C'est ce qui
garantit qu'un tap ne peut pas être retardé par ce module — il ne l'exécute pas.

Trois règles s'appliquent, et ce sont des critères d'acceptation (PRD §10) :

- rien ne bloque l'interaction plus d'une demi-seconde — aucune transition ne
  dépasse 400 ms ;
- rien ne bouge tout seul : aucune animation en boucle, aucune animation sans
  geste. Ouvrir une séance déjà cochée n'anime rien ;
- `prefers-reduced-motion: reduce` supprime tout mouvement et l'application
  reste entièrement utilisable : les compteurs affichent leur valeur, le panneau
  s'affiche sans confettis, et il se ferme des trois mêmes façons.

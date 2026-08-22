# ramure

**Plante un nom, saute de branche en branche.**

Exploration généalogique de la musique : un artiste au centre, ses parents
musicaux en orbite, leurs héritiers autour d'eux ; chaque clic promeut une
branche au centre et fait repousser l'arbre.

Le produit est spécifié par [`PRODUCT.md`](PRODUCT.md). Les exigences y sont
numérotées `F-xx` et `N-xx`, et le code les cite par ces numéros là où il les
applique. Ce fichier-ci décrit la réalisation.

> **Cette version est retirée de la stack depuis le 20 août 2026**, à la mise en
> ligne de [`ramure-v2`](../ramure-v2/README.md). Elle porte `enabled: false` :
> son code et ses documents restent dans le dépôt, elle n'entre plus dans
> `compose.yaml` et n'a plus d'URL. Ce qui suit décrit ce qu'elle **était**, et
> se lit comme l'étalon de la v2, pas comme une application en service.
>
> Décision du commanditaire du 19 août 2026, écrite au §19 du PRD de la v2
> ([`../ramure-v2/PRODUCT.md`](../ramure-v2/PRODUCT.md)), et exécutée par la
> troisième tâche du PRP 09 de la série v2. Deux raisons : les deux applications
> portaient le même document produit **mot pour mot**, ce qui fait mentir l'un
> dès qu'on corrige l'autre ; et la v2 apporte ce que celle-ci ne peut pas donner
> — ouverture aux comptes Google, collection qui survit au redéploiement, repli
> sur une seconde source de proximité.
>
> Ce que le retrait fait perdre, et qu'il faut avoir dit avant : cette version ne
> déclare aucun volume, et les artistes gardés vivent dans le navigateur, sous
> **son** adresse. Ils ne suivront pas vers `ramure-v2` : ce qui compte se
> replante à la main. Le répertoire, lui, reste dans le dépôt — son code est
> l'étalon du lot V2 que la v2 n'a pas encore écrit.

| | |
|---|---|
| URL | aucune — retirée de la stack le 20 août 2026 ; elle servait sur `ramure.apps.billbob.ovh` |
| Authentification | `private` — liste blanche du serveur |
| Lots couverts | MVP + V1, plus le palmarès (F-27) et la reprise de lignée (F-18) du lot V2 |
| Technologie | Go 1.24, sans aucune dépendance externe · SVG et JavaScript sans étape de construction |
| Image | ~25 Mo |

## Ce qui tourne sans rien configurer

**Aucun secret n'est requis pour démarrer.** Le produit fonctionne entièrement
sur Deezer, dont l'API publique ne demande pas de clé. `LASTFM_API_KEY`, si
l'environnement la fournit, améliore deux choses et n'en casse aucune — c'est la
N-06 (« dégrader, jamais casser ») et la N-13 (« tenir sans contrat payant »).

| Variable | Requise | Effet de son absence |
|---|---|---|
| `LASTFM_API_KEY` | non | L'affinité est dérivée du rang au lieu d'être mesurée ; la discographie garde l'ordre du catalogue au lieu d'être classée par appréciation. Rien d'autre ne change. |
| `PORT` | non | `8080`. |

`GET /api/diagnostic` dit à tout moment quelles sources sont réellement
actives, et le journal de démarrage l'écrit aussi.

## Les quatre rôles de données

La §09 du PRD décrit des **rôles**, jamais des fournisseurs, et délègue le choix
(§17). La couverture retenue :

| Rôle | Fournisseur | Pourquoi |
|---|---|---|
| 1 · proximité | **Deezer** `/artist/{id}/related`, repondéré par **Last.fm** `artist.getSimilar` | voir ci-dessous |
| 2 · catalogue | **Deezer**, résolution par identifiant | La §09 en fait « le critère décisif » : une source qui ne sait chercher que par mots-clés produit des discographies polluées d'homonymes. |
| 3 · appréciation | **Last.fm** `artist.getTopAlbums` | Toute la discographie notée **en un seul appel**, au lieu d'un appel par album. |
| 4 · écoute | **Deezer** en direct, recherche pré-remplie en repli | La F-26 autorise explicitement le repli, et il aboutit toujours quelque part d'utile. |

### Le rôle 1 mérite une explication

Last.fm donne la vraie mesure d'affinité — un `match` normalisé entre 0 et 1,
exactement ce que la §09 demande. Mais ses fiches d'artiste n'ont ni identifiant
exploitable ici, ni portrait utilisable. **Bâtir les branches sur Last.fm
imposerait une résolution Deezer par voisin** : dix appels de plus à chaque
promotion, pour le geste le plus fréquent du produit. C'est exactement le
mécanisme de dépassement de quota décrit par l'encadré de la §10.

D'où la composition retenue : le vivier vient de Deezer, qui rend des fiches
complètes en un appel, et Last.fm ne sert qu'à **repondérer** ce vivier par
appariement de noms normalisés. Un seul appel supplémentaire, la vraie affinité
là où elle existe, et **aucun coût par branche**.

## Le budget d'appels (N-03)

La N-03 exige que le coût d'une promotion soit « borné et documenté en nombre
d'appels par source ». Il l'est, et il est **mesuré** : chaque réponse d'API
porte son compteur, et `/api/diagnostic` rend le plafond.

| Opération | Deezer | Last.fm | Total |
|---|---|---|---|
| Planter par nom | 1 recherche + 1 détail + 1 voisins | 1 similaires + 1 info | ≤ 5 |
| Promouvoir une branche | 1 détail + 1 voisins | 1 similaires + 1 info | ≤ 4 |
| Fiche du centre | 1 albums + 1 extraits | 1 top-albums | ≤ 3 |
| Héritiers (après coup) | 1 par branche | — | ≤ 9 |
| **Plafond dur** | | | **24** |

Trois propriétés rendent ce budget tenable :

- **Les branches ne coûtent rien.** `/related` rend des fiches complètes — nom,
  portrait, identifiant, audience. C'est la règle « profondeur maximale au
  centre, strict minimum sur l'entourage » obtenue par le choix de la source,
  pas par une optimisation ajoutée après coup.
- **Les héritiers sont chargés séparément**, après l'affichage de l'arbre
  (F-39), bornés par le budget et parallélisés à quatre.
- **Le cache est mutualisé** entre tous les utilisateurs (N-04), avec des durées
  calées sur la volatilité : 30 jours pour une résolution nom → identifiant,
  12 h pour un vivier, 24 h pour une discographie.

Mesuré en local, une plantation à cache froid coûte **2 appels** ; à cache
chaud, **zéro**.

## Ce que le code garde de travers, exprès

- **Aucune erreur n'est mise en cache**, ni aucun résultat vide (N-05, §09).
  Mémoriser un échec condamne durablement un artiste à un affichage dégradé,
  bien après le rétablissement de la source. C'est la F-37, marquée critique.
- **La correspondance des noms est stricte.** Si aucun candidat ne correspond
  exactement au nom demandé, la réponse est vide — jamais « le premier candidat
  approchant ». Le rattrapage orthographique (F-03) n'intervient qu'ensuite, il
  est borné en écart, et il refuse en cas d'égalité.
- **Vide et panne sont deux états distincts** jusque dans le transport
  (`200 + etat:"vide"` contre `502 + etat:"panne"`), et seul le second propose
  de réessayer. C'est la F-36, l'autre exigence critique.

## Besoins d'infrastructure

> Le contrat de la fabrique demande d'écrire ici ce qu'il ne prévoit pas,
> plutôt que de le provisionner soi-même.

**Un stockage persistant serait nécessaire pour que la collection survive à un
redémarrage.** La collection (F-28 à F-33) et les réglages (F-25, F-06) sont
partitionnés par `X-Forwarded-User` et tenus **en mémoire du processus**.

> **La réserve est désormais à moitié levée.** La fabrique offre maintenant des
> volumes nommés (`volumes:` dans `app.yml`, voir `../../CLAUDE.md`) : il n'y a
> plus de décision d'infrastructure à prendre côté serveur. Ce qui reste est du
> travail applicatif, et il n'est pas fait — `Collection` est une struct
> concrète (`map` + `RWMutex`), sans interface derrière laquelle brancher une
> persistance. Tant que ce chantier n'est pas mené, les conséquences ci-dessous
> restent exactes.

Conséquences telles qu'elles sont aujourd'hui :

- un redémarrage du conteneur vide les collections **côté serveur** ;
- le miroir `localStorage` du client les reconstitue à la reconnexion (F-33),
  donc l'utilisateur ne perd rien **sur l'appareil où il a gardé** ;
- mais la synchronisation entre appareils (F-32) ne survit pas au redémarrage :
  un artiste gardé sur téléphone puis jamais rouvert sur cet appareil
  disparaîtrait du compte.

Le geste qui lève la réserve est maintenant entièrement dans ce dépôt : déclarer
`volumes:` dans `app.yml`, créer et `chown` le chemin dans le `Dockerfile` avant
`USER`, puis sérialiser la collection derrière une interface. **Ce n'est plus une
demande d'infrastructure, c'est un chantier applicatif ouvert.**

Rien d'autre : ni port supplémentaire, ni cache externe, ni réseau particulier.
L'application a besoin d'un **accès HTTPS sortant** vers `api.deezer.com` et,
si la clé est fournie, `ws.audioscrobbler.com`.

## Accessibilité

Niveau visé **WCAG 2.2 AA**, sans exception sur l'écran principal (§12). Ce qui
demande le plus d'attention sur un canevas :

- chaque nœud est activable au clavier et porte **le nom complet** de l'artiste
  comme intitulé accessible ;
- le changement de centre est **annoncé** par une région `role="status"` ;
- **un seul champ de recherche existe dans le document** : il est *déplacé*
  entre le bandeau d'accueil et la barre d'outils, jamais dupliqué — c'est la
  seule façon de garantir qu'aucun intitulé accessible ne fasse doublon lors du
  basculement de disposition (§07, §12) ;
- quitter l'exploration et remonter d'un cran dans la lignée portent des
  intitulés et des icônes distincts ;
- la préférence de mouvement réduit **neutralise** les animations, elle ne les
  raccourcit pas : la promotion s'applique immédiatement, sans délai résiduel.

## Deux dispositions, une seule densité de nœuds ? Non

La §14 nomme le risque : « le canevas exige de la place — le cœur du produit est
le moins confortable sur téléphone », et demande d'arbitrer la priorité *avant*
la conception d'interface. L'arbitrage retenu est **les deux à parts égales**,
ce qui impose de faire varier la densité :

| | Écran étroit | Écran large |
|---|---|---|
| Branches | 6 | 9 |
| Héritiers par branche | 2 | 2 |
| Recherche | barre dédiée, permanente | intégrée à la barre flottante |
| Fiche | ancrée en bas, **repliée par défaut** | panneau latéral, dépliée |
| Panneaux | glissent depuis le bas | fenêtre modale centrée |
| Aperçu au survol | sans objet | oui |

Le client annonce au serveur ce que sa disposition peut porter
(`?branches=`) ; le serveur **borne** la valeur, qui vient du client et n'est
donc pas de confiance.

La fiche repliée par défaut sur téléphone n'est pas un détail : ancrée ouverte,
elle prend les deux tiers de la hauteur et il ne reste du canevas qu'une bande
où l'on ne distingue plus rien — or le canevas *est* le produit.

## Écarts connus avec le PRD

Honnêtement listés plutôt que passés sous silence :

- **Le vivier fait 20 candidats, pas 30.** La §05 vise « au moins 30 candidats
  pour que le tirage ait du sens » ; `/related` en rend au plus 20. Le tirage
  reste significatif — 4 branches tirées dans 18 après les 2 stables — mais la
  cible n'est pas atteinte. La valeur mesurée voyage dans chaque réponse
  (`vivier`) pour que l'écart reste visible plutôt que supposé.
- **Le signal de nouveauté (F-23) n'est posé que dans la discographie**, pas sur
  les branches du canevas. Le poser sur une branche demanderait sa date de
  sortie la plus récente, donc un appel par branche — précisément ce que la
  N-03 interdit. Le rendu du nœud sait l'afficher dès qu'une source pourra le
  fournir sans coût par branche.
- **La lignée est reprise depuis `sessionStorage`** (F-18), donc par onglet et
  non par compte : elle survit à un rechargement, pas à une fermeture.
- **Le palmarès classe sur le nombre d'écoutes absolu**, pas sur la note, qui
  est relative à son artiste. Un palmarès transversal doit comparer des
  grandeurs comparables. Il est vide, avec un message explicite, quand le rôle 3
  est absent — plutôt qu'un classement trompeur (§14).

## Développer

```bash
cd apps/ramure
go run .              # http://localhost:8080
./test.sh             # go vet + go test
```

Sans `X-Forwarded-User`, l'API répond `etat: "local"` sur la collection et le
client bascule sur son miroir de navigateur : le produit est utilisable en
local sans monter Traefik.

Pour exercer le chemin authentifié :

```bash
curl -H 'X-Forwarded-User: moi@exemple.fr' http://localhost:8080/api/collection
```

### La suite de tests

Elle vise ce que la §13 désigne comme les défauts les plus coûteux du produit —
ceux qui « passent tous la compilation et les tests unitaires » :

| Fichier | Ce qu'il interdit |
|---|---|
| `nom_test.go` | La contamination par homonyme, et une correction orthographique qui substitue un artiste à un autre |
| `arbre_test.go` | Une affinité non monotone, deux libellés qui se recouvrent, un héritier attribuable à la mauvaise branche, un élagage qui vide l'arbre |
| `cache_test.go` | La mémorisation d'un échec, une rafale de requêtes identiques |
| `api_test.go` | La confusion vide/panne, une fuite de collection entre utilisateurs, une identité déclarée par le client |
| `catalogue_test.go` | Un album sans type ou à deux types, un classement qui mélange les non-notés, un lien d'écoute vide |

Les tests sont nommés **d'après le symptôme observé par l'utilisateur**, comme
l'exige la §13 : la suite se lit comme une liste de régressions interdites.
Aucun test ne sort sur le réseau — les sources sont simulées.

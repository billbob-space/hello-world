# renaissance-gym

Le programme de vacances de **La Renaissance Gymnastique de Marcq-en-Barœul**,
transposé de deux feuilles A4 en une séance du jour qui se déroule toute seule.

- **URL** : https://renaissance-gym.apps.billbob.ovh
- **Palier** : `public` — aucune authentification Traefik. Voir « Pourquoi
  public » plus bas.
- **Le PRD** : [`PRODUCT.md`](PRODUCT.md) · **l'implémentation** : [`prp/`](prp/)

## Ce que c'est

Trente-six exercices en lignes, huit colonnes de semaines, une croix au stylo :
c'est ce que le club distribue. Une grille papier ne dit pas quoi faire
aujourd'hui, ne mesure aucun temps de gainage, ne survit pas à huit semaines de
vacances dans un sac de sport, et reste chez l'un des deux parents. L'application
répond à ces quatre points, et à rien d'autre : elle **n'ajoute aucun exercice et
n'en retire aucun**.

## Comment ça tourne

Un binaire Go, sans dépendance tierce, qui sert la coque web embarquée par
`go:embed` et une API à trois opérations.

```
navigateur ──► décide tout : programme, objectifs, composition des séances,
               minuteur, état d'avancement (localStorage)
     │
     └── POST /api/fiche ──► serveur : garde, vérifie le code, fusionne
                             ──► volume renaissance-gym-donnees
```

**Le partage n'est pas négociable** : une séance entière doit se faire réseau
coupé, minuteur compris. Un serveur qui composerait la séance rendrait
l'entraînement dépendant du réseau. Le serveur ne connaît pas le programme, ne
compose rien, et **n'interprète jamais** ce qu'il stocke — il garde une liste
d'identifiants d'exercices datés.

### L'API

Une seule route, `POST /api/fiche`, portant trois opérations distinguées par le
champ `operation`. Trois routes prenant le même couple d'identifiants
multiplieraient par trois la surface à protéger.

| `operation` | Effet | Réponses |
|---|---|---|
| `creer` | pseudonyme libre + code → fiche vide | `201` · `409` pseudonyme pris |
| `synchroniser` | pseudonyme + code → la fiche **fusionnée** | `200` |
| `effacer` | pseudonyme + code → la fiche disparaît | `204` |

`401` pour un couple refusé — **avec exactement le même corps et le même statut
que pour un pseudonyme inexistant**, sans quoi l'API serait un oracle
d'existence de pseudonymes. `429` avec `attendreMs` quand la temporisation est
active. Il n'existe **aucune** opération de liste, de recherche ou de comptage.

### Ce que le serveur garde

Par fiche : le pseudonyme, l'**empreinte** du code, le prénom, la semaine de
départ, les exercices validés avec leur date, les badges.

- Le code n'est **jamais** stocké en clair : PBKDF2-HMAC-SHA256, 200 000
  itérations, sel de 16 octets, comparaison par `hmac.Equal`. Un test écrit une
  fiche, relit le fichier produit sur le disque, et échoue s'il y trouve le code.
- Le fichier de fiche est nommé d'après l'**empreinte** du pseudonyme : lister le
  répertoire ne rend aucun pseudonyme lisible.
- L'écriture est atomique (temporaire puis `rename`) et sérialisée par un verrou
  par pseudonyme. Un redémarrage au mauvais moment ne doit pas laisser une fiche
  tronquée : c'est huit semaines d'entraînement.
- Les journaux n'écrivent **jamais** un pseudonyme, un prénom ni un code.

Le prénom côté serveur est un choix explicite du demandeur, pris contre la
recommandation du PRD. L'arbitrage et son coût sont écrits au [§10.3 du
PRD](PRODUCT.md) — c'est là qu'il se conteste.

## Pourquoi `public`

L'utilisatrice a treize ans et n'a pas nécessairement de compte Google. `private`
et `google` lui fermeraient la porte, c'est-à-dire à la seule personne pour qui
l'application existe. Le palier est donc `public`, et c'est le pseudonyme et le
code à six chiffres qui protègent la fiche — pas Traefik.

Six chiffres et non quatre : dans `marcq-handball`, dont le mécanisme est repris,
le code garde une ligne de classement, « un jeton qui ne protège rien » dit son
propre PRD. Ici il garde huit semaines d'entraînement et un prénom d'enfant. Un
million de combinaisons, plus une temporisation croissante (5 s, 15 s, 45 s) sur
l'appareil **et** côté serveur par pseudonyme.

## Le volume

`renaissance-gym-donnees`, monté sur `/var/lib/renaissance-gym`, chemin porté par
`GYM_DONNEES`.

**Ce volume se sauvegarde.** Le perdre efface huit semaines d'entraînement
qu'aucun téléphone ne rendra si celui qui les portait a été changé entre-temps.
C'est la seule ressource de cette application qui ne se reconstitue pas. Ordre de
grandeur : environ 30 Kio par gymnaste, 6 Mio pour deux cents fiches.

Le `Dockerfile` crée le chemin et le donne à l'uid `10001` **avant** `USER` : au
premier montage, Docker recopie dans le volume vide le répertoire tel qu'il est
dans l'image, propriétaire compris. Fait après, l'application démarre et perd
tout — le symptôme le plus coûteux à diagnostiquer de la fabrique.

## Aucun secret, aucune variable d'environnement à injecter

`GYM_DONNEES` a une valeur par défaut correcte et n'est pas un secret. Cette
application ne demande rien à l'infrastructure.

## Développer

```bash
./test.sh                                   # 221 tests JS + go vet + go test
GYM_DONNEES=/tmp/gym go run .               # http://localhost:8080
```

Le front est en **modules ES natifs** : aucun `node_modules`, aucun empaqueteur,
aucune étape de construction. `package.json` ne sert qu'à déclarer
`"type": "module"` à Node pour les tests, qui tournent sous le `node --test` de
la bibliothèque standard.

Un module Go neuf doit être ajouté à `go.work` à la racine : `./init.sh` le fait,
et sans lui `go vet ./...` échoue sur « directory prefix . does not contain
modules » — pour toutes les applications de la fabrique, pas seulement
celle-ci.

### Les cinq propriétés que les tests tiennent

Elles traversent plusieurs fichiers et ne se voient pas à la relecture. Un
changement qui en casse une est refusé, même s'il est joli.

1. **L'union des quatre séances vaut exactement les 36 exercices** — c'est ce qui
   fait de ces séances une transposition de la grille et non une sélection.
2. **Aucun objectif n'est écrit en dur dans une vue** — `programme.json` est la
   seule source. *Ce test lit le source comme du texte brut et ne distingue pas
   le code du commentaire : n'écris pas de durée chiffrée dans un commentaire.*
3. **La fusion est une union** — aucune case cochée ne se décoche par
   synchronisation. C'est ce qui rend deux téléphones sûrs.
4. **Le minuteur ne se raccourcit pas** — il n'existe ni `avancer()`, ni
   `sauter()`, ni `reglerRestant()`.
5. **Le code n'est jamais stocké en clair.**

Trois autres tiennent le monde visuel : le contrat de direction présent mot pour
mot dans `index.html`, aucun `border-radius` au-delà de `4px`, aucune taille de
police sous `17px`, et aucune URL absolue vers un domaine tiers.

## Le monde visuel

Le contrat complet est en tête de `web/index.html`, et l'ossature le détaille au
[§4 et §5](prp/00-ossature.md). En une phrase : l'application est taillée comme
un **justaucorps de compétition** — velours bleu roi en empiècements coupés à
12°, passepoil d'or le long de chaque couture, champ de lecture en jersey mat,
fuchsia pour ce qui est en cours, et un rang de strass réservé à la semaine
bouclée, **jamais pendant l'effort**.

Le fond est clair et non sombre, et c'est la scène physique qui l'a tranché : une
enfant sur un tapis en août, le téléphone **posé à plat par terre**, où un fond
presque noir est un miroir.

## Installable (PRD A12)

`web/manifest.webmanifest` et `web/sw.js` rendent l'application installable sur
l'écran d'accueil, en plein écran. Deux règles non négociables tiennent le
piège classique du genre — une version en cache servie indéfiniment :

1. Réseau d'abord, cache seulement en secours (`sw.js`, gestionnaire `fetch`) :
   une correction livrée le matin doit être en place à la première ouverture
   qui a du réseau.
2. Une version qui change remplace l'ancienne sans attendre la fermeture des
   onglets (`skipWaiting` + `clients.claim`), et l'ancien cache est effacé.

**`sw.js` porte une constante `VERSION` à incrémenter à chaque livraison qui
touche `web/`** — sans quoi le correctif suivant n'arrive jamais chez une
gymnaste qui a déjà installé l'application.

Aucune réponse de `/api/` n'est jamais mise en cache, sous aucune stratégie
(`tests/pwa.test.js` l'échoue si `/api` apparaît dans la liste de
préchargement). Aucune invite d'installation n'est faite par l'application :
c'est un geste offert par le navigateur, jamais réclamé.

## Ce qui est hors périmètre, et pourquoi

Vidéos de démonstration, comparaison entre gymnastes, saisie du nombre réellement
effectué, édition du programme depuis l'application, notifications, écran pour
l'entraîneuse. Chacune porte son argument au [§6 du PRD](PRODUCT.md) — elles sont
écartées, pas oubliées.

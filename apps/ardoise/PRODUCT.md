# Product — ardoise

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Les comptes Google inscrits sur la liste blanche du serveur `billbob.ovh`
(palier `private`). Deux situations, et une troisième qui compte autant.

Quelqu'un ouvre l'URL, écrit une ligne, la voit apparaître signée de son
adresse. Il revient plus tard, après un redéploiement, et la ligne est toujours
là : c'est ce qu'il venait vérifier.

L'exploitant du serveur ouvre la même page pour une autre raison — savoir si les
quatre étages tiennent. Il ne lit pas de journal, il ne se connecte pas en SSH :
la mention de provenance sous la liste lui dit si le cache travaille.

Le troisième lecteur n'ouvre jamais la page : c'est l'agent qui ajoutera la
prochaine application avec une base de données, et qui partira de celle-ci.

Il n'y a pas d'utilisateur anonyme : Traefik authentifie avant que la requête
n'atteigne l'application.

## Product Purpose

`ardoise` est la plus petite application qui exerce les quatre étages du contrat
de déploiement : une interface, un service, une base de données, un cache.

Trois applications vivaient dans la fabrique et aucune n'avait d'état. Les
chapitres du contrat qui portent le plus de pièges — volumes nommés, services
annexes, services partagés, variables injectées — n'avaient pour preuve que leur
propre documentation, sur une stack dont le rayon de souffle est commun.

Le succès a deux formes. À l'usage : une ligne écrite se relit après un
redéploiement, et l'écran dit d'où vient l'affichage. Comme gabarit : la
prochaine application qui a besoin d'une base part de celle-ci et hérite d'un
déploiement qui fonctionne.

## Positioning

Ce n'est pas une démonstration de livre d'or. `hello-world` est la preuve
exécutable du contrat de **déploiement** ; `ardoise` est la preuve exécutable du
contrat de **données**. Une application voisine peut afficher les mêmes champs ;
elle ne peut pas prétendre servir de référence sans tenir, ligne à ligne, les
mêmes contraintes : image sous 200 Mo, utilisateur non root, aucun port publié,
routage dans le `compose.yaml` généré, identité issue du seul
`X-Forwarded-User`, volume nommé pour ce qui doit survivre.

## Operating Context

Un serveur unique, une stack `dockhand` unique, un `docker compose up` atomique.
Une erreur dans le bloc d'une application fait échouer le déploiement de toutes
les autres — c'est la contrainte qui gouverne tout le reste.

Le disque du serveur est à 92 %. Le budget mémoire de la fabrique est de
1024 Mo pour l'ensemble des services, les trois sortes comprises ; `ardoise` en
consomme 416 à elle seule, base et cache partagé compris. C'est le poste le plus
lourd de la fabrique, et c'est le prix d'une base de données.

Le déploiement se déclenche à chaque fusion sur `main` : deux à trois minutes
jusqu'à la mise en ligne. Aucun geste sur l'hôte, jamais — pas de répertoire à
créer, pas de migration à lancer.

## Capabilities and Constraints

**Ce qu'elle fait.** Écrire une ligne de 140 caractères au plus, signée de
l'adresse du compte authentifié et horodatée par le serveur. Lire les 50
dernières, de la plus récente à la plus ancienne. Dire, à chaque lecture, si
elle vient de la base ou du cache.

**Ce qu'elle ne fait pas, et c'est un choix de coût.** Pas de comptes :
l'identité vient de `X-Forwarded-User` et de nulle part ailleurs. Pas de
modification ni de suppression : une ardoise s'écrit, elle ne s'édite pas. Pas
de pagination, pas de recherche, pas de temps réel, pas de mise en forme. Toute
fonction qui n'exerce pas un étage du contrat est du travail qui ne prouve rien.

**Deux contraintes qui ne sont pas du confort.** Le cache est une optimisation,
jamais une dépendance : Redis muet, la lecture va en base et l'utilisateur ne
voit rien d'autre qu'une provenance différente. La base indisponible au
démarrage n'empêche pas l'application de démarrer : `depends_on` ne garantit que
le démarrage du conteneur voisin. Ce sont les deux façons dont une application à
quatre étages fait tomber une stack partagée.

## Brand Commitments

**Dire d'où vient l'affichage, en français.** « Lu dans le cache », pas
`provenance: cache`. Celui qui lit décide de ce qu'on construit ; il ne lit pas
le code.

**Refuser en expliquant.** Une ligne vide ou trop longue reçoit une phrase, pas
un code HTTP. Une ligne trop longue est refusée, jamais tronquée : tronquer
déforme le propos sans le dire.

**Ne rien afficher qu'on ne puisse prouver.** La provenance affichée est celle
de la réponse qui vient d'arriver, pas une supposition.

## Evidence on Hand

Le PRD ci-dessous recense l'état de la
fabrique avant cette application : trois apps, aucun `volumes:`, aucun `env:`,
aucun `needs:`, aucun `services:`, `shared_services` vide et commenté.

Ses huit critères d'acceptation sont observés en stack réelle, pas déduits :
persistance après `down`/`up`, provenance `cache` à la seconde lecture,
invalidation à l'écriture, survie au cache arrêté, survie à la base arrêtée,
parcours navigateur complet.

## Product Principles

**Le sujet est la fabrique, pas l'ardoise.** Chaque fonctionnalité doit exercer
un étage du contrat ; les autres sont refusées, même faciles.

**Ce qui doit survivre vit dans un volume nommé, et le nom le dit.** `donnees`
se sauvegarde, `cache` se supprime. Celui qui fait de la place à trois heures du
matin n'aura que ces noms pour décider.

**Une panne d'un étage ne se propage pas aux autres.** Le cache tombe, la base
répond. La base tombe, la page se charge. L'application tombe, les trois autres
applications de la stack restent en ligne.

**Si on hésite entre deux paliers d'exposition, on prend le plus fermé.**
`private` se desserre en une ligne ; l'inverse a déjà exposé les données.

---

## PRD — Ardoise : la preuve exécutable du contrat de données

> Le PRD validé, rapatrié ici : un document par app, dans le répertoire de
> l'app. Les PRP de [`prp/`](prp/README.md) citent ses numéros de section
> (« §5 », « A5 », « R5 ») — ils ne bougent pas.

| | |
|---|---|
| **Statut** | Validé pour implémentation |
| **Date** | 4 août 2026 |
| **Décideur** | amuteau@gmail.com |
| **Nom d'application** | `ardoise` → `ardoise.apps.billbob.ovh` |
| **Palier d'exposition** | `private` — comptes de la liste blanche uniquement |
| **Raison d'être** | Valider la fabrique sur les quatre étages qu'aucune app existante ne réunit : interface, service, base de données, cache |

---

### 1. En une phrase

Une page où les comptes autorisés du serveur écrivent une ligne chacun, qui
survit au redéploiement parce qu'elle est en base, s'affiche instantanément
parce qu'elle passe par un cache, et dit à l'écran **d'où elle vient** — de la
base ou du cache.

### 2. Le problème

La fabrique décrit un contrat complet : volumes nommés, services annexes,
`shared_services`, secrets injectés, trois paliers d'exposition, identité par
`X-Forwarded-User`. Une bonne moitié de ce contrat n'a **jamais été exercée**.

Les trois applications du dépôt sont sans état :

| App | Front | Back | Base | Cache | Identité |
|---|---|---|---|---|---|
| `hello-world` | une page | Go | — | — | affichée |
| `cadran` | — | Go | — | — | — |
| `ramure` | une page | Go | — | mémoire du process | — |

Aucune ne déclare de `volumes:`, aucune de `services:`, aucune de `needs:`,
aucune de `env:`, et `shared_services` de `fabrique.yml` est **une liste vide,
commentée**. Autrement dit : les chapitres du contrat qui portent le plus de
pièges — ceux dont `memory/volumes.md`, `memory/services.md` et
`memory/app-yml.md` détaillent les chausse-trapes — n'ont pour preuve que leur
propre documentation.

Le risque n'est pas théorique. Le contrat le dit lui-même : « les enfreindre ne
provoque pas une erreur claire, mais un déploiement qui échoue en silence », et
le rayon de souffle est commun — **une erreur dans le bloc d'une app fait
échouer le déploiement de toutes les autres**. La première application qui aura
réellement besoin d'une base de données découvrira les trous en production, sur
une stack partagée.

### 3. Utilisateurs

**L'exploitant du serveur** est l'utilisateur principal, et le seul dont le
jugement décide du succès. Il ne lit pas le code. Ce qu'il veut, en ouvrant
l'URL : voir que les quatre étages fonctionnent, sans ouvrir un terminal.

**Les comptes de la liste blanche** sont des utilisateurs secondaires : ils
écrivent une ligne, la voient apparaître signée de leur adresse, et constatent
qu'elle est toujours là au retour.

**Le prochain agent qui ajoutera une application avec une base** est le
troisième lecteur, et le plus important à long terme : `ardoise` est le gabarit
qu'il copiera. Chaque piège que ce PRD documente est un piège qu'il ne
rencontrera pas.

Il n'y a **pas d'utilisateur anonyme** : Traefik authentifie avant que la
requête n'atteigne l'application.

### 4. Objectifs et mesures de succès

| Objectif | Mesure | Cible |
|---|---|---|
| Les quatre étages tiennent | Parcours complet écrire → relire → redéployer → relire | la ligne est toujours là |
| Le cache sert vraiment | Part des lectures servies par le cache sur une rafale de 10 | ≥ 9 |
| Le contrat est exercé, pas décrit | Sections de `app.yml` réellement utilisées | `volumes`, `env`, `needs`, `services` : les 4 |
| Le gabarit est réutilisable | Gestes manuels sur l'hôte pour un premier déploiement | 0 |
| La fabrique est corrigée, pas contournée | Anomalies du run 1 encore présentes au run 2 | 0 |

Ces chiffres sont des repères de décision, pas des indicateurs à instrumenter :
l'application est un banc d'essai, pas un produit à trafic.

### 5. Ce que l'application fait

**Écrire une ligne.** Un champ de saisie, un bouton. La ligne fait au plus
140 caractères. Elle est enregistrée en base, signée de l'adresse e-mail du
compte authentifié, horodatée par le serveur.

**Lire les 50 dernières lignes**, de la plus récente à la plus ancienne, avec
leur auteur et leur date.

**Dire d'où vient la lecture.** Chaque réponse porte sa provenance — `base` ou
`cache` — et l'interface l'affiche. C'est la seule façon pour un lecteur non
technicien de constater que le cache existe : sans cet affichage, un cache qui
ne fonctionne pas est indiscernable d'un cache qui fonctionne.

**Survivre au redéploiement.** Les lignes sont en base, la base est dans un
volume nommé. Le cache, lui, est jetable : le perdre ne coûte qu'une lecture.

**Démarrer seule.** Pas de migration à lancer, pas de fichier à créer, pas de
répertoire à préparer sur l'hôte. L'application crée son schéma au démarrage et
attend que la base accepte les connexions.

### 6. Ce que l'application ne fait pas

- **Pas de comptes.** L'identité vient de `X-Forwarded-User` et de nulle part
  ailleurs — jamais d'un champ de formulaire, d'une URL ou d'un cookie.
- **Pas de modification ni de suppression.** Une ardoise s'écrit, elle ne
  s'édite pas. Écrire et lire suffisent à exercer base et cache.
- **Pas de pagination, pas de recherche, pas de temps réel.**
- **Pas de mise en forme.** Du texte simple ; ce qui vient de l'utilisateur est
  échappé à l'affichage.

Chacune de ces exclusions est un choix de coût : le sujet est la fabrique, pas
l'ardoise. Toute fonction qui n'exerce pas un étage du contrat est du travail
qui ne prouve rien.

### 7. Les règles que le produit garantit

| # | Règle | Pourquoi |
|---|---|---|
| R1 | Une ligne vide, ou faite d'espaces seuls, est refusée | Sans cela, l'ardoise se remplit de bruit |
| R2 | Une ligne de plus de 140 caractères est refusée, pas tronquée | Tronquer déforme le propos sans le dire |
| R3 | L'auteur est l'adresse de `X-Forwarded-User`, jamais une valeur envoyée par le client | La seule source d'identité admissible du contrat |
| R4 | Une écriture rend la lecture suivante fraîche | Sinon l'utilisateur écrit et ne se voit pas |
| R5 | Le cache absent ou muet ne casse rien : on lit la base | Un cache est une optimisation, pas une dépendance |
| R6 | La base absente au démarrage n'empêche pas l'application de démarrer | `depends_on` ne garantit que le démarrage du voisin, pas sa disponibilité |

R5 et R6 ne sont pas du confort : ce sont les deux façons dont une application
à quatre étages fait tomber la stack entière si elle les ignore.

### 8. Palier d'exposition — et pourquoi `private`

`private`. L'ardoise porte des adresses e-mail : des données nominatives.

Le contrat tranche seul : « Tout ce qui touche à de l'administration, de
l'infra, un shell, ou des **données personnelles** » relève de `private`, et
« si tu hésites entre deux paliers, prends le plus fermé ». `google` supposerait
un cloisonnement par utilisateur — n'importe quel compte Google entre — que
l'ardoise ne veut pas : elle est **partagée**, c'est son intérêt. `public`
interdirait toute identité : Traefik ne pose plus `X-Forwarded-User`, et
`--check` refuse une app qui le lit à ce palier.

### 9. Ce qui doit survivre, et ce qui est jetable

| Donnée | Où | Sort au redéploiement |
|---|---|---|
| Les lignes | Volume de la base | **Survit** — c'est le contrat |
| Le cache des 50 dernières lignes | Volume du cache, ou rien | Jetable, reconstruit en une lecture |

Le contrat exige que la séparation **se lise dans les noms** : celui qui fait de
la place à trois heures du matin n'aura que les noms des volumes pour décider,
et `docker volume rm` est irréversible. `donnees` se sauvegarde, `cache` se
supprime.

### 10. Critères d'acceptation

L'application est acceptée quand les huit constats suivants sont **observés**,
pas déduits :

| # | Constat | Comment il est établi |
|---|---|---|
| A1 | `./init.sh --check` est vert avec l'app activée | commande |
| A2 | L'image finale pèse moins de 200 Mo et tourne en non-root | inspection de l'image construite |
| A3 | Une ligne écrite se relit après `docker compose down && up` | stack réelle |
| A4 | La deuxième lecture consécutive vient du cache | réponse `provenance: cache` |
| A5 | Une écriture invalide le cache : la lecture suivante vient de la base | R4 |
| A6 | Cache arrêté, l'application répond toujours | R5 |
| A7 | Base arrêtée au démarrage, l'application démarre et se rétablit | R6 |
| A8 | Le parcours écrire → voir sa ligne fonctionne dans un vrai navigateur | pilotage Playwright |

A3 à A7 ne se démontrent pas par des tests unitaires : ils demandent la stack
réelle. C'est délibéré — ce sont exactement les propriétés que le contrat promet
et que rien, aujourd'hui, ne vérifie.

### 11. Les verrous connus, et qui les lève

| Verrou | Qui tranche | Bloque |
|---|---|---|
| La base a besoin d'une variable d'environnement à **valeur littérale** (`POSTGRES_HOST_AUTH_METHOD` ou équivalent) que `env:` refuse, n'acceptant que des noms | la fabrique — c'est une correction d'`init.sh`, pas une demande au serveur | le déploiement réel de l'app |
| Le mot de passe de la base est un secret : son nom va dans `env:`, sa valeur est injectée par l'infrastructure — mais un nom non défini côté serveur arrive **vide**, et une base qui refuse de démarrer fait tomber la stack entière | la fabrique, puis l'exploitant | le déploiement réel de l'app |

Ces deux verrous sont le **résultat attendu** de l'exercice, pas un accident :
une validation qui ne trouverait rien à corriger n'aurait rien validé. Ils se
lèvent en phase de correction de la fabrique, entre le run 1 et le run 2.

### 12. Hors périmètre, explicitement

Sauvegarde automatique du volume de la base, supervision, montée en charge,
migrations de schéma versionnées, tests de charge. Une application de validation
qui les porterait ne serait plus minimale, et le gabarit qu'elle offre au
prochain agent serait plus lourd que ce qu'il copiera.

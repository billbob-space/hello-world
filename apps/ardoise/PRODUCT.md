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

Le PRD (`docs/superpowers/specs/2026-08-04-ardoise-prd.md`) recense l'état de la
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

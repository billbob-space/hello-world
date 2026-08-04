# Product — compteur

## Users

N'importe quel compte Google — c'est la définition du palier `google` : pas de
liste blanche, pas d'inscription. Quiconque a un compte Google et l'URL peut
cliquer et voir le total avancer.

Second lecteur, qui ne clique jamais : l'agent qui choisira `exposure: google`
pour la prochaine application et cherchera un exemple existant à copier.

## Product Purpose

`compteur` est le second passage de la validation de bout en bout de la
fabrique, après `ardoise`. Il exerce deux choses qu'`ardoise` seule ne pouvait
pas prouver : un palier d'exposition différent (`google`, jamais utilisé
avant), et un service partagé (`redis`) réellement partagé par deux
applications distinctes plutôt qu'affirmé par le contrat.

Le succès a deux formes : un clic incrémente et le total survit à un
redéploiement ; et `compteur` cohabite avec `ardoise` sur le même `redis` sans
qu'aucun des deux ne corrompe les données de l'autre.

## Capabilities and Constraints

**Ce qu'elle fait.** Incrémenter un total partagé d'un clic, signé de
l'adresse du compte authentifié. Afficher le total, l'auteur du dernier clic,
et la provenance de la lecture.

**Ce qu'elle ne fait pas.** Pas de décrément, pas de remise à zéro, pas
d'historique des clics, pas de limite par compte : ce n'est pas un vote,
c'est une preuve d'infrastructure. Toute fonction qui n'exerce pas un étage
du contrat de la fabrique est du travail qui ne prouve rien.

**Deux contraintes qui ne sont pas du confort.** Le cache est une
optimisation, jamais une dépendance : Redis muet, la lecture va en base — et
c'est doublement vrai ici, puisqu'une panne du cache partagé toucherait aussi
`ardoise`. La base indisponible au démarrage n'empêche pas l'application de
démarrer.

## Product Principles

**Le sujet est la fabrique, pas le compteur.** Chaque choix — le palier
`google`, le partage de `redis` — sert à exercer un chapitre du contrat que
le premier run n'avait pas couvert.

**Une panne d'un étage ne se propage pas aux autres**, ni à l'application
voisine qui partage le même service.

**Le prefixe de clé n'est pas cosmétique.** `compteur:valeur` à côté de
`ardoise:lignes` dans le même `redis` : sans ce prefixe, les deux applications
s'écraseraient en silence.

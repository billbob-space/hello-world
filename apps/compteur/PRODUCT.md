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

---

## PRD — Compteur : le second passage de la validation de bout en bout

> Le PRD validé, rapatrié ici : un document par app, dans le répertoire de
> l'app. Le PRP [`prp/00-ossature-et-implementation.md`](prp/00-ossature-et-implementation.md)
> cite ses numéros de section (« §5 », « A5 ») — ils ne bougent pas.

| | |
|---|---|
| **Statut** | Validé pour implémentation |
| **Date** | 4 août 2026 |
| **Décideur** | amuteau@gmail.com |
| **Nom d'application** | `compteur` → `compteur.apps.billbob.ovh` |
| **Palier d'exposition** | `google` — n'importe quel compte Google authentifié |
| **Raison d'être** | Second run de la validation de la fabrique (voir `apps/ardoise/PRODUCT.md`), avec les corrections du run 1 en place, et deux angles qu'`ardoise` ne couvrait pas |

---

### 1. En une phrase

Un bouton. Chaque compte Google qui clique fait avancer un compteur partagé de
un ; l'écran affiche le total et qui a cliqué en dernier.

### 2. Pourquoi un second run, et pourquoi celui-là

Le run 1 (`ardoise`) a trouvé et corrigé cinq défauts réels de la fabrique —
`--add` sur un répertoire de PRP sans code, un faux positif du scan de
secrets, une `command:` en liste qui perdait un élément vide, et deux
documents périmés. Un run qui ne rencontrerait plus ces cinq-là ne prouverait
rien seul : il faut une seconde application, construite en repartant de zéro
par les mêmes six phases, pour savoir si la fabrique corrigée tient sur un cas
différent — pas seulement sur celui qui a servi à la corriger.

`compteur` diffère d'`ardoise` sur deux axes que le run 1 ne couvrait pas :

- **`exposure: google`**, jamais exercé par aucune application du dépôt
  jusqu'ici — toutes les apps à état sont `private`. C'est le palier où
  n'importe quel compte Google entre, donc celui où le cloisonnement par
  `X-Forwarded-User` n'est pas optionnel (`memory/exposition.md`).
- **`needs: [redis]` partagé avec `ardoise`** — le premier test réel de la
  promesse de `shared_services` : « un exemplaire pour toute la fabrique »,
  deux applications distinctes lisant et écrivant sur le même service, sans se
  marcher dessus.

Pour le reste, `compteur` reste volontairement plus simple qu'`ardoise` : un
entier, pas une liste ; personne n'écrit de texte libre, donc rien à échapper.
Le sujet de ce run est la fabrique, pas la richesse du produit.

### 3. Utilisateurs

**N'importe quel compte Google** — c'est la définition du palier. Pas de liste
blanche, pas d'inscription : quiconque a un compte Google et l'URL peut
cliquer.

**Le prochain agent qui choisira `exposure: google`** est le second lecteur :
`compteur` est le premier exemple concret de ce palier dans le dépôt.

### 4. Ce que l'application fait

**Incrémenter.** Un bouton. Chaque clic ajoute un à un total partagé, tenu en
base, et enregistre l'adresse de l'auteur du dernier clic.

**Afficher.** Le total courant, l'adresse du dernier auteur, et la provenance
de la lecture — `base` ou `cache` — au même titre que le PRD d'`ardoise`, pour
la même raison : sans cet affichage, un cache en panne est indiscernable d'un
cache qui fonctionne.

**Démarrer seule**, survivre à un redéploiement (le total est dans un volume
nommé), survivre à un cache absent ou à une base pas encore prête — les mêmes
garanties R4 à R6 qu'`ardoise`, redites ici parce qu'elles s'appliquent à
n'importe quelle application à état de la fabrique, pas seulement à la
première.

### 5. Ce que l'application ne fait pas

Pas de décrément, pas de remise à zéro, pas d'historique des clics — un entier
et un auteur suffisent à exercer les mêmes étages qu'`ardoise` sans dupliquer
sa complexité. Pas de limite de clics par compte : ce n'est pas un vote, c'est
une preuve d'infrastructure.

### 6. Les règles que le produit garantit

| # | Règle | Pourquoi |
|---|---|---|
| R1 | L'auteur vient de `X-Forwarded-User`, jamais d'un champ envoyé par le client | seule source d'identité admissible, et non négociable en `google` : n'importe qui entre |
| R2 | Une incrémentation invalide le cache ; la lecture suivante vient de la base | même contrat qu'ardoise R4 |
| R3 | Le cache absent ne casse rien : on lit la base | le cache est partagé — une panne côté `ardoise` ne doit pas non plus casser `compteur` |
| R4 | La base absente au démarrage n'empêche pas l'application de démarrer | `depends_on` ne garantit que le démarrage du voisin |
| R5 | La clé de cache est préfixée par l'application (`compteur:valeur`) | `redis` est partagé ; `ardoise` y écrit déjà sous `ardoise:lignes` |

### 7. Palier d'exposition

`google`. Aucune donnée sensible : un entier et une adresse e-mail de compte
authentifié, qui n'est pas plus exposée ici qu'elle ne l'est déjà par
l'authentification Google elle-même. `private` serait inutilement fermé —
rien ici ne justifie une liste blanche — et `public` interdirait de lire
`X-Forwarded-User`, la seule chose qui rend « qui a cliqué en dernier »
possible.

### 8. Critères d'acceptation

| # | Constat | Comment il est établi |
|---|---|---|
| A1 | `./init.sh --check` est vert avec l'app activée | commande |
| A2 | L'image finale pèse moins de 200 Mo et tourne en non-root | inspection de l'image construite |
| A3 | Un total incrémenté survit à `docker compose down && up` | stack réelle |
| A4 | La deuxième lecture consécutive vient du cache | réponse `provenance: cache` |
| A5 | `compteur` et `ardoise` déployés ensemble ne se marchent pas dessus dans `redis` | clés distinctes vérifiées en conteneur |
| A6 | Cache arrêté, l'application répond toujours | R3 |
| A7 | Base arrêtée au démarrage, l'application démarre et se rétablit | R4 |
| A8 | Le parcours cliquer → voir le total fonctionne dans un vrai navigateur | Playwright |

### 9. Hors périmètre

Tout ce qu'`ardoise` excluait déjà pour les mêmes raisons de coût : pas de
compte applicatif, pas de limite par utilisateur, pas de tests de charge.

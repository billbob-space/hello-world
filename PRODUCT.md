# Product — la fabrique

## Platform

Dépôt Git + CI GitHub Actions + une stack `dockhand` sur `billbob.ovh`. Aucune
interface : la fabrique se pilote par `./init.sh` et par des commits.

## Users

L'exploitant du serveur `billbob.ovh`, et les agents qui écrivent les
applications. Situation type : quelqu'un veut mettre en ligne une nouvelle
application derrière une authentification Google, sans toucher au serveur, et
sans risquer les applications déjà en service.

## Product Purpose

La fabrique répond à une question : **comment ajouter une application sans
casser les autres ?**

Elle produit deux choses. Un `compose.yaml` qui décrit exactement les
applications déclarées — ni plus, ni moins. Et un contrôle qui refuse un dépôt
dont le déploiement échouerait, ou pire, réussirait mal.

Le succès se mesure ainsi : une application ajoutée est en ligne, authentifiée,
sans qu'aucune autre n'ait bougé ; et une erreur de configuration est arrêtée
par `--check` avant d'atteindre le serveur.

## Positioning

Ce n'est pas un orchestrateur ni un PaaS. C'est un générateur : il traduit N
manifestes plats en un fichier Compose, une CI et un outillage, et il vérifie
que le résultat committé correspond bien aux manifestes committés.

Ce qui la distingue d'un script d'échafaudage : **elle vérifie ce qu'elle a
produit**, service par service, et elle échoue bruyamment plutôt que de laisser
passer une application sans authentification.

## Operating Context

- Une seule stack `dockhand`, donc un seul `docker compose up`, atomique pour
  l'ensemble. Le rayon de souffle est commun — c'est la contrainte qui explique
  la plupart des décisions.
- Le déploiement part de chaque fusion sur `main` : seules les applications
  modifiées sont reconstruites, puis un unique appel de webhook fait récupérer
  la stack entière. Deux à trois minutes.
- Traefik applique l'authentification Google avant que la requête n'atteigne un
  conteneur, et pose `X-Forwarded-User`. Deux paliers, choisis par application.
- Les manifestes sont plats et lus par `sed` : lancer `./init.sh` n'exige rien
  d'installé. C'est délibéré — un générateur qui demande à être installé n'est
  pas lançable dans la CI qu'il génère.

## Capabilities and Constraints

Ce que la fabrique décide :

| Objet | Source |
|---|---|
| Nom, URL, conteneur, routeur, image d'une app | le répertoire `apps/<nom>/` |
| Port, mémoire, santé, palier d'authentification | `apps/<nom>/app.yml` |
| Organisation, dépôt, registre, domaine, réseau, plafonds | `fabrique.yml` |

Ce qu'elle ne fait pas, et ne doit pas faire :

- **Elle ne génère ni `Dockerfile` ni code.** Le choix de la technologie
  appartient à l'agent, application par application.
- **Elle ne connaît aucun langage.** Chaque app dit comment elle se teste dans
  `test.sh`, comme elle dit comment elle se construit dans son `Dockerfile`.
- **Elle ne touche jamais à un `app.yml`** hors `--add` et `--app` : c'est la
  source de vérité, et l'écraser détruirait ce qu'un humain y a mis.
- **Elle ne configure pas le serveur** : réseau, DNS, certificats, identifiants
  de registre, `Force redeployment` vivent hors du dépôt.

## Product Principles

1. **Un échec fermé plutôt qu'un succès douteux.** Le pire cas acceptable est
   « rien n'est déployé ». « Tout tombe » et « c'est vert mais faux » ne le sont
   pas.
2. **Vérifier par service, jamais par recherche globale.** Une recherche dans
   tout le fichier passe au vert dès qu'un seul service est conforme — c'est
   exactement ainsi qu'une application se retrouverait publiée sans
   authentification.
3. **Ce qui est généré est toujours réécrit ; ce qui est déclaré ne l'est
   jamais.** La frontière entre les deux est la seule chose qui empêche une
   application d'exister dans le dépôt sans exister dans le déploiement.
4. **Rien de variable dans le temps dans un artefact généré.** Pas de date, pas
   d'ordre dépendant de la locale : un diff parasite est un redéploiement
   fantôme de toute la stack.
5. **Zéro dépendance pour lancer le contrôle.** `bash`, `sed`, `awk`, `git`.
   Docker et Python sont utilisés s'ils sont là, jamais exigés.

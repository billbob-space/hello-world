# Ossature — ardoise

> Contrat technique partagé par les quatre PRP. Tout PRP le lit avant de
> commencer et n'invente aucun nom qui n'y figure pas.
>
> **Source produit :** [`PRODUCT.md`](../PRODUCT.md)
> — le PRD tranche le *quoi* et le *pourquoi*. Ce fichier tranche le *où* et le
> *comment nommer*. En cas de désaccord, le PRD gagne et ce fichier est corrigé.

---

## 1. Identité de l'application

| | |
|---|---|
| Nom (donc répertoire, sous-domaine, conteneur, routeur) | `ardoise` |
| URL | `https://ardoise.apps.billbob.ovh` |
| Palier d'exposition | `private` — comptes de la liste blanche |
| Image | `ghcr.io/billbob-space/hello-world/ardoise:main` |
| Branches | `ardoise/<sujet>` |

## 2. Les quatre étages, et le service qui porte chacun

C'est la décision qui structure tous les PRP. Trois sortes de services vivent
dans un espace de noms **plat**, et une seule est joignable depuis Internet.

| Étage | Service compose | Sorte | Routé | D'où il vient |
|---|---|---|---|---|
| Interface + service | `ardoise` | app | **oui** | `apps/ardoise/app.yml` |
| Base de données | `ardoise-base` | annexe privée | non | section `services:` du même `app.yml` |
| Cache | `redis` | partagé | non | `shared_services` de `fabrique.yml` |

**Le cache est partagé, la base ne l'est pas.** Un cache Redis est le type même
du service que plusieurs applications se partagent sans se gêner — les clés sont
préfixées, la donnée est jetable. Une base porte le schéma et les données d'une
seule application : la partager crée une dépendance entre applications que la
fabrique n'a aucun moyen d'arbitrer. Le contrat le dit ainsi : `shared_services`
pour « un service dont **plusieurs** apps ont besoin ».

**Conséquence sur le rayon de souffle**, à ne pas oublier : `fabrique.yml` est
commun. Le modifier fait **reconstruire toutes les apps** au prochain passage en
CI. Le PRP qui touche `shared_services` est donc celui qui engage le plus, et
c'est pour cela qu'il est isolé (PRP 03).

## 3. `apps/ardoise/app.yml`, dans son état final

```yaml
enabled: true
port: 8080
memory: 128m
health_path: /healthz
health_cmd: wget --spider -q http://localhost:8080/healthz
exposure: private
stack: go
ui: true
env: [POSTGRES_PASSWORD]
needs: [redis]
services:
  - name: base
    image: postgres:17-alpine
    memory: 192m
    volumes:
      - donnees:/var/lib/postgresql/data
    env: [POSTGRES_PASSWORD]
```

Quatre points qui ne se devinent pas :

**`stack: go` et `ui: true`** n'ont aucun effet sur le déploiement : ils
choisissent l'outillage. `go` est déjà présent dans la fabrique, `ui: true`
aussi — aucun plugin nouveau, donc **rien à recoller** dans le *Setup script*
de l'environnement.

**Le volume s'appelle `donnees`, pas `base` ni `pgdata`.** Le contrat exige que
la séparation entre ce qui se sauvegarde et ce qui s'efface se lise dans les
noms : `donnees` se sauvegarde, `cache` se supprime. Déclaré par l'annexe, il
appartient à l'app : le volume réel est **`ardoise-donnees`**.

**`POSTGRES_PASSWORD` figure deux fois**, sur l'app et sur l'annexe : ce sont
deux conteneurs distincts, et `env:` ne se propage pas. Le nom seul entre dans
le dépôt ; la valeur est injectée par l'infrastructure.

**`needs: [redis]` émet un `depends_on`, et ne garantit que le démarrage** du
conteneur voisin, jamais sa disponibilité. L'application doit survivre à un
Redis qui n'accepte pas encore de connexion — et à un Redis qui n'en acceptera
jamais (règle R5 du PRD).

## 4. `fabrique.yml` — le service partagé

```yaml
shared_services:
  - name: redis
    image: valkey/valkey:8-alpine
    memory: 96m
    command: ["valkey-server", "--maxmemory", "64mb", "--maxmemory-policy", "allkeys-lru", "--save", ""]
```

**Aucun volume.** Le cache est jetable par construction : `--save ""` désactive
la persistance sur disque, et `allkeys-lru` borne la mémoire au lieu de laisser
le service grandir jusqu'à remplir le disque du serveur, qui est à 92 %. Un
volume ici ne protégerait rien et coûterait de la place.

**Le budget mémoire compte les trois sortes.** `memory_budget` vaut 1024 Mo,
384 Mo sont déjà engagés par les trois apps existantes. `ardoise` ajoute
128 + 192 + 96 = **416 Mo**, soit 800 Mo sur 1024. C'est tenable et c'est
serré : le PRP 03 vérifie la somme affichée par `--check` avant de committer.

## 5. Les noms — une seule liste, et personne n'en invente

| Nom | Ce que c'est |
|---|---|
| `ardoise` | l'app, le conteneur, le routeur, le sous-domaine |
| `ardoise-base` | l'annexe Postgres |
| `ardoise-donnees` | le volume réel de la base |
| `redis` | le service partagé, joignable sous ce nom depuis n'importe quelle app |
| `ardoise:lignes` | la clé Redis du cache — **préfixée par l'app**, le Redis étant partagé |
| `lignes` | la table Postgres |

**Le préfixe des clés Redis n'est pas cosmétique.** Le service est partagé :
deux applications qui écriraient `lignes` s'écraseraient mutuellement, en
silence, et le symptôme serait « mon app affiche les données d'une autre ».

## 6. Le modèle de données

```sql
CREATE TABLE IF NOT EXISTS lignes (
  id        BIGSERIAL   PRIMARY KEY,
  auteur    TEXT        NOT NULL,
  texte     TEXT        NOT NULL,
  ecrite_le TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Créée par l'application **au démarrage**, en `IF NOT EXISTS`, et réessayée tant
que la base n'accepte pas de connexion. C'est ce qui tient la règle « l'app
démarre sans intervention » du contrat : pas de migration à lancer à la main.

`auteur` vient de `X-Forwarded-User` et de nulle part ailleurs.

## 7. Les routes HTTP

| Méthode | Chemin | Rôle |
|---|---|---|
| `GET` | `/` | la page — HTML, CSS et JS embarqués dans le binaire |
| `GET` | `/api/lignes` | les 50 dernières lignes, JSON |
| `POST` | `/api/lignes` | écrit une ligne, JSON en entrée |
| `GET` | `/healthz` | 200 dès que le serveur écoute |

**`/healthz` ne sonde ni la base ni le cache**, et c'est délibéré. Le
healthcheck décide si Docker garde le conteneur : le lier à la base ferait
tuer une application parfaitement capable de servir sa page pendant que la base
redémarre. Ce qu'il affirme est « le serveur écoute », rien de plus.

Forme de la réponse de `GET /api/lignes` :

```json
{ "provenance": "cache", "lignes": [ { "auteur": "…", "texte": "…", "ecrite_le": "2026-08-04T19:00:00Z" } ] }
```

`provenance` vaut `base` ou `cache`. Le PRD en fait une exigence produit (§5) :
sans elle, un cache en panne est indiscernable d'un cache qui marche.

## 8. Les variables d'environnement lues par l'application

| Nom | Origine | Absente ⇒ |
|---|---|---|
| `POSTGRES_PASSWORD` | `env:` de l'app | chaîne vide — connexion sans mot de passe |
| `ARDOISE_BASE_URL` | valeur par défaut dans le code | `postgres://postgres@ardoise-base:5432/postgres` |
| `ARDOISE_REDIS_ADDR` | valeur par défaut dans le code | `redis:6379` |

**Les deux dernières ne sont pas dans `env:`, et c'est voulu.** Le contrat émet
`- NOM=${NOM:-}` : un nom non défini côté serveur arrive **vide**, pas absent.
Une valeur par défaut dans le code est donc plus sûre qu'un `env:` pour ce qui
n'est pas un secret — et le code doit de toute façon traiter la chaîne vide
comme une absence.

## 9. L'arborescence

```
apps/ardoise/
  app.yml          manifeste — jamais réécrit par init.sh
  Dockerfile       multi-étapes, image finale < 200 Mo, USER non root
  .dockerignore    écrit par --add
  test.sh          le seul fichier que la CI lance
  README.md        ce qu'il faut savoir pour l'exploiter — dont les noms d'env
  PRODUCT.md       le produit, pour l'agent qui reprendra
  prp/             ces documents
  go.mod go.sum
  main.go          câblage : configuration, serveur, arrêt propre
  domaine.go       règles pures — validation d'une ligne, aucune E/S
  base.go          Postgres — schéma, écriture, lecture
  cache.go         Redis — lecture, écriture, invalidation
  api.go           les quatre routes
  web/             index.html, ardoise.css, ardoise.js — embarqués par go:embed
  *_test.go        tests unitaires
  e2e/             tests de bout en bout — stack réelle, navigateur
```

## 10. Le découpage en PRP, et pourquoi celui-là

**Un PRP = une branche `ardoise/<sujet>` = une pull request = un état déployable
de plus.** La frontière tombe là où un relecteur pourrait accepter l'un et
refuser son voisin.

| PRP | Branche | Ce qui devient vrai |
|---|---|---|
| [01](01-socle.md) | `socle` | L'URL répond. L'image est publiée, `--check` est vert, l'app est dans la stack. |
| [02](02-donnees.md) | `donnees` | Une ligne écrite survit à un redéploiement. |
| [03](03-cache.md) | `cache` | La lecture passe par le cache, et l'écran dit d'où elle vient. |
| [04](04-interface.md) | `interface` | Un humain écrit sa ligne dans un navigateur, sans lire de JSON. |

**Le PRP 01 porte deux commits, et deux ne suffiraient pas s'ils étaient dans
une seule PR** : sur une pull request, la CI construit **sans publier**. L'image
n'existe sur le registre qu'une fois la PR fusionnée, et l'app ne peut entrer
dans le compose qu'après. C'est la séquence « construire d'abord, brancher
ensuite » du contrat.

**02 avant 03**, parce qu'un cache devant une base qui n'existe pas ne se relit
pas : R5 du PRD dit que le cache est une optimisation, et une optimisation se
mesure contre un état de référence.

**04 en dernier**, parce que l'interface ne peut montrer la provenance qu'une
fois la provenance calculée. Jusque-là, `curl` suffit à tout vérifier.

Les deux découpes écartées : un PRP par étage technique — front, back, base,
cache — qui produit quatre documents dont trois ne se relisent pas seuls, aucun
n'étant déployable ; et un PRP unique, qui ferait porter à une seule PR la
publication de l'image **et** la modification de `fabrique.yml`, c'est-à-dire le
plus grand rayon de souffle de la fabrique en un seul geste.

## 11. Ce que chaque PRP vérifie avant de committer

Sans exception, et dans cet ordre :

```bash
./init.sh --check      # manifestes, artefacts, compose service par service
./init.sh --pret       # branche dédiée, contrat vert, tests des apps touchées
```

Un PRP n'est pas terminé sur « le code est écrit » mais sur « la commande
suivante affiche ceci » — chaque PRP nomme la sienne.

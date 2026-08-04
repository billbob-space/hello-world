# PRP 03 — Cache

> Lis [`00-ossature.md`](00-ossature.md) d'abord. Dépend du PRP 02.
> **Branche :** `ardoise/cache`
> **Ce qui devient vrai :** la lecture passe par le cache, et la réponse dit
> d'où elle vient.

---

## Objectif

Un Redis **partagé par la fabrique**, déclaré une fois dans `fabrique.yml`,
devant lequel `ardoise` place ses lectures. La réponse porte `provenance:
base` ou `provenance: cache`.

## Le PRP qui engage le plus, et pourquoi

`fabrique.yml` est **commun à toutes les applications**. Le modifier fait
reconstruire toutes les apps au prochain passage en CI : plus rien ne garantit
alors que les images publiées correspondent aux manifestes courants. C'est le
seul PRP d'`ardoise` dont le rayon de souffle dépasse son application, et c'est
la raison pour laquelle il est isolé dans sa propre pull request.

## Tâches

### 1. Le service partagé

`fabrique.yml` — décommenter et adapter `shared_services` :

```yaml
shared_services:
  - name: redis
    image: valkey/valkey:8-alpine
    memory: 96m
    command: ["valkey-server", "--maxmemory", "64mb", "--maxmemory-policy", "allkeys-lru", "--save", ""]
```

Trois décisions, chacune contre un risque nommé :

| Réglage | Contre quoi |
|---|---|
| `--save ""` | un cache qui écrit sur un disque à 92 % pour une donnée jetable |
| `--maxmemory 64mb` + `allkeys-lru` | un service sans borne qui grossit jusqu'à faire tomber la stack |
| aucun `volumes:` | sauvegarder ce que l'application sait reconstruire en une lecture |

**Pas de mot de passe.** Redis n'est joignable que depuis `apps_net`, aucun port
n'est publié sur l'hôte, et un `--requirepass` exigerait une valeur injectée
côté serveur — donc un nom de plus à définir, dont l'absence arriverait **vide**.

`apps/ardoise/app.yml` gagne :

```yaml
needs: [redis]
```

Un nom absent de `shared_services` fait échouer la génération, pas le démarrage.

### 2. Le test avant le code

`cache_test.go`, contre un Redis réel, **sauté** si `ARDOISE_TEST_REDIS_ADDR`
est absent :

| Test | Règle du PRD |
|---|---|
| première lecture → `base`, seconde → `cache` | §5 |
| une écriture invalide le cache : la lecture suivante → `base` | R4 |
| cache injoignable → lecture servie par la base, aucune erreur | **R5** |

Le troisième est le plus important, et le moins spontané à écrire : il exige de
lancer l'application contre une adresse Redis morte et de vérifier qu'elle
**répond quand même**.

### 3. Le code

`cache.go` — `Lire() ([]Ligne, bool)`, `Ecrire([]Ligne)`, `Invalider()`. Clé
`ardoise:lignes`, TTL 30 s.

**Le préfixe `ardoise:` n'est pas cosmétique** : le Redis est partagé, deux
applications qui écriraient `lignes` s'écraseraient en silence.

**Toute erreur Redis est avalée et journalisée, jamais propagée** : une lecture
qui échoue se comporte comme une absence de cache. C'est R5, et c'est ce qui
sépare une optimisation d'une dépendance.

### 4. Vérifier la mémoire

```bash
./init.sh --check    # « memoire engagee … / 1024 Mo sur N service(s) »
```

384 (apps existantes) + 128 (ardoise) + 192 (base) + 96 (redis) = **800 Mo sur
1024**. `--check` avertit au-delà du plafond ; ici il ne doit pas avertir.

## Critères d'acceptation

| # | Constat | Comment |
|---|---|---|
| 1 | `--check` vert, 5 services, mémoire ≤ 1024 Mo | `./init.sh --check` |
| 2 | `redis` porte `traefik.enable=false` et aucun autre label `traefik.*` | `compose.yaml` |
| 3 | Deuxième lecture consécutive → `provenance: cache` | stack réelle |
| 4 | Écriture puis lecture → `provenance: base` | R4 |
| 5 | **Redis arrêté, l'application répond toujours** | R5 |
| 6 | La clé Redis est bien `ardoise:lignes` | `valkey-cli KEYS '*'` |

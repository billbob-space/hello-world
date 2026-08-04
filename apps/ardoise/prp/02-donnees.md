# PRP 02 — Données

> Lis [`00-ossature.md`](00-ossature.md) d'abord. Dépend du PRP 01.
> **Branche :** `ardoise/donnees`
> **Ce qui devient vrai :** une ligne écrite survit à un redéploiement.

---

## Objectif

Une base Postgres privée à l'application, dans un volume nommé, avec un schéma
créé au démarrage et deux routes JSON. Pas encore de cache : toute lecture va en
base, et `provenance` vaut `base` sans condition.

## Ce que ce PRP met à l'épreuve dans le contrat

`services:`, `volumes:`, `env:` — trois sections qu'aucune app du dépôt
n'utilisait — et le piège documenté dans `memory/volumes.md` : **au premier
montage, Docker recopie dans le volume vide le répertoire tel qu'il existe dans
l'image, propriétaire compris.** Le symptôme d'un oubli est « l'app démarre et
perd tout », jamais un message clair.

Ici le volume est monté par l'**annexe** `postgres:17-alpine`, dont le
`Dockerfile` ne nous appartient pas : c'est l'image officielle qui `chown` son
`PGDATA`, et l'avertissement de `--check` sur le `chown` ne couvre pas ce cas —
il ne lit que le `Dockerfile` de l'app. Le vérifier en stack réelle est donc le
seul moyen (critère 3).

## Tâches

### 1. Les manifestes

`apps/ardoise/app.yml` gagne trois sections, écrites **à la main** — elles n'ont
pas d'équivalent en ligne de commande :

```yaml
env: [POSTGRES_PASSWORD]
services:
  - name: base
    image: postgres:17-alpine
    memory: 192m
    volumes:
      - donnees:/var/lib/postgresql/data
    env: [POSTGRES_PASSWORD]
```

Puis `./init.sh` et **relis ton bloc dans `compose.yaml`** : le lecteur YAML est
volontairement minimal, une clé mal orthographiée y est ignorée sans être
refusée, et le compose est le seul endroit qui dise ce qui a vraiment été lu.

Trois choses à voir dans le compose généré :

- le service s'appelle `ardoise-base`, pas `base` ;
- il porte `traefik.enable=false`, **et lui seul** — c'est ce label, non son
  absence, qui le retire du routage ;
- le bloc `volumes:` de premier niveau déclare `ardoise-donnees` avec son
  `name:`, sans quoi Compose préfixerait par le nom du projet et une sauvegarde
  archiverait un répertoire vide en sortant en 0.

### 2. Les tests avant le code

`domaine_test.go` — les règles pures, sans aucune E/S :

| Test | Règle du PRD |
|---|---|
| une ligne vide est refusée | R1 |
| une ligne d'espaces seuls est refusée | R1 |
| 140 caractères passent, 141 sont refusés | R2 |
| l'auteur vient de l'en-tête, jamais du corps | R3 |

`base_test.go` — la couche base contre un Postgres réel, **sautée** si
`ARDOISE_TEST_BASE_URL` est absent : la CI ne lance que `test.sh`, et `test.sh`
doit rester vert sans infrastructure.

```go
func TestEcritureRelecture(t *testing.T) {
    url := os.Getenv("ARDOISE_TEST_BASE_URL")
    if url == "" { t.Skip("ARDOISE_TEST_BASE_URL absent") }
    …
}
```

### 3. Le code

`domaine.go` — `ValiderTexte(string) (string, error)`, pure.
`base.go` — connexion `pgxpool`, `Migrer()` en `CREATE TABLE IF NOT EXISTS`,
`Ajouter(auteur, texte)`, `Dernieres(n)`.
`api.go` — `GET`/`POST /api/lignes`.

**Le démarrage ne doit rien exiger** (règle R6 du PRD) : `depends_on` ne garantit
que le démarrage du conteneur voisin, pas qu'il accepte des connexions.
`Migrer()` réessaie en boucle, en tâche de fond, et le serveur HTTP écoute
pendant ce temps. Une requête arrivée trop tôt répond 503, pas un panic.

### 4. Le Dockerfile

Rien à changer : le volume appartient à l'annexe, pas à l'app. **Ne mets pas de
`chown /var/lib/postgresql/data`** dans le `Dockerfile` d'`ardoise` — ce chemin
n'existe pas dans cette image, et l'y créer ne ferait qu'égarer le lecteur.

## Critères d'acceptation

| # | Constat | Comment |
|---|---|---|
| 1 | `--check` vert, mémoire annoncée en hausse de 192 Mo | `./init.sh --check` |
| 2 | Les tests unitaires passent sans base | `./apps/ardoise/test.sh` |
| 3 | **Une ligne écrite se relit après `down` puis `up`** | stack réelle |
| 4 | L'annexe porte `traefik.enable=false` et aucun autre label `traefik.*` | lecture de `compose.yaml` |
| 5 | La base arrêtée, l'application démarre quand même et se rétablit | R6 |
| 6 | Le volume réel s'appelle `ardoise-donnees` | `docker volume ls` |

Le critère 3 est le cœur du PRP : c'est la seule affirmation du contrat que rien
ne vérifiait, et c'est celle dont l'échec est silencieux.

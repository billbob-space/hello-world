# Ossature et implémentation — compteur

> Source produit : [`PRODUCT.md`](../PRODUCT.md).
> Un seul document : l'application est trop petite pour que le découpage en
> plusieurs PRP produise des documents relisables séparément — le contrat
> lui-même écarte ce découpage-là (« un PRP par item du PRD » est l'une des
> deux formes explicitement rejetées dans `apps/marcq-handball/prp/README.md`).

---

## 1. Identité

| | |
|---|---|
| Nom | `compteur` |
| URL | `https://compteur.apps.billbob.ovh` |
| Palier d'exposition | `google` |
| Image | `ghcr.io/billbob-space/hello-world/compteur:main` |
| Branche | `compteur/socle` |

## 2. Les trois services

| Service | Sorte | Rôle |
|---|---|---|
| `compteur` | app, routée | l'interface et l'API |
| `compteur-base` | annexe privée | Postgres 17, volume `compteur-donnees` |
| `redis` | **partagé, déjà déclaré** | le même service que celui d'`ardoise` — premier test réel du partage |

Contrairement à `ardoise`, ce PRP ne touche **pas** `fabrique.yml` : `redis` y
existe déjà. `compteur` se contente d'ajouter `needs: [redis]` à son
`app.yml`. C'est délibéré et c'est le point du run 2 : si deux applications
partageant un `shared_services` se marchent dessus, ce doit être visible ici,
pas seulement affirmé par le contrat.

## 3. `apps/compteur/app.yml`

```yaml
enabled: false   # jusqu'a la publication de l'image
port: 8080
memory: 128m
health_path: /healthz
health_cmd: wget --spider -q http://localhost:8080/healthz
exposure: google
stack: go
ui: true
env: [POSTGRES_PASSWORD]
needs: [redis]
services:
  - name: base
    image: postgres:17-alpine
    memory: 160m
    volumes:
      - donnees:/var/lib/postgresql/data
    env: [POSTGRES_PASSWORD]
```

Budget mémoire : 128 (compteur) + 160 (base) = 288 Mo de plus. Avant ce PRP,
`--check` annonçait 800 Mo/1024 (voir le run 1) ; après, 1088 Mo/1024 —
**au-delà du plafond**. `--check` avertit, ne bloque pas (`memory_budget` n'est
pas un KO), mais §5 le documente comme un constat à trancher avant d'activer
réellement l'app, pas à ignorer.

## 4. Le modèle de données

```sql
CREATE TABLE IF NOT EXISTS compteur (
  id          SMALLINT     PRIMARY KEY DEFAULT 1,
  valeur      BIGINT       NOT NULL DEFAULT 0,
  dernier_par TEXT         NOT NULL DEFAULT '',
  maj_le      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT une_seule_ligne CHECK (id = 1)
);
INSERT INTO compteur (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
```

Une seule ligne, verrouillée par la contrainte `id = 1` : le compteur est un
singleton, pas une collection. `Incrementer` fait un `UPDATE ... SET valeur =
valeur + 1, dernier_par = $1, maj_le = now() WHERE id = 1 RETURNING …` —
atomique, la concurrence de deux clics simultanés est réglée par Postgres, pas
par l'application.

## 5. Les routes

| Méthode | Chemin | Rôle |
|---|---|---|
| `GET` | `/` | la page |
| `GET` | `/api/compteur` | `{ "provenance": "base\|cache", "valeur": N, "dernier_par": "…", "maj_le": "…" }` |
| `POST` | `/api/compteur` | incrémente de un, invalide le cache |
| `GET` | `/healthz` | 200 dès que le serveur écoute — ne sonde ni base ni cache, même raison que dans `ardoise` |

Clé de cache : **`compteur:valeur`** — préfixée par l'app, à côté de
`ardoise:lignes` dans le même Redis. C'est le critère A5 du PRD.

## 6. Ce que le run 1 a déjà appris, et qui s'applique tel quel ici

- `POSTGRES_PASSWORD` figure deux fois dans `app.yml` (app et annexe) : deux
  conteneurs distincts, `env:` ne se propage pas.
- `Migrer()` réessaie en tâche de fond, le serveur HTTP démarre sans attendre
  la base (R4) — copié du câblage `ardoise`, mêmes garanties.
- Le cache avale ses erreurs et se comporte comme absent quand il l'est (R3) —
  même filet qu'`ardoise`, et ici doublement important : une panne de `redis`
  toucherait **deux** applications à la fois.
- `env:` n'accepte que des NOMS ; `ARDOISE_BASE_URL`-like (`COMPTEUR_BASE_URL`,
  `COMPTEUR_REDIS_ADDR`) restent des valeurs par défaut dans le code, pas dans
  `env:` — un nom non défini y arrive vide, pas absent.

## 7. Différences délibérées avec `ardoise`

- Pas de front riche : un total, un bouton, une ligne « dernier clic par… ».
  Rien à échapper (un entier ne porte pas de HTML), donc pas de test
  d'échappement à l'e2e — la surface de risque n'existe pas ici.
- Un seul PRP au lieu de quatre : l'app est plus petite, et forcer un
  découpage aurait produit des documents qu'on ne peut pas relire seuls, ce
  que le contrat écarte explicitement.

## 8. Arborescence

```
apps/compteur/
  app.yml Dockerfile .dockerignore test.sh README.md PRODUCT.md
  go.mod go.sum
  main.go domaine.go base.go cache.go api.go
  web/{index.html,compteur.css,compteur.js}
  *_test.go
  e2e/{lancer.sh,package.json,playwright.config.js,tests/compteur.spec.js}
```

## 9. Critères de fin

```bash
./init.sh --check
./init.sh --pret
./apps/compteur/test.sh
./apps/compteur/e2e/lancer.sh   # avant la pull request
```

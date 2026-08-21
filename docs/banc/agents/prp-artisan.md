# PRP — hello-world : la sonde dit si l'app est prete, et /version l'expose

## Pourquoi

Un redeploiement remet l'app a zero. Entre le demarrage du processus et le
moment ou elle sert vraiment, la sonde repond deja `ok` : l'orchestrateur bascule
le trafic trop tot. On veut une phase de chauffe explicite, et un point unique ou
lire l'etat de l'instance.

## Ce qu'il faut

### 1. Une phase de chauffe

Duree configurable par la variable d'environnement `HELLO_WARMUP_S`, en secondes
entieres, valeur par defaut `2`.

- Valeur absente, vide, non numerique, ou negative : la valeur par defaut
  s'applique. **L'application demarre quand meme** — elle ne s'arrete jamais sur
  une variable d'environnement mal posee.
- `HELLO_WARMUP_S=0` est une valeur valide : aucune chauffe.

Pendant la chauffe, `GET /healthz` rend **503** et le corps `starting\n`.
Apres, il rend **200** et le corps `ok\n`, comme aujourd'hui.
Le `Content-Type` reste `text/plain; charset=utf-8` dans les deux cas.

### 2. `GET /version`

Rend du JSON, `Content-Type: application/json; charset=utf-8`, statut **200**
en toutes circonstances — y compris pendant la chauffe.

    {
      "version":  "<la version complete>",
      "short":    "<la version raccourcie, meme regle que la page>",
      "started":  "<RFC3339>",
      "uptime_s": <entier, secondes entieres depuis le demarrage>,
      "ready":    <booleen, faux pendant la chauffe>
    }

Les cinq clefs, toujours les cinq. `uptime_s` est un nombre JSON, pas une chaine.
Cette route n'expose **aucune identite d'utilisateur**.

### 3. Ce qui ne change pas

- `GET /{$}` sert la page comme aujourd'hui.
- L'en-tete `X-App-Version` est present sur **toutes** les reponses, la 503 de
  chauffe comprise.
- `./apps/hello-world/test.sh` passe, et **en moins de trois secondes** :
  une suite qui attend la vraie horloge n'est pas une suite.

## Ce qui est hors sujet

Le compose, `fabrique.yml`, l'outillage, une autre app, `PRODUCT.md`, `prp/`.

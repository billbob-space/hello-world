# `apps/<nom>/app.yml` — les valeurs que tu décides

Quand lire : avant de créer ou de modifier un `apps/<nom>/app.yml` — champs,
sections `volumes:`, `env:`, `needs:`, `services:`.
Tenu par : --check — noms de service, formes de `volumes:`, `env:` en NOMS seuls,
`needs:` connu de `shared_services`, `command:` scalaire ou liste

Un fichier par application. **`init.sh` ne le réécrit jamais** : il est la source
de vérité, tu l'édites à la main.

```yaml
enabled: true              # false = dans le dépôt, mais hors du compose
port: 8080                 # port d'écoute dans le conteneur, HTTP en clair
memory: 128m               # limite mémoire du conteneur
health_path: /healthz      # chemin HTTP renvoyant 200 quand l'app est prête
health_cmd: wget --spider -q http://localhost:8080/healthz
exposure: private          # private | google | public — voir plus bas
stack: none                # langage principal — active son serveur LSP
ui: false                  # true si l'app sert une interface web
volumes:                   # optionnel — ce qui survit au redéploiement
  - donnees:/var/lib/mon-app
```

Édite-le puis relance `./init.sh`, ou passe les valeurs en options — elles ne
valent alors que pour l'app ciblée :

```bash
./init.sh --app mon-app --port 3000 --health /health \
          --health-cmd 'curl -fsS http://localhost:3000/health' --exposure google
```

**`enabled: false` n'est pas un brouillon, c'est une protection.** La stack étant
unique, référencer une image qui n'existe pas encore ferait échouer le `compose
up` de **toutes** les apps. Une app neuve naît désactivée et n'entre dans le
compose qu'une fois sa première image publiée.

**`health_cmd` est le piège le plus fréquent** : il s'exécute *dans* ton
conteneur, l'outil qu'il appelle doit donc exister dans l'image finale. `wget`
est présent en Alpine et BusyBox, `curl` rarement. Une image `scratch` ou
`distroless` n'a **aucun shell** : mets `health_cmd: none`. Un healthcheck qui
échoue rend le conteneur malsain en permanence, sans que l'app soit en cause.

**`stack` et `ui` ne changent rien au déploiement**, seulement l'outillage décrit
plus bas. `.claude/settings.json` étant un réglage **de projet**, l'outillage est
l'**union** de ce que demandent toutes les apps, y compris les désactivées.

## Quatre sections optionnelles : `volumes:`, `env:`, `needs:`, `services:`

Sans équivalent en ligne de commande : elles s'écrivent à la main. Une app qui
n'en porte aucune produit exactement le bloc compose d'avant leur existence — les
déclarer est une demande explicite, jamais un passage obligé.

```yaml
volumes:
  - donnees:/var/lib/ramure     # devient le volume nommé « ramure-donnees »
  - cache:/var/cache/ramure     # jetable, et son nom le dit
env: [LASTFM_API_KEY]           # des NOMS de variables, jamais de valeurs
needs: [redis]                  # un service de shared_services (fabrique.yml)
services:                       # services annexes, privés de cette app
  - name: worker
    image: ghcr.io/billbob-space/hello-world/ramure:main
    memory: 64m
    command: --mode worker
    volumes:
      - donnees:/var/lib/ramure # le MÊME volume que l'app : partage voulu
```

**Le lecteur YAML d'`init.sh` est volontairement minimal** — listes en ligne
`[a, b]` ou en bloc `- a`, listes de mappings dont chaque élément peut porter une
liste, mais pas un niveau de plus ; ni ancre, ni bloc multi-lignes. Conséquence :
une **clé mal orthographiée est ignorée, pas refusée**. Dans `services:` et
`shared_services:`, `init.sh` l'avertit (`cle inconnue 'labels' ignoree`) sans
bloquer — écrire `labels:` à la main donne le sentiment d'avoir durci un service
sans qu'une ligne du compose bouge. Après avoir édité une de ces sections,
relance `./init.sh` et relis ton bloc dans `compose.yaml` : c'est le seul endroit
qui dise ce qui a vraiment été lu.

**`env:` ne porte que des noms**, conformes à `^[A-Z][A-Z0-9_]*$`. Un `=`, ou un
`lastfm_key`, fait échouer la génération, qui n'écrit alors aucun artefact : le
dépôt est public. `init.sh` émet `- NOM=${NOM:-}`, dont la valeur vient de
l'environnement du serveur. Le défaut vide est délibéré — un nom non défini côté
serveur ferait sinon échouer le `compose up` de la stack entière — mais il se
paie : ta variable arrive **vide** au lieu de manquer, et c'est à ton app de
traiter la chaîne vide comme une absence. Déclare aussi les noms dans ton
`README`.

**`needs:` est vérifié à la génération** : un nom absent de `shared_services`
fait échouer `./init.sh`, plutôt qu'un `depends_on` pointant dans le vide. Mais ce
que `depends_on` garantit s'arrête au **démarrage** du conteneur voisin, pas à sa
disponibilité : ton app doit survivre à un `redis` qui n'accepte pas encore de
connexion.

**`services:` — des annexes privées de l'app.** `name` et `image` sont
obligatoires : la CI ne construit que les `apps/<nom>/`, l'image d'une annexe doit
donc exister ailleurs — le plus souvent celle de l'app, `.../<app>:main`, lancée
avec une `command` différente. `memory` vaut `128m` par défaut. `command` s'écrit
en scalaire — découpée sur les espaces, guillemets respectés — ou en **liste**
YAML, chaque élément étant alors un argument tel quel ; elle est lue et émise **en
entier**, en forme exec. Une annexe devient le service `<app>-<name>`, et **ses
volumes appartiennent à l'app, pas à elle** : `donnees:/var/lib/ramure` dans le
worker monte le même `ramure-donnees` que l'app — c'est ainsi qu'un worker partage
les données de son service principal, et c'est la raison d'être du préfixe.

**Les secrets n'ont qu'une porte, et elle regarde le résultat**, jamais un champ :
un contrôle par nom de clé a autant de trous que le manifeste a de champs. Celui
qui existait sur `command:` a été contourné trois fois — un `sh -c` en jeton
unique, une valeur commençant par `-` prise pour une option, puis `health_cmd`,
qui n'entrait pas par `command:` du tout.

Avant d'écrire quoi que ce soit — et de nouveau dans `--check` — `init.sh`
**scanne `compose.yaml`, `fabrique.yml` et les `apps/*/app.yml`** à la recherche
d'un motif et d'un seul : `<mot-secret><séparateur><valeur littérale>`, où le mot
est `requirepass`, `password`, `passwd`, `secret`, `token`, `api-key`,
`secret-key`, `private-key`, `access-key`, `auth-token`… ou le
`://utilisateur:motdepasse@` d'une URL, et le séparateur l'espace, `=` ou `:`.
**Une valeur commençant par `-` compte comme une valeur.** L'échec nomme le
fichier et la ligne, sans jamais réimprimer la valeur.

Deux formes restent admises, et ce sont les bonnes : `${VAR}` ou `$(...)`,
injectés par l'infrastructure (`--requirepass ${REDIS_PASSWORD}`), et un
**chemin**, forme du secret monté en fichier (`--password-file /run/secrets/pw`).
Les faux positifs sont évités par la **frontière gauche** — le mot doit ouvrir la
ligne en clé YAML ou être collé à la ponctuation d'une option : `key` et `auth`
seuls ne déclenchent rien, et `--notify-keyspace-events Ex`,
`--tls-key-file /certs/k.pem`, `--auth-host=trust` passent.


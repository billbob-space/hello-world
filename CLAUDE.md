# Contrat de déploiement — billbob.ovh

Cette application est déployée automatiquement sur le serveur `billbob.ovh`.
Les règles ci-dessous sont imposées par l'infrastructure : les enfreindre ne
provoque pas une erreur claire, mais un déploiement qui échoue en silence.

**Le nom de l'application et l'organisation GitHub sont déduits du dépôt.** Rien
n'est à personnaliser dans ce fichier : il est identique dans tous les dépôts.

## Démarrage

```bash
./init.sh              # écrit app.yml et génère les fichiers d'infrastructure
./init.sh --check      # vérifie le dépôt contre app.yml et contre le contrat
```

`init.sh` ne crée **ni** `Dockerfile` **ni** code applicatif : c'est ton travail,
et le choix de la technologie t'appartient.

## `app.yml` — les valeurs que tu décides

C'est le seul fichier que tu renseignes. Il porte ce qui dépend de ton
application ; le reste du contrat est encodé dans le script.

```yaml
port: 8080                 # port d'écoute dans le conteneur, HTTP en clair
memory: 128m               # limite mémoire du conteneur
health_path: /healthz      # chemin HTTP renvoyant 200 quand l'app est prête
health_cmd: wget --spider -q http://localhost:8080/healthz
exposure: private          # private | google — voir plus bas
stack: none                # langage principal — active son serveur LSP
ui: false                  # true si l'app sert une interface web
```

Édite-le puis relance `./init.sh --force`, ou passe les valeurs en options :

```bash
./init.sh --force --port 3000 --health /health \
          --health-cmd 'curl -fsS http://localhost:3000/health' \
          --exposure google
```

**`health_cmd` est le piège le plus fréquent.** Il s'exécute *dans* ton
conteneur : l'outil qu'il appelle doit exister dans l'image finale. `wget` est
présent dans les images Alpine et BusyBox, `curl` rarement sans installation.
Une image `scratch` ou `distroless` n'a **aucun shell** : mets alors
`health_cmd: none`. Un healthcheck qui échoue rend le conteneur malsain en
permanence, sans que l'app soit en cause.

**`stack` et `ui` ne changent rien au déploiement.** Ils déterminent l'outillage
décrit plus bas. Renseigne-les dès que tu as choisi ta technologie, puis relance
`./init.sh --force`.

## Ton outillage — les plugins Claude Code

`init.sh` écrit un `.claude/settings.json` **versionné** : tout clone du dépôt —
toi, un autre agent, une session cloud, la CI — repart avec le même outillage.

Le socle, présent dans tous les dépôts :

| Plugin | Ce qu'il apporte |
|---|---|
| `superpowers` | Méthode de travail : brainstorming avant de coder, TDD, débogage systématique, rédaction de plans |
| `mattpocock-skills` | TDD, revue de code, modélisation du domaine, diagnostic de bogues |
| `code-review` / `code-simplifier` | Revue et simplification du code déjà écrit |
| `commit-commands` | Commit, push, ouverture de PR |
| `security-guidance` | Relit chaque modification à la recherche de vulnérabilités |
| `context7` | Documentation **à jour** des bibliothèques — consulte-le plutôt que ta mémoire |
| `github` | PR, Actions, GHCR |

S'y ajoutent, selon `app.yml` : le serveur **LSP** correspondant à `stack` — il
te donne les erreurs du compilateur après chaque édition, pour zéro contexte —
et, si `ui: true`, `frontend-design`, `playwright` et `impeccable`.

**Déclarer un plugin ne l'installe pas.** Claude Code le signalera manquant tant
qu'il n'a pas été récupéré. Une fois par machine ou par conteneur d'agent :

```bash
./.claude/install-plugins.sh     # puis /reload-plugins dans une session ouverte
```

### En session cloud, ce script ne suffit pas

Sur `claude.ai/code`, **Claude Code charge les plugins avant de les installer**.
Le hook `SessionStart` qui lance `install-plugins.sh` s'exécute après ce
chargement : les plugins finissent bien sur le disque, mais la session en cours
ne les voit pas. Et `/reload-plugins` est une commande du terminal, absente du
web — comme `/plugin`, `/resume` ou `/clear`. Chaque session cloud démarrant sur
une VM neuve, le `--if-needed` ne rattrape jamais rien : l'outillage est
réinstallé à chaque fois et n'est jamais utilisé.

Le seul point d'accroche assez tôt est le **setup script de l'environnement**,
qui tourne avant le lancement de Claude Code. `init.sh` en génère le contenu —
les plugins, plus **le binaire du serveur LSP** correspondant à `stack` : l'image
cloud fournit les compilateurs, jamais les serveurs de langage, et sans ce
binaire le plugin est installé mais inerte.

```bash
cat .claude/cloud-setup.sh     # à coller dans le champ "Setup script"
```

Sur `claude.ai/code` : icône nuage au-dessus de la zone de saisie → engrenage de
l'environnement → champ **Setup script**. Le résultat est figé dans un instantané
du disque, donc le script ne rejoue qu'après modification de l'environnement ou
expiration du cache (~7 jours) — les sessions suivantes démarrent avec
l'outillage déjà en place.

Pour les stacks dont le serveur de langage ne s'installe pas en une commande à
travers l'allowlist réseau, le script généré pose un `TODO` explicite plutôt
qu'une commande inventée : complète-le avant de le coller.

Cette configuration vit **hors du dépôt**, dans ton compte : `init.sh` ne peut
pas la mettre à jour. Après un `./init.sh --force` qui change `stack` ou `ui`,
recolle le fichier. `./init.sh --check` signale l'écart entre les deux listes.

`.claude/settings.local.json` est ignoré par git : c'est là que vont tes
préférences personnelles, jamais dans le fichier versionné. Et **jamais de bloc
`env` dans `.claude/settings.json`** : il est public par construction, y poser un
jeton le publie. `./init.sh --check` refuse un settings qui en contient un.

## Les deux paliers d'authentification

L'application est **toujours derrière une authentification Google**, appliquée
par Traefik avant qu'une requête ne l'atteigne. Deux paliers existent, choisis
par `exposure` dans `app.yml` :

| `exposure` | Middleware Traefik | Qui entre | Quand l'utiliser |
|---|---|---|---|
| `private` *(défaut)* | `forwardauth` | **Uniquement les comptes de la liste blanche** du serveur | Tout ce qui touche à de l'administration, de l'infra, un shell, ou des données personnelles |
| `google` | `forwardauth-open` | **N'importe quel compte Google authentifié** | Une app dont la surface ne touche que des API tierces ou du contenu non sensible, ou dont les données sont strictement cloisonnées par utilisateur |

**Il n'existe pas de troisième palier.** L'exposition publique sans
authentification n'est pas disponible ; ne cherche pas à la configurer.

Dans les deux cas, l'identité de l'utilisateur connecté arrive dans l'en-tête
HTTP **`X-Forwarded-User`** (son adresse e-mail), posé par Traefik.

**Ne code pas de système de comptes.** Si tu dois cloisonner des données par
utilisateur, `X-Forwarded-User` est la **seule** source d'identité admissible —
et jamais un identifiant fourni par le client (paramètre d'URL, corps de
requête, cookie applicatif). En palier `google`, ce cloisonnement n'est pas
optionnel : n'importe qui peut se connecter, donc chaque utilisateur ne doit
voir que ses propres données.

Si tu hésites entre les deux paliers, prends `private` : c'est réversible en
une ligne, l'inverse expose des données.

## Règles impératives

- **`Dockerfile` à la racine**, construction multi-étapes, image finale
  **< 200 Mo**. Le disque du serveur est à 92 % — une image lourde est refusée.
- **L'app tourne en utilisateur non root** (`USER` dans le `Dockerfile`).
- **Ne publie aucun port.** Pas de section `ports:`. Traefik joint le conteneur
  par le réseau Docker `apps_net`.
- **Le fichier Compose s'appelle `compose.yaml`**, à la racine. C'est le nom
  canonique de la Compose Spec, et le seul que `dockhand` ouvre côté serveur :
  un `docker-compose.yml` lui renvoie « Compose file not found » et le
  déploiement s'arrête là.
- **Le routage vit dans les labels du `compose.yaml`**, générés par
  `init.sh`. N'y touche pas : le middleware d'authentification et
  `priority=100` y sont posés — cette priorité est ce qui empêche un serveur
  catch-all de capter l'URL et de servir un 404 silencieux.
- **Aucun `LABEL traefik.*` dans le `Dockerfile`**, sans exception. Docker
  fusionne les labels de l'image dans ceux du conteneur : un label de routage
  gravé dans l'image publierait un routeur **supplémentaire**, que le compose ne
  peut pas écraser puisqu'il porte un autre nom — donc **sans authentification**.
- **Aucun secret** dans le dépôt ni dans l'image. Les valeurs sensibles sont
  injectées par l'infrastructure via l'environnement ; déclare les noms attendus
  dans le `README`, jamais les valeurs.
- **Écris les logs sur la sortie standard**, pas dans un fichier.
- **L'app doit démarrer sans intervention** : pas de migration manuelle, pas de
  question interactive, pas de fichier à créer à la main.

## Ce qui ne t'appartient pas

La topologie réseau, les bases de données partagées et les secrets vivent sur le
serveur, hors de ce dépôt. Le réseau `apps_net` est déclaré `external: true` : il
existe déjà côté serveur, ce dépôt ne le crée pas.

Si tu as besoin de quelque chose que le contrat ne prévoit pas — une base de
données, un cache, un volume persistant, un port supplémentaire — **écris-le
dans le `README` et arrête-toi**. C'est une décision d'infrastructure, elle se
prend côté serveur.

## Avant de pousser

```bash
./init.sh --check
```

Le déploiement se déclenche à chaque fusion sur `main` : construction de l'image
chez GitHub, publication sur GHCR, puis récupération par le serveur. Compte deux
à trois minutes entre la fusion et la mise en ligne.

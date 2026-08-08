# Ton outillage — les plugins Claude Code

Quand lire : quand un plugin ou un serveur LSP manque, ou après un `./init.sh`
qui change un `stack` ou un `ui`.
Tenu par : --check — `settings.json` présent et sans bloc `env`, scripts
analysables, `cloud-setup.sh` aligné sur les plugins et les LSP ; hook —
`check-plugins.sh` rapporte à chaque ouverture de session

`.claude/settings.json` est un fichier ordinaire et **versionné** : tout clone
du dépôt — toi, un autre agent, une session cloud, la CI — repart avec le même
outillage. Il se retouche à la main quand une app introduit un `stack` ou un
`ui` nouveau ; `--check` avertit si un plugin attendu n'y figure pas.

| Plugin | Ce qu'il apporte |
|---|---|
| `superpowers` | Méthode de travail : brainstorming avant de coder, TDD, débogage systématique, rédaction de plans |
| `mattpocock-skills` | TDD, revue de code, modélisation du domaine, diagnostic de bogues |
| `code-review` / `code-simplifier` | Revue et simplification du code déjà écrit |
| `commit-commands` | Commit, push, ouverture de PR |
| `security-guidance` | Relit chaque modification à la recherche de vulnérabilités |
| `context7` | Documentation **à jour** des bibliothèques — consulte-le plutôt que ta mémoire |
| `github` | PR, Actions, GHCR |

**Cinq de ces plugins n'ont jamais servi, et c'est réglé : on les garde.**
Inventaire du 7 août 2026, dans l'entrée de journal
`2026-08-07-claude-marcq-handball-review-jlo3pz`. Le retirer ne rendrait
quasiment rien — un plugin de **hooks** ne coûte **rien** dans le contexte
(`security-guidance` s'exécute à l'appel d'outil, pas à la lecture), un plugin de
**commandes** ou d'**agents** une ligne, un plugin de **compétences** quelques
centaines de jetons ; ce qui pèse dans le démarrage, ce sont les définitions
d'outils des **serveurs MCP** — `github`, `playwright`, `context7` —, et les trois
servent. Les cinq ensemble valent ~2 % du démarrage, quand celui-ci varie déjà de
14 000 jetons d'une branche à l'autre. Ne refais pas l'inventaire : ce qu'il
faut savoir de chacun est ci-dessous.

| Non utilisé | Pourquoi, et ce qu'il faut en faire |
|---|---|
| `commit-commands` | Son `/commit` sauterait `pret.sh` — donc les tests, le journal et le relevé de coût — et son `/clean_gone` ne peut pas fonctionner, le harnais refusant la suppression de refs. **Ne l'emploie pas** ; la voie est `pret.sh` puis un message écrit à la main |
| `mattpocock-skills` | Mêmes déclencheurs que `superpowers`. À déclencheur égal, **la méthode nommée par le contrat gagne** |
| `code-simplifier` | C'est un agent, et aucun agent n'a jamais été appelé. Son silence est celui des agents en général, pas le sien |
| `code-review` | La revue passe par `--check`, les quatre harnais de test et la relecture humaine avant fusion |
| `security-guidance` | **Utilisé, mais silencieux** : il avertit à l'édition, sans laisser de trace. Ses signalements sont parfois de faux positifs — un test qui *interdit* `innerHTML` en déclenche un |

S'y ajoutent, selon les `apps/*/app.yml` : **un serveur LSP par langage présent dans
la fabrique** — les erreurs du compilateur après chaque édition, pour zéro contexte —
et, dès qu'**une seule** app porte `ui: true`, `frontend-design`, `playwright` et
`impeccable`.

**Déclarer un plugin ne l'installe pas**, et aucun script du dépôt ne peut s'en
charger : sur `claude.ai/code`, Claude Code **charge les plugins avant de les
installer**, donc un hook `SessionStart` les déposerait sur le disque sans qu'ils
servent — et `/reload-plugins` n'existe pas sur le web. Le seul point d'accroche assez
tôt est le **setup script de l'environnement**, qui tourne avant le lancement de
Claude Code. `.claude/cloud-setup.sh`, édité à la main, en porte le contenu : les plugins, plus **le binaire de chaque
serveur LSP** — l'image cloud fournit les compilateurs, jamais les serveurs de
langage, et sans ce binaire le plugin est installé mais inerte. Les installations
partent en parallèle : le script doit tenir sous cinq minutes.

```bash
cat .claude/cloud-setup.sh     # à coller dans le champ "Setup script"
```

Sur `claude.ai/code` : icône nuage au-dessus de la zone de saisie → engrenage de
l'environnement → champ **Setup script**. Le résultat est figé dans un instantané du
disque : le script ne rejoue qu'après modification de l'environnement ou expiration du
cache (~7 jours). Si le serveur de langage ne s'installe pas en une commande à travers
l'allowlist réseau, le script généré pose un `TODO` explicite plutôt qu'une commande
inventée : complète-le avant de le coller. Cette configuration vit **hors du dépôt**,
dans ton compte, et rien ne la met à jour automatiquement : après avoir édité
`.claude/cloud-setup.sh` pour un `stack` ou un `ui` nouveau, recolle le fichier
— `--check` signale l'écart entre ce qui est déclaré et ce que les apps exigent.

Puisqu'aucun hook ne peut installer à temps, `.claude/check-plugins.sh` se contente de
rapporter : il s'exécute à chaque ouverture de session et écrit dans ton contexte
`Outillage : 12/12 plugins installes, 1/1 serveurs LSP presents.` — une ligne quand
tout va bien, sinon la liste des manquants et le geste qui répare. Il vérifie deux
choses qui peuvent diverger : le plugin dans le cache local, et le **binaire** de
chaque LSP sur la machine. Un rapport qui annonce des manquants signifie que le setup
script est absent, périmé, ou n'a pas encore rejoué.

`.claude/settings.local.json` est ignoré par git : c'est là que vont tes préférences
personnelles. Et **jamais de bloc `env` dans `.claude/settings.json`** — il est public
par construction, y poser un jeton le publie ; `--check` refuse un settings qui en
contient un.

## Les compétences du dépôt, distinctes de celles des plugins

Le tableau ci-dessus décrit des compétences **apportées par des plugins**, donc
installées hors du dépôt. Une compétence propre à la fabrique s'écrit dans le
dépôt, versionnée comme les agents et les commandes de mode :

```
.claude/skills/<nom>/SKILL.md    # en-tête YAML : name, description
```

Le `name` de l'en-tête **est** celui du répertoire, et la `description` est tout
ce que tu lis avant de décider de l'invoquer : c'est elle qui doit porter les
mots que l'utilisateur emploiera, pas un résumé du contenu. Écris-la sans
accents dans le `name`, pour la même raison que `pas-a-pas`.

Aucun garde-fou ne les tient : `--check` vérifie la présence des trois agents et
des deux commandes parce que le contrat les promet, alors qu'une compétence
absente ne casse rien. À l'inverse d'une commande, **elle n'est pas invocable
dans la foulée de son écriture** : le registre se rafraîchit avec du retard, sans
qu'on sache combien — voir `memory/travail.md`, section sur les quatre registres.

| Compétence | Ce qu'elle fait |
|---|---|
| `compact-claude-md` | Trie et compresse un `CLAUDE.md` par suppression de lignes sans effet, jamais par abréviation ; tri en lecture seule, puis validation humaine, puis application |

## Une commande `go` isolée, tant que `go.work` n'a pas suivi

Sur une machine de développement où `go env GOWORK` pointe en dur sur le
`go.work` du dépôt, **toute** commande `go` — même lancée dans un répertoire
sans rapport — opère sur cet espace de travail. Un module qui exige un `go`
plus récent que ce que `go.work` déclare fait télécharger un toolchain plus
récent (`GOTOOLCHAIN=auto`) puis **réécrit `go.work`** pour faire disparaître
l'incohérence — silencieusement, sur un artefact généré marqué « NE PAS
EDITER ». `git status`/`git diff` le montrent après coup ; rien avant ne le
signale.

Avant que `./init.sh` n'ait régénéré `go.work` pour l'app en cours — par
exemple juste après avoir écrit son premier `go.mod` — isole toute commande
`go` avec `GOWORK=off` :

```bash
GOWORK=off go mod tidy
GOWORK=off go build ./...
```

Une fois `./init.sh` relancé (`go.work` à jour, l'app ajoutée aux `use`), les
commandes `go` ordinaires — sans `GOWORK=off` — redeviennent sûres.

## `docker build` en local : la sortie HTTPS a besoin d'une autorité de certification

Dans un environnement de développement dont les sorties HTTPS passent par un
proxy re-signant le trafic (voir `/root/.ccr/README.md` sur `claude.ai/code`),
un conteneur Docker **n'hérite pas** de cette configuration : `docker build
--network host` ne suffit pas, et `RUN go mod download` (ou tout autre accès
réseau dans l'étage de build) échoue avec `x509: certificate signed by unknown
authority`. Ce n'est pas un défaut du `Dockerfile` — la CI, elle, a un accès
réseau direct et construit sans ce problème.

Pour vérifier une image en local dans un tel environnement, construis depuis
un `Dockerfile` **hors dépôt**, qui copie l'autorité de certification locale
dans l'étage de build avant tout accès réseau — jamais dans le `Dockerfile`
committé, dont aucune ligne ne doit dépendre d'un environnement particulier :

```dockerfile
COPY --from=ca ca-bundle.crt /usr/local/share/ca-certificates/ccr.crt
RUN apk add --no-cache ca-certificates && update-ca-certificates
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
```

```bash
docker build --network host -f /chemin/hors-depot/Dockerfile.verify \
  --build-context ca=/root/.ccr --build-arg VERSION=… apps/<app>
```


# Ton outillage — les plugins Claude Code

Quand lire : quand un plugin ou un serveur LSP manque, ou après un `./init.sh`
qui change un `stack` ou un `ui`.
Tenu par : --check — `settings.json` présent et sans bloc `env`, scripts
analysables, `cloud-setup.sh` aligné sur les plugins et les LSP ; hook —
`check-plugins.sh` rapporte à chaque ouverture de session

`init.sh` écrit un `.claude/settings.json` **versionné** : tout clone du dépôt — toi,
un autre agent, une session cloud, la CI — repart avec le même outillage.

| Plugin | Ce qu'il apporte |
|---|---|
| `superpowers` | Méthode de travail : brainstorming avant de coder, TDD, débogage systématique, rédaction de plans |
| `mattpocock-skills` | TDD, revue de code, modélisation du domaine, diagnostic de bogues |
| `code-review` / `code-simplifier` | Revue et simplification du code déjà écrit |
| `commit-commands` | Commit, push, ouverture de PR |
| `security-guidance` | Relit chaque modification à la recherche de vulnérabilités |
| `context7` | Documentation **à jour** des bibliothèques — consulte-le plutôt que ta mémoire |
| `github` | PR, Actions, GHCR |

S'y ajoutent, selon les `apps/*/app.yml` : **un serveur LSP par langage présent dans
la fabrique** — les erreurs du compilateur après chaque édition, pour zéro contexte —
et, dès qu'**une seule** app porte `ui: true`, `frontend-design`, `playwright` et
`impeccable`.

**Déclarer un plugin ne l'installe pas**, et aucun script du dépôt ne peut s'en
charger : sur `claude.ai/code`, Claude Code **charge les plugins avant de les
installer**, donc un hook `SessionStart` les déposerait sur le disque sans qu'ils
servent — et `/reload-plugins` n'existe pas sur le web. Le seul point d'accroche assez
tôt est le **setup script de l'environnement**, qui tourne avant le lancement de
Claude Code. `init.sh` en génère le contenu : les plugins, plus **le binaire de chaque
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
dans ton compte, et `init.sh` ne peut pas la mettre à jour : après un `./init.sh` qui
change un `stack` ou un `ui`, recolle le fichier — `--check` signale l'écart.

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


# 2026-08-07 — claude/dockerhand-selective-deploy-4h750i

Branche : `claude/dockerhand-selective-deploy-4h750i`
Périmètre : `fabrique`
Mode : `chaud`

## Anomalies

### 1. Livrer une application redémarrait les neuf conteneurs de la stack

**Symptome** — question de l'utilisateur : « chaque déploiement relance
l'ensemble des dockers alors qu'un seul est livré ». Vérifié avant de toucher
quoi que ce soit, avec `./scripts/prod.sh` : après une livraison qui ne touchait
que `marcq-handball`, les neuf services de la stack affichaient tous `Up 2
minutes`. Le symptôme n'était pas une impression, c'était mesurable en une
commande — et rien dans le dépôt ne l'avait jamais mesuré.

**Cause** — un enchaînement de trois décisions justes prises séparément. Le tag
d'image était `:main` pour toutes les apps, donc mutable ; `compose.yaml` ne
changeait donc pas d'une livraison de code à l'autre ; `dockhand`, qui ne
redéploie que sur un diff du dépôt, sautait donc tout déploiement ; le réglage
`Force redeployment` était donc obligatoire — et forcer un déploiement, c'est
recréer **tous** les conteneurs. Chaque maillon était documenté, le `README`
allait jusqu'à intituler une section « le piège : `Force redeployment` est
obligatoire ». Ce qui manquait, c'est que personne n'avait écrit ce que le
réglage coûtait : il était présenté comme une contrainte de l'outil, pas comme
un choix ayant un prix. Un contournement documenté cesse d'être vu comme un
défaut.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — le tag d'image de chaque app est désormais le commit
qui l'a construite, écrit par la CI dans `versions.yml` et reporté dans le
compose : la livraison d'une app ne fait bouger qu'une ligne `image:`, et
`docker compose up` ne recrée que ce service. `--check` vérifie chaque ligne du
fichier — clé qui ne désigne aucune app, tag qui n'est pas un commit — et le
contrôle service par service compare le tag du compose à celui du fichier.

### 2. Le contournement était devenu la consigne écrite

**Symptome** — le `README` demandait d'activer `Force redeployment` et le
workflow, en cas de `skipped`, imprimait un message d'erreur qui disait de
l'activer. Le correctif rendait ces deux textes non seulement inutiles mais
nuisibles : suivi à la lettre, le message aurait ramené le défaut qu'on venait
de corriger, et personne n'aurait vu la contradiction — le réglage vit sur le
serveur, pas dans le dépôt.

**Cause** — un message d'erreur est écrit pour la panne du jour et jamais relu
ensuite. Celui-ci nommait un réglage extérieur au dépôt : aucun contrôle du
dépôt ne peut donc dire qu'il a vieilli. C'est la même mécanique que le
commentaire « les deux jobs durent autant l'un que l'autre » de l'entrée
précédente, resté juste dans le fichier et faux dans les faits.

**Detecte par** — `auteur`

**Action** — `contrat` — les deux textes disent maintenant l'inverse, et disent
*pourquoi* : `Force redeployment` doit rester décoché, un `skipped` ne peut plus
vouloir dire « rien à faire » mais « `dockhand` n'a pas vu la poussée ». Le
réglage côté serveur reste le seul point de cette chaîne qu'aucun contrôle du
dépôt n'atteint : il est signalé comme tel dans le `README`.

### 3. Un cas où la CI se serait mise au rouge sans rien de cassé

**Symptome** — en écrivant le workflow, un cas est apparu qu'aucun test
n'aurait attrapé : le premier des deux commits d'un ajout d'application. L'app
naît `enabled: false`, la CI construit et publie son image, mais elle n'a aucun
bloc dans le compose. La version s'épingle, `compose.yaml` ne bouge pas,
`dockhand` répond `skipped` — et le workflow, qui traite `skipped` comme un
échec, aurait mis la CI au rouge pour une livraison parfaitement normale.

**Cause** — avoir raisonné sur le cas courant (« on livre une app active »)
alors que le contrat décrit noir sur blanc une séquence en deux commits dont le
premier ne déploie rien. Le garde-fou hérité — `skipped` est un échec — était
juste tant que toute livraison devait déployer ; il cessait de l'être dès qu'une
livraison pouvait légitimement n'avoir rien à déployer.

**Detecte par** — `auteur`

**Action** — `garde-fou` — le workflow distingue désormais les deux : si aucun
service du compose ne change, il enregistre la version et n'appelle pas le
webhook, en le disant. Le `skipped` reste un échec dans le seul cas où il est
anormal.

### 4. Le plafond du contrat, encore, et pour deux lignes

**Symptome** — `CLAUDE.md` était à 250 lignes sur 250. Ajouter `versions.yml` à
l'arborescence et une phrase au paragraphe du déploiement l'a porté à 254. Il a
fallu recompacter trois paragraphes voisins — sans rien retirer — pour revenir
exactement à 250.

**Cause** — c'est la reprise, à l'identique, de l'anomalie 4 de l'entrée
`claude-dockhand-production-debug` : le plafond empêche bien d'élargir le
contrat, mais il ne dit pas où déplacer ce qui déborde, et `memory/` impose un
`Tenu par` qu'un simple ajout de vocabulaire ne justifie pas à lui seul. Le
sujet a donc atterri dans le `README`, comme la fois précédente. Deux branches
de suite ont payé le même impôt de recompactage ; la troisième le paiera aussi.

**Detecte par** — `auteur`

**Action** — `arbitrage` — la question reste celle posée il y a quatre jours et
elle est maintenant instruite par deux occurrences : soit le plafond monte, soit
`memory/` accepte un sujet sans garde-fou. Aucun agent ne devrait trancher seul
ce qui décide de ce que tous les suivants liront en permanence.

### 5. Ce que le dépôt ne peut pas prouver

**Symptome** — la sélectivité repose sur une propriété de `dockhand` que le
dépôt ne contrôle pas : qu'un déploiement non forcé soit bien un `docker compose
up -d` (qui ne recrée que les services modifiés) et non un `down` suivi d'un
`up`. Aucun contrôle du dépôt ne peut en juger.

**Cause** — la frontière du périmètre passe là, et c'est normal. Mais une
amélioration dont on ne peut pas prouver l'effet depuis le dépôt n'est pas
livrée tant qu'on ne l'a pas regardée en production.

**Detecte par** — `auteur`

**Action** — `comportement` — la preuve est la même commande que celle qui a
mesuré le défaut : après la fusion, `./scripts/prod.sh` doit montrer un seul
conteneur récemment démarré et les huit autres à leur ancienneté d'avant. Tant
que cette lecture n'est pas faite, la branche n'est pas finie.

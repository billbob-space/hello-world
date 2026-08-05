# Isolation du contexte des agents — plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à chaque application une notice générée que l'outillage ne charge qu'en travaillant sur elle, et un agent `artisan` qui écrit le code d'une seule app sans jamais déborder sur la stack partagée.

**Architecture:** `apps/<nom>/CLAUDE.md` devient le troisième artefact toujours réécrit, après `compose.yaml` et `go.work`. Il rejoint la liste `DERIVES`, ce qui lui donne d'un coup les trois comportements existants : écriture par `./init.sh`, aperçu par `--dry-run`, refus de `--check` s'il a dérivé. L'agent `artisan` est un fichier de plus dans `.claude/agents/`, vérifié par le contrôle d'outillage.

**Tech Stack:** Bash 5 (`init.sh`, 2652 lignes), suite de tests maison `test-init.sh` à bac à sable, contrat en Markdown.

**Spec :** `docs/superpowers/specs/2026-08-05-isolation-contexte-agents-design.md`

## Global Constraints

- **Français sans accents dans le code et les messages de `init.sh`** — c'est la convention du fichier ; les documents Markdown gardent les accents.
- **Aucune dépendance nouvelle** — ni `jq`, ni `python`, ni `yq`. `init.sh` lit ses manifestes avec `grep`/`sed`/`awk` et doit continuer.
- **La notice est committée**, jamais ignorée par `.gitignore` : un clone frais doit l'avoir, comme `compose.yaml`.
- **La notice ne contient aucun lien Markdown `](...)`** — elle nomme les fichiers entre apostrophes inverses. `--check` refuse un lien mort, et `apps/ramure-v2/PRODUCT.md` comme `apps/marcq-handball/README.md` n'existent pas.
- **La notice ne porte jamais deux titres de niveau 2 identiques** — `--check` refuse les doublons de section (`init.sh:2192`).
- **`CLAUDE.md` fait déjà 263 lignes pour un plafond de 250** : les ajouts au contrat racine se comptent en lignes, le détail va dans `memory/travail.md`.
- **Ordre de tri figé par `LC_ALL=C`** partout où des répertoires sont énumérés : un ordre dépendant de la locale produirait un diff d'artefact d'une machine à l'autre.
- **Un commit par tâche**, précédé de `./scripts/pret.sh`.

## File Structure

| Fichier | Responsabilité | Tâches |
|---|---|---|
| `init.sh` | `emit_notice()` (générateur), `liste_derives()` (énumération), branchement dans `emit()` et les trois boucles, contrôle d'outillage | 1, 2, 4 |
| `test-init.sh` | helper `genere_dans`, quatre cas de test | 1, 2, 4 |
| `apps/*/CLAUDE.md` | artefact généré, 7 fichiers | 1, 2 |
| `.claude/agents/artisan.md` | définition de l'agent | 4 |
| `CLAUDE.md` | 4 lignes : la notice dans l'arborescence, « trois artefacts » | 5 |
| `memory/travail.md` | l'`artisan`, l'invariant du lancement en fond | 5 |

---

### Task 1: Le générateur de notice, pour une app avec manifeste

**Files:**
- Modify: `init.sh` — ajouter `emit_notice()` avant `emit()` (`init.sh:1341`) ; étendre `emit()` ; remplacer `DERIVES=(compose.yaml go.work)` (`init.sh:1348`) par `liste_derives()` ; adapter les trois boucles (`init.sh:1999`, `init.sh:2593`, `init.sh:2614`)
- Test: `test-init.sh`

**Interfaces:**
- Produces: `emit_notice <app>` — écrit la notice sur la sortie standard ; suppose `load_app <app>` déjà appelé pour une app à manifeste. `liste_derives` — imprime un chemin d'artefact par ligne, dans l'ordre `compose.yaml`, `go.work`, puis `apps/<nom>/CLAUDE.md` triés par `LC_ALL=C`.
- Consumes: les globales posées par `load_app` — `APP`, `A_PORT`, `A_MEMORY`, `A_EXPOSURE`, `A_STACK`, `A_ENABLED`, `A_HEALTH_PATH`, `A_HEALTH_CMD`, `A_ENV`, `A_NEEDS`, `A_VOL_CHEMINS` — et `DOMAIN` de `fabrique.yml`. **Avant d'écrire, lis `load_app` (`init.sh:543`) et relève les noms exacts de ces variables** : ce plan les cite de mémoire et une seule faute de nom produit une notice vide sans erreur.

- [ ] **Step 1: Ajouter le helper `genere_dans` à `test-init.sh`**

Le helper `genere` existant ne sait regarder que `compose.yaml` (`test-init.sh:95`). Ajoute juste après lui :

```bash
# genere_dans <nom> <chemin> <ligne attendue> — comme genere, mais regarde un
# artefact quelconque. La notice d'application n'est pas dans compose.yaml.
genere_dans() {  # genere_dans <nom> <chemin> <ligne attendue>
  local nom="$1" chemin="$2" attendu="$3" d code=0
  case "$nom" in *"$MOTIF"*) ;; *) return 0 ;; esac
  d=$(bac)
  bash -c "cd '$d' && $(cat)" || { echec "$nom" "la mutation elle-meme a echoue"; return 0; }
  ( cd "$d" && ./init.sh >/dev/null 2>&1 ) || code=$?
  if [ "$code" != 0 ]; then
    echec "$nom" "la generation a echoue (sortie $code) sur un manifeste pourtant valide"
  elif [ ! -f "$d/$chemin" ]; then
    echec "$nom" "$chemin n'a pas ete ecrit"
  elif ! grep -qF -- "$attendu" "$d/$chemin"; then
    echec "$nom" "$chemin ne porte pas « $attendu »"
    sed 's/^/      /' "$d/$chemin" | head -5
  else
    reussi "$nom"
  fi
}
```

- [ ] **Step 2: Écrire les trois cas de test qui échouent**

À la fin de `test-init.sh`, avant le décompte final :

```bash
genere_dans "notice : le palier d'exposition est traduit en clair" \
            apps/cadran/CLAUDE.md "uniquement les comptes de la liste blanche" <<'EOF'
true
EOF

genere_dans "notice : l'URL est composee du nom et du domaine" \
            apps/cadran/CLAUDE.md "https://cadran.billbob.ovh" <<'EOF'
true
EOF

refuse "notice absente" "apps/cadran/CLAUDE.md absent" <<'EOF'
rm -f apps/cadran/CLAUDE.md && git add -A && git -c user.email=t@l -c user.name=t commit -qm x
EOF

refuse "notice desynchronisee" "apps/cadran/CLAUDE.md desynchronise" <<'EOF'
echo 'port: 1' >> apps/cadran/CLAUDE.md && git add -A && git -c user.email=t@l -c user.name=t commit -qm x
EOF
```

La mutation `true` des deux premiers cas est délibérée : on ne casse rien, on regarde ce que le générateur écrit sur un dépôt sain. Vérifie le domaine réel avec `grep domaine fabrique.yml` avant de figer `billbob.ovh`.

- [ ] **Step 3: Lancer les tests pour les voir échouer**

Run: `./test-init.sh notice`
Expected: les quatre cas ÉCHOUENT — les deux premiers sur « n'a pas ete ecrit », les deux autres sur « --check a repondu OUI ».

- [ ] **Step 4: Écrire `emit_notice()`**

À insérer juste avant `emit()` (`init.sh:1341`). La forme exacte du texte t'appartient ; ce qui suit fixe le contenu, l'ordre et les pièges.

```bash
emit_notice() {  # emit_notice <app> — la notice de contexte, apps/<app>/CLAUDE.md
  local a="$1" d="apps/$1"
  cat <<EOF
# $a — notice de contexte

<!-- GENERE par ./init.sh depuis apps/$a/app.yml et fabrique.yml.
     Ne l'edite pas : --check refuse une notice qui a derive. -->

## Ton perimetre

Tu travailles dans \`$d/\` et nulle part ailleurs. Si ton changement demande de
toucher \`compose.yaml\`, \`fabrique.yml\`, \`init.sh\`, \`scripts/\`, \`.github/\`
ou une autre application, arrete-toi et dis ce qu'il faudrait changer : une
seule stack se deploie d'un bloc, et une erreur ici casse les autres apps.
EOF
  # ... identite, execution, etat, tests, documents, regles
}
```

Les sections, dans cet ordre, **titres de niveau 2 tous distincts** :

1. `## Ton perimetre` — le bloc ci-dessus.
2. `## Ce que tu ecris` — nom, `https://<app>.$DOMAIN`, palier traduit en clair, et l'état de déploiement. La traduction du palier est le cœur du contrôle du Step 2 :
   - `private` → `uniquement les comptes de la liste blanche du serveur` ;
   - `google` → `n'importe quel compte Google authentifie` ;
   - `public` → `tout le monde, sans authentification` ;
   - Ajoute une phrase pour `enabled: false` : `pas encore deployee : son bloc n'entre pas dans compose.yaml`.
3. `## Comment elle tourne` — `stack`, `port`, `memory`, `health_path`, `health_cmd`. Omets une ligne dont la valeur est vide ou `none`.
4. `## Ce qu'elle garde` — **section entière omise** si l'app n'a ni volume, ni service annexe, ni `needs`, ni `env`. Les volumes sous leur nom réel préfixé (`ardoise-donnees`, pas `donnees`) ; les services annexes sous leur nom de service réel (`ardoise-base`) ; les `needs` désignés comme services partagés de la fabrique ; les `env` comme des **noms** de secrets dont la valeur est injectée par l'infrastructure.
5. `## Comment la tester` — la commande `./apps/$a/test.sh`, uniquement si ce fichier existe.
6. `## Ses documents` — une ligne par fichier **existant** parmi `PRODUCT.md` (fiche produit puis exigences), `README.md` (mode d'emploi), `prp/` (documents d'implémentation). Entre apostrophes inverses, **jamais en lien Markdown**.
7. `## Les regles qui s'appliquent a son image` — une ligne : image multi-étapes sous 200 Mo, utilisateur non root, aucun port publié, aucun secret, aucun `LABEL traefik.*`, logs sur la sortie standard ; puis « le detail : `memory/regles-imperatives.md` ».

Deux pièges de heredoc : le `EOF` non quoté laisse `$a` et `$DOMAIN` s'interpoler — c'est voulu —, mais toute apostrophe inverse littérale doit être échappée `\``, et tout `$` littéral doublé `\$`. Une notice générée qui exécuterait une substitution de commande serait une faille, pas une coquille.

- [ ] **Step 5: Brancher `emit()` et remplacer `DERIVES`**

Étends `emit()` :

```bash
emit() {  # emit <chemin> — ecrit sur stdout l'artefact attendu pour ce chemin
  case "$1" in
    compose.yaml)     emit_compose ;;
    go.work)          emit_gowork ;;
    apps/*/CLAUDE.md) local a; a=$(basename "$(dirname "$1")"); load_app "$a"; emit_notice "$a" ;;
  esac
}
```

Remplace `DERIVES=(compose.yaml go.work)` par une fonction, parce que la liste dépend désormais des applications, connues seulement après `discover_apps` :

```bash
liste_derives() {  # un chemin d'artefact par ligne, ordre fige
  printf '%s\n' compose.yaml go.work
  local a
  for a in "${APPS[@]-}"; do printf 'apps/%s/CLAUDE.md\n' "$a"; done
}
```

`APPS` est déjà trié par `LC_ALL=C` dans `discover_apps` (`init.sh:521`) : ne retrie pas.

Puis remplace les trois boucles `for f in "${DERIVES[@]}"` par :

```bash
while IFS= read -r f; do
  ...
done < <(liste_derives)
```

**Attention au corps de ces boucles** : `init.sh:2614` et `init.sh:1999` contiennent un `continue` dans le cas `go.work`, qui reste valide. Mais `init.sh:2614` écrit dans `$(dirname "$f")` — vérifie que `mkdir -p apps/<nom>` ne gêne pas.

- [ ] **Step 6: Régénérer et lancer les tests**

Run: `./init.sh && ./test-init.sh notice`
Expected: `./init.sh` écrit sept notices ; les quatre cas PASSENT.

- [ ] **Step 7: Lire une notice à l'œil**

Run: `cat apps/ardoise/CLAUDE.md`
Expected: elle nomme `ardoise-donnees` et `ardoise-base`, dit `POSTGRES_PASSWORD` comme un nom, désigne `redis` comme service partagé, et traduit `private` en clair. Aucune valeur de secret, aucun `$` non résolu, aucun lien Markdown.

- [ ] **Step 8: Vérifier que rien d'autre n'a bougé**

Run: `./init.sh --check && ./test-init.sh`
Expected: contrat vert, **toute** la suite au vert — pas seulement les cas `notice`.

- [ ] **Step 9: Commit**

```bash
./scripts/pret.sh
git add init.sh test-init.sh apps/*/CLAUDE.md
git commit -m "fabrique : la notice de contexte, troisieme artefact genere"
git push -u origin claude/agent-context-isolation-qu0kaw
```

---

### Task 2: La notice dégradée des applications sans manifeste

`apps/marcq-handball/` et `apps/ramure-v2/` n'ont pas d'`app.yml` : `discover_apps` les écarte avec un avertissement (`init.sh:527`), donc la Task 1 ne leur écrit rien. Ce sont pourtant les deux répertoires où le plus de code reste à écrire.

**Files:**
- Modify: `init.sh` — ajouter `repertoires_apps()`, étendre `liste_derives()` et `emit_notice()`
- Test: `test-init.sh`

**Interfaces:**
- Produces: `repertoires_apps` — imprime le nom de **chaque** répertoire de `apps/`, avec ou sans manifeste, trié `LC_ALL=C`.
- Consumes: `emit_notice <app>` de la Task 1, qui doit désormais accepter une app sans manifeste.

- [ ] **Step 1: Écrire le test qui échoue**

```bash
genere_dans "notice degradee : une app sans app.yml en recoit une" \
            apps/ramure-v2/CLAUDE.md "le manifeste reste a ecrire" <<'EOF'
true
EOF
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `./test-init.sh degradee`
Expected: ÉCHEC sur « apps/ramure-v2/CLAUDE.md n'a pas ete ecrit ».

- [ ] **Step 3: Ajouter `repertoires_apps` et l'utiliser**

```bash
repertoires_apps() {  # tout repertoire de apps/, manifeste ou non
  local d
  while IFS= read -r d; do
    [ -n "$d" ] && basename "$d"
  done < <(LC_ALL=C find apps -mindepth 1 -maxdepth 1 -type d 2>/dev/null | LC_ALL=C sort)
}
```

Dans `liste_derives`, remplace la boucle sur `APPS` par une boucle sur `repertoires_apps`. **`APPS` reste inchangé** : `compose.yaml` ne doit toujours contenir que les apps à manifeste. Une seule ligne change ; ne touche pas à `discover_apps`.

- [ ] **Step 4: Rendre `emit_notice` tolérant**

Dans `emit()`, n'appelle `load_app` que si `apps/<a>/app.yml` existe. Dans `emit_notice`, quand le manifeste manque, écris la version dégradée : le bloc `## Ton perimetre` **à l'identique**, `## Ses documents` restreint aux fichiers présents, `## Les regles qui s'appliquent a son image` à l'identique, et à la place des sections 2 à 5 :

```
## Ce que tu ecris

Cette application n'a pas encore de manifeste : le manifeste reste a ecrire.
Son nom — donc son sous-domaine, son conteneur et sa route — sera `<app>`.
Ecris `apps/<app>/app.yml` avec `./init.sh --add <app>`, puis relance `./init.sh`.
```

Le motif `le manifeste reste a ecrire` est ce que teste le Step 1 : garde-le mot pour mot.

- [ ] **Step 5: Vérifier**

Run: `./init.sh && ./test-init.sh && ./init.sh --check`
Expected: neuf artefacts écrits (dont sept notices), suite au vert, contrat vert. `apps/ramure-v2/CLAUDE.md` et `apps/marcq-handball/CLAUDE.md` existent.

- [ ] **Step 6: Vérifier que `--add` l'écrit aussi**

Run: `./init.sh --add essai-jetable --stack go --exposure private && ls apps/essai-jetable/`
Expected: `CLAUDE.md` figure parmi les fichiers échafaudés — `--add` régénère les dérivés, il n'y a rien à ajouter à `scaffold_app`. Si le fichier manque, c'est que `--add` ne passe pas par les boucles de `liste_derives` : corrige-le là, pas dans `scaffold_app`.

Puis nettoie : `rm -rf apps/essai-jetable && ./init.sh`

- [ ] **Step 7: Commit**

```bash
./scripts/pret.sh
git add init.sh test-init.sh apps/marcq-handball/CLAUDE.md apps/ramure-v2/CLAUDE.md
git commit -m "fabrique : une notice degradee pour les apps sans manifeste"
git push -u origin claude/agent-context-isolation-qu0kaw
```

---

### Task 3: L'agent `artisan`

**Files:**
- Create: `.claude/agents/artisan.md`
- Modify: `init.sh:2343` — la liste des fichiers d'outillage exigés
- Test: `test-init.sh`

**Interfaces:**
- Produces: un agent invocable par `Agent(subagent_type: "artisan")` **à la session suivante** — le registre des agents est lu au démarrage.

- [ ] **Step 1: Écrire le test qui échoue**

```bash
refuse "l'agent artisan manquant" ".claude/agents/artisan.md absent" <<'EOF'
git rm -q .claude/agents/artisan.md && git -c user.email=t@l -c user.name=t commit -qm x
EOF
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `./test-init.sh artisan`
Expected: ÉCHEC — « la mutation elle-meme a echoue », le fichier n'existe pas encore.

- [ ] **Step 3: Écrire `.claude/agents/artisan.md`**

Suis exactement la forme de `.claude/agents/greffier.md` : en-tête YAML `name`, `description`, `tools`, prose **en français sans accents**.

```markdown
---
name: artisan
description: Ecrit le code d'UNE application de la fabrique et lance ses tests. A lancer quand une app doit etre construite ou corrigee. N'enregistre rien dans git et ne sort jamais du repertoire de son app. Ne se lance JAMAIS en tache de fond.
tools: Read, Edit, Write, Bash, Grep, Glob
---
```

Le corps porte, dans cet ordre :

1. **Ton premier geste** — lire `apps/<nom>/CLAUDE.md`, la notice de l'app, avant tout autre fichier. Elle donne le port, l'URL, le palier, les volumes, les secrets et les documents, sans ouvrir un seul fichier partagé.
2. **Ton perimetre** — `apps/<nom>/` et rien d'autre. La liste de ce qui est dehors : `compose.yaml`, `fabrique.yml`, `init.sh`, `scripts/`, `lib/`, `.github/`, `.claude/`, les autres répertoires de `apps/`. **Si le travail l'exige, tu t'arretes et tu rapportes** ce qu'il faudrait changer et pourquoi — la stack se déploie d'un bloc, une erreur casse toutes les apps.
3. **Ce que tu ecris** — le code, le `Dockerfile`, `test.sh`. Rappelle les règles impératives et renvoie à `memory/regles-imperatives.md`.
4. **Comment tu verifies** — `./apps/<nom>/test.sh`, et `./init.sh --check` en lecture seule pour confirmer que rien n'a dérivé. Si `--check` refuse à cause d'un fichier hors périmètre, rapporte, ne corrige pas.
5. **Ce que tu ne fais jamais** — ouvrir une branche, `git add`, `commit`, `push`, `--force`, `--amend`, `rebase`, une pull request : c'est le rôle du `greffier`. Modifier un fichier hors de `apps/<nom>/`. Remplir le journal des anomalies. Te lancer en tâche de fond — tu écris dans le dépôt pendant que ton appelant y travaille.
   Une exception explicite : tu peux **lire** l'état de git (`git status`, `git diff`) pour savoir ce que tu as touché.
6. **Ce que tu rends** — un rapport court et fixe, quatre rubriques : les fichiers touchés ; le résultat des tests (la commande et son verdict, pas son déroulé) ; ce que tu n'as pas pu faire et pourquoi ; les anomalies rencontrées — ce qui a surpris, cassé ou s'est révélé faux, y compris tes propres erreurs de raisonnement. Cette dernière rubrique est ce que ton appelant recopiera dans le journal de la branche : sans elle, l'anomalie est perdue.

- [ ] **Step 4: Déclarer l'agent dans le contrôle d'outillage**

`init.sh:2343` :

```bash
  for f in .claude/agents/analyste.md .claude/agents/greffier.md \
           .claude/agents/artisan.md \
           .github/pull_request_template.md; do
```

- [ ] **Step 5: Vérifier**

Run: `./test-init.sh artisan && ./init.sh --check`
Expected: le cas PASSE, contrat vert avec `.claude/agents/artisan.md present`.

- [ ] **Step 6: Commit**

```bash
./scripts/pret.sh
git add .claude/agents/artisan.md init.sh test-init.sh
git commit -m "fabrique : l'agent artisan, borne au repertoire d'une app"
git push -u origin claude/agent-context-isolation-qu0kaw
```

---

### Task 4: Le contrat

**Files:**
- Modify: `CLAUDE.md` — section « Arborescence », section « Démarrage », sommaire de `memory/` inchangé
- Modify: `memory/travail.md` — section des agents

`CLAUDE.md` est à 263 lignes pour un plafond de 250 : `--check` avertit déjà. **N'ajoute pas plus de quatre lignes** ; tout le reste va dans `memory/travail.md`.

- [ ] **Step 1: `CLAUDE.md`, l'arborescence**

Dans le bloc `apps/<nom>/`, ajoute `CLAUDE.md` à la liste des fichiers écrits par `--add`, en précisant qu'il est **généré** et chargé seulement quand on touche à l'app.

- [ ] **Step 2: `CLAUDE.md`, la phrase des artefacts**

La phrase « Deux artefacts sont **toujours réécrits**, fonction directe des manifestes : `compose.yaml` et `go.work` » devient trois, avec `apps/<nom>/CLAUDE.md`.

- [ ] **Step 3: `memory/travail.md`, l'agent et l'invariant**

Dans « Les agents `analyste` et `greffier` » — **renomme le titre**, il en cite trois désormais, et `--check` refuse deux titres de niveau 2 identiques dans un même fichier :

- ajoute la ligne d'invocation `Agent(subagent_type: "artisan")` au bloc existant ;
- **reformule l'invariant.** Le texte actuel dit que tous les agents sont restreints à `Bash`, `Read` et `Grep` et que « l'absence d'outil d'édition n'est pas un détail de configuration ». Il devient : les agents **lançables en tâche de fond** — `analyste` et `greffier` — n'ont pas d'outil d'édition, et c'est ce qui garantit qu'ils ne peuvent pas modifier le dépôt pendant qu'on y travaille ; l'`artisan` écrit, donc **il ne se lance jamais en tâche de fond**. Écris-le comme une conséquence, pas comme une exception : c'est la même règle sous une forme qui couvre les trois cas.
- deux lignes sur ce que l'`artisan` ne fait pas : pas de git, pas de journal, mais un rapport d'anomalies que l'appelant recopie.

Mets à jour l'en-tête `Tenu par :` du fichier si le nouveau contenu est tenu par un contrôle supplémentaire.

- [ ] **Step 4: Vérifier**

Run: `./init.sh --check`
Expected: contrat vert. Surveille trois lignes : aucun titre de section en double, aucun lien mort, et l'avertissement sur la longueur de `CLAUDE.md` qui ne doit pas avoir empiré de plus de quatre lignes.

- [ ] **Step 5: Remplir le journal de la branche**

`journal/2026-08-05-claude-agent-context-isolation-qu0kaw.md` porte « Aucune anomalie pour l'instant ». Remplace-le par les anomalies réellement rencontrées pendant les tâches 1 à 4 — les noms de variables de `load_app` qui ne collaient pas, un heredoc qui a interpolé ce qu'il ne fallait pas, une boucle `DERIVES` oubliée. Si vraiment rien n'a surpris, écris « Aucune anomalie » et rien d'autre.

Chaque anomalie porte ses quatre champs, dont deux à vocabulaire fermé — voir le gabarit dans `memory/travail.md`.

- [ ] **Step 6: Relever le coût**

Run: `./scripts/cout.sh`
Expected: le bloc de coût est écrit dans l'entrée de journal. Non relevé avant la fusion, il est perdu avec le conteneur.

- [ ] **Step 7: Commit**

```bash
./scripts/pret.sh
git add CLAUDE.md memory/travail.md journal/
git commit -m "fabrique : le contrat dit la notice et l'artisan"
git push -u origin claude/agent-context-isolation-qu0kaw
```

---

## Vérification d'ensemble

- [ ] `./init.sh --check` — vert, sans KO.
- [ ] `./test-init.sh` — toute la suite au vert, témoin compris.
- [ ] `git status` — propre : les neuf artefacts régénérés sont committés.
- [ ] `./init.sh --dry-run` — « inchangé » pour les neuf artefacts.
- [ ] Le déploiement n'est pas concerné : aucune tâche ne modifie `compose.yaml`, `fabrique.yml` ni un `app.yml`. Si `compose.yaml` a changé, quelque chose a mal tourné dans la Task 2.

**Ce qui ne peut pas être vérifié dans la session qui écrit ce plan :** le registre des agents est lu au démarrage. L'`artisan` ne sera invocable qu'à la session suivante, et son comportement réel — s'arrête-t-il vraiment au bord de son répertoire ? — ne se constate qu'à ce moment-là. Ce n'est pas une anomalie : c'est un fait à connaître, et la première invocation est le vrai test de la Task 3.

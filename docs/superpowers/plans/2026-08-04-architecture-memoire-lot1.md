# Lot 1 — le contrat allégé et `memory/` : plan d'implémentation

> **Pour un agent exécutant :** SOUS-COMPÉTENCE REQUISE — utilise
> `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans` pour dérouler ce plan tâche par tâche. Les étapes
> sont en cases à cocher (`- [ ]`).

**But :** ramener `CLAUDE.md` de 750 à moins de 250 lignes en déplaçant huit
sujets dans `memory/`, sans qu'aucune règle ne cesse d'être tenue.

**Architecture :** une règle ne quitte le contrat que si `./init.sh --check`, la
CI ou un hook refuse déjà l'erreur qu'elle décrit. Le critère est rendu
exécutable par une ligne d'en-tête `Tenu par :` à vocabulaire fermé, dont la
valeur `rien` est refusée dans `memory/`. Trois nouveaux contrôles dans
`init.sh` — forme des en-têtes, exactitude du sommaire, plafond de lignes — plus
l'extension des deux contrôles documentaires existants à `memory/*.md`.

**Outillage :** bash 4 (`init.sh`, 3 848 lignes, aucune dépendance à `jq` ni
`python`), markdown, git. Aucun cadre de test : les garde-fous se prouvent par
test négatif — on casse l'état du dépôt, on vérifie le KO, on restaure.

**Écart assumé par rapport à la conception :** le fichier appelé
`memory/journal.md` dans la spec s'appelle ici **`memory/travail.md`**. Il reçoit
le journal *et* la fin de vie d'une branche, les deux hooks et les deux agents :
`journal.md` aurait mal nommé les trois quarts de son contenu. Même périmètre,
même compte de fichiers (huit).

## Contraintes globales

- **`init.sh` s'écrit sans accents** — commentaires comme messages. Tout le
  fichier suit cette règle ; un `ok`/`bad` accentué détonnerait. Les fichiers
  markdown, eux, sont accentués normalement.
- **Aucune dépendance nouvelle** : ni `jq`, ni `python`, ni `yq`. Un garde-fou
  qui ne démarre pas sur une machine dépouillée ne garde rien.
- **`bad()` doit rester dans le shell courant** : boucles `for`/`while` avec
  redirection, jamais un tube — un tube ouvre un sous-shell et le compteur
  `FAILED` y meurt. Le fichier porte déjà ce commentaire au contrôle de liens
  morts.
- **Le contenu est déplacé, pas réécrit.** Un déplacement doit se relire comme un
  déplacement : mêmes phrases, mêmes exemples, mêmes pièges. Les seules
  réécritures autorisées sont celles listées en Tâche 4.
- **Un commit par étape vérifiée**, et `./init.sh --pret` avant chaque commit.
- **Le journal de la branche se remplit au fil du travail**, pas à la fin :
  `journal/2026-08-04-claude-factory-memory-architecture-m0dpb5.md`.
- **`fabrique.yml` n'est pas modifié.** Le plafond de lignes se lit avec
  `fab claude_max_lignes 250`, dont le défaut suffit : toucher `fabrique.yml`
  ferait reconstruire toutes les apps au prochain passage en CI.

## Structure des fichiers

**Créés** — huit fichiers, plats, dans `memory/` :

| Fichier | Contenu, repris de `CLAUDE.md` | Lignes source |
|---|---|---|
| `memory/volumes.md` | Les volumes nommés | 296-366 |
| `memory/app-yml.md` | `apps/<nom>/app.yml` et ses quatre sections optionnelles | 72-192 |
| `memory/services.md` | Les trois sortes de services, `shared_services` | 223-295 |
| `memory/travail.md` | fin de vie d'une branche, deux garde-fous, journal des anomalies, agents | 400-534 |
| `memory/outillage.md` | plugins, LSP, `cloud-setup.sh` | 555-610 |
| `memory/exposition.md` | middlewares, `X-Forwarded-User`, contraintes du palier public | 611-656 sauf le tableau |
| `memory/regles-imperatives.md` | Dockerfile, ports, `USER`, logs, démarrage sans intervention | 657-689 |
| `memory/perimetre.md` | ce qui ne t'appartient pas, les trois refus | 690-725 |

**Modifiés :**

- `CLAUDE.md` — chapitres retirés, renvois posés, sommaire ajouté, deux chapitres
  condensés.
- `init.sh` — trois contrôles ajoutés dans la section `-- fabrique`, deux boucles
  documentaires étendues, une variable de plafond près de `IMAGE_MAX_MB`.

**Non modifiés :** `compose.yaml`, `.github/`, `.claude/`, `fabrique.yml`,
`apps/`. Si l'un d'eux change, c'est une erreur — le lot 1 ne touche pas au
déploiement.

---

### Tâche 1 : le contrôle de forme de `memory/`, prouvé par son premier fichier

**Fichiers :**
- Créer : `memory/volumes.md`
- Modifier : `CLAUDE.md` (retirer 296-366, poser un renvoi ; compléter
  l'arborescence ligne 35-52)
- Modifier : `init.sh` (contrôle de forme après le contrôle de titres en double,
  vers la ligne 3554 ; deux boucles documentaires lignes ~3521 et ~3546)

**Interfaces :**
- Produit : la variable `MEMORY_TENU='--check|CI|hook'`, lue par la Tâche 4 pour
  son message d'aide ; le format d'en-tête à deux lignes, repris par les sept
  fichiers de la Tâche 3.

- [ ] **Étape 1 : écrire le test négatif — un fichier `memory/` volontairement fautif**

Créer `memory/volumes.md` en déplaçant le chapitre « Les volumes nommés »
(`CLAUDE.md` lignes 296-366, sans la ligne de titre `## `), précédé de cet
en-tête — dont la valeur `rien` est délibérément fausse, c'est le test :

```markdown
# Les volumes nommés — ce qui survit au redéploiement

Quand lire : avant d'ajouter, de renommer ou de supprimer une entrée `volumes:`
dans un `app.yml`, dans `shared_services` ou dans un service annexe.
Tenu par : rien
```

Ne pas encore toucher à `CLAUDE.md` : cette étape ne prouve qu'une chose, que le
garde-fou n'existe pas.

- [ ] **Étape 2 : lancer le contrôle et constater qu'il ne voit rien**

```bash
./init.sh --check
```

Attendu : **vert**, « Contrat respecte ». C'est l'échec du test — un fichier de
`memory/` déclarant qu'aucun contrôle ne le tient passe sans un mot.

- [ ] **Étape 3 : écrire le contrôle de forme**

Dans `init.sh`, juste après le bloc qui refuse deux titres `##` identiques (il se
termine par `ok "aucun titre de section en double"`) et avant le commentaire
`# 5. Outillage de l'agent.` :

```bash
  # Les fichiers de memory/ portent l'explication des regles que --check tient
  # deja. « Quand lire » les rend utilisables sans etre lus en entier, et « Tenu
  # par » est le critere de sortie rendu executable : une regle que rien ne
  # rattrape n'a pas le droit de quitter le contrat, sinon l'alleger revient a la
  # perdre. C'est le seul controle du depot qui refuse une valeur *correcte* —
  # « rien » est un aveu, pas une faute de frappe.
  if [ -d memory ]; then
    fautes=0 nb=0
    for m in memory/*.md; do
      [ -f "$m" ] || continue
      nb=$((nb+1))
      grep -qE '^Quand lire *: *[^[:space:]]' "$m" \
        || { bad "$m : ligne 'Quand lire :' absente ou vide — le sommaire ne saura pas quand l'ouvrir"; fautes=$((fautes+1)); }
      if grep -qE '^Tenu par *: *`?rien`?([[:space:]]|$)' "$m"; then
        bad "$m : 'Tenu par : rien' — une regle que rien ne rattrape reste dans CLAUDE.md"
        fautes=$((fautes+1))
      elif ! grep -qE "^Tenu par *: *($MEMORY_TENU)" "$m"; then
        bad "$m : champ 'Tenu par' absent ou hors vocabulaire — $MEMORY_TENU|rien"
        fautes=$((fautes+1))
      fi
    done
    [ "$fautes" -eq 0 ] && ok "$nb fichier(s) memory/ : en-tete complet, chaque sujet tenu par un controle"
  else
    warn "aucun memory/ — le contrat porte tout"
  fi
```

Et la définition du vocabulaire, à poser près des autres vocabulaires fermés du
fichier (à côté de `JOURNAL_DETECTE`, vers la ligne 2708) :

```bash
MEMORY_TENU='--check|CI|hook'
```

- [ ] **Étape 4 : relancer et constater les trois refus**

```bash
./init.sh --check 2>&1 | grep -A1 'memory/'
```

Attendu : `KO  memory/volumes.md : 'Tenu par : rien' — une regle que rien ne rattrape reste dans CLAUDE.md`,
et un état final rouge.

Puis les deux autres cas, un par un, en restaurant entre chaque :

```bash
sed -i 's/^Tenu par : rien/Tenu par : moi-meme/' memory/volumes.md
./init.sh --check 2>&1 | grep 'memory/'      # attendu : hors vocabulaire
sed -i '/^Quand lire :/,+1d' memory/volumes.md
./init.sh --check 2>&1 | grep 'memory/'      # attendu : 'Quand lire :' absente
```

Les trois messages doivent nommer le fichier. Si l'un d'eux ne sort pas, le
contrôle est faux — pas le test : quatre anomalies du journal sont des tests
négatifs qui ont conclu à tort, ne pas ajouter la cinquième.

- [ ] **Étape 5 : rendre le fichier conforme et vider le chapitre du contrat**

Rétablir l'en-tête de `memory/volumes.md` dans sa forme juste :

```markdown
Quand lire : avant d'ajouter, de renommer ou de supprimer une entrée `volumes:`
dans un `app.yml`, dans `shared_services` ou dans un service annexe.
Tenu par : --check — forme du spec, préfixe du propriétaire, collisions entre
apps, bloc de premier niveau et `name:`, `chown` du chemin monté (avertissement)
```

Dans `CLAUDE.md`, remplacer les lignes 296-366 (titre compris) par un renvoi de
trois lignes :

```markdown
## Les volumes nommés

Ce qui doit survivre au redéploiement vit dans un **volume nommé**, jamais dans
le système de fichiers du conteneur, et le `Dockerfile` `chown` son chemin avant
`USER`. Formes admises, préfixes, pièges : `memory/volumes.md`.
```

Compléter l'arborescence (`CLAUDE.md`, bloc de la ligne 35) par une ligne, à sa
place alphabétique après `journal/` :

```
memory/        un fichier par sujet sorti du contrat : ce que --check tient deja
```

- [ ] **Étape 6 : étendre les deux contrôles documentaires à `memory/`**

Dans `init.sh`, les deux boucles qui listent les documents — celle des liens
morts (vers 3521) et celle des titres en double (vers 3546) — portent la même
liste. Ajouter `memory/*.md` aux deux :

```bash
  for src in README.md CLAUDE.md PRODUCT.md memory/*.md apps/*/*.md journal/*.md; do
```

- [ ] **Étape 7 : vérifier que tout est vert**

```bash
./init.sh --check
```

Attendu : « Contrat respecte », avec la ligne
`ok  1 fichier(s) memory/ : en-tete complet, chaque sujet tenu par un controle`.
Vérifier aussi qu'aucun artefact n'a bougé :

```bash
git status --short          # attendu : CLAUDE.md, init.sh, memory/volumes.md — rien d'autre
```

- [ ] **Étape 8 : committer**

```bash
./init.sh --pret
git add CLAUDE.md init.sh memory/volumes.md
git commit -m "garde-fou : memory/ porte son en-tete, et « Tenu par : rien » est refuse"
git push -u origin claude/factory-memory-architecture-m0dpb5
```

---

### Tâche 2 : le sommaire, et son exactitude

**Fichiers :**
- Modifier : `CLAUDE.md` (sommaire ajouté en fin de fichier)
- Modifier : `init.sh` (contrôle du sommaire, à la suite du contrôle de forme)

**Interfaces :**
- Consomme : `memory/volumes.md` et son en-tête (Tâche 1).
- Produit : le tableau du sommaire, dont la Tâche 3 ajoute une ligne par fichier
  déplacé ; la reconnaissance des lignes de tableau (`^|`) comme seule source du
  sommaire.

- [ ] **Étape 1 : écrire le test négatif — un sommaire qui mentionne un fichier absent**

Ajouter en fin de `CLAUDE.md` le sommaire, avec **une ligne de trop** pointant un
fichier qui n'existe pas encore :

```markdown
## Le sommaire de `memory/`

Avant d'agir sur un de ces sujets, lis son fichier. Le contrat n'en garde que
l'essentiel ; le détail, les formes admises et les pièges y sont.

| Sujet | Fichier | Quand le lire |
|---|---|---|
| Volumes nommés | `memory/volumes.md` | avant d'ajouter ou de renommer un `volumes:` |
| Services annexes | `memory/services.md` | avant d'ajouter un service à une app ou à la fabrique |
```

- [ ] **Étape 2 : lancer le contrôle et constater qu'il ne voit rien**

```bash
./init.sh --check
```

Attendu : **vert**. Le sommaire promet un fichier qui n'existe pas, et rien ne le
dit — c'est l'échec du test. Un lien markdown aurait été vu par le contrôle de
liens morts ; une cellule de tableau en `code` ne l'est pas, et c'est exactement
la forme que prend un sommaire.

- [ ] **Étape 3 : écrire le contrôle du sommaire**

Dans `init.sh`, immédiatement après le bloc de la Tâche 1 :

```bash
  # Le sommaire est la seule partie de memory/ chargee en permanence : s'il ment,
  # un sujet devient invisible — un fichier absent du sommaire ne sera jamais
  # ouvert, un fichier promis et absent envoie chercher une page qui n'existe pas.
  # Meme exigence que le bloc volumes: de premier niveau du compose : il declare
  # EXACTEMENT ce qui existe. Seules les lignes de tableau comptent : une mention
  # en prose n'est pas une entree de sommaire.
  if [ -d memory ]; then
    ecart=0
    cites=$(grep -E '^\|' CLAUDE.md | grep -oE 'memory/[a-z0-9-]+\.md' | LC_ALL=C sort -u)
    reels=$(ls memory/*.md 2>/dev/null | LC_ALL=C sort -u)
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      grep -qxF "$f" <<<"$cites" \
        || { bad "sommaire : $f existe mais n'est pas dans le sommaire de CLAUDE.md — il ne sera jamais ouvert"; ecart=$((ecart+1)); }
    done <<<"$reels"
    while IFS= read -r f; do
      [ -n "$f" ] || continue
      [ -f "$f" ] \
        || { bad "sommaire : CLAUDE.md annonce $f, qui n'existe pas"; ecart=$((ecart+1)); }
    done <<<"$cites"
    [ "$ecart" -eq 0 ] && ok "sommaire du contrat : exactement les $(printf '%s\n' "$reels" | grep -c . ) fichier(s) de memory/"
  fi
```

- [ ] **Étape 4 : relancer et constater les deux refus**

```bash
./init.sh --check 2>&1 | grep 'sommaire'
```

Attendu : `KO  sommaire : CLAUDE.md annonce memory/services.md, qui n'existe pas`.

Puis le sens inverse — retirer la ligne `volumes.md` du sommaire :

```bash
sed -i '/| Volumes nommés |/d' CLAUDE.md
./init.sh --check 2>&1 | grep 'sommaire'
```

Attendu : `KO  sommaire : memory/volumes.md existe mais n'est pas dans le sommaire de CLAUDE.md`.

- [ ] **Étape 5 : rendre le sommaire exact**

Rétablir la ligne `Volumes nommés` et **supprimer** la ligne `Services annexes` :
le sommaire ne doit contenir que `memory/volumes.md`. La Tâche 3 le complétera au
fur et à mesure, ce qui est le point : chaque déplacement échoue tant que son
sommaire n'est pas à jour.

- [ ] **Étape 6 : vérifier et committer**

```bash
./init.sh --check          # attendu : vert, « sommaire du contrat : exactement les 1 fichier(s) »
./init.sh --pret
git add CLAUDE.md init.sh
git commit -m "garde-fou : le sommaire du contrat declare exactement les fichiers de memory/"
git push
```

---

### Tâche 3 : déplacer les sept sujets restants

**Fichiers :**
- Créer : `memory/app-yml.md`, `memory/services.md`, `memory/travail.md`,
  `memory/outillage.md`, `memory/exposition.md`,
  `memory/regles-imperatives.md`, `memory/perimetre.md`
- Modifier : `CLAUDE.md` (sept chapitres retirés, sept renvois, sept lignes de
  sommaire)

**Interfaces :**
- Consomme : le format d'en-tête (Tâche 1), le sommaire et son contrôle
  (Tâche 2).
- Produit : `CLAUDE.md` sans aucun des huit chapitres déplacés — état d'entrée de
  la Tâche 4.

**La recette, identique pour les sept.** Un fichier par étape, un commit par
fichier : c'est ce qui rend chaque déplacement relisable seul, et c'est la seule
façon de voir dans un diff qu'un déplacement n'a rien perdu.

1. Créer `memory/<nom>.md` : titre `#` reprenant le titre du chapitre, les deux
   lignes d'en-tête, puis le contenu **déplacé tel quel** — sous-titres `###`
   rétrogradés en `##`, rien d'autre.
2. Retirer le chapitre de `CLAUDE.md`, y laisser un renvoi de deux à quatre
   lignes : ce que la règle impose, puis `détail : memory/<nom>.md`.
3. Ajouter la ligne du sommaire.
4. `./init.sh --check` — vert attendu. Un KO `sommaire` signifie l'étape 3
   oubliée ; un KO `Tenu par` signifie l'en-tête mal copié ; un KO `titre de
   section en double` signifie deux `##` de même nom après rétrogradation des
   `###`, à renommer dans le fichier nouveau.
5. `git diff --stat` — le total des lignes retirées de `CLAUDE.md` et ajoutées au
   fichier doit se correspondre à quelques lignes près. Un écart de plus de dix
   lignes veut dire qu'on a réécrit au lieu de déplacer.
6. `./init.sh --pret`, puis commit.

- [ ] **Étape 1 : `memory/app-yml.md`** — `CLAUDE.md` 72-192, sous-titre « Quatre sections optionnelles » compris

```markdown
Quand lire : avant de créer ou de modifier un `apps/<nom>/app.yml` — champs,
sections `volumes:`, `env:`, `needs:`, `services:`.
Tenu par : --check — noms de service, formes de `volumes:`, `env:` en NOMS seuls,
`needs:` connu de `shared_services`, `command:` scalaire ou liste
```

Renvoi laissé dans le contrat :

```markdown
## `apps/<nom>/app.yml` — les valeurs que tu décides

Un fichier par application, **jamais réécrit par `init.sh`** : il est la source
de vérité, tu l'édites à la main puis tu relances `./init.sh`. Les valeurs
décidées là — port, mémoire, healthcheck, palier, volumes, services annexes —
sont toutes vérifiées : détail et pièges dans `memory/app-yml.md`.
```

Commit : `contrat : les champs de app.yml passent dans memory/`

- [ ] **Étape 2 : `memory/services.md`** — `CLAUDE.md` 223-295, `shared_services` compris

```markdown
Quand lire : avant d'ajouter un service annexe à une app, un `shared_services` à
la fabrique, ou avant de nommer une app.
Tenu par : --check — `traefik.enable=false` sur tout service non routé, aucun
autre label `traefik.*`, collision de noms dans l'espace plat, `needs:` inconnu
```

Renvoi :

```markdown
## Les trois sortes de services — une seule est routée

`compose.yaml` porte trois sortes de services dans un espace de noms **plat** :
l'app, ses annexes `<app>-<nom>`, et les `shared_services` de la fabrique. **Seule
l'app est joignable depuis Internet** ; les deux autres portent
`traefik.enable=false`, et c'est ce label — non l'absence de label — qui les en
retire. Détail, budget mémoire et collisions de noms :
`memory/services.md`.
```

Commit : `contrat : les trois sortes de services passent dans memory/`

- [ ] **Étape 3 : `memory/travail.md`** — `CLAUDE.md` 400-534 (fin de vie d'une branche, deux garde-fous, journal, agents)

```markdown
Quand lire : avant de remplir une entrée de journal, de lancer l'`analyste` ou le
`greffier`, ou de conclure qu'une branche peut être supprimée.
Tenu par : --check — gabarit nu committé, en-tête `Périmètre`/`Mode`, deux champs
fermés par anomalie ; hook — `garde-branche.sh` refuse d'éditer sur `main`,
`garde-commit.sh` refuse un arbre sale
```

Le chapitre « Comment on travaille » **reste** dans le contrat, réduit à son
intro (lignes 367-399) : la branche, un commit par étape, `--pret`, et l'entrée
de journal remplie à chaud. Y ajouter le renvoi :

```markdown
Les vocabulaires fermés du journal, les deux agents, les deux garde-fous et la
fin de vie d'une branche : `memory/travail.md`.
```

Commit : `contrat : journal, agents et garde-fous passent dans memory/`

- [ ] **Étape 4 : `memory/outillage.md`** — `CLAUDE.md` 555-610

```markdown
Quand lire : quand un plugin ou un serveur LSP manque, ou après un `./init.sh`
qui change un `stack` ou un `ui`.
Tenu par : --check — `settings.json` présent et sans bloc `env`, scripts
analysables, `cloud-setup.sh` aligné sur les plugins et les LSP ; hook —
`check-plugins.sh` rapporte à chaque ouverture de session
```

Renvoi :

```markdown
## Ton outillage

`init.sh` écrit un `.claude/settings.json` **versionné** : tout clone repart avec
le même outillage. **Déclarer un plugin ne l'installe pas** — seul le *setup
script* de l'environnement cloud le fait, et `.claude/cloud-setup.sh` en porte le
contenu à recoller après tout changement de `stack` ou de `ui`. Liste des
plugins, serveurs LSP, et le rapport d'ouverture de session :
`memory/outillage.md`. **Jamais de bloc `env` dans `.claude/settings.json`** : il
est public par construction.
```

Commit : `contrat : l'outillage passe dans memory/`

- [ ] **Étape 5 : `memory/exposition.md`** — `CLAUDE.md` 611-656, **sauf** le tableau des trois paliers

```markdown
Quand lire : avant de changer l'`exposure` d'une app, avant de lire une identité
d'utilisateur, et avant tout choix de palier `public`.
Tenu par : --check — middleware du palier service par service, lecture de
`X-Forwarded-User` refusée en `exposure: public`, avertissement sur tout palier
public
```

Ce qui **reste** dans le contrat : le tableau des trois paliers (`private`,
`google`, `public` — middleware, qui entre, quand l'utiliser), la phrase qui
distingue `forwardauth-open` de `public`, et la règle de prudence « si tu hésites
entre deux paliers, prends le plus fermé ». Le choix est un arbitrage : il reste
sous les yeux. Puis le renvoi :

```markdown
Ce que `public` implique, `X-Forwarded-User` et le cloisonnement par
utilisateur : `memory/exposition.md`.
```

Commit : `contrat : le detail des paliers passe dans memory/, le tableau reste`

- [ ] **Étape 6 : `memory/regles-imperatives.md`** — `CLAUDE.md` 657-689

```markdown
Quand lire : avant d'écrire ou de modifier un `Dockerfile`, un `test.sh`, ou le
démarrage d'une app.
Tenu par : --check — section `ports:` refusée, `USER` absent refusé, bind mount
refusé, `LABEL traefik.*` dans le Dockerfile refusé ; CI — taille d'image et
`LABEL traefik` hérité de l'image de base
```

Renvoi :

```markdown
## Règles impératives

Un `Dockerfile` par app dans `apps/<nom>/`, multi-étapes, image **< 200 Mo**,
tournant en **utilisateur non root**. **Aucun port publié**, **aucun secret**,
**aucun `LABEL traefik.*`**, les logs sur la sortie standard, et l'app démarre
sans intervention. Chacune de ces règles est refusée par `./init.sh --check` ou
par la CI, avec la raison : `memory/regles-imperatives.md`.
```

Commit : `contrat : les regles imperatives passent dans memory/`

- [ ] **Étape 7 : `memory/perimetre.md`** — `CLAUDE.md` 690-725

```markdown
Quand lire : avant d'écrire dans un README une demande adressée au serveur, et
avant de supposer qu'une base, un cache ou un volume n'est pas de ton ressort.
Tenu par : --check — section `ports:` refusée, bind mount refusé, palier sans
authentification inexistant ; les trois refus ont chacun leur alternative générée
```

Renvoi :

```markdown
## Ce qui ne t'appartient pas

Une base, un cache, un volume, un service annexe **t'appartiennent désormais** :
déclare-les dans un manifeste plutôt que de les demander dans un `README`. Seule
exception, les **valeurs** des secrets : tu écris le nom dans `env:` et dans ton
`README`, l'infrastructure injecte la valeur. La topologie réseau, les trois
refus et leurs alternatives : `memory/perimetre.md`.
```

Commit : `contrat : le perimetre passe dans memory/`

- [ ] **Étape 8 : vérifier l'ensemble des huit**

```bash
./init.sh --check 2>&1 | grep -E 'memory|sommaire'
wc -l CLAUDE.md memory/*.md
```

Attendu : `ok  8 fichier(s) memory/`, `ok  sommaire du contrat : exactement les 8
fichier(s)`, et un `CLAUDE.md` entre 250 et 300 lignes — la Tâche 4 fait le
reste.

---

### Tâche 4 : le plafond, et les deux condensations qui le rendent atteignable

**Fichiers :**
- Modifier : `init.sh` (variable de plafond près de `IMAGE_MAX_MB` ligne 340 ;
  contrôle à la suite de celui du sommaire)
- Modifier : `CLAUDE.md` (« Avant de pousser » et « La pull request » condensés)

**Interfaces :**
- Consomme : l'état de `CLAUDE.md` après la Tâche 3.
- Produit : un contrat sous plafond, et l'avertissement qui l'y maintient.

- [ ] **Étape 1 : écrire le test négatif — le contrat dépasse, et rien ne le dit**

```bash
wc -l CLAUDE.md      # noter la valeur : elle doit etre > 250 a ce stade
./init.sh --check 2>&1 | grep -ci 'CLAUDE.md.*lignes'
```

Attendu : `0`. Aucun contrôle ne parle de la taille du contrat — c'est l'échec du
test, et c'est la raison pour laquelle il a atteint 750 lignes.

- [ ] **Étape 2 : écrire le contrôle de plafond**

Près de `IMAGE_MAX_MB=$(fab image_max_mb 200)` (ligne 340) :

```bash
CLAUDE_MAX_LIGNES=$(fab claude_max_lignes 250)
```

Le défaut suffit : ne pas ajouter la clé à `fabrique.yml`, qui est commun et dont
la modification fait reconstruire toutes les apps.

Puis, à la suite du contrôle du sommaire :

```bash
  # Le contrat a grossi jusqu'a 750 lignes parce que rien ne bornait sa taille :
  # chaque anomalie rattrapee y ajoutait un paragraphe, aucun ne le quittait.
  # Avertissement et non KO — un contrat a 260 lignes n'est pas un defaut de
  # deploiement — mais la derive doit se voir a chaque --check, sinon elle
  # recommence.
  if [ -f CLAUDE.md ]; then
    cl=$(grep -c '' CLAUDE.md)
    [ "$cl" -le "$CLAUDE_MAX_LIGNES" ] \
      && ok "CLAUDE.md $cl lignes / $CLAUDE_MAX_LIGNES" \
      || warn "CLAUDE.md $cl lignes, au-dela de $CLAUDE_MAX_LIGNES — sors un sujet dans memory/ plutot que d'elargir le contrat"
  fi
```

`grep -c ''` et non `wc -l` : `wc` sort un nombre précédé d'espaces sur certaines
implémentations, que `[` refuse.

- [ ] **Étape 3 : relancer et constater l'avertissement**

```bash
./init.sh --check 2>&1 | grep 'CLAUDE.md'
```

Attendu : `attn  CLAUDE.md <n> lignes, au-dela de 250 — ...`, et **un état final
vert** : un avertissement ne bloque pas. Vérifier les deux : le message présent,
et « Contrat respecte » en dernière ligne.

- [ ] **Étape 4 : condenser les deux derniers chapitres**

« Avant de pousser » (25 lignes) devient :

```markdown
## Avant de pousser

```bash
./init.sh --check
```

Manifestes, puis artefacts dérivés, puis le compose service par service, puis les
documents. Les avertissements ne bloquent pas, les KO si. Le même contrôle tourne
en CI, en verrou de tous les autres jobs : avec une stack partagée, un compose
faux fusionné casserait toutes les apps à la fois. Le déploiement part à chaque
fusion sur `main` — deux à trois minutes jusqu'à la mise en ligne.
```

« La pull request se lit en trente secondes » (12 lignes) tombe à quatre, dans le
chapitre « Comment on travaille » :

```markdown
**La pull request vient à la fin**, une fois l'ensemble cohérent. Son corps sert
à décider s'il faut relire et par où commencer, pas à rendre compte : une phrase,
trois à cinq puces, ce qui a été vérifié en chiffres. Le raisonnement détaillé va
dans les **messages de commit**, où il survit à la fusion.
```

- [ ] **Étape 5 : vérifier que le plafond est tenu**

```bash
./init.sh --check 2>&1 | grep 'CLAUDE.md'
```

Attendu : `ok  CLAUDE.md <n> lignes / 250`, avec `<n>` ≤ 250. Si le compte reste
au-dessus, ne pas relever le plafond : sortir un sujet de plus, ou condenser un
renvoi trop bavard. Le plafond est le but, pas la contrainte.

- [ ] **Étape 6 : committer**

```bash
./init.sh --pret
git add CLAUDE.md init.sh
git commit -m "garde-fou : le contrat avertit au-dela de 250 lignes, et y tient"
git push
```

---

### Tâche 5 : la relecture, et ce qui prouve qu'aucune règle n'a été perdue

**Fichiers :** aucun, sauf correctifs et l'entrée de journal.

- [ ] **Étape 1 : prouver qu'aucune règle n'a disparu**

Le risque du lot n'est pas un contrôle faux, c'est une phrase perdue en route.
Deux mesures :

```bash
# 1. Le total doit rester du meme ordre que les 750 lignes de depart.
grep -c '' CLAUDE.md memory/*.md | awk -F: '{s+=$2} END {print s" lignes au total"}'

# 2. Chaque terme qui portait une regle doit se retrouver quelque part.
for t in health_cmd 'enabled: false' requirepass X-Forwarded-User priority=100 \
         exposedByDefault 'name:' chown scratch distroless forwardauth-open \
         'traefik.enable=false' 'apps_net' 'X-Forwarded-User' 'retrospective'; do
  grep -qrF "$t" CLAUDE.md memory/ || echo "PERDU : $t"
done
```

Attendu : un total entre 700 et 800 lignes, et **aucune ligne `PERDU`**. Un terme
perdu se rattrape en relisant le diff du commit qui a déplacé son chapitre.

- [ ] **Étape 2 : lire le contrat en entier, du début à la fin**

Le but du lot est qu'il soit lisible : le vérifier en le lisant. Chercher trois
défauts précis — un renvoi qui ne dit pas ce que la règle impose (« voir
`memory/x.md` » seul est un échec) ; deux renvois qui se répètent ; un chapitre
dont il ne reste qu'un titre.

- [ ] **Étape 3 : compléter le journal de la branche**

Ajouter au journal toute anomalie rencontrée en déroulant ce plan — un contrôle
qui ne s'est pas déclenché du premier coup, un déplacement qui a cassé un titre,
un renvoi réécrit trois fois. Les mineures sont les plus utiles : ce sont elles
qui disent où le plan avait tort.

- [ ] **Étape 4 : vérification finale et pull request**

```bash
./init.sh --check       # vert, avec les trois nouvelles lignes ok
./init.sh --pret
git add -A && git commit -m "journal : les anomalies du lot 1" && git push
```

Puis ouvrir la pull request en remplissant `.github/pull_request_template.md` :
une phrase sur ce que fait le changement, les chiffres (750 → *n* lignes, huit
fichiers, trois contrôles), et le point d'attention — le lot 2 n'est pas dedans.

---

## Ce que ce plan ne fait pas

- **Le lot 2** — `init.sh` cesse d'être le propriétaire de l'outillage — a son
  propre plan, écrit après la fusion de celui-ci.
- **Aucun hook de rappel** : rien qui glisse un fichier de `memory/` sous les yeux
  au moment d'éditer. À rouvrir si l'usage montre que les fichiers ne sont pas
  lus.
- **Aucune réécriture du contenu déplacé** en dehors des deux condensations de la
  Tâche 4.

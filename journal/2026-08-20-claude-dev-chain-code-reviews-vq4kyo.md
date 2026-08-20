# 2026-08-20 — claude/dev-chain-code-reviews-vq4kyo

Branche : `claude/dev-chain-code-reviews-vq4kyo`
Périmètre : `fabrique` — `scripts/`, `.github/workflows/build.yml`, `init.sh`,
`.claude/agents/`, `CLAUDE.md`, `memory/`, et un `revue:` neuf dans les dix
`apps/*/app.yml`. Rayon de souffle maximal : la chaine partagee.
Mode : `chaud`

## Anomalies

### 1. La chaine de developpement n'a aucune relecture outillee

**Symptome** — a l'ouverture de la branche, la CI verifie le contrat, lance
`apps/<nom>/test.sh` et inspecte l'image. Rien d'autre. Aucun controle de
securite (ni analyse statique, ni dependances vulnerables), aucune mesure de
couverture, aucune detection de duplication, aucune relecture. Les tests bout en
bout existent pour trois apps sur dix (`ardoise`, `compteur`, `ramure-v2`) et
ne tournent JAMAIS en CI : `ardoise/e2e/lancer.sh` et `compteur/e2e/lancer.sh`
disent eux-memes « n'est PAS lance par la CI », et `ramure-v2/test.sh` garde son
bout en bout derriere `RAMURE_E2E`, variable posee nulle part dans le workflow.

**Cause** — la fabrique s'est dotee tot de garde-fous sur la *forme* (`--check`,
inspection des images, `pret.sh`) et jamais sur le *fond*. `memory/outillage.md`
l'ecrit noir sur blanc pour le plugin `code-review` : « la revue passe par
`--check`, les quatre harnais de test et la relecture humaine avant fusion » —
c'est-a-dire par rien d'automatique.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — c'est l'objet de cette branche. Voir
`docs/superpowers/specs/2026-08-20-revue-et-bout-en-bout-design.md`.

### 2. Un seuil de couverture unique aurait rendu la chaine rouge partout

**Symptome** — la decision prise etait « tout bloque ». Mesure faite avant
d'ecrire quoi que ce soit, la couverture des lignes va de 32,7 % (`compteur`) a
64,0 % (`cadran`), 36,0 % pour `hello-world`. N'importe quel plancher fixe et
raisonnable — 60 %, 70 %, 80 % — aurait bloque la moitie ou la totalite des apps
des le premier commit, sur du code que personne n'avait touche.

**Cause** — un plancher absolu juge un etat, pas un geste. La dette existante et
la regression introduite par la branche courante ne se distinguent plus.

**Detecte par** — `auteur`

**Action** — `arbitrage` — arbitre avec l'utilisateur : la barre de chaque app
est relevee a son niveau du jour, ecrite dans son `app.yml`, et ne peut plus que
monter. Rien n'est rouge au demarrage, la dette ne peut plus croitre. Le detail
est dans la spec ; le principe est un cliquet, pas un objectif.

### 3. `jscpd` annonce « 0 % de duplication » sur du code qu'il n'a jamais lu

**Symptome** — premiere mesure de duplication sur les dix apps : 0 % partout, une
seule exception a 1,82 %. Les totaux de lignes trahissent la mesure — `ramure`
compte 132 lignes analysees pour environ 150 Ko de Go, `ardoise` 212. Le rapport
JSON le confirme : `statistics.formats` ne contient que `javascript`, un seul
fichier, `web/sw.js`. Aucun `.go` n'a ete lu, aucun `.html` non plus.

**Cause** — `--format "golang,javascript,typescript,html,css"`. Les noms de
format de `@jscpd/tokenizer` sont `go` et `markup`, pas `golang` ni `html`. Un
format inconnu est **ignore en silence** : ni avertissement, ni code de retour
non nul. L'outil sort en 0 et rend un rapport parfaitement bien forme, sur un
perimetre vide. Formats corriges : `go,javascript,typescript,css,scss,markup`.

**Detecte par** — `auteur`

**Action** — `garde-fou` — c'est le mode d'echec que le depot a deja nomme sur
l'inspection des labels Traefik : « un controle de securite qui echoue en ouvert
est pire que pas de controle : il rassure ». `scripts/revue.sh` ne se contentera
pas du code de retour de `jscpd` : il comparera le **nombre de fichiers
analyses** (`statistics.formats[*].sources`) au nombre de fichiers que le
perimetre contient reellement, et mettra KO si l'ecart n'est pas explicable.
Un axe de revue qui ne lit rien doit crier, pas rendre 0 %.

### 4. `staticcheck` trouve une directive `go:embed` desamorcee par une espace

**Symptome** — `apps/marcq-handball/main.go:34` porte
`// go:embed n'emporte que web/ : ...`. C'est une phrase d'explication, pas une
directive — mais elle en a la forme, a une espace pres. `staticcheck` la signale
(SA9009, « ineffectual compiler directive due to extraneous space »).

**Cause** — le commentaire de prose explique la vraie directive, trois lignes
plus bas. Le compilateur ne dit rien : `//go:embed` avec espace n'est plus une
directive, donc il n'y a aucune erreur a produire. Ici la vraie directive existe
et l'app fonctionne ; le jour ou quelqu'un ecrit la prose SANS la directive, ou
la deplace, l'image part avec un `embed.FS` vide et l'app sert des 404 sans que
rien n'ait echoue a la construction.

**Detecte par** — `relecture`

**Action** — `rien` — la phrase se reformule en phase 3. Ce qui compte est que
l'outil l'ait vue : c'est exactement le genre de defaut que `go vet` seul laisse
passer, et c'est ce que la revue vient chercher.

### 5. `npm audit` echoue sur trois apps qui n'ont aucune dependance

**Symptome** — `marcq-handball`, `pilabelle` et `renaissance-gym` portent un
`package.json` sans `package-lock.json`. `npm audit` sort en 1 avec `ENOLOCK`,
« This command requires an existing lockfile ». Lu naivement, c'est un KO de
securite sur trois apps.

**Cause** — leurs `package.json` le disent eux-memes : « aucune dependance,
aucun script, aucun node_modules ». Le fichier ne sert qu'a declarer
`"type": "module"` a Node. Il n'y a rien a auditer, et rien de faux.

**Detecte par** — `auteur`

**Action** — `garde-fou` — `revue.sh` ne lancera `npm audit` que si un
`package-lock.json` existe, et **dira** qu'il ne l'a pas lance plutot que de se
taire. Un perimetre vide se declare ; c'est la difference entre « rien a
auditer » et « audit non fait », que le silence confond.

### 6. La couverture de `ramure-v2` n'est pas mesurable sans construire son client

**Symptome** — `go test ./...` dans `apps/ramure-v2` echoue :
`pattern web/dist: no matching files found`. Le paquet principal ne compile pas,
donc sa couverture manque ; les neuf paquets `internal/` se mesurent normalement
(78,8 % a 100 %).

**Cause** — connue et documentee dans `apps/ramure-v2/test.sh` : `//go:embed
web/dist` exige que la chaine TypeScript ait construit AVANT Go. `test.sh` fait
`npm ci` puis `npm run build` en tete ; ma mesure ne les a pas faits.

**Detecte par** — `auteur`

**Action** — `contrat` — la spec supposait qu'une app se mesure a froid. C'est
faux pour toute app dont le binaire embarque un artefact construit. Un contrat
`apps/<nom>/prepare.sh` FACULTATIF est ajoute : `test.sh` et `revue.sh`
l'appellent tous deux quand il existe, donc la preparation est ecrite UNE fois.
C'est la regle deja posee pour `lib/socle.sh` — une chose y entre quand un
DEUXIEME metier en a besoin, jamais avant. Ici le deuxieme arrive.

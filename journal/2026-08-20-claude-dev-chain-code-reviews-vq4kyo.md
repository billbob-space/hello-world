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

### 7. `jscpd` ecarte en silence tout fichier de plus de 1000 lignes

**Symptome** — le garde-fou de perimetre ecrit apres l'anomalie 3 a bloque le
premier semis des barres : « jscpd n'a lu que 25 fichiers sur 26 ». Sur
`estran`, le manquant est `web/style.css`, 1471 lignes. Le format `css`
n'apparaissait meme pas dans `statistics.formats` du rapport — ce qui ressemble
trait pour trait a un nom de format faux, et n'en est pas un.

**Cause** — `jscpd` porte deux bornes par defaut, `--max-lines` a 1000 et
`--max-size` a 100 ko, et ecarte sans un mot tout fichier au-dela. Ce sont
exactement les GROS fichiers, c'est-a-dire ceux ou la duplication a le plus de
place pour se cacher. Bornes levees a 100 000 lignes et 5 Mo, la mesure d'estran
passe de 0,27 % a 0,47 % sur le meme code.

**Detecte par** — `relecture`

**Action** — `rien` — le garde-fou de l'anomalie 3 a fait exactement ce pour
quoi il a ete ecrit, deux heures apres l'avoir ete, sur un mode d'echec DIFFERENT
de celui qui l'avait motive. Rien a changer au contrat : c'est la demonstration
que « comparer le perimetre analyse au perimetre attendu » ne visait pas un bogue
particulier mais une famille entiere. Les deux bornes sont desormais passees
explicitement, avec la mesure d'avant et d'apres en commentaire.

### 8. La couverture navigateur ecrivait un separateur de colonnes dans le manifeste

**Symptome** — le premier semis a produit `revue_couverture_web:` VIDE pour
`marcq-handball`, `pilabelle` et `renaissance-gym`. Un manifeste avec une cle
sans valeur — que `--check` aurait refuse, mais qui aurait pu etre committe.

**Cause** — `node --test --experimental-test-coverage` rend
« `# all files | 86.83 | 91.70 | 88.84` ». Les barres verticales sont des
separateurs de COLONNES et non des champs ; le quatrieme champ vaut donc « | »
et non le pourcentage. Aggrave par un second choix malheureux : la valeur
transitait dans une variable ou « | » servait justement de separateur interne.

**Detecte par** — `auteur`

**Action** — `garde-fou` — corrige, et surtout couvert par un cas de test ou
`node` n'est PAS double. Doubler node aurait rejoue le format que je CROIS qu'il
produit — or c'est la lecture de ce format qui se trompait. Un bouchon qui
reproduit ma propre erreur de lecture valide l'erreur.

### 9. La moitie navigateur de `ramure-v2` n'est pas mesuree, et rien ne le disait

**Symptome** — les dix barres semees, `ramure-v2` est la seule app a code
navigateur qui n'ait PAS de `revue_couverture_web`. Son manifeste ne s'en plaint
pas, `--check` non plus, et la revue rend un axe couverture vert : « Go 81.7 % ».
Lu vite, cela dit « couverte a 81 % ». En verite la moitie TypeScript, environ
2 200 lignes, n'a ete mesuree par personne.

**Cause** — `axe_couverture` ne connait qu'une forme de tests navigateur, celle
que huit apps sur dix emploient : `tests/*.test.js` joues par `node --test`.
`ramure-v2` est la seule a utiliser vitest, sous `web/`, et sa mesure de
couverture demanderait `@vitest/coverage-v8`, absent de ses dependances.

**Detecte par** — `auteur`

**Action** — `garde-fou` — c'est un vert silencieux de plus, d'un cran au-dessus
des precedents : l'outil ne se trompe pas, c'est le CONTRAT qui ne reclame rien.
La parade appartient a la phase ou vitest entre dans la chaine : `--check` doit
refuser une app qui porte du code navigateur sans `revue_couverture_web`, comme
il refusera bientot une app sans `e2e/lancer.sh`. En attendant, le trou est
ecrit ici plutot que nulle part — et c'est la seule raison pour laquelle cette
entree existe.

### 10. Fermer deux failles de dependance fait monter la fabrique en Go 1.25

**Symptome** — `go get golang.org/x/text@v0.39.0` et
`github.com/jackc/pgx/v5@v5.9.2`, les deux versions correctives designees par
`govulncheck`, font passer la directive `go` de `ardoise`, `compteur` et
`ramure-v2` de 1.24 a **1.25.0** — les deux modules l'exigent. `go.work`, qui
prend le maximum, suit. Le serveur de langage, lui, tourne en 1.24.7 epingle :
il a cesse de charger les paquets de toutes les apps Go, y compris celles que
personne n'avait touchees.

**Cause** — un correctif de securite n'est pas neutre : il porte la version de
langage de sa propre dependance. `GOTOOLCHAIN=auto` masque la moitie du
probleme — `go build` telecharge la 1.25.0 tout seul et reussit, si bien que
rien n'echoue la ou on regarde. Ce qui ne suit PAS automatiquement, ce sont les
`Dockerfile`, epingles en `golang:1.24-alpine` : l'image se construirait sur un
toolchain trop vieux pour son propre `go.mod`.

**Detecte par** — `relecture`

**Action** — `arbitrage` — les `Dockerfile` d'`ardoise` et `compteur` passent en
`golang:1.25-alpine`. Trois apps sur dix montent, les sept autres restent en
1.24 : accorder toute la flotte elargirait la branche a des apps qu'aucun
constat ne concerne, et le contrat demande l'inverse. Le parc est donc
volontairement mixte, et cette entree est la seule trace de cette decision.

**Limite assumee** : le demon Docker n'est pas joignable depuis cette session, la
construction des images n'a donc PAS ete verifiee ici. C'est la CI qui tranchera,
au job `build`. Je le dis plutot que de laisser croire a une verification que je
n'ai pas faite.

### 11. Une mise a l'ecart de constat mal ecrite n'ecarte rien, et ne le dit pas

**Symptome** — trois artisans lances en parallele sur `cadran`, `ramure` et
`pilabelle` ont rencontre le meme mur, chacun de leur cote : la consigne que je
leur avais donnee — `//nosec Gxxx -- <raison>` — n'ecarte AUCUN constat. gosec
continue de tout remonter et affiche `Nosec: 0`, sans un mot d'avertissement sur
le commentaire qu'il vient d'ignorer. Les trois s'en sont apercus en relancant
l'outil, pas avant.

**Cause** — gosec v2.28.0 ne reconnait litteralement que `#nosec` : le marqueur
s'ecrit `// #nosec Gxxx -- <raison>`. Sans le croisillon, le commentaire est du
texte ordinaire. L'option `-nosec-tag` le confirme : « Set an alternative string
for #nosec ». Ma consigne etait fausse, et c'est moi qui l'avais ecrite.

**Detecte par** — `auteur`

**Action** — `garde-fou` — deux suites, et la seconde compte plus que la
premiere. D'abord la syntaxe exacte va dans `memory/revue.md`, qui n'existait
pas encore : une consigne fausse repetee a neuf artisans coute neuf fois.

Ensuite le mode d'echec SYMETRIQUE, qui lui n'avait pas de parade : un `#nosec`
BIEN ecrit eteint un controle de securite depuis l'interieur du code, et
n'apparait nulle part dans la sortie de la revue — puisque justement plus rien
ne sort. C'est le moyen le plus simple de rendre un axe vert sans rien corriger,
et le seul qui ne laisse aucune trace a l'ecran. `revue.sh` compte desormais les
mises a l'ecart et les affiche a chaque passage : « aucun constat sur 12
fichiers, 3 ecarte(s) par #nosec ». La RAISON, elle, reste dans le diff, ou la
relecture la juge. Un cas de test tient ce comptage.

C'est le quatrieme vert silencieux de cette branche, apres les deux de `jscpd`
et celui de la couverture navigateur. Aucun des quatre ne venait du meme
endroit, et aucun n'aurait ete visible dans un diff.

### 12. La revue modifiait les manifestes des apps qu'elle relit

**Symptome** — trois artisans ont signale, chacun de son cote, que lancer
`go run <outil>@<version>` depuis le repertoire d'une app modifie son `go.mod` et
son `go.sum`. L'un d'eux, en « nettoyant » cet effet par
`git checkout -- go.mod go.sum`, a annule du meme geste la montee de dependance
qui fermait deux failles — et l'a annoncee comme un nettoyage.

**Cause** — l'outil exige un toolchain plus recent que celui de l'app ; Go
propage alors la directive dans le module COURANT, qui est celui de l'app. La
revue avait donc un effet de bord sur son propre sujet.

**Detecte par** — `relecture`

**Action** — `garde-fou` — les outils sont desormais **installes une fois**
(`go install` lance depuis un repertoire VIDE, sans module alentour) dans
`.revue-outils/`, et la revue appelle les binaires. Un cas de test tient la
propriete structurelle : la doublure de `go` journalise les sous-commandes
recues, et le cas verifie que `run` n'y apparait jamais. Un outil de relecture
qui modifie ce qu'il relit n'est pas un outil de relecture.

### 13. Le verdict de la revue dependait du Go installe sur la machine

**Symptome** — les outils une fois installes plutot que lances par `go run`,
`govulncheck` s'est mis a rapporter **27 vulnerabilites** sur `estran`, app qui
n'en a aucune, et `staticcheck` a rendu « le code ne compile pas » sur
`compteur`. Le depot n'avait pas bouge.

**Cause** — deux faces de la meme chose. `go run` basculait implicitement sur un
toolchain recent ; `go install` depuis un repertoire vide compile avec le Go
LOCAL, ici 1.24.7. Consequence 1 : `govulncheck` rapporte les failles de la
bibliotheque standard de 1.24.7 — vraies pour qui construit avec, sans rapport
avec ce que la fabrique deploie. Consequence 2 : `staticcheck` compile avec
1.24.7 refuse d'analyser un module qui exige 1.25.0 et rend un faux
« ne compile pas ». Mesure : 27 vulnerabilites sans chaine epinglee, **zero**
avec `GOTOOLCHAIN=go1.26.7`, sur le meme code.

**Detecte par** — `relecture`

**Action** — `contrat` — `outil_toolchain` entre dans `fabrique.yml`, a cote des
versions d'outils, et `revue.sh` l'EXPORTE avant tout appel : elle vaut pour
l'installation, pour les outils eux-memes qui relancent `go list` en
sous-processus, et pour `go test`. Elle n'a rien a voir avec le `FROM golang:`
des `Dockerfile` — celui-la dit avec quoi on CONSTRUIT ce qu'on deploie, elle
dit avec quoi on RELIT. Le cache des binaires porte son nom, sans quoi en
changer resservirait les binaires d'avant.

Un verdict de securite qui change de poste en poste n'est pas un verdict.

### 14. `gosec -quiet` n'ecrit pas de rapport quand l'app est saine

**Symptome** — `compteur`, une fois ses constats traites, sortait en KO :
« gosec a echoue (code 0) », avec un message vide. L'app etait devenue parfaitement
propre, et c'est exactement ce qui la faisait echouer.

**Cause** — `-quiet` signifie « only show output when errors are found », et cela
couvre AUSSI le fichier `-out=`, qui n'est alors pas ecrit du tout. Le controle
de perimetre lisait ce fichier absent comme un outil tombe. Le garde-fou
anti-vert-silencieux produisait ici son symetrique : un ROUGE silencieux, sur
l'app la plus propre de la fabrique.

**Detecte par** — `test`

**Action** — `garde-fou` — `-quiet` retire, et les deux pannes se distinguent
desormais dans le message : « a echoue (code N) » et « n'a ecrit aucun rapport »
ne sont pas le meme incident. Un cas de test rejoue le comportement exact de
gosec sur une app saine.

### 15. `marcq-handball` se declarait en TypeScript sans une ligne de TypeScript

**Symptome** — l'artisan charge d'ecrire le bout en bout de l'app a signale que
sa notice `apps/marcq-handball/CLAUDE.md` annonce « Technologie : typescript ».
L'app est en Go, avec une coque web en JavaScript natif embarquee par
`go:embed`. Aucun `.ts` nulle part.

**Cause** — `stack: typescript` dans son `app.yml`, jamais corrige. La notice
etant GENEREE depuis ce manifeste, elle repetait fidelement une valeur fausse —
et c'est cette notice que tout agent travaillant sur l'app lit en premier. Le
champ pilote aussi le LSP active : l'app tournait donc sans serveur de langage
Go, et avec un serveur TypeScript sans rien a analyser.

**Detecte par** — `relecture`

**Action** — `rien` — corrige en `stack: go`, artefacts regeneres. Rien a durcir :
`--check` ne peut pas deviner la technologie d'une app a sa place, et une
verification heuristique (« il y a des .go, donc… ») ferait plus de mal que de
bien sur une app polyglotte. Ce qui a rattrape l'erreur est un agent qui LISAIT
la notice pour travailler — c'est le bon detecteur, et il a fonctionne.

### 16. Tous les boutons principaux de `pilabelle` etaient illisibles

**Symptome** — le passage d'accessibilite du bout en bout, a peine ecrit, a
echoue sur `pilabelle` pour de VRAIS defauts : `button { background:
var(--rose-300); color: var(--rose-700) }` donne un contraste de **2,31:1**, la
ou WCAG AA en exige 4,5. C'est le style par DEFAUT de tous les boutons
principaux de l'app — « Commencer », « Refaire la seance », « Prete ».
`button.secondaire` et le badge `.defi` : 2,46:1, meme cause. Et l'iframe video
de `vue-seance.js` n'avait aucun `title` : un lecteur d'ecran l'annonce muette.

**Cause** — rien ne le mesurait. L'app a un PRD, des tests unitaires a 56 % de
couverture navigateur, des revues de code — et personne ne peut voir un rapport
de contraste a l'oeil. C'est la definition meme de ce qu'un outil doit garder.

**Detecte par** — `CI`

**Action** — `rien` — corrige dans le meme geste, en reutilisant `--encre`, un
jeton deja present dans la palette et deja employe par `button.secondaire:hover`
sur ce meme fond : pas une couleur inventee, un choix deja fait ailleurs dans
l'app. Le partage d'autorite decide avec l'utilisateur s'applique tel quel — le
contraste est OBJECTIF, il se corrige sans demander ; ce qui releve du gout se
montre et se tranche.

C'est le premier defaut visible par un utilisateur que la nouvelle chaine
attrape, et il vivait en ligne depuis la mise en service de l'app.

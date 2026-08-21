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

### 17. Deux defauts d'`estran` que seul un ecran PLEIN pouvait montrer

**Symptome** — la premiere version du bout en bout d'estran ne savait tester que
l'etat degrade : sans reseau, l'app affiche ses messages d'indisponibilite, et
c'est tout ce qu'il y avait a voir. Le passage d'accessibilite y etait vert. Une
fois les sources rendues configurables et alimentees par un faux serveur local a
donnees FIXES, deux violations `serious` sont apparues sur la page pleine :
contraste de 4,26:1 (pour 4,5 requis) sur la ligne « aujourd'hui » de la
tendance, et la bande horizontale « Les prochaines heures », defilable a la
souris, inatteignable au clavier.

**Cause** — une page presque vide ne contient pas les elements qui fautent. Un
test d'accessibilite ne vaut que ce que vaut l'ecran qu'il regarde, et ca ne se
lit nulle part dans son resultat : il rend « 0 violation » avec la meme assurance
dans les deux cas.

**Detecte par** — `CI`

**Action** — `comportement` — rien a durcir dans l'outillage, mais une regle a
retenir pour les suites a venir : **un bout en bout qui ne sait produire que
l'etat degrade d'une app ne teste pas cette app**. Le detour par des donnees
connues coute une heure de plus et rapporte deux defauts que trois autres
garde-fous avaient laisses passer. Corriges : un jeton `--eau-300` plus clair
pour ce contexte, et `tabindex="0"` + `role="region"` + libelle sur la bande
horaire.

Piege note au passage, et qui vaut pour toute app a `go:embed` : modifier
`style.css` ou `index.html` sans RECONSTRUIRE le binaire laisse le scan relire
l'ancien contenu embarque. Le correctif parait alors sans effet.

### 18. Les deux suites Docker ne sont pas verifiables depuis cette session

**Symptome** — `ardoise` et `compteur` sont les deux seules apps dont le bout en
bout monte des conteneurs : elles ont vraiment une base et un cache. Leur
`lancer.sh` appelle `docker build` et `docker run`. Le demon Docker n'est PAS
joignable depuis cette session (`unix:///var/run/docker.sock` absent).

**Cause** — l'environnement d'execution, pas le depot.

**Detecte par** — `auteur`

**Action** — `rien` — le passage d'accessibilite leur a ete ajoute par la meme
forme que les huit autres, et leur `playwright.config.js` a recu la meme
correction du chemin de navigateur epingle. **Ces deux suites n'ont donc PAS ete
jouees ici** : c'est la CI qui les tranchera, au job `bout-en-bout`. Ecrit
plutot que taris — annoncer une verification qu'on n'a pas faite est le meme
defaut que tout le reste de cette branche a poursuivi, un cran au-dessus.

Le cas est note comme la limite du bout en bout natif : les huit apps sans
annexe se jouent partout, les deux qui en ont une dependent d'un demon. C'est
precisement pour cela que les huit autres ne passent PAS par Docker.

### 19. `E2E_OBLIGATOIRE` passe a 1 — l'absence de suite devient un refus

**Symptome** — sans objet : c'est le cran d'arret prevu quand le contrat du bout
en bout a ete pose, et le moment est venu.

**Cause** — les dix apps ont desormais leur `e2e/lancer.sh`. Ce qui etait un
avertissement — « rien ne verifie cette app dans un navigateur reel » — devient
un KO de `--check`.

**Detecte par** — `auteur`

**Action** — `contrat` — une app neuve ne peut plus naitre sans verification en
navigateur reel, et une suite supprimee ne peut plus l'etre en silence. Le cran
etait ecrit dans le code des le premier jour, avec sa condition de declenchement ;
il n'a pas eu besoin qu'on se souvienne de lui.

### 20. Le service worker de `ramure` rechargeait la page sous le nez du scan

**Symptome** — le passage d'accessibilite de `ramure` echouait chez moi et
passait chez son auteur, deux fois de suite. `AxeBuilder.analyze()` :
« Execution context was destroyed, most likely because of a navigation ». Onze
tests verts sur douze, dont un AUTRE test axe. Une course, gagnee ou perdue
selon la vitesse de la machine.

**Cause** — a la PREMIERE visite d'une origine, la page n'est pas encore
controlee par le service worker ; `self.clients.claim()` la fait passer sous
controle, et `ramure.js` repond a ce `controllerchange` par un `location.reload()`
inconditionnel — F-42, diffuser une mise a jour sans action manuelle. C'est une
vraie navigation, a un instant imprevisible, et chaque test part d'un contexte
navigateur neuf donc la subit. `analyze()` fait un `page.evaluate` PONCTUEL, qui
ne survit pas a une navigation ; `page.waitForFunction`, lui, reessaie.

**Detecte par** — `relecture`

**Action** — `comportement` — attendre l'etat STABLE apres chaque `page.goto` :
`waitForFunction(() => !("serviceWorker" in navigator) ||
!!navigator.serviceWorker.controller)`. La regle a retenir pour toute app a
service worker de la fabrique — il y en a d'autres — est qu'un scan
d'accessibilite ne s'appelle jamais sur une page qui peut encore se recharger.

Deux choses meritent d'etre notees sur la maniere. D'abord ce qui a ete REFUSE :
augmenter `retries`, poser un `waitForTimeout` au hasard, ou supprimer le test.
Les trois auraient rendu la suite verte sans rien regler, et le depot a deja
tranche qu'un test intermittent apprend a ignorer le rouge. Ensuite, chercher la
cause a paye deux fois : la meme verification a trouve un SECOND defaut sans
rapport — les tests F-36 attendaient l'apparition de `#etat-ecran` avec 15 s de
budget puis lisaient son attribut avec les 5 s par defaut, coupant l'attente en
deux fenetres inegales. Dix executions sur dix ports differents apres correctif,
12/12 a chaque fois ; avant correctif, la meme boucle tombait au cinquieme
passage.

### 21. Le garde-fou du PRD a crie sur les dix apps le meme jour

**Symptome** — les dix suites bout en bout ecrites, `pret.sh` a allume son
avertissement « du code neuf, et PRODUCT.md ne bouge pas » sur les dix apps a la
fois, en listant `e2e/lancer.sh`, `e2e/playwright.config.js`, `e2e/package.json`.

**Cause** — l'heuristique deduit « une capacite neuve est arrivee » de « un
fichier de code neuf est arrive », et exclut `.md` et `tests/` pour cette raison
exacte. `e2e/` n'existait pas quand elle a ete ecrite et n'y figurait pas.

**Detecte par** — `auteur`

**Action** — `garde-fou` — `e2e/` exclu au meme titre que `tests/`, et un
treizieme cas ajoute a `test-pret.sh` pour le tenir. Le commentaire du script
dit desormais pourquoi.

Ce qui compte ici n'est pas la ligne de correctif mais le risque evite : cet
avertissement est le SEUL garde-fou heuristique de la fabrique, et son propre
commentaire prevoit sa facon de mourir — « trop bavarde : elle se declenche sur
les corrections, on l'ignore, elle ne garde plus rien ». Crier sur dix apps le
meme jour est exactement ca. Un garde-fou qu'on apprend a ne plus lire est
perdu, et il ne previent pas qu'il l'est.

### 22. Le garde-fou UX, a peine ecrit, criait sur un fichier de configuration

**Symptome** — premier passage du controle de fraicheur de la critique UX :
trois apps reclamees, dont `ramure-v2`. Or les seuls fichiers touches sous son
`web/` sont `playwright.config.ts` et `tests/REFERENCE.md` — une configuration de
test et un document. Aucun ecran n'a bouge.

**Cause** — le motif prenait `apps/<nom>/web/` en ENTIER. Dans cette fabrique,
`web/` porte aussi les configurations, les tests et la documentation du client.

**Detecte par** — `auteur`

**Action** — `garde-fou` — liste d'exclusion explicite (`.md`, `tests/`,
`*.config.[jt]s`, `package*.json`, `tsconfig*.json`), la meme dans `pret.sh` et
dans la CI. Reste `estran` et `pilabelle`, dont les `.css` et `.html` ont
reellement bouge : ce sont exactement les deux apps ou des correctifs
d'accessibilite ont ete appliques.

C'est la deuxieme fois de la journee qu'un garde-fou neuf crie a tort, et la
lecon est la meme que pour l'avertissement du PRD : **un garde-fou trop bavard
meurt plus surement qu'un garde-fou absent**, parce qu'il donne l'illusion d'etre
la. Celui-ci s'est trompe au premier essai, sur la branche qui l'a ecrit — le
meilleur moment possible.

### 23. Le cinquieme vert silencieux, trouve par le relecteur sur sa premiere mission

**Symptome** — `axe_dependances` faisait
`npm audit --audit-level=high --json >"$aud" 2>"$aud.err" || true`, puis lisait
les compteurs `high` et `critical` avec `sed`, avec `0` en defaut. Quand npm ne
joint pas le registre — panne reseau, ECONNREFUSED, delai depasse, maintenance —
il ecrit un objet d'ERREUR sans champ `metadata`, et sort en 1. Les deux `sed` ne
trouvent rien, retombent sur zero, et l'axe annonce « aucune dependance
vulnerable » sans avoir audite quoi que ce soit.

**Cause** — le `|| true` est indispensable ici, puisque npm sort en 1 des qu'il
TROUVE quelque chose au-dela du seuil. C'est exactement pour cela qu'il ne
suffit pas : il avale aussi l'echec de l'outil, et les deux cas deviennent
indiscernables. La branche `govulncheck`, dix lignes plus haut dans la MEME
fonction, exige pourtant sa phrase de conclusion (« No vulnerabilities found »)
pour cette raison precise. La garde manquait du cote npm, et aucun cas de
`test-revue.sh` ne doublait `npm`.

**Detecte par** — `relecture`

**Action** — `garde-fou` — on exige desormais la PREUVE que l'audit a conclu,
`metadata.vulnerabilities`, avant de croire un zero ; sinon KO avec la sortie
d'erreur. Trois cas ajoutes a `test-revue.sh` avec une doublure `npm` : audit
sain, audit qui trouve, audit qui n'a pas conclu — les trois se distinguent mal
a l'oeil et pas du tout par un code de retour. La suite passe de 27 a 30 cas.

Ce qui merite d'etre note n'est pas le defaut mais QUI l'a trouve. L'agent
`relecteur`, sur sa toute premiere mission, lancee sur la branche qui venait de
l'ecrire, avec pour consigne « quatre verts silencieux ont deja ete corriges,
cherche le cinquieme ». Il l'a trouve, au bon endroit, avec la bonne gravite, et
en citant la regle de `memory/revue.md` que le code enfreignait — « jamais de
`|| true` qui couvre un pipeline entier ». La regle etait ecrite, et son auteur
l'avait quand meme violee vingt lignes plus loin. C'est tout l'interet d'un
relecteur qui n'est pas celui qui a ecrit.

### 24. Le correctif d'accessibilite d'`estran` avait cree un piege pire que le defaut

**Symptome** — la critique UX, lancee juste apres, a relu les deux correctifs du
matin. Les deux etaient justes et incomplets, et le second etait nuisible : la
bande « Les prochaines heures » avait recu `tabindex="0"`, `role="region"` et un
libelle annoncant qu'on la fait defiler aux fleches. **Les fleches faisaient
sauter au lendemain.** Deux pressions et l'utilisateur etait samedi sans l'avoir
demande ; le clavier n'atteignait jamais la troisieme vignette. Le libelle
promettait donc quelque chose que l'application ne faisait pas.

Second point, du meme ordre : le contraste corrige ne l'etait qu'au repos.
**Survoler n'importe quelle autre ligne de la tendance ramenait le defaut
exact** que le correctif visait. Un scan automatique ne survole rien.

**Detecte par** — `relecture`

**Action** — `comportement` — deux lecons, et la seconde vaut pour toute la
fabrique.

D'abord : **rendre un element focalisable ne le rend pas utilisable.** `axe` a
vu disparaitre sa violation et n'a rien eu a redire — il verifie qu'un element
est ATTEIGNABLE, jamais que ce qu'on y fait correspond a ce qu'on a annonce. Le
correctif satisfaisait le controle en degradant le produit.

Ensuite : **un controle automatique mesure un ETAT, pas un parcours.** Contraste
au repos, oui ; au survol, au focus, en cours d'animation, non. C'est
precisement la frontiere entre les deux relecteurs, et elle vient d'etre
demontree plutot que postulee : le bout en bout mesure ce qui se mesure,
l'esthete regarde ce qui se vit. Aucun des deux ne remplace l'autre.

### 25. Le cliquet a bloque une correction d'accessibilite de bonne foi

**Symptome** — l'esthete de `pilabelle` a corrige huit defauts reels, dont un
ecran de panne reseau qui manquait entierement, et ajoute `vue-erreur.js`. La
revue l'a refuse : couverture navigateur 53,44 % pour un plancher a 55 %.

**Cause** — du code neuf sans tests. Le cliquet ne fait aucune difference entre
du code neuf mal intentionne et du code neuf utile : il mesure, et il refuse la
baisse.

**Detecte par** — `CI`

**Action** — `rien` — le seuil n'a PAS ete desserre, et c'est tout l'interet de
l'avoir rendu difficile a bouger : la tentation etait reelle, le correctif etait
bon, et le desserrer aurait coute une ligne. L'agent a ete renvoye couvrir son
code — en lui interdisant explicitement d'ecrire des tests qui n'echouent jamais
pour faire monter un pourcentage.

C'est la premiere fois que le cliquet mord quelqu'un d'autre que son auteur, et
il fallait que ce soit sur un cas SYMPATHIQUE pour savoir s'il tiendrait.


### 26. Le garde-fou de fraicheur UX comparait deux horloges, et ne pouvait JAMAIS passer

**Symptome** — premier passage reel de la CI sur la pull request qui apporte ce
garde-fou. Le job `contrat` echoue :

```
ok    relecture de code consignee
::error:: les ecrans de estran ont bouge APRES sa derniere critique UX
          (2026-08-20T17-06-20Z__web-index-html.md). Relance l agent esthete.
::error:: les ecrans de pilabelle ont bouge APRES sa derniere critique UX
          (2026-08-20T17-00-23Z__web-parcours.md). Relance l agent esthete.
```

Les deux critiques venaient pourtant d'etre ecrites, et `pret.sh` les avait
annoncees « du jour » quelques minutes plus tot.

**Cause** — le controle comparait l'horodatage lu dans le NOM du fichier de
critique a la date du COMMIT qui a touche les ecrans. **On ecrit la critique,
puis on committe** : le commit est toujours posterieur, forcement, y compris
quand tout est fait dans le bon ordre. Le garde-fou etait donc rouge par
construction, et aucune branche touchant un ecran n'aurait pu fusionner.

Deux erreurs superposees, et la seconde est la vraie. La premiere : opposer deux
horloges qui ne mesurent pas la meme chose. La seconde, plus grave : `pret.sh`
et la CI verifiaient la meme regle par des MOYENS differents — « la critique
porte la date du jour » d'un cote, « la critique est posterieure au commit » de
l'autre. Deux implementations d'une meme regle divergent, et c'est celle qui ne
tourne qu'en CI qui a raison, donc celle qu'on decouvre le plus tard.

**Detecte par** — `CI`

**Action** — `garde-fou` — la regle devient une **coincidence de diff**, la meme
des deux cotes : si la branche touche les ecrans d'une app, elle doit AUSSI
toucher `apps/<app>/.impeccable/critique/`. Aucune date n'est comparee. Le diff
n'a pas d'horloge et ne ment pas.

C'est le TROISIEME garde-fou neuf de cette branche a crier a tort — apres
l'avertissement du PRD sur dix apps a la fois, et la critique reclamee a
`ramure-v2` pour un fichier de configuration. Les trois ont ete rattrapes le
jour meme, deux par moi et celui-ci par la CI, sur la pull request qui les
apportait. Ecrire un garde-fou et l'ecrire JUSTE sont deux choses differentes,
et seule la seconde compte — un garde-fou faux se contourne, puis se supprime,
et emporte avec lui la regle qu'il portait.

### 27. Une etape de CI n'est jamais lancee avant d'etre poussee — et c'est le probleme

**Symptome** — deuxieme echec du job `contrat` sur la meme PR, une seule ligne :
`base: unbound variable`. La reecriture de l'anomalie 26 avait supprime, avec le
bloc qu'elle remplacait, la ligne qui calculait `base`.

**Cause** — l'etape est ecrite en YAML, poussee, et decouverte a l'execution.
Rien dans la boucle de travail ne la joue avant. Deux echecs de suite sur le
meme job, pour deux causes differentes, sont le symptome de cette boucle-la et
pas de la difficulte du sujet.

Ce qui a SAUVE ce cas est `set -u`, present dans l'etape : sans lui, `base`
aurait valu la chaine vide, `git diff "" HEAD` aurait compare autre chose, et le
controle serait passe au VERT en n'ayant rien verifie. Encore un vert silencieux
evite — par une option de trois caracteres.

**Detecte par** — `CI`

**Action** — `comportement` — l'etape se joue desormais EN LOCAL avant d'etre
poussee : on l'extrait du YAML, on remplace les expressions `${{ }}` par des
valeurs reelles, et on la lance sur trois cas — corps de PR correct, section
absente, gabarit non rempli. Les trois verifies avant la poussee suivante.

Rien a automatiser ici : c'est la lecon qui compte, et elle vaut pour toute
etape de workflow un peu longue. Une etape de CI est du code que personne ne
teste, dans un langage sans compilateur, executee dans un environnement qu'on
n'a pas sous la main. Deux tours de CI pour deux fautes triviales coutent plus
cher que dix minutes de mise sous bac a sable.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-21 à 10:34 UTC, sur 3 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 11 412 | 0,01 $ |
| Écriture de cache | 5 660 358 | 24,56 $ |
| Lecture de cache | 244 957 015 | 108,04 $ |
| Sortie | 475 934 | 9,89 $ |
| **Total** | **251 104 719** | **142,50 $ — 123,76 €** |

**Ce qui coûte**

- **1604 appel(s) au modèle** — un par réponse, outils compris —, dont 1052 par des sous-agents — 85 385 836 jetons, 41,99 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  96 140 jetons, écrits une fois par session puis relus à chaque
  échange : 35 113 676 jetons de relecture, 14 % de tout ce qui a été relu.
- **Tours courts** — 1 045 des 1 604 tours (65 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 71,36 $, soit 50 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 65 847 jetons relus au premier appel qui relise
  quelque chose, 184 156 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 251104719 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 65847 0 755
2 principal claude-opus-5 7118 65847 285
3 principal claude-opus-5 3536 72965 223
4 principal claude-opus-5 5441 76501 141
5 principal claude-opus-5 3478 81942 157
6 principal claude-opus-5 3070 85420 339
7 principal claude-opus-5 2360 88490 379
8 principal claude-opus-5 4234 90850 1678
9 principal claude-opus-5 4011 95084 2870
10 principal claude-opus-5 3583 99095 2917
11 principal claude-opus-5 3026 102678 817
12 principal claude-opus-5 66 106521 503
13 principal claude-opus-5 1948 106587 2130
14 principal claude-opus-5 6656 110665 433
15 principal claude-opus-5 4265 117321 110
16 principal claude-opus-5 1354 121586 1360
17 principal claude-opus-5 1684 122940 13344
18 principal claude-opus-5 13537 124624 404
19 principal claude-opus-5 1237 138161 321
20 principal claude-opus-5 379 139398 80
21 principal claude-opus-5 413 139777 1245
22 principal claude-opus-5 1448 140190 1258
23 principal claude-opus-5 6643 142896 415
24 principal claude-opus-5 692 149539 503
25 principal claude-opus-5 620 150231 294
26 principal claude-opus-5 399 150851 2161
27 principal claude-opus-5 2320 151250 323
28 principal claude-opus-5 454 153570 1178
29 principal claude-opus-5 1321 154024 285
30 principal claude-opus-5 583 155345 385
31 principal claude-opus-5 481 155928 290
32 principal claude-opus-5 9848 156409 203
33 principal claude-opus-5 470 166257 473
34 principal claude-opus-5 815 166727 447
35 principal claude-opus-5 566 167542 237
36 principal claude-opus-5 317 168108 420
37 principal claude-opus-5 626 168425 631
38 principal claude-opus-5 770 169051 192
39 principal claude-opus-5 272 169821 844
40 principal claude-opus-5 1471 170093 198
41 principal claude-opus-5 528 171564 353
42 principal claude-opus-5 2455 172092 487
43 principal claude-opus-5 1021 174547 496
44 principal claude-opus-5 1454 175568 593
45 principal claude-opus-5 1621 177022 1010
46 principal claude-opus-5 1822 178643 981
47 principal claude-opus-5 1770 180465 2873
48 principal claude-opus-5 2892 182235 3602
49 principal claude-opus-5 3892 185127 1678
50 principal claude-opus-5 1865 189019 1232
51 principal claude-opus-5 6649 192116 526
52 principal claude-opus-5 1819 198765 13241
53 principal claude-opus-5 13441 200584 1122
54 principal claude-opus-5 1221 214025 1531
55 principal claude-opus-5 1606 215246 2357
56 principal claude-opus-5 6744 216852 1123
57 principal claude-opus-5 1154 223596 377
58 principal claude-opus-5 639 224750 547
59 principal claude-opus-5 818 225389 129
60 principal claude-opus-5 192 226207 65
61 principal claude-opus-5 601 226399 689
62 principal claude-opus-5 1211 227000 1341
63 principal claude-opus-5 1651 228211 3358
64 principal claude-opus-5 3790 229862 273
65 principal claude-opus-5 912 233652 902
66 principal claude-opus-5 1247 234564 412
67 principal claude-opus-5 546 235811 677
68 principal claude-opus-5 827 236357 7518
69 principal claude-opus-5 7588 237184 115
70 principal claude-opus-5 1518 244772 1974
71 principal claude-opus-5 6645 246290 1770
72 principal claude-opus-5 1855 252935 205
73 principal claude-opus-5 335 254790 187
74 principal claude-opus-5 1224 255125 129
75 principal claude-opus-5 1130 256349 62
76 principal claude-opus-5 2632 257479 1962
77 principal claude-opus-5 2639 260111 436
78 principal claude-opus-5 475 262750 596
79 principal claude-opus-5 878 263225 370
80 principal claude-opus-5 549 264103 441
81 principal claude-opus-5 3378 264652 226
82 principal claude-opus-5 367 268030 87
83 principal claude-opus-5 5119 264103 244
84 principal claude-opus-5 1117 269222 1472
85 principal claude-opus-5 1719 270339 572
86 principal claude-opus-5 1126 272058 436
87 principal claude-opus-5 514 273184 914
88 principal claude-opus-5 1101 273698 1462
89 principal claude-opus-5 1562 274799 1509
90 principal claude-opus-5 2481 276361 818
91 principal claude-opus-5 926 278842 1815
92 principal claude-opus-5 1946 279768 259
93 principal claude-opus-5 541 281714 346
94 principal claude-opus-5 508 282255 974
95 principal claude-opus-5 1453 282763 58
96 principal claude-opus-5 2681 284216 147
97 principal claude-opus-5 703 286897 608
98 principal claude-opus-5 813 287600 2292
99 principal claude-opus-5 2486 288413 593
100 principal claude-opus-5 1497 290899 228
101 principal claude-opus-5 693 292396 242
102 principal claude-opus-5 686 293089 220
103 principal claude-opus-5 1103 293775 1245
104 principal claude-opus-5 1422 294878 1338
105 principal claude-opus-5 1741 296300 459
106 principal claude-opus-4-7 5929 29200 203
107 principal claude-opus-4-7 489 35129 77
108 principal claude-opus-4-7 185 35618 82
109 principal claude-opus-4-7 13410 35803 554
110 principal claude-opus-5 252659 46716 780
111 principal claude-opus-5 1933 299375 343
112 principal claude-opus-5 702 301308 67
113 principal claude-opus-5 1246 302010 215
114 principal claude-opus-5 1374 303256 184
115 principal claude-opus-5 1167 304630 1849
116 principal claude-opus-5 1890 305797 767
117 principal claude-opus-5 827 307687 1832
118 principal claude-opus-5 2219 308514 295
119 principal claude-opus-5 361 310733 773
120 principal claude-opus-5 1717 311094 6167
121 principal claude-opus-5 9702 312811 600
122 principal claude-opus-5 1219 322513 832
123 principal claude-opus-5 1223 323732 703
124 principal claude-opus-5 930 324955 913
125 principal claude-opus-5 1046 325885 254
126 principal claude-opus-5 553 326931 1385
127 principal claude-opus-5 1682 327484 413
128 principal claude-opus-5 695 329166 594
129 principal claude-opus-5 2808 329861 1931
130 principal claude-opus-5 3655 332669 1172
131 principal claude-opus-5 1203 336324 660
132 principal claude-opus-5 10684 329861 478
133 principal claude-opus-5 553 340545 236
134 principal claude-opus-5 317 341098 4964
135 principal claude-opus-5 9769 341415 4114
136 principal claude-opus-5 4184 351184 440
137 principal claude-opus-5 534 355368 229
138 principal claude-opus-5 649 355902 563
139 principal claude-opus-5 748 356551 286
140 principal claude-opus-5 2320 357299 346
141 principal claude-opus-5 602 359619 385
142 principal claude-opus-5 1999 360221 74
143 principal claude-opus-5 893 362220 1138
144 principal claude-opus-5 1179 363113 568
145 principal claude-opus-5 1379 364292 1033
146 principal claude-opus-5 1371 365671 471
147 principal claude-opus-5 4329 367042 249
148 principal claude-opus-5 458 371371 772
149 principal claude-opus-5 845 371829 2187
150 principal claude-opus-5 2380 372674 1682
151 principal claude-opus-5 1823 375054 803
152 principal claude-opus-5 901 376877 662
153 principal claude-opus-5 818 377778 337
154 principal claude-opus-5 613 378596 86
155 principal claude-opus-5 125 379209 293
156 principal claude-opus-5 585 379334 485
157 principal claude-opus-5 533 379919 178
158 principal claude-opus-5 862 380452 1572
159 principal claude-opus-5 1865 381314 1750
160 principal claude-opus-5 1958 383179 419
161 principal claude-opus-5 555 385137 1087
162 principal claude-opus-5 1176 385692 1552
163 principal claude-opus-5 1879 386868 441
164 principal claude-opus-5 519 388747 1536
165 principal claude-opus-5 1787 389266 346
166 principal claude-opus-5 426 391053 127
167 principal claude-opus-5 672 391479 142
168 principal claude-opus-5 1143 392151 249
169 principal claude-opus-5 429 393294 615
170 principal claude-opus-5 1144 393723 1783
171 principal claude-opus-5 1814 394867 104
172 principal claude-opus-5 436 396681 171
173 principal claude-opus-5 810 397117 2913
174 principal claude-opus-5 3302 397927 709
175 principal claude-opus-5 991 401229 129
176 principal claude-opus-5 382 402220 94
177 principal claude-opus-4-7 22391 29200 118
178 principal claude-opus-4-7 206 51591 93
179 principal claude-opus-4-7 201 51797 98
180 principal claude-opus-4-7 265 51998 82
181 principal claude-opus-4-7 15159 52263 153
182 principal claude-opus-4-7 3807 67422 92
183 principal claude-opus-4-7 2721 71229 95
184 principal claude-opus-5 1428 402220 950
185 principal claude-opus-4-7 768 73950 92
186 principal claude-opus-4-7 1880 74718 87
187 principal claude-opus-4-7 2125 76598 523
188 principal claude-opus-5 2344 403648 614
189 principal claude-opus-4-7 1457 78723 129
190 principal claude-opus-4-7 1647 80180 85
191 principal claude-opus-4-7 7836 81827 213
192 principal claude-opus-5 720 405992 344
193 principal claude-opus-4-7 1676 89663 133
194 principal claude-opus-4-7 1406 91339 91
195 principal claude-opus-4-7 1350 92745 128
196 principal claude-opus-4-7 5641 94095 253
197 principal claude-opus-5 541 406712 1799
198 principal claude-opus-4-7 6870 99736 2152
199 principal claude-opus-5 1810 407253 898
200 principal claude-opus-5 1127 409063 4117
201 principal claude-opus-5 5453 410190 4829
202 principal claude-opus-5 9716 415643 1269
203 principal claude-opus-5 1538 425359 144
204 principal claude-opus-5 470 426897 2312
205 principal claude-opus-5 2447 427367 208
206 principal claude-opus-5 395 429814 131
207 principal claude-opus-5 333 430209 193
208 principal claude-opus-5 852 430542 896
209 principal claude-opus-5 2960 431394 683
210 principal claude-opus-5 965 434354 69
211 principal claude-opus-5 283 435319 164
212 principal claude-opus-5 2750 435319 635
213 principal claude-opus-5 2294 438069 1132
214 principal claude-opus-5 1252 440363 190
215 principal claude-opus-5 472 441615 499
216 principal claude-opus-5 884 442087 544
217 principal claude-opus-5 911 442971 2379
218 principal claude-opus-4-7 30793 29200 828
219 principal claude-opus-5 4743 443882 1238
220 principal claude-opus-5 1340 448625 418
221 principal claude-opus-4-7 24463 59993 4999
222 principal claude-opus-5 11613 442087 1115
223 principal claude-opus-5 1152 453700 628
224 principal claude-opus-4-7 5246 84456 2331
225 principal claude-opus-4-7 31041 29200 3514
226 principal claude-opus-5 2943 454852 1533
227 principal claude-opus-5 1787 457795 2157
228 principal claude-opus-5 2834 459582 514
229 principal claude-opus-4-7 17058 29200 1811
230 principal claude-opus-4-7 1897 46258 96
231 principal claude-opus-5 796 462416 146
232 principal claude-opus-4-7 273 48155 91
233 principal claude-opus-4-7 1848 48428 205
234 principal claude-opus-5 301 463212 168
235 principal claude-opus-4-7 1320 50276 1661
236 principal claude-opus-4-7 1902 51596 128
237 principal claude-opus-4-7 1966 53498 953
238 principal claude-opus-4-7 1020 55464 79
239 principal claude-opus-4-7 321 56484 76
240 principal claude-opus-4-7 288 56805 302
241 principal claude-opus-4-7 717 57093 199
242 principal claude-opus-4-7 677 57810 334
243 principal claude-opus-4-7 656 58487 2201
244 principal claude-opus-5 3168 463212 468
245 principal claude-opus-5 560 466380 966
246 principal claude-opus-5 1023 466940 1872
247 principal claude-opus-4-7 17403 29200 156
248 principal claude-opus-4-7 13305 46603 73
249 principal claude-opus-4-7 5334 59908 74
250 principal claude-opus-4-7 5907 65242 172
251 principal claude-opus-4-7 544 71149 118
252 principal claude-opus-5 2123 467963 325
253 principal claude-opus-5 607 470086 98
254 principal claude-opus-4-7 810 71693 2458
255 principal claude-opus-4-7 5059 72503 1245
256 principal claude-opus-5 2652 470693 1127
257 principal claude-opus-5 1359 473345 302
258 principal claude-opus-5 1655 474704 1487
259 principal claude-opus-5 1613 476359 395
260 principal claude-opus-5 802 477972 1034
261 principal claude-opus-5 1108 478774 825
262 principal claude-opus-5 1074 479882 308
263 principal claude-opus-5 607 480956 439
264 principal claude-opus-5 761 481563 898
265 principal claude-opus-5 929 482324 282
266 principal claude-opus-5 564 483253 140
267 principal claude-opus-5 431 483817 186
268 principal claude-opus-5 358 484248 1783
269 principal claude-opus-4-7 6955 29200 103
270 principal claude-opus-4-7 189 36155 93
271 principal claude-opus-4-7 270 36344 92
272 principal claude-opus-5 2171 484606 276
273 principal claude-opus-4-7 862 36614 91
274 principal claude-opus-4-7 651 37476 97
275 principal claude-opus-4-7 2160 38127 95
276 principal claude-opus-4-7 1382 40287 87
277 principal claude-opus-4-7 2337 41669 159
278 principal claude-opus-4-7 4608 44006 88
279 principal claude-opus-4-7 304 48614 1211
280 principal claude-opus-4-7 1546 48918 122
281 principal claude-opus-4-7 1566 50464 1089
282 principal claude-opus-5 5407 483817 380
283 principal claude-opus-5 470 489224 1030
284 principal claude-opus-5 1386 489694 1029
285 principal claude-opus-5 1084 491080 423
286 principal claude-opus-5 517 492164 690
287 principal claude-opus-5 836 492681 1059
288 principal claude-opus-5 1272 493517 385
289 principal claude-opus-5 613 494789 637
290 principal claude-opus-5 692 495402 108
291 principal claude-opus-5 259 496094 499
292 principal claude-opus-5 554 496353 2194
293 principal claude-opus-5 2720 496907 413
294 principal claude-opus-5 695 499627 71
295 principal claude-opus-5 259 500322 78
296 principal claude-opus-4-7 20791 29200 837
297 principal claude-opus-4-7 923 49991 96
298 principal claude-opus-4-7 273 50914 83
299 principal claude-opus-4-7 3599 51187 85
300 principal claude-opus-4-7 8010 54786 86
301 principal claude-opus-5 1191 500322 2740
302 principal claude-opus-4-7 5024 62796 2501
303 principal claude-opus-4-7 3289 67820 82
304 principal claude-opus-4-7 5882 71109 1479
305 principal claude-opus-5 2816 501513 2664
306 principal claude-opus-5 2739 504329 116
307 principal claude-opus-5 497 507068 699
308 principal claude-opus-5 732 507565 377
309 principal claude-opus-5 1306 508297 2279
310 principal claude-opus-5 2444 509603 1136
311 principal claude-opus-5 1191 512047 75
312 principal claude-opus-5 1241 513238 1110
313 principal claude-opus-5 1199 514479 543
314 principal claude-opus-5 582 515678 336
315 principal claude-opus-5 733 516260 1434
316 principal claude-opus-5 1583 516993 856
317 principal claude-opus-5 892 518576 2251
318 principal claude-opus-5 2643 519468 591
319 principal claude-opus-5 873 522111 114
320 principal claude-opus-5 444 522984 57
321 principal claude-opus-4-7 7074 29200 196
322 principal claude-opus-5 1887 522984 2812
323 principal claude-opus-5 3617 524871 1424
324 principal claude-opus-5 1819 528488 310
325 principal claude-opus-5 1594 530617 445
326 principal claude-opus-5 737 532211 1137
327 principal claude-opus-5 1176 532948 1737
328 principal claude-opus-5 2006 534124 1202
329 principal claude-opus-5 1328 536130 322
330 principal claude-opus-5 604 537458 1810
331 principal claude-opus-4-7 6152 29200 115
332 principal claude-opus-4-7 228 35352 82
333 principal claude-opus-4-7 15637 35580 128
334 principal claude-opus-5 2170 538062 57
335 principal claude-opus-4-7 10002 51217 1425
336 principal claude-opus-4-7 9221 61219 6073
337 principal claude-opus-4-7 6210 70440 1162
338 principal claude-opus-5 4285 538062 538
339 principal claude-opus-5 620 542347 119
340 principal claude-opus-5 388 542967 1528
341 principal claude-opus-5 1638 543355 1069
342 principal claude-opus-5 1351 544993 147
343 principal claude-opus-5 2109 546344 361
344 principal claude-opus-5 547 548453 1375
345 principal claude-opus-5 1406 549000 1915
346 principal claude-opus-4-7 6609 29200 492
347 principal claude-opus-4-7 6930 35809 173
348 principal claude-opus-5 2180 550406 617
349 principal claude-opus-4-7 4710 42739 1084
350 principal claude-opus-5 899 552586 132
351 principal claude-opus-5 1999 553485 411
352 principal claude-opus-5 664 555484 657
353 principal claude-opus-5 845 556148 349
354 principal claude-opus-5 631 556993 175
355 principal claude-opus-5 347 557624 97
356 principal claude-opus-5 1173 557624 204
357 principal claude-opus-5 607 558797 256
358 principal claude-opus-5 732 559404 707
359 principal claude-opus-5 820 560136 89
360 principal claude-opus-5 598 560956 825
361 principal claude-opus-5 1136 561554 386
362 principal claude-opus-5 1031 562690 144
363 principal claude-opus-5 456 563721 2241
364 principal claude-opus-5 2630 564177 340
365 principal claude-opus-5 622 566807 76
366 principal claude-opus-5 135 567429 95
367 principal claude-opus-5 1054 567429 321
368 principal claude-opus-4-7 21927 29200 2495
369 principal claude-opus-4-7 2613 51127 87
370 principal claude-opus-4-7 1664 53740 92
371 principal claude-opus-4-7 705 55404 89
372 principal claude-opus-5 739 568483 2562
373 principal claude-opus-4-7 491 56109 92
374 principal claude-opus-4-7 2612 56600 91
375 principal claude-opus-4-7 1831 59212 91
376 principal claude-opus-5 3172 569222 271
377 principal claude-opus-4-7 2160 61043 161
378 principal claude-opus-5 1783 572394 137
379 principal claude-opus-5 1126 574177 1101
380 principal claude-opus-4-7 512 63203 2261
381 principal claude-opus-5 1585 575303 257
382 principal claude-opus-5 2713 576888 1771
383 principal claude-opus-5 1810 579601 1093
384 principal claude-opus-5 1148 581411 1154
385 principal claude-opus-5 1409 582559 1179
386 principal claude-opus-5 1707 583968 464
387 principal claude-opus-5 746 585675 92
388 principal claude-opus-5 214 586421 85
389 principal claude-opus-4-7 6627 29200 224
390 principal claude-opus-5 1175 586421 200
391 principal claude-opus-4-7 23601 35827 1548
392 principal claude-opus-5 497 587596 508
393 principal claude-opus-5 1010 588093 160
394 principal claude-opus-5 1395 589103 124
395 principal claude-opus-5 171 590498 160
396 principal claude-opus-4-7 9956 59428 3205
397 principal claude-opus-5 3850 590669 937
398 principal claude-opus-5 1139 594519 471
399 principal claude-opus-5 838 595658 913
400 principal claude-opus-4-7 3355 69384 5141
401 principal claude-opus-5 949 596496 984
402 principal claude-opus-4-7 3833 29200 188
403 principal claude-opus-5 1195 597445 331
404 principal claude-opus-4-7 23532 33033 3978
405 principal claude-opus-4-7 4057 29200 190
406 principal claude-opus-5 454 598971 223
407 principal claude-opus-5 3031 599425 810
408 principal claude-opus-5 1174 602456 183
409 principal claude-opus-5 483 603630 918
410 principal claude-opus-4-7 23534 33257 6567
411 principal claude-opus-5 2182 604113 255
412 principal claude-opus-4-7 31967 0 137
413 principal claude-opus-5 1683 606295 160
414 principal claude-opus-5 2227 607978 475
415 principal claude-opus-5 650 610205 560
416 principal claude-opus-5 721 610855 357
417 principal claude-opus-5 559 611576 524
418 principal claude-opus-5 790 612135 660
419 principal claude-opus-5 1138 612925 97
420 principal claude-opus-5 224 614063 916
421 principal claude-opus-5 1588 614287 492
422 principal claude-opus-5 639 615875 112
423 principal claude-opus-5 684 616514 1513
424 principal claude-opus-5 1907 617198 370
425 principal claude-opus-5 652 619105 106
426 principal claude-opus-5 998 619757 263
427 principal claude-opus-5 6663 620755 633
428 principal claude-opus-5 2249 627418 1946
429 principal claude-opus-5 2033 629667 45
430 principal claude-opus-5 813 631700 245
431 principal claude-opus-5 756 632513 469
432 principal claude-opus-5 540 633269 365
433 principal claude-opus-5 4783 631745 477
434 principal claude-opus-5 549 636528 105
435 principal claude-opus-5 385 637077 109
436 principal claude-opus-5 366 637462 3153
437 principal claude-opus-5 3547 637828 612
438 principal claude-opus-5 894 641375 71
439 principal claude-opus-5 240 642269 110
440 principal claude-opus-4-7 5426 29200 722
441 principal claude-opus-4-7 1028 34626 347
442 principal claude-opus-5 1257 642269 311
443 principal claude-opus-4-7 3694 35654 1228
444 principal claude-opus-5 370 643526 852
445 principal claude-opus-5 902 644748 250
446 principal claude-opus-5 494 645650 297
447 principal claude-opus-5 1988 646144 267
448 principal claude-opus-5 2354 648132 181
449 principal claude-opus-5 2139 650486 342
450 principal claude-opus-5 2315 652625 632
451 principal claude-opus-5 29900 37470 0
452 principal claude-opus-5 716 67370 0
453 principal claude-opus-5 4302 68086 0
454 principal claude-opus-5 4251 72388 0
455 principal claude-opus-5 348 76639 0
456 principal claude-opus-5 2787 76987 0
457 principal claude-opus-5 454 79774 0
458 principal claude-opus-5 4941 80228 0
459 principal claude-opus-5 3194 85169 0
460 principal claude-opus-5 4631 88363 0
461 principal claude-opus-5 591 92994 0
462 principal claude-opus-5 293 93585 0
463 principal claude-opus-5 394 93878 0
464 principal claude-opus-5 2006 94272 0
465 principal claude-opus-5 347 96278 0
466 principal claude-opus-5 977 96625 0
467 principal claude-opus-5 563 97602 0
468 principal claude-opus-5 1709 98165 0
469 principal claude-opus-5 552724 0 1662
470 principal claude-opus-5 1906 552724 1235
471 principal claude-opus-5 1302 554630 1853
472 principal claude-opus-5 2244 555932 581
473 principal claude-opus-5 863 558176 176
474 principal claude-opus-5 416 559039 48
475 principal claude-opus-5 1290 559039 120
476 principal claude-opus-5 185 560329 909
477 principal claude-opus-5 132355 0 278
478 principal claude-opus-5 340 132355 103
479 principal claude-opus-5 1420 132695 135
480 principal claude-opus-5 589 134115 172
481 principal claude-opus-5 1418 134704 108
482 principal claude-opus-5 568 136122 274
483 principal claude-opus-5 728 136690 211
484 principal claude-opus-5 345 137418 386
485 principal claude-opus-5 539 137763 105
486 principal claude-opus-5 690 138302 663
487 principal claude-opus-5 1491 138992 1178
488 principal claude-opus-5 1717 140483 353
489 principal claude-opus-5 444 142200 613
490 principal claude-opus-5 7615 143257 1249
491 principal claude-opus-5 1519 150872 757
492 principal claude-opus-5 1146 152391 2857
493 principal claude-opus-5 50 156394 992
494 principal claude-opus-5 1605 156444 324
495 principal claude-opus-5 1282 158049 1123
496 principal claude-opus-5 1168 159331 105
497 principal claude-opus-5 2205 160499 845
498 principal claude-opus-5 921 162704 1204
499 principal claude-opus-5 1601 163625 619
500 principal claude-opus-5 901 165226 250
501 principal claude-opus-5 376 166127 312
502 principal claude-opus-5 3768 166503 255
503 principal claude-opus-5 354 170271 100
504 principal claude-opus-5 5516 166127 151
505 principal claude-opus-5 803 171643 539
506 principal claude-opus-5 349 172985 30
507 principal claude-opus-5 709 173334 397
508 principal claude-opus-5 907 174043 160
509 principal claude-opus-5 3951 174950 1183
510 principal claude-opus-5 1630 178901 389
511 principal claude-opus-5 739 180531 991
512 principal claude-opus-5 1343 181270 377
513 principal claude-opus-5 1123 182613 1286
514 principal claude-opus-5 3999 183736 3272
515 principal claude-opus-5 3676 187735 252
516 principal claude-opus-5 450 191411 1030
517 principal claude-opus-5 1391 192891 497
518 principal claude-opus-5 602 194282 116
519 principal claude-opus-5 525 195002 1064
520 principal claude-opus-5 1189 195527 563
521 principal claude-opus-5 30293 38013 653
522 principal claude-opus-5 3079 68306 293
523 principal claude-opus-5 4093 71385 386
524 principal claude-opus-5 1321 75478 144
525 principal claude-opus-5 2230 76799 366
526 principal claude-opus-5 1003 79385 973
527 principal claude-opus-5 1659 80388 6910
528 principal claude-opus-5 8629 82047 418
529 principal claude-opus-5 1022 90676 658
530 principal claude-opus-5 9072 92356 680
531 principal claude-opus-5 13509 102108 456
532 principal claude-opus-5 15151 115617 494
533 principal claude-opus-5 9413 130768 2047
534 principal claude-opus-5 3937 140181 249
535 principal claude-opus-5 2536 144118 173
536 principal claude-opus-5 966 146654 1286
537 principal claude-opus-5 3212 147620 4244
538 principal claude-opus-5 4598 150832 450
539 principal claude-opus-5 1710 155430 329
540 principal claude-opus-5 998 157140 664
541 principal claude-opus-5 1446 158138 882
542 principal claude-opus-5 1023 159584 7886
543 principal claude-opus-5 8068 160607 3133
544 principal claude-opus-5 3164 168675 1578
545 principal claude-opus-5 1715 171839 391
546 principal claude-opus-5 855 173554 801
547 principal claude-opus-5 870 174409 729
548 principal claude-opus-5 2381 175279 235
549 principal claude-opus-5 1380 177660 3956
550 principal claude-opus-5 3994 179040 1006
551 principal claude-opus-5 1122 183034 614
552 principal claude-opus-5 1342 184156 341
553 agent claude-haiku-4-5-20251001 12845 0 4
554 agent claude-haiku-4-5-20251001 1502 12845 2
555 agent claude-haiku-4-5-20251001 610 14347 1
556 agent claude-haiku-4-5-20251001 404 14957 1
557 agent claude-haiku-4-5-20251001 16043 0 2
558 agent claude-haiku-4-5-20251001 830 16043 2
559 agent claude-haiku-4-5-20251001 725 16873 4
560 agent claude-haiku-4-5-20251001 1409 17598 3
561 agent claude-haiku-4-5-20251001 296 19007 2
562 agent claude-haiku-4-5-20251001 225 19303 2
563 agent claude-opus-5 13868 17190 1
564 agent claude-opus-5 4698 31058 1
565 agent claude-opus-5 3235 35756 5
566 agent claude-opus-5 10015 38991 3
567 agent claude-opus-5 5721 49006 3
568 agent claude-opus-5 5621 54727 8
569 agent claude-opus-5 2274 60348 5
570 agent claude-opus-5 800 62622 3
571 agent claude-opus-5 2258 63422 3
572 agent claude-opus-5 460 65680 0
573 agent claude-opus-5 4178 66140 5
574 agent claude-opus-5 199 70318 6
575 agent claude-opus-5 852 70517 3
576 agent claude-opus-5 613 71369 17
577 agent claude-opus-5 789 71982 17
578 agent claude-opus-5 2724 72771 3
579 agent claude-opus-5 2216 75495 2
580 agent claude-opus-5 2691 77711 17
581 agent claude-opus-5 3520 80402 3
582 agent claude-opus-5 2736 83922 20
583 agent claude-opus-5 3348 86658 4
584 agent claude-opus-5 2035 90006 3
585 agent claude-opus-5 2791 92041 2
586 agent claude-opus-5 1052 94832 2
587 agent claude-opus-5 655 95884 0
588 agent claude-opus-5 227 96539 17
589 agent claude-opus-5 2154 96766 2
590 agent claude-opus-5 1475 98920 10
591 agent claude-opus-5 4318 100395 2
592 agent claude-opus-5 1613 104713 17
593 agent claude-opus-5 1556 106326 2
594 agent claude-opus-5 2005 107882 20
595 agent claude-opus-5 1014 109887 2
596 agent claude-opus-5 2541 110901 17
597 agent claude-opus-5 809 113442 3
598 agent claude-opus-5 1991 114251 2
599 agent claude-opus-5 1108 116242 17
600 agent claude-opus-5 1040 117350 3
601 agent claude-opus-5 1170 118390 3
602 agent claude-opus-5 1240 119560 20
603 agent claude-opus-5 415 120800 3
604 agent claude-opus-5 5090 121215 2
605 agent claude-opus-5 1266 126305 21
606 agent claude-opus-5 543 127571 17
607 agent claude-opus-5 910 128114 17
608 agent claude-opus-5 447 129024 16
609 agent claude-opus-5 552 129471 4
610 agent claude-opus-5 1118 130023 3
611 agent claude-opus-5 636 131141 17
612 agent claude-opus-5 706 131777 4
613 agent claude-opus-5 887 132483 4
614 agent claude-opus-5 836 133370 4
615 agent claude-opus-5 584 134206 20
616 agent claude-opus-5 405 134790 17
617 agent claude-opus-5 5031 135195 3
618 agent claude-opus-5 1417 140226 3
619 agent claude-opus-5 1228 141643 17
620 agent claude-opus-5 1296 142871 3
621 agent claude-opus-5 660 144167 5
622 agent claude-opus-5 286 144827 0
623 agent claude-opus-5 906 145113 16
624 agent claude-opus-5 1622 146019 2
625 agent claude-opus-5 1266 147641 9
626 agent claude-opus-5 890 148907 3
627 agent claude-opus-5 1038 149797 20
628 agent claude-opus-5 434 150835 2
629 agent claude-opus-5 486 151269 17
630 agent claude-opus-5 645 151755 2
631 agent claude-opus-5 4909 152400 2
632 agent claude-opus-5 17051 157309 17
633 agent claude-opus-5 608 174360 4
634 agent claude-opus-5 645 174968 21
635 agent claude-opus-5 1785 175613 3
636 agent claude-opus-5 6109 177398 14
637 agent claude-opus-5 623 183507 3
638 agent claude-opus-5 770 184130 6
639 agent claude-opus-5 201 184900 16
640 agent claude-opus-5 6536 185101 5
641 agent claude-opus-5 750 191637 17
642 agent claude-opus-5 1018 192387 3
643 agent claude-opus-5 829 193405 17
644 agent claude-opus-5 191 194234 1
645 agent claude-sonnet-5 10179 7828 2
646 agent claude-sonnet-5 4180 18007 2
647 agent claude-sonnet-5 308 22187 2
648 agent claude-sonnet-5 409 22495 20
649 agent claude-sonnet-5 394 22904 2
650 agent claude-sonnet-5 188 23298 0
651 agent claude-sonnet-5 820 23486 2
652 agent claude-sonnet-5 399 24306 5
653 agent claude-sonnet-5 866 24705 1
654 agent claude-sonnet-5 199 25571 20
655 agent claude-sonnet-5 142 25770 1
656 agent claude-sonnet-5 6975 11475 4
657 agent claude-sonnet-5 3724 18450 4
658 agent claude-sonnet-5 2748 22174 2
659 agent claude-sonnet-5 749 24922 2
660 agent claude-sonnet-5 2387 25671 20
661 agent claude-sonnet-5 1393 28058 5
662 agent claude-sonnet-5 1647 29451 2
663 agent claude-sonnet-5 1991 31098 3
664 agent claude-sonnet-5 708 33089 8
665 agent claude-sonnet-5 2348 33797 7
666 agent claude-sonnet-5 3499 36145 3
667 agent claude-sonnet-5 1063 39644 4
668 agent claude-sonnet-5 1060 40707 3
669 agent claude-sonnet-5 716 41767 0
670 agent claude-sonnet-5 421 42483 9
671 agent claude-sonnet-5 3680 42904 8
672 agent claude-sonnet-5 2021 46584 5
673 agent claude-sonnet-5 881 48605 5
674 agent claude-sonnet-5 365 49486 2
675 agent claude-sonnet-5 681 49851 4
676 agent claude-sonnet-5 6121 50532 2
677 agent claude-sonnet-5 1211 56653 2
678 agent claude-sonnet-5 2884 57864 2
679 agent claude-sonnet-5 229 60748 20
680 agent claude-sonnet-5 1244 60977 3
681 agent claude-sonnet-5 2406 62221 3
682 agent claude-sonnet-5 333 64627 20
683 agent claude-sonnet-5 355 64960 3
684 agent claude-sonnet-5 397 65315 5
685 agent claude-sonnet-5 1328 65712 3
686 agent claude-sonnet-5 2735 67040 7
687 agent claude-sonnet-5 1062 69775 3
688 agent claude-sonnet-5 2308 70837 2
689 agent claude-sonnet-5 607 73145 20
690 agent claude-sonnet-5 367 73752 2
691 agent claude-sonnet-5 527 74119 6
692 agent claude-sonnet-5 1065 74646 17
693 agent claude-sonnet-5 527 75711 17
694 agent claude-sonnet-5 378 76238 17
695 agent claude-sonnet-5 385 76616 2
696 agent claude-sonnet-5 565 77001 2
697 agent claude-sonnet-5 449 77566 2
698 agent claude-sonnet-5 913 78015 0
699 agent claude-sonnet-5 209 78928 5
700 agent claude-sonnet-5 311 79137 2
701 agent claude-sonnet-5 258 79448 3
702 agent claude-haiku-4-5-20251001 13111 0 4
703 agent claude-haiku-4-5-20251001 1989 13111 2
704 agent claude-haiku-4-5-20251001 661 15100 1
705 agent claude-haiku-4-5-20251001 596 15761 2
706 agent claude-haiku-4-5-20251001 715 16357 4
707 agent claude-haiku-4-5-20251001 2012 17072 3
708 agent claude-haiku-4-5-20251001 292 19084 4
709 agent claude-sonnet-5 7082 11475 3
710 agent claude-sonnet-5 4116 18557 5
711 agent claude-sonnet-5 3292 22673 20
712 agent claude-sonnet-5 4562 25965 3
713 agent claude-sonnet-5 4722 30527 3
714 agent claude-sonnet-5 2374 35249 2
715 agent claude-sonnet-5 1712 37623 8
716 agent claude-sonnet-5 3687 39335 0
717 agent claude-sonnet-5 4002 43022 8
718 agent claude-sonnet-5 4596 47024 4
719 agent claude-sonnet-5 4845 51620 5
720 agent claude-sonnet-5 2694 56465 3
721 agent claude-sonnet-5 1522 59159 3
722 agent claude-sonnet-5 6301 60681 7
723 agent claude-sonnet-5 1369 66982 7
724 agent claude-sonnet-5 2351 68351 3
725 agent claude-sonnet-5 3956 70702 5
726 agent claude-sonnet-5 3836 74658 3
727 agent claude-sonnet-5 1199 78494 20
728 agent claude-sonnet-5 2216 79693 20
729 agent claude-sonnet-5 772 81909 2
730 agent claude-sonnet-5 806 82681 5
731 agent claude-sonnet-5 1168 83487 2
732 agent claude-sonnet-5 956 84655 3
733 agent claude-sonnet-5 403 85611 2
734 agent claude-sonnet-5 2551 86014 5
735 agent claude-sonnet-5 1513 88565 2
736 agent claude-sonnet-5 391 90078 1
737 agent claude-sonnet-5 2275 90469 2
738 agent claude-sonnet-5 1887 92744 1
739 agent claude-sonnet-5 289 94631 6
740 agent claude-sonnet-5 492 94920 4
741 agent claude-sonnet-5 349 95412 8
742 agent claude-sonnet-5 0 96461 5
743 agent claude-haiku-4-5-20251001 13556 0 4
744 agent claude-haiku-4-5-20251001 1957 13556 2
745 agent claude-haiku-4-5-20251001 767 15513 1
746 agent claude-haiku-4-5-20251001 635 16280 4
747 agent claude-haiku-4-5-20251001 425 16915 2
748 agent claude-haiku-4-5-20251001 629 17340 3
749 agent claude-haiku-4-5-20251001 754 17969 4
750 agent claude-haiku-4-5-20251001 1666 18723 0
751 agent claude-haiku-4-5-20251001 316 20389 4
752 agent claude-haiku-4-5-20251001 183 20705 4
753 agent claude-opus-5 30787 0 1
754 agent claude-opus-5 4724 30787 1
755 agent claude-opus-5 2904 35511 2
756 agent claude-opus-5 1770 38415 3
757 agent claude-opus-5 5511 40185 5
758 agent claude-opus-5 6347 45696 3
759 agent claude-opus-5 10565 52043 3
760 agent claude-opus-5 9855 62608 2
761 agent claude-opus-5 3717 72463 20
762 agent claude-opus-5 2495 76180 5
763 agent claude-opus-5 2192 78675 21
764 agent claude-opus-5 3951 80867 3
765 agent claude-opus-5 5653 84818 2
766 agent claude-opus-5 4055 90471 7
767 agent claude-opus-5 5029 94526 0
768 agent claude-opus-5 2159 99555 2
769 agent claude-opus-5 5584 101714 3
770 agent claude-opus-5 2729 107298 3
771 agent claude-opus-5 4649 110027 2
772 agent claude-opus-5 4233 114676 2
773 agent claude-opus-5 3035 118909 3
774 agent claude-opus-5 3601 121944 3
775 agent claude-opus-5 2523 125545 3
776 agent claude-opus-5 1985 128068 5
777 agent claude-opus-5 481 130053 17
778 agent claude-opus-5 316 130534 3
779 agent claude-opus-5 220 130850 17
780 agent claude-opus-5 191 131070 20
781 agent claude-opus-5 474 131261 17
782 agent claude-opus-5 203 131735 17
783 agent claude-opus-5 334 131938 7
784 agent claude-opus-5 249 132272 16
785 agent claude-opus-5 363 132521 16
786 agent claude-opus-5 364 132884 2
787 agent claude-opus-5 747 133248 2
788 agent claude-opus-5 578 133995 20
789 agent claude-opus-5 370 134573 3
790 agent claude-opus-5 634 134943 2
791 agent claude-opus-5 1811 135577 2
792 agent claude-opus-5 2101 137388 2
793 agent claude-opus-5 429 139489 17
794 agent claude-opus-5 468 139918 2
795 agent claude-opus-5 4721 140386 3
796 agent claude-opus-5 12813 145107 17
797 agent claude-opus-5 599 157920 3
798 agent claude-opus-5 217 158519 20
799 agent claude-opus-5 1026 158736 21
800 agent claude-opus-5 2362 159762 2
801 agent claude-opus-5 950 162124 17
802 agent claude-opus-5 356 163074 21
803 agent claude-opus-5 2368 163430 8
804 agent claude-opus-5 735 165798 6
805 agent claude-opus-5 197 166533 16
806 agent claude-opus-5 7740 166730 0
807 agent claude-opus-5 704 174470 5
808 agent claude-opus-5 353 175174 1
809 agent claude-opus-5 157646 17190 10
810 agent claude-opus-5 1558 174836 16
811 agent claude-opus-5 1763 176394 2
812 agent claude-opus-5 2274 178157 20
813 agent claude-opus-5 583 180431 3
814 agent claude-opus-5 1069 181014 3
815 agent claude-opus-5 6114 182083 3
816 agent claude-opus-5 2972 188197 3
817 agent claude-opus-5 1196 191169 20
818 agent claude-opus-5 2595 192365 20
819 agent claude-opus-5 894 194960 3
820 agent claude-opus-5 644 195854 0
821 agent claude-opus-5 666 196498 2
822 agent claude-opus-5 584 197164 4
823 agent claude-opus-5 1333 197748 20
824 agent claude-opus-5 2937 199081 2
825 agent claude-opus-5 4387 202018 3
826 agent claude-opus-5 1416 206405 2
827 agent claude-opus-5 1102 207821 2
828 agent claude-opus-5 1997 208923 2
829 agent claude-opus-5 282 210920 17
830 agent claude-opus-5 432 211202 16
831 agent claude-opus-5 357 211634 0
832 agent claude-opus-5 925 211991 2
833 agent claude-opus-5 1688 212916 20
834 agent claude-opus-5 370 214604 1
835 agent claude-haiku-4-5-20251001 13025 0 4
836 agent claude-haiku-4-5-20251001 1575 13025 2
837 agent claude-haiku-4-5-20251001 484 14600 4
838 agent claude-haiku-4-5-20251001 526 15084 2
839 agent claude-haiku-4-5-20251001 7567 15610 2
840 agent claude-haiku-4-5-20251001 1710 23177 3
841 agent claude-haiku-4-5-20251001 289 24887 4
842 agent claude-sonnet-5 19740 0 7
843 agent claude-sonnet-5 2491 19740 4
844 agent claude-sonnet-5 720 22231 20
845 agent claude-sonnet-5 3084 22951 2
846 agent claude-sonnet-5 2179 26035 2
847 agent claude-sonnet-5 448 28214 2
848 agent claude-sonnet-5 2131 28662 3
849 agent claude-sonnet-5 466 30793 20
850 agent claude-sonnet-5 275 31259 20
851 agent claude-sonnet-5 330 31534 2
852 agent claude-sonnet-5 257 31864 4
853 agent claude-sonnet-5 263 32121 207
854 agent claude-sonnet-5 433 32384 9
855 agent claude-sonnet-5 1425 32817 2
856 agent claude-sonnet-5 1289 34242 2
857 agent claude-sonnet-5 630 35531 2
858 agent claude-sonnet-5 465 36161 3
859 agent claude-sonnet-5 279 36626 2
860 agent claude-sonnet-5 872 36905 20
861 agent claude-sonnet-5 1467 37777 2
862 agent claude-sonnet-5 1027 39244 3
863 agent claude-sonnet-5 743 40271 3
864 agent claude-sonnet-5 779 41014 20
865 agent claude-sonnet-5 204 41793 20
866 agent claude-sonnet-5 216 41997 20
867 agent claude-sonnet-5 377 42213 20
868 agent claude-sonnet-5 958 42590 8
869 agent claude-sonnet-5 1576 43548 8
870 agent claude-sonnet-5 1849 45124 2
871 agent claude-sonnet-5 698 46973 2
872 agent claude-sonnet-5 1176 47671 20
873 agent claude-haiku-4-5-20251001 12687 0 4
874 agent claude-haiku-4-5-20251001 1512 12687 2
875 agent claude-haiku-4-5-20251001 314 14199 4
876 agent claude-haiku-4-5-20251001 315 14513 3
877 agent claude-haiku-4-5-20251001 568 14828 2
878 agent claude-haiku-4-5-20251001 242 15396 4
879 agent claude-haiku-4-5-20251001 720 15638 2
880 agent claude-haiku-4-5-20251001 819 16358 333
881 agent claude-haiku-4-5-20251001 446 17177 2
882 agent claude-haiku-4-5-20251001 592 17623 4
883 agent claude-haiku-4-5-20251001 286 18215 4
884 agent claude-haiku-4-5-20251001 170 18501 2
885 agent claude-sonnet-5 7122 11475 4
886 agent claude-sonnet-5 3412 18597 5
887 agent claude-sonnet-5 423 22009 21
888 agent claude-sonnet-5 3825 22432 8
889 agent claude-sonnet-5 1055 26257 20
890 agent claude-sonnet-5 26269 27312 3
891 agent claude-sonnet-5 1874 53581 10
892 agent claude-sonnet-5 11006 55455 3
893 agent claude-sonnet-5 9774 66461 2
894 agent claude-sonnet-5 371 76235 3
895 agent claude-sonnet-5 1325 76606 0
896 agent claude-sonnet-5 2760 77931 3
897 agent claude-sonnet-5 642 80691 20
898 agent claude-sonnet-5 725 81333 20
899 agent claude-sonnet-5 986 82058 3
900 agent claude-sonnet-5 932 83044 3
901 agent claude-sonnet-5 778 83976 2
902 agent claude-sonnet-5 982 84754 3
903 agent claude-sonnet-5 314 85736 2
904 agent claude-sonnet-5 599 86050 2
905 agent claude-sonnet-5 1438 86649 2
906 agent claude-sonnet-5 776 88087 2
907 agent claude-sonnet-5 337 88863 3
908 agent claude-sonnet-5 559 89200 0
909 agent claude-sonnet-5 366 89759 3
910 agent claude-sonnet-5 2123 90125 2
911 agent claude-sonnet-5 3412 92248 0
912 agent claude-sonnet-5 720 95660 2
913 agent claude-sonnet-5 415 96380 5
914 agent claude-sonnet-5 1140 96795 0
915 agent claude-sonnet-5 310 97935 17
916 agent claude-sonnet-5 2273 98245 2
917 agent claude-sonnet-5 1915 100518 6
918 agent claude-sonnet-5 2735 102433 3
919 agent claude-sonnet-5 1434 105168 3
920 agent claude-sonnet-5 531 106602 0
921 agent claude-sonnet-5 1633 107133 20
922 agent claude-sonnet-5 720 108766 4
923 agent claude-sonnet-5 3206 109486 5
924 agent claude-sonnet-5 170 112692 20
925 agent claude-sonnet-5 332 112862 17
926 agent claude-sonnet-5 206 113194 16
927 agent claude-sonnet-5 802 113400 5
928 agent claude-sonnet-5 2307 114202 3
929 agent claude-sonnet-5 259 116509 3
930 agent claude-sonnet-5 4462 116768 2
931 agent claude-sonnet-5 166 121230 20
932 agent claude-sonnet-5 1390 121396 2
933 agent claude-sonnet-5 896 122786 4
934 agent claude-sonnet-5 612 123682 6
935 agent claude-sonnet-5 1468 124294 3
936 agent claude-sonnet-5 352 125762 3
937 agent claude-sonnet-5 1109 126114 20
938 agent claude-sonnet-5 425 127223 7
939 agent claude-sonnet-5 889 127648 6
940 agent claude-sonnet-5 1016 128537 2
941 agent claude-sonnet-5 205 129553 20
942 agent claude-sonnet-5 154 129758 20
943 agent claude-sonnet-5 698 129912 9
944 agent claude-sonnet-5 928 130610 9
945 agent claude-sonnet-5 480 131538 8
946 agent claude-sonnet-5 309 132018 1
947 agent claude-sonnet-5 119457 11467 5
948 agent claude-sonnet-5 1710 130924 2
949 agent claude-sonnet-5 1404 132634 0
950 agent claude-sonnet-5 615 134038 2
951 agent claude-sonnet-5 1096 134653 17
952 agent claude-sonnet-5 957 135749 6
953 agent claude-sonnet-5 605 136706 17
954 agent claude-sonnet-5 308 137311 2
955 agent claude-sonnet-5 713 137619 17
956 agent claude-sonnet-5 368 138332 4
957 agent claude-sonnet-5 229 138700 2
958 agent claude-sonnet-5 1058 138929 0
959 agent claude-sonnet-5 172 139987 2
960 agent claude-sonnet-5 14482 140159 4
961 agent claude-sonnet-5 758 154641 2
962 agent claude-sonnet-5 3436 155399 2
963 agent claude-sonnet-5 661 158835 3
964 agent claude-sonnet-5 2873 159496 3
965 agent claude-sonnet-5 2691 162369 3
966 agent claude-sonnet-5 631 165060 3
967 agent claude-sonnet-5 6337 165691 4
968 agent claude-sonnet-5 455 172028 3
969 agent claude-sonnet-5 215 172483 6
970 agent claude-sonnet-5 512 172698 8
971 agent claude-sonnet-5 5091 173210 2
972 agent claude-sonnet-5 370 178301 0
973 agent claude-sonnet-5 590 178671 20
974 agent claude-sonnet-5 827 179261 1
975 agent claude-sonnet-5 4948 180088 2
976 agent claude-sonnet-5 7826 185036 3
977 agent claude-sonnet-5 2402 192862 3
978 agent claude-sonnet-5 1620 195264 2
979 agent claude-sonnet-5 2255 196884 2
980 agent claude-sonnet-5 2151 199139 5
981 agent claude-sonnet-5 1438 201290 3
982 agent claude-sonnet-5 1141 202728 6
983 agent claude-sonnet-5 872 203869 2
984 agent claude-sonnet-5 2187 204741 3
985 agent claude-sonnet-5 499 206928 6
986 agent claude-sonnet-5 286 207427 2
987 agent claude-sonnet-5 1542 207713 2
988 agent claude-sonnet-5 650 209255 20
989 agent claude-sonnet-5 789 209905 2
990 agent claude-sonnet-5 1320 210694 2
991 agent claude-sonnet-5 1105 212014 3
992 agent claude-sonnet-5 1554 213119 2
993 agent claude-sonnet-5 1262 214673 9
994 agent claude-sonnet-5 815 215935 3
995 agent claude-sonnet-5 1037 216750 0
996 agent claude-sonnet-5 625 217787 20
997 agent claude-sonnet-5 154 218412 20
998 agent claude-sonnet-5 196 218566 2
999 agent claude-sonnet-5 1252 218762 2
1000 agent claude-sonnet-5 1966 220014 2
1001 agent claude-sonnet-5 218 221980 20
1002 agent claude-sonnet-5 2372 222198 3
1003 agent claude-sonnet-5 735 224570 2
1004 agent claude-sonnet-5 1019 225305 1
1005 agent claude-sonnet-5 281 226324 1
1006 agent claude-sonnet-5 212555 11467 5
1007 agent claude-sonnet-5 1973 224022 7
1008 agent claude-sonnet-5 1366 225995 2
1009 agent claude-sonnet-5 2697 227361 3
1010 agent claude-sonnet-5 8586 230058 8
1011 agent claude-sonnet-5 5430 238644 3
1012 agent claude-sonnet-5 5720 244074 3
1013 agent claude-sonnet-5 1455 249794 2
1014 agent claude-sonnet-5 503 251249 20
1015 agent claude-sonnet-5 829 251752 3
1016 agent claude-sonnet-5 1736 252581 3
1017 agent claude-sonnet-5 3150 254317 3
1018 agent claude-sonnet-5 1053 257467 3
1019 agent claude-sonnet-5 1404 258520 2
1020 agent claude-sonnet-5 872 259924 3
1021 agent claude-sonnet-5 1104 260796 1
1022 agent claude-sonnet-5 272 261900 2
1023 agent claude-haiku-4-5-20251001 5598 6509 4
1024 agent claude-haiku-4-5-20251001 1721 12107 2
1025 agent claude-haiku-4-5-20251001 285 13828 2
1026 agent claude-haiku-4-5-20251001 415 14113 2
1027 agent claude-haiku-4-5-20251001 18254 14528 1
1028 agent claude-haiku-4-5-20251001 860 32782 2
1029 agent claude-haiku-4-5-20251001 291 33642 2
1030 agent claude-haiku-4-5-20251001 12255 0 4
1031 agent claude-haiku-4-5-20251001 1957 12255 2
1032 agent claude-haiku-4-5-20251001 445 14212 1
1033 agent claude-haiku-4-5-20251001 573 14657 2
1034 agent claude-haiku-4-5-20251001 226 15230 3
1035 agent claude-haiku-4-5-20251001 1251 15456 4
1036 agent claude-haiku-4-5-20251001 1716 16707 2
1037 agent claude-haiku-4-5-20251001 19872 18423 2
1038 agent claude-haiku-4-5-20251001 1202 38295 2
1039 agent claude-haiku-4-5-20251001 271 39497 2
1040 agent claude-sonnet-5 18509 0 4
1041 agent claude-sonnet-5 2494 18509 5
1042 agent claude-sonnet-5 231 21003 17
1043 agent claude-sonnet-5 1811 21234 3
1044 agent claude-sonnet-5 473 23045 3
1045 agent claude-sonnet-5 1443 23518 2
1046 agent claude-sonnet-5 1620 24961 3
1047 agent claude-sonnet-5 3329 26581 7
1048 agent claude-sonnet-5 6904 29910 1
1049 agent claude-sonnet-5 404 36814 8
1050 agent claude-sonnet-5 192 37218 9
1051 agent claude-sonnet-5 1446 37410 5
1052 agent claude-sonnet-5 1178 38856 17
1053 agent claude-sonnet-5 405 40034 2
1054 agent claude-sonnet-5 1697 40439 2
1055 agent claude-sonnet-5 945 42136 21
1056 agent claude-sonnet-5 1776 43081 2
1057 agent claude-sonnet-5 1907 44857 2
1058 agent claude-sonnet-5 749 46764 2
1059 agent claude-sonnet-5 1475 47513 3
1060 agent claude-sonnet-5 2959 48988 2
1061 agent claude-sonnet-5 713 51947 17
1062 agent claude-sonnet-5 625 52660 17
1063 agent claude-sonnet-5 533 53285 0
1064 agent claude-sonnet-5 1071 53818 3
1065 agent claude-sonnet-5 1180 54889 0
1066 agent claude-sonnet-5 1220 56069 8
1067 agent claude-sonnet-5 1104 57289 1
1068 agent claude-haiku-4-5-20251001 12676 0 4
1069 agent claude-haiku-4-5-20251001 1478 12676 2
1070 agent claude-haiku-4-5-20251001 486 14154 2
1071 agent claude-haiku-4-5-20251001 446 14640 2
1072 agent claude-haiku-4-5-20251001 1213 15086 2
1073 agent claude-haiku-4-5-20251001 421 16299 5
1074 agent claude-haiku-4-5-20251001 12324 0 4
1075 agent claude-haiku-4-5-20251001 1549 12324 2
1076 agent claude-haiku-4-5-20251001 429 13873 2
1077 agent claude-haiku-4-5-20251001 631 14302 2
1078 agent claude-haiku-4-5-20251001 692 14933 3
1079 agent claude-haiku-4-5-20251001 382 15625 4
1080 agent claude-haiku-4-5-20251001 13067 0 0
1081 agent claude-haiku-4-5-20251001 1671 13067 2
1082 agent claude-haiku-4-5-20251001 194 14738 2
1083 agent claude-haiku-4-5-20251001 353 14932 1
1084 agent claude-haiku-4-5-20251001 4197 15285 1
1085 agent claude-haiku-4-5-20251001 1100 19482 2
1086 agent claude-haiku-4-5-20251001 227 20582 1
1087 agent claude-haiku-4-5-20251001 487 20809 2
1088 agent claude-haiku-4-5-20251001 1278 21296 1
1089 agent claude-haiku-4-5-20251001 315 22574 1
1090 agent claude-haiku-4-5-20251001 200 22889 2
1091 agent claude-haiku-4-5-20251001 219 23089 2
1092 agent claude-haiku-4-5-20251001 635 23308 1
1093 agent claude-haiku-4-5-20251001 1315 23943 0
1094 agent claude-haiku-4-5-20251001 298 25258 4
1095 agent claude-haiku-4-5-20251001 302 25556 4
1096 agent claude-haiku-4-5-20251001 12607 0 4
1097 agent claude-haiku-4-5-20251001 1620 12607 2
1098 agent claude-haiku-4-5-20251001 583 14227 2
1099 agent claude-haiku-4-5-20251001 186 14810 2
1100 agent claude-haiku-4-5-20251001 3518 14996 2
1101 agent claude-haiku-4-5-20251001 1433 18514 2
1102 agent claude-haiku-4-5-20251001 1153 19947 2
1103 agent claude-haiku-4-5-20251001 285 21100 5
1104 agent claude-sonnet-5 16936 0 5
1105 agent claude-sonnet-5 2713 16936 4
1106 agent claude-sonnet-5 1661 19649 20
1107 agent claude-sonnet-5 13698 21310 3
1108 agent claude-sonnet-5 465 35008 17
1109 agent claude-sonnet-5 15139 35473 10
1110 agent claude-sonnet-5 2837 50612 2
1111 agent claude-sonnet-5 8897 53449 3
1112 agent claude-sonnet-5 1351 62346 3
1113 agent claude-sonnet-5 881 63697 3
1114 agent claude-sonnet-5 10012 64578 0
1115 agent claude-sonnet-5 7111 74590 5
1116 agent claude-sonnet-5 545 81701 0
1117 agent claude-sonnet-5 23481 82246 0
1118 agent claude-sonnet-5 3569 105727 2
1119 agent claude-sonnet-5 10056 109296 3
1120 agent claude-sonnet-5 3591 119352 3
1121 agent claude-sonnet-5 1326 122943 0
1122 agent claude-sonnet-5 4251 124269 3
1123 agent claude-sonnet-5 1949 128520 3
1124 agent claude-sonnet-5 585 130469 0
1125 agent claude-sonnet-5 1831 131054 3
1126 agent claude-sonnet-5 1419 132885 4
1127 agent claude-sonnet-5 956 134304 0
1128 agent claude-sonnet-5 1648 135260 4
1129 agent claude-sonnet-5 867 136908 2
1130 agent claude-sonnet-5 420 137775 2
1131 agent claude-sonnet-5 936 138195 3
1132 agent claude-sonnet-5 5350 139131 2
1133 agent claude-sonnet-5 1308 144481 2
1134 agent claude-sonnet-5 1238 145789 2
1135 agent claude-sonnet-5 362 147027 0
1136 agent claude-haiku-4-5-20251001 12818 0 2
1137 agent claude-haiku-4-5-20251001 1859 12818 2
1138 agent claude-haiku-4-5-20251001 639 14677 2
1139 agent claude-haiku-4-5-20251001 480 15316 2
1140 agent claude-haiku-4-5-20251001 2736 15796 2
1141 agent claude-haiku-4-5-20251001 404 18532 5
1142 agent claude-haiku-4-5-20251001 13141 0 4
1143 agent claude-haiku-4-5-20251001 1773 13141 1
1144 agent claude-haiku-4-5-20251001 952 14914 2
1145 agent claude-haiku-4-5-20251001 819 15866 3
1146 agent claude-haiku-4-5-20251001 3639 16685 3
1147 agent claude-haiku-4-5-20251001 286 20324 4
1148 agent claude-sonnet-5 18211 0 4
1149 agent claude-sonnet-5 3179 18211 2
1150 agent claude-sonnet-5 198 21390 16
1151 agent claude-sonnet-5 205 21588 9
1152 agent claude-sonnet-5 1045 21793 8
1153 agent claude-sonnet-5 376 22838 20
1154 agent claude-sonnet-5 191 23214 1
1155 agent claude-sonnet-5 213 23405 20
1156 agent claude-sonnet-5 307 23618 5
1157 agent claude-sonnet-5 170 23925 2
1158 agent claude-haiku-4-5-20251001 12415 0 4
1159 agent claude-haiku-4-5-20251001 1702 12415 1
1160 agent claude-haiku-4-5-20251001 708 14117 2
1161 agent claude-haiku-4-5-20251001 240 14825 2
1162 agent claude-haiku-4-5-20251001 337 15065 4
1163 agent claude-haiku-4-5-20251001 1419 15402 2
1164 agent claude-haiku-4-5-20251001 4360 16821 2
1165 agent claude-haiku-4-5-20251001 2242 21181 2
1166 agent claude-haiku-4-5-20251001 652 23423 4
1167 agent claude-haiku-4-5-20251001 311 24075 4
1168 agent claude-sonnet-5 7079 11467 5
1169 agent claude-sonnet-5 2380 18546 4
1170 agent claude-sonnet-5 5016 20926 4
1171 agent claude-sonnet-5 2578 25942 3
1172 agent claude-sonnet-5 1150 28520 5
1173 agent claude-sonnet-5 2641 29670 8
1174 agent claude-sonnet-5 5613 32311 4
1175 agent claude-sonnet-5 604 37924 17
1176 agent claude-sonnet-5 401 38528 17
1177 agent claude-sonnet-5 390 38929 2
1178 agent claude-sonnet-5 520 39319 20
1179 agent claude-sonnet-5 1364 39839 3
1180 agent claude-sonnet-5 763 41203 0
1181 agent claude-sonnet-5 192 41966 20
1182 agent claude-sonnet-5 300 42158 0
1183 agent claude-sonnet-5 500 42458 8
1184 agent claude-sonnet-5 1043 42958 2
1185 agent claude-sonnet-5 934 44001 0
1186 agent claude-sonnet-5 488 44935 0
1187 agent claude-sonnet-5 410 45423 8
1188 agent claude-sonnet-5 1038 45833 2
1189 agent claude-sonnet-5 300 46871 2
1190 agent claude-sonnet-5 487 47171 0
1191 agent claude-sonnet-5 499 47658 16
1192 agent claude-sonnet-5 499 48157 7
1193 agent claude-sonnet-5 605 48656 3
1194 agent claude-sonnet-5 1657 49261 3
1195 agent claude-sonnet-5 2294 50918 4
1196 agent claude-sonnet-5 480 53212 17
1197 agent claude-sonnet-5 1282 53692 20
1198 agent claude-sonnet-5 313 54974 2
1199 agent claude-sonnet-5 548 55287 2
1200 agent claude-sonnet-5 1177 55835 3
1201 agent claude-sonnet-5 271 57012 2
1202 agent claude-sonnet-5 468 57283 4
1203 agent claude-sonnet-5 716 57751 3
1204 agent claude-sonnet-5 627 58467 2
1205 agent claude-sonnet-5 336 59094 2
1206 agent claude-sonnet-5 17907 0 3
1207 agent claude-sonnet-5 2794 17907 2
1208 agent claude-sonnet-5 1182 20701 3
1209 agent claude-sonnet-5 411 21883 1
1210 agent claude-sonnet-5 611 22294 20
1211 agent claude-sonnet-5 2086 22905 0
1212 agent claude-haiku-4-5-20251001 12577 0 1
1213 agent claude-haiku-4-5-20251001 1657 12577 2
1214 agent claude-haiku-4-5-20251001 469 14234 2
1215 agent claude-haiku-4-5-20251001 248 14703 1
1216 agent claude-haiku-4-5-20251001 249 14951 2
1217 agent claude-haiku-4-5-20251001 658 15200 3
1218 agent claude-haiku-4-5-20251001 1630 15858 2
1219 agent claude-haiku-4-5-20251001 2122 17488 4
1220 agent claude-haiku-4-5-20251001 368 19610 4
1221 agent claude-sonnet-5 7120 11467 5
1222 agent claude-sonnet-5 2297 18587 2
1223 agent claude-sonnet-5 484 20884 17
1224 agent claude-sonnet-5 24873 21368 2
1225 agent claude-sonnet-5 7185 46241 3
1226 agent claude-sonnet-5 3165 53426 6
1227 agent claude-sonnet-5 1602 56591 2
1228 agent claude-sonnet-5 216 58193 20
1229 agent claude-sonnet-5 180 58409 20
1230 agent claude-sonnet-5 225 58589 20
1231 agent claude-sonnet-5 455 58814 2
1232 agent claude-sonnet-5 778 59269 20
1233 agent claude-sonnet-5 447 60047 8
1234 agent claude-sonnet-5 399 60494 20
1235 agent claude-sonnet-5 516 60893 3
1236 agent claude-sonnet-5 2491 61409 2
1237 agent claude-sonnet-5 2518 63900 3
1238 agent claude-sonnet-5 1616 66418 3
1239 agent claude-sonnet-5 1280 68034 2
1240 agent claude-sonnet-5 204 69314 20
1241 agent claude-sonnet-5 749 69518 2
1242 agent claude-sonnet-5 579 70267 3
1243 agent claude-sonnet-5 642 70846 2
1244 agent claude-sonnet-5 1029 71488 2
1245 agent claude-sonnet-5 223 72517 2
1246 agent claude-sonnet-5 1203 72740 20
1247 agent claude-sonnet-5 306 73943 3
1248 agent claude-sonnet-5 1023 74249 9
1249 agent claude-sonnet-5 371 75272 20
1250 agent claude-sonnet-5 534 75643 4
1251 agent claude-sonnet-5 197 76177 20
1252 agent claude-sonnet-5 624 76374 2
1253 agent claude-sonnet-5 178 76998 4
1254 agent claude-sonnet-5 242 77176 2
1255 agent claude-sonnet-5 356 77418 2
1256 agent claude-sonnet-5 239 77774 2
1257 agent claude-sonnet-5 352 78013 2
1258 agent claude-sonnet-5 463 78365 9
1259 agent claude-sonnet-5 1096 78828 2
1260 agent claude-sonnet-5 571 79924 8
1261 agent claude-sonnet-5 434 80495 2
1262 agent claude-sonnet-5 18414 0 4
1263 agent claude-sonnet-5 3416 18414 4
1264 agent claude-sonnet-5 2805 21830 3
1265 agent claude-sonnet-5 4264 24635 14
1266 agent claude-sonnet-5 12589 28899 10
1267 agent claude-sonnet-5 1892 41488 2
1268 agent claude-sonnet-5 166 43380 20
1269 agent claude-sonnet-5 2332 43546 3
1270 agent claude-sonnet-5 4322 45878 2
1271 agent claude-sonnet-5 316 50200 20
1272 agent claude-sonnet-5 586 50516 4
1273 agent claude-sonnet-5 687 51102 2
1274 agent claude-haiku-4-5-20251001 13128 0 4
1275 agent claude-haiku-4-5-20251001 3079 13128 2
1276 agent claude-haiku-4-5-20251001 456 16207 2
1277 agent claude-haiku-4-5-20251001 2030 16663 2
1278 agent claude-haiku-4-5-20251001 299 18693 2
1279 agent claude-sonnet-5 6581 11477 4
1280 agent claude-sonnet-5 2631 18058 4
1281 agent claude-sonnet-5 1547 20689 5
1282 agent claude-sonnet-5 1560 22236 2
1283 agent claude-sonnet-5 772 23796 3
1284 agent claude-sonnet-5 667 24568 3
1285 agent claude-sonnet-5 312 25235 2
1286 agent claude-sonnet-5 1170 25547 1
1287 agent claude-sonnet-5 796 26717 0
1288 agent claude-sonnet-5 6571 11477 4
1289 agent claude-sonnet-5 3216 18048 2
1290 agent claude-sonnet-5 799 21264 3
1291 agent claude-sonnet-5 684 22063 0
1292 agent claude-sonnet-5 475 22747 1
1293 agent claude-sonnet-5 314 23222 1
1294 agent claude-sonnet-5 6527 11477 3
1295 agent claude-sonnet-5 3585 18004 2
1296 agent claude-sonnet-5 1157 21589 2
1297 agent claude-sonnet-5 359 22746 20
1298 agent claude-sonnet-5 152 23105 2
1299 agent claude-sonnet-5 2953 23257 2
1300 agent claude-sonnet-5 768 26210 2
1301 agent claude-sonnet-5 320 26978 2
1302 agent claude-sonnet-5 322 27298 0
1303 agent claude-sonnet-5 260 27620 2
1304 agent claude-sonnet-5 210 27880 9
1305 agent claude-sonnet-5 335 28090 1
1306 agent claude-haiku-4-5-20251001 12821 0 0
1307 agent claude-haiku-4-5-20251001 1839 12821 2
1308 agent claude-haiku-4-5-20251001 1741 14660 2
1309 agent claude-haiku-4-5-20251001 1831 16401 2
1310 agent claude-haiku-4-5-20251001 476 18232 2
1311 agent claude-haiku-4-5-20251001 229 18708 4
1312 agent claude-sonnet-5 7026 11477 5
1313 agent claude-sonnet-5 2337 18503 2
1314 agent claude-sonnet-5 2403 20840 2
1315 agent claude-sonnet-5 868 23243 3
1316 agent claude-sonnet-5 748 24111 8
1317 agent claude-sonnet-5 2520 24859 4
1318 agent claude-sonnet-5 728 27379 3
1319 agent claude-sonnet-5 1501 28107 8
1320 agent claude-sonnet-5 432 29608 17
1321 agent claude-sonnet-5 449 30040 2
1322 agent claude-sonnet-5 337 30489 2
1323 agent claude-sonnet-5 681 30826 5
1324 agent claude-sonnet-5 226 31507 2
1325 agent claude-sonnet-5 398 31733 20
1326 agent claude-sonnet-5 274 32131 16
1327 agent claude-sonnet-5 420 32405 2
1328 agent claude-sonnet-5 830 32825 5
1329 agent claude-sonnet-5 751 33655 0
1330 agent claude-sonnet-5 442 34406 9
1331 agent claude-sonnet-5 579 34848 2
1332 agent claude-sonnet-5 601 35427 20
1333 agent claude-sonnet-5 303 36028 5
1334 agent claude-sonnet-5 181 36331 20
1335 agent claude-sonnet-5 1132 36512 4
1336 agent claude-sonnet-5 456 37644 3
1337 agent claude-sonnet-5 346 38100 1
1338 agent claude-sonnet-5 252 38446 1
1339 agent claude-sonnet-5 1636 38698 8
1340 agent claude-sonnet-5 1420 40334 2
1341 agent claude-sonnet-5 1427 41754 1
1342 agent claude-sonnet-5 6958 11475 4
1343 agent claude-sonnet-5 3557 18433 3
1344 agent claude-sonnet-5 3037 21990 20
1345 agent claude-sonnet-5 3530 25027 3
1346 agent claude-sonnet-5 20459 28557 3
1347 agent claude-sonnet-5 2950 49016 4
1348 agent claude-sonnet-5 2702 51966 2
1349 agent claude-sonnet-5 6236 54668 2
1350 agent claude-sonnet-5 11339 60904 3
1351 agent claude-sonnet-5 9099 72243 3
1352 agent claude-sonnet-5 1026 81342 7
1353 agent claude-sonnet-5 2600 82368 3
1354 agent claude-sonnet-5 361 84968 3
1355 agent claude-sonnet-5 2078 85329 2
1356 agent claude-sonnet-5 320 87407 17
1357 agent claude-sonnet-5 2425 87727 0
1358 agent claude-sonnet-5 2503 90152 3
1359 agent claude-sonnet-5 495 92655 8
1360 agent claude-sonnet-5 6468 93150 3
1361 agent claude-sonnet-5 515 99618 4
1362 agent claude-sonnet-5 1088 100133 4
1363 agent claude-sonnet-5 3457 101221 2
1364 agent claude-sonnet-5 246 104678 20
1365 agent claude-sonnet-5 560 104924 6
1366 agent claude-sonnet-5 607 105484 2
1367 agent claude-sonnet-5 261 106091 2
1368 agent claude-sonnet-5 371 106352 2
1369 agent claude-sonnet-5 273 106723 9
1370 agent claude-sonnet-5 7180 11467 3
1371 agent claude-sonnet-5 2231 18647 5
1372 agent claude-sonnet-5 18350 20878 9
1373 agent claude-sonnet-5 2587 39228 2
1374 agent claude-sonnet-5 2160 41815 3
1375 agent claude-sonnet-5 4452 43975 2
1376 agent claude-sonnet-5 610 48427 0
1377 agent claude-sonnet-5 689 49037 8
1378 agent claude-sonnet-5 1407 49726 2
1379 agent claude-sonnet-5 643 51133 6
1380 agent claude-sonnet-5 4134 51776 2
1381 agent claude-sonnet-5 2044 55910 2
1382 agent claude-sonnet-5 1334 57954 20
1383 agent claude-sonnet-5 2227 59288 8
1384 agent claude-sonnet-5 507 61515 0
1385 agent claude-sonnet-5 1330 62022 10
1386 agent claude-sonnet-5 1998 63352 2
1387 agent claude-sonnet-5 1071 65350 3
1388 agent claude-sonnet-5 1232 66421 4
1389 agent claude-sonnet-5 1677 67653 20
1390 agent claude-sonnet-5 760 69330 17
1391 agent claude-sonnet-5 441 70090 17
1392 agent claude-sonnet-5 361 70531 20
1393 agent claude-sonnet-5 465 70892 1
1394 agent claude-sonnet-5 274 71357 1
1395 agent claude-sonnet-5 151 71631 1
1396 agent claude-sonnet-5 7051 11475 4
1397 agent claude-sonnet-5 6117 18526 2
1398 agent claude-sonnet-5 11899 24643 2
1399 agent claude-sonnet-5 950 36542 2
1400 agent claude-sonnet-5 611 37492 3
1401 agent claude-sonnet-5 1083 38103 2
1402 agent claude-sonnet-5 2355 39186 2
1403 agent claude-sonnet-5 567 41541 3
1404 agent claude-sonnet-5 891 42108 2
1405 agent claude-sonnet-5 543 42999 3
1406 agent claude-sonnet-5 463 43542 2
1407 agent claude-sonnet-5 483 44005 2
1408 agent claude-sonnet-5 1321 44488 3
1409 agent claude-sonnet-5 6655 45809 3
1410 agent claude-sonnet-5 3405 52464 5
1411 agent claude-sonnet-5 913 55869 5
1412 agent claude-sonnet-5 1620 56782 4
1413 agent claude-sonnet-5 425 58402 17
1414 agent claude-sonnet-5 318 58827 2
1415 agent claude-sonnet-5 3486 59145 7
1416 agent claude-sonnet-5 2198 62631 3
1417 agent claude-sonnet-5 3759 64829 2
1418 agent claude-sonnet-5 5287 68588 0
1419 agent claude-sonnet-5 224 73875 20
1420 agent claude-sonnet-5 1291 74099 2
1421 agent claude-sonnet-5 2029 75390 4
1422 agent claude-sonnet-5 1701 77419 2
1423 agent claude-sonnet-5 485 79120 9
1424 agent claude-sonnet-5 810 79605 3
1425 agent claude-sonnet-5 351 80415 2
1426 agent claude-sonnet-5 1183 80766 1
1427 agent claude-sonnet-5 73544 7828 4
1428 agent claude-sonnet-5 4428 81372 0
1429 agent claude-sonnet-5 1345 85800 0
1430 agent claude-sonnet-5 13085 87145 0
1431 agent claude-sonnet-5 5620 100230 2
1432 agent claude-sonnet-5 5442 105850 5
1433 agent claude-sonnet-5 5488 111292 6
1434 agent claude-sonnet-5 2209 116780 17
1435 agent claude-sonnet-5 623 118989 17
1436 agent claude-sonnet-5 719 119612 17
1437 agent claude-sonnet-5 650 120331 6
1438 agent claude-sonnet-5 14268 120981 2
1439 agent claude-sonnet-5 6768 135249 3
1440 agent claude-sonnet-5 5554 142017 2
1441 agent claude-sonnet-5 4891 147571 6
1442 agent claude-sonnet-5 1346 152462 2
1443 agent claude-sonnet-5 17442 153808 2
1444 agent claude-sonnet-5 172 171250 20
1445 agent claude-sonnet-5 961 171422 17
1446 agent claude-sonnet-5 1508 172383 2
1447 agent claude-sonnet-5 2899 173891 20
1448 agent claude-sonnet-5 204 176790 2
1449 agent claude-sonnet-5 1302 176994 3
1450 agent claude-sonnet-5 4450 178296 2
1451 agent claude-sonnet-5 688 182746 0
1452 agent claude-sonnet-5 755 183434 5
1453 agent claude-sonnet-5 1264 184189 3
1454 agent claude-sonnet-5 1976 185453 20
1455 agent claude-sonnet-5 1119 187429 2
1456 agent claude-sonnet-5 1265 188548 2
1457 agent claude-sonnet-5 871 189813 2
1458 agent claude-sonnet-5 760 190684 2
1459 agent claude-sonnet-5 1184 191444 2
1460 agent claude-sonnet-5 582 192628 20
1461 agent claude-sonnet-5 305 193210 3
1462 agent claude-sonnet-5 1343 193515 17
1463 agent claude-sonnet-5 607 194858 0
1464 agent claude-sonnet-5 585 195465 2
1465 agent claude-sonnet-5 298 196050 3
1466 agent claude-sonnet-5 633 196348 2
1467 agent claude-sonnet-5 574 196981 3
1468 agent claude-sonnet-5 669 197555 20
1469 agent claude-sonnet-5 703 198224 3
1470 agent claude-sonnet-5 1258 198927 20
1471 agent claude-sonnet-5 756 200185 9
1472 agent claude-sonnet-5 1041 200941 2
1473 agent claude-sonnet-5 705 201982 1
1474 agent claude-sonnet-5 201 202687 8
1475 agent claude-sonnet-5 263 202888 2
1476 agent claude-sonnet-5 313 203151 20
1477 agent claude-sonnet-5 173 203464 3
1478 agent claude-sonnet-5 516 203637 6
1479 agent claude-sonnet-5 354 204153 2
1480 agent claude-sonnet-5 455 204507 2
1481 agent claude-sonnet-5 726 204962 2
1482 agent claude-sonnet-5 2250 205688 8
1483 agent claude-sonnet-5 722 207938 8
1484 agent claude-sonnet-5 723 208660 17
1485 agent claude-sonnet-5 588 209383 2
1486 agent claude-sonnet-5 602 209971 5
1487 agent claude-haiku-4-5-20251001 13214 0 4
1488 agent claude-haiku-4-5-20251001 1465 13214 2
1489 agent claude-haiku-4-5-20251001 213 14679 2
1490 agent claude-haiku-4-5-20251001 893 14892 5
1491 agent claude-haiku-4-5-20251001 728 15785 1
1492 agent claude-haiku-4-5-20251001 571 16513 2
1493 agent claude-haiku-4-5-20251001 614 17084 4
1494 agent claude-haiku-4-5-20251001 393 17698 1
1495 agent claude-haiku-4-5-20251001 615 18091 2
1496 agent claude-haiku-4-5-20251001 968 18706 1
1497 agent claude-haiku-4-5-20251001 1072 19674 2
1498 agent claude-haiku-4-5-20251001 2311 20746 3
1499 agent claude-haiku-4-5-20251001 283 23057 3
1500 agent claude-sonnet-5 7013 11475 4
1501 agent claude-sonnet-5 4070 18488 2
1502 agent claude-sonnet-5 3846 22558 5
1503 agent claude-sonnet-5 1136 26404 3
1504 agent claude-sonnet-5 3632 27540 7
1505 agent claude-sonnet-5 5060 31172 4
1506 agent claude-sonnet-5 5727 36232 3
1507 agent claude-sonnet-5 2190 41959 2
1508 agent claude-sonnet-5 2355 44149 2
1509 agent claude-sonnet-5 312 46504 5
1510 agent claude-sonnet-5 1990 46816 4
1511 agent claude-sonnet-5 200 48806 20
1512 agent claude-sonnet-5 2470 49006 3
1513 agent claude-sonnet-5 1970 51476 3
1514 agent claude-sonnet-5 382 53446 20
1515 agent claude-sonnet-5 166 53828 8
1516 agent claude-sonnet-5 2402 53994 2
1517 agent claude-sonnet-5 469 56396 9
1518 agent claude-sonnet-5 1392 56865 1
1519 agent claude-sonnet-5 234 58257 0
1520 agent claude-sonnet-5 6800 11467 4
1521 agent claude-sonnet-5 8089 18267 2
1522 agent claude-sonnet-5 1229 26356 20
1523 agent claude-sonnet-5 1042 27585 2
1524 agent claude-sonnet-5 1067 28627 2
1525 agent claude-sonnet-5 1020 29694 20
1526 agent claude-sonnet-5 452 30714 2
1527 agent claude-sonnet-5 271 31166 1
1528 agent claude-sonnet-5 127 31437 1
1529 agent claude-haiku-4-5-20251001 6489 6509 4
1530 agent claude-haiku-4-5-20251001 1697 12998 2
1531 agent claude-haiku-4-5-20251001 836 14695 2
1532 agent claude-haiku-4-5-20251001 354 15531 2
1533 agent claude-haiku-4-5-20251001 2189 15885 2
1534 agent claude-haiku-4-5-20251001 444 18074 2
1535 agent claude-opus-5 10758 15753 1
1536 agent claude-opus-5 9971 26511 3
1537 agent claude-opus-5 23086 36482 3
1538 agent claude-opus-5 5840 59568 4
1539 agent claude-opus-5 4295 65408 3
1540 agent claude-opus-5 6358 69703 6
1541 agent claude-opus-5 6293 76061 4
1542 agent claude-opus-5 4931 82354 3
1543 agent claude-opus-5 3314 87285 3
1544 agent claude-opus-5 2735 90599 5
1545 agent claude-opus-5 3277 93334 3
1546 agent claude-opus-5 4806 96611 3
1547 agent claude-opus-5 3927 101417 3
1548 agent claude-opus-5 1878 105344 5
1549 agent claude-opus-5 2194 107222 3
1550 agent claude-opus-5 1984 109416 2
1551 agent claude-opus-5 1652 111400 2
1552 agent claude-opus-5 4662 113052 3
1553 agent claude-opus-5 10679 15753 1
1554 agent claude-opus-5 7750 26432 5
1555 agent claude-opus-5 10483 34182 17
1556 agent claude-opus-5 10630 44665 17
1557 agent claude-opus-5 10928 55295 6
1558 agent claude-opus-5 2307 66223 17
1559 agent claude-opus-5 2899 68530 20
1560 agent claude-opus-5 4731 71429 4
1561 agent claude-opus-5 2910 76160 4
1562 agent claude-opus-5 1067 79070 2
1563 agent claude-opus-5 2636 80137 17
1564 agent claude-opus-5 1829 82773 3
1565 agent claude-opus-5 1141 84602 4
1566 agent claude-opus-5 1622 85743 4
1567 agent claude-opus-5 3289 87365 5
1568 agent claude-opus-5 2815 90654 212
1569 agent claude-opus-5 1200 93469 2
1570 agent claude-opus-5 882 94669 3
1571 agent claude-opus-5 3311 95551 2
1572 agent claude-opus-5 10807 15753 1
1573 agent claude-opus-5 8021 26560 5
1574 agent claude-opus-5 1846 34581 3
1575 agent claude-opus-5 2015 36427 5
1576 agent claude-opus-5 7729 38442 3
1577 agent claude-opus-5 2735 46171 9
1578 agent claude-opus-5 2741 48906 6
1579 agent claude-opus-5 2469 51647 8
1580 agent claude-opus-5 916 54116 2
1581 agent claude-opus-5 26433 0 2
1582 agent claude-opus-5 1817 26433 17
1583 agent claude-opus-5 22634 28250 3
1584 agent claude-opus-5 14641 50884 3
1585 agent claude-opus-5 4594 65525 3
1586 agent claude-opus-5 5031 70119 3
1587 agent claude-opus-5 456 75150 16
1588 agent claude-opus-5 3184 75606 3
1589 agent claude-opus-5 2269 78790 3
1590 agent claude-opus-5 2226 81059 3
1591 agent claude-opus-5 3500 83285 3
1592 agent claude-opus-5 785 86785 6
1593 agent claude-opus-5 72645 15753 3
1594 agent claude-opus-5 567 88398 2
1595 agent claude-opus-5 1319 88965 4
1596 agent claude-opus-5 1022 90284 3
1597 agent claude-opus-5 637 91306 3
1598 agent claude-opus-5 2188 91943 9
1599 agent claude-opus-5 3042 94131 5
1600 agent claude-opus-5 1195 97173 2
1601 agent claude-opus-5 1816 98368 2
1602 agent claude-opus-5 574 100184 3
1603 agent claude-opus-5 5814 100758 3
1604 agent claude-opus-5 644 106572 5
-->
<!-- /cout -->

### 28. Trois paires d'apps partageaient un port de bout en bout, et la CI ne pouvait pas le voir

**Symptome** — au moment de lancer deux suites de bout en bout en meme temps
depuis la meme session, collision. Releve sur les dix `e2e/lancer.sh` : trois
paires se partagent un port par defaut — 18081 (`compteur` et `hello-world`),
18084 (`estran` degrade et `marcq-handball`), 18085 (`estran` stub et
`pilabelle`). Onze ports declares pour huit valeurs distinctes.

**Cause** — les dix suites ont ete ecrites app par app, dans cette meme branche,
chacune choisissant son port sans registre ni voisin a consulter. Le premier a
pris 18080, et la numerotation a redemarre plusieurs fois.

Ce qui rend le defaut interessant n'est pas la collision, c'est **son
invisibilite structurelle** : en CI, chaque app tourne dans son propre conteneur
de matrice, seule, et le port est libre a tous les coups. Les 49 jobs de la
pull request sont verts, et le resteront. Le defaut ne se manifeste QUE sur un
poste de developpement — c'est-a-dire a l'endroit ou la fabrique promet
justement que le bout en bout natif est jouable, ce qui etait tout l'argument
de ne PAS passer par Docker pour huit apps sur dix.

Et il se manifeste mal. La seconde suite ne trouve pas un port occupe : elle
attend `/healthz`, l'obtient — du serveur de la PREMIERE app — et joue ses
tests contre l'app du voisin. Elle rend alors des echecs sans rapport avec ce
qu'on vient d'ecrire, ou, sur des assertions assez generiques, elle **passe**.

**Detecte par** — `auteur`

**Action** — `garde-fou` — `check_e2e_ports` dans `--check`, le seul controle qui
regarde les dix apps ENSEMBLE. Il lit les defauts de la forme `${VAR:-NNNNN}` et
refuse deux apps sur la meme valeur ; les ports poses par l'environnement ne
sont pas lus, ce sont eux qui permettent de sortir d'une collision, pas de la
creer. `hello-world` passe a 18088, `marcq-handball` a 18089, `pilabelle` a
18090 ; `estran` garde ses trois. Les deux suites deplacees ont ete rejouees
sur leur nouveau port, vertes.

Deux cas dans `test-init.sh`, qui passe de 38 a 40. Le second n'est pas du
remplissage : `estran` declare TROIS ports, et un controle qui compterait les
repetitions sans regarder a quelle app elles appartiennent le refuserait
lui-meme. Contre-epreuve faite en retirant le garde de meme-app — le faux
positif apparait, nomme `hello-world` deux fois.

C'est le sixieme vert silencieux de la branche, et le seul qu'aucune execution
en CI n'aurait jamais pu reveler : les cinq autres attendaient qu'on lise leur
sortie, celui-ci attendait qu'on soit sur deux apps a la fois.

### 29. Une suite de bout en bout pouvait passer au vert en testant une AUTRE application

**Symptome** — trouve par l'artisan de `pilabelle`, en vrai, pendant son
chantier. Son premier lancement de `e2e/lancer.sh` echoue avec des symptomes de
regression : « Bienvenue 👋 » introuvable, champ de formulaire introuvable. Le
code n'y etait pour rien. Dans `/tmp/pilabelle-e2e.log` : `listen tcp :18090:
bind: address already in use`. Le serveur de `pilabelle` n'avait jamais demarre,
un binaire etranger occupait le port, et Playwright avait joue toute la suite
contre lui.

**Cause** — les dix `lancer.sh` demarrent leur serveur en tache de fond, puis
attendent une reponse sur `/healthz`. Ils n'interrogent que **le port**, jamais
**le processus qu'ils ont lance**. Or le port ne prouve rien : n'importe qui
peut y repondre. Le nôtre peut etre mort a la premiere seconde — port occupe,
configuration absente, dependance manquante, permission refusee — sans que rien
ne le dise, parce que `curl` obtient son 200 d'ailleurs.

C'est le meme mode d'echec que l'anomalie 28, un cran plus profond. 28 empechait
deux apps de **declarer** le meme port ; 29 dit que la declaration ne suffit
pas, parce qu'un processus oublie d'une session precedente ne declare rien.

**Detecte par** — `test`

**Action** — `garde-fou` — les dix suites verifient desormais que **leur propre
serveur est encore vivant** avant de conclure : `kill -0` sur le PID lance pour
les huit natives, `docker inspect -f '{{.State.Running}}'` pour les deux qui
montent des conteneurs. Le PID et le nom de conteneur sont les seules choses
qu'un tiers ne peut pas usurper. Les serveurs annexes ont le meme garde-fou —
le stub d'`estran`, la fixture Deezer de `ramure` —, ils avaient le meme trou.

**La contre-epreuve est la partie qui compte, et elle est pire que prevu.** Un
imposteur pose sur le port de `hello-world` (un serveur qui rend 200 sur tout),
puis la suite lancee sans le garde-fou :

```
==> tests Playwright
  ✘  1 la page d'accueil s'affiche
  ✓  2 la sonde de sante repond          <-- VERT, contre le serveur d'un autre
  ✘  3 aucune violation d'accessibilite serieuse
```

Un test **passe au vert contre un serveur qui n'est pas celui de l'app**, et les
deux qui echouent imitent une regression du code qu'on vient d'ecrire. Avec le
garde-fou : refus, code 1, zero test joue. Une suite plus generique dans ses
assertions — et beaucoup le sont — serait passee entierement verte.

Septieme vert silencieux de la branche. Les six premiers rendaient un verdict
sans avoir rien lu ; celui-ci lit vraiment, mais chez le voisin.

**Non verifie ici** — `ardoise` et `compteur` montent des conteneurs et le demon
Docker n'est pas joignable depuis cette session (deja note en anomalie 18). Leur
garde-fou est ecrit et analyse par `bash -n`, il n'est pas joue. La CI le
tranchera. Les huit autres suites ont ete rejouees apres le correctif : 63 tests
verts, `axe` compris.

### 30. Le graphe de CI a double de largeur sans qu'un chronometre repasse

**Symptome** — les seules durees de CI que porte le depot datent du 2026-08-18 :
run complet 9 min 49, `contrat` 19 s, `contrat` + `test` + `build` termines a
2 min 15, mediane ramenee de 521 s a 196 s sur douze runs. Toutes valent pour
**neuf apps et deux matrices**. Depuis, `revue` et `bout-en-bout` ont ajoute
vingt shards, une dixieme app est arrivee, et aucune de ces mesures n'a ete
refaite. Consequence : **le chemin critique est aujourd'hui inconnu**. Il passe
soit par `contrat -> test -> build -> deploy`, soit par
`contrat -> bout-en-bout -> deploy`, et rien ne permet de trancher.

**Cause** — la campagne de mesure du 18 aout a ete faite pour un changement
precis puis refermee. Rien n'attache une remesure a une modification du graphe :
un `needs` ajoute, une matrice creee, un job scinde ne demandent aucun
chronometre.

Ce n'est pas une inquietude theorique : la meme branche de mesure a deja paye
cette faute dans l'autre sens. Accelerer `test-pret.sh`, `test-cout.sh` et
`test-jetons.sh` — 125 s cumulees, le travail le plus minutieux de la branche —
n'a rien rapporte sur l'horloge, parce qu'aucun de ces scripts n'etait sur le
chemin critique. Optimiser sans connaitre le chemin critique, c'est accelerer la
branche qui n'est pas la plus lente.

**Detecte par** — `auteur`

**Action** — `outillage` — un banc de mesure est ecrit : `docs/banc/mesurer.sh`,
six scenarios figes, protocole et pieges dans `docs/banc/README.md`, serie dans
`docs/banc/releves.md`. Il couvre la chaine LOCALE ; la CI reste une serie
separee, non encore relevee, et le relevé le dit plutot que de le taire.

### 31. Le job `build` attend `test` sans que rien ne le lui demande

**Symptome** — `.github/workflows/build.yml` : `build` porte
`needs: [contrat, detect, test]`. C'est la seule arete du graphe qui enchaine
deux matrices de dix. Or rien dans `build` ne consomme quoi que ce soit produit
par `test` : le contexte de construction est `apps/<app>` seul, les tags viennent
de `detect`, et les deux controles de l'etape « labels et taille » portent sur
l'image.

**Cause** — la dependance est politique, pas technique : « ne pas publier
l'image d'une app dont les tests tombent ». Mais `deploy` porte deja cette
garantie, plus finement, en testant `needs.test.result` job par job. Une image
publiee sans test vert n'atteint jamais la production : `deploy` ne tourne pas,
donc rien n'est epingle, donc `versions.yml` et `compose.yaml` ne bougent pas,
donc dockhand ne voit rien. Le seul effet residuel serait un tag mutable `:main`
deplace — et `compose.yaml` n'en reference plus aucun, les dix apps sont
epinglees par SHA.

**Detecte par** — `auteur`

**Action** — `arbitrage` — rendu le 2026-08-21 : l'arete est coupee,
`build` ne porte plus que `contrat` et `detect`. Toute la matrice `test` sort du
chemin critique ; la garantie qui comptait reste entiere, `deploy` exigeant
toujours `needs.test.result == success || skipped`.

Ce que l'arbitrage a mis en balance et qu'il faut surveiller : la pointe passe
de ~35 a ~45 jobs simultanes, et le plafond de jobs concurrents du compte
GitHub n'est ecrit nulle part dans le depot. Sous un plafond sature, l'attente
se deplace du graphe vers la FILE, ou elle est invisible dans la duree des jobs
et n'apparait que dans celle du run. C'est donc la duree du RUN qu'il faut
comparer au premier passage, pas celle des jobs.

### 32. La revue reinstalle ses trois outils dans chacun des dix shards

**Symptome** — `scripts/revue.sh` pose ses binaires dans
`.revue-outils/<toolchain>/`, chemin que le workflow ne met dans aucun `path:` de
cache et que `.gitignore` ecarte. Les trois `go install` de `staticcheck`,
`gosec` et `govulncheck` tournent donc dans **chacun** des dix shards de `revue`,
a chaque execution. Le cache `~/.cache/go-build` ramene la depense a une edition
de liens plutot qu'a une compilation complete, mais elle est payee dix fois.

**Cause** — le cache du job `revue` a ete ecrit pour les caches Go et npx, qui
vivent sous `$HOME` ; le cache d'outils, lui, vit **dans le depot**, et a echappe
a la liste. La variable prevue pour le deplacer, `REVUE_CACHE_OUTILS`, n'est
posee nulle part dans le workflow.

La cle du cache existant porte deja l'empreinte de `fabrique.yml`, ou vivent les
quatre versions d'outils epinglees : elle change exactement quand les binaires
doivent etre refaits. Le chemin manquait, pas la cle.

**Detecte par** — `auteur`

**Action** — `garde-fou` — un chemin d'ecriture d'un script de la fabrique qui
n'est ni committe ni cache est une depense invisible, repetee par shard. `--check`
sait deja lire `revue.sh` et `build.yml` : il peut verifier que tout repertoire de
cache ecrit par un script figure dans le `path:` du job qui l'appelle. Meme forme
que les autres garde-fous du depot : ce n'est pas une erreur, c'est un silence.

### 33. `memory/travail.md` fonde l'innocuite du greffier sur un invariant faux

**Symptome** — le fichier ecrit : « L'`analyste` et le `greffier` sont restreints
a `Bash`, `Read` et `Grep` : l'absence d'outil d'edition n'est pas un detail de
configuration, c'est ce qui garantit qu'un agent lance en fond ne touchera pas au
depot pendant que tu travailles dessus. » Or le greffier fait `git add -A` puis
`git commit` **par `Bash`**. Il modifie le depot, et `git add -A` capture tout
l'arbre, y compris ce qu'un autre agent est en train d'ecrire.

Au meme endroit, le fichier prend soin de dire que le `relecteur` « n'ecrit aucun
fichier, donc se lance en tache de fond sans risque » et ne dit rien de
l'`esthete`, dont la definition porte pourtant `Edit` et `Write` et dont
l'autorite de correction est explicite dans le contrat.

**Cause** — la regle a ete ecrite en regardant le champ `tools:` des agents, pas
ce qu'ils font. `Bash` suffit a ecrire ; l'absence d'`Edit` ne prouve rien.

**Detecte par** — `relecture`

**Action** — `contrat` — l'invariant reel n'est pas « il n'edite pas », c'est
« il n'edite pas de fichier de code » : ca suffit contre une lecture concurrente,
pas contre une ecriture concurrente. Corrige dans `memory/travail.md`, et
l'`esthete` y est range du cote de l'artisan, ou la regle du depot le met.

### 34. Un test ecrit POUR empecher un defaut serait passe au vert en le laissant revenir

**Symptome** — aucun, et c'est tout l'interet : le cas a ete pris en flagrant
delit, avant d'exister. L'artisan d'`estran` ecrivait le test qui empeche la
date du jour de se reecrire deux fois. Sa premiere version comparait le texte
du titre de section a celui de la carte de maree, tels quels. Le titre n'est
pas capitalise cote serveur — c'est le CSS qui le met en majuscules — tandis
que le code fautif appelait `capitaliser()` sur ce meme libelle avant de
l'ecrire sur la carte.

Les deux chaines n'auraient donc **jamais** ete egales, meme avec le defaut en
place. Le test aurait passe au vert le jour de son ecriture, passe au vert
apres le correctif, et passe au vert le jour ou quelqu'un aurait remis la date
sur la carte.

**Cause** — un test de non-repetition compare deux rendus d'une meme donnee. Si
les deux rendus la transforment differemment — casse, espaces, accents,
troncature —, la comparaison porte sur la transformation et plus sur la
donnee. Le piege est d'autant plus solide ici que la transformation fautive
etait DANS le code teste : c'est le defaut lui-meme qui rendait le test
inoffensif.

**Detecte par** — `test`

**Action** — `rien` — le test a ete corrige avant d'entrer (comparaison
insensible a la casse), et surtout **prouve** : ancien code remis, rouge ;
correctif remis, vert. C'est la contre-epreuve, et pas la relecture, qui a
tranche — la premiere version se lisait tres bien.

Ce qui merite d'etre garde n'est pas le correctif mais la regle qu'il illustre.
Un test ecrit pour empecher un defaut precis doit etre **joue contre ce
defaut**, une fois, avant d'etre considere comme ecrit. Sans cela, on n'a pas
un garde-fou : on a une ligne verte de plus, qui occupe la place ou le
garde-fou aurait du etre — et un test faux est pire qu'un test absent, parce
qu'un test absent se voit.

C'est le meme mode d'echec que les sept verts silencieux de cette branche,
cette fois dans un test tout neuf ecrit pour en fermer un. Le defaut ne se
lasse pas.

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

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-20 à 17:28 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 3 445 | 0,01 $ |
| Écriture de cache | 3 717 077 | 14,89 $ |
| Lecture de cache | 176 500 277 | 75,50 $ |
| Sortie | 342 227 | 7,16 $ |
| **Total** | **180 563 026** | **97,56 $ — 84,72 €** |

**Ce qui coûte**

- **1202 appel(s) au modèle** — un par réponse, outils compris —, dont 841 par des sous-agents — 74 967 267 jetons, 35,50 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  65 847 jetons, écrits une fois par session puis relus à chaque
  échange : 23 704 920 jetons de relecture, 13 % de tout ce qui a été relu.
- **Tours courts** — 814 des 1 202 tours (67 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 50,37 $, soit 51 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 65 847 jetons relus au premier appel qui relise
  quelque chose, 561 554 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 180563026 -->
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
362 agent claude-opus-5 13868 17190 1
363 agent claude-opus-5 4698 31058 1
364 agent claude-opus-5 3235 35756 5
365 agent claude-opus-5 10015 38991 3
366 agent claude-opus-5 5721 49006 3
367 agent claude-opus-5 5621 54727 8
368 agent claude-opus-5 2274 60348 5
369 agent claude-opus-5 800 62622 3
370 agent claude-opus-5 2258 63422 3
371 agent claude-opus-5 460 65680 17
372 agent claude-opus-5 4178 66140 5
373 agent claude-opus-5 199 70318 6
374 agent claude-opus-5 852 70517 3
375 agent claude-opus-5 613 71369 17
376 agent claude-opus-5 789 71982 17
377 agent claude-opus-5 2724 72771 3
378 agent claude-opus-5 2216 75495 2
379 agent claude-opus-5 2691 77711 17
380 agent claude-opus-5 3520 80402 3
381 agent claude-opus-5 2736 83922 20
382 agent claude-opus-5 3348 86658 4
383 agent claude-opus-5 2035 90006 3
384 agent claude-opus-5 2791 92041 2
385 agent claude-opus-5 1052 94832 2
386 agent claude-opus-5 655 95884 17
387 agent claude-opus-5 227 96539 17
388 agent claude-opus-5 2154 96766 2
389 agent claude-opus-5 1475 98920 10
390 agent claude-opus-5 4318 100395 2
391 agent claude-opus-5 1613 104713 216
392 agent claude-opus-5 1556 106326 2
393 agent claude-opus-5 2005 107882 129
394 agent claude-opus-5 1014 109887 2
395 agent claude-opus-5 2541 110901 17
396 agent claude-opus-5 809 113442 3
397 agent claude-opus-5 1991 114251 2
398 agent claude-opus-5 1108 116242 17
399 agent claude-opus-5 1040 117350 3
400 agent claude-opus-5 1170 118390 3
401 agent claude-opus-5 1240 119560 20
402 agent claude-opus-5 415 120800 3
403 agent claude-opus-5 5090 121215 2
404 agent claude-opus-5 1266 126305 21
405 agent claude-opus-5 543 127571 17
406 agent claude-opus-5 910 128114 17
407 agent claude-opus-5 447 129024 16
408 agent claude-opus-5 552 129471 4
409 agent claude-opus-5 1118 130023 3
410 agent claude-opus-5 636 131141 17
411 agent claude-opus-5 706 131777 4
412 agent claude-opus-5 887 132483 4
413 agent claude-opus-5 836 133370 4
414 agent claude-opus-5 584 134206 20
415 agent claude-opus-5 405 134790 17
416 agent claude-opus-5 5031 135195 3
417 agent claude-opus-5 1417 140226 3
418 agent claude-opus-5 1228 141643 17
419 agent claude-opus-5 1296 142871 3
420 agent claude-opus-5 660 144167 5
421 agent claude-opus-5 286 144827 20
422 agent claude-opus-5 906 145113 16
423 agent claude-opus-5 1622 146019 2
424 agent claude-opus-5 1266 147641 9
425 agent claude-opus-5 890 148907 3
426 agent claude-opus-5 1038 149797 20
427 agent claude-opus-5 434 150835 2
428 agent claude-opus-5 486 151269 17
429 agent claude-opus-5 645 151755 2
430 agent claude-opus-5 4909 152400 2
431 agent claude-opus-5 17051 157309 213
432 agent claude-opus-5 608 174360 4
433 agent claude-opus-5 645 174968 21
434 agent claude-opus-5 1785 175613 3
435 agent claude-opus-5 6109 177398 14
436 agent claude-opus-5 623 183507 3
437 agent claude-opus-5 770 184130 6
438 agent claude-opus-5 201 184900 16
439 agent claude-opus-5 6536 185101 5
440 agent claude-opus-5 750 191637 17
441 agent claude-opus-5 1018 192387 3
442 agent claude-opus-5 829 193405 17
443 agent claude-opus-5 191 194234 1
444 agent claude-sonnet-5 10179 7828 2
445 agent claude-sonnet-5 4180 18007 2
446 agent claude-sonnet-5 308 22187 2
447 agent claude-sonnet-5 409 22495 20
448 agent claude-sonnet-5 394 22904 2
449 agent claude-sonnet-5 188 23298 3
450 agent claude-sonnet-5 820 23486 2
451 agent claude-sonnet-5 399 24306 5
452 agent claude-sonnet-5 866 24705 1
453 agent claude-sonnet-5 199 25571 20
454 agent claude-sonnet-5 142 25770 1
455 agent claude-sonnet-5 6975 11475 4
456 agent claude-sonnet-5 3724 18450 4
457 agent claude-sonnet-5 2748 22174 2
458 agent claude-sonnet-5 749 24922 2
459 agent claude-sonnet-5 2387 25671 20
460 agent claude-sonnet-5 1393 28058 5
461 agent claude-sonnet-5 1647 29451 2
462 agent claude-sonnet-5 1991 31098 3
463 agent claude-sonnet-5 708 33089 8
464 agent claude-sonnet-5 2348 33797 7
465 agent claude-sonnet-5 3499 36145 3
466 agent claude-sonnet-5 1063 39644 4
467 agent claude-sonnet-5 1060 40707 3
468 agent claude-sonnet-5 716 41767 151
469 agent claude-sonnet-5 421 42483 9
470 agent claude-sonnet-5 3680 42904 8
471 agent claude-sonnet-5 2021 46584 5
472 agent claude-sonnet-5 881 48605 5
473 agent claude-sonnet-5 365 49486 2
474 agent claude-sonnet-5 681 49851 4
475 agent claude-sonnet-5 6121 50532 2
476 agent claude-sonnet-5 1211 56653 2
477 agent claude-sonnet-5 2884 57864 2
478 agent claude-sonnet-5 229 60748 20
479 agent claude-sonnet-5 1244 60977 3
480 agent claude-sonnet-5 2406 62221 3
481 agent claude-sonnet-5 333 64627 20
482 agent claude-sonnet-5 355 64960 3
483 agent claude-sonnet-5 397 65315 5
484 agent claude-sonnet-5 1328 65712 3
485 agent claude-sonnet-5 2735 67040 7
486 agent claude-sonnet-5 1062 69775 3
487 agent claude-sonnet-5 2308 70837 2
488 agent claude-sonnet-5 607 73145 20
489 agent claude-sonnet-5 367 73752 2
490 agent claude-sonnet-5 527 74119 6
491 agent claude-sonnet-5 1065 74646 17
492 agent claude-sonnet-5 527 75711 17
493 agent claude-sonnet-5 378 76238 17
494 agent claude-sonnet-5 385 76616 2
495 agent claude-sonnet-5 565 77001 2
496 agent claude-sonnet-5 449 77566 2
497 agent claude-sonnet-5 913 78015 9
498 agent claude-sonnet-5 209 78928 5
499 agent claude-sonnet-5 311 79137 2
500 agent claude-sonnet-5 258 79448 3
501 agent claude-sonnet-5 7082 11475 3
502 agent claude-sonnet-5 4116 18557 5
503 agent claude-sonnet-5 3292 22673 20
504 agent claude-sonnet-5 4562 25965 3
505 agent claude-sonnet-5 4722 30527 3
506 agent claude-sonnet-5 2374 35249 2
507 agent claude-sonnet-5 1712 37623 8
508 agent claude-sonnet-5 3687 39335 10
509 agent claude-sonnet-5 4002 43022 8
510 agent claude-sonnet-5 4596 47024 4
511 agent claude-sonnet-5 4845 51620 5
512 agent claude-sonnet-5 2694 56465 3
513 agent claude-sonnet-5 1522 59159 3
514 agent claude-sonnet-5 6301 60681 7
515 agent claude-sonnet-5 1369 66982 7
516 agent claude-sonnet-5 2351 68351 3
517 agent claude-sonnet-5 3956 70702 5
518 agent claude-sonnet-5 3836 74658 3
519 agent claude-sonnet-5 1199 78494 20
520 agent claude-sonnet-5 2216 79693 20
521 agent claude-sonnet-5 772 81909 2
522 agent claude-sonnet-5 806 82681 5
523 agent claude-sonnet-5 1168 83487 2
524 agent claude-sonnet-5 956 84655 3
525 agent claude-sonnet-5 403 85611 2
526 agent claude-sonnet-5 2551 86014 5
527 agent claude-sonnet-5 1513 88565 2
528 agent claude-sonnet-5 391 90078 1
529 agent claude-sonnet-5 2275 90469 2
530 agent claude-sonnet-5 1887 92744 1
531 agent claude-sonnet-5 289 94631 6
532 agent claude-sonnet-5 492 94920 4
533 agent claude-sonnet-5 349 95412 8
534 agent claude-sonnet-5 0 96461 2548
535 agent claude-haiku-4-5-20251001 13556 0 4
536 agent claude-haiku-4-5-20251001 1957 13556 2
537 agent claude-haiku-4-5-20251001 767 15513 1
538 agent claude-haiku-4-5-20251001 635 16280 4
539 agent claude-haiku-4-5-20251001 425 16915 2
540 agent claude-haiku-4-5-20251001 629 17340 3
541 agent claude-haiku-4-5-20251001 754 17969 4
542 agent claude-haiku-4-5-20251001 1666 18723 3
543 agent claude-haiku-4-5-20251001 316 20389 4
544 agent claude-haiku-4-5-20251001 183 20705 4
545 agent claude-opus-5 30787 0 1
546 agent claude-opus-5 4724 30787 1
547 agent claude-opus-5 2904 35511 2
548 agent claude-opus-5 1770 38415 3
549 agent claude-opus-5 5511 40185 5
550 agent claude-opus-5 6347 45696 3
551 agent claude-opus-5 10565 52043 3
552 agent claude-opus-5 9855 62608 2
553 agent claude-opus-5 3717 72463 20
554 agent claude-opus-5 2495 76180 5
555 agent claude-opus-5 2192 78675 21
556 agent claude-opus-5 3951 80867 3
557 agent claude-opus-5 5653 84818 2
558 agent claude-opus-5 4055 90471 7
559 agent claude-opus-5 5029 94526 3
560 agent claude-opus-5 2159 99555 2
561 agent claude-opus-5 5584 101714 3
562 agent claude-opus-5 2729 107298 3
563 agent claude-opus-5 4649 110027 2
564 agent claude-opus-5 4233 114676 2
565 agent claude-opus-5 3035 118909 3
566 agent claude-opus-5 3601 121944 3
567 agent claude-opus-5 2523 125545 3
568 agent claude-opus-5 1985 128068 5
569 agent claude-opus-5 481 130053 17
570 agent claude-opus-5 316 130534 3
571 agent claude-opus-5 220 130850 17
572 agent claude-opus-5 191 131070 20
573 agent claude-opus-5 474 131261 17
574 agent claude-opus-5 203 131735 17
575 agent claude-opus-5 334 131938 7
576 agent claude-opus-5 249 132272 16
577 agent claude-opus-5 363 132521 16
578 agent claude-opus-5 364 132884 2
579 agent claude-opus-5 747 133248 2
580 agent claude-opus-5 578 133995 20
581 agent claude-opus-5 370 134573 3
582 agent claude-opus-5 634 134943 2
583 agent claude-opus-5 1811 135577 2
584 agent claude-opus-5 2101 137388 2
585 agent claude-opus-5 429 139489 17
586 agent claude-opus-5 468 139918 2
587 agent claude-opus-5 4721 140386 3
588 agent claude-opus-5 12813 145107 17
589 agent claude-opus-5 599 157920 3
590 agent claude-opus-5 217 158519 20
591 agent claude-opus-5 1026 158736 21
592 agent claude-opus-5 2362 159762 2
593 agent claude-opus-5 950 162124 17
594 agent claude-opus-5 356 163074 21
595 agent claude-opus-5 2368 163430 8
596 agent claude-opus-5 735 165798 6
597 agent claude-opus-5 197 166533 16
598 agent claude-opus-5 7740 166730 20
599 agent claude-opus-5 704 174470 5
600 agent claude-opus-5 353 175174 1
601 agent claude-opus-5 157646 17190 10
602 agent claude-opus-5 1558 174836 16
603 agent claude-opus-5 1763 176394 2
604 agent claude-opus-5 2274 178157 20
605 agent claude-opus-5 583 180431 3
606 agent claude-opus-5 1069 181014 3
607 agent claude-opus-5 6114 182083 3
608 agent claude-opus-5 2972 188197 3
609 agent claude-opus-5 1196 191169 20
610 agent claude-opus-5 2595 192365 20
611 agent claude-opus-5 894 194960 3
612 agent claude-opus-5 644 195854 20
613 agent claude-opus-5 666 196498 2
614 agent claude-opus-5 584 197164 4
615 agent claude-opus-5 1333 197748 20
616 agent claude-opus-5 2937 199081 2
617 agent claude-opus-5 4387 202018 3
618 agent claude-opus-5 1416 206405 2
619 agent claude-opus-5 1102 207821 2
620 agent claude-opus-5 1997 208923 2
621 agent claude-opus-5 282 210920 17
622 agent claude-opus-5 432 211202 16
623 agent claude-opus-5 357 211634 3
624 agent claude-opus-5 925 211991 2
625 agent claude-opus-5 1688 212916 20
626 agent claude-opus-5 370 214604 1
627 agent claude-haiku-4-5-20251001 13025 0 4
628 agent claude-haiku-4-5-20251001 1575 13025 2
629 agent claude-haiku-4-5-20251001 484 14600 4
630 agent claude-haiku-4-5-20251001 526 15084 2
631 agent claude-haiku-4-5-20251001 7567 15610 2
632 agent claude-haiku-4-5-20251001 1710 23177 3
633 agent claude-haiku-4-5-20251001 289 24887 4
634 agent claude-sonnet-5 7122 11475 4
635 agent claude-sonnet-5 3412 18597 5
636 agent claude-sonnet-5 423 22009 21
637 agent claude-sonnet-5 3825 22432 8
638 agent claude-sonnet-5 1055 26257 20
639 agent claude-sonnet-5 26269 27312 3
640 agent claude-sonnet-5 1874 53581 10
641 agent claude-sonnet-5 11006 55455 3
642 agent claude-sonnet-5 9774 66461 2
643 agent claude-sonnet-5 371 76235 3
644 agent claude-sonnet-5 1325 76606 20
645 agent claude-sonnet-5 2760 77931 3
646 agent claude-sonnet-5 642 80691 20
647 agent claude-sonnet-5 725 81333 20
648 agent claude-sonnet-5 986 82058 3
649 agent claude-sonnet-5 932 83044 3
650 agent claude-sonnet-5 778 83976 2
651 agent claude-sonnet-5 982 84754 3
652 agent claude-sonnet-5 314 85736 2
653 agent claude-sonnet-5 599 86050 2
654 agent claude-sonnet-5 1438 86649 2
655 agent claude-sonnet-5 776 88087 2
656 agent claude-sonnet-5 337 88863 3
657 agent claude-sonnet-5 559 89200 4
658 agent claude-sonnet-5 366 89759 3
659 agent claude-sonnet-5 2123 90125 2
660 agent claude-sonnet-5 3412 92248 2
661 agent claude-sonnet-5 720 95660 2
662 agent claude-sonnet-5 415 96380 5
663 agent claude-sonnet-5 1140 96795 20
664 agent claude-sonnet-5 310 97935 17
665 agent claude-sonnet-5 2273 98245 2
666 agent claude-sonnet-5 1915 100518 6
667 agent claude-sonnet-5 2735 102433 3
668 agent claude-sonnet-5 1434 105168 3
669 agent claude-sonnet-5 531 106602 116
670 agent claude-sonnet-5 1633 107133 116
671 agent claude-sonnet-5 720 108766 4
672 agent claude-sonnet-5 3206 109486 5
673 agent claude-sonnet-5 170 112692 20
674 agent claude-sonnet-5 332 112862 17
675 agent claude-sonnet-5 206 113194 16
676 agent claude-sonnet-5 802 113400 5
677 agent claude-sonnet-5 2307 114202 3
678 agent claude-sonnet-5 259 116509 3
679 agent claude-sonnet-5 4462 116768 2
680 agent claude-sonnet-5 166 121230 88
681 agent claude-sonnet-5 1390 121396 2
682 agent claude-sonnet-5 896 122786 4
683 agent claude-sonnet-5 612 123682 6
684 agent claude-sonnet-5 1468 124294 3
685 agent claude-sonnet-5 352 125762 3
686 agent claude-sonnet-5 1109 126114 20
687 agent claude-sonnet-5 425 127223 7
688 agent claude-sonnet-5 889 127648 6
689 agent claude-sonnet-5 1016 128537 2
690 agent claude-sonnet-5 205 129553 20
691 agent claude-sonnet-5 154 129758 20
692 agent claude-sonnet-5 698 129912 9
693 agent claude-sonnet-5 928 130610 9
694 agent claude-sonnet-5 480 131538 8
695 agent claude-sonnet-5 309 132018 1
696 agent claude-sonnet-5 119457 11467 5
697 agent claude-sonnet-5 1710 130924 2
698 agent claude-sonnet-5 1404 132634 4
699 agent claude-sonnet-5 615 134038 2
700 agent claude-sonnet-5 1096 134653 17
701 agent claude-sonnet-5 957 135749 6
702 agent claude-sonnet-5 605 136706 17
703 agent claude-sonnet-5 308 137311 2
704 agent claude-sonnet-5 713 137619 17
705 agent claude-sonnet-5 368 138332 4
706 agent claude-sonnet-5 229 138700 2
707 agent claude-sonnet-5 1058 138929 20
708 agent claude-sonnet-5 172 139987 2
709 agent claude-sonnet-5 14482 140159 4
710 agent claude-sonnet-5 758 154641 2
711 agent claude-sonnet-5 3436 155399 2
712 agent claude-sonnet-5 661 158835 3
713 agent claude-sonnet-5 2873 159496 3
714 agent claude-sonnet-5 2691 162369 3
715 agent claude-sonnet-5 631 165060 3
716 agent claude-sonnet-5 6337 165691 4
717 agent claude-sonnet-5 455 172028 3
718 agent claude-sonnet-5 215 172483 6
719 agent claude-sonnet-5 512 172698 8
720 agent claude-sonnet-5 5091 173210 2
721 agent claude-sonnet-5 370 178301 8
722 agent claude-sonnet-5 590 178671 20
723 agent claude-sonnet-5 827 179261 1
724 agent claude-sonnet-5 4948 180088 2
725 agent claude-sonnet-5 7826 185036 3
726 agent claude-sonnet-5 2402 192862 3
727 agent claude-sonnet-5 1620 195264 2
728 agent claude-sonnet-5 2255 196884 2
729 agent claude-sonnet-5 2151 199139 5
730 agent claude-sonnet-5 1438 201290 3
731 agent claude-sonnet-5 1141 202728 6
732 agent claude-sonnet-5 872 203869 2
733 agent claude-sonnet-5 2187 204741 3
734 agent claude-sonnet-5 499 206928 6
735 agent claude-sonnet-5 286 207427 2
736 agent claude-sonnet-5 1542 207713 2
737 agent claude-sonnet-5 650 209255 20
738 agent claude-sonnet-5 789 209905 2
739 agent claude-sonnet-5 1320 210694 2
740 agent claude-sonnet-5 1105 212014 3
741 agent claude-sonnet-5 1554 213119 2
742 agent claude-sonnet-5 1262 214673 9
743 agent claude-sonnet-5 815 215935 3
744 agent claude-sonnet-5 1037 216750 2
745 agent claude-sonnet-5 625 217787 20
746 agent claude-sonnet-5 154 218412 20
747 agent claude-sonnet-5 196 218566 2
748 agent claude-sonnet-5 1252 218762 2
749 agent claude-sonnet-5 1966 220014 2
750 agent claude-sonnet-5 218 221980 20
751 agent claude-sonnet-5 2372 222198 3
752 agent claude-sonnet-5 735 224570 2
753 agent claude-sonnet-5 1019 225305 1
754 agent claude-sonnet-5 281 226324 1660
755 agent claude-sonnet-5 212555 11467 5
756 agent claude-sonnet-5 1973 224022 7
757 agent claude-sonnet-5 1366 225995 2
758 agent claude-sonnet-5 2697 227361 3
759 agent claude-sonnet-5 8586 230058 8
760 agent claude-sonnet-5 5430 238644 3
761 agent claude-sonnet-5 5720 244074 3
762 agent claude-sonnet-5 1455 249794 2
763 agent claude-sonnet-5 503 251249 20
764 agent claude-sonnet-5 829 251752 3
765 agent claude-sonnet-5 1736 252581 3
766 agent claude-sonnet-5 3150 254317 3
767 agent claude-sonnet-5 1053 257467 3
768 agent claude-sonnet-5 1404 258520 2
769 agent claude-sonnet-5 872 259924 3
770 agent claude-sonnet-5 1104 260796 1
771 agent claude-sonnet-5 272 261900 2
772 agent claude-sonnet-5 18509 0 4
773 agent claude-sonnet-5 2494 18509 5
774 agent claude-sonnet-5 231 21003 71
775 agent claude-sonnet-5 1811 21234 3
776 agent claude-sonnet-5 473 23045 3
777 agent claude-sonnet-5 1443 23518 2
778 agent claude-sonnet-5 1620 24961 3
779 agent claude-sonnet-5 3329 26581 7
780 agent claude-sonnet-5 6904 29910 1
781 agent claude-sonnet-5 404 36814 8
782 agent claude-sonnet-5 192 37218 9
783 agent claude-sonnet-5 1446 37410 5
784 agent claude-sonnet-5 1178 38856 17
785 agent claude-sonnet-5 405 40034 2
786 agent claude-sonnet-5 1697 40439 2
787 agent claude-sonnet-5 945 42136 132
788 agent claude-sonnet-5 1776 43081 2
789 agent claude-sonnet-5 1907 44857 2
790 agent claude-sonnet-5 749 46764 2
791 agent claude-sonnet-5 1475 47513 3
792 agent claude-sonnet-5 2959 48988 2
793 agent claude-sonnet-5 713 51947 17
794 agent claude-sonnet-5 625 52660 17
795 agent claude-sonnet-5 533 53285 20
796 agent claude-sonnet-5 1071 53818 3
797 agent claude-sonnet-5 1180 54889 4
798 agent claude-sonnet-5 1220 56069 8
799 agent claude-sonnet-5 1104 57289 1
800 agent claude-haiku-4-5-20251001 12676 0 4
801 agent claude-haiku-4-5-20251001 1478 12676 2
802 agent claude-haiku-4-5-20251001 486 14154 2
803 agent claude-haiku-4-5-20251001 446 14640 2
804 agent claude-haiku-4-5-20251001 1213 15086 2
805 agent claude-haiku-4-5-20251001 421 16299 5
806 agent claude-haiku-4-5-20251001 12324 0 4
807 agent claude-haiku-4-5-20251001 1549 12324 2
808 agent claude-haiku-4-5-20251001 429 13873 2
809 agent claude-haiku-4-5-20251001 631 14302 2
810 agent claude-haiku-4-5-20251001 692 14933 3
811 agent claude-haiku-4-5-20251001 382 15625 4
812 agent claude-haiku-4-5-20251001 13067 0 4
813 agent claude-haiku-4-5-20251001 1671 13067 2
814 agent claude-haiku-4-5-20251001 194 14738 2
815 agent claude-haiku-4-5-20251001 353 14932 1
816 agent claude-haiku-4-5-20251001 4197 15285 1
817 agent claude-haiku-4-5-20251001 1100 19482 2
818 agent claude-haiku-4-5-20251001 227 20582 1
819 agent claude-haiku-4-5-20251001 487 20809 2
820 agent claude-haiku-4-5-20251001 1278 21296 1
821 agent claude-haiku-4-5-20251001 315 22574 1
822 agent claude-haiku-4-5-20251001 200 22889 2
823 agent claude-haiku-4-5-20251001 219 23089 2
824 agent claude-haiku-4-5-20251001 635 23308 1
825 agent claude-haiku-4-5-20251001 1315 23943 2
826 agent claude-haiku-4-5-20251001 298 25258 4
827 agent claude-haiku-4-5-20251001 302 25556 4
828 agent claude-haiku-4-5-20251001 12607 0 4
829 agent claude-haiku-4-5-20251001 1620 12607 2
830 agent claude-haiku-4-5-20251001 583 14227 2
831 agent claude-haiku-4-5-20251001 186 14810 2
832 agent claude-haiku-4-5-20251001 3518 14996 2
833 agent claude-haiku-4-5-20251001 1433 18514 2
834 agent claude-haiku-4-5-20251001 1153 19947 2
835 agent claude-haiku-4-5-20251001 285 21100 5
836 agent claude-sonnet-5 16936 0 5
837 agent claude-sonnet-5 2713 16936 4
838 agent claude-sonnet-5 1661 19649 20
839 agent claude-sonnet-5 13698 21310 3
840 agent claude-sonnet-5 465 35008 17
841 agent claude-sonnet-5 15139 35473 10
842 agent claude-sonnet-5 2837 50612 2
843 agent claude-sonnet-5 8897 53449 3
844 agent claude-sonnet-5 1351 62346 3
845 agent claude-sonnet-5 881 63697 3
846 agent claude-sonnet-5 10012 64578 2
847 agent claude-sonnet-5 7111 74590 5
848 agent claude-sonnet-5 545 81701 9
849 agent claude-sonnet-5 23481 82246 3
850 agent claude-sonnet-5 3569 105727 2
851 agent claude-sonnet-5 10056 109296 3
852 agent claude-sonnet-5 3591 119352 3
853 agent claude-sonnet-5 1326 122943 9
854 agent claude-sonnet-5 4251 124269 3
855 agent claude-sonnet-5 1949 128520 3
856 agent claude-sonnet-5 585 130469 20
857 agent claude-sonnet-5 1831 131054 3
858 agent claude-sonnet-5 1419 132885 4
859 agent claude-sonnet-5 956 134304 20
860 agent claude-sonnet-5 1648 135260 4
861 agent claude-sonnet-5 867 136908 2
862 agent claude-sonnet-5 420 137775 2
863 agent claude-sonnet-5 936 138195 3
864 agent claude-sonnet-5 5350 139131 2
865 agent claude-sonnet-5 1308 144481 2
866 agent claude-sonnet-5 1238 145789 2
867 agent claude-sonnet-5 362 147027 4
868 agent claude-haiku-4-5-20251001 12818 0 2
869 agent claude-haiku-4-5-20251001 1859 12818 2
870 agent claude-haiku-4-5-20251001 639 14677 2
871 agent claude-haiku-4-5-20251001 480 15316 2
872 agent claude-haiku-4-5-20251001 2736 15796 2
873 agent claude-haiku-4-5-20251001 404 18532 5
874 agent claude-haiku-4-5-20251001 13141 0 4
875 agent claude-haiku-4-5-20251001 1773 13141 1
876 agent claude-haiku-4-5-20251001 952 14914 2
877 agent claude-haiku-4-5-20251001 819 15866 3
878 agent claude-haiku-4-5-20251001 3639 16685 3
879 agent claude-haiku-4-5-20251001 286 20324 4
880 agent claude-haiku-4-5-20251001 12415 0 4
881 agent claude-haiku-4-5-20251001 1702 12415 1
882 agent claude-haiku-4-5-20251001 708 14117 2
883 agent claude-haiku-4-5-20251001 240 14825 2
884 agent claude-haiku-4-5-20251001 337 15065 4
885 agent claude-haiku-4-5-20251001 1419 15402 2
886 agent claude-haiku-4-5-20251001 4360 16821 2
887 agent claude-haiku-4-5-20251001 2242 21181 2
888 agent claude-haiku-4-5-20251001 652 23423 4
889 agent claude-haiku-4-5-20251001 311 24075 4
890 agent claude-sonnet-5 7079 11467 5
891 agent claude-sonnet-5 2380 18546 4
892 agent claude-sonnet-5 5016 20926 4
893 agent claude-sonnet-5 2578 25942 3
894 agent claude-sonnet-5 1150 28520 5
895 agent claude-sonnet-5 2641 29670 8
896 agent claude-sonnet-5 5613 32311 4
897 agent claude-sonnet-5 604 37924 17
898 agent claude-sonnet-5 401 38528 17
899 agent claude-sonnet-5 390 38929 2
900 agent claude-sonnet-5 520 39319 20
901 agent claude-sonnet-5 1364 39839 3
902 agent claude-sonnet-5 763 41203 20
903 agent claude-sonnet-5 192 41966 20
904 agent claude-sonnet-5 300 42158 21
905 agent claude-sonnet-5 500 42458 8
906 agent claude-sonnet-5 1043 42958 2
907 agent claude-sonnet-5 934 44001 21
908 agent claude-sonnet-5 488 44935 21
909 agent claude-sonnet-5 410 45423 8
910 agent claude-sonnet-5 1038 45833 2
911 agent claude-sonnet-5 300 46871 2
912 agent claude-sonnet-5 487 47171 16
913 agent claude-sonnet-5 499 47658 16
914 agent claude-sonnet-5 499 48157 7
915 agent claude-sonnet-5 605 48656 3
916 agent claude-sonnet-5 1657 49261 3
917 agent claude-sonnet-5 2294 50918 4
918 agent claude-sonnet-5 480 53212 17
919 agent claude-sonnet-5 1282 53692 20
920 agent claude-sonnet-5 313 54974 2
921 agent claude-sonnet-5 548 55287 2
922 agent claude-sonnet-5 1177 55835 3
923 agent claude-sonnet-5 271 57012 2
924 agent claude-sonnet-5 468 57283 4
925 agent claude-sonnet-5 716 57751 3
926 agent claude-sonnet-5 627 58467 2
927 agent claude-sonnet-5 336 59094 2
928 agent claude-sonnet-5 17907 0 3
929 agent claude-sonnet-5 2794 17907 2
930 agent claude-sonnet-5 1182 20701 3
931 agent claude-sonnet-5 411 21883 1
932 agent claude-sonnet-5 611 22294 20
933 agent claude-sonnet-5 2086 22905 296
934 agent claude-haiku-4-5-20251001 12577 0 1
935 agent claude-haiku-4-5-20251001 1657 12577 2
936 agent claude-haiku-4-5-20251001 469 14234 2
937 agent claude-haiku-4-5-20251001 248 14703 1
938 agent claude-haiku-4-5-20251001 249 14951 2
939 agent claude-haiku-4-5-20251001 658 15200 3
940 agent claude-haiku-4-5-20251001 1630 15858 2
941 agent claude-haiku-4-5-20251001 2122 17488 4
942 agent claude-haiku-4-5-20251001 368 19610 4
943 agent claude-sonnet-5 18414 0 4
944 agent claude-sonnet-5 3416 18414 4
945 agent claude-sonnet-5 2805 21830 3
946 agent claude-sonnet-5 4264 24635 134
947 agent claude-sonnet-5 12589 28899 10
948 agent claude-sonnet-5 1892 41488 2
949 agent claude-sonnet-5 166 43380 20
950 agent claude-sonnet-5 2332 43546 3
951 agent claude-sonnet-5 4322 45878 2
952 agent claude-sonnet-5 316 50200 88
953 agent claude-sonnet-5 586 50516 4
954 agent claude-sonnet-5 687 51102 1248
955 agent claude-haiku-4-5-20251001 13128 0 4
956 agent claude-haiku-4-5-20251001 3079 13128 2
957 agent claude-haiku-4-5-20251001 456 16207 2
958 agent claude-haiku-4-5-20251001 2030 16663 2
959 agent claude-haiku-4-5-20251001 299 18693 2
960 agent claude-sonnet-5 6581 11477 4
961 agent claude-sonnet-5 2631 18058 4
962 agent claude-sonnet-5 1547 20689 5
963 agent claude-sonnet-5 1560 22236 2
964 agent claude-sonnet-5 772 23796 3
965 agent claude-sonnet-5 667 24568 3
966 agent claude-sonnet-5 312 25235 2
967 agent claude-sonnet-5 1170 25547 1
968 agent claude-sonnet-5 796 26717 1
969 agent claude-sonnet-5 6571 11477 4
970 agent claude-sonnet-5 3216 18048 2
971 agent claude-sonnet-5 799 21264 3
972 agent claude-sonnet-5 684 22063 147
973 agent claude-sonnet-5 475 22747 1
974 agent claude-sonnet-5 314 23222 1
975 agent claude-sonnet-5 6527 11477 3
976 agent claude-sonnet-5 3585 18004 2
977 agent claude-sonnet-5 1157 21589 2
978 agent claude-sonnet-5 359 22746 20
979 agent claude-sonnet-5 152 23105 2
980 agent claude-sonnet-5 2953 23257 2
981 agent claude-sonnet-5 768 26210 2
982 agent claude-sonnet-5 320 26978 2
983 agent claude-sonnet-5 322 27298 2
984 agent claude-sonnet-5 260 27620 2
985 agent claude-sonnet-5 210 27880 9
986 agent claude-sonnet-5 335 28090 1
987 agent claude-haiku-4-5-20251001 12821 0 4
988 agent claude-haiku-4-5-20251001 1839 12821 2
989 agent claude-haiku-4-5-20251001 1741 14660 2
990 agent claude-haiku-4-5-20251001 1831 16401 2
991 agent claude-haiku-4-5-20251001 476 18232 2
992 agent claude-haiku-4-5-20251001 229 18708 4
993 agent claude-sonnet-5 7026 11477 5
994 agent claude-sonnet-5 2337 18503 2
995 agent claude-sonnet-5 2403 20840 2
996 agent claude-sonnet-5 868 23243 3
997 agent claude-sonnet-5 748 24111 8
998 agent claude-sonnet-5 2520 24859 4
999 agent claude-sonnet-5 728 27379 3
1000 agent claude-sonnet-5 1501 28107 8
1001 agent claude-sonnet-5 432 29608 17
1002 agent claude-sonnet-5 449 30040 2
1003 agent claude-sonnet-5 337 30489 2
1004 agent claude-sonnet-5 681 30826 5
1005 agent claude-sonnet-5 226 31507 2
1006 agent claude-sonnet-5 398 31733 20
1007 agent claude-sonnet-5 274 32131 16
1008 agent claude-sonnet-5 420 32405 2
1009 agent claude-sonnet-5 830 32825 5
1010 agent claude-sonnet-5 751 33655 174
1011 agent claude-sonnet-5 442 34406 9
1012 agent claude-sonnet-5 579 34848 2
1013 agent claude-sonnet-5 601 35427 20
1014 agent claude-sonnet-5 303 36028 5
1015 agent claude-sonnet-5 181 36331 20
1016 agent claude-sonnet-5 1132 36512 4
1017 agent claude-sonnet-5 456 37644 3
1018 agent claude-sonnet-5 346 38100 1
1019 agent claude-sonnet-5 252 38446 1
1020 agent claude-sonnet-5 1636 38698 8
1021 agent claude-sonnet-5 1420 40334 2
1022 agent claude-sonnet-5 1427 41754 1
1023 agent claude-sonnet-5 6958 11475 4
1024 agent claude-sonnet-5 3557 18433 3
1025 agent claude-sonnet-5 3037 21990 20
1026 agent claude-sonnet-5 3530 25027 3
1027 agent claude-sonnet-5 20459 28557 3
1028 agent claude-sonnet-5 2950 49016 4
1029 agent claude-sonnet-5 2702 51966 2
1030 agent claude-sonnet-5 6236 54668 2
1031 agent claude-sonnet-5 11339 60904 3
1032 agent claude-sonnet-5 9099 72243 3
1033 agent claude-sonnet-5 1026 81342 7
1034 agent claude-sonnet-5 2600 82368 3
1035 agent claude-sonnet-5 361 84968 3
1036 agent claude-sonnet-5 2078 85329 2
1037 agent claude-sonnet-5 320 87407 17
1038 agent claude-sonnet-5 2425 87727 2
1039 agent claude-sonnet-5 2503 90152 3
1040 agent claude-sonnet-5 495 92655 8
1041 agent claude-sonnet-5 6468 93150 3
1042 agent claude-sonnet-5 515 99618 4
1043 agent claude-sonnet-5 1088 100133 4
1044 agent claude-sonnet-5 3457 101221 2
1045 agent claude-sonnet-5 246 104678 20
1046 agent claude-sonnet-5 560 104924 6
1047 agent claude-sonnet-5 607 105484 2
1048 agent claude-sonnet-5 261 106091 2
1049 agent claude-sonnet-5 371 106352 2
1050 agent claude-sonnet-5 273 106723 9
1051 agent claude-sonnet-5 7180 11467 3
1052 agent claude-sonnet-5 2231 18647 5
1053 agent claude-sonnet-5 18350 20878 9
1054 agent claude-sonnet-5 2587 39228 2
1055 agent claude-sonnet-5 2160 41815 3
1056 agent claude-sonnet-5 4452 43975 2
1057 agent claude-sonnet-5 610 48427 8
1058 agent claude-sonnet-5 689 49037 8
1059 agent claude-sonnet-5 1407 49726 2
1060 agent claude-sonnet-5 643 51133 6
1061 agent claude-sonnet-5 4134 51776 2
1062 agent claude-sonnet-5 2044 55910 2
1063 agent claude-sonnet-5 1334 57954 20
1064 agent claude-sonnet-5 2227 59288 8
1065 agent claude-sonnet-5 507 61515 20
1066 agent claude-sonnet-5 1330 62022 10
1067 agent claude-sonnet-5 1998 63352 2
1068 agent claude-sonnet-5 1071 65350 3
1069 agent claude-sonnet-5 1232 66421 4
1070 agent claude-sonnet-5 1677 67653 20
1071 agent claude-sonnet-5 760 69330 17
1072 agent claude-sonnet-5 441 70090 17
1073 agent claude-sonnet-5 361 70531 20
1074 agent claude-sonnet-5 465 70892 1
1075 agent claude-sonnet-5 274 71357 1
1076 agent claude-sonnet-5 151 71631 1
1077 agent claude-sonnet-5 7051 11475 4
1078 agent claude-sonnet-5 6117 18526 2
1079 agent claude-sonnet-5 11899 24643 2
1080 agent claude-sonnet-5 950 36542 2
1081 agent claude-sonnet-5 611 37492 3
1082 agent claude-sonnet-5 1083 38103 2
1083 agent claude-sonnet-5 2355 39186 2
1084 agent claude-sonnet-5 567 41541 3
1085 agent claude-sonnet-5 891 42108 2
1086 agent claude-sonnet-5 543 42999 3
1087 agent claude-sonnet-5 463 43542 2
1088 agent claude-sonnet-5 483 44005 2
1089 agent claude-sonnet-5 1321 44488 3
1090 agent claude-sonnet-5 6655 45809 3
1091 agent claude-sonnet-5 3405 52464 5
1092 agent claude-sonnet-5 913 55869 5
1093 agent claude-sonnet-5 1620 56782 4
1094 agent claude-sonnet-5 425 58402 17
1095 agent claude-sonnet-5 318 58827 2
1096 agent claude-sonnet-5 3486 59145 7
1097 agent claude-sonnet-5 2198 62631 3
1098 agent claude-sonnet-5 3759 64829 4589
1099 agent claude-sonnet-5 5287 68588 5
1100 agent claude-sonnet-5 224 73875 20
1101 agent claude-sonnet-5 1291 74099 2
1102 agent claude-sonnet-5 2029 75390 4
1103 agent claude-sonnet-5 1701 77419 2
1104 agent claude-sonnet-5 485 79120 9
1105 agent claude-sonnet-5 810 79605 3
1106 agent claude-sonnet-5 351 80415 2
1107 agent claude-sonnet-5 1183 80766 1
1108 agent claude-sonnet-5 73544 7828 4
1109 agent claude-sonnet-5 4428 81372 4
1110 agent claude-sonnet-5 1345 85800 335
1111 agent claude-sonnet-5 13085 87145 3
1112 agent claude-sonnet-5 5620 100230 2
1113 agent claude-sonnet-5 5442 105850 5
1114 agent claude-sonnet-5 5488 111292 6
1115 agent claude-sonnet-5 2209 116780 17
1116 agent claude-sonnet-5 623 118989 17
1117 agent claude-sonnet-5 719 119612 17
1118 agent claude-sonnet-5 650 120331 6
1119 agent claude-sonnet-5 14268 120981 2
1120 agent claude-sonnet-5 6768 135249 3
1121 agent claude-sonnet-5 5554 142017 2
1122 agent claude-sonnet-5 4891 147571 6
1123 agent claude-sonnet-5 1346 152462 2
1124 agent claude-sonnet-5 17442 153808 2
1125 agent claude-sonnet-5 172 171250 20
1126 agent claude-sonnet-5 961 171422 17
1127 agent claude-sonnet-5 1508 172383 2
1128 agent claude-sonnet-5 2899 173891 20
1129 agent claude-sonnet-5 204 176790 2
1130 agent claude-sonnet-5 1302 176994 3
1131 agent claude-sonnet-5 4450 178296 2
1132 agent claude-sonnet-5 688 182746 20
1133 agent claude-sonnet-5 755 183434 5
1134 agent claude-sonnet-5 1264 184189 3
1135 agent claude-sonnet-5 1976 185453 20
1136 agent claude-sonnet-5 1119 187429 2
1137 agent claude-sonnet-5 1265 188548 2
1138 agent claude-sonnet-5 871 189813 2
1139 agent claude-sonnet-5 760 190684 2
1140 agent claude-sonnet-5 1184 191444 2
1141 agent claude-sonnet-5 582 192628 20
1142 agent claude-sonnet-5 305 193210 3
1143 agent claude-sonnet-5 1343 193515 17
1144 agent claude-sonnet-5 607 194858 20
1145 agent claude-sonnet-5 585 195465 2
1146 agent claude-sonnet-5 298 196050 3
1147 agent claude-sonnet-5 633 196348 2
1148 agent claude-sonnet-5 574 196981 3
1149 agent claude-sonnet-5 669 197555 20
1150 agent claude-sonnet-5 703 198224 3
1151 agent claude-sonnet-5 1258 198927 20
1152 agent claude-sonnet-5 756 200185 9
1153 agent claude-sonnet-5 1041 200941 2
1154 agent claude-sonnet-5 705 201982 1
1155 agent claude-sonnet-5 201 202687 8
1156 agent claude-sonnet-5 263 202888 2
1157 agent claude-sonnet-5 313 203151 20
1158 agent claude-sonnet-5 173 203464 3
1159 agent claude-sonnet-5 516 203637 6
1160 agent claude-sonnet-5 354 204153 2
1161 agent claude-sonnet-5 455 204507 2
1162 agent claude-sonnet-5 726 204962 2
1163 agent claude-sonnet-5 2250 205688 8
1164 agent claude-sonnet-5 722 207938 8
1165 agent claude-sonnet-5 723 208660 17
1166 agent claude-sonnet-5 588 209383 2
1167 agent claude-sonnet-5 602 209971 5
1168 agent claude-sonnet-5 7013 11475 4
1169 agent claude-sonnet-5 4070 18488 2
1170 agent claude-sonnet-5 3846 22558 5
1171 agent claude-sonnet-5 1136 26404 3
1172 agent claude-sonnet-5 3632 27540 7
1173 agent claude-sonnet-5 5060 31172 4
1174 agent claude-sonnet-5 5727 36232 3
1175 agent claude-sonnet-5 2190 41959 2
1176 agent claude-sonnet-5 2355 44149 2
1177 agent claude-sonnet-5 312 46504 5
1178 agent claude-sonnet-5 1990 46816 4
1179 agent claude-sonnet-5 200 48806 20
1180 agent claude-sonnet-5 2470 49006 3
1181 agent claude-sonnet-5 1970 51476 3
1182 agent claude-sonnet-5 382 53446 20
1183 agent claude-sonnet-5 166 53828 8
1184 agent claude-sonnet-5 2402 53994 2
1185 agent claude-sonnet-5 469 56396 9
1186 agent claude-sonnet-5 1392 56865 1
1187 agent claude-sonnet-5 234 58257 2
1188 agent claude-sonnet-5 6800 11467 4
1189 agent claude-sonnet-5 8089 18267 2
1190 agent claude-sonnet-5 1229 26356 125
1191 agent claude-sonnet-5 1042 27585 2
1192 agent claude-sonnet-5 1067 28627 2
1193 agent claude-sonnet-5 1020 29694 20
1194 agent claude-sonnet-5 452 30714 2
1195 agent claude-sonnet-5 271 31166 1
1196 agent claude-sonnet-5 127 31437 755
1197 agent claude-haiku-4-5-20251001 6489 6509 4
1198 agent claude-haiku-4-5-20251001 1697 12998 2
1199 agent claude-haiku-4-5-20251001 836 14695 2
1200 agent claude-haiku-4-5-20251001 354 15531 2
1201 agent claude-haiku-4-5-20251001 2189 15885 2
1202 agent claude-haiku-4-5-20251001 444 18074 2
-->
<!-- /cout -->

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

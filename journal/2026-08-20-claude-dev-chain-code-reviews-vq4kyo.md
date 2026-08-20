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

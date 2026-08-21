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
`docs/banc/releves.md`. Il couvre la chaine LOCALE ; la CI est une serie
separee, relevee le jour meme — voir la suite.

**Suite, le meme jour** — la serie CI est ouverte sur le run 383 (32476316321,
pull request, 10 apps, 49 controles verts) : **3 min 50 s**. Et le chemin
critique n'est AUCUNE des deux chaines soupconnees. Ni `test -> build`, ni
`bout-en-bout` : c'est `outillage (test-init.sh)`, **3 min 13 s a lui seul**,
puis `tests-de-l-outillage` et `deploy`. Les dix apps, leurs tests, leurs
revues, leurs suites en navigateur et leurs dix images tiennent toutes A
L'INTERIEUR de ces trois minutes ; le dernier job d'app finit 34 secondes avant
la fin du chemin critique.

Ce qui rend ce constat utile n'est pas le chiffre mais ce qu'il DEMENT : les
deux gisements de CI restants — le cache d'outils de la revue, l'absence de
cache du job `test` — sont reels et valent leur correction pour la facture de
runners, mais **aucun des deux ne raccourcira l'attente** tant que
`test-init.sh` tiendra le chemin. Sans la mesure, la journee suivante partait
du bon cote du probleme. C'est l'accident du 18 aout, a l'identique, evite
cette fois parce qu'un banc existait.

Note de comparabilite, ecrite pour celui qui lira la deuxieme ligne de la
serie : ce relevé ne se divise PAS par les 196 s du 18 aout. Ce chiffre valait
pour neuf apps et deux matrices, avant les vingt shards de `revue` et
`bout-en-bout`. Il n'y a rien a comparer ; cette ligne OUVRE la serie.

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

### 35. Le garde-fou des ports ne voyait pas les ports CALCULES — et il en avait cree deux lui-meme

**Symptome** — trouve par le `relecteur`, sur sa deuxieme mission. `--check`
annoncait « ports de bout en bout distincts entre apps » pendant que TROIS
paires se partageaient un port. Deux de ces trois collisions venaient d'etre
creees par le correctif de l'anomalie 28 : `hello-world` deplace en 18088 et
`marcq-handball` en 18089, precisement pour fuir une collision avec `estran`,
et atterrissant tous deux sur des ports que `ramure` occupait deja.

**Cause** — `check_e2e_ports` ne lisait que les defauts **litteraux**, de la
forme `${VAR:-NNNNN}`. `apps/ramure/e2e/lancer.sh` declare un port litteral et
en **calcule trois autres** :

```
PORT="${RAMURE_E2E_PORT:-18086}"
FIXTURE_PORT=$((PORT + 1))
PORT_PANNE=$((PORT + 2))
PORT_FERME=$((PORT + 3))
```

Trois ports occupes, invisibles au registre. Le troisieme est le plus vicieux :
`PORT_FERME` n'est pas un port qu'on ouvre, c'est un port qu'on garde **ferme**
pour simuler une source injoignable — son commentaire le dit, « personne
n'ecoute ici : toute connexion echoue ». Avec `marcq-handball` pose dessus, la
panne testee par `ramure` n'est plus une panne : le test passe au vert en ayant
verifie **l'exact contraire** de ce qu'il annonce.

La collision `ramure`/`renaissance-gym` sur 18087, elle, existait **depuis le
premier commit des dix suites** et personne ne l'avait vue — pas meme le
garde-fou ecrit pour ca.

**Detecte par** — `relecture`

**Action** — `garde-fou` — le controle resout desormais les formes
`$((BASE ± N))` quand la base est elle-meme au registre, et **refuse** une base
inconnue plutot que de hausser les epaules : sans ce cran, renommer une variable
suffirait a sortir un port du registre sans bruit. Quinze ports declares au lieu
de onze. Blocs contigus : `ramure` garde 18086-18089, `renaissance-gym` passe a
18090, `hello-world` a 18091, `marcq-handball` a 18092, `pilabelle` a 18093.
`ramure-v2` reste sur 8080, epingle volontairement — son binaire ne lit aucune
variable de port, et c'est documente dans son `lancer.sh`. Les cinq suites
deplacees ont ete rejouees : vertes.

Deux cas de plus dans `test-init.sh`, qui passe de 40 a 42 — un port derive qui
collisionne, et un port derive d'une base inconnue. Les deux cas existants
pointaient sur des ports qui ont bouge et ont ete rebranches : l'un serait
devenu une vraie collision et aurait echoue pour la mauvaise raison.

**Ce qu'il faut retenir n'est pas le trou, c'est ou il etait.** Un garde-fou
ecrit CONTRE les verts silencieux en etait un. Il annoncait un perimetre — « les
ports des dix apps » — et en couvrait une partie, sans jamais dire laquelle.
C'est mot pour mot l'anomalie 3 de cette branche (`jscpd` annoncant 0 % sur du
code qu'il n'avait pas lu), et la parade y etait deja ecrite : **un controle doit
comparer ce qu'il a lu a ce qu'il devait lire**. Elle avait ete appliquee a
`jscpd` et pas a celui-ci.

### 36. Le premier correctif de la lavande inversait la hierarchie des boutons

**Symptome** — la decision du 21 aout demandait que `button.secondaire` cesse
d'etre lavande. L'artisan a pose un fond `--encre-douce` a texte blanc. Tests
verts, contrastes mesures et excellents — 6,20:1 en base, 12,95:1 au survol —,
`axe` vert, revue verte. **Et l'ecran etait faux.**

Le bouton principal de `pilabelle` est un rose **pastel** (`--rose-300`). Un
secondaire fonce et plein l'ecrase : capture faite a 390 px sur l'ecran de
ressenti, les deux boutons secondaires attirent l'oeil avant le principal. Sur
cet ecran-la, l'app se mettait a pousser « Correct » et « Difficile » ; ailleurs,
« Plus tard » pesait plus lourd qu'« Activer ». L'engagement du PRD — « un seul
element par ecran porte l'action principale » — etait rompu par le correctif
cense servir la meme grammaire.

**Cause** — tous les tests de couleur de l'app mesuraient la **lisibilite d'un
bouton isole**, et aucun le **rapport** entre deux boutons. Un contraste de texte
ne dit rien du poids visuel : `--encre-douce` gagne les deux mesures qu'on lui
demandait et perd celle qu'on ne lui demandait pas.

**Detecte par** — `auteur`

**Action** — `garde-fou` — le secondaire passe en `--rose-100` avec un filet
`--rose-300` : le rose reste la famille du tapable — regle du 20 aout —, et les
deux poids de la famille disent les deux rangs. La lavande est bien partie, la
hierarchie est dans le bon sens, `--encre` sur `--rose-100` rend 10,74:1.

Le test qui manquait est ecrit : **le fond du secondaire doit avoir une
luminance relative superieure a celle du principal**, les deux lues dans la
feuille et resolues via `:root`. Contre-epreuve faite — fond fonce remis, le
test rougit, seul de son fichier. Un second tient qu'un secondaire garde un
**fond**, sans quoi il retomberait dans la forme des notes qui parlent.

**Un engagement de PRD qui est un RAPPORT se teste comme un rapport.** « Un seul
element par ecran porte l'action principale » ne se verifie pas en mesurant les
elements un par un — c'est ce que faisaient les quatorze tests precedents, tous
verts. Il a fallu une capture d'ecran pour voir ce qu'aucun chiffre ne disait, et
le chiffre qui l'aurait dit n'existait pas encore.

**Note honnete sur un effet de bord.** Ce correctif rend a « Facile » sa
dominance sur l'ecran de ressenti — ce que la critique du 20 aout reprochait
(« Facile est habille en bonne reponse »). Le fond fonce l'avait corrige **par
accident**, en assombrissant tous les secondaires de l'app. Ce n'est pas une
correction, c'est un effet de bord global d'un reglage local : le vrai
traitement de « Facile » est propre a son ecran, et le PRD le reserve
explicitement.

## Coût — la part de cette session, hors du bloc généré

**Ce paragraphe est écrit à la main, et il le reste.** Le bloc `## Coût`
ci-dessus est généré par `./scripts/cout.sh`, qui **remplace** son contenu à
chaque passage et ne lit que les sessions **du conteneur où il tourne**. Il a été
écrit le 2026-08-21 à 10:34 depuis un conteneur qui voyait trois sessions —
251 104 719 jetons, 142,50 $. Cette session-ci tourne dans un **autre** conteneur
et n'en voit qu'une : la relancer aurait remplacé 142,50 $ par 57,19 $ et perdu
la différence en silence. Elle n'a donc pas été relancée.

Relevé de cette session seule, le 2026-08-21 à 11:40 UTC (`--dry-run`) :

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 8 918 | 0,01 $ |
| Écriture de cache | 2 113 540 | 9,26 $ |
| Lecture de cache | 107 290 788 | 44,34 $ |
| Sortie | 186 088 | 3,59 $ |
| **Total** | **109 599 334** | **57,19 $ — 49,67 €** |

753 appels au modèle, dont **483 par des sous-agents** — deux artisans, trois
esthètes, un relecteur, chacun sur un contexte réduit plutôt que sur le mien.

**Et le poste le plus cher a EMPIRÉ : 547 tours sur 753 rendent moins de 300
jetons — 72 %, contre 67 % au relevé précédent —, pour 36,69 $, soit 64 % de la
facture de cette session.** Le contrat dit de grouper les appels indépendants
dans un même tour, la règle a été écrite hier, et elle est moins bien tenue
aujourd'hui qu'avant qu'on l'écrive. Écrire une règle ne la fait pas appliquer ;
c'est exactement ce que cette branche a passé deux jours à démontrer sur les
garde-fous, et le cas se reproduit sur celui qui ne tient qu'à une habitude.

### 37. Le relevé de coût se perd quand une branche traverse deux conteneurs

**Symptome** — au moment de relever le coût, `--dry-run` annonce 57,19 $ pour
« 1 session lisible depuis ce conteneur », alors que le bloc déjà écrit dans le
journal en porte 142,50 $ pour trois. Lancer `cout.sh` sans regarder aurait
remplacé le second par le premier.

**Cause** — `cout.sh` **remplace** le bloc, et ne lit que les sessions locales au
conteneur. Les deux comportements sont justes pris séparément et faux ensemble :
un relevé partiel écrase un relevé complet, sans avertissement, et le résultat
reste parfaitement bien formé. Rien ne distingue « la branche a coûté 57 $ » de
« la branche a coûté 57 $ dans ce conteneur-ci et on a perdu le reste ».

Le script **dit** sa limite — « celles des conteneurs précédents sont perdues » —
mais la dit dans le texte qu'il écrit, c'est-à-dire après avoir écrasé. Un
avertissement postérieur à l'action qu'il concerne n'est pas un garde-fou.

Cette branche est le premier cas : trois sessions, au moins deux conteneurs, et
deux sessions qui travaillent en parallèle sur la même entrée de journal.

**Detecte par** — `auteur`

**Action** — `rien` — traité à la main ici, et délibérément : le correctif juste
n'est pas évident. Faire cumuler `cout.sh` demanderait qu'il distingue « ce bloc
contient déjà des sessions que je ne peux plus lire » de « ce bloc est périmé »,
et un cumul faux serait pire qu'un remplacement franc — il gonflerait un chiffre
que personne ne pourrait plus vérifier.

La piste la moins mauvaise, si quelqu'un la reprend : que le bloc porte la
**liste des identifiants de session** déjà comptés, et que `cout.sh` refuse
d'écrire si le nouveau relevé en couvre strictement moins que le bloc en place —
la même forme de cliquet que la couverture, et pour la même raison. Un total qui
ne peut que monter, ou qui explique pourquoi il descend.
### 38. Le coupable evident coutait 0,4 s ; le vrai etait invisible

**Symptome** — le releve CI de la veille avait nomme le chemin critique :
`test-init.sh`, 3 min 13 s sur un run de 3 min 50 s. Restait a savoir pourquoi.
Le harnais est deja parallele, et la mesure le confirme : 40 cas, quatre en vol,
131,9 s pour 512 s de calcul cumule — **97 % d'efficacite**. Il n'y avait donc
rien a mieux repartir, seulement du travail a retirer.

Deux suspects. Le premier saute aux yeux : `check_traces_risques` parcourt
30 000 lignes de PRODUCT.md et de PRP en bash pur, ligne a ligne, et represente
a lui seul 30 000 des 258 000 commandes executees par une verification.
Neutralise, il fait gagner **0,4 seconde**.

Le vrai cout ne se voyait dans aucun profil de fonction : `yget`, le lecteur de
manifeste, enchaine `tr | sed | head` puis un second `sed`. Cinq processus,
plus la substitution qui l'entoure, **pour lire une ligne dans un fichier de
trente**. Il est appele 1 104 fois par verification — environ sept mille
processus — et la verification est jouee quarante fois par le harnais.

**Cause** — un lecteur ecrit pour etre lu, pas pour etre appele mille fois. Rien
dans sa forme ne dit ce qu'il coute : chaque appel pris isolement est
irreprochable. Le cout n'existe qu'au pluriel, et aucun des garde-fous du depot
ne compte les appels.

Ce qui rendait le diagnostic contre-intuitif : le nombre de COMMANDES designe
`check_traces_risques` (30 000 iterations), le nombre de PROCESSUS designe
`yget`. Ce sont deux mesures differentes, et seule la seconde predit le temps.
Compter les lignes de trace aurait fait travailler toute une journee du mauvais
cote.

**Detecte par** — `auteur`

**Action** — `rien` — corrige. `yget`, `ylist` et `valid_svc_name` ne lancent
plus un seul processus ; la semantique est celle d'avant a la lettre, verifiee
en comparant la sortie complete de `--check` **octet a octet**, avant et apres.
Verification : 13,2 s -> 7,6 s. Harnais : 131,9 s -> 66,3 s. Les cinq harnais
verts (40, 36, 14, 20, 15 cas). Le meme gain vaut pour `pret.sh` et pour le job
`contrat`, qui appellent la meme verification.

Pas de garde-fou propose, et c'est un choix : un controle qui refuserait un
`sed` dans une fonction chaude serait du bruit sur les quatre-vingt-dix-neuf
appels ou il ne coute rien. Ce qui manquait n'etait pas une regle, c'etait une
mesure — elle existe desormais, scenario `outillage` du banc.

**Deux gisements laisses en place, chiffres** : `load_app` est appelee 128 fois
pour 10 apps, et les substitutions `$(...)` qui entourent chaque lecture pesent
encore environ 2 100 forks. Le second demanderait de changer des centaines de
sites d'appel dans un script de 150 Ko qui garde les dix apps d'un bloc. Le
rapport gain/risque ne le justifie pas aujourd'hui ; il est ecrit pour celui qui
reviendra avec une meilleure raison.

### 39. « Identique octet a octet » ne prouvait rien sur les chemins que le depot n'emprunte pas

**Symptome** — la reecriture de `yget` sans processus a ete validee en comparant
la sortie complete de `./init.sh --check` avant et apres : identique, octet a
octet. Le message de commit le dit ainsi, et c'est vrai. Le relecteur a trouve
une divergence quand meme.

L'ancienne version faisait `tr -d '\r' < fichier` : elle retirait les retours
chariot **partout**. La nouvelle faisait `${ligne%$'\r'}` — un suffixe, donc le
seul retour chariot de fin de ligne. Un `\r` colle au milieu d'une valeur,
comme en produit un copier-coller depuis un terminal Windows, traversait
desormais jusqu'a la sortie.

**Cause** — la comparaison octet a octet ne portait que sur les manifestes
REELS du depot, et aucun ne contient de retour chariot. Une preuve
d'equivalence n'est valable que sur les entrees qu'on lui donne ; celle-ci en
couvrait dix fichiers ecrits par la fabrique elle-meme, c'est-a-dire les plus
propres qui soient. C'est une variante du vert silencieux : le controle a bien
tourne, il a bien conclu, et son perimetre etait plus etroit que ce qu'on lui
faisait dire.

Aggravant, et c'est ce qui rendait la faute invisible a la relecture : les deux
autres lecteurs reecrits dans le MEME commit, `ylist` et son voisin, avaient
recu `gsub(/\r/, "")` — qui retire tout. Les trois lecteurs de manifeste de la
fabrique ne nettoyaient donc plus pareil, et rien ne les tenait d'accord.

**Detecte par** — `relecture`

**Action** — `garde-fou` — corrige (`${ligne//$'\r'/}`), et surtout `yget` recoit
**onze cas de test qui lui sont propres**, la ou elle n'en avait aucun : retour
chariot au milieu et en fin, commentaire de fin precede de plusieurs espaces,
`#` colle a la valeur, cle prefixe d'une autre, premiere occurrence, cle
absente, cle sans valeur, cle indentee, derniere ligne sans saut final,
guillemets.

La contre-epreuve a ete faite, comme l'anomalie 34 l'exige : defaut remis, le
cas rougit ; correctif remis, il verdit. Elle valait le detour — le message
d'echec affiche « attendu << 8080 >>, obtenu << 8080 >> ». Les deux chaines ont
l'air identiques parce que le caractere en trop **ne s'imprime pas**. C'est
exactement pour cette raison que la comparaison de sortie de `--check` n'avait
rien vu : un retour chariot ne se voit pas dans un diff qu'on lit.

La lecon generale, et elle vaut au-dela de ce cas : **une reecriture ne se
valide pas sur les entrees dont on dispose, mais sur celles qu'on redoute.**
Les entrees du depot sont les plus favorables qui soient, puisque le depot les
genere lui-meme.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-21 à 12:30 UTC, sur 3 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 4 990 | 0,01 $ |
| Écriture de cache | 6 055 650 | 29,38 $ |
| Lecture de cache | 280 958 647 | 127,07 $ |
| Sortie | 101 585 | 1,97 $ |
| **Total** | **287 120 872** | **158,44 $ — 137,59 €** |

**Ce qui coûte**

- **1711 appel(s) au modèle** — un par réponse, outils compris —, dont 1101 par des sous-agents — 88 928 110 jetons, 43,51 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  65 847 jetons, écrits une fois par session puis relus à chaque
  échange : 40 100 823 jetons de relecture, 14 % de tout ce qui a été relu.
- **Tours courts** — 1 452 des 1 711 tours (84 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 143,94 $, soit 90 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 65 847 jetons relus au premier appel qui relise
  quelque chose, 410 495 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 287120872 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 65847 0 0
2 principal claude-opus-5 7118 65847 0
3 principal claude-opus-5 3536 72965 0
4 principal claude-opus-5 5441 76501 0
5 principal claude-opus-5 3478 81942 0
6 principal claude-opus-5 3070 85420 0
7 principal claude-opus-5 2360 88490 0
8 principal claude-opus-5 4234 90850 0
9 principal claude-opus-5 4011 95084 0
10 principal claude-opus-5 3583 99095 0
11 principal claude-opus-5 3026 102678 0
12 principal claude-opus-5 66 106521 0
13 principal claude-opus-5 1948 106587 0
14 principal claude-opus-5 6656 110665 0
15 principal claude-opus-5 4265 117321 0
16 principal claude-opus-5 1354 121586 0
17 principal claude-opus-5 1684 122940 0
18 principal claude-opus-5 13537 124624 0
19 principal claude-opus-5 1237 138161 0
20 principal claude-opus-5 379 139398 0
21 principal claude-opus-5 413 139777 0
22 principal claude-opus-5 1448 140190 0
23 principal claude-opus-5 6643 142896 0
24 principal claude-opus-5 692 149539 0
25 principal claude-opus-5 620 150231 0
26 principal claude-opus-5 399 150851 0
27 principal claude-opus-5 2320 151250 0
28 principal claude-opus-5 454 153570 0
29 principal claude-opus-5 1321 154024 0
30 principal claude-opus-5 583 155345 0
31 principal claude-opus-5 481 155928 0
32 principal claude-opus-5 9848 156409 0
33 principal claude-opus-5 470 166257 0
34 principal claude-opus-5 815 166727 0
35 principal claude-opus-5 566 167542 0
36 principal claude-opus-5 317 168108 0
37 principal claude-opus-5 626 168425 0
38 principal claude-opus-5 770 169051 0
39 principal claude-opus-5 272 169821 0
40 principal claude-opus-5 1471 170093 0
41 principal claude-opus-5 528 171564 0
42 principal claude-opus-5 2455 172092 0
43 principal claude-opus-5 1021 174547 0
44 principal claude-opus-5 1454 175568 0
45 principal claude-opus-5 1621 177022 0
46 principal claude-opus-5 1822 178643 0
47 principal claude-opus-5 1770 180465 0
48 principal claude-opus-5 2892 182235 0
49 principal claude-opus-5 3892 185127 0
50 principal claude-opus-5 1865 189019 0
51 principal claude-opus-5 6649 192116 0
52 principal claude-opus-5 1819 198765 0
53 principal claude-opus-5 13441 200584 0
54 principal claude-opus-5 1221 214025 0
55 principal claude-opus-5 1606 215246 0
56 principal claude-opus-5 6744 216852 0
57 principal claude-opus-5 1154 223596 0
58 principal claude-opus-5 639 224750 0
59 principal claude-opus-5 818 225389 0
60 principal claude-opus-5 192 226207 0
61 principal claude-opus-5 601 226399 0
62 principal claude-opus-5 1211 227000 0
63 principal claude-opus-5 1651 228211 0
64 principal claude-opus-5 3790 229862 0
65 principal claude-opus-5 912 233652 0
66 principal claude-opus-5 1247 234564 0
67 principal claude-opus-5 546 235811 0
68 principal claude-opus-5 827 236357 0
69 principal claude-opus-5 7588 237184 0
70 principal claude-opus-5 1518 244772 0
71 principal claude-opus-5 6645 246290 0
72 principal claude-opus-5 1855 252935 0
73 principal claude-opus-5 335 254790 0
74 principal claude-opus-5 1224 255125 0
75 principal claude-opus-5 1130 256349 0
76 principal claude-opus-5 2632 257479 0
77 principal claude-opus-5 2639 260111 0
78 principal claude-opus-5 475 262750 0
79 principal claude-opus-5 878 263225 0
80 principal claude-opus-5 549 264103 0
81 principal claude-opus-5 3378 264652 0
82 principal claude-opus-5 367 268030 0
83 principal claude-opus-5 5119 264103 0
84 principal claude-opus-5 1117 269222 0
85 principal claude-opus-5 1719 270339 0
86 principal claude-opus-5 1126 272058 0
87 principal claude-opus-5 514 273184 0
88 principal claude-opus-5 1101 273698 0
89 principal claude-opus-5 1562 274799 0
90 principal claude-opus-5 2481 276361 0
91 principal claude-opus-5 926 278842 0
92 principal claude-opus-5 1946 279768 0
93 principal claude-opus-5 541 281714 0
94 principal claude-opus-5 508 282255 0
95 principal claude-opus-5 1453 282763 0
96 principal claude-opus-5 2681 284216 0
97 principal claude-opus-5 703 286897 0
98 principal claude-opus-5 813 287600 0
99 principal claude-opus-5 2486 288413 0
100 principal claude-opus-5 1497 290899 0
101 principal claude-opus-5 693 292396 0
102 principal claude-opus-5 686 293089 0
103 principal claude-opus-5 1103 293775 0
104 principal claude-opus-5 1422 294878 0
105 principal claude-opus-5 1741 296300 0
106 principal claude-opus-5 252659 46716 0
107 principal claude-opus-5 1933 299375 0
108 principal claude-opus-5 702 301308 0
109 principal claude-opus-5 1246 302010 0
110 principal claude-opus-5 1374 303256 0
111 principal claude-opus-5 1167 304630 0
112 principal claude-opus-5 1890 305797 0
113 principal claude-opus-5 827 307687 0
114 principal claude-opus-5 2219 308514 0
115 principal claude-opus-5 361 310733 0
116 principal claude-opus-5 1717 311094 0
117 principal claude-opus-5 9702 312811 0
118 principal claude-opus-5 1219 322513 0
119 principal claude-opus-5 1223 323732 0
120 principal claude-opus-5 930 324955 0
121 principal claude-opus-5 1046 325885 0
122 principal claude-opus-5 553 326931 0
123 principal claude-opus-5 1682 327484 0
124 principal claude-opus-5 695 329166 0
125 principal claude-opus-5 2808 329861 0
126 principal claude-opus-5 3655 332669 0
127 principal claude-opus-5 1203 336324 0
128 principal claude-opus-5 10684 329861 0
129 principal claude-opus-5 553 340545 0
130 principal claude-opus-5 317 341098 0
131 principal claude-opus-5 9769 341415 0
132 principal claude-opus-5 4184 351184 0
133 principal claude-opus-5 534 355368 0
134 principal claude-opus-5 649 355902 0
135 principal claude-opus-5 748 356551 0
136 principal claude-opus-5 2320 357299 0
137 principal claude-opus-5 602 359619 0
138 principal claude-opus-5 1999 360221 0
139 principal claude-opus-5 893 362220 0
140 principal claude-opus-5 1179 363113 0
141 principal claude-opus-5 1379 364292 0
142 principal claude-opus-5 1371 365671 0
143 principal claude-opus-5 4329 367042 0
144 principal claude-opus-5 458 371371 0
145 principal claude-opus-5 845 371829 0
146 principal claude-opus-5 2380 372674 0
147 principal claude-opus-5 1823 375054 0
148 principal claude-opus-5 901 376877 0
149 principal claude-opus-5 818 377778 0
150 principal claude-opus-5 613 378596 0
151 principal claude-opus-5 125 379209 0
152 principal claude-opus-5 585 379334 0
153 principal claude-opus-5 533 379919 0
154 principal claude-opus-5 862 380452 0
155 principal claude-opus-5 1865 381314 0
156 principal claude-opus-5 1958 383179 0
157 principal claude-opus-5 555 385137 0
158 principal claude-opus-5 1176 385692 0
159 principal claude-opus-5 1879 386868 0
160 principal claude-opus-5 519 388747 0
161 principal claude-opus-5 1787 389266 0
162 principal claude-opus-5 426 391053 0
163 principal claude-opus-5 672 391479 0
164 principal claude-opus-5 1143 392151 0
165 principal claude-opus-5 429 393294 0
166 principal claude-opus-5 1144 393723 0
167 principal claude-opus-5 1814 394867 0
168 principal claude-opus-5 436 396681 0
169 principal claude-opus-5 810 397117 0
170 principal claude-opus-5 3302 397927 0
171 principal claude-opus-5 991 401229 0
172 principal claude-opus-5 382 402220 0
173 principal claude-opus-5 1428 402220 0
174 principal claude-opus-5 2344 403648 0
175 principal claude-opus-5 720 405992 0
176 principal claude-opus-5 541 406712 0
177 principal claude-opus-5 1810 407253 0
178 principal claude-opus-5 1127 409063 0
179 principal claude-opus-5 5453 410190 0
180 principal claude-opus-5 9716 415643 0
181 principal claude-opus-5 1538 425359 0
182 principal claude-opus-5 470 426897 0
183 principal claude-opus-5 2447 427367 0
184 principal claude-opus-5 395 429814 0
185 principal claude-opus-5 333 430209 0
186 principal claude-opus-5 852 430542 0
187 principal claude-opus-5 2960 431394 0
188 principal claude-opus-5 965 434354 0
189 principal claude-opus-5 283 435319 0
190 principal claude-opus-5 2750 435319 0
191 principal claude-opus-5 2294 438069 0
192 principal claude-opus-5 1252 440363 0
193 principal claude-opus-5 472 441615 0
194 principal claude-opus-5 884 442087 0
195 principal claude-opus-5 911 442971 0
196 principal claude-opus-5 4743 443882 0
197 principal claude-opus-5 1340 448625 0
198 principal claude-opus-5 11613 442087 0
199 principal claude-opus-5 1152 453700 0
200 principal claude-opus-5 2943 454852 0
201 principal claude-opus-5 1787 457795 0
202 principal claude-opus-5 2834 459582 0
203 principal claude-opus-5 796 462416 0
204 principal claude-opus-5 301 463212 0
205 principal claude-opus-5 3168 463212 0
206 principal claude-opus-5 560 466380 0
207 principal claude-opus-5 1023 466940 0
208 principal claude-opus-5 2123 467963 0
209 principal claude-opus-5 607 470086 0
210 principal claude-opus-5 2652 470693 0
211 principal claude-opus-5 1359 473345 0
212 principal claude-opus-5 1655 474704 0
213 principal claude-opus-5 1613 476359 0
214 principal claude-opus-5 802 477972 0
215 principal claude-opus-5 1108 478774 0
216 principal claude-opus-5 1074 479882 0
217 principal claude-opus-5 607 480956 0
218 principal claude-opus-5 761 481563 0
219 principal claude-opus-5 929 482324 0
220 principal claude-opus-5 564 483253 0
221 principal claude-opus-5 431 483817 0
222 principal claude-opus-5 358 484248 0
223 principal claude-opus-5 2171 484606 0
224 principal claude-opus-5 5407 483817 0
225 principal claude-opus-5 470 489224 0
226 principal claude-opus-5 1386 489694 0
227 principal claude-opus-5 1084 491080 0
228 principal claude-opus-5 517 492164 0
229 principal claude-opus-5 836 492681 0
230 principal claude-opus-5 1272 493517 0
231 principal claude-opus-5 613 494789 0
232 principal claude-opus-5 692 495402 0
233 principal claude-opus-5 259 496094 0
234 principal claude-opus-5 554 496353 0
235 principal claude-opus-5 2720 496907 0
236 principal claude-opus-5 695 499627 0
237 principal claude-opus-5 259 500322 0
238 principal claude-opus-5 1191 500322 0
239 principal claude-opus-5 2816 501513 0
240 principal claude-opus-5 2739 504329 0
241 principal claude-opus-5 497 507068 0
242 principal claude-opus-5 732 507565 0
243 principal claude-opus-5 1306 508297 0
244 principal claude-opus-5 2444 509603 0
245 principal claude-opus-5 1191 512047 0
246 principal claude-opus-5 1241 513238 0
247 principal claude-opus-5 1199 514479 0
248 principal claude-opus-5 582 515678 0
249 principal claude-opus-5 733 516260 0
250 principal claude-opus-5 1583 516993 0
251 principal claude-opus-5 892 518576 0
252 principal claude-opus-5 2643 519468 0
253 principal claude-opus-5 873 522111 0
254 principal claude-opus-5 444 522984 0
255 principal claude-opus-5 1887 522984 0
256 principal claude-opus-5 3617 524871 0
257 principal claude-opus-5 1819 528488 0
258 principal claude-opus-5 1594 530617 0
259 principal claude-opus-5 737 532211 0
260 principal claude-opus-5 1176 532948 0
261 principal claude-opus-5 2006 534124 0
262 principal claude-opus-5 1328 536130 0
263 principal claude-opus-5 604 537458 0
264 principal claude-opus-5 2170 538062 0
265 principal claude-opus-5 4285 538062 0
266 principal claude-opus-5 620 542347 0
267 principal claude-opus-5 388 542967 0
268 principal claude-opus-5 1638 543355 0
269 principal claude-opus-5 1351 544993 0
270 principal claude-opus-5 2109 546344 0
271 principal claude-opus-5 547 548453 0
272 principal claude-opus-5 1406 549000 0
273 principal claude-opus-5 2180 550406 0
274 principal claude-opus-5 899 552586 0
275 principal claude-opus-5 1999 553485 0
276 principal claude-opus-5 664 555484 0
277 principal claude-opus-5 845 556148 0
278 principal claude-opus-5 631 556993 0
279 principal claude-opus-5 347 557624 0
280 principal claude-opus-5 1173 557624 0
281 principal claude-opus-5 607 558797 0
282 principal claude-opus-5 732 559404 0
283 principal claude-opus-5 820 560136 0
284 principal claude-opus-5 598 560956 0
285 principal claude-opus-5 1136 561554 0
286 principal claude-opus-5 1031 562690 0
287 principal claude-opus-5 456 563721 0
288 principal claude-opus-5 2630 564177 0
289 principal claude-opus-5 622 566807 0
290 principal claude-opus-5 135 567429 0
291 principal claude-opus-5 1054 567429 0
292 principal claude-opus-5 739 568483 0
293 principal claude-opus-5 3172 569222 0
294 principal claude-opus-5 1783 572394 0
295 principal claude-opus-5 1126 574177 0
296 principal claude-opus-5 1585 575303 0
297 principal claude-opus-5 2713 576888 0
298 principal claude-opus-5 1810 579601 0
299 principal claude-opus-5 1148 581411 0
300 principal claude-opus-5 1409 582559 0
301 principal claude-opus-5 1707 583968 0
302 principal claude-opus-5 746 585675 0
303 principal claude-opus-5 214 586421 0
304 principal claude-opus-5 1175 586421 0
305 principal claude-opus-5 497 587596 0
306 principal claude-opus-5 1010 588093 0
307 principal claude-opus-5 1395 589103 0
308 principal claude-opus-5 171 590498 0
309 principal claude-opus-5 3850 590669 0
310 principal claude-opus-5 1139 594519 0
311 principal claude-opus-5 838 595658 0
312 principal claude-opus-5 949 596496 0
313 principal claude-opus-5 1195 597445 0
314 principal claude-opus-5 454 598971 0
315 principal claude-opus-5 3031 599425 0
316 principal claude-opus-5 1174 602456 0
317 principal claude-opus-5 483 603630 0
318 principal claude-opus-5 2182 604113 0
319 principal claude-opus-5 1683 606295 0
320 principal claude-opus-5 2227 607978 0
321 principal claude-opus-5 650 610205 0
322 principal claude-opus-5 721 610855 0
323 principal claude-opus-5 559 611576 0
324 principal claude-opus-5 790 612135 0
325 principal claude-opus-5 1138 612925 0
326 principal claude-opus-5 224 614063 0
327 principal claude-opus-5 1588 614287 0
328 principal claude-opus-5 639 615875 0
329 principal claude-opus-5 684 616514 0
330 principal claude-opus-5 1907 617198 0
331 principal claude-opus-5 652 619105 0
332 principal claude-opus-5 998 619757 0
333 principal claude-opus-5 6663 620755 0
334 principal claude-opus-5 2249 627418 0
335 principal claude-opus-5 2033 629667 0
336 principal claude-opus-5 813 631700 0
337 principal claude-opus-5 756 632513 0
338 principal claude-opus-5 540 633269 0
339 principal claude-opus-5 4783 631745 0
340 principal claude-opus-5 549 636528 0
341 principal claude-opus-5 385 637077 0
342 principal claude-opus-5 366 637462 0
343 principal claude-opus-5 3547 637828 0
344 principal claude-opus-5 894 641375 0
345 principal claude-opus-5 240 642269 0
346 principal claude-opus-5 1257 642269 0
347 principal claude-opus-5 370 643526 0
348 principal claude-opus-5 902 644748 0
349 principal claude-opus-5 494 645650 0
350 principal claude-opus-5 1988 646144 0
351 principal claude-opus-5 2354 648132 0
352 principal claude-opus-5 2139 650486 0
353 principal claude-opus-5 2315 652625 0
354 principal claude-opus-5 29900 37470 0
355 principal claude-opus-5 716 67370 0
356 principal claude-opus-5 4302 68086 0
357 principal claude-opus-5 4251 72388 0
358 principal claude-opus-5 348 76639 0
359 principal claude-opus-5 2787 76987 0
360 principal claude-opus-5 454 79774 0
361 principal claude-opus-5 4941 80228 0
362 principal claude-opus-5 3194 85169 0
363 principal claude-opus-5 4631 88363 0
364 principal claude-opus-5 591 92994 0
365 principal claude-opus-5 293 93585 0
366 principal claude-opus-5 394 93878 0
367 principal claude-opus-5 2006 94272 0
368 principal claude-opus-5 347 96278 0
369 principal claude-opus-5 977 96625 0
370 principal claude-opus-5 563 97602 0
371 principal claude-opus-5 1709 98165 0
372 principal claude-opus-5 552724 0 0
373 principal claude-opus-5 1906 552724 0
374 principal claude-opus-5 1302 554630 0
375 principal claude-opus-5 2244 555932 0
376 principal claude-opus-5 863 558176 0
377 principal claude-opus-5 416 559039 0
378 principal claude-opus-5 1290 559039 0
379 principal claude-opus-5 185 560329 0
380 principal claude-opus-5 132355 0 0
381 principal claude-opus-5 340 132355 0
382 principal claude-opus-5 1420 132695 0
383 principal claude-opus-5 589 134115 0
384 principal claude-opus-5 1418 134704 0
385 principal claude-opus-5 568 136122 0
386 principal claude-opus-5 728 136690 0
387 principal claude-opus-5 345 137418 0
388 principal claude-opus-5 539 137763 0
389 principal claude-opus-5 690 138302 0
390 principal claude-opus-5 1491 138992 0
391 principal claude-opus-5 1717 140483 0
392 principal claude-opus-5 444 142200 0
393 principal claude-opus-5 7615 143257 0
394 principal claude-opus-5 1519 150872 0
395 principal claude-opus-5 1146 152391 0
396 principal claude-opus-5 50 156394 0
397 principal claude-opus-5 1605 156444 0
398 principal claude-opus-5 1282 158049 0
399 principal claude-opus-5 1168 159331 0
400 principal claude-opus-5 2205 160499 0
401 principal claude-opus-5 921 162704 0
402 principal claude-opus-5 1601 163625 0
403 principal claude-opus-5 901 165226 0
404 principal claude-opus-5 376 166127 0
405 principal claude-opus-5 3768 166503 0
406 principal claude-opus-5 354 170271 0
407 principal claude-opus-5 5516 166127 0
408 principal claude-opus-5 803 171643 0
409 principal claude-opus-5 349 172985 0
410 principal claude-opus-5 709 173334 0
411 principal claude-opus-5 907 174043 0
412 principal claude-opus-5 3951 174950 0
413 principal claude-opus-5 1630 178901 0
414 principal claude-opus-5 739 180531 0
415 principal claude-opus-5 1343 181270 0
416 principal claude-opus-5 1123 182613 0
417 principal claude-opus-5 3999 183736 0
418 principal claude-opus-5 3676 187735 0
419 principal claude-opus-5 450 191411 0
420 principal claude-opus-5 1391 192891 0
421 principal claude-opus-5 602 194282 0
422 principal claude-opus-5 525 195002 0
423 principal claude-opus-5 1189 195527 0
424 principal claude-opus-5 30293 38013 0
425 principal claude-opus-5 3079 68306 0
426 principal claude-opus-5 4093 71385 0
427 principal claude-opus-5 1321 75478 0
428 principal claude-opus-5 2230 76799 0
429 principal claude-opus-5 1003 79385 0
430 principal claude-opus-5 1659 80388 0
431 principal claude-opus-5 8629 82047 0
432 principal claude-opus-5 1022 90676 0
433 principal claude-opus-5 9072 92356 0
434 principal claude-opus-5 13509 102108 0
435 principal claude-opus-5 15151 115617 0
436 principal claude-opus-5 9413 130768 0
437 principal claude-opus-5 3937 140181 0
438 principal claude-opus-5 2536 144118 0
439 principal claude-opus-5 966 146654 0
440 principal claude-opus-5 3212 147620 0
441 principal claude-opus-5 4598 150832 0
442 principal claude-opus-5 1710 155430 0
443 principal claude-opus-5 998 157140 0
444 principal claude-opus-5 1446 158138 0
445 principal claude-opus-5 1023 159584 0
446 principal claude-opus-5 8068 160607 0
447 principal claude-opus-5 3164 168675 0
448 principal claude-opus-5 1715 171839 0
449 principal claude-opus-5 855 173554 0
450 principal claude-opus-5 870 174409 0
451 principal claude-opus-5 2381 175279 0
452 principal claude-opus-5 1380 177660 0
453 principal claude-opus-5 3994 179040 0
454 principal claude-opus-5 1122 183034 0
455 principal claude-opus-5 1342 184156 0
456 principal claude-opus-5 958 185498 0
457 principal claude-opus-5 2541 186456 0
458 principal claude-opus-5 1391 188997 0
459 principal claude-opus-5 418 190388 0
460 principal claude-opus-5 1482 190806 0
461 principal claude-opus-5 1229 192288 0
462 principal claude-opus-5 795 193517 0
463 principal claude-opus-5 953 194312 0
464 principal claude-opus-5 1377 195265 0
465 principal claude-opus-5 1483 196642 0
466 principal claude-opus-5 2334 198125 0
467 principal claude-opus-5 1802 200459 0
468 principal claude-opus-5 949 202261 0
469 principal claude-opus-5 842 203210 0
470 principal claude-opus-5 1252 204052 0
471 principal claude-opus-5 703 205304 0
472 principal claude-opus-5 390 206007 0
473 principal claude-opus-5 977 206397 0
474 principal claude-opus-5 986 207374 0
475 principal claude-opus-5 405 208360 0
476 principal claude-opus-5 37 209623 0
477 principal claude-opus-5 4272 209660 0
478 principal claude-opus-5 4338 213932 0
479 principal claude-opus-5 5630 218270 0
480 principal claude-opus-5 1129 223900 0
481 principal claude-opus-5 1480 225029 0
482 principal claude-opus-5 350 226509 0
483 principal claude-opus-5 1390 226859 0
484 principal claude-opus-5 793 228249 0
485 principal claude-opus-5 2302 229042 0
486 principal claude-opus-5 2357 231344 0
487 principal claude-opus-5 1029 233701 0
488 principal claude-opus-5 3925 234730 0
489 principal claude-opus-5 2286 238655 0
490 principal claude-opus-5 723 240941 0
491 principal claude-opus-5 1541 241664 0
492 principal claude-opus-5 1495 243205 0
493 principal claude-opus-5 1907 244700 0
494 principal claude-opus-5 2208 246607 0
495 principal claude-opus-5 1802 248815 0
496 principal claude-opus-5 615 250617 0
497 principal claude-opus-5 1012 251232 0
498 principal claude-opus-5 2106 252244 0
499 principal claude-opus-5 695 254350 0
500 principal claude-opus-5 1365 255045 0
501 principal claude-opus-5 702 256410 0
502 principal claude-opus-5 1835 257112 0
503 principal claude-opus-5 6764 258947 0
504 principal claude-opus-5 1332 265711 0
505 principal claude-opus-5 217491 38013 30
506 principal claude-opus-5 1043 255504 213
507 principal claude-opus-5 763 256547 267
508 principal claude-opus-5 3867 257310 277
509 principal claude-opus-5 8115 261177 1079
510 principal claude-opus-5 1966 269292 2590
511 principal claude-opus-5 2736 271258 362
512 principal claude-opus-5 846 273994 561
513 principal claude-opus-5 900 274840 1012
514 principal claude-opus-5 1249 275740 1067
515 principal claude-opus-5 1212 276989 883
516 principal claude-opus-5 970 278201 583
517 principal claude-opus-5 789 279171 404
518 principal claude-opus-5 851 279960 530
519 principal claude-opus-5 240029 47259 1611
520 principal claude-opus-5 1664 287288 762
521 principal claude-opus-5 1647 288952 205
522 principal claude-opus-5 2884 290599 1218
523 principal claude-opus-5 1361 293483 1257
524 principal claude-opus-5 2858 294844 304
525 principal claude-opus-5 1410 297702 435
526 principal claude-opus-5 1582 299112 702
527 principal claude-opus-5 887 300694 1666
528 principal claude-opus-5 1933 301581 826
529 principal claude-opus-5 2194 303514 501
530 principal claude-opus-5 1771 305708 2909
531 principal claude-opus-5 3034 307479 3765
532 principal claude-opus-5 3846 310513 838
533 principal claude-opus-5 1092 314359 692
534 principal claude-opus-5 1394 315451 1858
535 principal claude-opus-5 2654 316845 2935
536 principal claude-opus-5 3176 319499 234
537 principal claude-opus-5 295 322675 931
538 principal claude-opus-5 1040 322970 410
539 principal claude-opus-5 493 324010 393
540 principal claude-opus-5 578 324503 411
541 principal claude-opus-5 1331 325081 1883
542 principal claude-opus-5 1931 326412 996
543 principal claude-opus-5 1563 328343 2386
544 principal claude-opus-5 2431 329906 1697
545 principal claude-opus-5 2019 332337 2325
546 principal claude-opus-4-7 7371 29200 102
547 principal claude-opus-5 2384 334356 499
548 principal claude-opus-4-7 185 36571 98
549 principal claude-opus-4-7 275 36756 81
550 principal claude-opus-4-7 8493 37031 77
551 principal claude-opus-5 937 336740 410
552 principal claude-opus-5 690 337677 962
553 principal claude-opus-4-7 0 36571 278
554 principal claude-opus-4-7 361 36571 95
555 principal claude-opus-5 1215 338367 757
556 principal claude-opus-4-7 272 36932 81
557 principal claude-opus-4-7 24330 45524 2910
558 principal claude-opus-4-7 8493 37204 164
559 principal claude-opus-4-7 26076 69854 158
560 principal claude-opus-4-7 1992 45697 2666
561 principal claude-opus-4-7 4999 47689 367
562 principal claude-opus-4-7 2713 52688 128
563 principal claude-opus-4-7 7396 55401 126
564 principal claude-opus-4-7 3713 95930 3608
565 principal claude-opus-4-7 3681 62797 219
566 principal claude-opus-4-7 601 66478 121
567 principal claude-opus-4-7 3703 99643 144
568 principal claude-opus-4-7 765 103346 126
569 principal claude-opus-4-7 2300 67079 3787
570 principal claude-opus-4-7 4928 69379 394
571 principal claude-opus-4-7 1015 74307 1116
572 principal claude-opus-5 1053 339582 2292
573 principal claude-opus-5 2937 340635 798
574 principal claude-opus-5 356 344370 30
575 principal claude-opus-5 966 344726 239
576 principal claude-opus-5 485 345692 347
577 principal claude-opus-5 1488 346177 219
578 principal claude-opus-5 22085 347665 568
579 principal claude-opus-5 1833 369750 778
580 principal claude-opus-5 1331 371583 1592
581 principal claude-opus-5 1646 372914 968
582 principal claude-opus-5 1004 374560 525
583 principal claude-opus-5 349 376089 30
584 principal claude-opus-5 704 376438 552
585 principal claude-opus-5 4585 377142 730
586 principal claude-opus-5 1006 381727 380
587 principal claude-opus-5 1502 382733 711
588 principal claude-opus-5 996 384235 1615
589 principal claude-opus-5 2728 385231 1579
590 principal claude-opus-5 5179 387959 3790
591 principal claude-opus-5 3934 393138 149
592 principal claude-opus-5 644 397072 1434
593 principal claude-opus-5 1593 397716 292
594 principal claude-opus-5 799 399309 640
595 principal claude-opus-5 936 400108 648
596 principal claude-opus-5 1007 401044 1998
597 principal claude-opus-5 2088 402051 1248
598 principal claude-opus-4-7 5333 29200 175
599 principal claude-opus-4-7 261 34533 94
600 principal claude-opus-4-7 271 34794 81
601 principal claude-opus-4-7 8782 35065 161
602 principal claude-opus-5 1287 404139 1407
603 principal claude-opus-5 2113 405426 402
604 principal claude-opus-4-7 3868 43847 1475
605 principal claude-opus-5 816 407539 282
606 principal claude-opus-4-7 1971 47715 733
607 principal claude-opus-5 1063 408355 940
608 principal claude-opus-5 1077 409418 140
609 principal claude-opus-4-7 1528 49686 1135
610 principal claude-opus-5 290 410495 793
611 agent claude-haiku-4-5-20251001 12845 0 4
612 agent claude-haiku-4-5-20251001 1502 12845 2
613 agent claude-haiku-4-5-20251001 610 14347 1
614 agent claude-haiku-4-5-20251001 404 14957 1
615 agent claude-haiku-4-5-20251001 16043 0 2
616 agent claude-haiku-4-5-20251001 830 16043 2
617 agent claude-haiku-4-5-20251001 725 16873 4
618 agent claude-haiku-4-5-20251001 1409 17598 3
619 agent claude-haiku-4-5-20251001 296 19007 2
620 agent claude-haiku-4-5-20251001 225 19303 2
621 agent claude-opus-5 13868 17190 1
622 agent claude-opus-5 4698 31058 1
623 agent claude-opus-5 3235 35756 5
624 agent claude-opus-5 10015 38991 3
625 agent claude-opus-5 5721 49006 3
626 agent claude-opus-5 5621 54727 8
627 agent claude-opus-5 2274 60348 5
628 agent claude-opus-5 800 62622 3
629 agent claude-opus-5 2258 63422 3
630 agent claude-opus-5 460 65680 0
631 agent claude-opus-5 4178 66140 5
632 agent claude-opus-5 199 70318 6
633 agent claude-opus-5 852 70517 3
634 agent claude-opus-5 613 71369 17
635 agent claude-opus-5 789 71982 17
636 agent claude-opus-5 2724 72771 3
637 agent claude-opus-5 2216 75495 2
638 agent claude-opus-5 2691 77711 17
639 agent claude-opus-5 3520 80402 3
640 agent claude-opus-5 2736 83922 20
641 agent claude-opus-5 3348 86658 4
642 agent claude-opus-5 2035 90006 3
643 agent claude-opus-5 2791 92041 2
644 agent claude-opus-5 1052 94832 2
645 agent claude-opus-5 655 95884 0
646 agent claude-opus-5 227 96539 17
647 agent claude-opus-5 2154 96766 2
648 agent claude-opus-5 1475 98920 10
649 agent claude-opus-5 4318 100395 2
650 agent claude-opus-5 1613 104713 17
651 agent claude-opus-5 1556 106326 2
652 agent claude-opus-5 2005 107882 20
653 agent claude-opus-5 1014 109887 2
654 agent claude-opus-5 2541 110901 17
655 agent claude-opus-5 809 113442 3
656 agent claude-opus-5 1991 114251 2
657 agent claude-opus-5 1108 116242 17
658 agent claude-opus-5 1040 117350 3
659 agent claude-opus-5 1170 118390 3
660 agent claude-opus-5 1240 119560 20
661 agent claude-opus-5 415 120800 3
662 agent claude-opus-5 5090 121215 2
663 agent claude-opus-5 1266 126305 21
664 agent claude-opus-5 543 127571 17
665 agent claude-opus-5 910 128114 17
666 agent claude-opus-5 447 129024 16
667 agent claude-opus-5 552 129471 4
668 agent claude-opus-5 1118 130023 3
669 agent claude-opus-5 636 131141 17
670 agent claude-opus-5 706 131777 4
671 agent claude-opus-5 887 132483 4
672 agent claude-opus-5 836 133370 4
673 agent claude-opus-5 584 134206 20
674 agent claude-opus-5 405 134790 17
675 agent claude-opus-5 5031 135195 3
676 agent claude-opus-5 1417 140226 3
677 agent claude-opus-5 1228 141643 17
678 agent claude-opus-5 1296 142871 3
679 agent claude-opus-5 660 144167 5
680 agent claude-opus-5 286 144827 0
681 agent claude-opus-5 906 145113 16
682 agent claude-opus-5 1622 146019 2
683 agent claude-opus-5 1266 147641 9
684 agent claude-opus-5 890 148907 3
685 agent claude-opus-5 1038 149797 20
686 agent claude-opus-5 434 150835 2
687 agent claude-opus-5 486 151269 17
688 agent claude-opus-5 645 151755 2
689 agent claude-opus-5 4909 152400 2
690 agent claude-opus-5 17051 157309 17
691 agent claude-opus-5 608 174360 4
692 agent claude-opus-5 645 174968 21
693 agent claude-opus-5 1785 175613 3
694 agent claude-opus-5 6109 177398 14
695 agent claude-opus-5 623 183507 3
696 agent claude-opus-5 770 184130 6
697 agent claude-opus-5 201 184900 16
698 agent claude-opus-5 6536 185101 5
699 agent claude-opus-5 750 191637 17
700 agent claude-opus-5 1018 192387 3
701 agent claude-opus-5 829 193405 17
702 agent claude-opus-5 191 194234 1
703 agent claude-sonnet-5 18223 0 3
704 agent claude-sonnet-5 2205 18223 2
705 agent claude-sonnet-5 4028 20428 4
706 agent claude-sonnet-5 7759 24456 6
707 agent claude-sonnet-5 2919 32215 7
708 agent claude-sonnet-5 1182 35134 3
709 agent claude-sonnet-5 808 36316 2
710 agent claude-sonnet-5 1750 37124 4
711 agent claude-sonnet-5 1294 38874 3
712 agent claude-sonnet-5 12324 40168 9
713 agent claude-sonnet-5 2098 52492 7
714 agent claude-sonnet-5 3186 54590 20
715 agent claude-sonnet-5 211 57776 20
716 agent claude-sonnet-5 723 57987 5
717 agent claude-sonnet-5 565 58710 3
718 agent claude-sonnet-5 1458 59275 3
719 agent claude-sonnet-5 743 60733 20
720 agent claude-sonnet-5 203 61476 2
721 agent claude-sonnet-5 561 61679 2
722 agent claude-sonnet-5 1192 62240 14
723 agent claude-sonnet-5 218 63432 5
724 agent claude-sonnet-5 17627 63650 6
725 agent claude-sonnet-5 3020 81277 3
726 agent claude-sonnet-5 374 84297 8
727 agent claude-sonnet-5 3322 84671 4
728 agent claude-sonnet-5 3497 87993 3
729 agent claude-sonnet-5 23276 91490 3
730 agent claude-sonnet-5 608 114766 2
731 agent claude-sonnet-5 695 115374 8
732 agent claude-sonnet-5 751 116069 3
733 agent claude-sonnet-5 293 116820 2
734 agent claude-sonnet-5 2259 117113 20
735 agent claude-sonnet-5 1187 119372 3
736 agent claude-sonnet-5 1605 120559 3
737 agent claude-sonnet-5 1526 122164 2
738 agent claude-sonnet-5 2373 123690 2
739 agent claude-sonnet-5 624 126063 4
740 agent claude-sonnet-5 576 126687 2
741 agent claude-sonnet-5 7985 127263 3
742 agent claude-sonnet-5 6403 135248 8
743 agent claude-sonnet-5 295 141651 20
744 agent claude-sonnet-5 171 141946 3
745 agent claude-sonnet-5 10179 7828 2
746 agent claude-sonnet-5 4180 18007 2
747 agent claude-sonnet-5 308 22187 2
748 agent claude-sonnet-5 409 22495 20
749 agent claude-sonnet-5 394 22904 2
750 agent claude-sonnet-5 188 23298 0
751 agent claude-sonnet-5 820 23486 2
752 agent claude-sonnet-5 399 24306 5
753 agent claude-sonnet-5 866 24705 1
754 agent claude-sonnet-5 199 25571 20
755 agent claude-sonnet-5 142 25770 1
756 agent claude-haiku-4-5-20251001 12939 0 4
757 agent claude-haiku-4-5-20251001 1360 12939 2
758 agent claude-haiku-4-5-20251001 692 14299 2
759 agent claude-haiku-4-5-20251001 533 14991 2
760 agent claude-haiku-4-5-20251001 1092 15524 2
761 agent claude-haiku-4-5-20251001 379 16616 4
762 agent claude-haiku-4-5-20251001 602 16995 1
763 agent claude-sonnet-5 6975 11475 4
764 agent claude-sonnet-5 3724 18450 4
765 agent claude-sonnet-5 2748 22174 2
766 agent claude-sonnet-5 749 24922 2
767 agent claude-sonnet-5 2387 25671 20
768 agent claude-sonnet-5 1393 28058 5
769 agent claude-sonnet-5 1647 29451 2
770 agent claude-sonnet-5 1991 31098 3
771 agent claude-sonnet-5 708 33089 8
772 agent claude-sonnet-5 2348 33797 7
773 agent claude-sonnet-5 3499 36145 3
774 agent claude-sonnet-5 1063 39644 4
775 agent claude-sonnet-5 1060 40707 3
776 agent claude-sonnet-5 716 41767 0
777 agent claude-sonnet-5 421 42483 9
778 agent claude-sonnet-5 3680 42904 8
779 agent claude-sonnet-5 2021 46584 5
780 agent claude-sonnet-5 881 48605 5
781 agent claude-sonnet-5 365 49486 2
782 agent claude-sonnet-5 681 49851 4
783 agent claude-sonnet-5 6121 50532 2
784 agent claude-sonnet-5 1211 56653 2
785 agent claude-sonnet-5 2884 57864 2
786 agent claude-sonnet-5 229 60748 20
787 agent claude-sonnet-5 1244 60977 3
788 agent claude-sonnet-5 2406 62221 3
789 agent claude-sonnet-5 333 64627 20
790 agent claude-sonnet-5 355 64960 3
791 agent claude-sonnet-5 397 65315 5
792 agent claude-sonnet-5 1328 65712 3
793 agent claude-sonnet-5 2735 67040 7
794 agent claude-sonnet-5 1062 69775 3
795 agent claude-sonnet-5 2308 70837 2
796 agent claude-sonnet-5 607 73145 20
797 agent claude-sonnet-5 367 73752 2
798 agent claude-sonnet-5 527 74119 6
799 agent claude-sonnet-5 1065 74646 17
800 agent claude-sonnet-5 527 75711 17
801 agent claude-sonnet-5 378 76238 17
802 agent claude-sonnet-5 385 76616 2
803 agent claude-sonnet-5 565 77001 2
804 agent claude-sonnet-5 449 77566 2
805 agent claude-sonnet-5 913 78015 0
806 agent claude-sonnet-5 209 78928 5
807 agent claude-sonnet-5 311 79137 2
808 agent claude-sonnet-5 258 79448 3
809 agent claude-haiku-4-5-20251001 13111 0 4
810 agent claude-haiku-4-5-20251001 1989 13111 2
811 agent claude-haiku-4-5-20251001 661 15100 1
812 agent claude-haiku-4-5-20251001 596 15761 2
813 agent claude-haiku-4-5-20251001 715 16357 4
814 agent claude-haiku-4-5-20251001 2012 17072 3
815 agent claude-haiku-4-5-20251001 292 19084 4
816 agent claude-sonnet-5 7082 11475 3
817 agent claude-sonnet-5 4116 18557 5
818 agent claude-sonnet-5 3292 22673 20
819 agent claude-sonnet-5 4562 25965 3
820 agent claude-sonnet-5 4722 30527 3
821 agent claude-sonnet-5 2374 35249 2
822 agent claude-sonnet-5 1712 37623 8
823 agent claude-sonnet-5 3687 39335 0
824 agent claude-sonnet-5 4002 43022 8
825 agent claude-sonnet-5 4596 47024 4
826 agent claude-sonnet-5 4845 51620 5
827 agent claude-sonnet-5 2694 56465 3
828 agent claude-sonnet-5 1522 59159 3
829 agent claude-sonnet-5 6301 60681 7
830 agent claude-sonnet-5 1369 66982 7
831 agent claude-sonnet-5 2351 68351 3
832 agent claude-sonnet-5 3956 70702 5
833 agent claude-sonnet-5 3836 74658 3
834 agent claude-sonnet-5 1199 78494 20
835 agent claude-sonnet-5 2216 79693 20
836 agent claude-sonnet-5 772 81909 2
837 agent claude-sonnet-5 806 82681 5
838 agent claude-sonnet-5 1168 83487 2
839 agent claude-sonnet-5 956 84655 3
840 agent claude-sonnet-5 403 85611 2
841 agent claude-sonnet-5 2551 86014 5
842 agent claude-sonnet-5 1513 88565 2
843 agent claude-sonnet-5 391 90078 1
844 agent claude-sonnet-5 2275 90469 2
845 agent claude-sonnet-5 1887 92744 1
846 agent claude-sonnet-5 289 94631 6
847 agent claude-sonnet-5 492 94920 4
848 agent claude-sonnet-5 349 95412 8
849 agent claude-sonnet-5 0 96461 5
850 agent claude-haiku-4-5-20251001 13556 0 4
851 agent claude-haiku-4-5-20251001 1957 13556 2
852 agent claude-haiku-4-5-20251001 767 15513 1
853 agent claude-haiku-4-5-20251001 635 16280 4
854 agent claude-haiku-4-5-20251001 425 16915 2
855 agent claude-haiku-4-5-20251001 629 17340 3
856 agent claude-haiku-4-5-20251001 754 17969 4
857 agent claude-haiku-4-5-20251001 1666 18723 0
858 agent claude-haiku-4-5-20251001 316 20389 4
859 agent claude-haiku-4-5-20251001 183 20705 4
860 agent claude-opus-5 30787 0 1
861 agent claude-opus-5 4724 30787 1
862 agent claude-opus-5 2904 35511 2
863 agent claude-opus-5 1770 38415 3
864 agent claude-opus-5 5511 40185 5
865 agent claude-opus-5 6347 45696 3
866 agent claude-opus-5 10565 52043 3
867 agent claude-opus-5 9855 62608 2
868 agent claude-opus-5 3717 72463 20
869 agent claude-opus-5 2495 76180 5
870 agent claude-opus-5 2192 78675 21
871 agent claude-opus-5 3951 80867 3
872 agent claude-opus-5 5653 84818 2
873 agent claude-opus-5 4055 90471 7
874 agent claude-opus-5 5029 94526 0
875 agent claude-opus-5 2159 99555 2
876 agent claude-opus-5 5584 101714 3
877 agent claude-opus-5 2729 107298 3
878 agent claude-opus-5 4649 110027 2
879 agent claude-opus-5 4233 114676 2
880 agent claude-opus-5 3035 118909 3
881 agent claude-opus-5 3601 121944 3
882 agent claude-opus-5 2523 125545 3
883 agent claude-opus-5 1985 128068 5
884 agent claude-opus-5 481 130053 17
885 agent claude-opus-5 316 130534 3
886 agent claude-opus-5 220 130850 17
887 agent claude-opus-5 191 131070 20
888 agent claude-opus-5 474 131261 17
889 agent claude-opus-5 203 131735 17
890 agent claude-opus-5 334 131938 7
891 agent claude-opus-5 249 132272 16
892 agent claude-opus-5 363 132521 16
893 agent claude-opus-5 364 132884 2
894 agent claude-opus-5 747 133248 2
895 agent claude-opus-5 578 133995 20
896 agent claude-opus-5 370 134573 3
897 agent claude-opus-5 634 134943 2
898 agent claude-opus-5 1811 135577 2
899 agent claude-opus-5 2101 137388 2
900 agent claude-opus-5 429 139489 17
901 agent claude-opus-5 468 139918 2
902 agent claude-opus-5 4721 140386 3
903 agent claude-opus-5 12813 145107 17
904 agent claude-opus-5 599 157920 3
905 agent claude-opus-5 217 158519 20
906 agent claude-opus-5 1026 158736 21
907 agent claude-opus-5 2362 159762 2
908 agent claude-opus-5 950 162124 17
909 agent claude-opus-5 356 163074 21
910 agent claude-opus-5 2368 163430 8
911 agent claude-opus-5 735 165798 6
912 agent claude-opus-5 197 166533 16
913 agent claude-opus-5 7740 166730 0
914 agent claude-opus-5 704 174470 5
915 agent claude-opus-5 353 175174 1
916 agent claude-opus-5 157646 17190 10
917 agent claude-opus-5 1558 174836 16
918 agent claude-opus-5 1763 176394 2
919 agent claude-opus-5 2274 178157 20
920 agent claude-opus-5 583 180431 3
921 agent claude-opus-5 1069 181014 3
922 agent claude-opus-5 6114 182083 3
923 agent claude-opus-5 2972 188197 3
924 agent claude-opus-5 1196 191169 20
925 agent claude-opus-5 2595 192365 20
926 agent claude-opus-5 894 194960 3
927 agent claude-opus-5 644 195854 0
928 agent claude-opus-5 666 196498 2
929 agent claude-opus-5 584 197164 4
930 agent claude-opus-5 1333 197748 20
931 agent claude-opus-5 2937 199081 2
932 agent claude-opus-5 4387 202018 3
933 agent claude-opus-5 1416 206405 2
934 agent claude-opus-5 1102 207821 2
935 agent claude-opus-5 1997 208923 2
936 agent claude-opus-5 282 210920 17
937 agent claude-opus-5 432 211202 16
938 agent claude-opus-5 357 211634 0
939 agent claude-opus-5 925 211991 2
940 agent claude-opus-5 1688 212916 20
941 agent claude-opus-5 370 214604 1
942 agent claude-haiku-4-5-20251001 13025 0 4
943 agent claude-haiku-4-5-20251001 1575 13025 2
944 agent claude-haiku-4-5-20251001 484 14600 4
945 agent claude-haiku-4-5-20251001 526 15084 2
946 agent claude-haiku-4-5-20251001 7567 15610 2
947 agent claude-haiku-4-5-20251001 1710 23177 3
948 agent claude-haiku-4-5-20251001 289 24887 4
949 agent claude-sonnet-5 19740 0 7
950 agent claude-sonnet-5 2491 19740 4
951 agent claude-sonnet-5 720 22231 20
952 agent claude-sonnet-5 3084 22951 2
953 agent claude-sonnet-5 2179 26035 2
954 agent claude-sonnet-5 448 28214 2
955 agent claude-sonnet-5 2131 28662 3
956 agent claude-sonnet-5 466 30793 20
957 agent claude-sonnet-5 275 31259 20
958 agent claude-sonnet-5 330 31534 2
959 agent claude-sonnet-5 257 31864 4
960 agent claude-sonnet-5 263 32121 20
961 agent claude-sonnet-5 433 32384 9
962 agent claude-sonnet-5 1425 32817 2
963 agent claude-sonnet-5 1289 34242 2
964 agent claude-sonnet-5 630 35531 2
965 agent claude-sonnet-5 465 36161 3
966 agent claude-sonnet-5 279 36626 2
967 agent claude-sonnet-5 872 36905 20
968 agent claude-sonnet-5 1467 37777 2
969 agent claude-sonnet-5 1027 39244 3
970 agent claude-sonnet-5 743 40271 3
971 agent claude-sonnet-5 779 41014 20
972 agent claude-sonnet-5 204 41793 20
973 agent claude-sonnet-5 216 41997 20
974 agent claude-sonnet-5 377 42213 20
975 agent claude-sonnet-5 958 42590 8
976 agent claude-sonnet-5 1576 43548 8
977 agent claude-sonnet-5 1849 45124 2
978 agent claude-sonnet-5 698 46973 2
979 agent claude-sonnet-5 1176 47671 20
980 agent claude-haiku-4-5-20251001 12687 0 4
981 agent claude-haiku-4-5-20251001 1512 12687 2
982 agent claude-haiku-4-5-20251001 314 14199 4
983 agent claude-haiku-4-5-20251001 315 14513 3
984 agent claude-haiku-4-5-20251001 568 14828 2
985 agent claude-haiku-4-5-20251001 242 15396 4
986 agent claude-haiku-4-5-20251001 720 15638 2
987 agent claude-haiku-4-5-20251001 819 16358 2
988 agent claude-haiku-4-5-20251001 446 17177 2
989 agent claude-haiku-4-5-20251001 592 17623 4
990 agent claude-haiku-4-5-20251001 286 18215 4
991 agent claude-haiku-4-5-20251001 170 18501 2
992 agent claude-sonnet-5 7122 11475 4
993 agent claude-sonnet-5 3412 18597 5
994 agent claude-sonnet-5 423 22009 21
995 agent claude-sonnet-5 3825 22432 8
996 agent claude-sonnet-5 1055 26257 20
997 agent claude-sonnet-5 26269 27312 3
998 agent claude-sonnet-5 1874 53581 10
999 agent claude-sonnet-5 11006 55455 3
1000 agent claude-sonnet-5 9774 66461 2
1001 agent claude-sonnet-5 371 76235 3
1002 agent claude-sonnet-5 1325 76606 0
1003 agent claude-sonnet-5 2760 77931 3
1004 agent claude-sonnet-5 642 80691 20
1005 agent claude-sonnet-5 725 81333 20
1006 agent claude-sonnet-5 986 82058 3
1007 agent claude-sonnet-5 932 83044 3
1008 agent claude-sonnet-5 778 83976 2
1009 agent claude-sonnet-5 982 84754 3
1010 agent claude-sonnet-5 314 85736 2
1011 agent claude-sonnet-5 599 86050 2
1012 agent claude-sonnet-5 1438 86649 2
1013 agent claude-sonnet-5 776 88087 2
1014 agent claude-sonnet-5 337 88863 3
1015 agent claude-sonnet-5 559 89200 0
1016 agent claude-sonnet-5 366 89759 3
1017 agent claude-sonnet-5 2123 90125 2
1018 agent claude-sonnet-5 3412 92248 0
1019 agent claude-sonnet-5 720 95660 2
1020 agent claude-sonnet-5 415 96380 5
1021 agent claude-sonnet-5 1140 96795 0
1022 agent claude-sonnet-5 310 97935 17
1023 agent claude-sonnet-5 2273 98245 2
1024 agent claude-sonnet-5 1915 100518 6
1025 agent claude-sonnet-5 2735 102433 3
1026 agent claude-sonnet-5 1434 105168 3
1027 agent claude-sonnet-5 531 106602 0
1028 agent claude-sonnet-5 1633 107133 20
1029 agent claude-sonnet-5 720 108766 4
1030 agent claude-sonnet-5 3206 109486 5
1031 agent claude-sonnet-5 170 112692 20
1032 agent claude-sonnet-5 332 112862 17
1033 agent claude-sonnet-5 206 113194 16
1034 agent claude-sonnet-5 802 113400 5
1035 agent claude-sonnet-5 2307 114202 3
1036 agent claude-sonnet-5 259 116509 3
1037 agent claude-sonnet-5 4462 116768 2
1038 agent claude-sonnet-5 166 121230 20
1039 agent claude-sonnet-5 1390 121396 2
1040 agent claude-sonnet-5 896 122786 4
1041 agent claude-sonnet-5 612 123682 6
1042 agent claude-sonnet-5 1468 124294 3
1043 agent claude-sonnet-5 352 125762 3
1044 agent claude-sonnet-5 1109 126114 20
1045 agent claude-sonnet-5 425 127223 7
1046 agent claude-sonnet-5 889 127648 6
1047 agent claude-sonnet-5 1016 128537 2
1048 agent claude-sonnet-5 205 129553 20
1049 agent claude-sonnet-5 154 129758 20
1050 agent claude-sonnet-5 698 129912 9
1051 agent claude-sonnet-5 928 130610 9
1052 agent claude-sonnet-5 480 131538 8
1053 agent claude-sonnet-5 309 132018 1
1054 agent claude-sonnet-5 119457 11467 5
1055 agent claude-sonnet-5 1710 130924 2
1056 agent claude-sonnet-5 1404 132634 0
1057 agent claude-sonnet-5 615 134038 2
1058 agent claude-sonnet-5 1096 134653 17
1059 agent claude-sonnet-5 957 135749 6
1060 agent claude-sonnet-5 605 136706 17
1061 agent claude-sonnet-5 308 137311 2
1062 agent claude-sonnet-5 713 137619 17
1063 agent claude-sonnet-5 368 138332 4
1064 agent claude-sonnet-5 229 138700 2
1065 agent claude-sonnet-5 1058 138929 0
1066 agent claude-sonnet-5 172 139987 2
1067 agent claude-sonnet-5 14482 140159 4
1068 agent claude-sonnet-5 758 154641 2
1069 agent claude-sonnet-5 3436 155399 2
1070 agent claude-sonnet-5 661 158835 3
1071 agent claude-sonnet-5 2873 159496 3
1072 agent claude-sonnet-5 2691 162369 3
1073 agent claude-sonnet-5 631 165060 3
1074 agent claude-sonnet-5 6337 165691 4
1075 agent claude-sonnet-5 455 172028 3
1076 agent claude-sonnet-5 215 172483 6
1077 agent claude-sonnet-5 512 172698 8
1078 agent claude-sonnet-5 5091 173210 2
1079 agent claude-sonnet-5 370 178301 0
1080 agent claude-sonnet-5 590 178671 20
1081 agent claude-sonnet-5 827 179261 1
1082 agent claude-sonnet-5 4948 180088 2
1083 agent claude-sonnet-5 7826 185036 3
1084 agent claude-sonnet-5 2402 192862 3
1085 agent claude-sonnet-5 1620 195264 2
1086 agent claude-sonnet-5 2255 196884 2
1087 agent claude-sonnet-5 2151 199139 5
1088 agent claude-sonnet-5 1438 201290 3
1089 agent claude-sonnet-5 1141 202728 6
1090 agent claude-sonnet-5 872 203869 2
1091 agent claude-sonnet-5 2187 204741 3
1092 agent claude-sonnet-5 499 206928 6
1093 agent claude-sonnet-5 286 207427 2
1094 agent claude-sonnet-5 1542 207713 2
1095 agent claude-sonnet-5 650 209255 20
1096 agent claude-sonnet-5 789 209905 2
1097 agent claude-sonnet-5 1320 210694 2
1098 agent claude-sonnet-5 1105 212014 3
1099 agent claude-sonnet-5 1554 213119 2
1100 agent claude-sonnet-5 1262 214673 9
1101 agent claude-sonnet-5 815 215935 3
1102 agent claude-sonnet-5 1037 216750 0
1103 agent claude-sonnet-5 625 217787 20
1104 agent claude-sonnet-5 154 218412 20
1105 agent claude-sonnet-5 196 218566 2
1106 agent claude-sonnet-5 1252 218762 2
1107 agent claude-sonnet-5 1966 220014 2
1108 agent claude-sonnet-5 218 221980 20
1109 agent claude-sonnet-5 2372 222198 3
1110 agent claude-sonnet-5 735 224570 2
1111 agent claude-sonnet-5 1019 225305 1
1112 agent claude-sonnet-5 281 226324 1
1113 agent claude-sonnet-5 212555 11467 5
1114 agent claude-sonnet-5 1973 224022 7
1115 agent claude-sonnet-5 1366 225995 2
1116 agent claude-sonnet-5 2697 227361 3
1117 agent claude-sonnet-5 8586 230058 8
1118 agent claude-sonnet-5 5430 238644 3
1119 agent claude-sonnet-5 5720 244074 3
1120 agent claude-sonnet-5 1455 249794 2
1121 agent claude-sonnet-5 503 251249 20
1122 agent claude-sonnet-5 829 251752 3
1123 agent claude-sonnet-5 1736 252581 3
1124 agent claude-sonnet-5 3150 254317 3
1125 agent claude-sonnet-5 1053 257467 3
1126 agent claude-sonnet-5 1404 258520 2
1127 agent claude-sonnet-5 872 259924 3
1128 agent claude-sonnet-5 1104 260796 1
1129 agent claude-sonnet-5 272 261900 2
1130 agent claude-haiku-4-5-20251001 5598 6509 4
1131 agent claude-haiku-4-5-20251001 1721 12107 2
1132 agent claude-haiku-4-5-20251001 285 13828 2
1133 agent claude-haiku-4-5-20251001 415 14113 2
1134 agent claude-haiku-4-5-20251001 18254 14528 1
1135 agent claude-haiku-4-5-20251001 860 32782 2
1136 agent claude-haiku-4-5-20251001 291 33642 2
1137 agent claude-opus-5 10758 15753 1
1138 agent claude-opus-5 9971 26511 3
1139 agent claude-opus-5 23086 36482 3
1140 agent claude-opus-5 5840 59568 4
1141 agent claude-opus-5 4295 65408 3
1142 agent claude-opus-5 6358 69703 6
1143 agent claude-opus-5 6293 76061 4
1144 agent claude-opus-5 4931 82354 3
1145 agent claude-opus-5 3314 87285 3
1146 agent claude-opus-5 2735 90599 5
1147 agent claude-opus-5 3277 93334 3
1148 agent claude-opus-5 4806 96611 3
1149 agent claude-opus-5 3927 101417 3
1150 agent claude-opus-5 1878 105344 5
1151 agent claude-opus-5 2194 107222 3
1152 agent claude-opus-5 1984 109416 2
1153 agent claude-opus-5 1652 111400 2
1154 agent claude-opus-5 4662 113052 3
1155 agent claude-haiku-4-5-20251001 12255 0 4
1156 agent claude-haiku-4-5-20251001 1957 12255 2
1157 agent claude-haiku-4-5-20251001 445 14212 1
1158 agent claude-haiku-4-5-20251001 573 14657 2
1159 agent claude-haiku-4-5-20251001 226 15230 3
1160 agent claude-haiku-4-5-20251001 1251 15456 4
1161 agent claude-haiku-4-5-20251001 1716 16707 2
1162 agent claude-haiku-4-5-20251001 19872 18423 2
1163 agent claude-haiku-4-5-20251001 1202 38295 2
1164 agent claude-haiku-4-5-20251001 271 39497 2
1165 agent claude-sonnet-5 18509 0 4
1166 agent claude-sonnet-5 2494 18509 5
1167 agent claude-sonnet-5 231 21003 17
1168 agent claude-sonnet-5 1811 21234 3
1169 agent claude-sonnet-5 473 23045 3
1170 agent claude-sonnet-5 1443 23518 2
1171 agent claude-sonnet-5 1620 24961 3
1172 agent claude-sonnet-5 3329 26581 7
1173 agent claude-sonnet-5 6904 29910 1
1174 agent claude-sonnet-5 404 36814 8
1175 agent claude-sonnet-5 192 37218 9
1176 agent claude-sonnet-5 1446 37410 5
1177 agent claude-sonnet-5 1178 38856 17
1178 agent claude-sonnet-5 405 40034 2
1179 agent claude-sonnet-5 1697 40439 2
1180 agent claude-sonnet-5 945 42136 21
1181 agent claude-sonnet-5 1776 43081 2
1182 agent claude-sonnet-5 1907 44857 2
1183 agent claude-sonnet-5 749 46764 2
1184 agent claude-sonnet-5 1475 47513 3
1185 agent claude-sonnet-5 2959 48988 2
1186 agent claude-sonnet-5 713 51947 17
1187 agent claude-sonnet-5 625 52660 17
1188 agent claude-sonnet-5 533 53285 0
1189 agent claude-sonnet-5 1071 53818 3
1190 agent claude-sonnet-5 1180 54889 0
1191 agent claude-sonnet-5 1220 56069 8
1192 agent claude-sonnet-5 1104 57289 1
1193 agent claude-haiku-4-5-20251001 12676 0 4
1194 agent claude-haiku-4-5-20251001 1478 12676 2
1195 agent claude-haiku-4-5-20251001 486 14154 2
1196 agent claude-haiku-4-5-20251001 446 14640 2
1197 agent claude-haiku-4-5-20251001 1213 15086 2
1198 agent claude-haiku-4-5-20251001 421 16299 5
1199 agent claude-haiku-4-5-20251001 12324 0 4
1200 agent claude-haiku-4-5-20251001 1549 12324 2
1201 agent claude-haiku-4-5-20251001 429 13873 2
1202 agent claude-haiku-4-5-20251001 631 14302 2
1203 agent claude-haiku-4-5-20251001 692 14933 3
1204 agent claude-haiku-4-5-20251001 382 15625 4
1205 agent claude-haiku-4-5-20251001 13067 0 0
1206 agent claude-haiku-4-5-20251001 1671 13067 2
1207 agent claude-haiku-4-5-20251001 194 14738 2
1208 agent claude-haiku-4-5-20251001 353 14932 1
1209 agent claude-haiku-4-5-20251001 4197 15285 1
1210 agent claude-haiku-4-5-20251001 1100 19482 2
1211 agent claude-haiku-4-5-20251001 227 20582 1
1212 agent claude-haiku-4-5-20251001 487 20809 2
1213 agent claude-haiku-4-5-20251001 1278 21296 1
1214 agent claude-haiku-4-5-20251001 315 22574 1
1215 agent claude-haiku-4-5-20251001 200 22889 2
1216 agent claude-haiku-4-5-20251001 219 23089 2
1217 agent claude-haiku-4-5-20251001 635 23308 1
1218 agent claude-haiku-4-5-20251001 1315 23943 0
1219 agent claude-haiku-4-5-20251001 298 25258 4
1220 agent claude-haiku-4-5-20251001 302 25556 4
1221 agent claude-opus-5 10679 15753 1
1222 agent claude-opus-5 7750 26432 5
1223 agent claude-opus-5 10483 34182 17
1224 agent claude-opus-5 10630 44665 17
1225 agent claude-opus-5 10928 55295 6
1226 agent claude-opus-5 2307 66223 17
1227 agent claude-opus-5 2899 68530 20
1228 agent claude-opus-5 4731 71429 4
1229 agent claude-opus-5 2910 76160 4
1230 agent claude-opus-5 1067 79070 2
1231 agent claude-opus-5 2636 80137 17
1232 agent claude-opus-5 1829 82773 3
1233 agent claude-opus-5 1141 84602 4
1234 agent claude-opus-5 1622 85743 4
1235 agent claude-opus-5 3289 87365 5
1236 agent claude-opus-5 2815 90654 20
1237 agent claude-opus-5 1200 93469 2
1238 agent claude-opus-5 882 94669 3
1239 agent claude-opus-5 3311 95551 2
1240 agent claude-haiku-4-5-20251001 12607 0 4
1241 agent claude-haiku-4-5-20251001 1620 12607 2
1242 agent claude-haiku-4-5-20251001 583 14227 2
1243 agent claude-haiku-4-5-20251001 186 14810 2
1244 agent claude-haiku-4-5-20251001 3518 14996 2
1245 agent claude-haiku-4-5-20251001 1433 18514 2
1246 agent claude-haiku-4-5-20251001 1153 19947 2
1247 agent claude-haiku-4-5-20251001 285 21100 5
1248 agent claude-sonnet-5 16936 0 5
1249 agent claude-sonnet-5 2713 16936 4
1250 agent claude-sonnet-5 1661 19649 20
1251 agent claude-sonnet-5 13698 21310 3
1252 agent claude-sonnet-5 465 35008 17
1253 agent claude-sonnet-5 15139 35473 10
1254 agent claude-sonnet-5 2837 50612 2
1255 agent claude-sonnet-5 8897 53449 3
1256 agent claude-sonnet-5 1351 62346 3
1257 agent claude-sonnet-5 881 63697 3
1258 agent claude-sonnet-5 10012 64578 0
1259 agent claude-sonnet-5 7111 74590 5
1260 agent claude-sonnet-5 545 81701 0
1261 agent claude-sonnet-5 23481 82246 0
1262 agent claude-sonnet-5 3569 105727 2
1263 agent claude-sonnet-5 10056 109296 3
1264 agent claude-sonnet-5 3591 119352 3
1265 agent claude-sonnet-5 1326 122943 0
1266 agent claude-sonnet-5 4251 124269 3
1267 agent claude-sonnet-5 1949 128520 3
1268 agent claude-sonnet-5 585 130469 0
1269 agent claude-sonnet-5 1831 131054 3
1270 agent claude-sonnet-5 1419 132885 4
1271 agent claude-sonnet-5 956 134304 0
1272 agent claude-sonnet-5 1648 135260 4
1273 agent claude-sonnet-5 867 136908 2
1274 agent claude-sonnet-5 420 137775 2
1275 agent claude-sonnet-5 936 138195 3
1276 agent claude-sonnet-5 5350 139131 2
1277 agent claude-sonnet-5 1308 144481 2
1278 agent claude-sonnet-5 1238 145789 2
1279 agent claude-sonnet-5 362 147027 0
1280 agent claude-haiku-4-5-20251001 12818 0 2
1281 agent claude-haiku-4-5-20251001 1859 12818 2
1282 agent claude-haiku-4-5-20251001 639 14677 2
1283 agent claude-haiku-4-5-20251001 480 15316 2
1284 agent claude-haiku-4-5-20251001 2736 15796 2
1285 agent claude-haiku-4-5-20251001 404 18532 5
1286 agent claude-haiku-4-5-20251001 13141 0 4
1287 agent claude-haiku-4-5-20251001 1773 13141 1
1288 agent claude-haiku-4-5-20251001 952 14914 2
1289 agent claude-haiku-4-5-20251001 819 15866 3
1290 agent claude-haiku-4-5-20251001 3639 16685 3
1291 agent claude-haiku-4-5-20251001 286 20324 4
1292 agent claude-sonnet-5 18211 0 4
1293 agent claude-sonnet-5 3179 18211 2
1294 agent claude-sonnet-5 198 21390 16
1295 agent claude-sonnet-5 205 21588 9
1296 agent claude-sonnet-5 1045 21793 8
1297 agent claude-sonnet-5 376 22838 20
1298 agent claude-sonnet-5 191 23214 1
1299 agent claude-sonnet-5 213 23405 20
1300 agent claude-sonnet-5 307 23618 5
1301 agent claude-sonnet-5 170 23925 2
1302 agent claude-opus-5 10807 15753 1
1303 agent claude-opus-5 8021 26560 5
1304 agent claude-opus-5 1846 34581 3
1305 agent claude-opus-5 2015 36427 5
1306 agent claude-opus-5 7729 38442 3
1307 agent claude-opus-5 2735 46171 9
1308 agent claude-opus-5 2741 48906 6
1309 agent claude-opus-5 2469 51647 8
1310 agent claude-opus-5 916 54116 2
1311 agent claude-haiku-4-5-20251001 12415 0 4
1312 agent claude-haiku-4-5-20251001 1702 12415 1
1313 agent claude-haiku-4-5-20251001 708 14117 2
1314 agent claude-haiku-4-5-20251001 240 14825 2
1315 agent claude-haiku-4-5-20251001 337 15065 4
1316 agent claude-haiku-4-5-20251001 1419 15402 2
1317 agent claude-haiku-4-5-20251001 4360 16821 2
1318 agent claude-haiku-4-5-20251001 2242 21181 2
1319 agent claude-haiku-4-5-20251001 652 23423 4
1320 agent claude-haiku-4-5-20251001 311 24075 4
1321 agent claude-sonnet-5 7079 11467 5
1322 agent claude-sonnet-5 2380 18546 4
1323 agent claude-sonnet-5 5016 20926 4
1324 agent claude-sonnet-5 2578 25942 3
1325 agent claude-sonnet-5 1150 28520 5
1326 agent claude-sonnet-5 2641 29670 8
1327 agent claude-sonnet-5 5613 32311 4
1328 agent claude-sonnet-5 604 37924 17
1329 agent claude-sonnet-5 401 38528 17
1330 agent claude-sonnet-5 390 38929 2
1331 agent claude-sonnet-5 520 39319 20
1332 agent claude-sonnet-5 1364 39839 3
1333 agent claude-sonnet-5 763 41203 0
1334 agent claude-sonnet-5 192 41966 20
1335 agent claude-sonnet-5 300 42158 0
1336 agent claude-sonnet-5 500 42458 8
1337 agent claude-sonnet-5 1043 42958 2
1338 agent claude-sonnet-5 934 44001 0
1339 agent claude-sonnet-5 488 44935 0
1340 agent claude-sonnet-5 410 45423 8
1341 agent claude-sonnet-5 1038 45833 2
1342 agent claude-sonnet-5 300 46871 2
1343 agent claude-sonnet-5 487 47171 0
1344 agent claude-sonnet-5 499 47658 16
1345 agent claude-sonnet-5 499 48157 7
1346 agent claude-sonnet-5 605 48656 3
1347 agent claude-sonnet-5 1657 49261 3
1348 agent claude-sonnet-5 2294 50918 4
1349 agent claude-sonnet-5 480 53212 17
1350 agent claude-sonnet-5 1282 53692 20
1351 agent claude-sonnet-5 313 54974 2
1352 agent claude-sonnet-5 548 55287 2
1353 agent claude-sonnet-5 1177 55835 3
1354 agent claude-sonnet-5 271 57012 2
1355 agent claude-sonnet-5 468 57283 4
1356 agent claude-sonnet-5 716 57751 3
1357 agent claude-sonnet-5 627 58467 2
1358 agent claude-sonnet-5 336 59094 2
1359 agent claude-sonnet-5 17907 0 3
1360 agent claude-sonnet-5 2794 17907 2
1361 agent claude-sonnet-5 1182 20701 3
1362 agent claude-sonnet-5 411 21883 1
1363 agent claude-sonnet-5 611 22294 20
1364 agent claude-sonnet-5 2086 22905 0
1365 agent claude-haiku-4-5-20251001 12577 0 1
1366 agent claude-haiku-4-5-20251001 1657 12577 2
1367 agent claude-haiku-4-5-20251001 469 14234 2
1368 agent claude-haiku-4-5-20251001 248 14703 1
1369 agent claude-haiku-4-5-20251001 249 14951 2
1370 agent claude-haiku-4-5-20251001 658 15200 3
1371 agent claude-haiku-4-5-20251001 1630 15858 2
1372 agent claude-haiku-4-5-20251001 2122 17488 4
1373 agent claude-haiku-4-5-20251001 368 19610 4
1374 agent claude-sonnet-5 7120 11467 5
1375 agent claude-sonnet-5 2297 18587 2
1376 agent claude-sonnet-5 484 20884 17
1377 agent claude-sonnet-5 24873 21368 2
1378 agent claude-sonnet-5 7185 46241 3
1379 agent claude-sonnet-5 3165 53426 6
1380 agent claude-sonnet-5 1602 56591 2
1381 agent claude-sonnet-5 216 58193 20
1382 agent claude-sonnet-5 180 58409 20
1383 agent claude-sonnet-5 225 58589 20
1384 agent claude-sonnet-5 455 58814 2
1385 agent claude-sonnet-5 778 59269 20
1386 agent claude-sonnet-5 447 60047 8
1387 agent claude-sonnet-5 399 60494 20
1388 agent claude-sonnet-5 516 60893 3
1389 agent claude-sonnet-5 2491 61409 2
1390 agent claude-sonnet-5 2518 63900 3
1391 agent claude-sonnet-5 1616 66418 3
1392 agent claude-sonnet-5 1280 68034 2
1393 agent claude-sonnet-5 204 69314 20
1394 agent claude-sonnet-5 749 69518 2
1395 agent claude-sonnet-5 579 70267 3
1396 agent claude-sonnet-5 642 70846 2
1397 agent claude-sonnet-5 1029 71488 2
1398 agent claude-sonnet-5 223 72517 2
1399 agent claude-sonnet-5 1203 72740 20
1400 agent claude-sonnet-5 306 73943 3
1401 agent claude-sonnet-5 1023 74249 9
1402 agent claude-sonnet-5 371 75272 20
1403 agent claude-sonnet-5 534 75643 4
1404 agent claude-sonnet-5 197 76177 20
1405 agent claude-sonnet-5 624 76374 2
1406 agent claude-sonnet-5 178 76998 4
1407 agent claude-sonnet-5 242 77176 2
1408 agent claude-sonnet-5 356 77418 2
1409 agent claude-sonnet-5 239 77774 2
1410 agent claude-sonnet-5 352 78013 2
1411 agent claude-sonnet-5 463 78365 9
1412 agent claude-sonnet-5 1096 78828 2
1413 agent claude-sonnet-5 571 79924 8
1414 agent claude-sonnet-5 434 80495 2
1415 agent claude-sonnet-5 18414 0 4
1416 agent claude-sonnet-5 3416 18414 4
1417 agent claude-sonnet-5 2805 21830 3
1418 agent claude-sonnet-5 4264 24635 14
1419 agent claude-sonnet-5 12589 28899 10
1420 agent claude-sonnet-5 1892 41488 2
1421 agent claude-sonnet-5 166 43380 20
1422 agent claude-sonnet-5 2332 43546 3
1423 agent claude-sonnet-5 4322 45878 2
1424 agent claude-sonnet-5 316 50200 20
1425 agent claude-sonnet-5 586 50516 4
1426 agent claude-sonnet-5 687 51102 2
1427 agent claude-haiku-4-5-20251001 13128 0 4
1428 agent claude-haiku-4-5-20251001 3079 13128 2
1429 agent claude-haiku-4-5-20251001 456 16207 2
1430 agent claude-haiku-4-5-20251001 2030 16663 2
1431 agent claude-haiku-4-5-20251001 299 18693 2
1432 agent claude-sonnet-5 6581 11477 4
1433 agent claude-sonnet-5 2631 18058 4
1434 agent claude-sonnet-5 1547 20689 5
1435 agent claude-sonnet-5 1560 22236 2
1436 agent claude-sonnet-5 772 23796 3
1437 agent claude-sonnet-5 667 24568 3
1438 agent claude-sonnet-5 312 25235 2
1439 agent claude-sonnet-5 1170 25547 1
1440 agent claude-sonnet-5 796 26717 0
1441 agent claude-sonnet-5 6571 11477 4
1442 agent claude-sonnet-5 3216 18048 2
1443 agent claude-sonnet-5 799 21264 3
1444 agent claude-sonnet-5 684 22063 0
1445 agent claude-sonnet-5 475 22747 1
1446 agent claude-sonnet-5 314 23222 1
1447 agent claude-sonnet-5 6527 11477 3
1448 agent claude-sonnet-5 3585 18004 2
1449 agent claude-sonnet-5 1157 21589 2
1450 agent claude-sonnet-5 359 22746 20
1451 agent claude-sonnet-5 152 23105 2
1452 agent claude-sonnet-5 2953 23257 2
1453 agent claude-sonnet-5 768 26210 2
1454 agent claude-sonnet-5 320 26978 2
1455 agent claude-sonnet-5 322 27298 0
1456 agent claude-sonnet-5 260 27620 2
1457 agent claude-sonnet-5 210 27880 9
1458 agent claude-sonnet-5 335 28090 1
1459 agent claude-haiku-4-5-20251001 12821 0 0
1460 agent claude-haiku-4-5-20251001 1839 12821 2
1461 agent claude-haiku-4-5-20251001 1741 14660 2
1462 agent claude-haiku-4-5-20251001 1831 16401 2
1463 agent claude-haiku-4-5-20251001 476 18232 2
1464 agent claude-haiku-4-5-20251001 229 18708 4
1465 agent claude-sonnet-5 7026 11477 5
1466 agent claude-sonnet-5 2337 18503 2
1467 agent claude-sonnet-5 2403 20840 2
1468 agent claude-sonnet-5 868 23243 3
1469 agent claude-sonnet-5 748 24111 8
1470 agent claude-sonnet-5 2520 24859 4
1471 agent claude-sonnet-5 728 27379 3
1472 agent claude-sonnet-5 1501 28107 8
1473 agent claude-sonnet-5 432 29608 17
1474 agent claude-sonnet-5 449 30040 2
1475 agent claude-sonnet-5 337 30489 2
1476 agent claude-sonnet-5 681 30826 5
1477 agent claude-sonnet-5 226 31507 2
1478 agent claude-sonnet-5 398 31733 20
1479 agent claude-sonnet-5 274 32131 16
1480 agent claude-sonnet-5 420 32405 2
1481 agent claude-sonnet-5 830 32825 5
1482 agent claude-sonnet-5 751 33655 0
1483 agent claude-sonnet-5 442 34406 9
1484 agent claude-sonnet-5 579 34848 2
1485 agent claude-sonnet-5 601 35427 20
1486 agent claude-sonnet-5 303 36028 5
1487 agent claude-sonnet-5 181 36331 20
1488 agent claude-sonnet-5 1132 36512 4
1489 agent claude-sonnet-5 456 37644 3
1490 agent claude-sonnet-5 346 38100 1
1491 agent claude-sonnet-5 252 38446 1
1492 agent claude-sonnet-5 1636 38698 8
1493 agent claude-sonnet-5 1420 40334 2
1494 agent claude-sonnet-5 1427 41754 1
1495 agent claude-sonnet-5 6958 11475 4
1496 agent claude-sonnet-5 3557 18433 3
1497 agent claude-sonnet-5 3037 21990 20
1498 agent claude-sonnet-5 3530 25027 3
1499 agent claude-sonnet-5 20459 28557 3
1500 agent claude-sonnet-5 2950 49016 4
1501 agent claude-sonnet-5 2702 51966 2
1502 agent claude-sonnet-5 6236 54668 2
1503 agent claude-sonnet-5 11339 60904 3
1504 agent claude-sonnet-5 9099 72243 3
1505 agent claude-sonnet-5 1026 81342 7
1506 agent claude-sonnet-5 2600 82368 3
1507 agent claude-sonnet-5 361 84968 3
1508 agent claude-sonnet-5 2078 85329 2
1509 agent claude-sonnet-5 320 87407 17
1510 agent claude-sonnet-5 2425 87727 0
1511 agent claude-sonnet-5 2503 90152 3
1512 agent claude-sonnet-5 495 92655 8
1513 agent claude-sonnet-5 6468 93150 3
1514 agent claude-sonnet-5 515 99618 4
1515 agent claude-sonnet-5 1088 100133 4
1516 agent claude-sonnet-5 3457 101221 2
1517 agent claude-sonnet-5 246 104678 20
1518 agent claude-sonnet-5 560 104924 6
1519 agent claude-sonnet-5 607 105484 2
1520 agent claude-sonnet-5 261 106091 2
1521 agent claude-sonnet-5 371 106352 2
1522 agent claude-sonnet-5 273 106723 9
1523 agent claude-opus-5 26433 0 2
1524 agent claude-opus-5 1817 26433 17
1525 agent claude-opus-5 22634 28250 3
1526 agent claude-opus-5 14641 50884 3
1527 agent claude-opus-5 4594 65525 3
1528 agent claude-opus-5 5031 70119 3
1529 agent claude-opus-5 456 75150 16
1530 agent claude-opus-5 3184 75606 3
1531 agent claude-opus-5 2269 78790 3
1532 agent claude-opus-5 2226 81059 3
1533 agent claude-opus-5 3500 83285 3
1534 agent claude-opus-5 785 86785 6
1535 agent claude-opus-5 72645 15753 3
1536 agent claude-opus-5 567 88398 2
1537 agent claude-opus-5 1319 88965 4
1538 agent claude-opus-5 1022 90284 3
1539 agent claude-opus-5 637 91306 3
1540 agent claude-opus-5 2188 91943 9
1541 agent claude-opus-5 3042 94131 5
1542 agent claude-opus-5 1195 97173 2
1543 agent claude-opus-5 1816 98368 2
1544 agent claude-opus-5 574 100184 3
1545 agent claude-opus-5 5814 100758 3
1546 agent claude-opus-5 644 106572 5
1547 agent claude-sonnet-5 7180 11467 3
1548 agent claude-sonnet-5 2231 18647 5
1549 agent claude-sonnet-5 18350 20878 9
1550 agent claude-sonnet-5 2587 39228 2
1551 agent claude-sonnet-5 2160 41815 3
1552 agent claude-sonnet-5 4452 43975 2
1553 agent claude-sonnet-5 610 48427 0
1554 agent claude-sonnet-5 689 49037 8
1555 agent claude-sonnet-5 1407 49726 2
1556 agent claude-sonnet-5 643 51133 6
1557 agent claude-sonnet-5 4134 51776 2
1558 agent claude-sonnet-5 2044 55910 2
1559 agent claude-sonnet-5 1334 57954 20
1560 agent claude-sonnet-5 2227 59288 8
1561 agent claude-sonnet-5 507 61515 0
1562 agent claude-sonnet-5 1330 62022 10
1563 agent claude-sonnet-5 1998 63352 2
1564 agent claude-sonnet-5 1071 65350 3
1565 agent claude-sonnet-5 1232 66421 4
1566 agent claude-sonnet-5 1677 67653 20
1567 agent claude-sonnet-5 760 69330 17
1568 agent claude-sonnet-5 441 70090 17
1569 agent claude-sonnet-5 361 70531 20
1570 agent claude-sonnet-5 465 70892 1
1571 agent claude-sonnet-5 274 71357 1
1572 agent claude-sonnet-5 151 71631 1
1573 agent claude-sonnet-5 7051 11475 4
1574 agent claude-sonnet-5 6117 18526 2
1575 agent claude-sonnet-5 11899 24643 2
1576 agent claude-sonnet-5 950 36542 2
1577 agent claude-sonnet-5 611 37492 3
1578 agent claude-sonnet-5 1083 38103 2
1579 agent claude-sonnet-5 2355 39186 2
1580 agent claude-sonnet-5 567 41541 3
1581 agent claude-sonnet-5 891 42108 2
1582 agent claude-sonnet-5 543 42999 3
1583 agent claude-sonnet-5 463 43542 2
1584 agent claude-sonnet-5 483 44005 2
1585 agent claude-sonnet-5 1321 44488 3
1586 agent claude-sonnet-5 6655 45809 3
1587 agent claude-sonnet-5 3405 52464 5
1588 agent claude-sonnet-5 913 55869 5
1589 agent claude-sonnet-5 1620 56782 4
1590 agent claude-sonnet-5 425 58402 17
1591 agent claude-sonnet-5 318 58827 2
1592 agent claude-sonnet-5 3486 59145 7
1593 agent claude-sonnet-5 2198 62631 3
1594 agent claude-sonnet-5 3759 64829 2
1595 agent claude-sonnet-5 5287 68588 0
1596 agent claude-sonnet-5 224 73875 20
1597 agent claude-sonnet-5 1291 74099 2
1598 agent claude-sonnet-5 2029 75390 4
1599 agent claude-sonnet-5 1701 77419 2
1600 agent claude-sonnet-5 485 79120 9
1601 agent claude-sonnet-5 810 79605 3
1602 agent claude-sonnet-5 351 80415 2
1603 agent claude-sonnet-5 1183 80766 1
1604 agent claude-sonnet-5 73544 7828 4
1605 agent claude-sonnet-5 4428 81372 0
1606 agent claude-sonnet-5 1345 85800 0
1607 agent claude-sonnet-5 13085 87145 0
1608 agent claude-sonnet-5 5620 100230 2
1609 agent claude-sonnet-5 5442 105850 5
1610 agent claude-sonnet-5 5488 111292 6
1611 agent claude-sonnet-5 2209 116780 17
1612 agent claude-sonnet-5 623 118989 17
1613 agent claude-sonnet-5 719 119612 17
1614 agent claude-sonnet-5 650 120331 6
1615 agent claude-sonnet-5 14268 120981 2
1616 agent claude-sonnet-5 6768 135249 3
1617 agent claude-sonnet-5 5554 142017 2
1618 agent claude-sonnet-5 4891 147571 6
1619 agent claude-sonnet-5 1346 152462 2
1620 agent claude-sonnet-5 17442 153808 2
1621 agent claude-sonnet-5 172 171250 20
1622 agent claude-sonnet-5 961 171422 17
1623 agent claude-sonnet-5 1508 172383 2
1624 agent claude-sonnet-5 2899 173891 20
1625 agent claude-sonnet-5 204 176790 2
1626 agent claude-sonnet-5 1302 176994 3
1627 agent claude-sonnet-5 4450 178296 2
1628 agent claude-sonnet-5 688 182746 0
1629 agent claude-sonnet-5 755 183434 5
1630 agent claude-sonnet-5 1264 184189 3
1631 agent claude-sonnet-5 1976 185453 20
1632 agent claude-sonnet-5 1119 187429 2
1633 agent claude-sonnet-5 1265 188548 2
1634 agent claude-sonnet-5 871 189813 2
1635 agent claude-sonnet-5 760 190684 2
1636 agent claude-sonnet-5 1184 191444 2
1637 agent claude-sonnet-5 582 192628 20
1638 agent claude-sonnet-5 305 193210 3
1639 agent claude-sonnet-5 1343 193515 17
1640 agent claude-sonnet-5 607 194858 0
1641 agent claude-sonnet-5 585 195465 2
1642 agent claude-sonnet-5 298 196050 3
1643 agent claude-sonnet-5 633 196348 2
1644 agent claude-sonnet-5 574 196981 3
1645 agent claude-sonnet-5 669 197555 20
1646 agent claude-sonnet-5 703 198224 3
1647 agent claude-sonnet-5 1258 198927 20
1648 agent claude-sonnet-5 756 200185 9
1649 agent claude-sonnet-5 1041 200941 2
1650 agent claude-sonnet-5 705 201982 1
1651 agent claude-sonnet-5 201 202687 8
1652 agent claude-sonnet-5 263 202888 2
1653 agent claude-sonnet-5 313 203151 20
1654 agent claude-sonnet-5 173 203464 3
1655 agent claude-sonnet-5 516 203637 6
1656 agent claude-sonnet-5 354 204153 2
1657 agent claude-sonnet-5 455 204507 2
1658 agent claude-sonnet-5 726 204962 2
1659 agent claude-sonnet-5 2250 205688 8
1660 agent claude-sonnet-5 722 207938 8
1661 agent claude-sonnet-5 723 208660 17
1662 agent claude-sonnet-5 588 209383 2
1663 agent claude-sonnet-5 602 209971 5
1664 agent claude-haiku-4-5-20251001 13214 0 4
1665 agent claude-haiku-4-5-20251001 1465 13214 2
1666 agent claude-haiku-4-5-20251001 213 14679 2
1667 agent claude-haiku-4-5-20251001 893 14892 5
1668 agent claude-haiku-4-5-20251001 728 15785 1
1669 agent claude-haiku-4-5-20251001 571 16513 2
1670 agent claude-haiku-4-5-20251001 614 17084 4
1671 agent claude-haiku-4-5-20251001 393 17698 1
1672 agent claude-haiku-4-5-20251001 615 18091 2
1673 agent claude-haiku-4-5-20251001 968 18706 1
1674 agent claude-haiku-4-5-20251001 1072 19674 2
1675 agent claude-haiku-4-5-20251001 2311 20746 3
1676 agent claude-haiku-4-5-20251001 283 23057 3
1677 agent claude-sonnet-5 7013 11475 4
1678 agent claude-sonnet-5 4070 18488 2
1679 agent claude-sonnet-5 3846 22558 5
1680 agent claude-sonnet-5 1136 26404 3
1681 agent claude-sonnet-5 3632 27540 7
1682 agent claude-sonnet-5 5060 31172 4
1683 agent claude-sonnet-5 5727 36232 3
1684 agent claude-sonnet-5 2190 41959 2
1685 agent claude-sonnet-5 2355 44149 2
1686 agent claude-sonnet-5 312 46504 5
1687 agent claude-sonnet-5 1990 46816 4
1688 agent claude-sonnet-5 200 48806 20
1689 agent claude-sonnet-5 2470 49006 3
1690 agent claude-sonnet-5 1970 51476 3
1691 agent claude-sonnet-5 382 53446 20
1692 agent claude-sonnet-5 166 53828 8
1693 agent claude-sonnet-5 2402 53994 2
1694 agent claude-sonnet-5 469 56396 9
1695 agent claude-sonnet-5 1392 56865 1
1696 agent claude-sonnet-5 234 58257 0
1697 agent claude-sonnet-5 6800 11467 4
1698 agent claude-sonnet-5 8089 18267 2
1699 agent claude-sonnet-5 1229 26356 20
1700 agent claude-sonnet-5 1042 27585 2
1701 agent claude-sonnet-5 1067 28627 2
1702 agent claude-sonnet-5 1020 29694 20
1703 agent claude-sonnet-5 452 30714 2
1704 agent claude-sonnet-5 271 31166 1
1705 agent claude-sonnet-5 127 31437 1
1706 agent claude-haiku-4-5-20251001 6489 6509 4
1707 agent claude-haiku-4-5-20251001 1697 12998 2
1708 agent claude-haiku-4-5-20251001 836 14695 2
1709 agent claude-haiku-4-5-20251001 354 15531 2
1710 agent claude-haiku-4-5-20251001 2189 15885 2
1711 agent claude-haiku-4-5-20251001 444 18074 2
-->
<!-- /cout -->

### 40. Une suite de bout en bout rouge une fois sur trois, sur un code identique

**Symptome** — `bout-en-bout (pilabelle)` echoue en CI sur le commit e82a2d9 :
`aria-prohibited-attr (serious)` sur l'ecran d'exercice. Le meme job etait VERT
quinze minutes plus tot sur bb9dae1, et le seul commit entre les deux ajoute un
fichier de documentation sous `docs/`. Le code de l'app est identique a l'octet
pres.

Second symptome, dans le meme journal de job : la reprise automatique
n'echoue pas de la meme facon. Elle expire au bout de vingt secondes en
attendant `input[name="niveau"]`, c'est-a-dire le PREMIER champ du premier
ecran. La page n'etait donc pas dans l'etat attendu du tout.

**Cause** — non etablie, et c'est le constat. Ce qui a ete ecarte :

- **une montee de version d'axe** : `@axe-core/playwright` est declare en
  `^4.13.0`, la derniere version publiee EST 4.13.0, et c'est celle installee
  ici. Rien n'a bouge sous le caret ;
- **un defaut deterministe** : la suite passe **quatre fois sur quatre** en
  local, accessibilite comprise ;
- **une regression de cette branche** : le job repasse au VERT au run suivant
  (390) sans qu'une ligne de `pilabelle` ait ete touchee.

La piste que je n'ai pas pu confirmer depuis cette session est le **service
worker** (`apps/pilabelle/web/sw.js`) servant une version en cache pendant que
le scan tourne. C'est un mode d'echec que le depot a DEJA rencontre sur
`ramure` — anomalie 20 de cette meme branche, « le service worker rechargeait
la page sous le nez du scan ». Deux apps, meme symptome intermittent, meme
piece suspecte.

**SUITE, ET DEMENTI — le meme jour, sur main.** Ce qui precede concluait a un
alea. C'est faux, et la fusion l'a montre tout de suite : le run 393 sur `main`
(e0577712) echoue sur le MEME job, la MEME regle, le MEME ecran. Troisieme
occurrence. Ce n'est pas un alea, c'est un defaut intermittent.

Consequence immediate, et elle est bonne : `deploy` a ete **saute**, donc rien
n'est parti en production. Le garde-fou a fait exactement son travail — une
suite en navigateur rouge empeche la mise en ligne, y compris apres une fusion.

Ce que ce dementi apprend sur la methode, plus que sur pilabelle : **« je n'ai
pas reproduit » et « ce n'est pas reproductible » sont deux affirmations
differentes**, et j'ai ecrit la seconde en n'ayant etabli que la premiere. Cinq
passages locaux verts ne prouvent rien sur un runner dont la charge, la vitesse
et l'ordonnancement ne sont pas les miens. La regle qui en sort : un echec de CI
non reproduit en local se declare **non diagnostique**, jamais **non
reproductible**.

**Detecte par** — `CI`

**Action** — `garde-fou` — rien n'est corrige ici, et c'est assume : je n'ai pas
reproduit, donc je ne saurais pas si un correctif corrige quoi que ce soit. Ce
qui est ecrit, c'est la piste et l'ecartement des trois autres, pour que le
prochain ne refasse pas ce travail.

Ce qui rend ce cas digne d'une entree plutot que d'un haussement d'epaules :
**un controle qui rougit une fois sur trois apprend a le relancer, pas a le
lire.** C'est la version lente du vert silencieux — au lieu de rassurer a tort,
il inquiete a tort, et le resultat est le meme : on cesse de le croire. Les
sept verts silencieux de cette branche ont ete trouves parce que quelqu'un a
regarde un verdict au lieu de le relancer ; un job instable retire exactement
cette habitude-la.

Le garde-fou qui manque n'est pas dans `pilabelle` : c'est que la fabrique ne
sait pas COMPTER ses jobs instables. Un job qui rougit puis verdit sur un code
identique ne laisse aucune trace agregeable — il faut avoir vu passer les deux
runs. Piste pour qui la reprendra : relever, par app et par mois, le nombre de
runs ou un job a echoue puis reussi sans changement de code.

### 41. Un resultat d'outil archive, TRONQUE, resservi comme s'il etait complet

**Symptome** — pour completer la section `## Revue` du corps de la pull request,
un agent devait relire ce corps puis le reecrire entier. Le plugin
`token-optimizer` a intercepte l'appel — « cet appel a deja tourne, son resultat
complet est archive sur disque » — et l'a renvoye vers l'archive plutot que vers
GitHub.

L'archive faisait **5 425 caracteres** la ou le corps reel en fait **7 254**.
Elle etait tronquee de 25 %, et les apostrophes y etaient echappees en entites
HTML. Reecrire le corps depuis cette archive l'aurait **ampute d'un quart**, en
publiant le resultat sur la pull request.

**Cause** — l'archive est presentee comme « le resultat complet », et le message
d'interception decourage explicitement de rappeler l'outil (« re-fetching would
re-inflate context »). Rien dans ce message ne dit que l'archive peut etre
tronquee, ni comment le verifier. L'agent ne s'en est apercu qu'en comparant a
la source : il est alle relire le corps par l'API publique.

Le mecanisme est juste dans son intention — eviter de repayer un gros resultat
deja obtenu — et faux dans un cas precis : quand le resultat n'est pas lu pour
etre RESUME mais pour etre REECRIT. Une troncature invisible est sans
consequence dans le premier usage et destructrice dans le second.

**Detecte par** — `relecture`

**Action** — `comportement` — la regle qui en sort ne demande aucun code :
**un contenu qu'on va reecrire se relit a la source, jamais depuis un cache.**
Le cache d'un outil sert a repondre a une question ; il ne sert pas de version
de reference pour une modification. La difference est la meme qu'entre lire un
resume et editer l'original.

C'est encore le mode d'echec de toute cette branche, deplace dans l'outillage :
un intermediaire qui rend un resultat bien forme, plausible, et incomplet — sans
que rien n'echoue. Huitieme de la serie, et le premier a ne pas venir de la
fabrique elle-meme.

### 42. Le garde-fou du jour a refuse la fusion de son propre auteur

**Symptome** — la pull request de suivi (#159) ne porte que douze lignes : le
message d'erreur du bout en bout de `pilabelle` apprend a nommer le noeud
fautif. J'ai rempli sa section `## Revue` par « pas de passage de `relecteur`
ici, c'est delibere : le diff ne touche aucune logique ». Le job `contrat` a
refuse la pull request — « la ligne Code de la section Revue est vide ou sans
date ».

**Cause** — le controle ajoute par cette branche meme ne verifie pas que les
relecteurs ont eu **raison**, il verifie qu'ils ont eu **lieu** : la ligne doit
porter un nom et une date. Une bonne raison de sauter l'etape reste un saut de
l'etape, et c'est exactement la forme que prend le vert silencieux quand c'est
l'auteur qui se l'accorde — le motif est plausible, la verification n'a pas eu
lieu, rien n'echoue.

Le controle avait raison sur le fond, et pas seulement sur la forme. Lance pour
de bon, `relecteur` a trouve un defaut reel dans ces douze lignes : le message
capturait `target` et `html`, mais pas `failureSummary`. Or pour les regles ARIA
qui dependent du role, ce role est le plus souvent **implicite** — un `<button>`,
un `<input type=checkbox>` — et n'apparait donc dans **aucun attribut** du HTML
capture. Le prochain run rouge aurait affiche l'element sans dire quel couple
attribut/role est en cause : un passage de CI perdu, par le commit meme qui
existait pour en eviter un.

**Detecte par** — `CI`

**Action** — `rien` — rien a corriger : le garde-fou a fonctionne comme prevu,
sur le premier cas venu, contre celui qui l'a ecrit. Ce qui merite d'etre garde,
c'est la mesure : **entre le moment ou j'ai juge la relecture inutile et le
moment ou elle a trouve un defaut, il s'est ecoule deux minutes.** Mon estimation
du risque etait fausse sur un diff de douze lignes que j'avais ecrit moi-meme et
que je venais de relire. C'est le meilleur argument disponible contre l'idee
qu'un controle puisse etre saute « quand on sait que c'est sans risque ».

Neuvieme vert silencieux de la serie, et le seul que la branche ait attrape
elle-meme.

**Suite — le controle avait raison, et son message etait inutilisable.** Une
fois la section `## Revue` corrigee, le job est reste rouge. Le corps lu par
l'etape est celui que PORTAIT L'EVENEMENT, pas le corps actuel : `pull_request:`
sans `types:` n'ecoute que `opened` / `synchronize` / `reopened`, une EDITION du
corps ne declenche rien, et « Re-run » rejoue le payload d'origine — donc le
corps perime. Le message disait quoi corriger et taisait que le corriger ne
suffisait pas ; on tourne alors en rond en croyant la regle cassee.

Les deux messages de l'etape disent desormais qu'il faut POUSSER un commit
ensuite. Ce qui n'a PAS ete fait, et pourquoi : ajouter `edited` aux types
declencherait la construction des images et le bout en bout a chaque frappe
dans le corps d'une pull request, et le `cancel-in-progress` des pull requests
annulerait au passage le run utile en cours. Un commit de plus coute moins cher
qu'une chaine complete par virgule.

La forme generale, elle, depasse ce job : **un garde-fou qui dit quoi corriger
sans dire ce qu'il faut faire ENSUITE pour qu'il reverdisse est a moitie ecrit.**
Le premier a le subir a ete son auteur, le jour de sa mise en service.

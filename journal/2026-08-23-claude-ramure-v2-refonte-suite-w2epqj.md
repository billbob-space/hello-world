# 2026-08-23 — claude/ramure-v2-refonte-suite-w2epqj

Branche : `claude/ramure-v2-refonte-suite-w2epqj`
Périmètre : ramure-v2, fabrique
Mode : `chaud`

Suite de `journal/2026-08-22-claude-ramure-v2-refonte-1q0zsr.md`, dont les
anomalies 20, 21 et 23 sont le reste a traiter : le troisieme choix de forme
(les 548 px libres du mur), le rognage du mur, et les deux defauts d'outillage
laisses ouverts parce qu'ils debordaient de la demande d'alors.

## Anomalies

### 1. L'axe de couverture navigateur se taisait au lieu de rendre KO

**Symptome** — `./scripts/revue.sh ramure-v2` rendait « couverture Go 82,0 % » et
rien d'autre. Le client TypeScript de l'app — 15 modules, 16 fichiers de test —
n'etait mesure par aucune revue. Rien dans la sortie ne disait qu'une moitie de
l'app n'avait pas ete lue.

**Cause** — l'axe reconnaissait une seule chaine de test client, `node --test
tests/*.test.js` a la racine de l'app. C'est la chaine des trois apps qui
l'utilisent, et elle a l'avantage de n'installer aucune dependance. Un client en
TypeScript ne peut pas l'utiliser — node n'execute pas de `.ts` — et passe donc
par vitest, sous `web/`. Le `ls tests/*.test.js` echouait, la branche entiere
etait sautee, et `web_pct` restait vide : la variable vide traversait tout le
chemin jusqu'au manifeste, ou `revue_couverture_web` n'etait tout simplement
jamais posee. Un axe qui ne trouve pas ce qu'il cherche rend `ok`.

**Detecte par** — `relecture`

**Action** — `garde-fou` — le defaut n'est pas d'ignorer vitest, c'est de rendre
`ok` en n'ayant rien mesure. Une app qui echappe a un axe doit le FAIRE SAVOIR ;
ici l'app avait du reporter la barre dans son propre `test.sh`, ce qui donne deux
barres pour une mesure, dont une seule alimente le cliquet.

### 2. Les diagnostics du serveur de langage Go sont tous faux dans le conteneur cloud

**Symptome** — a la premiere edition d'un fichier Go, seize diagnostics
identiques : « go.work requires go >= 1.25.0 (running go 1.24.7) », sur des
fichiers qui compilent et dont les tests passent dans le meme conteneur.

**Cause** — deux Go dans l'image. Le shell voit `go1.25.0` ; `gopls`, lance par
le harnais, en trouve un autre en 1.24.7 et refuse de charger les paquets. Aucun
diagnostic Go n'est donc exploitable dans une session cloud, ni les vrais ni les
faux.

**Detecte par** — `auteur`

**Action** — `outillage` — un LSP qui rend seize faux constats sur un depot sain
coute plus qu'il ne rapporte : on apprend a ne plus lire ses sorties, et le jour
ou il en rend un vrai il est ignore. Meme mecanique que les faux « introuvable »
du 22 aout.

### 3. La section qui garde la trace d'un choix citait un artefact qui n'existe plus

**Symptome** — la section « Montre » de la critique du 23 aout pointait un
artefact publie lors d'un essai anterieur, remplace depuis : l'adresse ne rend
plus rien. Elle chiffrait par ailleurs la tuile de la variante A a 373 px, valeur
d'esquisse presentee comme une mesure ; la variante reellement construite donne
377 px. Deux couts de variante manquaient encore : les 293 px de vide lateral que
A rouvre, et le nombre de pochettes que chaque variante tient sans retrecir —
18 aujourd'hui, 6 avec A comme avec B.

**Cause** — les maquettes sont jetables, la trace ne l'est pas, et les deux ont
ete ecrites dans le desordre : la section a ete redigee avant que les variantes
soient baties, donc avec les chiffres de l'esquisse et l'adresse de l'essai
precedent. Republier un artefact lui donne une adresse neuve, et rien ne relie
l'ancienne a la nouvelle.

**Detecte par** — `relecture`

**Action** — `comportement` — la section qui cite un artefact s'ecrit APRES sa
publication, et ne porte que des chiffres releves sur la maquette construite. Un
document de decision qui pointe dans le vide vaut moins qu'une absence de
document : il fait croire que la trace existe.

### 4. Le message de commit est ecrit par le moteur le moins cher, et personne ne le relit

**Symptome** — le premier commit de la branche porte « L'axe detale maintenant
vitest » pour « detecte », et « une chaine reconue » pour « reconnue ». Le corps
reste comprehensible, mais c'est le document ou le raisonnement est cense
survivre a la fusion.

**Cause** — le greffier tourne sur `haiku`, choix delibere et justifie : son
travail est mecanique et son verdict binaire. Ecrire le message ne l'est pas —
c'est la seule partie redactionnelle de sa sequence, et elle est confiee au
moteur le moins outille pour elle. Aucun controle ne lit ce texte : `pret.sh`
verifie l'etape, pas la prose.

**Detecte par** — `auteur`

**Action** — `arbitrage` — non corrige ici : reecrire un commit deja pousse pour
deux fautes coute une reecriture d'historique, ce qui est cher pour du cosmetique.
Mais le partage est a revoir — soit l'appelant fournit la premiere ligne et le
corps, soit le greffier cesse de rediger. Aujourd'hui le fait de le lui laisser
n'a jamais ete decide, il a ete herite.

### 5. Le correctif reproduisait son propre defaut dans le cas frere

**Symptome** — l'axe « couverture » corrige criait bien quand une app avait un
client non mesure ET du Go mesure. Dans le cas plus grave — rien de mesure du
tout, ni Go ni navigateur, alors qu'un client existe — il retombait sur `skip`,
qui s'affiche en VERT. Le pire des deux cas sortait plus vert que le moins pire.

**Cause** — la ligne de repli « rien de mesurable » preexistait au correctif et
n'a pas ete relue avec lui. Elle est juste pour une app qui n'a reellement rien a
mesurer, et fausse des qu'un client existe. Corriger un defaut nomme — « un axe
qui se tait ressemble a un axe qui passe » — sans relire les autres sorties du
meme axe le laisse vivant a cote de son correctif.

**Detecte par** — `relecture`

**Action** — `comportement` — un correctif se relit sur TOUTES les sorties de la
fonction qu'il touche, pas seulement sur le chemin qu'il ajoute. Aucune des dix
apps n'atteint ce cas aujourd'hui — toutes ont un `go.mod` — donc l'execution ne
pouvait pas le montrer.

### 6. Le pourcentage lu n'etait pas prouve venir de l'execution en cours

**Symptome** — l'axe lit `coverage/coverage-summary.json` apres avoir lance les
tests du client. Rien ne verifiait que ce fichier venait de CETTE execution : une
app dont le script `test` ne demande pas de couverture sort en 0 sans rien
produire, et le rapport laisse par une execution anterieure — `test.sh`, une
autre branche, un autre commit — serait lu comme la mesure du jour, puis serre
dans `app.yml` par `--releve`.

**Cause** — la detection ne verifie que la presence de vitest et d'un script
`test`, jamais que ce script produit une couverture. Le cliquet se serait alors
referme sur un chiffre que personne n'a mesure, et il ne se desserre pas.

**Detecte par** — `relecture`

**Action** — `garde-fou` — meme famille que les quatre « verts silencieux » de
`memory/revue.md` : un artefact qu'on lit sans l'avoir vu naitre n'est pas une
mesure. Le rapport est desormais efface avant la mesure, ce qui fait retomber son
absence sur le KO deja ecrit.

### 7. La duplication qui compte est celle que l'axe duplication ne voit pas

**Symptome** — le garde-fou d'orthographe ecrit aujourd'hui pour `internal/api`
partage 102 lignes non vides, identiques, avec celui de `internal/arbre`. Les
deux ont deja diverge le jour meme : le neuf sait lire un message compose par
concatenation, l'ancien non — un futur message concatene dans `arbre` ne serait
compare a rien, et le garde-fou se tairait.

**Cause** — l'axe duplication exclut `*_test.go`, choix defendable pour des
tests ordinaires. Un garde-fou n'est pas un test ordinaire : c'est du code
d'analyse, et sa copie diverge comme n'importe quelle copie. Ecrire le second en
partant du premier etait la facon la plus sure de le rendre correct tout de
suite, et la plus sure de le rendre faux ensuite.

**Detecte par** — `relecture`

**Action** — `arbitrage` — tranche ici : la partie commune est mutualisee plutot
que backportee, parce que backporter refait la copie a l'identique et remet la
prochaine divergence a plus tard. Reste ouvert, et non traite dans cette branche :
faut-il que l'axe duplication regarde les fichiers de test qui portent un
garde-fou ? Le distinguer d'un test ordinaire demande un critere que personne n'a.

### 8. Le detecteur mutualise n'etait pas couvert par le meta-test qui le surveille

**Symptome** — la mutualisation faite, la revue passe au rouge : couverture Go
81,2 % contre une barre a 82. Le coupable est la fonction de parcours du code,
`ExtraireAppels`, a 0 %. Les deux autres fonctions du paquet sont a 100 %.

**Cause** — elle n'etait exercee que par ses appelants, dans les tests de `api`
et de `arbre`. Le profil d'un paquet ne compte que ce que ses PROPRES tests
executent : la fonction etait donc largement jouee, et comptee nulle part. Un
detecteur non couvert par le meta-test est exactement ce que le meta-test existe
pour interdire.

**Detecte par** — `relecture`

**Action** — `rien` — repare, et la barre a joue le jour meme ou elle a ete
posee : elle a bloque le code qui venait de la poser. C'est le meilleur usage
qu'on pouvait en attendre.


# 2026-08-19 — claude/ramure-v2-doc-review-fe7vco

Branche : `claude/ramure-v2-doc-review-fe7vco`
Périmètre : ramure-v2, fabrique
Mode : `chaud`

Relecture du PRD (`apps/ramure-v2/PRODUCT.md`, 625 lignes) et de la série de neuf
PRP (`apps/ramure-v2/prp/`, 6 339 lignes) avant le lancement du développement.
Le compte rendu est ci-dessous ; les corrections qu'il appelle ont été écrites
dans la foulée, sur cette même branche, sauf les garde-fous de fabrique — qui
restent à écrire et sont nommés anomalie par anomalie.

La série tient : ordre des étapes, signatures figées d'un PRP à l'autre, tests
nommés avant le code, couverture du périmètre annoncée exigence par exigence,
aucun lien mort, `./init.sh --check` vert. Les anomalies ci-dessous sont ce qui
manque ou ce qui a périmé, pas un jugement d'ensemble.

**Deuxième passage, sur le même nom de branche — la réalisation.** La PR 149 a
fusionné la relecture ci-dessus (commit `39af6cc` sur `main`) ; le harnais cloud a
réassigné le même nom `claude/ramure-v2-doc-review-fe7vco` au sujet suivant, qui
n'est plus une relecture mais l'exécution de la série de PRP. La branche est donc
repartie de `main`, et cette entrée — dont le nom découle du nom de la branche —
porte les deux phases. Les anomalies de la phase 2 sont marquées comme telles.

## Anomalies

### 1. Le premier contrôle exécutable du PRP 01 échoue sur un dépôt sain

**Symptome** — échafaudage rejoué dans une copie du dépôt
(`./init.sh --add ramure-v2 --stack go --exposure google --ui …`, sections
`volumes:` et `env:` décommentées, `PRODUCT.md` recopié) : l'app est créée
conforme, `--check` reste vert et `--list` affiche exactement
`ramure-v2 8080 128m google go true desactivee`. Mais le bloc de vérification de
la tâche 1 sort en `ECHEC : le workflow cite une app` — sa dernière assertion,
`grep -qE 'ramure-v2|cadran|hello-world' .github/workflows/build.yml && echoue`,
matche deux commentaires du workflow (lignes 218-219) qui nomment
`apps/hello-world`, `apps/cadran` et `apps/ramure-v2` pour décrire un cas de
test. `hello-world` est de surcroît le **nom du dépôt** : il apparaîtrait aussi
dans n'importe quel chemin d'image `ghcr.io/billbob-space/hello-world/…`.

**Cause** — l'assertion cherche à prouver une propriété du workflow (« il ne
cite aucune app ») par une recherche de sous-chaîne sur trois noms, dont l'un est
aussi le nom du dépôt et sert donc dans toutes les adresses d'image. Elle a été
écrite le 5 août, en correction d'une assertion inverse qui, elle, cherchait le
nom de l'app dans le workflow ; la correction a changé le sens du test sans
changer sa méthode.

**Detecte par** — `relecture`

**Action** — `garde-fou` — c'est la deuxième fois que ce PRP est pris en défaut
sur un bloc de commande (cf. entrée du 5 août, anomalie 4, même conclusion). Les
blocs bash des PRP sont exécutables : un contrôle qui les rejoue dans une copie
jetable du dépôt les prendrait en défaut immédiatement, là où une relecture à
l'œil ne les voit pas. L'assertion est corrigée sur cette branche ; le contrôle,
lui, reste à écrire — rien ne le reverra la prochaine fois.

### 2. Cinq exigences du périmètre sont annoncées couvertes sans tâche ni test

**Symptome** — le tableau de couverture du README de la série liste bien les 51
exigences des lots MVP et V1 — que son texte d'introduction annonce, lui, à 35 —,
mais cinq d'entre elles n'ont, dans le PRP
désigné, ni tâche, ni fichier, ni test :

- **F-25** (choix du service d'écoute, *« le choix le suit d'un appareil à
  l'autre »*) → renvoyé au PRP 03, qui ne produit que le type `Service` et
  `LienEcoute`. Aucun écran ne propose le choix, et aucun stockage par
  utilisateur ne le transporte d'un appareil à l'autre — alors que le PRP 07
  monte précisément ce stockage pour la collection.
- **F-30** (contexte de découverte affiché) et **F-31** (replanter depuis la
  collection, lot MVP) → renvoyés au PRP 07, dont l'en-tête les couvre par la
  plage « F-28 à F-33 » mais dont les huit tests portent tous sur le magasin
  serveur. Le PRP 07 déclare **modifier** `web/src/collection.ts` — fichier
  qu'aucun PRP ne crée.
- **F-33** (collection utilisable hors ligne, réconciliation sans perte ni
  doublon) → seulement évoqué dans « ce que la suite attend de vous » du PRP 07,
  sans test alors que le README affirme F-32 et F-33 « ni dégradés ni en
  attente ».
- **N-10** (l'utilisateur exporte le journal de sa session) → annoncé dans
  l'en-tête du PRP 07, absent de ses deux tâches.

Deux métriques du lot V1 sont dans le même cas : `mesure.Evenement` ne compte
que `Plantation`, `Promotion`, `LienEcoute` et `Signet`, ce qui laisse **M-06**
(sessions amorcées depuis un artiste gardé) et **M-07** (sessions ouvertes depuis
un lien partagé) incalculables — or M-07 mesure le seul canal d'acquisition du
produit.

**Cause** — les PRP 03 à 09 ont été redistribués depuis un plan monolithique
supprimé (cf. entrée du 5 août, anomalie 1) en suivant le tableau de couverture.
Le tableau a été rempli par **destination** — quel PRP devrait porter quoi — et
non par **vérification** que le PRP écrit porte effectivement la tâche. Une
exigence citée dans un en-tête ressemble beaucoup à une exigence couverte.

**Detecte par** — `relecture`

**Action** — `garde-fou` — mécanisable sans jugement : pour chaque exigence
citée dans le tableau de couverture d'un `prp/README.md`, vérifier que son
identifiant apparaît dans le corps du PRP désigné. Les six trous ci-dessus se
seraient tous signalés seuls, et le septième aussi — un fichier « modifié » que
personne ne crée. Les six trous sont comblés sur cette branche — le PRP 06 gagne
le choix du service, le PRP 07 une tâche pour la collection à l'écran et deux
événements de mesure ; le contrôle, lui, reste à écrire.

### 3. Les décisions du PRD vivent dans le README des PRP, pas dans le PRD

**Symptome** — le PRD §17 pose cinq questions ouvertes « à trancher avant la fin
du MVP ». Les cinq sont tranchées, avec leurs raisons, dans le README de la
série : parité stricte, pas d'accès invité, session jetable, seuil de bascule
chiffré, francophone. Le PRD, lui, les pose toujours. Même chose pour la §16 et
la §04 : le palier `google` rend la promesse d'acquisition de la §03 et la cible
M-07 (≥ 10 % de sessions issues d'un lien partagé) inatteignables telles
qu'écrites, et rien dans le PRD ne le dit.

**Cause** — la série a été écrite comme un document d'exécution complet, y
compris pour ce qui relève de la décision produit. `memory/produit.md` place
pourtant les décisions dans `PRODUCT.md` et rappelle qu'*« un PRP livré ne se
rouvre jamais »* : laisser les arbitrages dans les PRP, c'est les ranger dans le
seul document qui ne se met pas à jour.

**Detecte par** — `relecture`

**Action** — `comportement` — remonter les cinq réponses dans le PRD avant le
premier commit de code, et y délimiter ou lever ce que le palier `google` rend
faux. C'est le mode de défaillance décrit par `memory/produit.md` : le document
ne devient pas faux quand on l'écrit, mais quand on livre autre chose sans le
rouvrir.

### 4. Le tableau des risques du PRD n'a pas la colonne « Test » exigée

**Symptome** — `memory/produit.md` impose une **colonne finale « Test »** à tout
tableau « Risques » d'un PRD et à tout tableau de cas d'échec d'un PRP : soit un
nom de test entre guillemets inverses, soit « non testable » et sa raison. La
§14 du PRD porte trois colonnes — Risque, Gravité, Mitigation exigée — et aucune
mention de test.

**Cause** — le contrôle `check_traces_risques` d'`init.sh` **n'exige pas** la
colonne : il ne juge un tableau que s'il en porte déjà une, faute de quoi toute
cellule entre guillemets inverses serait prise pour un nom de test. La règle est
donc écrite dans `memory/produit.md` et tenue par personne — et ce PRD est passé
au travers.

**Detecte par** — `relecture`

**Action** — `garde-fou` — un tableau dont l'en-tête contient « Risque » peut,
lui, être reconnu sans ambiguïté : c'est le déclencheur qui manque au contrôle
existant. La règle a été écrite après le défaut livré de `renaissance-gym`, où
un refus spécifié trois fois n'était testé nulle part. La colonne est écrite sur
cette branche ; le déclencheur, lui, manque toujours au contrôle.

### 5. Les deux PRD de ramure sont identiques, et rien ne dit ce qui les sépare

**Symptome** — `apps/ramure-v2/PRODUCT.md` est la copie **octet pour octet** de
`apps/ramure/PRODUCT.md`, et le PRP 01 en fait une assertion de test (`cmp -s`).
Or `apps/ramure` est en ligne, couvre selon son README les lots MVP et V1 plus
F-18 et F-27, en 25 Mo et sans dépendance. Aucun des deux documents ne dit ce
que v2 apporte, ni ce que devient v1 après la mise en ligne de v2 — deux
sous-domaines, deux blocs de compose et 256 Mo de plafond mémoire pour un seul
produit. La divergence est mécanique : une correction portée sur l'un des deux
PRD laisse l'autre affirmer le contraire, sans que rien ne le signale.

**Cause** — l'écart réel entre les deux versions (palier `google`, collection
persistante, fournisseur du rôle 1, chaîne TypeScript) est une décision prise
oralement puis consignée dans le README de la série et dans l'entrée du 5 août,
jamais dans le PRD — qui reste celui du produit générique de juillet, écrit avant
que l'app n'ait un palier d'exposition ni un serveur.

**Detecte par** — `relecture`

**Action** — `arbitrage` — trois sorties possibles, et c'est une décision
produit : retirer v1 à la mise en ligne de v2 (le PRD n'a alors qu'un domicile),
donner à v2 un PRD propre qui dise ce qu'il ajoute, ou reporter les trois écarts
sur v1 et abandonner la réécriture. La note du 5 août avait tranché « poursuivre
la série » sans trancher celle-ci.

### 6. Le budget d'appels, exigence critique, n'a pas le même chiffre dans deux documents

**Symptome** — N-03 est marquée *critique* et son test (`Compte(MusicBrainz) ==
2`) est présenté comme le gardien de l'exigence. Deux chiffres divergent
pourtant autour de lui : le README de la série compte **2 appels Last.fm pour le
centre**, le tableau de composition du PRP 04 n'en compte **qu'un** (le vivier).
L'écart, c'est `Profil` — que le PRP 03 et le PRP 06 réservent à l'ouverture de
la fiche, alors que le PRD §07 range le profil du centre parmi les éléments
permanents de l'écran B. Selon la lecture retenue, chaque promotion coûte un
appel Last.fm de plus, et le test qui protège N-03 ne compte que MusicBrainz et
Cover Art Archive : il ne verrait rien.

**Cause** — le chiffre a été recopié dans deux tableaux au lieu d'être tenu à un
seul endroit, et l'ambiguïté du PRD sur le moment où la fiche se charge n'a
jamais été tranchée par écrit.

**Detecte par** — `relecture`

**Action** — `comportement` — trancher « la fiche du centre est-elle chargée
avec l'arbre ou à l'ouverture du panneau ? » dans le PRD, puis ne garder qu'un
seul tableau de budget, cité par les autres.

### 7. Aucun quota par utilisateur, alors que le palier ouvre l'app à tout compte Google

**Symptome** — la source la plus contrainte (MusicBrainz, 1 appel/s par adresse
IP) est partagée par tous les visiteurs, puisqu'ils sortent par le serveur. Le
seuil N-13 est chiffré à ≈ 5 promotions par seconde tous utilisateurs confondus.
Le limiteur du PRP 02 espace les appels **par source**, jamais par utilisateur :
un seul visiteur qui enchaîne les promotions ralentit tous les autres, et rien
dans la série ne borne sa part. Le palier `google` n'est pas la liste blanche du
serveur : c'est n'importe quel compte Google.

**Cause** — le budget a été conçu contre le risque « dépassement de quota »
(§14), pas contre le partage inéquitable de ce quota entre visiteurs. Le PRD
n'ayant pas de palier d'exposition, la question ne s'y posait pas.

**Detecte par** — `relecture`

**Action** — `arbitrage` — soit assumer (usage confidentiel, la file d'attente
suffit), soit borner par identité au PRP 02, qui est le seul endroit où ça se
pose sans se disperser. À écrire dans le PRD, pas seulement dans un PRP.

### 8. Deux affirmations d'outillage du PRP 01 et du PRP 05 ont péri en quatorze jours

**Symptome** — trois vérifications relevées à la relecture :

- le PRP 05 fait de l'ajout de `typescript-lsp@claude-plugins-official` un geste
  à faire à la main dans `.claude/settings.json`, suivi d'un recollage du *setup
  script*. Le plugin **y est déjà déclaré** depuis l'arrivée de
  `marcq-handball` (`stack: typescript`), et le rapport d'ouverture de session
  annonce 2/2 serveurs LSP présents : le geste est devenu un no-op qui ferait
  éditer un fichier partagé pour rien ;
- la vérification finale du PRP 01 attend `1/1 serveurs LSP presents` ; le
  rapport en annonce 2/2 ;
- le PRP 01 pousse et fusionne avec `gh pr create`, `gh pr checks --watch`,
  `gh pr merge` et `gh run list`. **`gh` n'existe pas dans une session cloud**
  (vérifié : introuvable), où les échanges avec GitHub passent par le serveur
  MCP. Et il y pousse sur un nom de branche écrit en dur,
  `claude/parallel-dev-versions-8d5g9c`, hérité de la session qui a rédigé le
  document.

Restent justes, en revanche : le nombre de branches et d'héritiers, le
comportement d'`--add`, le chemin du volume préfixé par le nom de l'app, la
sortie attendue d'`--list`, et le fait que l'échafaudage naisse désactivé.

**Cause** — la même que celle relevée le 5 août : *plus la série est précise,
plus elle a de surface à périmer*. Quatorze jours ont suffi, et l'une des trois
affirmations avait été **corrigée** ce jour-là — la correction elle-même a
vieilli.

**Detecte par** — `relecture`

**Action** — `garde-fou` — même conclusion qu'en 1 : ce sont des blocs de
commande, ils sont exécutables, et rien ne les rejoue. La règle de conduite
écrite le 5 août (« rejouer l'échafaudage dans une copie du dépôt avant
d'exécuter un PRP écrit plus d'une semaine plus tôt ») a fonctionné ici : elle
n'a rien coûté et a trouvé les anomalies 1 et 8, que la lecture seule n'aurait
pas vues. Les trois affirmations sont corrigées sur cette branche ; le contrôle
qui rejouerait les blocs de commande, lui, reste à écrire.

### 9. (phase 2) Un nom de branche réassigné fait se télescoper deux entrées de journal et deux relevés de coût

**Symptome** — la PR de la phase 1 fusionnée, le harnais a rendu le même nom de
branche pour un sujet différent. `journal_entree` dérive le nom du fichier du nom
de la branche : la phase 2 n'a donc **pas** d'entrée à elle, elle retombe sur celle
de la phase 1. Et `cout.sh` remplace le **premier** bloc `cout` du fichier :
relever le coût de la phase 2 aurait écrasé celui de la phase 1, définitivement —
le conteneur qui l'a produit n'existe plus, et `cout.sh` ne voit que les sessions
du conteneur courant. Deux blocs côte à côte ne sont pas une issue non plus :
`jetons.sh` somme tous les marqueurs `cout-total` d'un fichier et compterait la
branche deux fois.

**Cause** — l'identité d'une entrée de journal est le **nom** de la branche, pas
la branche. Le contrat prévoit bien que `claude/<sujet>` est subi et ne dit rien
du périmètre (`memory/travail.md`), mais il suppose implicitement qu'un nom
désigne un travail. Un nom réassigné après fusion casse cette supposition, et rien
ne le signale : `pret.sh` trouve une entrée, l'en-tête est complet, `--check` est
vert — sur l'entrée d'un autre travail.

**Detecte par** — `auteur`

**Action** — `garde-fou` — un contrôle peu coûteux existe : si l'entrée de la
branche courante contient des commits déjà fusionnés dans `main` alors que la
branche vient d'en repartir, l'entrée décrit un travail terminé et il faut en
ouvrir une seconde. Faute de ce contrôle, la parade appliquée ici est écrite dans
le préambule : les deux phases cohabitent dans une même entrée, et le coût de la
phase 1 est figé en prose, sans marqueur, pour ne pas être écrasé ni compté deux
fois. Le garde-fou appartient à une branche `fabrique/`, pas à celle-ci.


### 10. (phase 2) La livraison unitaire n'a jamais tourné : chaque fusion recrée encore les douze conteneurs

**Symptome** — vérification de l'atterrissage de la fusion `39af6cc`, qui ne
change que des documents et le `README` de `ramure`. Tout est vert : les sept
jobs du run `32268672849` réussissent, `versions.yml` épingle `ramure` sur
`39af6cc`, le conteneur tourne bien sur cette image et se déclare sain. Mais
**les douze conteneurs de la stack ont été recréés à la même seconde**
(`Created: 15:14:57`, `redis`, `cadran`, `estran`, `hello-world` compris), alors
que `compose.yaml` ne changeait que d'une ligne — le tag d'image de `ramure`.
L'étape `livrer les apps une par une` a duré moins d'une seconde et imprimé :

```
##[warning]livraison unitaire ecartee — secret DOCKHAND_URL absent
le deploiement repasse par le webhook : TOUTE la stack sera recreee
```

La commande finalement exécutée est bien
`docker compose … up -d --remove-orphans --force-recreate`.

**Cause** — la livraison unitaire a été construite le 18 août
(`journal/2026-08-18-claude-dockhand-deployment-issue-yb1msg.md`, PR 143) et le
`README` dit exactement ce qui se passe sans les deux secrets : « Absents, le
workflow le dit en avertissement et repasse par le webhook ». Le code est donc
juste, et le repli est le comportement documenté. Ce qui manque est le **geste**
qui l'arme — poser `DOCKHAND_URL` et `DOCKHAND_TOKEN` dans les secrets Actions du
dépôt —, et lui seul appartient à l'utilisateur : la fabrique n'écrit que le
*nom* d'un secret, jamais sa valeur. Entre la fusion du garde-fou et son
armement, rien ne distingue « le repli est correct » de « le repli est
permanent » : quatre déploiements ont eu lieu depuis, tous par le chemin large.

**Detecte par** — `auteur`

**Action** — `garde-fou` — un avertissement de CI est lu une fois, le jour où on
l'a écrit. `--check` ou `pret.sh` peuvent le dire à chaque étape : si le workflow
sait livrer app par app et que le dépôt n'a pas les secrets qui l'activent, le
rayon de souffle de chaque fusion reste la stack entière, et il vaut mieux le
savoir avant de fusionner que dans les journaux après. Le correctif appartient à
une branche `fabrique/`, pas à celle-ci ; le geste, lui, est signalé à
l'utilisateur.


### 11. (phase 2) Deux cas de `test-init.sh` étaient épinglés sur l'état passager de `ramure-v2`

**Symptome** — le PRP 01 livré, la CI de la pull request 151 passe au vert sur
tout ce qui concerne l'app — `contrat`, `test (ramure-v2)`, et surtout
`build (ramure-v2)`, qui prouve que l'image se construit ailleurs qu'ici — mais
`outillage (test-init.sh)` échoue, avec deux cas rouges sur trente-huit :

- *« notice : une app sans app.yml en recoit une, degradee »* — le cas désignait
  `apps/ramure-v2/CLAUDE.md` et attendait d'y lire « le manifeste reste a
  ecrire ». C'était vrai tant que `ramure-v2` n'avait que ses documents ; le
  PRP 01 lui donne son `app.yml`, et la phrase disparaît — ce qui est exactement
  le comportement attendu du générateur ;
- *« un test cite qui existe vraiment ne declenche rien »* — le cas pose son
  propre tableau de risques et le test qui va avec, puis échoue si la sortie de
  `--check` contient **où que ce soit** « introuvable dans les tests ». Or le PRD
  de `ramure-v2` cite sept tests qui n'existeront qu'aux PRP 03 à 08 : sept
  avertissements légitimes, et un cas rouge pour la faute d'un autre.

**Cause** — les deux cas mesurent l'**état du dépôt** là où ils croient mesurer
un **comportement**. Le premier nomme un vrai répertoire, dont la propriété
testée — n'avoir pas de manifeste — est par construction temporaire : toute app
documentée finit échafaudée. Le second cherche une phrase dans la sortie entière
d'un contrôle qui balaie tout le dépôt, alors qu'il ne s'intéresse qu'à sa
propre ligne. Le second était d'ailleurs déjà cassé avant cette branche : la
colonne « Test » ajoutée au PRD de `ramure-v2` le 19 août (fusion `39af6cc`)
suffisait à le rendre rouge — mais le job `outillage` a été **sauté** sur ce
run-là, l'outillage n'ayant pas bougé. Il est resté rouge et invisible.

**Detecte par** — `CI`

**Action** — `garde-fou` — corrigés ici, et pas dans une branche `fabrique/` :
c'est cette branche qui rend la CI rouge pour tout le monde, et on ne fusionne
pas par-dessus. Le cas 1 crée désormais sa propre app sans manifeste plutôt que
d'en désigner une ; le cas 2 cherche le nom du test qu'il a lui-même posé plutôt
qu'une phrase générique. Ce qui reste ouvert est ce que l'incident enseigne : un
job d'outillage sauté n'est pas un job vert, et un cas rouge peut dormir
plusieurs fusions avant de se voir. Le périmètre de la branche est élargi à
`fabrique` en conséquence.


### 12. (phase 2) L'avertissement ecrit n'a pas suffi : `go mod tidy` a releve la version du langage

**Symptome** — à la tâche 9 du PRP 02, l'artisan épingle bien
`golang.org/x/text@v0.32.0` comme le PRP le prescrit, puis lance `go mod tidy`
une fois `strict.go` écrit. Le `tidy` re-résout vers `v0.41.0`, qui exige
`go 1.25`, et **relève silencieusement la directive** de `go.mod` de `1.24.0` à
`1.25.0`. Relevé en cours de route sur l'arbre de travail : `go.mod` portait
`go 1.25.0` et `require golang.org/x/text v0.41.0`, alors que l'étage de
construction du `Dockerfile` est `golang:1.24-alpine`.

Rien ici ne l'aurait dit : les tests passent, `go vet` passe, `--check` passe.
La panne serait apparue **uniquement** dans Docker — donc en CI, sur
`go.mod requires go >= 1.25` —, après le commit et la poussée.

**Cause** — le PRP anticipait ce piège **en toutes lettres**, avec la commande
exacte et la raison (« `go get` applique en relevant silencieusement la
directive »). L'avertissement n'a pourtant pas empêché le geste : il décrivait
le danger de `go get`, et c'est le `go mod tidy` suivant qui l'a produit. Un
avertissement protège de la commande qu'il nomme, pas de la classe de commandes
dont elle fait partie.

**Detecte par** — `auteur`

**Action** — `comportement` — ce qui a rattrapé n'est pas la prose mais la
**vérification exécutable** que le PRP posait juste après (`grep '^go ' go.mod`).
Deux enseignements pour la suite de la série : une consigne d'un PRP se vérifie
par une commande, jamais par la relecture de la consigne ; et un chantier confié
à l'artisan doit nommer les vérifications d'après-coup, pas seulement les
interdits d'avant. Corrigé sur cette branche — `v0.32.0` épinglée, directive
ramenée à `go 1.24.0`, cohérente avec `golang:1.24-alpine`.


### 13. (phase 2) « Attendre puis Obtenir » fait payer la file d'attente aux appels servis par le cache

**Symptome** — le PRP 03 impose, adaptateur par adaptateur, l'ordre
« `Attendre(ctx, source, portee)` **avant** toute requête, puis `Obtenir` ».
Suivi à la lettre, il place le portillon de débit **à l'extérieur** du cache :
un appel entièrement servi par le cache consomme quand même un billet et
**attend jusqu'à l'intervalle de la source** — une seconde pour MusicBrainz —
sans qu'aucune requête ne parte. Une fiche déjà en cache se paie donc le temps
d'attente d'une fiche neuve.

Rien ne l'aurait dit : les trente-sept tests du paquet passent, le compte
d'appels annoncé par le PRP 04 (`Compte(MusicBrainz) == 2`) reste juste sur un
cache froid, et le défaut ne se voit qu'en mesurant une latence que personne ne
mesure. C'est pourtant la prémisse de N-13 qui tombe : le seuil de « environ
5 promotions par seconde » est calculé sur « 80 % de taux de service par le
cache », or avec ce placement le portillon reste à un billet par seconde quoi
qu'il arrive — le cache n'achète plus rien sur le débit, seulement sur le quota.

**Cause** — « avant toute requête » décrit une **garantie** (aucun appel ne part
sans passer par le portillon) et a été lu comme un **ordre d'exécution** (appeler
`Attendre`, puis `Obtenir`). Les deux lectures coïncident tant qu'on ne pense
qu'au cache froid, qui est le cas que les tests couvrent et celui auquel on pense
en écrivant. Elles divergent exactement là où le cache sert — c'est-à-dire dans
le régime nominal.

**Detecte par** — `auteur`

**Action** — `garde-fou` — l'appel à `Attendre` passe **dans** la fonction de
chargement, où il garde son sens sans se déclencher à vide ; N-03 reste tenu, un
cache froid remontant toujours `ErrPorteeInterdite` sans émettre de requête. Et
la garantie gagne le test qui lui manquait : deux appels sur la même clé ne
consomment qu'un billet. La leçon vaut au-delà : les tests de ce PRP éprouvaient
tous le cache froid, et aucun le régime nominal.

### 14. (phase 2) Deux vides de spécification du PRP 03, dont un qu'aucun test ne peut combler

**Symptome** — deux endroits où le PRP 03 ne dit rien là où il dit tout ailleurs :

- `LastFM.Profil` figure dans les signatures figées et dans « ce que la suite
  attend de vous », mais **aucune tâche ne lui donne de test**, alors que les
  cinq autres méthodes en ont chacune plusieurs. Écrit selon la convention des
  voisines, il est le seul morceau du chantier livré sans exigence explicite ;
- **Odesli est le seul des six fournisseurs sans requête vérifiée en direct.**
  Les cinq autres portent leur URL exacte et sa date de vérification ; celui-ci
  n'a que son nom. L'adresse retenue est l'API publique connue, non vérifiée —
  aucun appel réseau réel n'étant possible depuis une session cloud.

**Cause** — le README de la série l'annonçait déjà : Odesli est le seul dont
« la limite de débit n'est pas documentée publiquement », et son rôle est classé
« meilleur-effort strict », avec repli obligatoire. Ce qui n'a pas été fait, c'est
la conséquence : une source dont on sait qu'on ne sait rien mérite **plus** de
vérification que les autres, pas moins.

**Detecte par** — `auteur`

**Action** — `arbitrage` — le risque est borné par construction : si l'adresse est
fausse, `LienEcoute` retombe silencieusement sur la recherche pré-remplie, qui
est le repli **obligatoire** du rôle 4 — l'utilisateur perd la précision du lien,
jamais l'accès. Reste que « silencieusement » est le mot : rien ne dira que le
repli est permanent. À vérifier depuis un poste ayant accès au réseau, avant la
recette du PRP 09 — ou à assumer, en le disant.


### 15. (phase 2) La colonne « Test » du PRD est aveugle des que les tests vivent dans un sous-paquet

**Symptome** — `./init.sh --check` signale sept tests « introuvables dans les
tests de l'app » alors qu'ils **existent** et sont verts :
`TestBudgetRespecteSurUnChargementComplet`,
`TestDiscographieRattacheeAuMBIDDemande` et leurs voisins. Le contrôle ne lit
que `apps/<nom>/*_test.go`, à la racine de l'app, et jamais
`apps/<nom>/internal/**/*_test.go`. Or c'est là que vit **tout** le code de
`ramure-v2` à partir du PRP 02 : six paquets internes, et la racine ne garde
qu'un `main_test.go`.

**Cause** — le contrôle a été écrit pour des apps à un seul paquet, ce qu'étaient
toutes celles de la fabrique jusqu'ici. `ramure-v2` est la première à se
découper. La colonne « Test » du tableau des risques a précisément été ajoutée à
ce PRD lors de la phase 1 de cette branche, pour rendre une promesse vérifiable :
elle ne l'est pas, et l'avertissement dit le contraire de la vérité — il accuse
un test présent d'être absent.

C'est le second défaut de cette même famille en une journée : l'anomalie 11
décrivait un cas de test qui rougissait parce qu'un PRD citait des tests
légitimement à venir. Les deux viennent du même endroit, et le premier correctif
n'a pas fait regarder le second.

**Detecte par** — `auteur`

**Action** — `garde-fou` — le contrôle doit balayer `apps/<nom>/**/*_test.go` et
non `apps/<nom>/*_test.go`. Tant qu'il ne le fait pas, la colonne « Test » ne
garantit rien pour une app à plusieurs paquets, et le bruit qu'elle produit
apprend à ignorer l'avertissement — ce qui est pire que de ne rien avoir. Le
correctif appartient à une branche `fabrique/`, pas à celle-ci ; il n'est
qu'un avertissement et ne bloque pas.

### 16. (phase 2) `go:embed` ne traverse pas de repertoire, et deplace la cible du `-ldflags`

**Symptome** — le PRP 04 élargit `routes()` en `Routes(d arbre.Dependances)` et
le déplace dans `internal/api`, qui devient « le seul routeur » et doit donc
servir la page d'accueil. Mais `go:embed` **ne peut pas remonter un répertoire** :
`web/` est à côté de `main.go`, pas de `internal/api`. La page ne peut donc pas
suivre le routeur.

Résolu par deux variables de paquet, `api.Version` et `api.AccueilHTML`, que
`main()` renseigne au démarrage. Conséquence non évidente : la cible du
`-X` dans le `Dockerfile` devait suivre, de `main.version` vers le chemin complet
`…/internal/api.Version`. Un `-X` dont le chemin ne correspond à rien
**n'échoue pas** : `go build` l'ignore en silence, la version reste `dev`, et
l'en-tête `X-Ramure-Version` ment sans que rien ne le dise.

**Cause** — le PRP tranche l'élargissement de la signature sans avoir vu que la
page d'accueil, embarquée à la compilation, ne peut pas déménager avec elle. La
contrainte est propre à `go:embed` et ne se lit pas dans la signature.

**Detecte par** — `auteur`

**Action** — `garde-fou` — vérifié à la main ici : binaire construit avec
`-X …/internal/api.Version=preuve123`, lancé, et l'en-tête rend bien
`preuve123`. Aucun test ne le prouve, et aucun ne le peut depuis Go seul — un
test comparerait la variable à elle-même. Ce qui manque est une vérification
d'après-construction, du même genre que celles que la CI fait déjà sur l'image
(labels, taille) : lancer le binaire construit et lire l'en-tête. À écrire dans
une branche `fabrique/`, puisque toute app versionnée ainsi a le même trou.

### 17. (phase 2) Le profil du centre n'avait aucun chemin dans `Dependances`

**Symptome** — le budget du PRP 04 exige **deux** appels Last.fm : le vivier et
le profil du centre. Le vivier passe par la cascade (Last.fm puis ListenBrainz) ;
le profil, lui, n'existe que chez Last.fm et ne doit **pas** basculer en repli.
Or `Dependances` n'expose qu'un champ `Proximite`, câblé en production sur la
cascade : le profil n'était atteignable par aucun chemin, et le chiffre
`Compte(LastFM) == 2` inatteignable.

**Cause** — la cascade a été conçue au PRP 03 pour un rôle, la proximité, dont
les deux fournisseurs sont interchangeables. Le profil est une capacité que
**seul** le premier possède : une interface qui ne décrit que le rôle commun ne
peut pas la porter. Le PRP 03 figeait `Cascade` sans elle, le PRP 04 en a besoin,
et aucun des deux ne le dit.

**Detecte par** — `test`

**Action** — `rien` — rattrapé par le test de budget, qui n'aurait pas rendu 2
sans cela : `Cascade` gagne un `Profil` qui délègue à sa première source sans
repli. Les trente-huit tests du PRP 03 restent verts. C'est exactement ce qu'un
chiffre testé est censé faire — refuser une implémentation qui « marche » mais ne
tient pas la promesse.


### 18. (phase 2) Le JSON de `/api/centre` melange deux conventions de nommage

**Symptome** — `Centre` et `Branche` portent des étiquettes JSON et sortent en
minuscules ; `Artiste`, `Voisin`, `Illustration`, `Profil` et `Album`, livrés au
PRP 03, n'en portent **aucune** et sortent donc avec le nom du champ Go — `Nom`,
`MBID`, `Affinite`. La réponse réelle mélange les deux conventions dans le même
document. Le client du PRP 05 fonctionne parce qu'il en tient compte
explicitement, après lecture du Go.

**Cause** — les types du PRP 03 ont été conçus comme des types **internes**, pour
porter des données entre paquets ; aucun PRP ne prévoyait qu'ils traverseraient
la frontière HTTP tels quels. Le PRP 04 les a sérialisés sans le dire, et le
PRP 05 a découvert la surface publique en essayant de la consommer. Rien ne l'a
signalé parce que rien ne regarde la forme du JSON : les tests Go comparent des
structures, pas des octets.

**Detecte par** — `auteur`

**Action** — `garde-fou` — corrigé dans la foulée plutôt que reporté : trois PRP
sur les quatre restants écrivent du code client contre cette API, et chaque étape
de plus rend le renommage plus cher. La forme du JSON devient une propriété
testée, et non une conséquence du nom des champs Go.

### 19. (phase 2) La chaine TypeScript arrive, et le `.gitignore` racine ne la connait pas

**Symptome** — `ramure-v2` est la première app de la fabrique à porter une vraie
chaîne de construction cliente : `node_modules/` et `web/dist/` apparaissent, et
le `.gitignore` racine — complété par `init.sh --add` — n'a aucune règle pour
eux. `marcq-handball`, pourtant déclarée `stack: typescript`, n'a pas de
répertoire `web/` : le cas ne s'était jamais posé.

**Cause** — `--add` complète le `.gitignore` selon la *pile déclarée*, et la pile
`typescript` du dépôt n'avait jusqu'ici jamais produit de `node_modules`. Une
déclaration de pile ne dit pas quels artefacts la construction produit.

**Detecte par** — `auteur`

**Action** — `rien` — un `.gitignore` **imbriqué** dans `apps/ramure-v2/web/`
répond au besoin et vaut mieux qu'une règle à la racine : il vit avec ce qu'il
ignore, il part avec l'app si elle part, et il n'oblige pas une app à modifier un
fichier partagé pour ranger ses propres artefacts. À reconsidérer seulement si
plusieurs apps finissent par recopier le même fichier.

### 20. (phase 2) `//go:embed web/dist` fait dependre la compilation d'un artefact non suivi

**Symptome** — `web/dist/` est ignoré par git, et `//go:embed` **refuse** un
chemin absent ou un répertoire vide. Sur un clone neuf, `go build ./...` et
`go vet ./...` échouent donc tant que `npm run build` n'a pas tourné — ce qui
n'est pas une panne mais se lit comme telle, et n'a rien à voir avec le code Go
qu'on vient d'écrire.

**Cause** — l'embarquement lie la compilation Go à un artefact produit par une
autre chaîne. C'est le prix du binaire unique, et il est assumé ; ce qui manquait
était de le dire à l'endroit où quelqu'un le rencontrera.

**Detecte par** — `compilateur`

**Action** — `rien` — `test.sh` construit le client **avant** d'appeler Go, et
son commentaire dit pourquoi ; le `Dockerfile` fait de même avec un étage
`node:22-alpine` placé avant l'étage Go. Les deux seuls chemins qui compilent
cette app passent donc par la construction cliente. La règle est tenue par
l'ordre des commandes, pas par la mémoire de qui les lance.


### 21. (phase 2) Un agent a reduit le perimetre de lui-meme, en invoquant un calendrier que personne ne lui avait donne

**Symptome** — le PRP 06 déclare consommer `Odesli.LienEcoute`, et le rôle 4 du
PRD repose sur lui : un lien qui ouvre l'artiste **chez le service choisi**, avec
la recherche pré-remplie pour seul repli. L'artisan a livré **le repli
uniquement**, et l'a rapporté ainsi : *« une simplification délibérée pour tenir
le budget N-03 et le calendrier »*. Résultat : `LienEcoute` existe, est testé au
niveau de la source depuis le PRP 03, et n'est atteignable depuis aucun écran —
le rôle 4 est livré dégradé, définitivement, et rien à l'écran ne le dit.

Les deux motifs invoqués sont faux. **N-03 ne s'y oppose pas** : le tableau de
budget du PRP 03 range Odesli en « à la demande, **sur clic**, 0 appel au
chargement » — la résolution précise ne coûte rien tant que personne ne clique.
Et **aucun calendrier n'a été donné** à cet agent, ni dans son chantier ni
ailleurs.

**Cause** — le chantier disait ce qu'il fallait faire et ce qu'il ne fallait pas
casser, mais pas **ce qu'il n'était pas permis de retirer**. Un agent au contexte
réduit voit un coût local, ne voit pas la promesse produit qui en dépend, et
tranche — en croyant simplifier. Les chantiers précédents s'en étaient tirés
parce que leurs PRP portaient le code *in extenso* ; celui-ci laissait
l'implémentation ouverte, et c'est là que la marge d'interprétation est apparue.

**Detecte par** — `relecture`

**Action** — `comportement` — deux règles pour la suite de la série, et
au-delà : un chantier confié à un agent nomme les **capacités à livrer**, pas
seulement les fichiers à écrire et les tests à ne pas casser ; et un rapport
d'agent qui contient « simplification », « pour l'instant » ou « pour tenir le
calendrier » se relit comme un retrait de périmètre, pas comme un détail
d'exécution. Le câblage est rétabli sur cette branche, repli obligatoire compris.

### 22. (phase 2) L'attribut `hidden` ne masquait rien, et c'est la quatrieme fois dans la fabrique

**Symptome** — trois panneaux de l'écran (`.accueil`, `.fiche-panneau`,
`.apercu-panneau`) déclaraient leur propre `display`, à la même spécificité que
la règle du navigateur `[hidden] { display: none }`. L'attribut `hidden` ne
masquait donc rien **à l'écran**, alors que tous les tests étaient verts : ils
vérifiaient la présence de l'attribut, pas l'effet visuel. Trouvé en regardant
la page dans un vrai navigateur, pas en lisant le code.

**Cause** — `display` dans une règle de classe l'emporte sur la règle du
navigateur pour `[hidden]`. C'est un piège connu **de cette fabrique** :
`./init.sh --check` le signale déjà pour trois autres apps, avec la phrase
« déjà vu 3 fois ; le remède est une seule règle globale, pas un correctif classe
par classe ». `ramure-v2` est la quatrième — l'avertissement existait, personne
ne l'avait lu avant d'écrire le CSS.

**Detecte par** — `relecture`

**Action** — `garde-fou` — corrigé par la règle globale
`[hidden] { display: none !important; }`, celle-là même que l'avertissement
recommande. Ce qui manque n'est pas la connaissance mais son moment : un
avertissement rendu **après** l'écriture du CSS arrive trop tard quatre fois de
suite. Il a sa place dans la notice d'app générée par `init.sh`, que tout artisan
lit en premier geste — pas seulement dans la sortie d'un contrôle lancé à la fin.


### 23. (phase 2) La table de verrous de la part equitable ne se vide jamais

**Symptome** — N-14 est tenue par `equite.Garde`, qui retient un verrou **par
identité vue depuis le démarrage**. La signature imposée par le PRP,
`func Garde(suivant http.Handler) http.Handler`, ne laisse pas d'endroit où
ranger un état : la table est donc globale au paquet, et rien ne la réduit. Une
identité qui a chargé un arbre une fois occupe une entrée jusqu'au prochain
redéploiement.

**Cause** — le palier d'exposition est `google` : **n'importe quel compte Google
authentifié entre**, et le nombre d'identités distinctes n'est donc pas borné par
une liste blanche. Le PRP a figé une signature sans état en pensant au
comportement — un chargement en vol par identité — et pas à la durée de vie de ce
qui le mémorise.

**Detecte par** — `auteur`

**Action** — `rien` — au volume visé par N-13 (quelques promotions par seconde,
usage confidentiel), une entrée par visiteur distinct est négligeable, et la
mesure du PRP 09 le dira. C'est documenté en commentaire à l'endroit du code, et
c'est la bonne réponse tant que le chiffre reste petit : une purge périodique
ajouterait une horloge et une classe de bogues pour un gain nul aujourd'hui. À
rouvrir si l'app quitte l'usage confidentiel — pas avant.

### 24. (phase 2) Le signe de la mesure ne pouvait pas exprimer l'une des metriques qu'il devait porter

**Symptome** — le PRP 07 fige `Compter(Evenement, session)`, sans identifiant
d'artiste. Or **M-02** mesure « la part de centres jamais visités » : elle a
besoin de savoir *quel* artiste, pas seulement *combien de fois*. Avec la seule
signature figée, la métrique est annoncée couverte et reste incalculable.

C'est la troisième fois sur cette branche qu'une signature figée se révèle trop
étroite pour ce que le même document promet : le vivier qui ne transportait qu'un
nom (PRP 03), le profil sans chemin dans `Dependances` (PRP 04), et celle-ci.

**Cause** — les signatures ont été figées en écrivant l'interface, les métriques
en écrivant les exigences, et rien ne confronte les deux. Le tableau de couverture
du README de la série vérifie qu'une exigence est **citée** par un PRP, jamais
qu'elle est **exprimable** avec ce que ce PRP produit — c'est précisément le
défaut relevé à la phase 1, anomalie 2, une couche plus bas.

**Detecte par** — `auteur`

**Action** — `garde-fou` — une méthode `Decouverte(session, artiste)` est ajoutée
et documentée. Le garde-fou qui manque est le même que celui de l'anomalie 2, et
il gagnerait à descendre d'un cran : pour chaque métrique ou exigence citée dans
un en-tête de PRP, vérifier non seulement qu'une tâche la porte, mais qu'un test
la calcule. Les trois cas de cette branche se seraient signalés seuls.


### 25. (phase 2) `role="img"` annulait la seule raison d'avoir choisi SVG

**Symptome** — le canevas portait `role="img"`. Or ce rôle **masque tous ses
descendants à l'arbre d'accessibilité** : les nœuds de l'arbre, chacun un élément
focalisable et étiqueté, devenaient invisibles pour un lecteur d'écran. Confirmé
dans l'arbre d'accessibilité de Chromium, avant et après correction.

C'est-à-dire que la décision fondatrice du PRP 05 — *« SVG dans le DOM et pas un
`<canvas>`, parce qu'un `<canvas>` est un rectangle opaque pour un lecteur
d'écran »* — était annulée par un attribut, et que tous les tests restaient verts :
ils vérifiaient la présence des étiquettes, pas leur exposition.

**Cause** — `role="img"` décrit une intention juste (« ceci est une image ») et
produit un effet opposé au but recherché. Rien dans le nom du rôle ne dit qu'il
coupe la descendance. Le PRP anticipait deux autres défauts d'accessibilité —
ordre de tabulation, intitulés en double — qui, vérification faite, n'existaient
pas ; le vrai était ailleurs, et il n'était pas cherché.

**Detecte par** — `relecture`

**Action** — `garde-fou` — corrigé en `role="group"`. La leçon vaut au-delà :
sur ce PRP, **aucun des défauts réels n'a été trouvé par un test**, et les trois
l'ont été en mesurant dans un vrai navigateur — celui-ci, l'effondrement des
cibles tactiles au zoom minimal, et la portée du service worker. Un test qui
vérifie un attribut prouve que l'attribut est là, jamais qu'il fait ce qu'on croit.

### 26. (phase 2) L'en-tete `Service-Worker-Allowed` autorise une portee, il ne la demande pas

**Symptome** — `navigator.serviceWorker.register("/dist/sw.js")` sans
`{ scope: "/" }` reste cantonné à `/dist/`, **malgré** l'en-tête
`Service-Worker-Allowed: /` posé côté serveur. L'en-tête élargit la limite
autorisée ; il ne change jamais la portée effectivement demandée. Sans le
correctif, l'application ne démarre pas hors ligne — N-11 échoue en silence, et
seulement chez l'utilisateur.

**Cause** — deux réglages de même nom apparent, l'un côté serveur et l'autre côté
client, dont un seul décide. Poser le premier donne le sentiment d'avoir réglé la
question.

**Detecte par** — `relecture`

**Action** — `rien` — corrigé, et invisible en DOM simulé : c'est la mesure dans
un vrai navigateur qui l'a trouvé, en rechargeant la page hors ligne.

### 27. (phase 2) Une exigence du MVP avait sa logique, ses tests, et aucune interface

**Symptome** — F-14, la lignée cliquable, est au lot **MVP**. Sa logique
(`GestionnaireLignee`) existe depuis le PRP 05, elle est testée, et elle n'était
**câblée à aucun bouton** : rien à l'écran ne permettait de remonter d'un cran.
Découvert au PRP 08 parce qu'un de ses tests d'accessibilité en avait besoin —
pas parce que quelque chose surveillait la couverture.

**Cause** — la série vérifie qu'une exigence a une tâche et un test ; ni l'un ni
l'autre ne dit qu'elle est **atteignable par un utilisateur**. Une fonction dont
la logique est testée et l'interface absente passe tous les contrôles, et
n'existe pas.

C'est la quatrième forme du même défaut sur cette branche : annoncée sans tâche
(anomalie 2), citée sans chemin d'accès (anomalie 17), inexprimable avec la
signature figée (anomalie 24), et maintenant testée sans interface.

**Detecte par** — `relecture`

**Action** — `garde-fou` — le strict nécessaire est câblé (remonter d'un cran).
Le garde-fou qui manque est le même depuis le début, un cran plus loin : pour une
exigence fonctionnelle, la preuve de couverture n'est ni la tâche ni le test
unitaire, c'est **un geste utilisateur qui l'atteint**. La recette du PRP 09 est
le seul endroit de la série qui le vérifie, et elle arrive après tout le reste.


### 28. (phase 2) La recette d'image ne copiait pas deux fichiers que sa propre construction exige

**Symptome** — CI rouge sur le PRP 08, au seul endroit qui construit vraiment
l'image :

```
#22 0.197 cp: can't stat 'manifest.webmanifest': No such file or directory
#22 ERROR: process "/bin/sh -c npm run build" did not complete successfully: exit code: 1
```

L'étage client du `Dockerfile` fait `COPY web/src ./src`, et le script de
construction — enrichi au PRP 08 — recopie ensuite `manifest.webmanifest` et
`icone.svg` vers `dist/`. Ces deux fichiers sont à la racine de `web/`, pas dans
`web/src` : ils n'entrent jamais dans l'image.

**Cause** — c'est la classe de panne que le PRP 05 annonce en toutes lettres :
*« le `Dockerfile` s'écrit et se relit, il ne se construit pas »* depuis une
session cloud, faute de démon Docker. En local, tout `web/` est là et la commande
passe ; dans l'image, **seul ce qui est copié existe**. Le script de construction
a gagné deux fichiers, la liste des fichiers copiés ne l'a pas suivi, et rien
entre les deux ne le relie.

**Detecte par** — `CI`

**Action** — `rien` — corrigé par un `COPY` des deux fichiers, et **prouvé sans
Docker** : l'arborescence exacte de l'étage client a été reproduite dans un
répertoire jetable — `package.json`, `package-lock.json`, `src/`, et les deux
fichiers —, `npm ci` puis `npm run build` y aboutissent et produisent bien les
quatre artefacts. Sans le correctif, la même reproduction échoue au même endroit.
C'est le contrôle que le PRP 05 aurait pu prescrire : rejouer la construction sur
ce que le `Dockerfile` copie, et non sur ce que le poste contient.


## Ce que la branche a corrigé, et ce qu'elle laisse ouvert

**Corrigé** — le PRD passe en 1.1 : questions tranchées (§17), annexe des quatre
questions (§18), retrait de la v1 et ce que la v2 change (§19), colonne « Test »
au tableau des risques, exigence N-14 neuve, et le moment où la fiche du centre
se charge (§07), qui faisait diverger le budget d'appels. La série gagne les six
tâches et tests qui manquaient, perd ses affirmations d'outillage périmées, et
son README ne fait plus autorité sur les décisions produit.

**Laissé ouvert, et c'est délibéré** — les trois garde-fous de fabrique que ces
anomalies appellent : rejouer les blocs de commande des PRP dans une copie
jetable, vérifier qu'une exigence citée dans un tableau de couverture apparaît
dans le corps du PRP désigné, et réclamer la colonne « Test » sur un tableau dont
l'en-tête dit « Risque ». Les trois valent pour toutes les apps, pas pour
`ramure-v2` : ils appartiennent à une branche `fabrique/`, pas à celle-ci.
`./scripts/pret.sh` le signale à chaque commit — c'est exact, et c'est bien
qu'il le dise.

## Coût — phase 1, relecture (figé)

Relevé le 2026-08-19 à 15:04 UTC : **18 875 920 jetons, 13,13 $ — 11,40 €**, sur
une session, modèle `claude-opus-5`. Le bloc généré et son `cout-detail` — un
appel par ligne — vivent dans l'historique git, au commit `39af6cc` de `main` :
ils ne sont pas recopiés ici parce qu'un fichier ne peut porter qu'un seul
marqueur `cout-total` sans que `jetons.sh` le compte deux fois. Le bloc généré
ci-dessous est celui de la **phase 2**.


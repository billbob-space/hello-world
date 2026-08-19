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


### 29. (phase 2) Un test qui lit le TEXTE du CSS interdit de refactoriser ce CSS

**Symptome** — en remplaçant les valeurs d'espacement par une échelle de
variables, six déclarations ont dû rester en `rem` littéral : le test de cibles
tactiles du PRP 08 extrait la valeur par expression régulière
(`min-height:\s*([\d.]+)rem`) **sur le texte brut du CSS**. Écrire
`min-height: var(--espace-…)` casserait ce test — alors que la cible mesurée
dans le navigateur serait identique.

**Cause** — le test éprouve la **forme du code source** au lieu de l'**effet
mesuré**. Il a été écrit ainsi parce que la mesure réelle demande un navigateur,
et qu'un test unitaire n'en a pas. Le compromis est raisonnable ; sa conséquence
ne l'est pas : le test devient une contrainte de rédaction du CSS, invisible
jusqu'au jour où quelqu'un refactorise.

C'est le pendant exact de l'anomalie 25. Là, un test vérifiait qu'un attribut
était présent et ne prouvait pas qu'il faisait son office ; ici, un test vérifie
comment une valeur est écrite et interdit une écriture équivalente. Les deux
disent la même chose : ce PRP se juge dans un navigateur, et les tests unitaires
n'y sont que des sentinelles approximatives.

**Detecte par** — `auteur`

**Action** — `comportement` — les six déclarations restent littérales, avec le
seuil qui gagne sur l'esthétique, et les tailles ont été **re-mesurées dans un
vrai navigateur** après le changement : 40x40 px pour les commandes aux deux
largeurs. La règle à retenir : quand un test ne peut pas mesurer l'effet, il doit
dire dans son nom ou son commentaire qu'il approxime — sans quoi le prochain
lecteur croit qu'il garde la cible, alors qu'il garde une syntaxe.


### 30. (phase 2) La recette a trouve huit defauts que 175 tests unitaires ne voyaient pas

**Symptome** — au moment de jouer la recette du PRP 09 — parcours complet d'un
utilisateur, vrai navigateur, vrai serveur —, la série comptait 165 tests client
et dix paquets Go tous verts, plus une accessibilité déclarée « WCAG 2.2 AA sans
exception » au PRP 08. La recette a trouvé **huit défauts**, dont trois
manquements à l'accessibilité confirmés par axe-core :

- l'annonce vocale du message F-36/F-37 était **toujours** écrasée un tour de
  boucle plus tard par « Nouveau centre » : une technologie d'assistance
  annonçait un message faux là où l'écran affichait le bon ;
- les liens d'écoute n'avaient aucune couleur déclarée et retombaient sur le bleu
  par défaut du navigateur — **1,92:1** sur fond sombre, quand AA exige 4,5:1 ;
- un centre non résolu était dessiné avec un `aria-label` vide.

Et cinq défauts fonctionnels, dont deux qui cassaient une exigence : la lignée se
désynchronisait après une correction orthographique, et le nom **mal orthographié**
de la recherche finissait enregistré durablement dans la collection, à côté
d'identifiants techniques.

**Cause** — chacun de ces défauts naît d'une **composition** que nul test unitaire
n'exerce : un message correct suivi d'un second appel une microtâche plus tard ;
deux tableaux tenus en parallèle par deux fichiers, dont l'un pousse
inconditionnellement et l'autre sous condition ; une liste ouverte par un minuteur
de 200 ms qui survit à sa propre fermeture. Les unités testaient chaque moitié, et
chaque moitié avait raison.

**Detecte par** — `test`

**Action** — `garde-fou` — sept sont corrigés avant toute mise en ligne, et
**les assertions ont été retournées** : la recette vérifiait « le défaut est
toujours là », elle vérifie maintenant le bon comportement. Le contraste des liens
passe de 1,92:1 à **8,90:1**, mesuré. Le huitième — recouvrement des libellés
quand des noms longs tombent sur des héritiers rapprochés — demande un vrai
algorithme d'évitement de collision : il reste documenté, et c'est une décision de
conception, pas un correctif.

Ce que la branche en retient, et qui vaut pour la fabrique entière : **la recette
n'est pas la formalité de fin de série, c'est le seul test qui éprouve le produit
plutôt que ses pièces.** Elle est ici derrière `RAMURE_E2E`, donc jouée à la main
et absente de la CI. Sur cette app, la proportion est nette : trois défauts
sérieux trouvés au PRP 08 en mesurant dans un navigateur, huit de plus par la
recette, **zéro** par les tests unitaires — qui restaient verts pendant tout ce
temps.


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

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-19 à 21:50 UTC, sur 2 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 3 916 | 0,01 $ |
| Écriture de cache | 4 572 482 | 15,95 $ |
| Lecture de cache | 307 082 215 | 105,71 $ |
| Sortie | 346 228 | 6,46 $ |
| **Total** | **312 004 841** | **128,13 $ — 111,27 €** |

**Ce qui coûte**

- **1785 appel(s) au modèle** — un par réponse, outils compris —, dont 1385 par des sous-agents — 227 424 711 jetons, 78,65 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  94 561 jetons, écrits une fois par session puis relus à chaque
  échange : 18 853 980 jetons de relecture, 6 % de tout ce qui a été relu.
- **Tours courts** — 1 426 des 1 785 tours (79 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 92,08 $, soit 71 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 65 451 jetons relus au premier appel qui relise
  quelque chose, 459 332 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 312004841 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 65451 0 224
2 principal claude-opus-5 1216 65451 209
3 principal claude-opus-5 1235 66667 541
4 principal claude-opus-5 4280 67902 134
5 principal claude-opus-5 1190 72182 152
6 principal claude-opus-5 5297 73372 102
7 principal claude-opus-5 7757 78669 102
8 principal claude-opus-5 5030 86426 427
9 principal claude-opus-5 482 91456 312
10 principal claude-opus-5 8203 91938 494
11 principal claude-opus-5 3331 100141 222
12 principal claude-opus-5 297 103472 116
13 principal claude-opus-5 6028 103769 116
14 principal claude-opus-5 4750 109797 137
15 principal claude-opus-5 6318 114547 105
16 principal claude-opus-5 7656 120865 166
17 principal claude-opus-5 9181 128521 172
18 principal claude-opus-5 7365 137702 228
19 principal claude-opus-5 3051 145067 1562
20 principal claude-opus-5 2830 148118 1057
21 principal claude-opus-5 3448 150948 621
22 principal claude-opus-5 1839 154396 456
23 principal claude-opus-5 777 156235 409
24 principal claude-opus-5 2009 157012 393
25 principal claude-opus-5 4064 159021 502
26 principal claude-opus-5 909 163085 219
27 principal claude-opus-5 1134 163994 382
28 principal claude-opus-5 5075 165128 683
29 principal claude-opus-5 4804 170203 554
30 principal claude-opus-5 1137 175007 352
31 principal claude-opus-5 4678 176144 1172
32 principal claude-opus-5 1720 180822 338
33 principal claude-opus-5 568 182542 285
34 principal claude-opus-5 795 183110 1403
35 principal claude-opus-5 1551 183905 354
36 principal claude-opus-5 444 185456 418
37 principal claude-opus-5 781 185900 1011
38 principal claude-opus-5 1399 186681 1425
39 principal claude-opus-5 1492 188080 157
40 principal claude-opus-5 928 189572 343
41 principal claude-opus-5 1273 190500 766
42 principal claude-opus-5 1240 191773 3996
43 principal claude-opus-5 4463 193013 493
44 principal claude-opus-5 562 197476 1572
45 principal claude-opus-5 1605 198038 430
46 principal claude-opus-5 578 199643 228
47 principal claude-opus-5 304 200221 1071
48 principal claude-opus-5 3741 200525 95
49 principal claude-opus-5 1790 204266 1054
50 principal claude-opus-5 1248 206056 105
51 principal claude-opus-5 1355 207304 7569
52 principal claude-opus-5 7667 208659 762
53 principal claude-opus-5 4963 216326 1119
54 principal claude-opus-5 1360 221289 963
55 principal claude-opus-5 1267 222649 120
56 principal claude-opus-5 315 223916 264
57 principal claude-opus-5 1805 224231 86
58 principal claude-opus-5 504 226036 1141
59 principal claude-opus-5 1751 226540 141
60 principal claude-opus-5 1064 228291 137
61 principal claude-opus-5 873 229355 551
62 principal claude-opus-5 636 230228 598
63 principal claude-opus-5 939 230864 4428
64 principal claude-opus-5 4583 231803 117
65 principal claude-opus-5 512 236386 4495
66 principal claude-opus-5 4514 236898 3645
67 principal claude-opus-5 3676 241412 653
68 principal claude-opus-5 834 245088 445
69 principal claude-opus-5 738 245922 112
70 principal claude-opus-5 826 246660 1249
71 principal claude-opus-5 1552 247486 883
72 principal claude-opus-5 1827 249038 208
73 principal claude-opus-5 224 250865 233
74 principal claude-opus-5 590 251089 2433
75 principal claude-opus-5 2464 251679 158
76 principal claude-opus-5 735 254143 951
77 principal claude-opus-5 970 254878 1475
78 principal claude-opus-5 1506 255848 898
79 principal claude-opus-5 929 257354 1326
80 principal claude-opus-5 1485 258283 1113
81 principal claude-opus-5 1144 259768 760
82 principal claude-opus-5 899 260912 1275
83 principal claude-opus-5 1306 261811 2551
84 principal claude-opus-5 2582 263117 1745
85 principal claude-opus-5 1776 265699 1565
86 principal claude-opus-5 1596 267475 466
87 principal claude-opus-5 1018 269071 2442
88 principal claude-opus-5 2473 270089 1414
89 principal claude-opus-5 1651 272562 1153
90 principal claude-opus-5 1856 274213 557
91 principal claude-opus-5 870 276069 1047
92 principal claude-opus-5 1126 276939 297
93 principal claude-opus-5 710 278065 814
94 principal claude-opus-5 1077 278775 1471
95 principal claude-opus-5 1535 279852 897
96 principal claude-opus-5 1117 281387 1229
97 principal claude-opus-5 1356 282504 108
98 principal claude-opus-5 265 283860 146
99 principal claude-opus-5 608 284125 1283
100 principal claude-opus-5 1476 284733 137
101 principal claude-opus-5 932 286209 388
102 principal claude-opus-5 1183 287141 1157
103 principal claude-opus-5 10517 289481 191
104 principal claude-opus-5 1324 299998 566
105 principal claude-opus-5 899 301322 133
106 principal claude-opus-5 198 302221 715
107 principal claude-opus-5 1261 302419 395
108 principal claude-opus-5 821 303680 260
109 principal claude-opus-5 1661 304501 92
110 principal claude-opus-5 279 306162 199
111 principal claude-opus-5 740 306441 260
112 principal claude-opus-5 342 307181 247
113 principal claude-opus-5 431 307523 496
114 principal claude-opus-5 580 307954 336
115 principal claude-opus-4-7 43049 0 2788
116 principal claude-opus-4-7 2874 43049 77
117 principal claude-opus-4-7 526 45923 76
118 principal claude-opus-4-7 3156 46449 731
119 principal claude-opus-4-7 942 49605 1764
120 principal claude-opus-4-7 4563 29200 105
121 principal claude-opus-4-7 0 33763 119
122 principal claude-opus-4-7 14615 33763 1856
123 principal claude-opus-4-7 14629 33763 1721
124 principal claude-opus-4-7 21702 29200 4230
125 principal claude-opus-4-7 4392 50902 78
126 principal claude-opus-4-7 484 55294 148
127 principal claude-opus-4-7 3228 55778 3668
128 principal claude-opus-4-7 3742 59006 69
129 principal claude-opus-4-7 32604 29200 1333
130 principal claude-opus-4-7 1435 61804 78
131 principal claude-opus-4-7 764 63239 81
132 principal claude-opus-4-7 193 64003 86
133 principal claude-opus-4-7 3166 64196 275
134 principal claude-opus-4-7 2270 67362 93
135 principal claude-opus-4-7 2188 69632 95
136 principal claude-opus-4-7 2326 71820 6458
137 principal claude-opus-4-7 6970 74146 2171
138 principal claude-opus-4-7 34464 29200 183
139 principal claude-opus-4-7 2318 63664 82
140 principal claude-opus-4-7 501 65982 86
141 principal claude-opus-4-7 4389 66483 741
142 principal claude-opus-4-7 3256 70872 84
143 principal claude-opus-4-7 3229 74128 76
144 principal claude-opus-4-7 3080 77357 86
145 principal claude-opus-4-7 1941 80437 121
146 principal claude-opus-4-7 2116 82378 5902
147 principal claude-opus-4-7 10015 84494 114
148 principal claude-opus-4-7 450 94509 3411
149 principal claude-opus-4-7 87836 29200 4727
150 principal claude-opus-4-7 4850 117036 231
151 principal claude-opus-4-7 7623 121886 167
152 principal claude-opus-4-7 719 129509 2403
153 principal claude-opus-4-7 60913 29200 3113
154 principal claude-opus-4-7 3201 90113 93
155 principal claude-opus-4-7 2745 93314 463
156 principal claude-opus-4-7 2244 96059 135
157 principal claude-opus-4-7 2135 98303 1054
158 principal claude-opus-4-7 3069 100438 2170
159 principal claude-opus-4-7 6268 103507 422
160 principal claude-opus-4-7 3042 109775 519
161 principal claude-opus-4-7 60103 29200 7734
162 principal claude-opus-4-7 7857 89303 92
163 principal claude-opus-4-7 1805 97160 92
164 principal claude-opus-4-7 2453 98965 93
165 principal claude-opus-4-7 1412 101418 95
166 principal claude-opus-4-7 670 102830 93
167 principal claude-opus-4-7 779 103500 124
168 principal claude-opus-4-7 5017 104279 92
169 principal claude-opus-4-7 1882 109296 92
170 principal claude-opus-4-7 2756 111178 166
171 principal claude-opus-4-7 45582 29200 9556
172 principal claude-opus-4-7 9642 74782 132
173 principal claude-opus-4-7 233 84424 85
174 principal claude-opus-4-7 154 84657 82
175 principal claude-opus-4-7 3254 84811 82
176 principal claude-opus-4-7 3616 88065 118
177 principal claude-opus-4-7 2081 91681 125
178 principal claude-opus-4-7 4951 93762 125
179 principal claude-opus-4-7 2638 98713 122
180 principal claude-opus-4-7 5091 101351 1216
181 principal claude-opus-4-7 3785 29200 157
182 principal claude-opus-4-7 277 32985 89
183 principal claude-opus-4-7 2101 33262 440
184 principal claude-opus-4-7 0 32985 180
185 principal claude-opus-4-7 300 32985 89
186 principal claude-opus-4-7 577 35363 653
187 principal claude-opus-4-7 727 35940 69
188 principal claude-opus-4-7 2101 33285 943
189 principal claude-opus-4-7 1082 35386 803
190 principal claude-opus-4-7 877 36468 69
191 principal claude-opus-4-7 8697 29200 199
192 principal claude-opus-4-7 318 37897 78
193 principal claude-opus-4-7 143 38215 132
194 principal claude-opus-4-7 6307 38358 482
195 principal claude-opus-4-7 71894 0 1840
196 principal claude-opus-4-7 1971 71894 100
197 principal claude-opus-4-7 4397 73865 1138
198 principal claude-opus-4-7 16426 29200 425
199 principal claude-opus-4-7 547 45626 127
200 principal claude-opus-4-7 228 46173 77
201 principal claude-opus-4-7 145 46401 91
202 principal claude-opus-5 29110 37359 294
203 principal claude-opus-5 1320 66469 469
204 principal claude-opus-5 19638 67789 406
205 principal claude-opus-5 3323 87427 299
206 principal claude-opus-5 8996 90750 469
207 principal claude-opus-5 870 99746 830
208 principal claude-opus-5 3840 100616 669
209 principal claude-opus-5 7081 104456 161
210 principal claude-opus-5 613 111537 789
211 principal claude-opus-5 1309 112150 252
212 principal claude-opus-5 423 113459 189
213 principal claude-opus-5 751 113882 137
214 principal claude-opus-5 677 114633 385
215 principal claude-opus-5 447 115310 140
216 principal claude-opus-5 282 115757 322
217 principal claude-opus-5 440 116039 121
218 principal claude-opus-5 163 116479 2020
219 principal claude-opus-5 2419 116642 618
220 principal claude-opus-5 1048 119061 567
221 principal claude-opus-5 1037 120109 444
222 principal claude-opus-5 868 121146 760
223 principal claude-opus-5 2598 122014 876
224 principal claude-opus-5 2006 124612 214
225 principal claude-opus-5 634 126618 959
226 principal claude-opus-5 1039 127252 1282
227 principal claude-opus-5 1497 128291 639
228 principal claude-opus-5 919 129788 291
229 principal claude-opus-5 776 130707 1414
230 principal claude-opus-5 4351 131483 376
231 principal claude-opus-5 5973 130707 513
232 principal claude-opus-5 3394 136680 375
233 principal claude-opus-5 1378 140074 838
234 principal claude-opus-5 1640 141452 719
235 principal claude-opus-5 1756 143092 364
236 principal claude-opus-5 635 144848 454
237 principal claude-opus-5 2243 145483 565
238 principal claude-opus-5 5109 147726 437
239 principal claude-opus-5 6524 152835 294
240 principal claude-opus-5 6919 159359 263
241 principal claude-opus-5 1532 166278 1188
242 principal claude-opus-5 1975 167810 730
243 principal claude-opus-5 1093 169785 667
244 principal claude-opus-5 1983 170878 877
245 principal claude-opus-5 957 172861 141
246 principal claude-opus-5 308 173818 1243
247 principal claude-opus-5 1771 174126 1984
248 principal claude-opus-5 2266 175897 155
249 principal claude-opus-5 326 178163 1152
250 principal claude-opus-5 44 179641 477
251 principal claude-opus-5 2857 179685 1046
252 principal claude-opus-5 1557 182542 84
253 principal claude-opus-5 465 184099 1495
254 principal claude-opus-5 2105 184564 214
255 principal claude-opus-5 511 186669 609
256 principal claude-opus-5 2233 187180 2105
257 principal claude-opus-5 2953 189413 191
258 principal claude-opus-5 2051 192366 343
259 principal claude-opus-5 3324 194417 721
260 principal claude-opus-5 791 197741 135
261 principal claude-opus-5 333 198532 156
262 principal claude-opus-5 1057 198865 123
263 principal claude-opus-5 3432 199922 669
264 principal claude-opus-5 2179 203354 427
265 principal claude-opus-5 520 205533 411
266 principal claude-opus-5 441 206053 333
267 principal claude-opus-5 1896 206494 141
268 principal claude-opus-5 383 208390 820
269 principal claude-opus-5 2541 208773 951
270 principal claude-opus-5 1888 211314 1065
271 principal claude-opus-5 2456 213202 106
272 principal claude-opus-5 891 215658 1092
273 principal claude-opus-5 1170 216549 1330
274 principal claude-opus-5 1490 217719 1629
275 principal claude-opus-5 1680 219209 152
276 principal claude-opus-5 183 220889 2213
277 principal claude-opus-5 3407 221072 139
278 principal claude-opus-5 623 224479 1622
279 principal claude-opus-5 1978 225102 853
280 principal claude-opus-5 995 227080 110
281 principal claude-opus-5 268 228075 749
282 principal claude-opus-5 1029 228343 160
283 principal claude-opus-5 422 229372 521
284 principal claude-opus-5 732 229794 491
285 principal claude-opus-5 955 230526 424
286 principal claude-opus-5 6190 229372 326
287 principal claude-opus-5 708 235562 466
288 principal claude-opus-5 1358 236270 334
289 principal claude-opus-5 634 237628 1255
290 principal claude-opus-5 1290 238262 1522
291 principal claude-opus-5 1754 239552 114
292 principal claude-opus-5 219 241306 210
293 principal claude-opus-5 1074 241525 497
294 principal claude-opus-5 1790 242599 1869
295 principal claude-opus-5 2549 244389 137
296 principal claude-opus-5 1908 246938 871
297 principal claude-opus-5 1148 248846 217
298 principal claude-opus-5 2483 249994 219
299 principal claude-opus-5 6234 249994 406
300 principal claude-opus-5 957 256228 388
301 principal claude-opus-5 908 257185 2925
302 principal claude-opus-5 3867 258093 2826
303 principal claude-opus-5 3226 261960 2377
304 principal claude-opus-5 2533 265186 242
305 principal claude-opus-5 522 267719 28
306 principal claude-opus-5 101 268241 70
307 principal claude-opus-5 3043 268241 266
308 principal claude-opus-5 837 271284 1941
309 principal claude-opus-5 2267 272121 114
310 principal claude-opus-5 227 274388 2370
311 principal claude-opus-5 2769 274615 430
312 principal claude-opus-5 4455 277814 605
313 principal claude-opus-5 1015 282269 502
314 principal claude-opus-5 548 283284 281
315 principal claude-opus-5 337 283832 2984
316 principal claude-opus-5 3177 284169 1726
317 principal claude-opus-5 1982 287346 114
318 principal claude-opus-5 221 289328 365
319 principal claude-opus-5 1690 289549 411
320 principal claude-opus-5 727 291239 2383
321 principal claude-opus-5 2776 291966 134
322 principal claude-opus-5 272 294742 489
323 principal claude-opus-5 2431 295014 352
324 principal claude-opus-5 4260 297797 808
325 principal claude-opus-5 1328 302057 570
326 principal claude-opus-5 1330 303385 602
327 principal claude-opus-5 1075 304715 924
328 principal claude-opus-5 1020 305790 1712
329 principal claude-opus-5 1745 306810 1852
330 principal claude-opus-5 2382 308555 305
331 principal claude-opus-5 1088 310937 980
332 principal claude-opus-5 4925 311242 208
333 principal claude-opus-5 651 316167 1181
334 principal claude-opus-5 1433 316818 794
335 principal claude-opus-5 1101 318251 108
336 principal claude-opus-5 183 319352 2070
337 principal claude-opus-5 2367 319535 114
338 principal claude-opus-5 226 321902 464
339 principal claude-opus-5 1739 322128 2627
340 principal claude-opus-5 3032 323867 160
341 principal claude-opus-5 1760 326899 439
342 principal claude-opus-5 20358 329098 952
343 principal claude-opus-5 1519 349456 226
344 principal claude-opus-5 1332 350975 2471
345 principal claude-opus-5 2992 352307 1730
346 principal claude-opus-5 1765 355299 510
347 principal claude-opus-5 790 357064 75
348 principal claude-opus-5 3677 357854 247
349 principal claude-opus-5 654 361531 400
350 principal claude-opus-5 577 362185 108
351 principal claude-opus-5 183 362762 1861
352 principal claude-opus-5 2149 362945 114
353 principal claude-opus-5 217 365094 3043
354 principal claude-opus-5 3574 365311 386
355 principal claude-opus-5 4735 369271 652
356 principal claude-opus-5 1752 374006 2059
357 principal claude-opus-5 2161 375758 1873
358 principal claude-opus-5 2071 377919 114
359 principal claude-opus-5 218 379990 2730
360 principal claude-opus-5 3252 380208 673
361 principal claude-opus-5 2273 383460 376
362 principal claude-opus-5 581 385733 655
363 principal claude-opus-5 38 386969 173
364 principal claude-opus-5 612 387007 773
365 principal claude-opus-5 1053 387619 78
366 principal claude-opus-5 12893 388672 551
367 principal claude-opus-5 1078 401565 3209
368 principal claude-opus-5 3287 402643 1894
369 principal claude-opus-5 2099 405930 114
370 principal claude-opus-5 227 408029 1468
371 principal claude-opus-5 2274 408256 256
372 principal claude-opus-5 2454 410530 766
373 principal claude-opus-5 1655 412984 565
374 principal claude-opus-5 1115 414639 460
375 principal claude-opus-5 550 415754 756
376 principal claude-opus-5 1018 416304 428
377 principal claude-opus-5 500 417322 2261
378 principal claude-opus-5 2326 417822 113
379 principal claude-opus-5 256 420148 551
380 principal claude-opus-5 831 420404 103
381 principal claude-opus-5 4061 421235 660
382 principal claude-opus-5 1117 425296 1087
383 principal claude-opus-5 1165 426413 1186
384 principal claude-opus-5 1430 427578 114
385 principal claude-opus-5 223 429008 358
386 principal claude-opus-5 514 429231 115
387 principal claude-opus-5 1192 429745 2854
388 principal claude-opus-5 3384 430937 864
389 principal claude-opus-5 1335 434321 496
390 principal claude-opus-5 1652 435656 869
391 principal claude-opus-5 3567 438177 1464
392 principal claude-opus-5 1952 441744 547
393 principal claude-opus-5 2431 443696 602
394 principal claude-opus-5 916 446127 1588
395 principal claude-opus-5 1779 447043 2137
396 principal claude-opus-5 2537 448822 739
397 principal claude-opus-5 4761 452098 408
398 principal claude-opus-5 1065 456859 1360
399 principal claude-opus-5 1408 457924 2038
400 principal claude-opus-5 2261 459332 552
401 agent claude-haiku-4-5-20251001 12354 0 4
402 agent claude-haiku-4-5-20251001 3757 12354 2
403 agent claude-haiku-4-5-20251001 1860 16111 2
404 agent claude-haiku-4-5-20251001 578 17971 2
405 agent claude-haiku-4-5-20251001 12290 0 1
406 agent claude-haiku-4-5-20251001 1760 12290 2
407 agent claude-haiku-4-5-20251001 1792 14050 2
408 agent claude-haiku-4-5-20251001 346 15842 2
409 agent claude-haiku-4-5-20251001 1738 16188 3
410 agent claude-haiku-4-5-20251001 317 17926 4
411 agent claude-sonnet-5 19105 0 4
412 agent claude-sonnet-5 6133 19105 5
413 agent claude-sonnet-5 1673 25238 20
414 agent claude-sonnet-5 6906 26911 2
415 agent claude-sonnet-5 1291 33817 17
416 agent claude-sonnet-5 19486 35108 8
417 agent claude-sonnet-5 7003 54594 3
418 agent claude-sonnet-5 3941 61597 4
419 agent claude-sonnet-5 3688 65538 3
420 agent claude-sonnet-5 1544 69226 2
421 agent claude-sonnet-5 8434 70770 2
422 agent claude-sonnet-5 730 79204 2
423 agent claude-sonnet-5 1604 79934 2
424 agent claude-sonnet-5 887 81538 2
425 agent claude-sonnet-5 4828 82425 6
426 agent claude-sonnet-5 3256 87253 3
427 agent claude-sonnet-5 4467 90509 2
428 agent claude-sonnet-5 5308 94976 2
429 agent claude-sonnet-5 1736 100284 2
430 agent claude-sonnet-5 5319 102020 2
431 agent claude-sonnet-5 5788 107339 3
432 agent claude-sonnet-5 8257 113127 5
433 agent claude-sonnet-5 7371 121384 3
434 agent claude-sonnet-5 1571 128755 1
435 agent claude-sonnet-5 490 130326 6
436 agent claude-sonnet-5 5541 130816 3
437 agent claude-sonnet-5 20491 136357 3
438 agent claude-sonnet-5 8615 156848 4
439 agent claude-sonnet-5 3766 165463 6
440 agent claude-sonnet-5 10251 169229 8
441 agent claude-sonnet-5 5249 179480 5
442 agent claude-sonnet-5 3160 184729 5
443 agent claude-sonnet-5 1089 187889 3
444 agent claude-sonnet-5 975 188978 6
445 agent claude-sonnet-5 2553 189953 2
446 agent claude-sonnet-5 761 192506 6
447 agent claude-sonnet-5 415 193267 17
448 agent claude-sonnet-5 639 193682 2
449 agent claude-sonnet-5 1033 194321 6
450 agent claude-sonnet-5 1079 195354 17
451 agent claude-sonnet-5 404 196433 2
452 agent claude-sonnet-5 1728 196837 4
453 agent claude-sonnet-5 365 198565 16
454 agent claude-sonnet-5 550 198930 7
455 agent claude-sonnet-5 640 199480 3
456 agent claude-sonnet-5 828 200120 4
457 agent claude-sonnet-5 1438 200948 3
458 agent claude-sonnet-5 1463 202386 20
459 agent claude-sonnet-5 313 203849 3
460 agent claude-sonnet-5 443 204162 17
461 agent claude-sonnet-5 444 204605 5
462 agent claude-sonnet-5 604 205049 3
463 agent claude-sonnet-5 1213 205653 3
464 agent claude-sonnet-5 463 206866 5
465 agent claude-sonnet-5 929 207329 4
466 agent claude-sonnet-5 394 208258 20
467 agent claude-sonnet-5 2632 208652 9
468 agent claude-sonnet-5 5348 211284 4
469 agent claude-sonnet-5 1712 216632 3
470 agent claude-sonnet-5 298 218344 20
471 agent claude-sonnet-5 1494 218642 20
472 agent claude-sonnet-5 817 220136 3
473 agent claude-sonnet-5 492 220953 6
474 agent claude-sonnet-5 609 221445 3
475 agent claude-sonnet-5 3432 222054 3
476 agent claude-sonnet-5 3328 225486 3
477 agent claude-sonnet-5 528 228814 5
478 agent claude-sonnet-5 724 229342 3
479 agent claude-sonnet-5 415 230066 4
480 agent claude-sonnet-5 564 230481 5
481 agent claude-sonnet-5 442 231045 5
482 agent claude-sonnet-5 518 231487 3
483 agent claude-sonnet-5 297 232005 20
484 agent claude-sonnet-5 522 232302 3
485 agent claude-sonnet-5 856 232824 4
486 agent claude-sonnet-5 618 233680 3
487 agent claude-sonnet-5 733 234298 8
488 agent claude-sonnet-5 497 235031 20
489 agent claude-sonnet-5 513 235528 3
490 agent claude-sonnet-5 684 236041 17
491 agent claude-sonnet-5 885 236725 7
492 agent claude-sonnet-5 199 237610 3
493 agent claude-sonnet-5 212 237809 9
494 agent claude-sonnet-5 383 238021 3
495 agent claude-sonnet-5 552 238404 5
496 agent claude-sonnet-5 1189 238956 3
497 agent claude-sonnet-5 604 240145 17
498 agent claude-sonnet-5 428 240749 17
499 agent claude-sonnet-5 1358 241177 3
500 agent claude-sonnet-5 1407 242535 3
501 agent claude-sonnet-5 2209 243942 2
502 agent claude-sonnet-5 699 246151 20
503 agent claude-sonnet-5 292 246850 3
504 agent claude-sonnet-5 674 247142 20
505 agent claude-sonnet-5 1468 247816 5
506 agent claude-sonnet-5 601 249284 5
507 agent claude-sonnet-5 705 249885 544
508 agent claude-sonnet-5 649 250590 2
509 agent claude-sonnet-5 2520 251239 4
510 agent claude-sonnet-5 402 253759 9
511 agent claude-sonnet-5 1065 254161 3
512 agent claude-sonnet-5 8233 255226 5
513 agent claude-sonnet-5 10092 263459 8
514 agent claude-sonnet-5 956 273551 2
515 agent claude-sonnet-5 855 274507 20
516 agent claude-sonnet-5 299 275362 9
517 agent claude-sonnet-5 754 275661 1
518 agent claude-sonnet-5 1379 276415 5
519 agent claude-sonnet-5 0 278145 9
520 agent claude-sonnet-5 3259 278145 2
521 agent claude-sonnet-5 2342 281404 2
522 agent claude-sonnet-5 4838 283746 4
523 agent claude-sonnet-5 1575 288584 3
524 agent claude-sonnet-5 657 290159 20
525 agent claude-sonnet-5 691 290816 4
526 agent claude-sonnet-5 8773 291507 2
527 agent claude-sonnet-5 485 300280 2
528 agent claude-sonnet-5 232 300765 2
529 agent claude-sonnet-5 1317 300997 20
530 agent claude-sonnet-5 436 302314 20
531 agent claude-sonnet-5 1296 302750 3
532 agent claude-sonnet-5 2433 304046 3
533 agent claude-sonnet-5 597 306479 2
534 agent claude-sonnet-5 2990 307076 3
535 agent claude-sonnet-5 848 310066 20
536 agent claude-sonnet-5 472 310914 9
537 agent claude-sonnet-5 383 311386 3
538 agent claude-sonnet-5 360 311769 20
539 agent claude-sonnet-5 178 312129 3
540 agent claude-sonnet-5 403 312307 20
541 agent claude-sonnet-5 196 312710 20
542 agent claude-sonnet-5 167 312906 2
543 agent claude-sonnet-5 522 313073 6
544 agent claude-sonnet-5 728 313595 8
545 agent claude-sonnet-5 1782 314323 3
546 agent claude-sonnet-5 569 316105 3
547 agent claude-sonnet-5 511 316674 6
548 agent claude-sonnet-5 387 317185 6
549 agent claude-sonnet-5 1155 317572 2
550 agent claude-sonnet-5 368 318727 2
551 agent claude-sonnet-5 173 319095 9
552 agent claude-sonnet-5 1289 319268 2
553 agent claude-sonnet-5 1154 320557 4
554 agent claude-sonnet-5 243 321711 20
555 agent claude-sonnet-5 518 321954 9
556 agent claude-sonnet-5 3565 322472 2
557 agent claude-sonnet-5 2155 326037 10
558 agent claude-sonnet-5 632 328192 5
559 agent claude-sonnet-5 9289 328824 1
560 agent claude-sonnet-5 438 338113 9
561 agent claude-sonnet-5 531 338551 2
562 agent claude-sonnet-5 2154 339082 3
563 agent claude-sonnet-5 725 341236 16
564 agent claude-sonnet-5 1203 341961 20
565 agent claude-sonnet-5 383 343164 5
566 agent claude-sonnet-5 1036 343547 2
567 agent claude-sonnet-5 284 344583 1
568 agent claude-sonnet-5 585 344867 1
569 agent claude-haiku-4-5-20251001 12289 0 4
570 agent claude-haiku-4-5-20251001 2167 12289 2
571 agent claude-haiku-4-5-20251001 1699 14456 2
572 agent claude-haiku-4-5-20251001 472 16155 4
573 agent claude-haiku-4-5-20251001 11755 0 4
574 agent claude-haiku-4-5-20251001 1353 11755 2
575 agent claude-haiku-4-5-20251001 2289 13108 2
576 agent claude-haiku-4-5-20251001 1839 15397 5
577 agent claude-haiku-4-5-20251001 352 17236 2
578 agent claude-haiku-4-5-20251001 12035 0 4
579 agent claude-haiku-4-5-20251001 1463 12035 2
580 agent claude-haiku-4-5-20251001 2431 13498 2
581 agent claude-haiku-4-5-20251001 715 15929 2
582 agent claude-haiku-4-5-20251001 1449 16644 2
583 agent claude-haiku-4-5-20251001 372 18093 4
584 agent claude-opus-5 41450 0 1
585 agent claude-opus-5 1592 41450 28
586 agent claude-opus-5 25257 43042 2
587 agent claude-sonnet-5 18228 0 4
588 agent claude-sonnet-5 3901 18228 2
589 agent claude-sonnet-5 5470 22129 20
590 agent claude-sonnet-5 7726 27599 2
591 agent claude-sonnet-5 432 35325 2
592 agent claude-sonnet-5 490 35757 6
593 agent claude-sonnet-5 1274 36247 2
594 agent claude-sonnet-5 1236 37521 20
595 agent claude-sonnet-5 327 38757 2
596 agent claude-sonnet-5 1922 39084 2
597 agent claude-sonnet-5 1508 41006 20
598 agent claude-sonnet-5 349 42514 3
599 agent claude-sonnet-5 1186 42863 20
600 agent claude-sonnet-5 440 44049 2
601 agent claude-sonnet-5 610 44489 20
602 agent claude-sonnet-5 483 45099 6
603 agent claude-sonnet-5 1424 45582 20
604 agent claude-sonnet-5 342 47006 2
605 agent claude-sonnet-5 1272 47348 14
606 agent claude-sonnet-5 1626 48620 3
607 agent claude-sonnet-5 699 50246 2
608 agent claude-sonnet-5 861 50945 20
609 agent claude-sonnet-5 398 51806 2
610 agent claude-sonnet-5 316 52204 17
611 agent claude-sonnet-5 638 52520 17
612 agent claude-sonnet-5 639 53158 289
613 agent claude-sonnet-5 391 53797 20
614 agent claude-sonnet-5 762 54188 2
615 agent claude-sonnet-5 1080 54950 20
616 agent claude-sonnet-5 326 56030 2
617 agent claude-sonnet-5 523 56356 20
618 agent claude-sonnet-5 886 56879 2
619 agent claude-sonnet-5 305 57765 118
620 agent claude-sonnet-5 166 58070 1
621 agent claude-sonnet-5 18498 0 5
622 agent claude-sonnet-5 8327 18498 5
623 agent claude-sonnet-5 1699 26825 20
624 agent claude-sonnet-5 28677 28524 2
625 agent claude-sonnet-5 8358 57201 9
626 agent claude-sonnet-5 8175 65559 6
627 agent claude-sonnet-5 291 73734 20
628 agent claude-sonnet-5 242 74025 5
629 agent claude-sonnet-5 1301 74267 20
630 agent claude-sonnet-5 26254 75568 3
631 agent claude-sonnet-5 5630 101822 3
632 agent claude-sonnet-5 3287 107452 2
633 agent claude-sonnet-5 14196 110739 3
634 agent claude-sonnet-5 4977 124935 4
635 agent claude-sonnet-5 3718 129912 5
636 agent claude-sonnet-5 458 133630 4
637 agent claude-sonnet-5 732 134088 8
638 agent claude-sonnet-5 11811 134820 4
639 agent claude-sonnet-5 6412 146631 7
640 agent claude-sonnet-5 2531 153043 3
641 agent claude-sonnet-5 1816 155574 10
642 agent claude-sonnet-5 323 157390 20
643 agent claude-sonnet-5 372 157713 20
644 agent claude-sonnet-5 4675 158085 14
645 agent claude-sonnet-5 5223 162760 3
646 agent claude-sonnet-5 5138 167983 6
647 agent claude-sonnet-5 3187 173121 3
648 agent claude-sonnet-5 3807 176308 20
649 agent claude-sonnet-5 334 180115 3
650 agent claude-sonnet-5 1762 180449 20
651 agent claude-sonnet-5 1002 182211 6
652 agent claude-sonnet-5 5694 183213 2
653 agent claude-sonnet-5 811 188907 2
654 agent claude-sonnet-5 4257 189718 6
655 agent claude-sonnet-5 10274 193975 6
656 agent claude-sonnet-5 8421 204249 3
657 agent claude-sonnet-5 2479 212670 3
658 agent claude-sonnet-5 2626 215149 5
659 agent claude-sonnet-5 493 217775 4
660 agent claude-sonnet-5 183 218268 9
661 agent claude-sonnet-5 245 218451 2
662 agent claude-sonnet-5 495 218696 2
663 agent claude-sonnet-5 1082 219191 8
664 agent claude-sonnet-5 1779 220273 9
665 agent claude-sonnet-5 368 222052 4
666 agent claude-sonnet-5 820 222420 2
667 agent claude-sonnet-5 342 223240 3
668 agent claude-sonnet-5 288 223582 5
669 agent claude-sonnet-5 155 223870 20
670 agent claude-sonnet-5 2223 224025 6
671 agent claude-sonnet-5 12336 226248 3
672 agent claude-sonnet-5 581 238584 3
673 agent claude-sonnet-5 472 239165 3
674 agent claude-sonnet-5 328 239637 233
675 agent claude-sonnet-5 316 239965 2
676 agent claude-sonnet-5 436 240281 1
677 agent claude-sonnet-5 569 240717 2
678 agent claude-sonnet-5 786 241286 5
679 agent claude-sonnet-5 327 242072 2
680 agent claude-sonnet-5 1110 242399 3
681 agent claude-sonnet-5 9674 243509 3
682 agent claude-sonnet-5 5111 253183 3
683 agent claude-sonnet-5 969 258294 3
684 agent claude-sonnet-5 652 259263 20
685 agent claude-sonnet-5 1820 259915 3
686 agent claude-sonnet-5 563 261735 20
687 agent claude-sonnet-5 1804 262298 3
688 agent claude-sonnet-5 4489 264102 7
689 agent claude-sonnet-5 1532 268591 3
690 agent claude-sonnet-5 547 270123 20
691 agent claude-sonnet-5 4227 270670 20
692 agent claude-sonnet-5 274 274897 8
693 agent claude-sonnet-5 7883 275171 20
694 agent claude-sonnet-5 1441 283054 5
695 agent claude-sonnet-5 2104 284495 2
696 agent claude-sonnet-5 1232 286599 17
697 agent claude-sonnet-5 841 287831 5
698 agent claude-sonnet-5 342 288672 6
699 agent claude-sonnet-5 3563 289014 3
700 agent claude-sonnet-5 2429 292577 3
701 agent claude-sonnet-5 2951 295006 17
702 agent claude-sonnet-5 1496 297957 3
703 agent claude-sonnet-5 1294 299453 20
704 agent claude-sonnet-5 567 300747 5
705 agent claude-sonnet-5 2080 301314 3
706 agent claude-sonnet-5 3650 303394 20
707 agent claude-sonnet-5 592 307044 17
708 agent claude-sonnet-5 548 307636 6
709 agent claude-sonnet-5 754 308184 1
710 agent claude-sonnet-5 1915 308938 3
711 agent claude-sonnet-5 5860 310853 2
712 agent claude-sonnet-5 571 316713 20
713 agent claude-sonnet-5 962 317284 2
714 agent claude-sonnet-5 1934 318246 2
715 agent claude-sonnet-5 2294 320180 5
716 agent claude-sonnet-5 2118 322474 20
717 agent claude-sonnet-5 984 324592 20
718 agent claude-sonnet-5 1029 325576 3
719 agent claude-sonnet-5 3213 326605 3
720 agent claude-sonnet-5 1181 329818 2
721 agent claude-sonnet-5 972 330999 17
722 agent claude-sonnet-5 1628 331971 3
723 agent claude-sonnet-5 511 333599 5
724 agent claude-sonnet-5 691 334110 5
725 agent claude-sonnet-5 3977 334801 20
726 agent claude-sonnet-5 8832 338778 2
727 agent claude-sonnet-5 3073 347610 20
728 agent claude-sonnet-5 953 350683 5
729 agent claude-sonnet-5 1110 351636 20
730 agent claude-sonnet-5 676 352746 14
731 agent claude-sonnet-5 391 353422 20
732 agent claude-sonnet-5 283 353813 16
733 agent claude-sonnet-5 695 354096 5
734 agent claude-sonnet-5 1039 354791 8
735 agent claude-sonnet-5 2402 355830 3
736 agent claude-sonnet-5 589 358232 14
737 agent claude-sonnet-5 589 358821 20
738 agent claude-sonnet-5 203 359410 20
739 agent claude-sonnet-5 922 359613 17
740 agent claude-sonnet-5 606 360535 20
741 agent claude-sonnet-5 480 361141 4
742 agent claude-sonnet-5 3378 361621 20
743 agent claude-sonnet-5 1109 364999 7
744 agent claude-sonnet-5 1926 366108 20
745 agent claude-sonnet-5 988 368034 4
746 agent claude-sonnet-5 699 369022 6
747 agent claude-sonnet-5 3615 369721 3
748 agent claude-sonnet-5 862 373336 5
749 agent claude-sonnet-5 2642 374198 20
750 agent claude-sonnet-5 1099 376840 2
751 agent claude-sonnet-5 662 377939 5
752 agent claude-sonnet-5 4012 378601 2
753 agent claude-sonnet-5 1750 382613 2
754 agent claude-sonnet-5 1054 384363 8
755 agent claude-sonnet-5 1471 385417 3
756 agent claude-sonnet-5 689 386888 8
757 agent claude-sonnet-5 290 387577 7
758 agent claude-sonnet-5 4308 387867 2
759 agent claude-sonnet-5 1826 392175 5
760 agent claude-sonnet-5 239 394001 6
761 agent claude-sonnet-5 2614 394240 3
762 agent claude-sonnet-5 1272 396854 6
763 agent claude-sonnet-5 971 398126 3
764 agent claude-sonnet-5 735 399097 3
765 agent claude-sonnet-5 379 399832 17
766 agent claude-sonnet-5 1336 400211 20
767 agent claude-sonnet-5 1210 401547 3
768 agent claude-sonnet-5 9324 402757 6
769 agent claude-sonnet-5 3436 412081 3
770 agent claude-sonnet-5 1005 415517 3
771 agent claude-sonnet-5 8565 416522 5
772 agent claude-sonnet-5 1164 425087 10
773 agent claude-sonnet-5 3314 426251 9
774 agent claude-sonnet-5 1434 429565 17
775 agent claude-sonnet-5 727 430999 2
776 agent claude-sonnet-5 896 431726 17
777 agent claude-sonnet-5 1102 432622 9
778 agent claude-sonnet-5 765 433724 4
779 agent claude-sonnet-5 540 434489 17
780 agent claude-sonnet-5 327 435029 17
781 agent claude-sonnet-5 509 435356 5
782 agent claude-sonnet-5 250 435865 14
783 agent claude-sonnet-5 500 436115 17
784 agent claude-sonnet-5 425 436615 3
785 agent claude-sonnet-5 366 437040 2
786 agent claude-sonnet-5 8700 437406 3
787 agent claude-sonnet-5 3023 446106 2
788 agent claude-sonnet-5 3047 449129 20
789 agent claude-sonnet-5 1087 452176 5
790 agent claude-sonnet-5 1792 453263 9
791 agent claude-sonnet-5 1926 455055 2
792 agent claude-sonnet-5 905 456981 17
793 agent claude-sonnet-5 786 457886 6
794 agent claude-sonnet-5 890 458672 1
795 agent claude-sonnet-5 558 459562 4
796 agent claude-sonnet-5 327 460120 8
797 agent claude-sonnet-5 4109 460447 4
798 agent claude-sonnet-5 1006 464556 10
799 agent claude-sonnet-5 876 465562 2
800 agent claude-sonnet-5 580 466438 10
801 agent claude-sonnet-5 537 467018 8
802 agent claude-sonnet-5 832 467555 2
803 agent claude-sonnet-5 714 468387 2
804 agent claude-sonnet-5 1294 469101 3
805 agent claude-sonnet-5 750 470395 2
806 agent claude-sonnet-5 1141 471145 17
807 agent claude-sonnet-5 360 472286 3
808 agent claude-sonnet-5 399 472646 20
809 agent claude-sonnet-5 281 473045 2
810 agent claude-sonnet-5 225 473326 1
811 agent claude-sonnet-5 662 473551 17
812 agent claude-sonnet-5 494 474213 20
813 agent claude-sonnet-5 158 474707 2
814 agent claude-sonnet-5 3072 474865 7
815 agent claude-sonnet-5 791 477937 6
816 agent claude-sonnet-5 1788 478728 5
817 agent claude-sonnet-5 534 480516 4
818 agent claude-sonnet-5 669 481050 5
819 agent claude-sonnet-5 643 481719 9
820 agent claude-sonnet-5 406 482362 2
821 agent claude-sonnet-5 10888 482768 5
822 agent claude-sonnet-5 384 493656 5
823 agent claude-sonnet-5 447 494040 1
824 agent claude-sonnet-5 453 494487 3
825 agent claude-sonnet-5 371 494940 6
826 agent claude-sonnet-5 1471 495311 3
827 agent claude-sonnet-5 8338 496782 2
828 agent claude-sonnet-5 7229 11467 4
829 agent claude-sonnet-5 9840 18696 4
830 agent claude-sonnet-5 626 28536 20
831 agent claude-sonnet-5 8119 29162 8
832 agent claude-sonnet-5 16583 37281 4
833 agent claude-sonnet-5 4489 53864 3
834 agent claude-sonnet-5 17681 58353 3
835 agent claude-sonnet-5 15658 76034 3
836 agent claude-sonnet-5 13215 91692 2
837 agent claude-sonnet-5 3864 104907 6
838 agent claude-sonnet-5 2997 108771 2
839 agent claude-sonnet-5 145648 0 2
840 agent claude-sonnet-5 899 145648 2
841 agent claude-sonnet-5 273 146547 2
842 agent claude-sonnet-5 2148 146820 20
843 agent claude-sonnet-5 694 148968 4
844 agent claude-sonnet-5 4605 149662 2
845 agent claude-sonnet-5 171 154267 20
846 agent claude-sonnet-5 714 154438 8
847 agent claude-sonnet-5 1183 155152 6
848 agent claude-sonnet-5 1209 156335 2
849 agent claude-sonnet-5 447 157544 1
850 agent claude-sonnet-5 5602 157991 3
851 agent claude-sonnet-5 221 163593 1
852 agent claude-sonnet-5 1083 163814 8
853 agent claude-sonnet-5 1780 164897 20
854 agent claude-sonnet-5 599 166677 17
855 agent claude-sonnet-5 1103 167276 2
856 agent claude-sonnet-5 1926 168379 3
857 agent claude-sonnet-5 4444 170305 20
858 agent claude-sonnet-5 145 174749 20
859 agent claude-sonnet-5 972 174894 3
860 agent claude-sonnet-5 1080 175866 17
861 agent claude-sonnet-5 1295 176946 20
862 agent claude-sonnet-5 804 178241 2
863 agent claude-sonnet-5 2693 179045 2
864 agent claude-sonnet-5 1517 181738 20
865 agent claude-sonnet-5 724 183255 17
866 agent claude-sonnet-5 299 183979 2
867 agent claude-sonnet-5 3111 184278 2
868 agent claude-sonnet-5 861 187389 7
869 agent claude-sonnet-5 2183 188250 2
870 agent claude-sonnet-5 164 190433 20
871 agent claude-sonnet-5 369 190597 4
872 agent claude-sonnet-5 599 190966 1
873 agent claude-sonnet-5 402 191565 2
874 agent claude-sonnet-5 1799 191967 9
875 agent claude-sonnet-5 224 193766 6
876 agent claude-sonnet-5 172 193990 20
877 agent claude-sonnet-5 1055 194162 3
878 agent claude-sonnet-5 703 195217 2
879 agent claude-sonnet-5 295 195920 14
880 agent claude-sonnet-5 1053 196215 2
881 agent claude-sonnet-5 925 197268 2
882 agent claude-sonnet-5 338 198193 2
883 agent claude-sonnet-5 592 198531 1
884 agent claude-haiku-4-5-20251001 12409 0 4
885 agent claude-haiku-4-5-20251001 2992 12409 2
886 agent claude-haiku-4-5-20251001 1094 15401 2
887 agent claude-haiku-4-5-20251001 1919 16495 2
888 agent claude-haiku-4-5-20251001 357 18414 2
889 agent claude-sonnet-5 18345 0 4
890 agent claude-sonnet-5 2403 18345 5
891 agent claude-sonnet-5 23828 20748 20
892 agent claude-sonnet-5 9762 44576 2
893 agent claude-sonnet-5 604 54338 2
894 agent claude-sonnet-5 206 54942 2
895 agent claude-sonnet-5 823 55148 20
896 agent claude-sonnet-5 222 55971 2
897 agent claude-sonnet-5 1034 56193 20
898 agent claude-sonnet-5 139 57227 3
899 agent claude-sonnet-5 1251 57366 20
900 agent claude-sonnet-5 253 58617 2
901 agent claude-sonnet-5 151 58870 20
902 agent claude-sonnet-5 891 59021 17
903 agent claude-sonnet-5 300 59912 17
904 agent claude-sonnet-5 1243 60212 20
905 agent claude-sonnet-5 139 61455 3
906 agent claude-sonnet-5 921 61594 79
907 agent claude-sonnet-5 297 62515 2
908 agent claude-sonnet-5 627 62812 20
909 agent claude-sonnet-5 356 63439 17
910 agent claude-sonnet-5 292 63795 20
911 agent claude-sonnet-5 139 64087 6
912 agent claude-sonnet-5 361 64226 17
913 agent claude-sonnet-5 1835 64587 20
914 agent claude-sonnet-5 282 66422 2
915 agent claude-sonnet-5 341 66704 17
916 agent claude-sonnet-5 871 67045 17
917 agent claude-sonnet-5 425 67916 20
918 agent claude-sonnet-5 139 68341 2
919 agent claude-sonnet-5 788 68480 2
920 agent claude-sonnet-5 506 69268 20
921 agent claude-sonnet-5 247 69774 2
922 agent claude-sonnet-5 262 70021 2
923 agent claude-sonnet-5 192 70283 9
924 agent claude-sonnet-5 1459 70475 3
925 agent claude-sonnet-5 623 71934 3
926 agent claude-sonnet-5 847 72557 20
927 agent claude-sonnet-5 1192 73404 20
928 agent claude-sonnet-5 146 74596 1
929 agent claude-sonnet-5 993 74742 2
930 agent claude-sonnet-5 2258 75735 20
931 agent claude-sonnet-5 183 77993 5
932 agent claude-sonnet-5 202 78176 5
933 agent claude-sonnet-5 221 78378 2
934 agent claude-sonnet-5 1107 78599 2
935 agent claude-sonnet-5 337 79706 2
936 agent claude-sonnet-5 1113 80043 2
937 agent claude-sonnet-5 1332 81156 2
938 agent claude-sonnet-5 298 82488 1
939 agent claude-sonnet-5 18065 0 4
940 agent claude-sonnet-5 2414 18065 5
941 agent claude-sonnet-5 6727 20479 7
942 agent claude-sonnet-5 1480 27206 2
943 agent claude-sonnet-5 871 28686 6
944 agent claude-sonnet-5 750 29557 5
945 agent claude-sonnet-5 669 30307 3
946 agent claude-sonnet-5 1610 30976 3
947 agent claude-sonnet-5 1888 32586 3
948 agent claude-sonnet-5 1411 34474 2
949 agent claude-sonnet-5 435 35885 4
950 agent claude-sonnet-5 2061 36320 3
951 agent claude-sonnet-5 3218 38381 3
952 agent claude-sonnet-5 1982 41599 20
953 agent claude-sonnet-5 189 43581 133
954 agent claude-sonnet-5 886 43770 6
955 agent claude-sonnet-5 13064 44656 3
956 agent claude-sonnet-5 477 57720 17
957 agent claude-sonnet-5 386 58197 17
958 agent claude-sonnet-5 732 58583 5
959 agent claude-sonnet-5 521 59315 17
960 agent claude-sonnet-5 675 59836 3
961 agent claude-sonnet-5 422 60511 2
962 agent claude-sonnet-5 637 60933 3
963 agent claude-sonnet-5 1183 61570 2
964 agent claude-sonnet-5 614 62753 20
965 agent claude-sonnet-5 329 63367 2
966 agent claude-sonnet-5 947 63696 2
967 agent claude-sonnet-5 382 64643 17
968 agent claude-sonnet-5 460 65025 17
969 agent claude-sonnet-5 515 65485 2
970 agent claude-sonnet-5 308 66000 2
971 agent claude-sonnet-5 1135 66308 2
972 agent claude-sonnet-5 1218 67443 2
973 agent claude-sonnet-5 547 68661 2
974 agent claude-sonnet-5 1411 69208 1
975 agent claude-sonnet-5 422 70619 4
976 agent claude-sonnet-5 2443 71041 3
977 agent claude-sonnet-5 2026 73484 2
978 agent claude-sonnet-5 518 75510 2
979 agent claude-sonnet-5 392 76028 3
980 agent claude-sonnet-5 210 76420 2
981 agent claude-sonnet-5 875 76630 4
982 agent claude-sonnet-5 850 77505 6
983 agent claude-sonnet-5 362 78355 3
984 agent claude-sonnet-5 8344 78717 20
985 agent claude-sonnet-5 173 87061 2
986 agent claude-sonnet-5 171 87234 2
987 agent claude-sonnet-5 184 87405 1
988 agent claude-sonnet-5 6505 11467 4
989 agent claude-sonnet-5 2407 17972 8
990 agent claude-sonnet-5 1085 20379 20
991 agent claude-sonnet-5 2201 21464 14
992 agent claude-sonnet-5 4187 23665 3
993 agent claude-sonnet-5 6190 27852 3
994 agent claude-sonnet-5 625 34042 16
995 agent claude-sonnet-5 546 34667 7
996 agent claude-sonnet-5 1171 35213 14
997 agent claude-sonnet-5 4704 36384 2
998 agent claude-sonnet-5 513 41088 1
999 agent claude-sonnet-5 345 41601 4
1000 agent claude-sonnet-5 365 41946 3
1001 agent claude-sonnet-5 292 42311 4
1002 agent claude-sonnet-5 873 42603 2
1003 agent claude-sonnet-5 771 43476 8
1004 agent claude-sonnet-5 1812 44247 6
1005 agent claude-sonnet-5 351 46059 20
1006 agent claude-sonnet-5 1965 46410 7
1007 agent claude-sonnet-5 1877 48375 5
1008 agent claude-sonnet-5 4585 50252 3
1009 agent claude-sonnet-5 15102 54837 2
1010 agent claude-sonnet-5 401 69939 17
1011 agent claude-sonnet-5 337 70340 17
1012 agent claude-sonnet-5 342 70677 17
1013 agent claude-sonnet-5 333 71019 17
1014 agent claude-sonnet-5 405 71352 3
1015 agent claude-sonnet-5 763 71757 3
1016 agent claude-sonnet-5 801 72520 3
1017 agent claude-sonnet-5 868 73321 3
1018 agent claude-sonnet-5 362 74189 2
1019 agent claude-sonnet-5 1003 74551 3
1020 agent claude-sonnet-5 671 75554 20
1021 agent claude-sonnet-5 4622 76225 1
1022 agent claude-sonnet-5 318 80847 2
1023 agent claude-sonnet-5 678 81165 3
1024 agent claude-sonnet-5 386 81843 4
1025 agent claude-sonnet-5 896 82229 2
1026 agent claude-sonnet-5 300 83125 20
1027 agent claude-sonnet-5 403 83425 9
1028 agent claude-sonnet-5 406 83828 2
1029 agent claude-sonnet-5 508 84234 3
1030 agent claude-sonnet-5 1680 84742 2
1031 agent claude-sonnet-5 782 86422 2
1032 agent claude-sonnet-5 392 87204 4
1033 agent claude-sonnet-5 6996 11467 4
1034 agent claude-sonnet-5 14432 18463 3
1035 agent claude-sonnet-5 279 32895 20
1036 agent claude-sonnet-5 5208 33174 3
1037 agent claude-sonnet-5 2505 38382 3
1038 agent claude-sonnet-5 2493 40887 2
1039 agent claude-sonnet-5 607 43380 2
1040 agent claude-sonnet-5 1671 43987 3
1041 agent claude-sonnet-5 2333 45658 3
1042 agent claude-sonnet-5 388 47991 17
1043 agent claude-sonnet-5 384 48379 17
1044 agent claude-sonnet-5 358 48763 2
1045 agent claude-sonnet-5 368 49121 2
1046 agent claude-sonnet-5 4228 49489 2
1047 agent claude-sonnet-5 864 53717 3
1048 agent claude-sonnet-5 452 54581 3
1049 agent claude-sonnet-5 190 55033 3
1050 agent claude-sonnet-5 526 55223 9
1051 agent claude-sonnet-5 3742 55749 6
1052 agent claude-sonnet-5 986 59491 2
1053 agent claude-sonnet-5 1707 60477 3
1054 agent claude-sonnet-5 2389 62184 20
1055 agent claude-sonnet-5 228 64573 2
1056 agent claude-sonnet-5 3056 64801 20
1057 agent claude-sonnet-5 139 67857 20
1058 agent claude-sonnet-5 486 67996 3
1059 agent claude-sonnet-5 2556 68482 2
1060 agent claude-sonnet-5 2288 71038 20
1061 agent claude-sonnet-5 593 73326 3
1062 agent claude-sonnet-5 3326 73919 14
1063 agent claude-sonnet-5 1540 77245 20
1064 agent claude-sonnet-5 380 78785 3
1065 agent claude-sonnet-5 536 79165 3
1066 agent claude-sonnet-5 1055 79701 2
1067 agent claude-sonnet-5 3616 80756 3
1068 agent claude-sonnet-5 489 84372 17
1069 agent claude-sonnet-5 330 84861 4
1070 agent claude-sonnet-5 4819 85191 20
1071 agent claude-sonnet-5 139 90010 20
1072 agent claude-sonnet-5 1408 90149 2
1073 agent claude-sonnet-5 345 91557 2
1074 agent claude-sonnet-5 577 91902 2
1075 agent claude-sonnet-5 1858 92479 2
1076 agent claude-sonnet-5 456 94337 3
1077 agent claude-sonnet-5 504 94793 2
1078 agent claude-sonnet-5 242 95297 1
1079 agent claude-sonnet-5 7779 11467 4
1080 agent claude-sonnet-5 11255 19246 4
1081 agent claude-sonnet-5 1283 30501 21
1082 agent claude-sonnet-5 8212 31784 8
1083 agent claude-sonnet-5 8211 39996 6
1084 agent claude-sonnet-5 4686 48207 3
1085 agent claude-sonnet-5 3345 52893 6
1086 agent claude-sonnet-5 1642 56238 2
1087 agent claude-sonnet-5 11015 57880 3
1088 agent claude-sonnet-5 5125 68895 3
1089 agent claude-sonnet-5 8440 74020 7
1090 agent claude-sonnet-5 8043 82460 7
1091 agent claude-sonnet-5 6657 90503 3
1092 agent claude-sonnet-5 16107 97160 3
1093 agent claude-sonnet-5 1238 113267 2
1094 agent claude-sonnet-5 3262 114505 2
1095 agent claude-sonnet-5 6014 117767 2
1096 agent claude-sonnet-5 7771 123781 20
1097 agent claude-sonnet-5 1120 131552 3
1098 agent claude-sonnet-5 1335 132672 20
1099 agent claude-sonnet-5 2420 134007 2
1100 agent claude-sonnet-5 330 136427 3
1101 agent claude-sonnet-5 2292 136757 7
1102 agent claude-sonnet-5 2404 139049 3
1103 agent claude-sonnet-5 744 141453 20
1104 agent claude-sonnet-5 2889 142197 1
1105 agent claude-sonnet-5 1965 145086 3
1106 agent claude-sonnet-5 1881 147051 2
1107 agent claude-sonnet-5 1364 148932 4
1108 agent claude-sonnet-5 4188 150296 3
1109 agent claude-sonnet-5 379 154484 4
1110 agent claude-sonnet-5 304 154863 3
1111 agent claude-sonnet-5 343 155167 21
1112 agent claude-sonnet-5 564 155510 20
1113 agent claude-sonnet-5 413 156074 6
1114 agent claude-sonnet-5 929 156487 2
1115 agent claude-sonnet-5 4206 157416 3
1116 agent claude-sonnet-5 211 161622 2
1117 agent claude-sonnet-5 4023 161833 1
1118 agent claude-sonnet-5 3248 165856 20
1119 agent claude-sonnet-5 768 169104 1
1120 agent claude-sonnet-5 1806 169872 2
1121 agent claude-sonnet-5 634 171678 16
1122 agent claude-sonnet-5 325 172312 3
1123 agent claude-sonnet-5 1225 172637 3
1124 agent claude-sonnet-5 737 173862 20
1125 agent claude-sonnet-5 677 174599 3
1126 agent claude-sonnet-5 425 175276 20
1127 agent claude-sonnet-5 1008 175701 4
1128 agent claude-sonnet-5 1006 176709 7
1129 agent claude-sonnet-5 2025 177715 3
1130 agent claude-sonnet-5 478 179740 263
1131 agent claude-sonnet-5 366 180218 5
1132 agent claude-sonnet-5 160 180584 8
1133 agent claude-sonnet-5 595 180744 1
1134 agent claude-sonnet-5 3514 181339 2
1135 agent claude-sonnet-5 1833 184853 5
1136 agent claude-sonnet-5 606 186686 20
1137 agent claude-sonnet-5 140 187292 20
1138 agent claude-sonnet-5 686 187432 2
1139 agent claude-sonnet-5 2005 188118 3
1140 agent claude-sonnet-5 467 190123 17
1141 agent claude-sonnet-5 284 190590 3
1142 agent claude-sonnet-5 1073 190874 3
1143 agent claude-sonnet-5 744 191947 2
1144 agent claude-sonnet-5 1906 192691 1
1145 agent claude-sonnet-5 2114 194597 2
1146 agent claude-sonnet-5 512 196711 20
1147 agent claude-sonnet-5 1891 197223 2
1148 agent claude-sonnet-5 159 199114 20
1149 agent claude-sonnet-5 3108 199273 2
1150 agent claude-sonnet-5 805 202381 4
1151 agent claude-sonnet-5 1288 203186 3
1152 agent claude-sonnet-5 1042 204474 20
1153 agent claude-sonnet-5 1095 205516 4
1154 agent claude-sonnet-5 775 206611 9
1155 agent claude-sonnet-5 943 207386 20
1156 agent claude-sonnet-5 149 208329 3
1157 agent claude-sonnet-5 2087 208478 2
1158 agent claude-sonnet-5 273 210565 20
1159 agent claude-sonnet-5 454 210838 16
1160 agent claude-sonnet-5 293 211292 6
1161 agent claude-sonnet-5 335 211585 20
1162 agent claude-sonnet-5 1408 211920 3
1163 agent claude-sonnet-5 1442 213328 20
1164 agent claude-sonnet-5 795 214770 20
1165 agent claude-sonnet-5 165 215565 20
1166 agent claude-sonnet-5 740 215730 2
1167 agent claude-sonnet-5 566 216470 2
1168 agent claude-sonnet-5 5189 217036 3
1169 agent claude-sonnet-5 1065 222225 3
1170 agent claude-sonnet-5 769 223290 2
1171 agent claude-sonnet-5 4045 224059 3
1172 agent claude-sonnet-5 3125 228104 3
1173 agent claude-sonnet-5 517 231229 20
1174 agent claude-sonnet-5 293 231746 7
1175 agent claude-sonnet-5 541 232039 1
1176 agent claude-sonnet-5 1228 232580 3
1177 agent claude-sonnet-5 1438 233808 3
1178 agent claude-sonnet-5 520 235246 8
1179 agent claude-sonnet-5 831 235766 6
1180 agent claude-sonnet-5 171 236597 20
1181 agent claude-sonnet-5 507 236768 17
1182 agent claude-sonnet-5 521 237275 3
1183 agent claude-sonnet-5 220 237796 5
1184 agent claude-sonnet-5 754 238016 20
1185 agent claude-sonnet-5 1488 238770 20
1186 agent claude-sonnet-5 294 240258 2
1187 agent claude-sonnet-5 3709 240552 20
1188 agent claude-sonnet-5 600 244261 118
1189 agent claude-sonnet-5 313 244861 3
1190 agent claude-sonnet-5 4739 245174 17
1191 agent claude-sonnet-5 767 249913 5
1192 agent claude-sonnet-5 339 250680 20
1193 agent claude-sonnet-5 320 251019 17
1194 agent claude-sonnet-5 848 251339 4
1195 agent claude-sonnet-5 3088 252187 4
1196 agent claude-sonnet-5 448 255275 20
1197 agent claude-sonnet-5 410 255723 17
1198 agent claude-sonnet-5 905 256133 14
1199 agent claude-sonnet-5 505 257038 17
1200 agent claude-sonnet-5 337 257543 21
1201 agent claude-sonnet-5 407 257880 17
1202 agent claude-sonnet-5 397 258287 5
1203 agent claude-sonnet-5 364 258684 14
1204 agent claude-sonnet-5 422 259048 17
1205 agent claude-sonnet-5 810 259470 17
1206 agent claude-sonnet-5 384 260280 4
1207 agent claude-sonnet-5 155 260664 3
1208 agent claude-sonnet-5 538 260819 3
1209 agent claude-sonnet-5 501 261357 3
1210 agent claude-sonnet-5 1056 261858 2
1211 agent claude-sonnet-5 1082 262914 3
1212 agent claude-sonnet-5 601 263996 14
1213 agent claude-sonnet-5 287 264597 20
1214 agent claude-sonnet-5 420 264884 8
1215 agent claude-sonnet-5 925 265304 5
1216 agent claude-sonnet-5 235 266229 87
1217 agent claude-sonnet-5 524 266464 1
1218 agent claude-sonnet-5 1178 266988 2
1219 agent claude-sonnet-5 430 268166 20
1220 agent claude-sonnet-5 197 268596 2
1221 agent claude-sonnet-5 455 268793 3
1222 agent claude-sonnet-5 2288 269248 3
1223 agent claude-sonnet-5 1888 271536 3
1224 agent claude-sonnet-5 285 273424 20
1225 agent claude-sonnet-5 162 273709 8
1226 agent claude-sonnet-5 179 273871 3
1227 agent claude-sonnet-5 896 274050 2
1228 agent claude-sonnet-5 1781 274946 3
1229 agent claude-sonnet-5 502 276727 20
1230 agent claude-sonnet-5 496 277229 6
1231 agent claude-sonnet-5 1105 277725 3
1232 agent claude-sonnet-5 426 278830 20
1233 agent claude-sonnet-5 1192 279256 7
1234 agent claude-sonnet-5 1477 280448 3
1235 agent claude-sonnet-5 2521 281925 2
1236 agent claude-sonnet-5 1196 284446 20
1237 agent claude-sonnet-5 795 285642 2
1238 agent claude-sonnet-5 679 286437 3
1239 agent claude-sonnet-5 691 287116 2
1240 agent claude-sonnet-5 695 287807 3
1241 agent claude-sonnet-5 230 288502 1
1242 agent claude-sonnet-5 251 288732 20
1243 agent claude-sonnet-5 486 288983 20
1244 agent claude-sonnet-5 421 289469 7
1245 agent claude-sonnet-5 1004 289890 6
1246 agent claude-sonnet-5 740 290894 6
1247 agent claude-sonnet-5 181 291634 1
1248 agent claude-haiku-4-5-20251001 12018 0 4
1249 agent claude-haiku-4-5-20251001 1533 12018 2
1250 agent claude-haiku-4-5-20251001 410 13551 1
1251 agent claude-haiku-4-5-20251001 1503 13961 2
1252 agent claude-haiku-4-5-20251001 318 15464 2
1253 agent claude-haiku-4-5-20251001 12189 0 4
1254 agent claude-haiku-4-5-20251001 1474 12189 2
1255 agent claude-haiku-4-5-20251001 568 13663 2
1256 agent claude-haiku-4-5-20251001 1376 14231 3
1257 agent claude-haiku-4-5-20251001 307 15607 2
1258 agent claude-haiku-4-5-20251001 385 15914 4
1259 agent claude-haiku-4-5-20251001 12265 0 4
1260 agent claude-haiku-4-5-20251001 2187 12265 2
1261 agent claude-haiku-4-5-20251001 318 14452 2
1262 agent claude-haiku-4-5-20251001 2066 14770 2
1263 agent claude-haiku-4-5-20251001 319 16836 4
1264 agent claude-sonnet-5 18810 0 4
1265 agent claude-sonnet-5 11044 18810 2
1266 agent claude-sonnet-5 1190 29854 17
1267 agent claude-sonnet-5 7347 31044 5
1268 agent claude-sonnet-5 2729 38391 7
1269 agent claude-sonnet-5 6461 41120 10
1270 agent claude-sonnet-5 772 47581 2
1271 agent claude-sonnet-5 654 48353 2
1272 agent claude-sonnet-5 1829 49007 2
1273 agent claude-sonnet-5 833 50836 3
1274 agent claude-sonnet-5 690 51669 119
1275 agent claude-sonnet-5 4544 52359 4
1276 agent claude-sonnet-5 941 56903 2
1277 agent claude-sonnet-5 219 57844 20
1278 agent claude-sonnet-5 2841 58063 4
1279 agent claude-sonnet-5 1659 60904 2
1280 agent claude-sonnet-5 1745 62563 5
1281 agent claude-sonnet-5 3280 64308 4
1282 agent claude-sonnet-5 218 67588 4
1283 agent claude-sonnet-5 6478 67806 17
1284 agent claude-sonnet-5 407 74284 2
1285 agent claude-sonnet-5 414 74691 17
1286 agent claude-sonnet-5 413 75105 3
1287 agent claude-sonnet-5 2583 75518 5
1288 agent claude-sonnet-5 1281 78101 20
1289 agent claude-sonnet-5 273 79382 4
1290 agent claude-sonnet-5 656 79655 3
1291 agent claude-sonnet-5 366 80311 6
1292 agent claude-sonnet-5 629 80677 2
1293 agent claude-sonnet-5 387 81306 6
1294 agent claude-sonnet-5 380 81693 2
1295 agent claude-sonnet-5 931 82073 4
1296 agent claude-sonnet-5 725 83004 5
1297 agent claude-sonnet-5 772 83729 3
1298 agent claude-sonnet-5 498 84501 3
1299 agent claude-sonnet-5 609 84999 20
1300 agent claude-sonnet-5 563 85608 5
1301 agent claude-sonnet-5 828 86171 17
1302 agent claude-sonnet-5 633 86999 17
1303 agent claude-sonnet-5 489 87632 4
1304 agent claude-sonnet-5 1414 88121 3
1305 agent claude-sonnet-5 2389 89535 1
1306 agent claude-sonnet-5 803 91924 3
1307 agent claude-sonnet-5 483 92727 8
1308 agent claude-sonnet-5 2059 93210 3
1309 agent claude-sonnet-5 996 95269 3
1310 agent claude-sonnet-5 1790 96265 3
1311 agent claude-sonnet-5 11186 98055 4
1312 agent claude-sonnet-5 499 109241 17
1313 agent claude-sonnet-5 351 109740 3
1314 agent claude-sonnet-5 309 110091 2
1315 agent claude-sonnet-5 674 110400 2
1316 agent claude-sonnet-5 949 111074 7
1317 agent claude-sonnet-5 10406 112023 20
1318 agent claude-sonnet-5 943 122429 2
1319 agent claude-sonnet-5 3396 123372 3
1320 agent claude-sonnet-5 2180 126768 3
1321 agent claude-sonnet-5 757 128948 2
1322 agent claude-sonnet-5 439 129705 17
1323 agent claude-sonnet-5 348 130144 2
1324 agent claude-sonnet-5 445 130492 1
1325 agent claude-sonnet-5 332 130937 5
1326 agent claude-sonnet-5 303 131269 3
1327 agent claude-sonnet-5 4186 131572 2
1328 agent claude-sonnet-5 1457 135758 3
1329 agent claude-sonnet-5 344 137215 21
1330 agent claude-sonnet-5 3947 137559 8
1331 agent claude-sonnet-5 4349 141506 5
1332 agent claude-sonnet-5 2988 145855 3
1333 agent claude-sonnet-5 1280 148843 2
1334 agent claude-sonnet-5 1833 150123 20
1335 agent claude-sonnet-5 292 151956 2
1336 agent claude-sonnet-5 417 152248 7
1337 agent claude-sonnet-5 564 152665 210
1338 agent claude-sonnet-5 336 153229 20
1339 agent claude-sonnet-5 1008 153565 3
1340 agent claude-sonnet-5 444 154573 20
1341 agent claude-sonnet-5 683 155017 20
1342 agent claude-sonnet-5 365 155700 5
1343 agent claude-sonnet-5 4529 156065 2
1344 agent claude-sonnet-5 700 160594 20
1345 agent claude-sonnet-5 756 161294 2
1346 agent claude-sonnet-5 357 162050 20
1347 agent claude-sonnet-5 438 162407 6
1348 agent claude-sonnet-5 331 162845 3
1349 agent claude-sonnet-5 397 163176 2
1350 agent claude-sonnet-5 697 163573 20
1351 agent claude-sonnet-5 148 164270 2
1352 agent claude-sonnet-5 478 164418 1
1353 agent claude-sonnet-5 1105 164896 2
1354 agent claude-sonnet-5 13537 166001 6
1355 agent claude-sonnet-5 976 179538 3
1356 agent claude-sonnet-5 3580 180514 20
1357 agent claude-sonnet-5 295 184094 5
1358 agent claude-sonnet-5 179 184389 5
1359 agent claude-sonnet-5 4366 184568 4
1360 agent claude-sonnet-5 6793 188934 7
1361 agent claude-sonnet-5 176 195727 2
1362 agent claude-sonnet-5 875 195903 2
1363 agent claude-sonnet-5 335 196778 4
1364 agent claude-sonnet-5 254 197113 2
1365 agent claude-sonnet-5 307 197367 3
1366 agent claude-sonnet-5 2855 197674 20
1367 agent claude-sonnet-5 783 200529 10
1368 agent claude-sonnet-5 1947 201312 3
1369 agent claude-sonnet-5 201 203259 3
1370 agent claude-sonnet-5 407 203460 5
1371 agent claude-sonnet-5 352 203867 20
1372 agent claude-sonnet-5 170 204219 21
1373 agent claude-sonnet-5 351 204389 3
1374 agent claude-sonnet-5 555 204740 20
1375 agent claude-sonnet-5 1160 205295 1
1376 agent claude-sonnet-5 430 206455 20
1377 agent claude-sonnet-5 790 206885 2
1378 agent claude-sonnet-5 3277 207675 2
1379 agent claude-sonnet-5 981 210952 5
1380 agent claude-sonnet-5 452 211933 4
1381 agent claude-sonnet-5 581 212385 4
1382 agent claude-sonnet-5 1537 212966 20
1383 agent claude-sonnet-5 356 214503 1
1384 agent claude-sonnet-5 830 214859 4
1385 agent claude-sonnet-5 3505 215689 1
1386 agent claude-sonnet-5 265 219194 4
1387 agent claude-sonnet-5 428 219459 3
1388 agent claude-sonnet-5 611 219887 4
1389 agent claude-sonnet-5 898 220498 1
1390 agent claude-sonnet-5 18657 0 4
1391 agent claude-sonnet-5 6923 18657 2
1392 agent claude-sonnet-5 1441 25580 5
1393 agent claude-sonnet-5 18180 27021 8
1394 agent claude-sonnet-5 11808 45201 2
1395 agent claude-sonnet-5 16534 57009 7
1396 agent claude-sonnet-5 0 86308 4
1397 agent claude-sonnet-5 8195 86308 4
1398 agent claude-sonnet-5 587 94503 5
1399 agent claude-sonnet-5 1121 95090 20
1400 agent claude-sonnet-5 5815 96211 14
1401 agent claude-sonnet-5 5546 102026 3
1402 agent claude-sonnet-5 14817 107572 10
1403 agent claude-sonnet-5 5333 122389 6
1404 agent claude-sonnet-5 6825 127722 2
1405 agent claude-sonnet-5 13707 134547 2
1406 agent claude-sonnet-5 1862 148254 20
1407 agent claude-sonnet-5 1030 150116 20
1408 agent claude-sonnet-5 324 151146 16
1409 agent claude-sonnet-5 303 151470 20
1410 agent claude-sonnet-5 488 151773 2
1411 agent claude-sonnet-5 2995 152261 20
1412 agent claude-sonnet-5 1270 155256 20
1413 agent claude-sonnet-5 360 156526 2
1414 agent claude-sonnet-5 3421 156886 3
1415 agent claude-sonnet-5 1844 160307 20
1416 agent claude-sonnet-5 890 162151 2
1417 agent claude-sonnet-5 537 163041 5
1418 agent claude-sonnet-5 655 163578 2
1419 agent claude-sonnet-5 1316 164233 3
1420 agent claude-sonnet-5 621 165549 3
1421 agent claude-sonnet-5 455 166170 2
1422 agent claude-sonnet-5 197 166625 3
1423 agent claude-sonnet-5 2266 166822 5
1424 agent claude-sonnet-5 4100 169088 2
1425 agent claude-sonnet-5 3844 173188 2
1426 agent claude-sonnet-5 799 177032 2
1427 agent claude-sonnet-5 2996 177831 3
1428 agent claude-sonnet-5 592 180827 2
1429 agent claude-sonnet-5 199 181419 2
1430 agent claude-sonnet-5 2582 181618 3
1431 agent claude-sonnet-5 443 184200 17
1432 agent claude-sonnet-5 511 184643 2
1433 agent claude-sonnet-5 1832 185154 20
1434 agent claude-sonnet-5 1206 186986 4
1435 agent claude-sonnet-5 1052 188192 17
1436 agent claude-sonnet-5 628 189244 20
1437 agent claude-sonnet-5 323 189872 2
1438 agent claude-sonnet-5 2777 190195 4
1439 agent claude-sonnet-5 828 192972 17
1440 agent claude-sonnet-5 1271 193800 3
1441 agent claude-sonnet-5 4954 195071 125
1442 agent claude-sonnet-5 321 200025 2
1443 agent claude-sonnet-5 585 200346 9
1444 agent claude-sonnet-5 3273 200931 5
1445 agent claude-sonnet-5 3175 204204 17
1446 agent claude-sonnet-5 1030 207379 2
1447 agent claude-sonnet-5 1422 208409 4
1448 agent claude-sonnet-5 673 209831 4
1449 agent claude-sonnet-5 552 210504 3
1450 agent claude-sonnet-5 2540 211056 2
1451 agent claude-sonnet-5 543 213596 17
1452 agent claude-sonnet-5 325 214139 2
1453 agent claude-sonnet-5 985 214464 20
1454 agent claude-sonnet-5 390 215449 16
1455 agent claude-sonnet-5 497 215839 2
1456 agent claude-sonnet-5 563 216336 2
1457 agent claude-sonnet-5 2503 216899 7
1458 agent claude-sonnet-5 2546 219402 6
1459 agent claude-sonnet-5 4454 221948 3
1460 agent claude-sonnet-5 11324 226402 3
1461 agent claude-sonnet-5 650 237726 3
1462 agent claude-sonnet-5 1019 238376 20
1463 agent claude-sonnet-5 541 239395 5
1464 agent claude-sonnet-5 752 239936 117
1465 agent claude-sonnet-5 172 240688 2
1466 agent claude-sonnet-5 627 240860 2
1467 agent claude-sonnet-5 1011 241487 1
1468 agent claude-sonnet-5 3290 242498 4
1469 agent claude-sonnet-5 1887 245788 8
1470 agent claude-sonnet-5 217 247675 1
1471 agent claude-sonnet-5 294 247892 4
1472 agent claude-sonnet-5 512 248186 20
1473 agent claude-sonnet-5 241 248698 3
1474 agent claude-sonnet-5 537 248939 20
1475 agent claude-sonnet-5 202 249476 8
1476 agent claude-sonnet-5 3893 249678 3
1477 agent claude-sonnet-5 1816 253571 17
1478 agent claude-sonnet-5 493 255387 2
1479 agent claude-sonnet-5 354 255880 4
1480 agent claude-sonnet-5 906 256234 3
1481 agent claude-sonnet-5 1373 257140 6
1482 agent claude-sonnet-5 697 258513 2
1483 agent claude-sonnet-5 878 259210 2
1484 agent claude-sonnet-5 833 260088 5
1485 agent claude-sonnet-5 1108 260921 2
1486 agent claude-sonnet-5 874 262029 6
1487 agent claude-sonnet-5 943 262903 20
1488 agent claude-sonnet-5 478 263846 4
1489 agent claude-sonnet-5 6885 11467 5
1490 agent claude-sonnet-5 2407 18352 5
1491 agent claude-sonnet-5 2928 20759 20
1492 agent claude-sonnet-5 10180 23687 2
1493 agent claude-sonnet-5 4571 33867 3
1494 agent claude-sonnet-5 2405 38438 2
1495 agent claude-sonnet-5 1941 40843 2
1496 agent claude-sonnet-5 2818 42784 2
1497 agent claude-sonnet-5 2409 45602 3
1498 agent claude-sonnet-5 12171 48011 2
1499 agent claude-sonnet-5 6436 60182 4
1500 agent claude-sonnet-5 6550 66618 8
1501 agent claude-sonnet-5 1871 73168 20
1502 agent claude-sonnet-5 395 75039 20
1503 agent claude-sonnet-5 2174 75434 9
1504 agent claude-sonnet-5 369 77608 20
1505 agent claude-sonnet-5 785 77977 2
1506 agent claude-sonnet-5 2325 78762 2
1507 agent claude-sonnet-5 757 81087 20
1508 agent claude-sonnet-5 632 81844 2
1509 agent claude-sonnet-5 470 82476 17
1510 agent claude-sonnet-5 1960 82946 5
1511 agent claude-sonnet-5 931 84906 3
1512 agent claude-sonnet-5 4409 85837 10
1513 agent claude-sonnet-5 2424 90246 3
1514 agent claude-sonnet-5 2366 92670 3
1515 agent claude-sonnet-5 289 95036 9
1516 agent claude-sonnet-5 7082 95325 5
1517 agent claude-sonnet-5 980 102407 3
1518 agent claude-sonnet-5 1345 103387 6
1519 agent claude-sonnet-5 1659 104732 20
1520 agent claude-sonnet-5 857 106391 2
1521 agent claude-sonnet-5 2234 107248 4
1522 agent claude-sonnet-5 2345 109482 2
1523 agent claude-sonnet-5 1476 111827 7
1524 agent claude-sonnet-5 2001 113303 3
1525 agent claude-sonnet-5 12239 115304 5
1526 agent claude-sonnet-5 333 127543 3
1527 agent claude-sonnet-5 1833 127876 2
1528 agent claude-sonnet-5 1143 129709 2
1529 agent claude-sonnet-5 1321 130852 20
1530 agent claude-sonnet-5 452 132173 2
1531 agent claude-sonnet-5 609 132625 20
1532 agent claude-sonnet-5 701 133234 2
1533 agent claude-sonnet-5 410 133935 2
1534 agent claude-sonnet-5 684 134345 2
1535 agent claude-sonnet-5 958 135029 2
1536 agent claude-sonnet-5 805 135987 7
1537 agent claude-sonnet-5 4206 136792 8
1538 agent claude-sonnet-5 1187 140998 2
1539 agent claude-sonnet-5 905 142185 2
1540 agent claude-sonnet-5 1867 143090 2
1541 agent claude-sonnet-5 1974 144957 5
1542 agent claude-sonnet-5 747 146931 17
1543 agent claude-sonnet-5 1070 147678 3
1544 agent claude-sonnet-5 439 148748 17
1545 agent claude-sonnet-5 519 149187 6
1546 agent claude-sonnet-5 862 149706 7
1547 agent claude-sonnet-5 649 150568 2
1548 agent claude-sonnet-5 644 151217 7
1549 agent claude-sonnet-5 1108 151861 7
1550 agent claude-sonnet-5 10981 152969 3
1551 agent claude-sonnet-5 1024 163950 5
1552 agent claude-sonnet-5 2476 164974 17
1553 agent claude-sonnet-5 778 167450 17
1554 agent claude-sonnet-5 377 168228 17
1555 agent claude-sonnet-5 435 168605 2
1556 agent claude-sonnet-5 308 169040 3
1557 agent claude-sonnet-5 594 169348 2
1558 agent claude-sonnet-5 262 169942 17
1559 agent claude-sonnet-5 737 170204 17
1560 agent claude-sonnet-5 336 170941 17
1561 agent claude-sonnet-5 394 171277 2
1562 agent claude-sonnet-5 635 171671 2
1563 agent claude-sonnet-5 421 172306 2
1564 agent claude-sonnet-5 613 172727 2
1565 agent claude-sonnet-5 200 173340 5
1566 agent claude-sonnet-5 505 173540 1
1567 agent claude-sonnet-5 986 174045 1
1568 agent claude-sonnet-5 449 175031 1
1569 agent claude-sonnet-5 1809 175480 2
1570 agent claude-sonnet-5 421 177289 20
1571 agent claude-sonnet-5 1473 177710 3
1572 agent claude-sonnet-5 1201 179183 3
1573 agent claude-sonnet-5 1716 180384 3
1574 agent claude-sonnet-5 561 182100 4
1575 agent claude-sonnet-5 275 182661 3
1576 agent claude-sonnet-5 617 182936 4
1577 agent claude-sonnet-5 349 183553 2
1578 agent claude-sonnet-5 397 183902 2
1579 agent claude-sonnet-5 1537 184299 2
1580 agent claude-sonnet-5 709 185836 1
1581 agent claude-opus-5 40973 0 1
1582 agent claude-opus-5 1588 40973 28
1583 agent claude-opus-5 18276 42561 3
1584 agent claude-sonnet-5 6720 11467 5
1585 agent claude-sonnet-5 2662 18187 2
1586 agent claude-sonnet-5 1826 20849 20
1587 agent claude-sonnet-5 4011 22675 2
1588 agent claude-sonnet-5 4749 26686 3
1589 agent claude-sonnet-5 4603 31435 6
1590 agent claude-sonnet-5 3647 36038 167
1591 agent claude-sonnet-5 3173 39685 3
1592 agent claude-sonnet-5 5057 42858 3
1593 agent claude-sonnet-5 4059 47915 3
1594 agent claude-sonnet-5 8819 51974 3
1595 agent claude-sonnet-5 1121 60793 5
1596 agent claude-sonnet-5 834 61914 20
1597 agent claude-sonnet-5 365 62748 5
1598 agent claude-sonnet-5 803 63113 17
1599 agent claude-sonnet-5 718 63916 17
1600 agent claude-sonnet-5 743 64634 2
1601 agent claude-sonnet-5 833 65377 17
1602 agent claude-sonnet-5 751 66210 4
1603 agent claude-sonnet-5 790 66961 17
1604 agent claude-sonnet-5 695 67751 17
1605 agent claude-sonnet-5 666 68446 4
1606 agent claude-sonnet-5 786 69112 2
1607 agent claude-sonnet-5 654 69898 2
1608 agent claude-sonnet-5 3261 70552 8
1609 agent claude-sonnet-5 262 73813 1
1610 agent claude-sonnet-5 743 74075 1
1611 agent claude-sonnet-5 320 74818 4
1612 agent claude-sonnet-5 475 75138 9
1613 agent claude-sonnet-5 510 75613 7
1614 agent claude-sonnet-5 194 76123 2
1615 agent claude-haiku-4-5-20251001 12344 0 4
1616 agent claude-haiku-4-5-20251001 1735 12344 2
1617 agent claude-haiku-4-5-20251001 443 14079 2
1618 agent claude-haiku-4-5-20251001 1767 14522 2
1619 agent claude-haiku-4-5-20251001 312 16289 2
1620 agent claude-sonnet-5 18565 0 4
1621 agent claude-sonnet-5 3891 18565 2
1622 agent claude-sonnet-5 19182 22456 2
1623 agent claude-sonnet-5 675 41638 2
1624 agent claude-sonnet-5 185 42313 20
1625 agent claude-sonnet-5 1064 42498 20
1626 agent claude-sonnet-5 533 43562 2
1627 agent claude-sonnet-5 1503 44095 20
1628 agent claude-sonnet-5 294 45598 2
1629 agent claude-sonnet-5 1359 45892 20
1630 agent claude-sonnet-5 453 47251 2
1631 agent claude-sonnet-5 344 47704 17
1632 agent claude-sonnet-5 1301 48048 20
1633 agent claude-sonnet-5 492 49349 2
1634 agent claude-sonnet-5 546 49841 2
1635 agent claude-sonnet-5 1201 50387 20
1636 agent claude-sonnet-5 563 51588 2
1637 agent claude-sonnet-5 336 52151 17
1638 agent claude-sonnet-5 716 52487 17
1639 agent claude-sonnet-5 532 53203 20
1640 agent claude-sonnet-5 636 53735 2
1641 agent claude-sonnet-5 715 54371 20
1642 agent claude-sonnet-5 273 55086 2
1643 agent claude-sonnet-5 338 55359 2
1644 agent claude-sonnet-5 347 55697 3
1645 agent claude-sonnet-5 1121 56044 20
1646 agent claude-sonnet-5 622 57165 3
1647 agent claude-sonnet-5 282 57787 3
1648 agent claude-sonnet-5 1064 58069 2
1649 agent claude-sonnet-5 250 59133 2
1650 agent claude-sonnet-5 2914 59383 20
1651 agent claude-sonnet-5 388 62297 9
1652 agent claude-sonnet-5 405 62685 3
1653 agent claude-sonnet-5 222 63090 2
1654 agent claude-sonnet-5 335 63312 3
1655 agent claude-sonnet-5 1858 63647 20
1656 agent claude-sonnet-5 476 65505 2
1657 agent claude-sonnet-5 654 65981 20
1658 agent claude-sonnet-5 544 66635 2
1659 agent claude-sonnet-5 855 67179 20
1660 agent claude-sonnet-5 292 68034 2
1661 agent claude-sonnet-5 1074 68326 20
1662 agent claude-sonnet-5 594 69400 2
1663 agent claude-sonnet-5 334 69994 4
1664 agent claude-sonnet-5 738 70328 2
1665 agent claude-sonnet-5 217 71066 6
1666 agent claude-sonnet-5 433 71283 4
1667 agent claude-sonnet-5 508 71716 2
1668 agent claude-sonnet-5 486 72224 2
1669 agent claude-sonnet-5 306 72710 1
1670 agent claude-haiku-4-5-20251001 12173 0 4
1671 agent claude-haiku-4-5-20251001 2587 12173 2
1672 agent claude-haiku-4-5-20251001 739 14760 2
1673 agent claude-haiku-4-5-20251001 2923 15499 3
1674 agent claude-haiku-4-5-20251001 306 18422 4
1675 agent claude-sonnet-5 7265 11467 7
1676 agent claude-sonnet-5 2392 18732 2
1677 agent claude-sonnet-5 3930 21124 9
1678 agent claude-sonnet-5 613 25054 20
1679 agent claude-sonnet-5 638 25667 2
1680 agent claude-sonnet-5 332 26305 2
1681 agent claude-sonnet-5 395 26637 20
1682 agent claude-sonnet-5 5140 27032 3
1683 agent claude-sonnet-5 5554 32172 3
1684 agent claude-sonnet-5 3298 37726 3
1685 agent claude-sonnet-5 5111 41024 4
1686 agent claude-sonnet-5 1407 46135 21
1687 agent claude-sonnet-5 807 47542 6
1688 agent claude-sonnet-5 4367 48349 2
1689 agent claude-sonnet-5 8386 52716 4
1690 agent claude-sonnet-5 10713 61102 3
1691 agent claude-sonnet-5 1286 71815 3
1692 agent claude-sonnet-5 1025 73101 3
1693 agent claude-sonnet-5 1258 74126 3
1694 agent claude-sonnet-5 369 75384 17
1695 agent claude-sonnet-5 494 75753 7
1696 agent claude-sonnet-5 564 76247 1
1697 agent claude-sonnet-5 506 76811 6
1698 agent claude-sonnet-5 740 77317 3
1699 agent claude-sonnet-5 647 78057 4
1700 agent claude-sonnet-5 3060 78704 20
1701 agent claude-sonnet-5 5596 81764 2
1702 agent claude-sonnet-5 4467 87360 6
1703 agent claude-sonnet-5 9937 91827 3
1704 agent claude-sonnet-5 595 101764 3
1705 agent claude-sonnet-5 2080 102359 3
1706 agent claude-sonnet-5 797 104439 3
1707 agent claude-sonnet-5 595 105236 20
1708 agent claude-sonnet-5 410 105831 20
1709 agent claude-sonnet-5 263 106241 17
1710 agent claude-sonnet-5 496 106504 7
1711 agent claude-sonnet-5 570 107000 2
1712 agent claude-sonnet-5 1038 107570 3
1713 agent claude-sonnet-5 859 108608 8
1714 agent claude-sonnet-5 3897 109467 8
1715 agent claude-sonnet-5 1804 113364 4
1716 agent claude-sonnet-5 389 115168 14
1717 agent claude-sonnet-5 1419 115557 2
1718 agent claude-sonnet-5 566 116976 3
1719 agent claude-sonnet-5 929 117542 3
1720 agent claude-sonnet-5 1087 118471 3
1721 agent claude-sonnet-5 380 119558 16
1722 agent claude-sonnet-5 435 119938 3
1723 agent claude-sonnet-5 738 120373 5
1724 agent claude-sonnet-5 2433 121111 2
1725 agent claude-sonnet-5 682 123544 2
1726 agent claude-sonnet-5 460 124226 3
1727 agent claude-sonnet-5 785 124686 17
1728 agent claude-sonnet-5 602 125471 3
1729 agent claude-sonnet-5 800 126073 6
1730 agent claude-sonnet-5 2127 126873 4
1731 agent claude-sonnet-5 980 129000 6
1732 agent claude-sonnet-5 634 129980 8
1733 agent claude-sonnet-5 1348 130614 3
1734 agent claude-sonnet-5 550 131962 4
1735 agent claude-sonnet-5 970 132512 2
1736 agent claude-sonnet-5 2658 133482 7
1737 agent claude-sonnet-5 668 136140 3
1738 agent claude-sonnet-5 665 136808 4
1739 agent claude-sonnet-5 495 137473 7
1740 agent claude-sonnet-5 1127 137968 3
1741 agent claude-sonnet-5 776 139095 2
1742 agent claude-sonnet-5 477 139871 3
1743 agent claude-sonnet-5 670 140348 2
1744 agent claude-sonnet-5 1646 141018 2
1745 agent claude-sonnet-5 1490 142664 2
1746 agent claude-sonnet-5 567 144154 17
1747 agent claude-sonnet-5 357 144721 5
1748 agent claude-sonnet-5 589 145078 3
1749 agent claude-sonnet-5 3118 145667 9
1750 agent claude-sonnet-5 283 148785 16
1751 agent claude-sonnet-5 1282 149068 2
1752 agent claude-sonnet-5 1437 150350 3
1753 agent claude-sonnet-5 806 151787 2
1754 agent claude-sonnet-5 4659 152593 3
1755 agent claude-sonnet-5 1246 157252 3
1756 agent claude-sonnet-5 1127 158498 3
1757 agent claude-sonnet-5 1949 159625 3
1758 agent claude-sonnet-5 2773 161574 4
1759 agent claude-sonnet-5 1137 164347 20
1760 agent claude-sonnet-5 3649 165484 3
1761 agent claude-sonnet-5 3278 169133 4
1762 agent claude-sonnet-5 2556 172411 3
1763 agent claude-sonnet-5 998 174967 6
1764 agent claude-sonnet-5 5284 175965 3
1765 agent claude-sonnet-5 4558 181249 20
1766 agent claude-sonnet-5 2655 185807 5
1767 agent claude-sonnet-5 3725 188462 3
1768 agent claude-sonnet-5 4303 192187 3
1769 agent claude-sonnet-5 1037 196490 5
1770 agent claude-sonnet-5 1137 197527 3
1771 agent claude-sonnet-5 4067 198664 3
1772 agent claude-sonnet-5 426 202731 20
1773 agent claude-sonnet-5 1135 203157 2
1774 agent claude-sonnet-5 1416 204292 1
1775 agent claude-sonnet-5 215 205708 20
1776 agent claude-sonnet-5 209 205923 20
1777 agent claude-sonnet-5 2986 206132 3
1778 agent claude-sonnet-5 1188 209118 20
1779 agent claude-sonnet-5 1172 210306 8
1780 agent claude-sonnet-5 457 211478 8
1781 agent claude-sonnet-5 224 211935 5
1782 agent claude-sonnet-5 227 212159 2
1783 agent claude-sonnet-5 342 212386 9
1784 agent claude-sonnet-5 470 212728 4
1785 agent claude-sonnet-5 1813 213198 2
-->
<!-- /cout -->

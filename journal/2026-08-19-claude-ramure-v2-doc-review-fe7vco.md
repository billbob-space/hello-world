# 2026-08-19 — claude/ramure-v2-doc-review-fe7vco

Branche : `claude/ramure-v2-doc-review-fe7vco`
Périmètre : ramure-v2
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


# 2026-08-05 — claude/ramure-v2-analysis-jplxn1

Branche : `claude/ramure-v2-analysis-jplxn1`
Périmètre : ramure-v2
Mode : `chaud`

## Anomalies

### 1. Supprimer le plan monolithique a emporté les vingt et une tâches que la série ne couvrait pas

**Symptome** — l'utilisateur signale que le PRD de `ramure-v2` semble perdu.
L'inventaire de l'historique montre deux suppressions distinctes, et une seule
est bénigne. `docs/PRD-RAMURE.md` (625 lignes, supprimé le 4 août par 598111b)
est **identique octet pour octet** à `apps/ramure/PRODUCT.md` : rien de perdu,
un déplacement. En revanche `docs/superpowers/plans/2026-08-03-ramure-v2.md`
(2282 lignes, supprimé le 5 août par 7de0c51) portait **25 tâches**, alors que
la série de PRP qui l'a remplacé n'en couvrait que 4 — les PRP 01 et 02. Les
tâches 5 à 25 — sources, arbre, canevas, écrans, collection, accessibilité,
recette, branchement — ne vivaient plus que dans l'historique git.

**Cause** — le commit de suppression a raisonné sur la **redondance** des deux
documents (« deux plans concurrents pour une app qui n'a pas une ligne de
code ») sans vérifier leur **couverture respective**. Les deux décrivaient bien
le même périmètre, mais à des profondeurs différentes : le plan monolithique
couvrait 25 tâches à faible densité, la série 4 tâches à très forte densité. Le
README de la série annonçait d'ailleurs les sept PRP restants comme « à venir »,
ce qui rendait la perte invisible : il n'y avait rien de cassé à voir, seulement
un travail à refaire que personne ne savait déjà fait.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — un contrôle possible : `--check` refuse la
suppression d'un document `docs/` ou `apps/*/prp/` dont le contenu n'est pas
couvert par les documents qui le remplacent. Difficile à écrire honnêtement
(« couvert » n'est pas mécanisable), donc à défaut : quand un document en
remplace un autre, la section `Provenance` du remplaçant doit dire **ce qui du
document supprimé n'a pas été repris**. Celle du README de la série disait
« le contenu qui comptait est ici », ce qui était faux et invérifiable.

### 2. Le plan d'origine décrivait des signatures que ses propres tests contredisaient

**Symptome** — trois divergences relevées en convertissant les tâches
récupérées. `Resoudre(ctx, nom)` n'avait pas de paramètre de portée, mais son
test n° 4 exigeait `budget.ErrPorteeInterdite` sur un appel en portée
`Entourage` — donc un argument que la signature ne portait pas. L'interface
`Proximite` passait un nom, alors que ListenBrainz **exige un MBID** : le repli
prévu contre le risque §14 était inutilisable tel qu'écrit. Et `routes()`
restait sans argument alors que `/api/centre` a besoin de sources injectées.

**Cause** — le plan monolithique a été écrit **avant** les PRP 01 et 02, qui ont
figé des conventions qu'il ne pouvait pas connaître : « la portée vient du site
d'appel, jamais d'une valeur par défaut », et « le PRP qui greffe le premier
tranche pour tous ». Un document de plan vieillit dès qu'un document plus précis
est écrit à côté de lui, et rien ne le signale.

**Detecte par** — `auteur`

**Action** — `rien` — les trois divergences sont tranchées dans les PRP 03 et
04, et consignées dans la section `Provenance` du README de la série, avec leur
raison. Aucun artefact de fabrique n'est en cause.

### 3. Deux sessions ont travaillé le même produit le même jour sans se voir

**Symptome** — l'analyse initiale de l'app a trouvé que `ramure-v2` réécrit un
produit déjà livré. `apps/ramure` couvre pratiquement tout le PRD — son code
cite F-01 à F-42 et N-01 à N-13, lot V2 partiellement compris — et tourne en
ligne. Le PRP 02 de `ramure-v2` spécifie un cache mutualisé, un budget d'appels
et une correspondance stricte des noms qui existent déjà dans `cache.go`,
`nom.go` et `mesures.go` de `apps/ramure`. La chronologie est serrée : plan v2
committé à 10 h 15, première version de l'app à 10 h 17, le même 3 août.

**Cause** — deux branches ouvertes en parallèle sur le même PRD, l'une en mode
planification, l'autre en mode réalisation, sans qu'aucun artefact du dépôt ne
les relie. Le contrat impose une entrée de journal par branche mais rien qui
signale « une autre branche travaille déjà ce périmètre ».

**Detecte par** — `auteur`

**Action** — `arbitrage` — poursuivre la réécriture ou reporter les trois écarts
réels sur `apps/ramure` (palier `google`, collection persistante, choix de
fournisseur du rôle 1) est une décision de produit, pas un correctif. La
décision prise sur cette branche est de poursuivre la série ; la note est
conservée pour que le coût soit connu.

### 4. La série de PRP décrivait une fabrique qui n'existe plus

**Symptome** — vérification des neuf PRP contre la fabrique réelle, échafaudage
rejoué dans une copie du dépôt. Quatre affirmations sont fausses aujourd'hui, et
la première **fait échouer** le premier contrôle du premier PRP : le test de la
tâche 1 cherche `"ramure-v2"` dans `.github/workflows/build.yml`, or ce fichier
ne cite plus aucune app — il découvre la liste à chaque run en cherchant les
`apps/*/app.yml` (vérifié : zéro occurrence de `ramure`, `cadran`, `ardoise`,
`hello-world`). Les trois autres : le workflow et `.claude/` y sont présentés
comme des artefacts régénérés par `./init.sh` alors que le contrat ne réécrit
plus que `compose.yaml` et `go.work` ; le module est épinglé à `go 1.23` et
l'étage de construction à `golang:1.23-alpine` alors que les cinq apps du dépôt,
`go.work` et le toolchain local sont en 1.24 ; et le plafond de 200 Mo est
présenté comme un refus de CI alors que le job `build` n'émet qu'un
`::warning::`.

**Cause** — les PRP 01 et 02 ont été écrits le 3 août ; le workflow a cessé
d'être généré et de citer les apps ensuite. Un document de plan ne se
revalide jamais tout seul : `--check` vérifie les liens morts et les titres en
double, pas les affirmations qu'un document porte sur le dépôt. Plus la série
est précise — et celle-ci l'est beaucoup — plus elle a de surface à périmer.

**Detecte par** — `auteur`

**Action** — `garde-fou` — les quatre sont corrigées et la correction est
consignée dans le README de la série. Le garde-fou qui manque serait un contrôle
des **blocs de commande** cités par les documents : ceux des PRP sont exécutables
et auraient été pris en défaut immédiatement. À défaut, la règle de conduite :
rejouer l'échafaudage dans une copie du dépôt avant d'exécuter un PRP écrit plus
d'une semaine plus tôt — c'est ce qui a trouvé les quatre.

### 5. Sept vérifications de la série exigent un démon Docker, absent des sessions cloud

**Symptome** — `docker --version` répond (29.3.1), `docker info` échoue :
`/var/run/docker.sock` n'existe pas. Or les PRP 01, 05, 07 et 09 fondent des
étapes entières sur `docker build`, `docker run`, `docker image inspect` et
`docker buildx imagetools inspect` — taille de l'image, uid effectif, présence
de `wget`, conteneur sain, arrêt propre sur `SIGTERM`, survie de la collection à
un redémarrage, image publiée. Le PRP 01 portait déjà une note pour sa tâche 7 ;
les six autres cas n'en avaient aucune.

**Cause** — les PRP ont été écrits comme si le poste d'exécution était un poste
de développement ordinaire. `memory/outillage.md` documente déjà que `docker
build` échoue ici sur le certificat du proxy, mais suppose un démon qui tourne :
la marche d'avant — il n'y en a pas — n'était écrite nulle part.

**Detecte par** — `auteur`

**Action** — `contrat` — le README de la série porte désormais un tableau des
sept vérifications et de ce qui les remplace, avec les trois qui ne sont
remplacées par rien. Le même trou vaut pour toute app de la fabrique :
`memory/outillage.md` gagnerait à dire d'emblée qu'une session cloud n'a pas de
démon Docker, avant d'expliquer comment contourner le proxy.

### 6. La fabrique ne déclare qu'un langage par app, ramure-v2 en aura deux

**Symptome** — le champ `stack:` d'`app.yml` prend une seule valeur, et c'est
lui qui fait installer un serveur de langage. `ramure-v2` sera Go côté serveur et
TypeScript côté client (PRP 05) : le TypeScript s'écrira sans assistance de
langage, et `--check` ne le signalera pas — il ne réclame que les plugins des
`stack:` déclarées.

**Cause** — `stack:` sert deux choses à la fois : documenter le langage
principal de l'app et piloter l'outillage de l'agent. Une app polyglotte casse
cette confusion, et aucune app de la fabrique n'était encore dans ce cas.

**Detecte par** — `auteur`

**Action** — `outillage` — le PRP 05 porte désormais le geste explicite (ajouter
`typescript-lsp` à `.claude/settings.json`, recoller `cloud-setup.sh`). La vraie
correction serait un `stack:` acceptant une liste ; elle n'est pas faite, et
elle vaut pour toute app qui mêlerait deux langages.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-05 à 14:37 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 321 | 0,00 $ |
| Écriture de cache | 534 401 | 3,34 $ |
| Lecture de cache | 28 957 531 | 14,48 $ |
| Sortie | 196 313 | 4,91 $ |
| **Total** | **29 688 566** | **22,73 $ — 19,74 €** |

<!-- cout-total: 29688566 -->
<!-- /cout -->

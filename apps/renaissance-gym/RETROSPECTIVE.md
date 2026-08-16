# Rétrospective — la fabrication de `renaissance-gym`

Reconstituée le 2026-08-16 depuis `journal/2026-08-14-claude-gym-la-renaissance-app-xpgswt.md`
(29 anomalies, bloc de coût détaillé appel par appel), l'historique de `main`, et
l'état livré de `apps/renaissance-gym/`.

Ce document juge une fabrication, pas une application. Ce qui est livré marche :
345 tests JS et les tests Go passent, l'app est en ligne, la gymnaste s'en sert.
La question posée ici est **ce que la même livraison aurait coûté en s'y prenant
autrement**, et **ce qui aurait pu être vu plus tôt**.

---

## 1. Les faits

| | |
|---|---|
| Branche | `claude/gym-la-renaissance-app-xpgswt`, 2026-08-14 → 2026-08-16 |
| Commits (hors fusions et déploiements) | 27 |
| Pull requests | 12 (#118 → #129) |
| Déploiements | 7 |
| Appels au modèle | 2 433, dont 1 819 par des sous-agents |
| Coût relevé | **266,26 $ — 231,23 €**, 559 M jetons |
| Livré | PRD (64 Ko) + 8 PRP (76 Ko) + `README` + `DESIGN.md` + 345 tests JS + tests Go |
| Ajouts après les PRP | **20 capacités** (A1 → A20) |
| Anomalies consignées | 29 |

**C'est la branche la plus chère du dépôt**, de loin : 266 $ contre 138 $ pour la
deuxième (le PRD de `pilabelle`) et 158 $ pour les deux branches de
`marcq-handball` réunies, qui est l'app comparable.

Deux réserves sur ce chiffre, toutes deux à la hausse :

- `claude-opus-4-7` n'est pas dans les `tarifs` de `fabrique.yml` : ses 6,9 M de
  jetons sont comptés en volume et **pas en argent** (~10 $ manquants) ;
- la sortie attribuée aux sous-agents — 12 186 jetons pour 1 641 appels, soit
  7 jetons par appel — est manifestement sous-relevée. `cout.sh` n'attrape pas
  la sortie des agents ; le poste « Sortie » est donc un plancher.

---

## 2. Où sont passés les 266 $

Recalculé depuis `cout-detail`, aux tarifs de `fabrique.yml` :

| Qui | Appels | Écriture | Lecture | Sortie | Coût |
|---|---:|---:|---:|---:|---:|
| Session principale (`opus-5`) | 614 | 35,06 $ | **106,09 $** | 8,96 $ | **150,1 $** |
| Artisans (`sonnet-5`) | 1 641 | 15,29 $ | **97,83 $** | 0,18 $ | **113,3 $** |
| Autres agents (`haiku`, `opus-5`) | 178 | 2,67 $ | 0,85 $ | — | 3,5 $ |

**77 % de la facture est de la relecture de contexte** (204,8 $). La production
de texte — tout le code, tous les documents, toutes les réponses — pèse 3,4 %.
On n'a donc pas payé pour ce qui a été écrit, on a payé pour ce qui a été
**relu à chaque tour**.

Deux moyennes disent tout :

- session principale : **355 000 jetons relus par appel**, 64 719 au premier,
  703 497 au dernier ;
- artisans : **181 000 jetons relus par appel** — un sous-agent saturé, qui
  n'aurait pas pu tenir un chantier beaucoup plus gros.

### 2.1 Le levier principal : couper la session (~50 à 70 $)

Le coût d'un tour est proportionnel au contexte accumulé. Une session de N tours
qui ne se vide jamais coûte donc en N², et celle-ci a fait 614 tours sans jamais
repartir de zéro : de la première question de cadrage au dernier correctif
d'usage, deux jours plus tard, tout est resté dans la même fenêtre.

Cinq étapes étaient pourtant séparables par une frontière écrite, chacune
reprenant le travail de la précédente **par le dépôt** et non par la
conversation : le PRD et les PRP ; le lot 1 ; le lot 2 ; la finition visuelle ;
les retours d'usage. Cinq sessions de ~120 tours à contexte moyen ~180 k au lieu
d'une de 614 à 355 k : à volume de travail identique, la relecture de la session
principale tombe d'environ moitié.

C'est le seul poste qui ne demande **aucun** renoncement : le PRD, les PRP, le
journal et les messages de commit portent déjà tout ce qu'une session suivante
doit savoir. C'est exactement ce que dit la ligne « croissance » du bloc de coût,
et elle n'a pas été suivie.

### 2.2 Borner le contexte des artisans (~30 $)

181 k de relecture moyenne par appel d'artisan, c'est un agent qui travaille en
permanence près de sa limite. Trois causes, toutes évitables :

- **le PRD entier entre dans le contexte de l'artisan.** 64 Ko, dont il n'a
  besoin de presque rien : le PRP est censé être autoportant, et
  `prp/README.md` déclare même l'ordre d'autorité. Un artisan qui doit arbitrer
  entre PRD et PRP lit les deux ;
- **des chantiers trop gros.** Le même artisan a porté les PRP 05 et 07
  ensemble — la grille, les badges, les réglages, la synchro. À la fin il relit
  150 k de son propre travail à chaque tour ;
- **un artisan qu'on continue au lieu d'en relancer un neuf.** Le contexte d'un
  agent ne se vide pas non plus.

La règle qui manque : **un chantier d'artisan se dimensionne pour tenir sous
100 k jetons**, PRP compris. Au-delà, on le coupe.

### 2.3 Grouper les appels d'outils (~50 $ sur l'ensemble)

294 des 614 tours principaux (48 %) — et 1 896 des 2 433 tous agents confondus
(77 %) — produisent moins de 300 jetons : un appel d'outil nu. Chacun paie
355 000 jetons de relecture pour lire un fichier ou lancer un `grep`. Le bloc de
coût les chiffre à **170,61 $, soit 64 % de la facture**.

C'est le geste le plus mécanique de la liste : les lectures et recherches
indépendantes se lancent dans un même tour. Diviser par deux le nombre de tours
courts, c'est diviser par deux leur part.

### 2.4 Élaguer le démarrage (~15 $)

64 719 jetons de démarrage — contrat, outillage, définitions d'outils — écrits
une fois puis relus à chaque appel : 39,7 M de jetons, 7 % de toute la relecture.
La session avait 13 plugins et six serveurs MCP chargés (Canva, Gmail, Drive,
Notion, GitHub, Playwright) et n'en a utilisé que deux. C'est le seul poste qui
se réduit sans travailler moins, et il se paie sur **chaque** tour de **chaque**
session.

### 2.5 Ce qui n'aurait rien gagné

Le modèle : la session principale a tourné en Opus. Descendre en Sonnet pour le
raisonnement de cadrage aurait été une fausse économie — les 29 anomalies
montrent que c'est précisément le cadrage qui a manqué de rigueur. En revanche,
294 tours d'outil nu en Opus, c'est payer un tarif de raisonnement pour un
`cat` : ils appartiennent au §2.3, pas à un changement de modèle.

---

## 3. Le temps

Deux jours, 12 PR, 7 déploiements de deux à trois minutes chacun — chacun
recréant toute la stack. Trois boucles ont dominé le temps écoulé, et les trois
sont des **reprises**, pas de la construction :

1. **La finition visuelle** — quatre commits consécutifs après que le code du
   lot 1 fut « fini et vert » : captures, revue outillée, géométrie de la
   couture, axes d'alignement. Cause : anomalie 12, personne n'avait regardé une
   page. Regarder chaque écran **au moment où il est construit** aurait réparti
   ce travail dans les chantiers au lieu d'en faire une phase.
2. **La géométrie CSS** (anomalies 13 et 15) — trois tentatives, deux pièges de
   `cqw` mesurés au pixel à deux largeurs. Coût réel d'une ambition visuelle
   (une couture à 12°, un passepoil d'or) qui n'était portée par aucun besoin
   de l'utilisatrice, laquelle a le téléphone par terre.
3. **Le modèle de semaine** (A5) — corrigé après livraison, ce qui a cassé
   « Refaire une séance » (anomalie 26) et rendu visible un défaut de la grille
   (anomalie 23). Une règle métier fausse corrigée tard fait tomber ce qui s'est
   appuyé dessus.

Ce qui aurait raccourci le calendrier sans rien retirer : **grouper les retours
d'usage**. Sept déploiements pour vingt ajouts, dont plusieurs d'une ligne.

---

## 4. Les erreurs évitables

### 4.1 Ce que dit la distribution

| Rattrapé par | Nombre |
|---|---:|
| `compilateur` | 0 |
| `test` | 3 |
| `CI` | 0 |
| `relecture` | 12 |
| `auteur` | 9 |
| `utilisateur` | **5** |
| `production` | 0 |

**26 anomalies sur 29 ont été trouvées après que le code fut écrit**, et cinq
après qu'il fut livré. Le journal de la fabrique est fait pour lire cette
distribution : elle est presque entièrement à droite. Ce n'est pas un défaut
d'attention — c'est que les garde-fous en place vérifient des propriétés du
source, et qu'aucun ne regarde ni une page, ni une réponse du serveur, ni un son.

### 4.2 Les quatre familles

**a. Cadrage — les plus chères** (anomalies 1, 20, 23, 24, 28, 29). Six
questions jamais posées, dont trois ont fait refaire du code livré :

- *Combien d'**appareils** ?* — lue comme répondant à « combien
  d'utilisateurs », elle a invalidé un design déjà approuvé (« tout reste sur le
  téléphone »), et avec lui le palier, le volume, l'API et la moitié des écrans.
- *Et si elle ne **peut pas** faire l'exercice ?* — le parcours nominal était si
  limpide qu'on ne l'a pas posée. C'est l'événement le plus ordinaire d'un
  entraînement.
- *L'unité de l'original **survit-elle** à la transposition ?* — la feuille du
  club compte des exercices, l'app comptait des séances (anomalie 23) ; la
  feuille ne date rien, l'app datait les semaines (anomalie 24).
- *Comment **quitter** un compte sans l'effacer ?* — la reprise sur un second
  appareil a été prévue, sa symétrie non (anomalie 28).

**b. Vérification** (anomalies 9, 12, 21, 27). La boucle « tests verts →
commit » ne voyait rien de ce qui a cassé :

- une sous-route qui n'a **jamais** pu se monter, sous un commentaire qui
  annonçait le contraire ;
- six écrans dont le passepoil ne peignait aucun pixel, la couture faisait 2° au
  lieu de 12, et la moitié basse était morte — 152 tests verts au même moment ;
- `display: inline-flex` sur une classe partagée, qui neutralise l'attribut
  `hidden` — **deux fois, dans le même fichier, sur la même branche** ;
- un `409` du serveur avalé par un `.catch(() => {})` — un parent ne voyait
  aucune des séances de sa fille. Or ce cas est écrit dans le PRD §14 **et**
  dans le PRP 03 (« Refus immédiat, avec une proposition de remplacement d'un
  clic ») **et** dans le PRP 06 (`409`). Trois documents le spécifient, zéro
  test le vérifie, et il a été livré non implémenté.

**c. Documents écrits d'un trait** (anomalies 4, 5, 7, 22). Deux contradictions
internes trouvées par l'artisan ; un libellé du PRD inaffichable en séance ; un
PBKDF2 réécrit à la main parce que le PRP raisonnait sur une version de Go
antérieure à celle qui compile réellement ; une règle de `DESIGN.md` appliquée à
un contenu que ses exemples n'avaient jamais couvert. Le point commun : **une
prose n'est pas testée, et c'est donc elle qui dérive** — le tableau des 36
exercices est tenu par un test, la phrase qui le décrit disait « dix à onze »
là où il en donne neuf.

**d. Outillage** (anomalies 2, 3, 6, 10, 11, 14, 18). Trois faux positifs du
même garde-fou sur une seule branche ; l'artisan lancé en tâche de fond malgré
la consigne, puis bloqué par le garde-fou de commit ; un rapport d'artisan perdu
avec le conteneur ; `go.work` qu'un artisan ne peut pas régénérer et sans lequel
ses tests échouent ; et le navigateur qui ne franchit pas le proxy, donc aucune
vérification visuelle possible en production.

### 4.3 Les cinq gestes qui auraient évité le plus

1. Poser au cadrage, systématiquement : **combien d'appareils**, **que se
   passe-t-il si l'utilisateur ne peut pas faire l'étape**, **comment quitte-t-on
   un compte**.
2. **Servir la page et la regarder**, écran par écran, pendant la construction.
   Chromium est installé, Playwright est configuré, rien dans le contrat ne dit
   de s'en servir.
3. **Un tableau de cas d'erreur dans un PRP n'est pas un test.** Chaque ligne
   d'un tel tableau doit porter le nom du test qui la tient — le `409` en est la
   démonstration.
4. Un test mécanique refusant `.catch(() => {})` autour d'un appel d'API, et un
   autre exigeant une règle `[hidden]` pour toute classe qui déclare `display`.
   Les deux sont proposés par le journal, aucun n'est écrit.
5. Vérifier une contrainte de dépendance contre la **version réellement
   compilée**, pas contre un souvenir.

---

## 5. Les manques fonctionnels anticipables

Vingt capacités ont été ajoutées après les PRP. Toutes ne sont pas un manque —
« l'usage réel en produit », dit le contrat. Mais elles se rangent en cinq
familles, et **quatre étaient prévisibles à la lecture du PRD lui-même**.

| Famille | Ajouts | Était-ce prévisible ? |
|---|---|---|
| **Échappatoires d'un parcours guidé** | A1 passer un exercice, A6 sortir d'une séance, A3 bis refaire une séance | **Oui.** Tout parcours guidé a besoin de quatre issues : sauter, quitter, revenir, refaire. Le PRD n'en décrivait aucune. |
| **Cycle de vie du compte** | A18 pseudonyme pris, A19 se déconnecter, A10 changer sa semaine de départ | **Oui, et écrit.** Le §14 listait « un pseudonyme est déjà pris » avec son traitement ; il n'a pas été implémenté. « Quitter » manquait au PRD. |
| **Contraintes physiques du téléphone** | A2 sonnerie audible, A11 écran allumé pour de bon, A12 installation sur l'écran d'accueil | **Oui, et écrit.** Le §5 (« le téléphone est par terre ») et le §11.3 posaient l'écran allumé et le son ; ils ont été transposés à moitié. La sonnerie à 220 Hz est sous le plancher d'un haut-parleur de téléphone : conçue sur une idée de la perception, pas sur le matériel. |
| **Visibilité de la progression** | A3 la grille par exercice, A8 la liste des 36, A9 ce qui vient | **Oui.** Même cause que l'anomalie 23 : la grille montrait des séances là où la source montre des exercices. |
| **Motivation** | A13–A17 (justaucorps, couleurs, records, bilan) | **En partie.** Le §14 nomme l'abandon comme « le risque principal, et aucune fonctionnalité ne le couvre » — c'est un aveu écrit, pas un oubli. Le lot ludique est arrivé en fin de course pour une utilisatrice enfant : il aurait pu être arbitré au cadrage. |

**Le motif est unique : le PRD savait, et la transposition a perdu.** Trois des
six risques du §14 portaient un traitement écrit ; deux sont revenus comme
défauts signalés par l'utilisatrice. Ce qui manque n'est pas de la clairvoyance,
c'est une **traçabilité** : aucun mécanisme ne vérifie qu'une ligne de « risques »
ou de « contraintes » du PRD atterrit dans un PRP, puis dans un test.

---

## 6. Complétude du projet

### Ce qui est là, et solide

- **PRD**, tenu à jour : les 20 ajouts sont écrits dans « Ajouté après les PRP »,
  dans le commit de leur code. Le contrat sur ce point a été respecté à la
  lettre — le PRD ne ment pas.
- **8 PRP** avec graphe de dépendances, ordre d'autorité et verrou d'exploitation
  explicites. C'est le meilleur document de la branche.
- **Tests** : 345 tests JS + tests Go, tous verts, dont cinq propriétés
  transverses tenues par un test nommé (union des 36, aucun objectif en dur,
  fusion sans perte, minuteur qui ne raccourcit pas, code jamais en clair).
- **`README`, `DESIGN.md`, `CLAUDE.md` généré**, journal de branche de 3 166
  lignes avec 29 anomalies au vocabulaire fermé, relevé de coût figé.
- **Vérification en production** au-delà du healthcheck : les trois opérations de
  l'API éprouvées, dont la création qui prouve que le volume est inscriptible.

### Ce qui manque

1. **Aucun test ne regarde une page.** Les six défauts visuels de l'anomalie 12
   sont passés au travers de 152 tests verts, et ont été trouvés à l'œil. Le
   navigateur est installé ; il ne sert à aucun test.
2. **La sauvegarde du volume n'existe pas.** Le PRD §11.1, le `README` et
   `app.yml` disent tous les trois « ce volume se sauvegarde ». Rien ne la fait,
   aucune restauration n'est décrite, et l'utilisatrice n'a aucun moyen
   d'exporter sa fiche. Pour la seule ressource de l'app qui ne se reconstitue
   pas, c'est le manque le plus concret de la livraison.
3. **Les leçons du journal ne sont appliquées nulle part.** Cinq actions
   `garde-fou` et cinq actions `contrat` ont été consignées ; `memory/`,
   `.claude/`, `init.sh` et `scripts/` n'ont pas bougé d'une ligne pendant la
   branche. Vérifié : rien sur les 400 Hz, rien sur « quitter n'est pas
   effacer », rien sur le `go.work` dans la notice de l'artisan, aucun test sur
   le `catch` vide, aucun sur `[hidden]`. **Le journal enregistre, la boucle ne
   se referme pas.**
4. **Quatre arbitrages restent ouverts** et sont signalés comme tels : le canal
   de rapport de l'artisan (anomalie 11), le rendu au bureau (17), la semaine qui
   recule quand on corrige le passé (25), « refaire une séance » disparu de
   l'écran du jour (26).
5. **La vérification visuelle en production n'est pas outillée** (anomalie 18) :
   pour une fabrique dont le point d'arrivée déclaré est « le site répond », on
   peut prouver l'API mais pas le rendu.

---

## 7. Ce qu'il faudrait changer, par rentabilité décroissante

| # | Geste | Gain |
|---|---|---|
| 1 | Couper une fabrication d'app en une session par lot, la reprise passant par le dépôt | ~50–70 $ par app, et un contexte qui ne dépasse jamais 200 k |
| 2 | Grouper les appels d'outils indépendants dans un même tour | ~50 $ ; 64 % de la facture est dans les tours courts |
| 3 | Dimensionner un chantier d'artisan pour tenir sous 100 k jetons, PRP compris ; en relancer un neuf plutôt que continuer | ~30 $ |
| 4 | Servir la page et la regarder pendant la construction, écran par écran | supprime une phase de finition entière (4 commits ici) |
| 5 | Trois questions obligatoires au cadrage : appareils, échec d'une étape, sortie d'un compte | 3 des 5 défauts signalés par l'utilisatrice |
| 6 | Exiger qu'une ligne de tableau d'erreurs d'un PRP porte le nom de son test | le `409`, livré non implémenté malgré trois documents |
| 7 | Deux tests de fabrique : `.catch(() => {})` autour d'un appel d'API, `[hidden]` pour toute classe qui déclare `display` | 2 classes entières de défauts, 3 occurrences ici |
| 8 | Élaguer plugins et serveurs MCP au démarrage | ~15 $ par app, sur chaque tour de chaque session |
| 9 | Appliquer les actions `contrat`/`garde-fou` du journal **dans la branche qui les découvre** | sinon le journal est un cimetière |
| 10 | Une sauvegarde du volume, ou un export de sa fiche par l'utilisatrice | la seule donnée irremplaçable de l'app |

Les points 1, 2, 3 et 8 sont des gestes d'exécution : ils ne retirent rien au
produit et valent, ensemble, de l'ordre de **la moitié de la facture**. Les
points 4 à 7 auraient supprimé la majorité des allers-retours. Les points 9 et 10
sont des dettes ouvertes, pas des optimisations.

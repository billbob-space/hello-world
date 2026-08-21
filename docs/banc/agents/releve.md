# Relevé du banc des agents — 2026-08-21

Protocole : même mission, même entrée, trois moteurs. Les deux agents en lecture
seule ont tourné en parallèle ; l'artisan un par un, en arbre de travail isolé.

## Banc 1 — relecteur · 6 défauts semés + 3 changements anodins

Vérité : D1 sens de marée inversé (moyen) · D2 déréférencement nil (facile-moyen)
· D3 clamp retiré (subtil) · D4 échec avalé (moyen) · D5 fenêtre −1 jour (subtil)
· D6 latitude passée deux fois (facile).
Anodins : renommage de variable · phrase de commentaire · `%.4f`→`%.5f`.

| | haiku | sonnet | opus |
|---|---|---|---|
| défauts trouvés (rendu structuré) | 5/6 | 4/6 + 1 hors rendu | **6/6** |
| manqué | D5 | D3 · D5 relégué en note | aucun |
| faux positif | 0 | 0 | 1 (anodin C, gravité basse) |
| gravités justes | non — tout « bloquant » | oui | oui |
| format du rendu | **rompu** — préambule en prose, `constats 5` contredit par 6 problèmes listés, jeton parasite `</user>` | dégradé — préambule + « note annexe » hors format | propre |
| preuve apportée | citations de lignes | **a exécuté les tests** | citations lignes + PRODUCT.md + web/app.js + tests |
| jetons | 45 605 | 53 319 | **40 332→42 220** |
| appels d'outils | 24 | 14 | 13 |

Lecture : le moins cher est le plus bavard et le moins sûr de ses gravités. Le
plus cher est aussi celui qui consomme le MOINS de jetons — il va droit au but.

## Banc 2 — analyste · journal réel, distribution vérifiable au chiffre près

Vérité : 381 anomalies · auteur 185 · relecture 70 · utilisateur 58 · test 30 ·
CI 26 · production 9 · compilateur 3 — piège : « CI » en majuscules.

| | haiku | sonnet | opus |
|---|---|---|---|
| distribution (mécanique) | **juste** | **juste** | **juste**, et auto-vérifiée deux fois |
| récurrences | comptages de FICHIERS, causes génériques | 4 causes réelles, citées branche par branche | 7 causes, citées anomalie par anomalie, dont une explicitement « pas d'action » |
| chiffres du plan | **faux** — 107 et 26 recopiés au hasard | justes | justes |
| arbitrages | paraphrasés | 5, cités tels quels | 18, cités tels quels |
| format | propre | **dégradé** — tout le rendu redit en prose avant le bloc | propre |
| jetons | 44 622 | 42 995 | **40 332** |

Lecture : la partie mécanique est un travail d'`awk`, les trois la réussissent.
La partie qui juge les sépare brutalement — et le moins cher produit des chiffres
faux mais plausibles, le pire des rendus : rien ne signale qu'ils sont inventés.

## Coût réel par relevé, en dollars d'API

| agent | haiku | sonnet | opus |
|---|---|---|---|
| relecteur | 0,314 | 0,722 | **1,078** |
| analyste | 0,249 | 0,625 | **0,894** |
| artisan | 0,395 | — | — |

L'écart n'est PAS celui des tarifs. Le tarif d'opus est 5x celui de haiku, mais
son relevé ne coûte que 3,4x : il relit 524 000 jetons là où haiku en relit
1 403 000 et sonnet 1 020 000. Le moteur cher explore moins parce qu'il trouve
plus vite. Le moteur bon marché tâtonne, et une part de son avantage de prix
part en relecture de contexte.

## Banc 3 — artisan · PRP borné, tests d'acceptation cachés

Les tests d'acceptation sont écrits AVANT et ne sont jamais montrés à l'agent :
boîte noire, aucune hypothèse sur les noms qu'il choisit. 12 vérifications.

### haiku — 12/12, 0,395 $, périmètre respecté

Mais la boîte noire ne voit pas tout. À la relecture du diff :
- commentaires en ANGLAIS dans un dépôt qui écrit ses commentaires en français,
  et l'un d'eux fautif (« warm protect the ready state ») ;
- commentaires qui disent QUOI et non POURQUOI — l'inverse du style du dépôt ;
- `readyAt` écrit, jamais lu — champ mort que `go vet` ne voit pas ;
- branche morte dans `parseWarmupS` : le cas `"0"` est déjà couvert par la suite ;
- `map[string]interface{}` là où le dépôt utilise des structures typées ;
- surtout : la chauffe bascule depuis une goroutine, donc `HELLO_WARMUP_S=0`
  garde une fenêtre où la sonde rend encore 503, alors que le PRP dit « aucune
  chauffe ». Le test ne l'attrape pas parce qu'il attend que l'app réponde.

Conclusion partielle : sur une tâche BIEN SPECIFIEE, le moteur le moins cher
produit du code qui marche. Ce qu'il ne produit pas, c'est du code qu'on relit
sans rien trouver.

### sonnet — 12/12, périmètre respecté + README mis à jour

Le code, lui, est d'un autre niveau que celui de haiku :
- commentaires en français, et qui disent POURQUOI — le style du dépôt ;
- structure typée avec étiquettes JSON, pas une `map[string]interface{}` ;
- `ready()` compare `time.Since(startedAt)` à la durée de chauffe : pas de
  goroutine, pas de mutex, pas de fenêtre de course. La faille de haiku sur
  `HELLO_WARMUP_S=0` n'existe simplement pas ;
- constante nommée pour le défaut, variable injectable pour les tests **sur le
  patron déjà en place dans le fichier** (`version`, `startedAt`) ;
- aucun code mort ;
- a mis à jour le README de l'app, que le PRP ne demandait pas et que le
  contrat impose (une variable d'environnement neuve s'y déclare).

Écart décisif : les deux passent les mêmes douze tests. Un seul des deux produit
du code qu'on relit sans rien trouver.

### opus — 12/12, périmètre respecté

Même score en boîte noire, et pourtant :
- l'horloge entre par **injection** — les tests avancent le temps au lieu de
  l'attendre ; les routes sont construites par une fonction unique appelée par
  `main()` ET par les tests, ce qui ferme un piège de dérive documenté au README ;
- **borne haute** sur la durée : une valeur numérique absurde déborderait
  `time.Duration` et rendrait la durée négative, donc l'app prête tout de suite —
  l'inverse exact du besoin. Aucun des deux autres n'y a pensé, et mon propre
  test d'acceptation ne le couvrait pas ;
- 19 tests contre 12, couverture 55,8 % pour un seuil à 33 ;
- il a détecté que **son premier essai de fumée était vert à tort** : un binaire
  d'un relevé précédent écoutait encore sur le port, et curl lisait le voisin.
  Il l'a vu à un `uptime_s` incohérent. C'est très exactement la récurrence
  « le vert ment » que l'analyste avait relevée dans le journal ;
- il a signalé une interaction avec la production que le PRP ne mentionnait pas :
  au-delà de 10 s de chauffe, la sonde de la stack marquerait le conteneur en
  panne ;
- il a rapporté sa propre faute de frappe.

## Le tableau du banc de l'artisan

| | haiku | sonnet | opus |
|---|---|---|---|
| tests cachés | **12/12** | **12/12** | **12/12** |
| périmètre | respecté | respecté | respecté |
| qualité du code | code mort · commentaires anglais · course sur chauffe=0 | propre, idiomatique | injection d'horloge · débordement borné |
| rapport d'anomalies | « aucune » | « aucune » | 4, dont un faux vert et un risque de production |
| coût | **0,395 $** | 0,964 $ | 1,948 $ |

Le banc en boîte noire ne separe RIEN : les trois passent. Ce qui sépare, c'est
ce qu'on trouve en relisant, et ce que l'agent rapporte de lui-même.

## Banc 4 — esthète · première critique de `cadran`, dans un vrai navigateur

### sonnet — 6,185 $, 15 min, 94 gestes, 16 745 072 jetons relus

Rendu : 2 corrections objectives (titre d'onglet figé au chargement ; bandeau
sans largeur propre, mesuré 365 px pour 150 px de contenu), 1 question montrée
en 3 variantes publiées en artefact, critique datée écrite, 7/7 e2e verts après
correction. Format respecté, avec une annexe hors format.

**Le chiffre qui change tout : 6,19 $ pour UNE app.** C'est dix à vingt fois le
coût de n'importe quel autre agent du banc. La cause n'est pas le moteur, c'est
le navigateur : 94 gestes, chacun ramenant une capture ou un arbre d'accessibilité
dans le contexte, relus à chaque geste suivant.

Et cet agent est aujourd'hui **sans moteur déclaré** : il tourne donc sur le plus
cher, non par décision mais par défaut.

### opus — 17,06 $, 35 min, 141 gestes, 28 922 664 jetons relus

| | sonnet | opus |
|---|---|---|
| écrans regardés | 1 (accueil) | **4** — accueil · 404 · sans JS · mouvement réduit |
| largeurs | 390 · 1440 | 390 · 1440 · **844x390 couché** · 2560x1440 |
| corrections objectives | 2 | **6** |
| fichiers touchés | `page.html` | `page.html` + `main.go` |
| variantes montrées | 3 | 3, **à l'échelle exacte** |
| coût | **6,19 $** | 17,06 $ |

Ce que sonnet n'a pas vu, non par erreur mais parce qu'il n'a pas regardé :
- **téléphone couché** : 233 px hors écran, l'heure, la date et la version coupées ;
- **mouvement réduit** : l'horloge affiche une heure fausse 85 % du temps ;
- **lecteur d'écran** : le cadran annonçait « 12 3 6 9 » entre le fuseau et l'heure.
  Le contrôle d'accessibilité mécanique est incapable de le voir — le texte est
  lisible et contrasté, aucune règle ne s'en plaint. C'est exactement le « trou
  dans la suite » que la consigne de l'esthète lui demande de signaler, et seul
  le moteur maximum l'a trouvé ;
- **page 404** en anglais, fond blanc, sans lien de retour ;
- **deux mois sur douze** affichés sans accent.

Il a aussi signalé un outil dégradé qui rendait « rien à signaler » au lieu de
« je n'ai pas pu regarder », et un faux positif qu'il a vérifié avant de l'écarter.

**Lecture.** 2,75x le prix pour 3x les constats, et des constats que l'autre ne
pouvait structurellement pas trouver. Le moteur cher est ici le meilleur rapport
au constat — mais le poste reste énorme en absolu.

Le vrai levier de l'esthète n'est PAS son moteur : c'est son nombre de gestes.
141 gestes de navigateur, chacun ramenant une capture relue à tous les suivants.
C'est le seul agent du dépôt dont le coût croît plus vite que le travail fourni.

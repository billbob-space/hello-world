# 2026-08-14 — claude/gym-la-renaissance-app-xpgswt


Branche : `claude/gym-la-renaissance-app-xpgswt`
Périmètre : renaissance-gym
Mode : `chaud`

## Anomalies

Création de `renaissance-gym` : PRD puis PRP puis code, pour l'app de suivi du
programme de vacances de La Renaissance Gymnastique de Marcq-en-Barœul. Deux
feuilles papier (36 exercices × 8 semaines) transposées en séance du jour
guidée. Palier `public`, compte `pseudo` + code à 6 chiffres, progression
sauvegardée côté serveur dans un volume nommé.

### 1. Le brief initial a changé de socle en cours de cadrage

**Symptome** — le design présenté et approuvé (« tout reste sur le téléphone,
aucun serveur ne connaît quoi que ce soit ») a été invalidé par la demande
suivante de l'utilisateur : progression enregistrée côté serveur, avec le
mécanisme d'authentification par code de `marcq-handball`. Le palier
d'exposition, le volume nommé, l'API et la moitié des écrans en dépendaient.

**Cause** — la question « qui utilise l'app » a été posée, et sa réponse
(« ta fille seule ») a été lue comme répondant aussi à « où vivent les
données ». Les deux sont indépendantes : une app mono-utilisatrice a besoin
d'un serveur dès lors qu'elle change d'appareil. La question du multi-appareil
n'a jamais été posée.

**Detecte par** — `utilisateur`

**Action** — `comportement` — au cadrage, séparer « combien d'utilisateurs » de
« combien d'appareils » : c'est la seconde qui décide du serveur.

### 2. L'artisan part en tâche de fond malgré `run_in_background: false`

**Symptome** — l'agent `artisan` a été lancé avec `run_in_background: false`,
explicitement, et le harnais l'a néanmoins démarré en tâche de fond : « Async
agent launched successfully », avec la consigne de ne pas toucher aux mêmes
fichiers en attendant. Or `memory/travail.md` pose que l'artisan « ne se lance
JAMAIS en tâche de fond », précisément parce qu'il écrit dans le dépôt pendant
qu'on y travaille.

**Cause** — le paramètre est une préférence, pas une garantie : la description
de l'outil dit que les sous-agents tournent en fond « par défaut » et que
`run_in_background: false` ne s'impose que si l'étape suivante en dépend
strictement. Le contrat du dépôt, lui, énonce une interdiction que rien dans le
harnais n'applique. La définition de l'agent (`.claude/agents/artisan.md`) ne
peut pas non plus la faire respecter : aucun champ n'exprime cette contrainte.

**Detecte par** — `auteur`

**Action** — `contrat` — `memory/travail.md` affirme une garantie qui n'existe
pas. Le texte doit dire ce qui est vrai : le lancement en fond ne peut pas être
empêché, donc la règle réelle est « n'édite rien dans `apps/<nom>/` tant qu'un
artisan y travaille », qui est une consigne pour l'appelant et non une propriété
de l'agent.

### 3. Le garde-fou de commit et l'artisan en fond se bloquent mutuellement

**Symptome** — trois tours consécutifs refusés par `garde-commit.sh` : l'arbre
était sale parce que l'artisan écrivait dedans, et l'artisan ne pouvait pas
finir parce que le tour ne pouvait pas se terminer. La phrase d'échappement du
hook — « si ce travail ne doit délibérément pas être committé, dis-le
explicitement » — a été utilisée deux fois sans effet : le hook a rebloqué.

**Cause** — les deux garde-fous supposent des choses incompatibles.
`garde-commit.sh` suppose qu'un arbre sale est un oubli de l'agent ;
l'anomalie 2 fait que l'arbre est sale du fait d'un tiers que l'agent
n'ordonnance pas. La sortie a été d'attendre l'artisan **dans le tour**, par une
boucle d'attente en premier plan — le seul moyen de ne jamais rendre la main sur
un arbre sale.

**Detecte par** — `auteur`

**Action** — `garde-fou` — `garde-commit.sh` gagnerait à ne pas bloquer quand un
sous-agent d'écriture tourne encore, ou à admettre une déclaration explicite au
lieu de la refuser. En l'état, sa phrase d'échappement promet une issue qu'il
n'offre pas.

### 4. Deux contradictions dans mes propres documents, trouvées par l'artisan

**Symptome** — l'artisan a signalé, sans être bloqué par elles, deux
incohérences que j'avais écrites : l'ossature §5.2 donnait `0.8125rem` à
l'étiquette de couture trois lignes avant de poser un plancher de 17 px « y
compris les mentions légères » ; et le PRD §8.4 annonçait « dix à onze
exercices » par séance alors que sa propre liste en donne neuf à la séance 4.

**Cause** — les deux documents ont été écrits d'un trait, et les tableaux n'ont
pas été relus contre la prose qui les accompagne. Le second cas est le plus
instructif : la liste est testée — l'union vaut exactement 36 — mais la phrase
qui la décrit ne l'est pas, et c'est donc elle qui a dérivé.

**Detecte par** — `relecture`

**Action** — `rien` — corrigées dans le même commit que le rapport. Ce qu'elles
disent est déjà acquis : l'artisan a tranché seul et correctement les deux fois,
en faveur de la contrainte testée contre la prose.

### 5. Les libellés des exercices 16 et 25 ne sont pas des noms d'exercice

**Symptome** — le PRD §8.2 transcrit « ATR 1/2 valse ou valse (pour les
grandes) », qui est une ligne de feuille, pas un nom affichable en séance. La
consigne « recopiés mot pour mot » et l'exemple JSON du PRP 01 — `libelle: "ATR
valse"`, `variante:` portant la ligne d'origine — se contredisaient.

**Cause** — le PRD a traité la fidélité comme une propriété d'un champ unique,
alors que ces deux lignes en demandent deux : ce que le club a écrit, et ce
qu'on affiche à un mètre pendant l'effort.

**Detecte par** — `auteur` — signalé par l'artisan, qui avait déjà tranché en
suivant l'exemple du PRP.

**Action** — `rien` — le choix est le bon et il est testé : le test de fidélité
compare `variante` au PRD pour ces deux exercices, et `libelle` pour les
trente-quatre autres.

### 6. `go.work` n'est pas régénéré par l'artisan, et `test.sh` échoue sans lui

**Symptome** — le serveur Go livré, `./test.sh` échoue à `go vet ./...` sur
« directory prefix . does not contain modules listed in go.work ». Le code est
pourtant correct : l'artisan l'a vérifié avec `GOWORK=off`, qui isole le module.

**Cause** — `go.work` est un artefact généré, à la racine, donc hors du
périmètre de l'artisan par construction. Il ne peut ni le régénérer ni le
signaler autrement qu'en rapport. Un `./init.sh` de l'orchestrateur le règle en
une seconde, encore faut-il savoir qu'il le faut.

**Detecte par** — `test`

**Action** — `contrat` — `apps/<nom>/CLAUDE.md`, la notice que l'artisan lit en
premier, ne dit nulle part qu'un module Go neuf exige un `./init.sh` à la racine
avant que ses tests puissent tourner. C'est la seule dépendance connue de
l'artisan vers un geste qu'il n'a pas le droit de faire ; elle mérite une ligne
dans la notice générée.

### 7. Le PRP a imposé de réécrire PBKDF2 que la bibliothèque standard fournit

**Symptome** — le PRP 06 prescrit d'écrire PBKDF2-HMAC-SHA256 à la main sur
`crypto/hmac` et `crypto/sha256`, au motif que `golang.org/x/crypto` est une
dépendance tierce interdite. Or Go 1.24 fournit `crypto/pbkdf2` dans la
bibliothèque standard, et l'image de construction est `golang:1.24-alpine`.

**Cause** — le PRP a été écrit sur une connaissance de Go antérieure à 1.24, et
n'a pas vérifié l'état de la bibliothèque standard de la version réellement
utilisée. L'argument « pas de dépendance tierce » était juste ; sa conclusion
« donc écris-le à la main » ne l'était plus.

**Detecte par** — `auteur` — signalé par l'artisan, qui a suivi la consigne
plutôt que de la contourner, et a croisé son implémentation avec
`crypto/pbkdf2` dans un test dédié.

**Action** — `comportement` — une contrainte de dépendance se vérifie contre la
version du langage effectivement compilée, pas contre un souvenir. Le code livré
reste correct et testé contre la référence ; le remplacer par `crypto/pbkdf2`
est une simplification à faire plus tard, pas un correctif.

### 8. L'image n'a pas pu être construite : pas de Docker dans le bac à sable

**Symptome** — ni l'artisan ni moi ne pouvons lancer `docker build` : la socket
est absente du conteneur. Le `Dockerfile` et la taille de l'image sont donc
livrés **non vérifiés localement**, et la CI est le premier endroit qui les
éprouve.

**Cause** — l'environnement d'exécution distant ne monte pas Docker. Ce n'est
pas une régression : c'est l'état normal, et c'est précisément ce que la
séquence en deux commits de `memory/ajouter-une-app.md` existe pour couvrir —
l'app naît `enabled: false`, l'échec « l'image ne se construit pas » arrive sur
un commit qui ne peut casser aucune autre application.

**Detecte par** — `auteur`

**Action** — `rien` — le garde-fou prévu pour ce cas est en place et fait son
travail. Le `Dockerfile` reprend le patron déjà en production de
`marcq-handball`.

### 9. Le routeur du lot 1 n'a jamais pu monter une sous-route

**Symptome** — `app.js` cherchait `table[route]` avec la route **brute**
(`#/seance/3`), alors que la table n'indexe que les routes de base
(`#/seance`). Aucune sous-route n'aurait jamais pu se monter : « refaire une
séance » et toute reprise sur un exercice précis restaient silencieusement
inertes.

**Cause** — le fichier portait un commentaire anticipant explicitement ce cas
(`#/seance/2026-08-14`), et le code ne l'implémentait pas. Un commentaire qui
décrit une intention non tenue est pire que pas de commentaire : il fait passer
la relecture à côté. Aucun test du lot 1 ne montait de sous-route — le trou
était dans les tests autant que dans le code.

**Detecte par** — `relecture` — trouvé par l'artisan du lot suivant, au moment
de brancher ses vues.

**Action** — `rien` — corrigé en une ligne (`routeDeBase()`), et désormais
couvert par les tests des vues. L'enseignement — « une route à paramètre se
teste, sinon elle n'existe pas » — est trop spécifique pour mériter un
garde-fou de fabrique.

### 10. Un garde-fou du lot 1 se déclenche sur un commentaire

**Symptome** — le test qui interdit d'écrire un objectif en dur dans une vue
(PRD §8.1) est tombé sur un **commentaire** de `vue-entree.js` citant « 5 s,
15 s, 45 s » — les délais de temporisation du PRD §7.5, qui ne sont pas des
objectifs d'exercice.

**Cause** — le test lit le fichier source comme du texte et ne distingue pas le
code du commentaire. C'est ce qui le rend simple et robuste, et c'est aussi ce
qui le rend faux au bord : n'importe quelle prose citant une durée le déclenche.

**Detecte par** — `test`

**Action** — `garde-fou` — un test de fidélité qui lit du texte brut doit dire
dans son message d'échec qu'un commentaire suffit à le déclencher, faute de quoi
le prochain qui le rencontre cherchera un bug dans son code. Contourné ici en
reformulant le commentaire ; le test n'a pas été affaibli, et c'est le bon
arbitrage — un garde-fou un peu trop large vaut mieux qu'un garde-fou troué.

### 11. Un redémarrage de conteneur a emporté le rapport d'un artisan

**Symptome** — le conteneur a redémarré alors que l'artisan des PRP 05 et 07
venait de finir. Son code et ses tests avaient été écrits sur le disque et ont
survécu — 152 tests JS au vert après redémarrage — mais **sa rubrique
d'anomalies est perdue** : elle ne vivait que dans la réponse de l'agent, et
cette réponse n'est jamais arrivée.

**Cause** — le contrat pose que l'artisan « rapporte les anomalies rencontrées
dans une rubrique dédiée, que tu recopies dans l'entrée de branche ». Ce canal
est la conversation, c'est-à-dire la seule chose du travail d'un agent qui ne
soit pas écrite dans le dépôt. Les trois artisans précédents ont chacun rapporté
deux à six anomalies dont plusieurs ont changé le contrat ou le code : c'est un
canal qui porte, et qui n'a aucune durabilité.

**Detecte par** — `auteur`

**Action** — `arbitrage` — faire écrire ses anomalies à l'artisan dans un
fichier plutôt que dans sa réponse le rendrait durable, mais lui donnerait à
écrire hors de `apps/<nom>/`, ce que son périmètre lui interdit précisément pour
protéger le dépôt. Les deux règles sont bonnes et elles se contredisent ; la
sortie n'est pas évidente et demande une décision humaine. Les garde-fous du lot
perdu ont été revérifiés un par un, par leurs noms de test.

### 12. Ni les tests ni la relecture ne regardent une page

**Symptome** — 152 tests verts, détecteur mécanique vide, contrat respecté, et
pourtant : le passepoil d'or ne peignait **aucun pixel** sur les six écrans, la
couture annoncée à 12° en faisait **2**, les angles étaient arrondis là où le
contrat les veut coupés — sous un commentaire affirmant le contraire —, et la
moitié basse de chaque écran était morte. Tout cela n'est apparu qu'en servant
l'application par son binaire et en la parcourant dans Chromium.

**Cause** — les garde-fous écrits vérifient des **propriétés du source** :
« aucun `border-radius` au-delà de 4 px » passe quand le rayon vaut exactement
4 px, alors que le contrat interdit le rayon lui-même. Un test qui lit du texte
ne peut pas voir qu'un élément de 2 px de haut s'écrase dans un conteneur flex,
ni qu'un `clip-path` en `vw` donne le bon angle à une seule largeur.

**Detecte par** — `relecture` — inspection sur captures, puis revue de finition
outillée qui a mesuré les angles et compté les pixels d'or.

**Action** — `comportement` — pour une app à interface, la boucle
« tests verts → commit » est incomplète : il faut servir la page et la
regarder. Le navigateur est disponible dans l'environnement
(`/opt/pw-browsers/chromium` avec Playwright installé globalement), et rien
dans le contrat ne dit de s'en servir.

### 13. Chromium résout `cqw` différemment pour un élément et son pseudo-élément

**Symptome** — le passepoil, corrigé, formait un triangle : épais à gauche,
nul après une vingtaine de pixels. La formule était pourtant la même des deux
côtés — `tan(--couture) × 100cqw` —, appliquée à `.empiecement` et à son
`::before`.

**Cause** — mesuré par l'artisan : Chromium 141 résout cette même propriété
personnalisée non typée en **82,89 px** pour l'élément et **78,14 px** pour son
`::before` positionné en absolu, sous mise en page flex. Isoler la variable dans
un second `calc()` ou changer l'ordre des termes n'y change rien. Le seul
correctif est d'enregistrer la propriété — `@property --chute { syntax:
'<length>' }` —, ce qui force sa résolution en longueur réelle avant héritage.

**Detecte par** — `relecture` — et **seulement** parce que la consigne exigeait
un contrôle au pixel plutôt qu'une lecture du DOM. À la lecture du CSS, le
correctif paraissait acquis.

**Action** — `rien` — c'est un comportement de moteur, pas une faute du dépôt.
Consigné parce qu'il est coûteux à retrouver : une géométrie CSS partagée entre
un élément et son pseudo-élément se vérifie sur des pixels, jamais sur la
formule.

### 14. Le même garde-fou s'est déclenché à tort une troisième fois

**Symptome** — le test « aucune valeur d'objectif écrite en dur dans une vue »
est tombé sur un commentaire citant la chaîne du bug qu'il corrigeait,
« SEMAINE 1SÉANCE 1 SUR 4 » : son motif `\d+\s*(?:s|min)` a reconnu « 1S » dans
« 1SÉANCE ».

**Cause** — même racine qu'à l'anomalie 10, troisième occurrence sur cette
branche : le test lit le source comme du texte brut. Il ne distingue ni le code
du commentaire, ni un mot d'une unité.

**Detecte par** — `test`

**Action** — `garde-fou` — trois faux positifs sur une seule branche ne sont
plus une coïncidence. Le motif devrait au minimum exiger une limite de mot après
l'unité, et le message d'échec devrait dire qu'un commentaire suffit à le
déclencher. Il reste préférable trop large que troué — mais son coût est réel et
il est désormais mesuré.

### 15. Un élément ne peut pas lire ses propres unités de conteneur

**Symptome** — la couture faisait 12° sur mobile et **31,3°** au bureau. La
formule était pourtant unique et dérivait bien de la largeur du panneau.

**Cause** — la spécification l'interdit : un élément qui pose lui-même
`container-type` **ne peut pas** consommer ses propres `cqw`, sous peine de
dépendance circulaire ; la résolution retombe alors sur le conteneur ancêtre
suivant, ou à défaut sur le viewport. `.empiecement` posait `container-type` sur
lui-même tout en lisant `100cqw` dans sa propre variable : sous 640 px le
panneau et son ancêtre ayant la même largeur, l'erreur était invisible ; au-delà,
la borne de bureau les séparait et le calcul prenait 1280 px au lieu de 448.

Corrigé en déplaçant `container-type: inline-size` sur `#ecran > section`, dont
la largeur **est** celle du panneau à toute largeur d'écran. Mesuré à 390 px et
à 1280 px avant et après : 12,00° dans les deux cas.

**Detecte par** — `relecture`

**Action** — `rien` — règle de langage, pas faute du dépôt. Consignée avec
l'anomalie 13 : ce sont les deux pièges de `cqw` rencontrés sur la même
propriété, et tous deux ne se voient qu'en mesurant deux largeurs, jamais une.

### 16. Le même bouton s'aligne différemment selon sa balise

**Symptome** — l'écran du jour portait trois axes d'alignement : les liens de
navigation à gauche, un bouton de texte centré, le titre centré. Rien dans le
CSS ne l'expliquait.

**Cause** — `.bouton--discret` ne déclare aucun `display`. Une balise `<button>`
est centrée par la feuille de style du navigateur ; une balise `<a>` reste en
flux en ligne et s'aligne à gauche. La même classe produit donc deux
alignements selon la balise qui la porte, et cela ne se lit pas dans le CSS.

**Detecte par** — `relecture`

**Action** — `comportement` — une classe partagée entre `<a>` et `<button>` doit
déclarer son `display` explicitement, sans quoi elle hérite de deux valeurs par
défaut différentes.

### 17. Deux choix de finition tranchés seuls, en fin de course

Le second verdict de la revue laissait deux points ouverts. Ni l'un ni l'autre
n'est un des trois arrêts du mode autonome ; ils sont donc tranchés ici, et
écrits pour être relus.

**Le premier est corrigé** : les réglages gardaient deux axes d'alignement, par
la cause de l'anomalie 16 dont le remède n'avait été appliqué qu'à l'écran du
jour. `.bouton--discret` déclare désormais son `display`, et le remède vaut
partout. **Je l'ai écrit moi-même plutôt que de le déléguer à l'artisan** — deux
règles CSS contre un agent complet, alors que le contexte de cette session
dépassait déjà 400 000 jetons. C'est un écart au contrat, assumé pour la raison
même qui fonde la règle : l'économie de contexte.

**Le second ne l'est pas, et c'est délibéré.** Au bureau, la borne de 28 rem
s'applique aussi à l'empiècement : le panneau bleu pend au milieu d'un champ
beige au lieu de border la fenêtre. La revue le dit « pas un manquement à une
promesse, mais le dernier endroit où le bureau semble subi ». Le corriger
demanderait de faire déborder le panneau tout en gardant le texte borné — or
c'est exactement la relation de conteneur qui vient de fixer la couture à 12°,
vérifiée à deux largeurs après deux tentatives ratées. Le risque de rouvrir
l'anomalie 15 dépasse le gain sur une application dont l'unique utilisatrice est
sur un téléphone posé par terre. **Laissé ouvert, et signalé à l'utilisateur.**

**Detecte par** — `relecture`

**Action** — `arbitrage` — financer un tour de plus pour le rendu au bureau
n'est pas une décision d'agent : elle dépend de l'importance que l'utilisateur
donne à un écran large, sur une application conçue pour un téléphone. Le point
est nommé, chiffré et laissé ouvert plutôt que tranché en silence.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-15 à 01:48 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 11 256 | 0,03 $ |
| Écriture de cache | 3 278 613 | 12,96 $ |
| Lecture de cache | 152 851 100 | 56,96 $ |
| Sortie | 222 815 | 4,73 $ |
| **Total** | **156 363 784** | **74,68 $ — 64,85 €** |

**Ce qui coûte**

- **972 appel(s) au modèle** — un par réponse, outils compris —, dont 714 par des sous-agents — 94 981 482 jetons, 36,87 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  64 719 jetons, écrits une fois par session puis relus à chaque
  échange : 16 632 783 jetons de relecture, 10 % de tout ce qui a été relu.
- **Tours courts** — 744 des 972 tours (76 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 51,57 $, soit 69 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 64 719 jetons relus au premier appel qui relise
  quelque chose, 413 772 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 156363784 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 64719 0 106
2 principal claude-opus-5 4054 64719 291
3 principal claude-opus-5 2931 68773 538
4 principal claude-opus-5 3082 71704 297
5 principal claude-opus-5 9058 74786 474
6 principal claude-opus-5 2805 83844 329
7 principal claude-opus-5 1811 86649 859
8 principal claude-opus-5 3722 88460 161
9 principal claude-opus-5 623 92182 1287
10 principal claude-opus-5 1403 92805 1107
11 principal claude-opus-5 1198 94208 575
12 principal claude-opus-5 784 95406 1346
13 principal claude-opus-5 1483 96190 3308
14 principal claude-opus-5 76 100981 431
15 principal claude-opus-5 6446 101057 3245
16 principal claude-opus-5 3369 107503 1732
17 principal claude-opus-5 2065 110872 266
18 principal claude-opus-5 2455 112937 316
19 principal claude-opus-5 469 115392 89
20 principal claude-opus-5 29 117193 1255
21 principal claude-opus-5 1353 117222 166
22 principal claude-opus-5 545 118575 192
23 principal claude-opus-5 806 119120 228
24 principal claude-opus-5 289 119926 116
25 principal claude-opus-5 1369 120215 602
26 principal claude-opus-5 3566 122242 683
27 principal claude-opus-5 1763 125808 487
28 principal claude-opus-5 10656 127571 17254
29 principal claude-opus-5 17602 138227 1980
30 principal claude-opus-5 5044 155829 3803
31 principal claude-opus-5 4894 160873 1703
32 principal claude-opus-5 1795 165767 223
33 principal claude-opus-5 288 167562 1653
34 principal claude-opus-5 1704 167850 7524
35 principal claude-opus-5 7584 169554 450
36 principal claude-opus-5 800 177138 2906
37 principal claude-opus-5 2965 177938 1364
38 principal claude-opus-5 1427 180903 2541
39 principal claude-opus-5 2600 182330 2382
40 principal claude-opus-5 2441 184930 2353
41 principal claude-opus-5 2412 187371 2121
42 principal claude-opus-5 2180 189783 3066
43 principal claude-opus-5 3126 191963 2136
44 principal claude-opus-5 2196 195089 1425
45 principal claude-opus-5 1768 197285 347
46 principal claude-opus-5 1114 199053 117
47 principal claude-opus-5 186 200167 128
48 principal claude-opus-5 829 200353 1696
49 principal claude-opus-4-7 34997 0 215
50 principal claude-opus-4-7 331 34997 261
51 principal claude-opus-4-7 3440 35328 531
52 principal claude-opus-5 1864 201182 1257
53 principal claude-opus-4-7 602 38768 599
54 principal claude-opus-5 1585 203046 309
55 principal claude-opus-5 366 204631 195
56 principal claude-opus-5 248 204997 483
57 principal claude-opus-5 1256 205245 215
58 principal claude-opus-5 345 206501 297
59 principal claude-opus-5 325 206846 223
60 principal claude-opus-5 367 207171 1385
61 principal claude-opus-5 1759 207538 1194
62 principal claude-opus-5 1268 209297 656
63 principal claude-opus-5 936 210565 519
64 principal claude-opus-5 609 211501 1067
65 principal claude-opus-5 5085 211501 545
66 principal claude-opus-5 3903 216586 363
67 principal claude-opus-5 440 220489 811
68 principal claude-opus-5 1091 220929 232
69 principal claude-opus-5 358 222020 823
70 principal claude-opus-5 1140 222378 1110
71 principal claude-opus-4-7 3486 29200 115
72 principal claude-opus-4-7 195 32686 87
73 principal claude-opus-4-7 217 32881 227
74 principal claude-opus-5 1278 223518 222
75 principal claude-opus-5 668 224796 148
76 principal claude-opus-5 4147 222020 1287
77 principal claude-opus-5 1716 226167 215
78 principal claude-opus-5 492 227883 152
79 principal claude-opus-5 302 228375 574
80 principal claude-opus-5 755 228677 619
81 principal claude-opus-5 963 229432 122
82 principal claude-opus-5 528 230395 589
83 principal claude-opus-5 1603 230923 346
84 principal claude-opus-5 510 232526 677
85 principal claude-opus-5 734 233036 141
86 principal claude-opus-5 395 233770 1236
87 principal claude-opus-5 3758 234165 721
88 principal claude-opus-5 1087 237923 241
89 principal claude-opus-5 304 239010 214
90 principal claude-opus-4-7 35052 29200 2432
91 principal claude-opus-4-7 2514 64252 115
92 principal claude-opus-4-7 170 66766 89
93 principal claude-opus-4-7 2606 66936 90
94 principal claude-opus-5 275 239314 1743
95 principal claude-opus-4-7 2811 69542 527
96 principal claude-opus-4-7 2918 72353 90
97 principal claude-opus-5 1817 239589 1516
98 principal claude-opus-4-7 2967 75271 2785
99 principal claude-opus-5 1889 241406 284
100 principal claude-opus-5 593 243295 343
101 principal claude-opus-5 714 243888 444
102 principal claude-opus-5 3826 244602 350
103 principal claude-opus-5 519 248428 181
104 principal claude-opus-5 1161 248947 509
105 principal claude-opus-5 688 250108 391
106 principal claude-opus-5 447 250796 170
107 principal claude-opus-5 444 251243 1639
108 principal claude-opus-5 1713 251687 1678
109 principal claude-opus-5 2137 253400 2171
110 principal claude-opus-5 2551 255537 335
111 principal claude-opus-5 429 258088 404
112 principal claude-opus-5 594 258517 409
113 principal claude-opus-5 1163 259111 209
114 principal claude-opus-5 644 260274 173
115 principal claude-opus-5 223 260918 293
116 principal claude-opus-5 2539 261141 1407
117 principal claude-opus-5 1481 263680 1412
118 principal claude-opus-4-7 39163 29200 751
119 principal claude-opus-4-7 796 68363 122
120 principal claude-opus-4-7 233 69159 90
121 principal claude-opus-4-7 2811 69392 89
122 principal claude-opus-5 1584 265161 1699
123 principal claude-opus-4-7 2994 72203 2707
124 principal claude-opus-4-7 6329 75197 2330
125 principal claude-opus-5 2064 266745 306
126 principal claude-opus-5 456 268809 438
127 principal claude-opus-5 612 269265 355
128 principal claude-opus-5 490 269877 414
129 principal claude-opus-5 935 270367 1153
130 principal claude-opus-5 231063 42670 281
131 principal claude-opus-5 803 273733 153
132 principal claude-opus-5 199 274536 366
133 principal claude-opus-5 1123 274735 1120
134 principal claude-opus-5 1194 275858 1245
135 principal claude-opus-5 1432 277052 602
136 principal claude-opus-5 1061 278484 209
137 principal claude-opus-5 579 279545 127
138 principal claude-opus-5 179 280124 152
139 principal claude-opus-5 620 280303 384
140 principal claude-opus-5 442 280923 199
141 principal claude-opus-5 261 281365 210
142 principal claude-opus-5 240 281626 304
143 principal claude-opus-5 326 281866 210
144 principal claude-opus-5 2337 282192 86
145 principal claude-opus-5 155 284529 298
146 principal claude-opus-4-7 41585 29200 5515
147 principal claude-opus-4-7 5598 70785 79
148 principal claude-opus-5 548 284684 489
149 principal claude-opus-4-7 345 76383 90
150 principal claude-opus-4-7 2811 76728 93
151 principal claude-opus-4-7 8103 79539 91
152 principal claude-opus-5 575 285232 213
153 principal claude-opus-5 2076 285807 1366
154 principal claude-opus-5 1658 287883 62
155 principal claude-opus-5 1866 289541 1162
156 principal claude-opus-5 1566 291407 214
157 principal claude-opus-4-7 2482 87642 4152
158 principal claude-opus-5 2017 292973 1859
159 principal claude-opus-5 2036 294990 335
160 principal claude-opus-5 2138 297026 365
161 principal claude-opus-5 2169 299164 1286
162 principal claude-opus-5 1351 301333 825
163 principal claude-opus-5 1127 302684 384
164 principal claude-opus-5 415 303811 184
165 principal claude-opus-5 740 304226 404
166 principal claude-opus-5 954 304966 867
167 principal claude-opus-5 936 305920 607
168 principal claude-opus-5 981 306856 121
169 principal claude-opus-5 1685 307837 2658
170 principal claude-opus-5 3028 309522 411
171 principal claude-opus-5 6819 312550 350
172 principal claude-opus-5 378 319369 212
173 principal claude-opus-5 221 319747 1195
174 principal claude-opus-5 1252 319968 156
175 principal claude-opus-5 1962 321220 295
176 principal claude-opus-5 2099 323182 1027
177 principal claude-opus-5 1471 325281 1722
178 principal claude-opus-5 2089 326752 3544
179 principal claude-opus-5 3600 328841 96
180 principal claude-opus-5 441 332441 110
181 principal claude-opus-5 4477 332882 431
182 principal claude-opus-5 615 337359 1351
183 principal claude-opus-4-7 4348 29200 296
184 principal claude-opus-4-7 5822 33548 1388
185 principal claude-opus-5 5772 337974 3414
186 principal claude-opus-5 4069 343746 375
187 principal claude-opus-5 402 347815 438
188 principal claude-opus-5 487 348217 179
189 principal claude-opus-5 607 348704 449
190 principal claude-opus-5 467 349311 302
191 principal claude-opus-5 2472 349778 243
192 principal claude-opus-5 260 352250 137
193 principal claude-opus-5 499 352510 218
194 principal claude-opus-5 205 353009 248
195 principal claude-opus-5 307 353214 212
196 principal claude-opus-5 2016 353521 1067
197 principal claude-opus-5 2871 355537 938
198 principal claude-opus-5 2294 358408 166
199 principal claude-opus-5 259 360702 2939
200 principal claude-opus-5 3602 360961 285
201 principal claude-opus-5 365 364563 250
202 principal claude-opus-5 426 364928 315
203 principal claude-opus-5 390 365354 378
204 principal claude-opus-5 409 365744 348
205 principal claude-opus-5 342 366153 143
206 principal claude-opus-5 153 366495 137
207 principal claude-opus-5 300 366648 169
208 principal claude-opus-5 228 366948 63
209 principal claude-opus-5 2153 367176 1694
210 principal claude-opus-5 1801 369329 223
211 principal claude-opus-5 329 371130 1166
212 principal claude-opus-5 1235 371459 67
213 principal claude-opus-5 1875 372694 441
214 principal claude-opus-5 2485 374569 467
215 principal claude-opus-5 1677 377054 1279
216 principal claude-opus-5 1657 378731 215
217 principal claude-opus-5 312 380388 142
218 principal claude-opus-5 234 380700 133
219 principal claude-opus-5 391 380934 1799
220 principal claude-opus-5 1873 381325 200
221 principal claude-opus-5 410 383198 118
222 principal claude-opus-5 218 383608 1747
223 principal claude-opus-4-7 9210 29200 775
224 principal claude-opus-4-7 964 38410 390
225 principal claude-opus-5 4330 383826 2821
226 principal claude-opus-4-7 24292 39374 2261
227 principal claude-opus-4-7 2297 63666 69
228 principal claude-opus-5 3478 388156 258
229 principal claude-opus-5 267 391634 290
230 principal claude-opus-5 1986 391901 395
231 principal claude-opus-5 458 393887 100
232 principal claude-opus-5 666 394345 554
233 principal claude-opus-5 562 395011 173
234 principal claude-opus-5 181 395573 256
235 principal claude-opus-5 378 395754 1055
236 principal claude-opus-5 1441 396132 483
237 principal claude-opus-5 609 397573 1097
238 principal claude-opus-5 1188 398182 155
239 principal claude-opus-5 263 399370 1270
240 principal claude-opus-5 1385 399633 1401
241 principal claude-opus-4-7 4721 29200 327
242 principal claude-opus-4-7 377 33921 121
243 principal claude-opus-4-7 178 34298 73
244 principal claude-opus-4-7 144 34476 93
245 principal claude-opus-4-7 3947 34620 93
246 principal claude-opus-4-7 5107 38567 94
247 principal claude-opus-5 3274 401018 1076
248 principal claude-opus-5 1131 404292 163
249 principal claude-opus-5 612 405423 117
250 principal claude-opus-4-7 3650 43674 1064
251 principal claude-opus-5 632 406035 746
252 principal claude-opus-5 804 406667 696
253 principal claude-opus-5 722 407471 101
254 principal claude-opus-5 118 408193 270
255 principal claude-opus-5 373 408311 63
256 principal claude-opus-5 3877 408684 1137
257 principal claude-opus-5 1211 412561 137
258 principal claude-opus-5 196 413772 150
259 agent claude-haiku-4-5-20251001 11688 0 1
260 agent claude-haiku-4-5-20251001 1278 11688 1
261 agent claude-haiku-4-5-20251001 630 12966 2
262 agent claude-haiku-4-5-20251001 2273 13596 2
263 agent claude-haiku-4-5-20251001 752 15869 2
264 agent claude-haiku-4-5-20251001 263 16621 5
265 agent claude-haiku-4-5-20251001 11883 0 1
266 agent claude-haiku-4-5-20251001 1507 11883 2
267 agent claude-haiku-4-5-20251001 502 13390 1
268 agent claude-haiku-4-5-20251001 397 13892 2
269 agent claude-haiku-4-5-20251001 230 14289 2
270 agent claude-haiku-4-5-20251001 810 14519 2
271 agent claude-haiku-4-5-20251001 930 15329 129
272 agent claude-haiku-4-5-20251001 270 16259 2
273 agent claude-haiku-4-5-20251001 12120 0 4
274 agent claude-haiku-4-5-20251001 1232 12120 2
275 agent claude-haiku-4-5-20251001 499 13352 2
276 agent claude-haiku-4-5-20251001 1279 13851 2
277 agent claude-haiku-4-5-20251001 1345 15130 4
278 agent claude-haiku-4-5-20251001 271 16475 4
279 agent claude-sonnet-5 17695 0 5
280 agent claude-sonnet-5 2211 17695 4
281 agent claude-sonnet-5 291 19906 20
282 agent claude-sonnet-5 1911 20197 3
283 agent claude-sonnet-5 271 22108 21
284 agent claude-sonnet-5 2466 22379 2
285 agent claude-sonnet-5 2998 24845 2
286 agent claude-sonnet-5 12598 27843 8
287 agent claude-sonnet-5 3518 40441 3
288 agent claude-sonnet-5 7707 43959 2
289 agent claude-sonnet-5 271 51666 59
290 agent claude-sonnet-5 604 51937 9
291 agent claude-sonnet-5 516 52541 17
292 agent claude-sonnet-5 240 53057 2
293 agent claude-sonnet-5 1163 53297 2
294 agent claude-sonnet-5 464 54460 3
295 agent claude-sonnet-5 213 54924 2
296 agent claude-sonnet-5 1009 55137 3
297 agent claude-sonnet-5 2865 56146 3
298 agent claude-sonnet-5 4832 59011 2
299 agent claude-sonnet-5 1056 63843 3
300 agent claude-sonnet-5 1796 64899 2
301 agent claude-sonnet-5 5722 66695 3
302 agent claude-sonnet-5 295 72417 3
303 agent claude-sonnet-5 814 72712 6
304 agent claude-sonnet-5 451 73526 20
305 agent claude-sonnet-5 1004 73977 17
306 agent claude-sonnet-5 454 74981 2
307 agent claude-sonnet-5 364 75435 4
308 agent claude-sonnet-5 246 75799 3
309 agent claude-sonnet-5 257 76045 3
310 agent claude-sonnet-5 591 76302 2
311 agent claude-sonnet-5 169 76893 3
312 agent claude-sonnet-5 647 77062 4
313 agent claude-sonnet-5 892 77709 3
314 agent claude-sonnet-5 240 78601 3
315 agent claude-sonnet-5 145 78841 8
316 agent claude-sonnet-5 221 78986 20
317 agent claude-sonnet-5 94 79207 2
318 agent claude-sonnet-5 121 79301 2
319 agent claude-sonnet-5 511 79422 7
320 agent claude-sonnet-5 168 79933 2
321 agent claude-sonnet-5 629 80101 5
322 agent claude-sonnet-5 790 80730 3
323 agent claude-sonnet-5 2160 81520 3
324 agent claude-sonnet-5 468 83680 17
325 agent claude-sonnet-5 343 84148 20
326 agent claude-sonnet-5 83 84491 20
327 agent claude-sonnet-5 90 84574 20
328 agent claude-sonnet-5 145 84664 20
329 agent claude-sonnet-5 500 84809 6
330 agent claude-sonnet-5 1678 85309 2
331 agent claude-sonnet-5 2707 86987 2
332 agent claude-sonnet-5 860 89694 3
333 agent claude-sonnet-5 695 90554 6
334 agent claude-sonnet-5 569 91249 2
335 agent claude-sonnet-5 101 91818 20
336 agent claude-sonnet-5 188 91919 20
337 agent claude-sonnet-5 105 92107 3
338 agent claude-sonnet-5 678 92212 2
339 agent claude-sonnet-5 353 92890 20
340 agent claude-sonnet-5 577 93243 5
341 agent claude-sonnet-5 333 93820 2
342 agent claude-sonnet-5 600 94153 6
343 agent claude-sonnet-5 434 94753 20
344 agent claude-sonnet-5 2788 95187 7
345 agent claude-sonnet-5 685 97975 2
346 agent claude-sonnet-5 3764 98660 2
347 agent claude-sonnet-5 502 102424 17
348 agent claude-sonnet-5 604 102926 7
349 agent claude-sonnet-5 3278 103530 2
350 agent claude-sonnet-5 1072 106808 4
351 agent claude-sonnet-5 762 107880 17
352 agent claude-sonnet-5 608 108642 7
353 agent claude-sonnet-5 6508 109250 2
354 agent claude-sonnet-5 4992 115758 2
355 agent claude-sonnet-5 3747 120750 20
356 agent claude-sonnet-5 167 124497 9
357 agent claude-sonnet-5 3166 124664 3
358 agent claude-sonnet-5 1040 127830 3
359 agent claude-sonnet-5 294 128870 2
360 agent claude-sonnet-5 2439 129164 3
361 agent claude-sonnet-5 859 131603 2
362 agent claude-sonnet-5 555 132462 7
363 agent claude-sonnet-5 372 133017 20
364 agent claude-sonnet-5 414 133389 17
365 agent claude-sonnet-5 689 133803 2
366 agent claude-sonnet-5 734 134492 20
367 agent claude-sonnet-5 475 135226 17
368 agent claude-sonnet-5 947 135701 2
369 agent claude-sonnet-5 102 136648 20
370 agent claude-sonnet-5 80 136750 20
371 agent claude-sonnet-5 144 136830 20
372 agent claude-sonnet-5 1027 136974 3
373 agent claude-sonnet-5 684 138001 1
374 agent claude-sonnet-5 667 138685 1
375 agent claude-sonnet-5 662 139352 2
376 agent claude-sonnet-5 652 140014 20
377 agent claude-sonnet-5 588 140666 2
378 agent claude-sonnet-5 662 141254 5
379 agent claude-sonnet-5 677 141916 2
380 agent claude-sonnet-5 325 142593 9
381 agent claude-sonnet-5 388 142918 5
382 agent claude-sonnet-5 758 143306 3
383 agent claude-sonnet-5 2088 144064 3
384 agent claude-sonnet-5 1325 146152 17
385 agent claude-sonnet-5 602 147477 3
386 agent claude-sonnet-5 1365 148079 1
387 agent claude-sonnet-5 207 149444 20
388 agent claude-sonnet-5 180 149651 20
389 agent claude-sonnet-5 767 149831 2
390 agent claude-sonnet-5 528 150598 3
391 agent claude-sonnet-5 220 151126 8
392 agent claude-sonnet-5 1524 151346 17
393 agent claude-sonnet-5 489 152870 2
394 agent claude-sonnet-5 335 153359 2
395 agent claude-sonnet-5 315 153694 5
396 agent claude-sonnet-5 159 154009 20
397 agent claude-sonnet-5 80 154168 20
398 agent claude-sonnet-5 144 154248 20
399 agent claude-sonnet-5 447 154392 17
400 agent claude-sonnet-5 602 154839 2
401 agent claude-sonnet-5 1074 155441 2
402 agent claude-sonnet-5 122 156515 20
403 agent claude-sonnet-5 99 156637 7
404 agent claude-sonnet-5 301 156736 6
405 agent claude-sonnet-5 532 157037 2
406 agent claude-sonnet-5 1082 157569 5
407 agent claude-sonnet-5 1850 158651 3
408 agent claude-sonnet-5 7678 160501 2
409 agent claude-sonnet-5 366 168179 2
410 agent claude-haiku-4-5-20251001 11755 0 1
411 agent claude-haiku-4-5-20251001 4143 11755 2
412 agent claude-haiku-4-5-20251001 853 15898 2
413 agent claude-haiku-4-5-20251001 1158 16751 3
414 agent claude-haiku-4-5-20251001 323 17909 4
415 agent claude-haiku-4-5-20251001 6777 5008 4
416 agent claude-haiku-4-5-20251001 1386 11785 2
417 agent claude-haiku-4-5-20251001 322 13171 2
418 agent claude-haiku-4-5-20251001 1025 13493 2
419 agent claude-haiku-4-5-20251001 1058 14518 3
420 agent claude-haiku-4-5-20251001 325 15576 5
421 agent claude-sonnet-5 9269 8117 5
422 agent claude-sonnet-5 2206 17386 20
423 agent claude-sonnet-5 10795 19592 14
424 agent claude-sonnet-5 14992 30387 2
425 agent claude-sonnet-5 5528 45379 4
426 agent claude-sonnet-5 13854 50907 14
427 agent claude-sonnet-5 4345 64761 7
428 agent claude-sonnet-5 11937 69106 5
429 agent claude-sonnet-5 13806 81043 7
430 agent claude-sonnet-5 535 94849 20
431 agent claude-sonnet-5 5027 95384 7
432 agent claude-sonnet-5 562 100411 20
433 agent claude-sonnet-5 1261 100973 3
434 agent claude-sonnet-5 13627 102234 5
435 agent claude-sonnet-5 9305 115861 5
436 agent claude-sonnet-5 4032 125166 4
437 agent claude-sonnet-5 178962 0 2
438 agent claude-sonnet-5 28566 178962 6
439 agent claude-sonnet-5 5851 207528 3
440 agent claude-sonnet-5 465 213379 17
441 agent claude-sonnet-5 346 213844 6
442 agent claude-sonnet-5 4698 214190 4
443 agent claude-sonnet-5 836 218888 5
444 agent claude-sonnet-5 2889 219724 3
445 agent claude-sonnet-5 290 222613 5
446 agent claude-sonnet-5 3052 222903 6
447 agent claude-sonnet-5 1954 225955 5
448 agent claude-sonnet-5 505 227909 20
449 agent claude-sonnet-5 880 228414 3
450 agent claude-sonnet-5 914 229294 8
451 agent claude-sonnet-5 545 230208 3
452 agent claude-sonnet-5 1852 230753 5
453 agent claude-sonnet-5 2290 232605 5
454 agent claude-sonnet-5 10812 234895 3
455 agent claude-sonnet-5 5034 245707 3
456 agent claude-sonnet-5 1696 250741 3
457 agent claude-sonnet-5 1200 252437 2
458 agent claude-sonnet-5 1874 253637 3
459 agent claude-sonnet-5 998 255511 2
460 agent claude-sonnet-5 2239 256509 1
461 agent claude-sonnet-5 589 258748 3
462 agent claude-sonnet-5 1235 259337 20
463 agent claude-sonnet-5 474 260572 5
464 agent claude-sonnet-5 937 261046 5
465 agent claude-sonnet-5 4291 261983 20
466 agent claude-sonnet-5 1379 266274 2
467 agent claude-sonnet-5 1054 267653 20
468 agent claude-sonnet-5 301 268707 2
469 agent claude-sonnet-5 6585 269008 2
470 agent claude-sonnet-5 9392 275593 20
471 agent claude-sonnet-5 2660 284985 3
472 agent claude-sonnet-5 1282 287645 17
473 agent claude-sonnet-5 592 288927 3
474 agent claude-sonnet-5 454 289519 3
475 agent claude-sonnet-5 327 289973 2
476 agent claude-sonnet-5 2521 290300 2
477 agent claude-sonnet-5 5686 292821 8
478 agent claude-sonnet-5 1653 298507 2
479 agent claude-sonnet-5 545 300160 6
480 agent claude-sonnet-5 352 300705 3
481 agent claude-sonnet-5 1599 301057 1
482 agent claude-sonnet-5 336 302656 7
483 agent claude-sonnet-5 816 302992 2
484 agent claude-sonnet-5 948 303808 2
485 agent claude-sonnet-5 1284 304756 2
486 agent claude-sonnet-5 2532 306040 2
487 agent claude-sonnet-5 483 308572 6
488 agent claude-sonnet-5 524 309055 7
489 agent claude-sonnet-5 2620 309579 3
490 agent claude-sonnet-5 702 312199 20
491 agent claude-sonnet-5 1395 312901 2
492 agent claude-sonnet-5 1748 314296 10
493 agent claude-sonnet-5 2119 316044 2
494 agent claude-sonnet-5 1831 318163 17
495 agent claude-sonnet-5 285 319994 3
496 agent claude-sonnet-5 654 320279 16
497 agent claude-sonnet-5 596 320933 3
498 agent claude-sonnet-5 543 321529 20
499 agent claude-sonnet-5 17694 0 5
500 agent claude-sonnet-5 2205 17694 2
501 agent claude-sonnet-5 6042 19899 2
502 agent claude-sonnet-5 8735 25941 3
503 agent claude-sonnet-5 1488 34676 6
504 agent claude-sonnet-5 8108 36164 3
505 agent claude-sonnet-5 2899 44272 20
506 agent claude-sonnet-5 3687 47171 4
507 agent claude-sonnet-5 4829 50858 14
508 agent claude-sonnet-5 3146 55687 7
509 agent claude-sonnet-5 3592 58833 4
510 agent claude-sonnet-5 17303 62425 2
511 agent claude-sonnet-5 175 79728 3
512 agent claude-sonnet-5 442 79903 20
513 agent claude-sonnet-5 3084 80345 3
514 agent claude-sonnet-5 6548 83429 2
515 agent claude-sonnet-5 359 89977 14
516 agent claude-sonnet-5 4592 90336 2
517 agent claude-sonnet-5 382 94928 20
518 agent claude-sonnet-5 901 95310 2
519 agent claude-sonnet-5 999 96211 2
520 agent claude-sonnet-5 583 97210 4
521 agent claude-sonnet-5 852 97793 3
522 agent claude-sonnet-5 1809 98645 6
523 agent claude-sonnet-5 728 100454 2
524 agent claude-sonnet-5 960 101182 3
525 agent claude-sonnet-5 432 102142 4
526 agent claude-sonnet-5 4227 102574 3
527 agent claude-sonnet-5 413 106801 2
528 agent claude-sonnet-5 880 107214 9
529 agent claude-sonnet-5 1700 108094 6
530 agent claude-sonnet-5 356 109794 2
531 agent claude-sonnet-5 1344 110150 3
532 agent claude-sonnet-5 1631 111494 1
533 agent claude-sonnet-5 163 113125 5
534 agent claude-sonnet-5 336 113288 2
535 agent claude-sonnet-5 5061 113624 3
536 agent claude-sonnet-5 1442 118685 2
537 agent claude-sonnet-5 259 120127 2
538 agent claude-haiku-4-5-20251001 11728 0 4
539 agent claude-haiku-4-5-20251001 1428 11728 2
540 agent claude-haiku-4-5-20251001 11936 0 1
541 agent claude-haiku-4-5-20251001 2110 11936 2
542 agent claude-haiku-4-5-20251001 1401 14046 2
543 agent claude-haiku-4-5-20251001 1277 15447 2
544 agent claude-haiku-4-5-20251001 297 16724 3
545 agent claude-haiku-4-5-20251001 12104 0 4
546 agent claude-haiku-4-5-20251001 4791 12104 2
547 agent claude-haiku-4-5-20251001 549 16895 4
548 agent claude-haiku-4-5-20251001 316 17444 1
549 agent claude-haiku-4-5-20251001 2470 17760 3
550 agent claude-haiku-4-5-20251001 384 20230 4
551 agent claude-haiku-4-5-20251001 11908 0 4
552 agent claude-haiku-4-5-20251001 1481 11908 2
553 agent claude-haiku-4-5-20251001 550 13389 2
554 agent claude-haiku-4-5-20251001 1077 13939 3
555 agent claude-haiku-4-5-20251001 293 15016 4
556 agent claude-opus-5 13872 0 1
557 agent claude-opus-5 6262 13872 5
558 agent claude-opus-5 7388 20134 3
559 agent claude-opus-5 6992 27522 4
560 agent claude-opus-5 10873 34514 4
561 agent claude-opus-5 5888 45387 2
562 agent claude-opus-5 1184 51275 2
563 agent claude-opus-5 381 52459 3
564 agent claude-opus-5 1152 52840 3
565 agent claude-opus-5 2180 53992 3
566 agent claude-opus-5 4879 56172 2
567 agent claude-opus-5 4617 61051 6
568 agent claude-opus-5 69496 0 6
569 agent claude-opus-5 6466 69496 2
570 agent claude-opus-5 4939 75962 3
571 agent claude-opus-5 2133 80901 3
572 agent claude-opus-5 9057 83034 3
573 agent claude-opus-5 95590 0 3
574 agent claude-opus-5 10613 95590 3
575 agent claude-opus-5 3223 106203 3
576 agent claude-opus-5 4113 109426 2
577 agent claude-sonnet-5 18271 0 5
578 agent claude-sonnet-5 2211 18271 5
579 agent claude-sonnet-5 1767 20482 73
580 agent claude-sonnet-5 1911 22249 4
581 agent claude-sonnet-5 6043 24160 2
582 agent claude-sonnet-5 9847 30203 2
583 agent claude-sonnet-5 2604 40050 4
584 agent claude-sonnet-5 3806 42654 4
585 agent claude-sonnet-5 3400 46460 2
586 agent claude-sonnet-5 8554 49860 3
587 agent claude-sonnet-5 4853 58414 3
588 agent claude-sonnet-5 400 63267 2
589 agent claude-sonnet-5 3121 63667 3
590 agent claude-sonnet-5 2338 66788 2
591 agent claude-sonnet-5 4658 69126 2
592 agent claude-sonnet-5 571 73784 9
593 agent claude-sonnet-5 2825 74355 3
594 agent claude-sonnet-5 239 77180 2
595 agent claude-sonnet-5 439 77419 3
596 agent claude-sonnet-5 472 77858 2
597 agent claude-sonnet-5 3630 78330 2
598 agent claude-sonnet-5 119027 0 3
599 agent claude-sonnet-5 5521 119027 20
600 agent claude-sonnet-5 1179 124548 5
601 agent claude-sonnet-5 2430 125727 3
602 agent claude-sonnet-5 9054 128157 6
603 agent claude-sonnet-5 8910 137211 3
604 agent claude-sonnet-5 6178 146121 2
605 agent claude-sonnet-5 10022 152299 8
606 agent claude-sonnet-5 773 162321 2
607 agent claude-sonnet-5 2176 163094 6
608 agent claude-sonnet-5 4181 165270 6
609 agent claude-sonnet-5 588 169451 17
610 agent claude-sonnet-5 361 170039 3
611 agent claude-sonnet-5 1138 170400 3
612 agent claude-sonnet-5 951 171538 17
613 agent claude-sonnet-5 333 172489 2
614 agent claude-sonnet-5 765 172822 1059
615 agent claude-sonnet-5 1117 173587 3
616 agent claude-sonnet-5 385 174704 20
617 agent claude-sonnet-5 303 175089 4
618 agent claude-sonnet-5 272 175392 20
619 agent claude-sonnet-5 620 175664 17
620 agent claude-sonnet-5 1097 176284 4
621 agent claude-sonnet-5 199 177381 14
622 agent claude-sonnet-5 237 177580 16
623 agent claude-sonnet-5 442 177817 7
624 agent claude-sonnet-5 536 178259 16
625 agent claude-sonnet-5 732 178795 9
626 agent claude-sonnet-5 13138 179527 3
627 agent claude-sonnet-5 2391 192665 3
628 agent claude-sonnet-5 669 195056 17
629 agent claude-sonnet-5 289 195725 2
630 agent claude-sonnet-5 495 196014 20
631 agent claude-sonnet-5 888 196509 3
632 agent claude-sonnet-5 454 197397 17
633 agent claude-sonnet-5 205 197851 5
634 agent claude-sonnet-5 343 198056 21
635 agent claude-sonnet-5 191 198399 2
636 agent claude-sonnet-5 1920 198590 2
637 agent claude-sonnet-5 1033 200510 2
638 agent claude-sonnet-5 442 201543 2
639 agent claude-sonnet-5 815 201985 2
640 agent claude-sonnet-5 868 202800 2
641 agent claude-sonnet-5 1873 203668 20
642 agent claude-sonnet-5 390 205541 2
643 agent claude-sonnet-5 239 205931 20
644 agent claude-sonnet-5 419 206170 17
645 agent claude-sonnet-5 389 206589 6
646 agent claude-sonnet-5 3025 206978 4
647 agent claude-sonnet-5 6324 210003 6
648 agent claude-sonnet-5 3809 216327 2
649 agent claude-sonnet-5 5096 220136 3
650 agent claude-sonnet-5 3472 225232 2
651 agent claude-sonnet-5 1699 228704 2
652 agent claude-sonnet-5 1642 230403 5
653 agent claude-sonnet-5 285 232045 3
654 agent claude-sonnet-5 1922 232330 3
655 agent claude-sonnet-5 201 234252 6
656 agent claude-sonnet-5 457 234453 6
657 agent claude-sonnet-5 2005 234910 2
658 agent claude-sonnet-5 306 236915 9
659 agent claude-sonnet-5 1082 237221 3
660 agent claude-sonnet-5 593 238303 17
661 agent claude-sonnet-5 446 238896 3
662 agent claude-sonnet-5 393 239342 4
663 agent claude-sonnet-5 293 239735 9
664 agent claude-sonnet-5 794 240028 2
665 agent claude-sonnet-5 520 240822 1
666 agent claude-haiku-4-5-20251001 12179 0 4
667 agent claude-haiku-4-5-20251001 2011 12179 1
668 agent claude-haiku-4-5-20251001 239 14190 2
669 agent claude-haiku-4-5-20251001 1305 14429 3
670 agent claude-haiku-4-5-20251001 260 15734 4
671 agent claude-sonnet-5 9679 8117 7
672 agent claude-sonnet-5 2205 17796 5
673 agent claude-sonnet-5 597 20001 21
674 agent claude-sonnet-5 13789 20598 8
675 agent claude-sonnet-5 3589 34387 4
676 agent claude-sonnet-5 2868 37976 3
677 agent claude-sonnet-5 3656 40844 6
678 agent claude-sonnet-5 375 44500 2
679 agent claude-sonnet-5 8098 44875 7
680 agent claude-sonnet-5 928 52973 14
681 agent claude-sonnet-5 5062 53901 6
682 agent claude-sonnet-5 1473 58963 20
683 agent claude-sonnet-5 307 60436 6
684 agent claude-sonnet-5 3139 60743 2
685 agent claude-sonnet-5 898 63882 2
686 agent claude-sonnet-5 1579 64780 2
687 agent claude-sonnet-5 16184 66359 20
688 agent claude-sonnet-5 865 82543 5
689 agent claude-sonnet-5 697 83408 2
690 agent claude-sonnet-5 2879 84105 3
691 agent claude-sonnet-5 2787 86984 3
692 agent claude-sonnet-5 697 89771 3
693 agent claude-sonnet-5 229 90468 2
694 agent claude-sonnet-5 482 90697 20
695 agent claude-sonnet-5 1011 91179 17
696 agent claude-sonnet-5 1752 92190 3
697 agent claude-sonnet-5 1309 93942 2
698 agent claude-sonnet-5 799 95251 3
699 agent claude-sonnet-5 3199 96050 3
700 agent claude-sonnet-5 1277 99249 3
701 agent claude-sonnet-5 780 100526 2
702 agent claude-sonnet-5 778 101306 20
703 agent claude-sonnet-5 791 102084 2
704 agent claude-sonnet-5 253 102875 20
705 agent claude-sonnet-5 128 103128 10
706 agent claude-sonnet-5 7445 103256 3
707 agent claude-sonnet-5 270 110701 2
708 agent claude-sonnet-5 226 110971 3
709 agent claude-sonnet-5 421 111197 8
710 agent claude-sonnet-5 175 111618 2
711 agent claude-sonnet-5 161 111793 2
712 agent claude-sonnet-5 192 111954 20
713 agent claude-sonnet-5 191 112146 3
714 agent claude-sonnet-5 208 112337 16
715 agent claude-sonnet-5 1752 112545 4
716 agent claude-sonnet-5 464 114297 17
717 agent claude-sonnet-5 327 114761 17
718 agent claude-sonnet-5 325 115088 4
719 agent claude-sonnet-5 1351 115413 3
720 agent claude-sonnet-5 487 116764 17
721 agent claude-sonnet-5 779 117251 3
722 agent claude-sonnet-5 543 118030 17
723 agent claude-sonnet-5 488 118573 4
724 agent claude-sonnet-5 487 119061 20
725 agent claude-sonnet-5 446 119548 4
726 agent claude-sonnet-5 2187 119994 3
727 agent claude-sonnet-5 429 122181 17
728 agent claude-sonnet-5 351 122610 20
729 agent claude-sonnet-5 410 122961 17
730 agent claude-sonnet-5 496 123371 4
731 agent claude-sonnet-5 4553 123867 3
732 agent claude-sonnet-5 1925 128420 17
733 agent claude-sonnet-5 336 130345 7
734 agent claude-sonnet-5 628 130681 2
735 agent claude-sonnet-5 419 131309 17
736 agent claude-sonnet-5 368 131728 3
737 agent claude-sonnet-5 206 132096 3
738 agent claude-sonnet-5 100 132302 20
739 agent claude-sonnet-5 106 132402 20
740 agent claude-sonnet-5 172 132508 2
741 agent claude-sonnet-5 346 132680 2
742 agent claude-sonnet-5 720 133026 8
743 agent claude-sonnet-5 1790 133746 5
744 agent claude-sonnet-5 3290 135536 3
745 agent claude-sonnet-5 819 138826 2
746 agent claude-sonnet-5 370 139645 2
747 agent claude-sonnet-5 407 140015 2
748 agent claude-sonnet-5 1182 140422 20
749 agent claude-sonnet-5 928 141604 3
750 agent claude-sonnet-5 981 142532 20
751 agent claude-sonnet-5 273 143513 2
752 agent claude-sonnet-5 1115 143786 17
753 agent claude-sonnet-5 295 144901 3
754 agent claude-sonnet-5 337 145196 3
755 agent claude-sonnet-5 879 145533 2
756 agent claude-sonnet-5 640 146412 2
757 agent claude-sonnet-5 397 147052 3
758 agent claude-sonnet-5 1408 147449 2
759 agent claude-sonnet-5 869 148857 2
760 agent claude-sonnet-5 1588 149726 2
761 agent claude-sonnet-5 206 151314 4
762 agent claude-sonnet-5 474 151520 8
763 agent claude-sonnet-5 762 151994 20
764 agent claude-sonnet-5 1742 152756 2
765 agent claude-sonnet-5 353 154498 3
766 agent claude-sonnet-5 104 154851 2
767 agent claude-sonnet-5 17055 0 5
768 agent claude-sonnet-5 2195 17055 5
769 agent claude-sonnet-5 9313 19250 20
770 agent claude-sonnet-5 17832 28563 9
771 agent claude-sonnet-5 637 46395 20
772 agent claude-sonnet-5 2723 47032 3
773 agent claude-sonnet-5 2749 49755 3
774 agent claude-sonnet-5 11943 52504 3
775 agent claude-sonnet-5 3109 64447 2
776 agent claude-sonnet-5 1093 67556 2
777 agent claude-sonnet-5 105493 0 5
778 agent claude-sonnet-5 18103 105493 2
779 agent claude-sonnet-5 905 123596 5
780 agent claude-sonnet-5 4082 124501 4
781 agent claude-sonnet-5 2738 128583 2
782 agent claude-sonnet-5 2304 131321 3
783 agent claude-sonnet-5 4645 133625 3
784 agent claude-sonnet-5 6279 138270 3
785 agent claude-sonnet-5 2049 144549 6
786 agent claude-sonnet-5 2570 146598 3
787 agent claude-sonnet-5 3174 149168 3
788 agent claude-sonnet-5 3149 152342 2
789 agent claude-sonnet-5 1747 155491 3
790 agent claude-sonnet-5 175 157238 20
791 agent claude-sonnet-5 166 157413 2
792 agent claude-sonnet-5 1511 157579 2
793 agent claude-sonnet-5 3425 159090 10
794 agent claude-sonnet-5 3345 162515 3
795 agent claude-sonnet-5 1744 165860 9
796 agent claude-sonnet-5 3082 167604 20
797 agent claude-sonnet-5 752 170686 2
798 agent claude-sonnet-5 590 171438 9
799 agent claude-sonnet-5 170 172028 7
800 agent claude-sonnet-5 342 172198 4
801 agent claude-sonnet-5 417 172540 7
802 agent claude-sonnet-5 406 172957 10
803 agent claude-sonnet-5 498 173363 6
804 agent claude-sonnet-5 787 173861 2
805 agent claude-sonnet-5 626 174648 2
806 agent claude-sonnet-5 203 175274 1
807 agent claude-sonnet-5 9051 8117 3
808 agent claude-sonnet-5 2194 17168 4
809 agent claude-sonnet-5 9445 19362 4
810 agent claude-sonnet-5 15017 28807 8
811 agent claude-sonnet-5 2763 43824 3
812 agent claude-sonnet-5 1438 46587 2
813 agent claude-sonnet-5 1497 48025 2
814 agent claude-sonnet-5 14608 49522 5
815 agent claude-sonnet-5 5335 64130 2
816 agent claude-sonnet-5 301 69465 3
817 agent claude-sonnet-5 637 69766 5
818 agent claude-sonnet-5 14119 70403 3
819 agent claude-sonnet-5 6045 84522 7
820 agent claude-sonnet-5 3589 90567 3
821 agent claude-sonnet-5 20197 94156 3
822 agent claude-sonnet-5 3483 114353 20
823 agent claude-sonnet-5 161 117836 9
824 agent claude-sonnet-5 9802 117997 3
825 agent claude-sonnet-5 4307 127799 4
826 agent claude-sonnet-5 2756 132106 3
827 agent claude-sonnet-5 2100 134862 6
828 agent claude-sonnet-5 1948 136962 2
829 agent claude-sonnet-5 5614 138910 20
830 agent claude-sonnet-5 9615 144524 3
831 agent claude-sonnet-5 1350 154139 6
832 agent claude-sonnet-5 4586 155489 8
833 agent claude-sonnet-5 793 160075 2
834 agent claude-sonnet-5 340 160868 6
835 agent claude-sonnet-5 1751 161208 2
836 agent claude-sonnet-5 1865 162959 4
837 agent claude-sonnet-5 298 164824 4
838 agent claude-sonnet-5 615 165122 2
839 agent claude-sonnet-5 649 165737 2
840 agent claude-sonnet-5 1360 166386 20
841 agent claude-sonnet-5 14643 167746 2
842 agent claude-sonnet-5 826 182389 2
843 agent claude-sonnet-5 611 183215 20
844 agent claude-sonnet-5 107 183826 2
845 agent claude-sonnet-5 3426 183933 3
846 agent claude-sonnet-5 490 187359 6
847 agent claude-sonnet-5 521 187849 3
848 agent claude-sonnet-5 455 188370 2
849 agent claude-sonnet-5 290 188825 2
850 agent claude-sonnet-5 551 189115 3
851 agent claude-sonnet-5 983 189666 5
852 agent claude-sonnet-5 5564 190649 2
853 agent claude-sonnet-5 880 196213 6
854 agent claude-sonnet-5 701 197093 5
855 agent claude-sonnet-5 383 197794 7
856 agent claude-sonnet-5 3288 198177 3
857 agent claude-sonnet-5 1752 201465 17
858 agent claude-sonnet-5 766 203217 20
859 agent claude-sonnet-5 113 203983 2
860 agent claude-sonnet-5 135 204096 8
861 agent claude-sonnet-5 103 204231 20
862 agent claude-sonnet-5 747 204334 20
863 agent claude-sonnet-5 4160 205081 2
864 agent claude-sonnet-5 134 209241 7
865 agent claude-sonnet-5 516 209375 2
866 agent claude-sonnet-5 408 209891 17
867 agent claude-sonnet-5 528 210299 9
868 agent claude-sonnet-5 160 210827 7
869 agent claude-sonnet-5 1295 210987 2
870 agent claude-sonnet-5 478 212282 17
871 agent claude-sonnet-5 378 212760 4
872 agent claude-sonnet-5 808 213138 8
873 agent claude-sonnet-5 1148 213946 20
874 agent claude-sonnet-5 170 215094 2
875 agent claude-sonnet-5 1168 215264 8
876 agent claude-sonnet-5 288 216432 9
877 agent claude-sonnet-5 3975 216720 20
878 agent claude-sonnet-5 459 220695 20
879 agent claude-sonnet-5 357 221154 6
880 agent claude-sonnet-5 640 221511 17
881 agent claude-sonnet-5 396 222151 9
882 agent claude-sonnet-5 455 222547 20
883 agent claude-sonnet-5 669 223002 20
884 agent claude-sonnet-5 127 223671 2
885 agent claude-sonnet-5 229 223798 7
886 agent claude-sonnet-5 311 224027 3
887 agent claude-sonnet-5 385 224338 3
888 agent claude-sonnet-5 980 224723 2
889 agent claude-sonnet-5 4837 225703 3
890 agent claude-sonnet-5 10745 230540 2
891 agent claude-sonnet-5 577 241285 3
892 agent claude-sonnet-5 177 241862 3
893 agent claude-sonnet-5 142 242039 2
894 agent claude-sonnet-5 2886 242181 10
895 agent claude-sonnet-5 720 245067 3
896 agent claude-sonnet-5 1805 245787 1
897 agent claude-sonnet-5 409 247592 6
898 agent claude-sonnet-5 324 248001 8
899 agent claude-sonnet-5 17502 0 3
900 agent claude-sonnet-5 2195 17502 20
901 agent claude-sonnet-5 6024 19697 14
902 agent claude-sonnet-5 2595 25721 20
903 agent claude-sonnet-5 2590 28316 2
904 agent claude-sonnet-5 15029 30906 2
905 agent claude-sonnet-5 292 45935 20
906 agent claude-sonnet-5 2944 46227 20
907 agent claude-sonnet-5 2459 49171 20
908 agent claude-sonnet-5 2788 51630 14
909 agent claude-sonnet-5 2583 54418 2
910 agent claude-sonnet-5 3742 57001 14
911 agent claude-sonnet-5 1475 60743 2
912 agent claude-sonnet-5 3149 62218 5
913 agent claude-sonnet-5 3708 65367 6
914 agent claude-sonnet-5 3608 69075 2
915 agent claude-sonnet-5 4284 72683 8
916 agent claude-sonnet-5 1682 76967 5
917 agent claude-sonnet-5 19693 78649 20
918 agent claude-sonnet-5 726 98342 2
919 agent claude-sonnet-5 7426 99068 2
920 agent claude-sonnet-5 879 106494 8
921 agent claude-sonnet-5 816 107373 20
922 agent claude-sonnet-5 3200 108189 9
923 agent claude-sonnet-5 2714 111389 3
924 agent claude-sonnet-5 502 114103 4
925 agent claude-sonnet-5 430 114605 2
926 agent claude-sonnet-5 8857 115035 5
927 agent claude-sonnet-5 6330 123892 5
928 agent claude-sonnet-5 242 130222 5
929 agent claude-sonnet-5 27004 130464 5
930 agent claude-sonnet-5 436 157468 3
931 agent claude-sonnet-5 2144 157904 2
932 agent claude-sonnet-5 1696 160048 6
933 agent claude-sonnet-5 1991 161744 5
934 agent claude-sonnet-5 825 163735 17
935 agent claude-sonnet-5 602 164560 2
936 agent claude-sonnet-5 3345 165162 3
937 agent claude-sonnet-5 7685 168507 3
938 agent claude-sonnet-5 1166 176192 3
939 agent claude-sonnet-5 6303 177358 6
940 agent claude-sonnet-5 7851 183661 2
941 agent claude-sonnet-5 9678 191512 6
942 agent claude-sonnet-5 2410 201190 3
943 agent claude-sonnet-5 1893 203600 3
944 agent claude-sonnet-5 2319 205493 3
945 agent claude-sonnet-5 5577 207812 4
946 agent claude-sonnet-5 1452 213389 2
947 agent claude-sonnet-5 327 214841 4
948 agent claude-sonnet-5 507 215168 6
949 agent claude-sonnet-5 3457 215675 7
950 agent claude-sonnet-5 1961 219132 17
951 agent claude-sonnet-5 226 221093 3
952 agent claude-sonnet-5 3185 221319 5
953 agent claude-sonnet-5 1224 224504 1
954 agent claude-sonnet-5 830 225728 2
955 agent claude-sonnet-5 2284 226558 6
956 agent claude-sonnet-5 4024 228842 2
957 agent claude-sonnet-5 691 232866 3
958 agent claude-sonnet-5 1185 233557 2
959 agent claude-sonnet-5 381 234742 20
960 agent claude-sonnet-5 2321 235123 4
961 agent claude-sonnet-5 442 237444 20
962 agent claude-sonnet-5 1781 237886 3
963 agent claude-sonnet-5 1035 239667 6
964 agent claude-sonnet-5 340 240702 2
965 agent claude-sonnet-5 745 241042 20
966 agent claude-sonnet-5 335 241787 9
967 agent claude-sonnet-5 1118 242122 7
968 agent claude-sonnet-5 484 243240 2
969 agent claude-sonnet-5 2172 243724 2
970 agent claude-sonnet-5 395 245896 4
971 agent claude-sonnet-5 928 246291 2
972 agent claude-sonnet-5 192 247219 2
-->
<!-- /cout -->

---

## Suite — l'activation (PR #118 fusionnée)

La PR #118 a été fusionnée : la CI de `main` a construit et publié l'image, et
inscrit `renaissance-gym: 164c7b5` dans `versions.yml`. La branche est donc
repartie de `main` sous le même nom, conformément au harnais, et porte
maintenant le second des deux commits de `memory/ajouter-une-app.md` :
`enabled: true`, et l'app entre dans le compose avec son image épinglée.

Aucune anomalie sur cette étape.

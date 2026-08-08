# Product — pilabelle

<!-- impeccable:product-schema 1 -->

## Users

**Elle** — 46 ans, une prise de poids de +20 kg sur l'année écoulée, motivée
mais sans dix minutes à perdre à chercher quoi faire. Elle n'a pas de passé
sportif récent : elle a besoin d'être guidée pas à pas, avec des mouvements
doux (pilates) adaptés à son corps actuel — pas d'un programme de fitness
générique pensé pour quelqu'un d'entraîné. Elle ouvre l'app le matin ou le
soir, sur son téléphone.

**Vous** — second compte autorisé, en lecture quasi exclusive : vous
consultez pour vérifier que l'app tourne bien, et occasionnellement pour
l'encourager. Vous n'êtes pas administrateur du programme depuis l'app — le
faire depuis l'app ouvrirait une surface qu'elle seule doit contrôler.

Il n'y a pas d'utilisateur anonyme : Traefik authentifie avant que la requête
n'atteigne l'application, et l'identité arrive dans `X-Forwarded-User`
(§ 11).

## Product Purpose

Un programme de pilates doux, quotidien et personnalisé, pour reprendre en
douceur après une prise de poids — pas une bibliothèque d'exercices à
parcourir, mais une séance du jour déjà choisie, chronométrée, et
accompagnée d'une vidéo courte pour chaque mouvement.

Le succès a une seule mesure qui compte : elle ouvre l'app chaque jour sans
réfléchir à ce qu'elle doit faire, et tient la régularité sur la durée. Ce
n'est pas l'intensité d'une séance isolée qui fait la différence sur le
ventre et les cuisses, c'est la répétition sur des semaines — l'application
existe pour rendre cette répétition facile et un peu addictive.

## Capabilities and Constraints

- Un petit questionnaire au premier lancement calibre le programme : niveau
  de départ, douleurs ou limitations, jours disponibles dans la semaine.
- Chaque jour, une séance unique de 10 à 15 minutes : des exercices pilates
  doux ciblant ventre et cuisses, groupés en blocs, chacun avec sa vidéo
  Shorts de démonstration et son chronomètre d'effort/repos.
- Un niveau de difficulté par zone (ventre, cuisses) qui s'ajuste séance
  après séance selon son ressenti — jamais un programme figé à l'avance —,
  un défi qui change chaque semaine, une série de jours réussis à ne pas
  casser, et de petits messages de récompense.
- Pas de suivi de mesures corporelles (poids, tour de taille, photos) :
  l'app se concentre sur l'exécution du programme, pas sur des chiffres
  qu'il faudrait saisir et qui décourageraient plus qu'ils n'aideraient.
- Palier `private` : seuls les comptes de la liste blanche du serveur
  entrent, et le cloisonnement des données (progression, série, réponses au
  questionnaire) se fait par `X-Forwarded-User`, sans compte applicatif.

## Product Principles

**Zéro décision à prendre en ouvrant l'app.** Le seul geste possible à
l'ouverture est « commencer » — jamais un menu, une bibliothèque
d'exercices à choisir, ou un écran qui demande de décider quelque chose.
Chaque décision de plus est une occasion de reposer le téléphone.

**Le chronomètre rythme, il ne surveille pas.** Il dit quand pousser et
quand souffler ; il ne mesure rien, ne compare à personne, et se met en
pause d'un tap sans confirmation.

**Adapté à son corps d'aujourd'hui, pas à un corps de référence.** Aucun
mouvement à impact, aucun saut, aucune position qui suppose une souplesse ou
une force qu'une reprise après un an sans sport ne suppose pas. Le
questionnaire existe pour retirer ce qui ne convient pas avant qu'elle ne le
découvre en séance.

**Le fun est une récompense, jamais une pression.** Série, défis, niveaux :
ils encouragent à revenir, ils ne punissent jamais une pause. Rater un jour
casse une série, jamais le programme.

**Le niveau proposé dit la vérité, il ne fait pas semblant de monter.**
S'il doit redescendre parce qu'une séance était trop dure, il redescend —
tout de suite, sans qu'elle ait à le demander. Protéger son corps prime
toujours sur l'impression de progrès.

**L'app est un compagnon affectueux, pas un coach neutre.** Elle taquine
quand elle ne l'a pas vue, glisse parfois un mot doux — jamais un ton de
surveillance ou de reproche. Une pique sympa dit qu'elle a manqué à
quelqu'un, jamais qu'elle a fauté (§ 7.2, § 10).

**Elle a de l'humour : les piques n'ont pas à rester sages.** La limite
n'est pas la mordacité, c'est la culpabilisation — une pique bien sentie et
un peu culottée reste dans les clous tant qu'elle fait rire plutôt que
culpabiliser. Écrire trop prudent produirait des piques fades, pas des
piques plus sûres.

---

## PRD — Pilabelle : le programme pilates du jour

> Le PRD validé, rapatrié ici : un document par app, dans le répertoire de
> l'app. Aucun PRP n'existe encore — le code n'est pas écrit, seule cette
> fiche produit fixe ce qui sera construit.

| | |
|---|---|
| **Statut** | Validé pour implémentation |
| **Date** | 8 août 2026 |
| **Décideur** | amuteau@gmail.com |
| **Nom d'application** | `pilabelle` → `pilabelle.apps.billbob.ovh` |
| **Palier d'exposition** | `private` — comptes de la liste blanche du serveur uniquement |

---

### 1. En une phrase

Une page web que votre femme ouvre chaque jour pour faire sa séance de
pilates doux du jour — 10 à 15 minutes, guidée par des vidéos courtes et des
chronomètres, avec un défi qui la fait revenir le lendemain.

### 2. Le problème

Elle est motivée, mais la motivation seule ne construit pas un programme :
il faudrait savoir quels mouvements sont adaptés à 46 ans et à une prise de
poids récente, dans quel ordre les enchaîner, combien de temps tenir chaque
position, où trouver une démonstration fiable, et comment ne pas abandonner
au bout d'une semaine une fois la nouveauté passée.

Sans application, chaque jour recommence cette délibération à zéro — et
c'est cette friction, pas le manque de volonté, qui fait qu'un programme
personnel s'arrête au bout de quelques jours. L'application ne remplace pas
un coach : elle transforme une intention en un geste quotidien de dix
minutes, déjà décidé, déjà chronométré, déjà illustré.

### 3. Utilisateurs

**Elle**, seule utilisatrice active. Elle ouvre l'app une fois par jour,
suit la séance affichée du début à la fin, et n'a rien d'autre à faire que
suivre : pas de bibliothèque à explorer, pas de réglage à toucher une fois
le questionnaire initial passé.

**Vous**, lecteur passif. Vous partagez le même palier d'accès qu'elle parce
que la liste blanche du serveur ne distingue pas les deux comptes autrement,
mais l'app n'a pas besoin de vous proposer un écran différent : voir ce
qu'elle voit suffit à vérifier que tout fonctionne.

### 4. Objectifs et mesures de succès

| Objectif | Mesure | Cible |
|---|---|---|
| L'app est ouverte tous les jours | Longueur de la série en cours | croît, ou repart sans culpabiliser après une pause |
| La séance va au bout | Part des séances commencées qui sont terminées | > 80 % |
| Le programme reste adapté | Aucune douleur ou gêne rapportée liée à un mouvement | zéro signalement |
| L'entrée est immédiate | Temps entre l'ouverture de l'app et le premier exercice affiché | quelques secondes, questionnaire initial mis à part |

Une seule utilisatrice active : ces chiffres se lisent à l'œil dans l'app
elle-même (série affichée, historique des séances), sans tableau de bord ni
instrumentation dédiée.

### 5. Principe directeur : zéro décision à l'ouverture

L'écran d'accueil n'affiche qu'une chose : la séance du jour, prête à
démarrer. Pas de menu « choisir un programme », pas de liste d'exercices à
parcourir, pas de réglage à ajuster avant de commencer. Tout ce qui
personnalise la séance (niveau, contraintes, jours disponibles) a été
décidé une fois, au questionnaire initial, et se corrige depuis un écran de
réglages séparé — jamais en repassant par l'écran du jour.

C'est ce principe qui distingue l'application d'une bibliothèque
d'exercices : une bibliothèque demande de savoir quoi choisir, ce qui est
précisément ce que quelqu'un qui reprend le sport après une longue pause ne
sait pas encore faire seul.

### 6. Périmètre

#### Lot 1 — le socle quotidien

1. **Questionnaire initial** : niveau de départ (débutante / a déjà pratiqué
   du pilates), douleurs ou limitations (genoux, dos, épaules...), nombre de
   jours disponibles dans la semaine. Modifiable ensuite depuis les
   réglages.
2. **Écran du jour** : la séance prévue aujourd'hui — sa durée, le nombre
   d'exercices, un bouton « commencer ». Un jour de repos affiche un message
   de repos, pas un écran vide.
3. **Écran de séance** : les exercices du jour, un par un, chacun avec sa
   vidéo Shorts, son chronomètre d'effort/repos, et une consigne courte
   (position, respiration, ce qu'il faut sentir).
4. **Chronomètre** : compte à rebours audible et visuel pour chaque phase
   (effort, tenue, repos), passage automatique à l'exercice suivant en fin
   de temps, pause possible à tout moment d'un tap.
5. **Ressenti de fin de séance** : un seul tap parmi facile / correct /
   difficile, jamais optionnel — c'est le seul signal dont dépend la séance
   du lendemain (§ 8).
6. **Dictionnaire d'exercices et algorithme de sélection quotidienne** : le
   cœur de l'application. Chaque jour, la séance n'est pas relue depuis un
   programme écrit à l'avance mais **calculée** — un exercice par zone est
   choisi dans le dictionnaire selon le niveau courant de cette zone et les
   limitations déclarées (§ 8).
7. **Fin de séance** : récapitulatif de ce qui vient d'être fait, mise à
   jour de la série en cours, message de récompense.
8. **Persistance de la progression** : niveau courant par zone, historique
   des ressentis et des séances faites, série — associés au compte via
   `X-Forwarded-User`, retrouvés à la reconnexion, sur n'importe quel
   appareil.
9. **Petits mots** : une pique affectueuse de retrouvailles quand elle
   revient après un jour sans séance (§ 7.2), organisée en plusieurs
   familles selon la durée de l'absence pour rester vraie et variée, et de
   temps en temps un mot doux en fin de séance (§ 10.1) — tirés de stocks
   de messages écrits une fois, livrés avec l'application comme le
   dictionnaire d'exercices.

#### Lot 2 — dès que le lot 1 est en ligne

10. **Défi de la semaine** : une variante ou un petit objectif
    supplémentaire annoncé en début de semaine, distinct de la séance
    quotidienne calculée.
11. **Écran personnel** : série actuelle et record, calendrier des séances
    faites/manquées/repos, niveau courant de chaque zone.

#### Hors périmètre — décidé, pas oublié

- **Suivi de mesures corporelles** (poids, tour de taille/cuisses, photos) :
  demandé explicitement en amont et écarté — l'app mesure la régularité, pas
  le corps. Une levée future demanderait de rouvrir ce point, pas de
  l'ajouter en silence.
- **Recherche ou génération dynamique de vidéos** : les vidéos sont une
  sélection fixe, choisie à la main par exercice (§ 8), jamais une requête
  à l'API YouTube au moment de l'affichage.
- **Édition du dictionnaire depuis l'app** par vous ou par elle : les
  exercices, leurs niveaux et leurs vidéos sont un fichier de données livré
  avec l'application, pas un écran d'administration.
- **Notifications, rappels push ou par e-mail.**
- **Historique de plusieurs profils** : une seule utilisatrice active ; le
  compte visualiseur (vous) n'a pas de progression propre à conserver.
- **Comparaison ou classement entre utilisateurs** : à deux comptes dont un
  seul s'entraîne, un classement ne mesurerait rien.

### 7. Parcours

#### 7.1 Premier lancement

Elle ouvre le lien, déjà authentifiée par Traefik. L'app détecte l'absence
de profil pour son compte et enchaîne directement sur le questionnaire :
quelques questions à choix simple (niveau, douleurs/limitations, jours
disponibles), pas de champ libre à remplir. À la fin, elle arrive
directement sur l'écran du jour avec sa première séance déjà calculée.

#### 7.2 Retour quotidien

Ouvrir le lien, c'est arriver sur la séance du jour — jamais un écran
intermédiaire. Si elle a déjà fait la séance aujourd'hui, l'écran le dit et
propose de la refaire librement, sans que cela ne compte deux fois dans
l'historique.

**Si le dernier jour de séance remonte à hier ou plus**, l'écran du jour
s'ouvre sur une pique de retrouvailles avant d'afficher la séance — jamais
un compteur de jours manqués, jamais un ton de reproche. La pique est tirée
dans la famille qui correspond à la durée réelle de l'absence (§ 10.1),
pour ne jamais dire un « hier » qui serait faux après une semaine de
silence. Pour une absence d'un jour, par exemple : *« Bah alors, on ne
s'est pas vu hier 😙. Tu m'as manqué. »* Elle s'affiche une fois puis laisse
place à la séance — ce n'est pas un écran à fermer, juste une phrase avant
le reste.

#### 7.3 Faire une séance

L'écran de séance montre l'exercice courant, pas la liste complète à
l'avance : à ce niveau de reprise, voir dix exercices d'un coup décourage
plus qu'il n'informe. Chaque exercice affiche sa vidéo Shorts en lecture
automatique et silencieuse, une consigne courte, et son chronomètre.

Le chronomètre démarre sur un geste explicite (« prête »), jamais tout
seul : elle doit avoir le temps de se mettre en position en regardant la
vidéo avant que le compte à rebours ne commence. Il peut être mis en pause
à tout moment sans confirmation — une pause pour souffler ne doit rien
coûter.

En fin de temps, passage automatique à l'exercice suivant, avec un court
répit avant que le chronomètre suivant ne démarre. Le dernier exercice
terminé déclenche l'écran de fin de séance.

#### 7.4 Fin de séance

D'abord le ressenti — un tap parmi trois émojis, facile / correct /
difficile, obligatoire mais immédiat. Puis l'écran de récompense : séance
validée, série mise à jour, message d'encouragement qui varie (jamais le
même deux fois de suite). Si un défi de la semaine était rattaché à cette
séance, il est marqué comme relevé ici.

Le ressenti n'est jamais montré comme une évaluation : aucun chiffre, aucun
« tu as fait moins bien qu'hier ». Il sert à calculer la séance de demain
(§ 8), pas à juger celle d'aujourd'hui.

#### 7.5 Réglages

Accessible depuis un menu discret, jamais imposé : revoir ou modifier les
réponses du questionnaire initial (douleurs apparues, jours disponibles qui
changent). Modifier le niveau recalcule le programme à partir du lendemain,
jamais en rétroactif sur les séances déjà faites.

### 8. Le programme

Structure d'une séance, stable d'un jour à l'autre pour ne jamais surprendre :

1. **Mise en route** (1 à 2 min) — respiration et mobilisation douce, aucun
   chronomètre d'effort, juste un compte à rebours de mise en train.
2. **Bloc ventre** (4 à 5 min) — gainage doux et travail du transverse,
   variantes au sol, genoux pliés par défaut.
3. **Bloc cuisses et fessiers** (4 à 5 min) — mouvements à faible impact,
   jamais de saut, appui au sol ou sur une chaise pour l'équilibre.
4. **Retour au calme** (1 à 2 min) — étirements tenus, respiration.

Ce que ces blocs contiennent n'est plus écrit à l'avance semaine par
semaine : c'est **calculé chaque jour** à partir d'un dictionnaire
d'exercices et du niveau courant de chaque zone. C'est le changement central
de ce document par rapport à sa première version : le programme ne suit
plus un calendrier, il répond à ce qui s'est passé la veille.

#### 8.1 Le dictionnaire d'exercices

Un catalogue d'exercices, plus grand que ce qu'une seule semaine
utiliserait, organisé pour que l'algorithme (§ 8.2) puisse y choisir sans
jamais improviser. Chaque exercice du dictionnaire porte :

- **une zone** — ventre, cuisses/fessiers, mise en route, ou retour au
  calme ;
- **une famille de mouvement** — par exemple « gainage », « pont fessier »,
  « rotation du buste » : plusieurs exercices d'une même famille sont des
  variantes les uns des autres, du plus doux au plus soutenu ;
- **un niveau de difficulté**, du plus doux au plus soutenu (une échelle à
  quatre crans suffit : découverte, en confiance, soutenu, avancé) ;
- **des étiquettes de contre-indication** — genou, dos, épaule... — qui
  disent quand cet exercice doit être écarté ;
- sa vidéo Shorts associée et sa consigne courte, comme avant ;
- son minutage (durée de tenue ou nombre de répétitions lentes, temps de
  repos, nombre de tours), qui croît avec le niveau de l'exercice.

Construire ce catalogue (rédiger les exercices, les classer, leur associer
une vidéo) est un travail de contenu, pas de code — il précède ou accompagne
l'implémentation du lot 1, pas après. Une première version rédigée vit dans
[`exercices.md`](exercices.md), à côté de ce document ; elle sera reprise
sous la forme de données que l'implémentation choisira (§ 12), mais son
contenu — les exercices, leurs niveaux, leurs contre-indications, leurs
vidéos — ne change pas dans la conversion.

Le dictionnaire est **séparé du code**, comme l'était le programme dans la
première version de ce document : y ajouter un exercice, corriger une
vidéo, ou reclasser un niveau ne doit jamais demander de toucher à
l'application.

#### 8.2 L'algorithme de sélection quotidienne

**Chaque zone a son propre niveau courant**, indépendant des autres —
ventre et cuisses peuvent donc diverger au fil des semaines. Le niveau de
départ de chaque zone est déduit du questionnaire initial (§ 6, item 1).

Chaque jour, pour chaque zone du bloc du jour, l'algorithme :

1. écarte du dictionnaire tout exercice qui porte une étiquette de
   contre-indication déclarée par elle ;
2. parmi ce qui reste, retient les exercices dont le niveau correspond au
   niveau courant de la zone ;
3. évite l'exercice fait la veille dans cette même zone, s'il existe une
   autre option au même niveau — pour que deux jours de suite ne se
   ressemblent pas trop ;
4. choisit un exercice parmi ce qui reste.

**Après la séance, le ressenti (§ 7.4) ajuste le niveau des zones
travaillées ce jour-là** — ventre et cuisses reçoivent le même signal
puisqu'un seul ressenti est demandé par séance, mais chacun l'applique à sa
propre trajectoire :

- **difficile** fait redescendre immédiatement le niveau de la zone d'un
  cran, sans attendre une confirmation les jours suivants — protéger le
  corps passe avant de préserver l'impression de progrès ;
- **facile** plusieurs séances de suite sur la même zone (trois, pour ne
  pas réagir à un jour de forme isolé) fait monter le niveau d'un cran ;
- **correct** ne change rien.

**Un plancher et un plafond, jamais franchis.** Le niveau d'une zone ne
descend jamais sous le niveau le plus bas compatible avec ses limitations
déclarées — en dessous, il n'y aurait plus rien à proposer. Il ne monte
jamais au-delà du niveau le plus élevé que le dictionnaire propose pour
cette zone.

**Les vidéos** restent une sélection organisée à la main, une par exercice
du dictionnaire — jamais une recherche automatique au moment de
l'affichage, pour garantir que ce qui s'affiche est toujours pertinent et
adapté.

### 9. Règles métier

**Une séance manquée ne se rattrape pas, elle ne se cumule pas non plus.**
Le programme du jour est celui du jour ; un jour sans séance est un jour de
repos ou une pause, jamais une dette qui s'accumule dans un écran de retard.

**La série se casse au premier jour manqué, et repart aussitôt à zéro sans
message culpabilisant.** L'écran affiche le fait, pas un jugement : une
série cassée n'est pas un échec du programme. Le retour, lui, est accueilli
par une pique affectueuse (§ 7.2), pas par un rappel du compteur perdu —
les deux disent des choses opposées, et seule la seconde a sa place ici.

**Le niveau de chaque zone est indépendant et honnête.** Ventre et cuisses
évoluent séparément ; aucun des deux n'est plafonné ni tiré par l'autre. Il
redescend dès qu'une séance a été difficile et remonte seulement après
plusieurs séances faciles d'affilée — jamais l'inverse, jamais de badge
séparé qui prétendrait ne monter que dans un sens (§ 8.2).

**Une pause longue ne fait pas redescendre le niveau tout seul.** Seul un
ressenti « difficile » le fait baisser ; ne pas s'entraîner pendant deux
semaines et revenir ne recalcule rien tant qu'aucune séance n'a été faite.

**Le défi de la semaine est optionnel et n'affecte jamais la série
principale.** Le rater ne casse rien ; le relever ajoute une récompense en
plus, jamais une pénalité en son absence.

**Aucun chiffre corporel n'est jamais demandé ni affiché.** Ni poids, ni
mensuration, ni calorie : les seules données de progression sont
l'exécution du programme (séances faites, série) et le ressenti déclaratif
qui ajuste le niveau — jamais une mesure du corps.

### 10. Le fun, et où il doit être

**Le ton tutoie, encourage, ne moralise jamais.** Pas de vocabulaire de
coach culpabilisant, pas de comparaison à un idéal. Un rappel d'un jour
manqué a le droit d'exister (§ 7.2) — mais seulement sous forme de pique
affectueuse, jamais de reproche : la nuance tient tout entière dans « tu
m'as manqué » contre « tu as raté ta séance ».

- **Fin d'exercice** : une transition courte, satisfaisante, qui ne retarde
  jamais le passage au suivant.
- **Fin de séance** : le moment fort — série mise à jour, message
  d'encouragement qui change, éventuellement le défi de la semaine marqué
  comme relevé.
- **Passage à un niveau supérieur** sur une zone : mis en avant
  explicitement, une seule fois, le jour où il se débloque. Une redescente
  de niveau, elle, ne s'accompagne d'aucune animation — ni pénalité ni
  fanfare, juste un fait.

#### 10.1 Les piques et les mots doux

Deux stocks distincts, tous deux écrits par vous, tous deux pensés pour ne
jamais devenir une formule répétée.

**Les piques de retrouvailles** (§ 7.2) sont rangées en plusieurs
familles selon la durée réelle de l'absence — une absence d'un jour
n'appelle pas le même mot qu'une semaine de silence, et le texte ne doit
jamais prétendre « hier » si ce n'est pas vrai. Trois familles suffisent :
un jour, quelques jours (deux à six), une semaine ou plus. Chaque famille
contient plusieurs variantes, et les variantes changent aussi de **registre**
d'une à l'autre — taquinerie légère, clin d'œil complice, pique bien
sentie et un peu culottée — de sorte que deux retours à durée d'absence
égale ne sonnent jamais pareil. Elle a de l'humour : le registre le plus
mordant n'est pas à mettre de côté par prudence, tant qu'il fait rire plutôt
que peser (§ Product Principles).

**Les mots doux** viennent en plus des messages d'encouragement neutres
(« bravo, séance faite ! ») : un mot plus tendre apparaît de temps en
temps en fin de séance, pas à chaque fois, pour que ça reste une surprise
plutôt qu'une routine prévisible. Ce ne sont pas des félicitations
d'application, ce sont des mots que vous lui adressez.

Règle commune aux deux stocks : jamais deux fois de suite le même message,
et un ton toujours personnel, jamais générique de « coach ».

Deux interdits : rien qui bloque l'interaction pendant l'effort ou pendant
le chronomètre, et `prefers-reduced-motion` respecté — l'app reste
utilisable et lisible sans une seule animation.

### 11. Contraintes

**Mobile uniquement, iOS et Android, pas seulement mobile d'abord.** Elle
est sur iPhone, vous êtes sur Android : l'app doit marcher pour les deux
comptes autorisés, pas seulement pour l'un d'eux. Ouverte sur téléphone,
souvent posé au sol ou contre un mur pendant l'exercice : gros boutons,
lisible à distance, aucune interaction qui suppose de tenir l'appareil en
main pendant le mouvement. Aucune mise en page de bureau ni de tablette
n'est nécessaire — mais aucun des deux systèmes mobiles n'est un cas
secondaire. La mise en page compte avec les zones sûres de l'écran
(encoche, île dynamique ou barre de statut selon l'appareil, barre de
navigation en bas) plutôt qu'avec un cadre unique pensé pour un seul OS.

**Direction visuelle : légèrement kawaii, jamais infantilisant.** Couleurs
douces, formes arrondies, une pointe de mignon dans les icônes et les
transitions — cohérent avec le ton tendre et taquin déjà décrit (§ 10.1),
pas avec l'univers d'une appli pour enfants. Le kawaii sert le côté doux et
personnel de l'app, il ne remplace jamais la lisibilité ni les gros boutons
exigés plus haut : une exécution mignonne mais illisible en plein effort
raterait l'objectif.

**Vidéos en lecture intégrée**, hébergées sur YouTube (Shorts), jamais
re-téléchargées ni stockées par l'application — l'app n'héberge que la
liste qui les associe aux exercices.

**Identité par `X-Forwarded-User`, jamais de compte applicatif.** L'en-tête
posé par Traefik est la seule source d'identité admissible pour cloisonner
le questionnaire, la progression et la série entre les deux comptes
autorisés. Aucun mot de passe, aucune inscription, aucun champ d'identité
saisi dans l'app.

**Rien de sensible ne transite ni ne se stocke** au-delà des réponses au
questionnaire (niveau, limitations, jours disponibles) et de la progression
(séances faites, série, niveau courant par zone, historique des ressentis)
— aucune mesure corporelle, aucune photo.

**Français** pour l'interface, la documentation et le code.

**Démarrage sans intervention**, comme toute application de la fabrique :
ni migration manuelle, ni fichier à créer à la main.

### 12. Dépendances et prérequis de mise en ligne

**La progression doit survivre à un redéploiement.** Une série ou un niveau
de zone remis à zéro à chaque publication d'image romprait exactement ce
que l'application cherche à construire — un volume nommé est nécessaire dès
le lot 1 (voir `memory/volumes.md` au moment de l'implémentation).

**Le dictionnaire d'exercices est un travail de contenu, pas de code**, à
mener avant ou pendant l'implémentation du lot 1 : rédiger un nombre
suffisant d'exercices par zone et par niveau pour que l'algorithme de
sélection (§ 8.2) ait toujours au moins une option valide, et identifier
pour chacun un Short pilates doux et adapté. Un dictionnaire trop petit fait
échouer l'algorithme en silence — plus de variantes que ce qu'une semaine
n'en épuiserait est le seuil à viser, pas un chiffre exact.

**Une vidéo n'entre dans le dictionnaire qu'après vérification, jamais sur
la seule confiance d'un lien qui a l'air bon.** Cinq conditions, toutes
requises :

1. le lien pointe vers une vidéo YouTube réelle et existante — jamais une
   URL construite ou devinée à partir d'un motif probable ;
2. la vidéo est publique, non privée, non supprimée, non restreinte par
   âge ou par pays au moment de la vérification ;
3. elle montre bien le geste nommé par l'exercice, pas une variante ou un
   exercice voisin ;
4. elle reste compréhensible **sans le son** — la lecture est silencieuse
   par défaut (§ 7.3) — donc le mouvement doit se lire à l'image ;
5. son format est court (Shorts ou équivalent, quelques dizaines de
   secondes), sans publicité intrusive ni filigrane d'une marque
   concurrente qui prêterait à confusion.

Un lien qui échoue franchement sur un de ces cinq points reste marqué « à
rechercher » dans `exercices.md` plutôt que d'être renseigné à moitié — un
mauvais lien découvert par elle en séance coûte plus cher qu'un exercice
provisoirement sans vidéo. Un lien trouvé par une recherche réelle et
confirmé public, mais dont la condition 3 (le bon geste) ne peut être
confirmée que par le titre plutôt que par un visionnage, reste dans le
dictionnaire sous un troisième état, **« à valider »** : il est utilisable
dès maintenant, à revoir une fois avant que le lot 1 ne soit mis en ligne.
Ce n'est ni « bon » ni « à rechercher », et confondre les deux cacherait
justement ce qu'il reste à vérifier.

**Les piques de retrouvailles et les mots doux (§ 7.2, § 10.1) sont eux
aussi un travail de contenu**, écrit une fois avant la mise en ligne du
lot 1 : assez de variantes dans chaque famille de piques (un jour, quelques
jours, une semaine ou plus) et dans le stock de mots doux pour ne pas se
répéter d'une semaine sur l'autre. Vous les écrivez vous-même — c'est le
seul contenu de l'application qui gagne à être écrit par vous plutôt que
déduit du PRD.

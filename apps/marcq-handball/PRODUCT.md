# Product — marcq-handball

<!-- impeccable:product-schema 1 -->

## Users

**L'enfant de 13-14 ans** est l'utilisateur principal et le seul dont
l'engagement décide du succès. Il ouvre l'app sur son téléphone, dehors,
parfois en 4G, entre deux séries. Il n'a pas nécessairement de compte Google ni
d'adresse à lui, et il abandonnera à la deuxième friction.

**Le parent** est un utilisateur de substitution : c'est lui qui doit être en
position de décider si quelque chose de son enfant part sur un serveur.

**Le coach** est un lecteur, pas un contributeur. Ce qu'il veut savoir le
20 août : dans quel état il récupère son groupe.

## Product Purpose

Le coach a envoyé son programme d'avant-reprise dans une note de téléphone :
trois pages, sept séances du 3 au 21 août. Un document envoyé une fois ne dit
ni où on en est, ni ce qu'il y a à faire aujourd'hui, ne récompense rien, et
n'apprend à personne qui s'entraîne réellement. L'application n'ajoute aucun
contenu : elle transforme ce texte en un parcours qui se coche, se mesure et se
compare.

## Capabilities and Constraints

- Aucun compte, aucun mot de passe, aucune installation. Un lien qui s'ouvre.
- Le prénom de l'enfant ne quitte jamais son appareil. Le serveur ne le connaît
  pas.
- Le programme vit dans un fichier de données éditable, séparé du code : le
  modifier ne demande pas de toucher au code, et les totaux affichés en sont
  recalculés.
- Le passé se corrige, l'avenir ne se coche pas.
- Les jours sans séance sont du repos, pas un trou.
- L'app reste utilisable réseau coupé ; seul le classement demande le réseau, et
  son absence n'empêche jamais de s'entraîner.
- Mobile d'abord : zones de tap larges, contraste lisible en plein soleil,
  aucune interaction dépendant du survol, `prefers-reduced-motion` respecté.
- L'application porte les couleurs du club, relevées sur son blason, et le
  blason lui-même. Les deux lignes du terrain de handball lui servent de
  grammaire, et une police d'affichage est servie par l'app. Le détail
  au § 16.5.
- Hors périmètre, décidé et non oublié : édition du programme depuis l'app,
  messagerie, notifications, saisie du nombre réellement effectué, historique
  multi-saisons. Le minuteur d'exercice et les liens vidéo en sortaient ; ils
  ont été rouverts après la livraison, et le § 16 dit à quelles conditions.

## Product Principles

**Par défaut, rien ne quitte le téléphone.** L'URL est publique et finira par
être trouvée : tout ce qui est envoyé au serveur doit être considéré comme
lisible par tous. Ce qui part se limite à ce que l'enfant a explicitement
choisi d'exposer, sous le nom qu'il a choisi.

**Le système est déclaratif, et assumé comme tel.** Cocher les 15 pompes vaut
déclaration de 15 pompes. Une équipe de gamins qui se connaissent : la triche
se voit au vestiaire.

**L'animation est une récompense, jamais un péage.** Elle vient après l'action,
ne retarde aucun tap, et ne s'interpose jamais entre l'enfant et la case
suivante.

**Le ton tutoie sans infantiliser.** Ce sont des joueurs de U15. Pas de
mascotte, pas de badge à collectionner, pas de vocabulaire de coach américain.

---

## PRD — Marcq Handball U15 : le programme d'été

> Le PRD validé, rapatrié ici : un document par app, dans le répertoire de
> l'app. Les PRP de [`prp/`](prp/README.md) citent ses numéros de section
> (« §7.4 », « §12.1 ») — ils ne bougent pas.

| | |
|---|---|
| **Statut** | Validé pour implémentation — lot 1 |
| **Date** | 3 août 2026 |
| **Décideur** | amuteau@gmail.com |
| **Nom d'application** | `marcq-handball` → `marcq-handball.apps.billbob.ovh` |
| **Palier d'exposition** | `public` — accessible sans compte |
| **Échéance dure** | Le programme court du 3 au 21 août 2026. Il a commencé. |

---

### 1. En une phrase

Une page web que les ados de 13-14 ans d'une équipe ouvrent sans compte, sans
installation et sans mot de passe, pour cocher les exercices du programme
d'été de leur coach, voir leur progression, et se comparer aux autres s'ils
le veulent bien.

### 2. Le problème

Le coach a envoyé le programme d'avant-reprise dans une note de téléphone :
trois pages de texte, sept séances réparties du 3 au 21 août, avant le retour
en salle. Un document envoyé une fois ne fait rien de tout ça :

- il ne dit pas **où on en est** — il faut se souvenir de ce qu'on a fait ;
- il ne dit pas **ce qu'il y a à faire aujourd'hui** — il faut retrouver la
  bonne section dans une capture d'écran ;
- il ne **récompense rien** — un exercice fait ressemble exactement à un
  exercice sauté ;
- il ne dit ni à l'enfant, ni au coach, **qui s'entraîne réellement**.

Sur trois semaines de vacances, sans entraînement collectif pour tenir le
rythme, l'écart entre le programme envoyé et le programme fait est le vrai
sujet. L'application n'ajoute pas de contenu : elle transforme un texte en
un parcours qui se coche, se mesure et se compare.

### 3. Utilisateurs

**L'enfant (13-14 ans)** est l'utilisateur principal et le seul dont
l'engagement décide du succès. Il ouvre l'app sur son téléphone, souvent
dehors, parfois en 4G, entre deux séries. Il n'a pas nécessairement de compte
Google ni d'adresse e-mail à lui. Il abandonnera à la deuxième friction.

**Le parent** est un utilisateur de substitution : il peut ouvrir l'app à la
place de l'enfant, l'aider à démarrer, et c'est lui qui doit être en position
de décider si le prénom de son enfant part sur un serveur.

**Le coach** est un lecteur, pas un contributeur. Il ne saisit rien —
le programme lui appartient mais il l'a déjà écrit. Ce qu'il veut savoir le
20 août : dans quel état il récupère son groupe.

### 4. Objectifs et mesures de succès

| Objectif | Mesure | Cible |
|---|---|---|
| Le programme est suivi, pas seulement reçu | Part des exercices cochés sur l'ensemble du programme | > 60 % |
| L'app tient sur la durée | Part de l'effectif encore active à la séance du 17 août | > 50 % |
| L'entrée est sans friction | Enfants qui atteignent la première séance après avoir ouvert le lien | > 90 % |
| Le coach y gagne | Il consulte le bilan avant la reprise du 21 | au moins une fois |

Ces chiffres sont des repères de décision, pas des indicateurs à instrumenter :
sur un effectif de cet ordre — une équipe, pas une cohorte — un comptage manuel
depuis le classement suffit.

**L'effectif exact n'est pas connu et le produit n'en dépend pas.** Aucun écran
n'affiche un total d'équipe, aucune cible n'est exprimée en nombre absolu, et
rien ne suppose que tout le monde participe. Une équipe de dix comme de vingt
doit fonctionner sans changer une ligne.

### 5. Le principe directeur : par défaut, rien ne quitte le téléphone

L'application est **publique** — accessible sans compte, sans authentification,
par n'importe qui. C'est un choix assumé : aucune famille ne doit être bloquée
un soir de séance parce qu'une adresse n'a pas été inscrite quelque part.

Ce choix a une conséquence qui structure tout le reste : **une URL publique
finit toujours par être trouvée** — les certificats TLS sont publiés dans les
journaux publics de Certificate Transparency, et la page est indexable. Tout ce
qui est envoyé au serveur doit donc être considéré comme lisible par tous.

D'où la règle qui prime sur toutes les autres :

> **Le prénom de l'enfant ne quitte jamais son appareil.**
> Il est stocké localement, sert à l'accueillir (« Salut Lucas ») et à rien
> d'autre. Le serveur ne le connaît pas.

Ce qui est envoyé au serveur se limite à ce que l'enfant a explicitement choisi
d'exposer, sous le nom qu'il a choisi d'exposer. Aucune donnée nominative de
mineur ne quitte le téléphone sans un acte volontaire, précédé d'un message
de consentement.

Cette règle n'est pas une précaution abstraite. Sans elle, l'application
publierait à l'adresse d'un club nommé la liste des prénoms des mineurs d'une
équipe identifiable, avec leur activité jour par jour. Avec elle, ce que
l'application expose au pire est une liste de pseudonymes et de pourcentages.

### 6. Périmètre

#### Lot 1 — à mettre en ligne sous 48 h

Le programme a commencé le 3 août. Chaque jour de retard est une séance perdue
pour de bon. Le lot 1 est ce qui doit exister pour que l'app serve dès la
première semaine :

1. **Saisie du prénom** au premier lancement, mémorisé localement, modifiable.
2. **Écran du jour** : la séance prévue aujourd'hui, ou la prochaine, ou le
   message de repos.
3. **Écran de séance** : la liste complète des exercices, chacun cochable d'un
   tap, avec la progression de la séance en direct.
4. **Rattrapage** : toute séance passée reste librement cochable et
   décochable ; les séances à venir sont visibles mais non cochables.
5. **Écran perso** : progression globale, volume cumulé, calendrier des
   séances.
6. **Persistance locale** : tout est retrouvé à la réouverture, sans compte.
7. **Animations de récompense** sur la validation d'un exercice et d'une séance.

#### Lot 2 — dès que le lot 1 est en ligne

8. **Consentement et opt-in au classement**, avec choix du pseudonyme.
9. **Classement de l'équipe** : podium des trois premiers pseudonymes, et sa
   propre position pour tous, y compris ceux qui n'ont pas rejoint.
10. **Ressenti de fin de séance** : trois émojis, un tap.
11. **Vue coach** : état agrégé du groupe.

#### Lot 3 — avant le 21 août

12. **Écran de bilan** : au-delà du 21 août, l'app bascule sur le récapitulatif
    de ce qui a été accompli, au lieu de rester figée sur un programme terminé.

#### Hors périmètre — décidé, pas oublié

- Édition du programme par le coach depuis l'application.
- Messagerie, commentaires, réactions entre enfants.
- Notifications push, rappels par e-mail ou SMS.
- Saisie du nombre réellement effectué (voir § 13).
- Historique multi-saisons, comptes durables.

Deux exclusions ont été levées après la livraison des onze PRP — le minuteur
d'exercice et les liens vidéo de démonstration. Elles ne sont pas retirées de
ce paragraphe par oubli : elles y étaient pour des raisons qui tenaient, et ce
qui a changé est écrit au § 16. Une exclusion qui disparaît sans laisser
d'adresse est une décision perdue.

### 7. Parcours

#### 7.1 Premier lancement

L'enfant ouvre le lien reçu sur le groupe de l'équipe. Une seule chose lui est
demandée : **son prénom**. Un champ, un bouton. Pas de mot de passe, pas
d'e-mail, pas de date de naissance, pas d'écran de bienvenue à faire défiler.

Sous le champ, une phrase courte : *« Ton prénom reste sur ton téléphone. »*
C'est vrai, et c'est ce qui rend l'absence de compte crédible plutôt que
suspecte.

Il arrive directement sur l'écran du jour.

#### 7.2 Retour

L'app le reconnaît et l'accueille par son prénom. Aucune étape intermédiaire :
ouvrir le lien, c'est être dans le programme.

Depuis les réglages, il peut **corriger son prénom** (faute de frappe) ou
**supprimer son profil** — un frère, une sœur, un téléphone partagé, ou un
profil créé par erreur — : deux gestes distincts, le premier garde la
progression, le second repart à zéro et le dit clairement avant d'agir. Le
second **emporte aussi le nom au classement**, s'il y en a un (§ 16.6) ; il
s'appelait « changer d'enfant » et ne le faisait pas.

Un troisième geste apparaît pour qui a rejoint le classement : **quitter le
classement**, qui retire le nom en laissant la progression sur le téléphone.
C'est le geste doux ; supprimer son profil est le geste total.

#### 7.3 Faire une séance

L'écran de séance montre **la liste complète**, pas un exercice à la fois : à
13 ans on veut savoir ce qui reste avant de commencer. Chaque ligne est une
zone de tap large — l'app est utilisée avec les mains moites, en extérieur,
au soleil.

Les exercices sont groupés comme le coach les a écrits : **Course**, puis
**Renforcement**, avec le nombre de tours affiché.

Cocher un exercice le barre et fait avancer la progression de la séance.
Décocher est toujours possible, sans confirmation : l'erreur de tap doit coûter
un tap, pas un dialogue.

Quand le dernier exercice est coché, la séance se valide : animation de
récompense, et le ressenti est proposé (lot 2) — trois émojis, facile /
correct / dur, un seul tap, jamais obligatoire.

#### 7.4 Rejoindre le classement — l'écran de consentement

Le classement n'est **pas actif par défaut**. L'écran de stats affiche la
position de l'enfant parmi les participants, et un bouton : *« Apparaître au
classement »*.

C'est là, et seulement là, que le message de consentement apparaît — au moment
où il y a un vrai choix à faire, pas noyé dans un écran d'accueil que personne
ne lit :

> **Avant de rejoindre le classement**
>
> Le nom que tu choisis ici sera visible **par tout le monde sur Internet**,
> avec ta progression. Cette page n'est pas protégée par un mot de passe.
>
> Ton prénom, lui, reste sur ton téléphone.
>
> **Montre cet écran à un parent avant de continuer.**
>
> [ Choisir un nom et rejoindre ]  [ Non merci ]

S'il continue, l'app lui **propose un pseudonyme** — pas son prénom. Il peut le
remplacer par ce qu'il veut, y compris son prénom : c'est son choix, il a été
informé de ce qu'il implique.

Il choisit aussi un **code à 4 chiffres**, dont la fonction est énoncée sans
exagération : il empêche quelqu'un d'autre de modifier son score depuis un autre
téléphone. Ce n'est pas un mot de passe protégeant des données sensibles — il
n'y en a pas sur le serveur.

« Non merci » est un choix complet, pas une punition : il continue à voir sa
position et la progression du groupe.

#### 7.5 Regarder les stats

Deux niveaux, **et depuis le 7 août deux écrans** : « Ma progression » et
« L'équipe » ont chacun leur onglet. Le second niveau d'un document n'est pas
le bas d'un écran — la comparaison placée sous un calendrier de dix-neuf jours
n'était atteignable qu'en déroulant, donc nulle part (§ 16.2). Un onglet
respecte le même ordre sans le payer : il ne devance personne, il se choisit.

**Ma progression** — ce qui se lit sans se comparer à personne :
- part du programme accompli à ce jour ;
- volume cumulé **accompli**, en langage d'ado : *« 112 pompes, 165 squats,
  45 burpees, 2 h 10 de course »* — la somme de ce qui a été coché, pas le
  total du programme (§ 8) ;
- calendrier des sept séances : faite, manquée, à venir, repos.

**L'équipe** — la comparaison :
- **podium** des trois meilleurs scores — trois *marches*, et non trois enfants :
  une marche partagée porte tous ses pseudonymes ;
- **ma position** : *« tu es 3e sur 9, avec 1 autre »*, affichée même sans avoir
  rejoint — et **le dénominateur inclut celui qui regarde** : à 8 inscrits, un
  enfant qui n'a pas rejoint lit « 9e sur 9 » et non « 9e sur 8 » ;
- **progression du groupe** : une jauge collective, la seule mesure où personne
  n'est dernier.

#### 7.6 Le coach

Une page accessible depuis un lien, montrant **exactement ce qui est déjà
public** : classement des pseudonymes, progression du groupe, répartition des
ressentis. Elle n'expose rien de plus que la page de stats — c'est ce qui rend
son absence de protection acceptable (voir § 13, décision écartée).

### 8. Le programme

Sept séances, du 3 au 21 août 2026, telles que le coach les a écrites. Le
découpage en semaines et le rangement du lundi 17 sous « Semaine 2 » sont les
siens : ils sont reproduits, pas corrigés.

Le programme vit dans un **fichier de données éditable**, séparé du code, livré
avec l'application. Le modifier ne doit pas demander de toucher au code ; il
doit rester réutilisable la saison suivante.

#### Semaine 1

**Lundi 3 août — Endurance + Renforcement**
- Course : 30 minutes de footing à allure confortable
- Course : 6 × 100 m à 80 %, récupération en marchant
- Renforcement, **2 tours**, repos 1 min 30 entre les tours : 15 pompes ·
  20 squats · 15 fentes par jambe · 45 s gainage ventral · 30 s gainage de
  chaque côté · 15 burpees

**Mercredi 5 août — Fractionné**
- Course : 10 minutes de footing
- Course : 2 séries de 8 × (30 s rapides à fond / 30 s lentes), 3 minutes de
  récupération entre les séries
- Course : 10 minutes de footing pour terminer
- Renforcement, **3 tours** : 20 mountain climbers · 15 dips sur une chaise ·
  20 jumping squats · 20 abdos · 45 s gainage

**Vendredi 7 août**
- 30 à 40 minutes d'un autre sport (piscine, vélo…)
- Renforcement, **3 tours** : 12 pompes · 15 squats sautés · 12 fentes sautées
  par jambe · 45 s chaise contre un mur · 1 min gainage

#### Semaine 2

**Lundi 10 août — Endurance active**
- Course : 20 minutes de footing
- Course : 8 min de 15-15
- Renforcement, **4 tours** : 10 squats · 10 pompes · 10 fentes · 10 crunchs ·
  1 min gainage

**Mercredi 12 août — Fractionné long**
- Course : 15 minutes de footing
- Course : 6 × 2 minutes rapides, récupération 1 minute de footing lent entre
  chaque répétition
- Renforcement, **3 tours** : 15 burpees · 20 mountain climbers · 15 pompes ·
  20 squats · 1 min gainage

**Vendredi 14 août — Vitesse + Renforcement**
- Course : 10 minutes d'échauffement
- Course : 10 min de 30-30 m à 80 %
- Course : 15 minutes de footing
- Renforcement, **3 tours** : 15 pompes · 20 squats sautés · 15 fentes par
  jambe · 20 abdos · 1 min gainage ventral · 30 s gainage de chaque côté

**Lundi 17 août — Séance de validation**
- Course : 25 minutes de footing
- Course : 5 min de 15-15 puis 5 min de 30-30, 1 min de repos entre les deux
  séries
- Renforcement, **2 tours** : 20 squats · 15 pompes · 20 fentes · 15 burpees ·
  25 crunchs · 1 min gainage

#### Ordres de grandeur

Environ **53 exercices cochables** sur les sept séances. Volume total prescrit,
tours compris : **226 pompes**, **345 squats** toutes variantes, **105
burpees**, **210 abdos/crunchs**, **~24 minutes de gainage**, **~4 heures de
course**.

Ces totaux sont calculés depuis le programme ci-dessus et servent à vérifier
que les chiffres affichés sont parlants pour un ado. L'implémentation doit les
**recalculer depuis le fichier de données**, jamais les recopier : un programme
modifié doit changer les totaux sans intervention.

### 9. Règles métier

**Ce qu'est un exercice « fait ».** Une case cochée, rien de plus. L'enfant ne
saisit pas ce qu'il a réellement effectué : cocher les 15 pompes vaut
déclaration de 15 pompes. C'est un système déclaratif et assumé comme tel.

**Le passé se corrige, l'avenir ne se coche pas.** Toute séance dont la date est
passée ou en cours est librement cochable et décochable, à tout moment, jusqu'à
la fin du programme. Une séance à venir est visible — on peut lire ce qui
arrive — mais ses cases sont inactives. Sans cette règle, n'importe qui coche
les sept séances le 3 août au soir et le classement ne mesure plus rien.

**Les jours sans séance sont du repos, pas un trou.** Le programme ne compte que
sept séances sur dix-neuf jours. Mardi, jeudi, samedi et dimanche s'affichent
comme repos assumé. Un calendrier majoritairement vide serait culpabilisant et
faux.

**Le classement mesure la régularité.** Le rang est établi sur la part
d'exercices accomplis parmi ceux déjà programmés à ce jour — pas sur le total du
programme, sinon tout le monde est à 15 % le 5 août.

**À égalité, personne n'est devant.** Deux enfants au même score partagent la
même place, et l'heure à laquelle ils ont coché n'y change rien. La règle
précédente — *« à égalité, le premier arrivé à ce score est devant »* — a tenu
jusqu'au 7 août : dans une équipe où la plupart cochent tout, elle ne classait
plus l'assiduité mais la vitesse à sortir son téléphone après la séance, elle
récompensait de cocher avant d'avoir fait, et elle pénalisait celui qui n'a pas
de réseau au gymnase. Un enfant à 100 % pouvait lire « 9e sur 12 » sans qu'aucun
écran ne lui dise pourquoi.

**Le rang compte les enfants devant, pas les scores.** Trois premiers à 100 %,
puis le suivant est **4e**, jamais 2e : « 2e sur 12 » quand onze sont à égalité
devant serait faux, et le dénominateur honnête ci-dessous perdrait tout son
sens. Conséquence assumée : ceux qui n'ont encore rien coché partagent la
dernière place, et personne n'est dernier tout seul.

**Le volume est un récit, pas un rang.** Le cumul de pompes, squats et
kilomètres s'affiche en grand sur la page perso parce que c'est le chiffre qu'un
ado répète à table. Il ne produit **pas** de second classement : comme le volume
est déduit du programme, il classerait dans le même ordre que la régularité, à
du bruit près. Deux podiums qui disent la même chose, c'est un podium plus de la
confusion.

**Le podium nomme trois marches, la position en nomme zéro.** On affiche les
trois meilleurs scores, chaque marche portant tous les pseudonymes qui la
partagent, puis « tu es 7e sur 12 » sans nommer les rangs intermédiaires. On
garde le plaisir de grimper sans afficher publiquement qui est dernier.

**Huit prénoms au plus par marche.** La page est publique : quatorze
pseudonymes de mineurs n'ont pas à y être épelés pour dire une chose qu'un
nombre dit mieux. Une marche de plus de huit affiche donc son effectif —
*« 1er : 14 enfants, 100 % »*. **Chaque marche est jugée seule** : celles du
dessous nomment quand même, parce que cacher le prénom d'un enfant seul sur sa
marche ne protège rien et perd une information. Le plafond vise la liste
interminable, pas le nombre total de prénoms affichés.

**Le dénominateur est honnête.** « 3e sur 9 » compte les participants au
classement, pas l'effectif de l'équipe. On n'affiche jamais un rang sur un
effectif qu'on ne mesure pas.

**Le dénominateur inclut celui qui regarde.** Un enfant qui n'a pas rejoint est
compté dans le total qu'on lui montre : à 8 inscrits, il lit « 9e sur 9 ». Sans
ce « + 1 », quelqu'un de moins avancé que tous les inscrits lirait « 9e sur 8 »,
et écrêter son rang à 8 reviendrait à lui promettre qu'il n'est pas dernier alors
qu'il l'est. Deux conséquences suivent, et la seconde décide : le rang affiché
est toujours atteignable, et **le dénominateur ne bouge pas quand on rejoint** —
rejoindre n'est donc jamais un moyen de mieux se classer.

**Après le 21 août.** L'application bascule sur l'écran de bilan. Le classement
est figé, plus rien n'est cochable, et chacun voit ce qu'il a accompli sur les
trois semaines. Une app qui reste bloquée sur un programme terminé meurt en
silence le 22.

### 10. Le fun, et où il doit être

L'application doit être plaisante à ouvrir. Mais l'animation est une récompense,
jamais un péage : elle vient **après** l'action, ne retarde aucun tap, et ne
s'interpose jamais entre l'enfant et la case suivante.

- **Cocher un exercice** : la ligne se barre, la barre de progression avance
  d'un cran — vite, puis en douceur, sans dépasser sa valeur. Immédiat, court.
- **Terminer une séance** : c'est le moment fort. Confettis, le compteur de
  séances s'incrémente en grand, le volume cumulé se met à jour sous les yeux.
- **Grimper au classement** : le changement de position est animé, pas
  simplement affiché.
- **Un compteur qui augmente** ne saute jamais à sa valeur : il roule.

Trois interdits :
- rien qui bloque l'interaction pendant plus d'une demi-seconde ;
- aucune animation sur un écran consulté pendant l'effort ;
- `prefers-reduced-motion` est respecté — tout reste utilisable sans un seul
  mouvement.

Le ton est direct et tutoie, sans infantiliser des joueurs de 13-14 ans : ils
sont en U15, pas à l'école des poussins. Pas de mascotte, pas de badge à
collectionner, pas de vocabulaire de coach américain.

### 11. Contraintes

**Mobile d'abord, et sérieusement.** L'app est ouverte sur un téléphone, en
extérieur, en 4G, parfois en plein soleil. Zones de tap larges, contraste
suffisant en pleine lumière, aucune interaction dépendant du survol.

**L'app doit rester utilisable réseau coupé.** Le programme et la progression
sont locaux ; une séance se coche entièrement hors ligne. Seul le classement
demande le réseau, et son absence n'empêche jamais de s'entraîner : il affiche
la dernière valeur connue et le dit.

**Aucune installation.** Pas de store, pas de bandeau « ajoutez à l'écran
d'accueil » qui s'impose. Un lien qui s'ouvre.

**Aucun compte, aucun mot de passe** en dehors du code à 4 chiffres optionnel
du classement.

**Rien de sensible ne transite**, clés d'API tierces comprises : tout ce que le
navigateur reçoit est public par construction.

**L'app encaisse du trafic non sollicité** — robots d'indexation, scanners. Le
rate-limit du palier (50 req/s par IP) n'est pas une protection.

**Aucun secret dans le dépôt** ni dans l'image. Les noms des variables attendues
sont déclarés dans le `README`, jamais leurs valeurs.

**Français** pour l'interface, la documentation et le code.

**Démarrage sans intervention** : ni migration manuelle, ni fichier à créer à la
main, ni question interactive.

### 12. Dépendances et prérequis de mise en ligne

Trois points relèvent de l'infrastructure et non du produit. Ils doivent être
tranchés avant la mise en ligne du lot 2 — le lot 1, entièrement local,
n'en dépend pas.

1. **Les scores du classement doivent survivre à un redéploiement.** Un
   classement remis à zéro à chaque publication d'image serait pire que pas de
   classement. Ce que ça implique techniquement est une décision d'exploitation,
   pas un choix de ce document.

2. **Le garde-fou `--check` refuse l'état par utilisateur en `exposure:
   public`.** Le classement, même réduit à des pseudonymes et des scores,
   constitue un tel état. Le lot 2 ne peut pas être livré sans que cette règle
   soit desserrée — délibérément, et en connaissance de ce qu'elle protège.

3. ~~**La page 3 sur 3 de la note du coach manque.**~~ — *tranché le 7 août :
   **il n'y aura pas de programme après le 17 août**.* La capture reçue
   s'arrêtait après le lundi 17 ; elle s'arrêtait là parce que le programme
   s'arrête là. Les sept séances, les 53 exercices cochables et les dix-neuf
   jours du § 8 sont donc **définitifs**, et le § 9 avec eux. Rien n'est à
   compléter, et `web/programme.json` ne bougera plus. Le bilan du 22 août
   (§ 6, lot 3) reste la fin prévue.

### 13. Décisions écartées

**Le prénom sur le serveur.** Écarté au profit du pseudonyme choisi. Sur une URL
publique, publier les prénoms des mineurs d'une équipe identifiable — club
nommé, catégorie d'âge connue — avec leur activité quotidienne, n'est pas
justifié par le confort d'un podium nominatif.

**Le mot de passe statique sur la vue coach.** Écarté. Sur une page publique, il
donnerait l'apparence d'une protection sans en être une, et devrait de toute
façon être injecté par l'environnement. La vue coach n'affiche donc que ce qui
est déjà public. Si le coach veut un jour le détail nominatif par enfant, ce
sera une seconde application en `exposure: private` — pas un mot de passe sur
celle-ci.

**La saisie du nombre réellement effectué.** Écartée : un clavier à sortir à
chaque ligne, cinquante-trois fois sur le programme. La friction tuerait l'usage
avant que la précision ne serve à quelque chose.

**Le chronomètre de séance.** Écarté : personne ne garde l'app ouverte pendant
vingt minutes de footing, et une durée fausse est pire qu'une durée absente.
**Toujours vrai**, et c'est ce qui borne le minuteur livré depuis (§ 16.1) : il
compte un **exercice** et non une séance, il n'enregistre rien, et aucune durée
qu'il affiche ne part vers le serveur ni ne compte dans le classement. Ce qui
était refusé, c'est de **mesurer** la séance ; ce qui a été ajouté, c'est de
**tenir** un gainage de 45 secondes sans compter dans sa tête.

**Le classement sur le volume cumulé.** Écarté comme redondant avec la
régularité (§ 9).

**Le verrouillage des séances passées.** Écarté : corriger un exercice oublié
est une demande explicite, et l'oubli est plus fréquent que la triche.

**Le classement nominatif complet, du 1er au dernier.** Écarté au profit du
podium plus position : c'est ce qui motive le premier sans faire décrocher le
quatorzième.

### 14. Risques

| Risque | Effet | Ce qui l'atténue |
|---|---|---|
| Livraison tardive | Chaque jour perdu est une séance non couverte | Lot 1 volontairement réduit à ce qui tient en 48 h |
| Abandon après deux séances | L'app ne mesure plus rien | Zéro friction à l'entrée, récompense à chaque séance, aucun compte |
| Un enfant gonfle son score | Classement faussé | Assumé : une équipe de gamins qui se connaissent, la triche se voit au vestiaire. Le classement est indicatif, pas un titre |
| Perte du téléphone ou vidage du navigateur | Progression perdue | Assumé et **annoncé** : sans compte, il n'y a pas de sauvegarde. La page de réglages le dit. **Une seule exception, et elle se mérite** : celui qui a rejoint le classement retrouve ses séances sur un autre téléphone en ressaisissant son nom et son code — le serveur en tient la liste depuis qu'il l'a rejoint. Le prénom, les ressentis et tout ce qui précède l'inscription ne se récupèrent pas |
| Un pseudonyme injurieux ou identifiant | Contenu public indésirable | Le pseudonyme proposé par défaut n'est pas le prénom ; il reste modifiable par l'enfant, et supprimable |
| Trafic automatisé sur l'URL publique | Bruit, charge | Aucune donnée sensible à atteindre ; c'est le principe même du § 5 |

### 15. Questions ouvertes

1. ~~**Page 3 sur 3 du programme**~~ — *tranché le 7 août : il n'y a pas de
   programme après le 17 août, et la capture n'était donc pas incomplète.* Le
   § 12.3 est clos.
2. ~~**Effectif réel de l'équipe**~~ — *tranché : le produit n'en dépend pas.*
   Les cibles du § 4 sont exprimées en proportion, les rangs comptent les
   participants et non l'effectif (§ 9), et aucun écran n'affiche de total
   d'équipe. Le nombre exact reste utile au coach ; il n'est requis nulle part.
3. **Le coach est-il au courant ?** Le lot 2 lui destine un écran. Savoir s'il
   compte le regarder décide s'il vaut le travail, et si le ressenti mérite
   d'exister.

### 16. Ajouté après les PRP

Les onze PRP livrés le 6 août ne sont pas le dernier état de l'application :
douze changements ont suivi, onze le 7 août et un le 8, tous nés de l'usage réel
et aucun prévu par un PRP. Cette section les tient, et elle est la contrepartie des
§ 6 et § 13 : sans elle, le seul endroit du dépôt où ces changements existent
est l'historique des commits, que personne ne relit pour savoir ce que
l'application fait aujourd'hui.

Trois d'entre eux ont **déplacé le périmètre** — ils ont rendu faux ce que ce
document affirmait. Ce sont les § 16.1 à § 16.3. Quatre autres ont livré ce
que le PRD promettait déjà, ou réparé ce qui ne le tenait pas : § 16.4. Les
quatre derniers n'ont levé aucune exclusion — les trois interdits du § 10
tiennent — mais chacun arbitre quelque chose que ce document ne disait nulle
part : le thème visuel du club (§ 16.5), le nom du geste total des réglages
(§ 16.6), le sort d'un code périmé (§ 16.7) et ce qu'on entend à zéro
(§ 16.8). Le douzième, le 8 août, ne touche pas à l'application : il rend le
serveur capable de dire si quelqu'un s'en sert (§ 16.9).

#### 16.1 Le minuteur d'exercice — 7 août

Chaque exercice porte un minuteur : **compte à rebours** quand le programme
prescrit une durée, **chronomètre qui monte** sinon. Le mode est décidé par le
programme, jamais par l'enfant : un rebours sur « 15 pompes » inventerait une
limite que le coach n'a pas donnée.

*Ce que le PRD disait* : le chronomètre était hors périmètre (§ 6), et le § 13
argumentait le refus. **Cet argument tient toujours** — il portait sur la mesure
de la *séance*. Le minuteur livré compte un geste, n'enregistre rien, et
n'envoie rien au serveur ; il ne rouvre donc pas la décision de § 13, il en
délimite le bord.

*Corrigé le lendemain* : la durée se lit dans le **libellé** de l'exercice et
non dans sa mesure — « 45 s de chaise contre un mur » n'a pas de mesure
exploitable, la mesure sert les totaux et le libellé sert l'enfant. Sept
exercices affichaient une durée fausse, en général celle de la séance entière.

#### 16.2 « L'équipe » derrière son onglet — 7 août

Le podium, la position et le bouton pour rejoindre ont quitté le bas de « Ma
progression » pour un onglet à eux (`#/equipe`).

*Ce que le PRD disait* : § 7.5, « deux niveaux dans cet ordre ». L'ordre est
respecté ; c'est sa traduction en un seul écran qui était fausse. Le § 7.5 est
corrigé, avec la règle qui a tranché : **un onglet mène à ce qu'on regarde,
jamais à ce qu'on décide** — le consentement au classement reste derrière un
bouton, au moment où il y a un vrai choix à faire.

#### 16.3 Les liens vidéo — 7 août

Chaque exercice porte un lien qui montre le mouvement. Deux sources, et la
première gagne : une adresse **vérifiée par un adulte**, facultative, posée dans
le fichier de programme ; à défaut, une **recherche** sur le mouvement reconnu.
Les deux phrases diffèrent parce que les deux promesses diffèrent — « Voir la
vidéo » contre « Chercher une vidéo qui montre ». Proposer une vidéo précise que
personne n'a visionnée reviendrait à la mettre sous les yeux d'un enfant sur la
foi de son titre. Rien n'est chargé depuis un domaine tiers : un lien qui s'ouvre
ailleurs, pas un lecteur intégré.

*Ce que le PRD disait* : « photos, vidéos de démonstration » étaient hors
périmètre (§ 6), sans argument développé — contrairement au chronomètre. C'est
la seule des trois où l'exclusion est **levée** et non délimitée.

*Ce qui manque* : aucune trace de la demande dans le dépôt — ni PRP, ni entrée
de journal, ni ligne de PRD avant celle-ci. Le champ vidéo du fichier de
programme n'est renseigné nulle part à ce jour ; tous les liens sont donc des
recherches.

#### 16.4 Ce qui n'a pas déplacé le périmètre

Quatre changements de la même journée relèvent de la correction. Ils sont ici
pour que la liste soit complète, pas parce qu'ils demandent un arbitrage.

| Changement | Ce qui l'a déclenché | PRD |
|---|---|---|
| Le dénominateur du classement inclut celui qui regarde | Relecture : rang et total venaient de deux instants différents | § 9 et § 7.5 corrigés |
| Rejoindre depuis un second téléphone **récupère** au lieu d'écraser | Signalé après mise en ligne : une progression effacée | § 14 corrigé — l'exception à « rien n'est sauvegardé » |
| Un geste « Récupérer ma progression » sous le nom déjà enregistré | Le correctif précédent n'avait de porte que pour qui n'en avait pas besoin | Inchangé |
| Le refus d'un pseudonyme s'affiche sous le champ fautif | Signalé après mise en ligne : « rien ne se passe » | Inchangé |

#### 16.5 Les couleurs du club, et le blason — 7 août

L'application avait l'apparence de sa fonction : bleu institutionnel, polices du
système, cartes blanches. Correcte, et interchangeable avec n'importe quel
formulaire administratif. Demandé de vive voix, en deux temps : *« une
amélioration graphique, le thème doit être affirmé sport handball pour des
ados »*, puis *« adapte la couleur au site du club, tu peux aussi utiliser le
logo »*.

Ce qui existe maintenant :

- **Les couleurs sont celles du blason**, relevées dessus et pas approchées à
  l'œil : le bleu nuit de la crinière, le bleu du club, son blanc, son gris
  froid. Le bleu du club a été descendu d'un cran — assez pour porter du texte
  blanc à 6:1, pas assez pour cesser d'être le sien.
- **Une couleur, une fonction, et jamais deux sens pour la même.** Le bleu ne
  désigne que ce qui est vivant *maintenant* : la séance du jour, le bouton,
  aujourd'hui au calendrier, le minuteur qui tourne. Ce qui est *accompli* prend
  le plus fort contraste du fond — l'encre de nuit sur les écrans clairs, le
  blanc sur le bandeau sombre. C'est ce partage qui manquait à l'application
  d'origine, où un seul bleu disait à la fois la progression, les liens, les
  coches et le jour : quatre choses d'une seule voix, donc aucune.
- **Deux traits, et ils disent quelque chose de vrai.** Le trait plein est la
  ligne des 6 m : ce qui est atteint. Le pointillé est celle des 9 m : ce qui ne
  l'est pas encore — une séance à venir, un jour à venir, un avis de bilan
  anticipé. Le verrou des séances futures utilisait déjà un cadre pointillé ;
  c'était un hasard, c'est devenu une règle.
- **Une police d'affichage servie par l'application**, jamais appelée chez un
  tiers : 18 Ko de latin, sous licence libre, dans le cache hors ligne. Elle
  porte les titres, les grands nombres et les onglets. Ce n'est pas de la
  décoration : « Autre sport + Renforcement » tient sur une ligne là où la police
  du téléphone en demandait trois, et les quatre onglets tiennent enfin sur une
  seule ligne chacun à 320 px.
- **Le blason du club**, livré avec l'application (32 Ko) et servi par elle. Il
  apparaît à trois endroits et à trois titres : **image** au premier lancement,
  où il répond à la question de l'enfant qui ouvre un lien reçu sur le groupe de
  l'équipe — de qui ça vient ; **fond** de l'écran du jour, au sommet des arcs,
  là où serait la cage ; **icône** de l'onglet du navigateur. Nulle part
  ailleurs.
- **L'écran du jour est une surface de but** — le blason au sommet, l'arc des
  6 m, celui des 9 m en pointillé — et il occupe l'écran entier jusqu'à la barre
  d'onglets.

*Ce que le PRD disait* : le § 10 veut que l'app soit « plaisante à ouvrir », sans
mascotte, sans badge à collectionner, sans vocabulaire de coach américain. Les
trois interdits tiennent. **Le blason n'est pas la mascotte que ce paragraphe
refuse** : il ne parle pas, ne réagit à rien, ne récompense rien et n'accompagne
personne. C'est l'emblème du club, au même titre que sur un maillot — et un U15
qui porte ce lion sur le dos le samedi ne le lit pas comme une peluche.

*Ce qui est arbitré ici, et n'était écrit nulle part* : **un écran sombre reflète
la lumière du jour** — un contraste élevé ne compense pas entièrement la
réverbération sur la vitre. Le partage est donc délibéré : le bandeau sombre est
sur l'écran qu'on **ouvre**, d'un coup d'œil et d'un tap ; l'écran de séance,
celui qu'on tient à bout de bras entre deux séries, reste clair. Si la lecture au
soleil pose problème sur le terrain, c'est l'écran du jour qu'il faut éclaircir,
et lui seul.

#### 16.6 « Supprimer mon profil » remplace « changer d'enfant » — 7 août

Le geste total des réglages porte désormais le nom de son **effet** et non de sa
raison, et il emporte enfin tout ce que ce nom promet : le prénom, la
progression, **et le nom au classement** quand ce téléphone en porte un. Le nom
part du serveur d'abord ; le téléphone n'est effacé qu'ensuite, et pas du tout si
le retrait échoue — **sauf sur un refus du code**, cas où le geste aboutit quand
même (§ 16.7). Sans réseau, le geste refuse d'agir et le dit — pour un téléphone
qui ne porte aucun nom, il n'a besoin de rien et fonctionne hors ligne.

Le geste plus doux garde sa place au-dessus, sous un nom qui le distingue :
**« Quitter le classement »** — le nom part, la progression reste.

Demandé de vive voix après un retour de parent : *« pour moi c'est le bouton
changer d'enfant qui devrait s'appeler supprimer mon profil »*. Le retour
d'origine était celui-ci : *« j'ai déjà fait une boulette en allant voir depuis
mon téléphone et en créant un compte pour Charlie que je n'arrive plus à
supprimer »*.

*Ce que le PRD disait* : § 7.2 nommait le geste « changer d'enfant » et le
décrivait comme « repart à zéro ». Les deux étaient exacts au mot près et faux
ensemble. Le bouton était nommé par la **raison** de s'en servir — un frère, une
sœur, un téléphone partagé — si bien que personne cherchant à effacer un profil
n'ouvrait ce bouton-là. Et « repart à zéro » ne valait que pour le téléphone : le
nom restait au classement, alors que le geste effaçait le code, donc le seul
moyen de l'en retirer. Le produit **fabriquait** ainsi l'impasse que son propre
avertissement décrivait — *« plus personne ne pourra le supprimer »*. Une phrase
qui prévient de l'impasse à celui qui va y entrer n'est pas un garde-fou : c'est
la documentation du défaut. C'est une correction ; aucune décision n'est
rouverte.

*Ce qui n'est pas réparé* : un nom déjà orphelin — laissé par l'ancien geste,
sur un téléphone qui a donc perdu son code — reste au classement, et rien dans
l'application ne l'atteint. Le correctif empêche le cas de se reproduire, il ne
défait pas les cas existants ; ceux-là se traitent à la main sur le volume.

*Écarté* : un écran où l'on retape un nom et son code pour retirer une fiche que
ce téléphone ne porte pas. Il couvrait les noms déjà orphelins, mais ajoutait un
troisième geste de sortie à un produit dont le problème était précisément que
ses deux gestes existants ne se distinguaient pas. Arbitré le 7 août en faveur
du renommage.

#### 16.7 Un code périmé n'enferme plus le téléphone — 7 août

Un nom supprimé puis recréé prend un **nouveau code**. Le téléphone qui portait
l'ancien garde alors un lien mort, et le serveur refuse tout ce qu'il envoie.
Trois corrections, toutes nées de ce seul cas.

- **Un refus du code libère le téléphone.** Un tel refus dit que cet appareil
  n'a *déjà* plus aucun droit sur ce nom : garder le lien ne protège plus rien,
  il ne fait qu'enfermer. « Quitter le classement » et « Supprimer mon profil »
  aboutissent donc, en le disant. Une panne de réseau ou une pénalité d'essais,
  elles, ne libèrent rien : la fiche est peut-être encore la nôtre.
- **« Récupérer ma progression » ouvre alors le chemin vers l'écran de saisie.**
  Ce geste ne redemande jamais de code — un second formulaire serait une seconde
  occasion de se tromper —, mais quand le code stocké vient d'être refusé, cette
  précaution devient le mur.
- **L'application ne rejoue plus un refus définitif.** Elle réessayait trois
  fois, à 5, 15 et 45 secondes : quatre codes refusés par minute, là où le
  serveur ferme un nom au cinquième par quart d'heure. Deux ouvertures de l'app
  suffisaient donc à fermer le nom — et la fermeture porte sur le **nom**, pas
  sur l'appareil : un téléphone au code périmé bloquait le propriétaire légitime
  du compte, sur son autre téléphone, sans que ni l'un ni l'autre ne puisse le
  soupçonner. Seules une panne et une coupure réseau se rejouent désormais.

Signalé par un utilisateur, qui a refusé de vider son navigateur pour ne pas
perdre sa progression : *« il semble bloqué. je ne veux pas supprimer mon cache
car ceci me semble être un bug de gestion des comptes »*. C'en était un.

*Ce que le PRD disait* : § 14 promet un pseudonyme « supprimable », et le
§ 16.6, la veille de cette ligne, affirmait que le téléphone n'est « pas effacé
du tout si le retrait échoue ». La règle était bonne pour une panne et fausse
pour un refus de code — et c'est ce § 16.6 qui avait fermé la dernière issue :
avant lui, le geste effaçait le téléphone sans rien demander au serveur. La
sortie de secours a donc été supprimée par la correction précédente, un jour
avant d'être réclamée. C'est une correction ; aucune décision n'est rouverte.

*Ce qui n'est pas fait* : aucun écran ne montre le code que le téléphone garde.
L'afficher aurait rendu ce diagnostic immédiat — l'utilisateur aurait vu, en
cinq secondes, que son téléphone tenait un code qui n'était plus le bon. Écarté
pour l'instant : le § 7.4 tient le code pour un jeton qui ne protège rien, mais
un adolescent y met souvent celui de son téléphone, et l'afficher à l'écran le
donne à qui regarde par-dessus l'épaule. À rouvrir si le cas se represente.

#### 16.8 Le sifflet est un vrai sifflet — 7 août

La sonnerie *Sifflet* du minuteur (§ 16.1) était trois notes pures à 2100 Hz.
Signalé de vive voix : *« le sifflet ne ressemble absolument pas à un
sifflet »*. C'est exact, et ce n'est pas un réglage à corriger : ce qui fait
entendre un sifflet est le battement de la bille et le souffle, qu'aucun
empilement d'oscillateurs simples ne reproduit. **La sonnerie *Sifflet* est
désormais un enregistrement** — un coup d'arbitre pris dans un gymnase, du
domaine public (CC0), 25 Ko livrés avec l'application.

*Ce que cela change* : jusqu'ici l'application ne contenait **aucun fichier
audio**, et c'était une règle tenue par un test. Elle ne l'est plus. Ce qui la
motivait tient toujours et n'est pas entamé : rien n'est chargé depuis un
domaine tiers — le fichier est servi par l'app elle-même, comme le blason et la
police —, il est dans la coque hors ligne, et 25 Ko sur une image de 14 Mo ne se
mesurent pas. Ce qui reste vrai : **le bip et la cloche sont toujours
synthétisés**, et le sifflet retombe sur ses anciennes notes si le fichier ne se
décode pas. Un sifflet approximatif vaut mieux qu'un minuteur muet à zéro.

*Les deux autres sonneries ont été retravaillées dans le même geste*, sans
fichier : le bip **monte** au lieu de répéter la même note — deux notes
identiques disent « attention », deux notes qui montent disent « c'est fini » —
et la cloche frappe cinq partiels inharmoniques au même instant au lieu d'une
seule sinusoïde tenue, qui était un bip long et non une cloche.

*Aucune exclusion levée* : le § 10 ne parle pas de son, et le § 16.1 ne promet
rien sur le timbre. Ce qui est arbitré ici — et que le PRD ne disait nulle part
— est qu'**un son livré avec l'application est acceptable, un son chargé
ailleurs ne l'est pas**.

#### 16.9 Le serveur compte son usage — 8 août

Question posée par le décideur : *est-ce que des familles ont réussi à s'en
servir ?* Le serveur ne savait pas répondre. Les journaux du conteneur
disparaissent à chaque déploiement de la fabrique — sur trois semaines de
programme, ils ne racontent que les heures écoulées depuis le dernier
redémarrage —, et une requête `POST … 200` s'y lisait pareil que l'envoi ait
porté douze exercices ou zéro. Le seul indice durable était le fichier du
classement lui-même, qui dit qui s'est inscrit et **pas** combien de gens ont
ouvert l'app sans aller jusque-là.

**L'application tient désormais des compteurs d'usage**, dans un fichier
`activite.json` du même volume que le classement : par journée, le nombre
d'ouvertures, de consultations, d'inscriptions, de reprises, de mises à jour, de
suppressions, d'envois acceptés *à zéro exercice*, d'identifiants d'exercice
périmés, et de refus par code d'erreur. Le détail dans le `README`.

*Ce que cela change au § 5* — rien, et c'est la condition à laquelle cela a été
fait. Le principe « par défaut, rien ne quitte le téléphone » n'est pas entamé :
**l'application n'envoie rien de nouveau**. Ce qui est compté, c'est ce que le
serveur voyait déjà passer, et il n'en garde que des entiers. Le fichier n'a
aucun champ où un prénom, un pseudonyme, un identifiant d'exercice ou une
adresse pourrait entrer — même garantie *de forme*, et non de consigne, que pour
le corps du `POST`.

*Ce que cela ne dit toujours pas, et qui a été écarté* : **où les gens
abandonnent**. Quelqu'un qui ouvre l'app, tape son prénom, hésite et referme ne
laisse qu'une ouverture de plus. Le savoir demanderait que l'app émette des
traces de parcours — donc qu'elle envoie quelque chose que l'enfant n'a pas
choisi d'envoyer. Proposé au décideur le 8 août, **refusé au profit de la mesure
côté serveur seule**. C'est une exclusion décidée, pas un oubli : la mesure
s'arrête là où commence la promesse du § 5.

---

#### 16.10 Ce que les barres de progression disent à voix haute — 22 août

**Ce qui l'a demandé** : un test de bout en bout devenu rouge en changeant de
jour. En le rendant indépendant du calendrier, on a découvert que sa date
tombait depuis toujours, par hasard, sur des jours **sans séance** — et qu'elle
masquait ainsi trois défauts que personne n'avait jamais vus.

**Les noms pour les lecteurs d'écran, désormais fixés ici** plutôt que laissés au
choix de qui écrit le code :

- sur l'écran du jour et sur celui d'une séance, la barre s'annonce
  « **Avancement des exercices de la séance** » ;
- sur le profil, où elle mesure **ce qui était programmé jusqu'à aujourd'hui**
  et non une séance, elle s'annonce « **Avancement des exercices programmés à ce
  jour** ».

Ce troisième libellé a d'abord été écrit « du programme », et c'était **faux** :
`progression()` écarte délibérément toute séance à venir (§ 9, « accompli sur
programmé à ce jour »). Un enfant à jour de ses séances aurait entendu
« avancement du programme, 12 sur 12 » devant une barre pleine, alors que le
programme n'est pas fini — quand la phrase écrite juste à côté dit, elle,
« sur 30 programmés à ce jour ». Une barre pleine qui ment est pire qu'une barre
sans nom.

Les deux se distinguent délibérément : la même phrase dirait une chose fausse sur
l'un des deux écrans. Les **nombres** ne sont pas dans le nom — ils vivent à côté,
et se rejouent à chaque case cochée ; un nom qui les porterait resterait figé sur
la valeur qu'il avait au moment de l'affichage. La voix annonçait auparavant un
**pourcentage** qui n'est écrit sur aucun écran.

**Ce que le PRD affirmait avant** : rien. Ces libellés n'existaient nulle part, et
la barre n'avait pas de nom du tout — un lecteur d'écran annonçait « barre de
progression » et s'arrêtait là.

#### 16.11 Une séance finie se dit, elle ne se compte pas — 22 août

**Ce qui existe maintenant** — livré dans le même commit que cette section, comme
le contrat l'exige : l'écran du jour dit **en toutes lettres** où en est la
séance. « Pas encore commencée », « Il t'en reste 5 », « Séance terminée ». Une
séance terminée se lit sans compter, et le total n'est plus écrit deux fois — il
l'était encore, à deux lignes d'écart, entre « 7 exercices · mercredi 12 août »
et « 3 exercices sur 7 ».

En cours, l'écran dit ce qui **reste** plutôt que ce qui est fait : c'est la
question qu'on se pose au milieu d'une séance, et c'est aussi ce qui supprime la
dernière répétition du total. *Écarté — garder la date seule en haut* et
*— « 3 cochés » en bas* : les deux suppriment la répétition sans répondre à la
question.

La barre reste : elle porte l'avancement à l'œil. **Et sa voix dit exactement ce
que l'écran dit** — « Il t'en reste 5 », pas « 3 sur 8 ». Un lecteur d'écran et
un œil doivent recevoir le même message ; c'est le fil de toute cette série de
décisions, et la raison pour laquelle le **nom** de la barre, lui, ne bouge pas :
il dit ce qu'elle mesure, jamais où elle en est.

**Une fois la séance faite, l'écran pointe la suivante** — « Prochaine séance :
mercredi 5 août », et le lien y mène. Le bloc bleu disait « va faire ta séance »
y compris quand elle était faite. Sur la **dernière** séance du programme, il
n'invente aucune date : il propose de revoir celle du jour. *Écarté — qu'il se
retire en simple contour*, et *— que la félicitation prenne sa place* : le
premier laisse l'écran muet, le second fête sans donner la suite.

Le bouton prend **un mot par état** : « Commencer » quand rien n'est coché,
« Reprendre » en cours, « Revoir » une fois fini.

**Ce qui l'a demandé** : la critique d'écran du 22 août 2026. Sept sur sept
s'affichait exactement comme zéro sur sept, avec le même bouton « Reprendre » —
qui supposait donc qu'on avait déjà commencé, y compris quand ce n'était pas
vrai.

**Ce qui a été écarté**, montré en trois maquettes et tranché par l'utilisateur :

*Écarté — un mot de plus à la fin*, tout le reste inchangé. Le plus petit
changement des trois. Écarté parce qu'il laisse le total écrit deux fois, qui
était l'autre moitié du défaut.

*Écarté — le score prend la place du titre*, l'avancement devenant la première
chose qu'on lit. Écarté parce qu'on ouvre cet écran pour savoir ce qu'il y a à
faire aujourd'hui, pas où l'on en est : le nom de la séance passe avant.

**Ce que cela engage** : l'état d'une séance se lit en français, pas en fraction.
Un écran qui affiche un score sans le dire suppose que celui qui regarde fait la
division lui-même.

### Annexe — provenance de ce document

Rédigé le 3 août 2026 à partir de deux captures d'écran du programme du coach
et d'une session de cadrage en dix questions, suivie d'une passe d'avocat du
diable dont sept objections sont tracées dans les sections § 5, § 9, § 13 et
§ 14.

Rapatrié le 5 août 2026 depuis `docs/superpowers/specs/`, sans réécriture : la
fiche produit ci-dessus et le PRD ci-dessous sont désormais un seul document,
dans le répertoire de l'app.

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
- Hors périmètre, décidé et non oublié : édition du programme depuis l'app,
  chronomètre, vidéos, messagerie, notifications, saisie du nombre réellement
  effectué, historique multi-saisons.

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
- Chronomètre, minuteur de série, décompte de repos.
- Photos, vidéos de démonstration des mouvements.
- Messagerie, commentaires, réactions entre enfants.
- Notifications push, rappels par e-mail ou SMS.
- Saisie du nombre réellement effectué (voir § 13).
- Historique multi-saisons, comptes durables.

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
**changer d'enfant** (un frère, une sœur, un téléphone partagé) — deux gestes
distincts : le premier garde la progression, le second repart à zéro et le dit
clairement avant d'agir.

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

Deux niveaux, dans cet ordre :

**Ma progression** — ce qui se lit sans se comparer à personne :
- part du programme accompli à ce jour ;
- volume cumulé **accompli**, en langage d'ado : *« 112 pompes, 165 squats,
  45 burpees, 2 h 10 de course »* — la somme de ce qui a été coché, pas le
  total du programme (§ 8) ;
- calendrier des sept séances : faite, manquée, à venir, repos.

**L'équipe** — la comparaison :
- **podium** des trois premiers pseudonymes ;
- **ma position** : *« tu es 3e sur 9 »*, affichée même sans avoir rejoint — et
  **le dénominateur inclut celui qui regarde** : à 8 inscrits, un enfant qui n'a
  pas rejoint lit « 9e sur 9 » et non « 9e sur 8 » ;
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
programme, sinon tout le monde est à 15 % le 5 août. À égalité, le premier
arrivé à ce score est devant.

**Le volume est un récit, pas un rang.** Le cumul de pompes, squats et
kilomètres s'affiche en grand sur la page perso parce que c'est le chiffre qu'un
ado répète à table. Il ne produit **pas** de second classement : comme le volume
est déduit du programme, il classerait dans le même ordre que la régularité, à
du bruit près. Deux podiums qui disent la même chose, c'est un podium plus de la
confusion.

**Le podium nomme trois personnes, la position en nomme zéro.** On affiche les
trois premiers pseudonymes, puis « tu es 7e sur 12 » sans nommer les rangs
intermédiaires. On garde le plaisir de grimper sans afficher publiquement qui est
dernier.

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
  d'un cran avec du ressort. Immédiat, court.
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

3. **La page 3 sur 3 de la note du coach manque.** La capture reçue s'arrête
   après le lundi 17 août. Le programme documenté ici couvre sept séances ; si
   la troisième page en ajoute, le fichier de données doit être complété avant
   le 17.

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

1. **Page 3 sur 3 du programme** — à récupérer auprès du coach (§ 12.3).
2. ~~**Effectif réel de l'équipe**~~ — *tranché : le produit n'en dépend pas.*
   Les cibles du § 4 sont exprimées en proportion, les rangs comptent les
   participants et non l'effectif (§ 9), et aucun écran n'affiche de total
   d'équipe. Le nombre exact reste utile au coach ; il n'est requis nulle part.
3. **Le coach est-il au courant ?** Le lot 2 lui destine un écran. Savoir s'il
   compte le regarder décide s'il vaut le travail, et si le ressenti mérite
   d'exister.

---

### Annexe — provenance de ce document

Rédigé le 3 août 2026 à partir de deux captures d'écran du programme du coach
et d'une session de cadrage en dix questions, suivie d'une passe d'avocat du
diable dont sept objections sont tracées dans les sections § 5, § 9, § 13 et
§ 14.

Rapatrié le 5 août 2026 depuis `docs/superpowers/specs/`, sans réécriture : la
fiche produit ci-dessus et le PRD ci-dessous sont désormais un seul document,
dans le répertoire de l'app.

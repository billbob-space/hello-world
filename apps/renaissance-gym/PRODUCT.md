# Product — renaissance-gym

<!-- impeccable:product-schema 1 -->

## Users

**La gymnaste** est l'utilisatrice principale et la seule dont l'assiduité
décide du succès. 11-15 ans, licenciée à La Renaissance Gymnastique de
Marcq-en-Barœul, catégorie « les grandes ». Elle s'entraîne chez elle pendant
les vacances, sur un tapis ou une moquette, son téléphone posé à côté d'elle et
souvent hors de portée de la main — elle est en équilibre sur les mains, en
gainage, ou écrasée en grand écart. Elle n'a pas d'adresse électronique à elle,
pas nécessairement de compte Google, et elle abandonnera à la deuxième friction.

**Le parent** est un utilisateur de substitution : c'est lui qui décide si
quelque chose de son enfant part sur un serveur, et c'est lui qui a demandé
l'application. Il ne l'utilise pas au quotidien.

**L'entraîneuse** du club n'est pas utilisatrice. Elle a produit le programme
sur deux feuilles A4 et ne saura rien de cette application. Sa grille est la
source, et elle a autorité : l'application transpose, elle ne réécrit pas.

## Product Purpose

L'entraîneuse a distribué avant les vacances deux feuilles photocopiées : trente-six
exercices en lignes, huit colonnes de semaines, et la consigne « mets une croix à
chaque fois que tu as fait l'exercice ou note le nombre de répétitions (ou temps)
effectués ». Une grille papier ne dit pas quoi faire aujourd'hui, se perd, se
mouille, et ne se retrouve pas sur le téléphone d'à côté. Surtout, elle demande à
une enfant de treize ans de composer elle-même sa séance à partir de trente-six
lignes — ce qu'elle ne fera pas, et c'est pourquoi la grille revient vide en
septembre.

L'application n'ajoute aucun exercice et n'en retire aucun. Elle transforme la
grille en un programme qui se déroule : la séance du jour est déjà composée
quand elle ouvre, chaque temps de gainage est décompté à sa place, et la grille
se remplit toute seule.

## Capabilities and Constraints

- Un compte à elle, sans adresse électronique ni mot de passe : un pseudonyme et
  un code à six chiffres. C'est ce qui lui rend sa progression sur un autre
  téléphone.
- La séance du jour est composée par l'application, jamais choisie dans une
  liste. Quatre séances par semaine, huit semaines, et sur une semaine les
  trente-six exercices sont tous passés au moins une fois.
- Les objectifs montent avec les semaines, comme la feuille le prescrit : ce qui
  vaut dix répétitions en semaine 1 en vaut vingt en semaine 8.
- Un minuteur décompte tout ce qui se tient — gainages, écarts, équilibres,
  ponts — et se pilote à distance de bras, parce qu'elle est par terre.
- L'application reste utilisable réseau coupé. La sauvegarde repart seule quand
  le réseau revient.
- Le passé se corrige, l'avenir ne se coche pas.
- Deux téléphones ne s'écrasent jamais : ce qui est fait sur l'un s'ajoute à ce
  qui est fait sur l'autre.
- Mobile d'abord, et plus précisément **téléphone posé par terre** : gros
  caractères lisibles à un mètre, zones de tap larges, aucune interaction
  dépendant du survol, `prefers-reduced-motion` respecté.
- Hors périmètre, décidé et non oublié : vidéos de démonstration, comparaison
  entre gymnastes, édition du programme depuis l'application, notifications,
  écran pour l'entraîneuse, saisie libre du nombre réellement effectué.

## Product Principles

**La feuille a autorité.** Les libellés sont recopiés mot pour mot, y compris
« Gainage sur le dos (Petite cuillère) » et « Assise, mains au sol derrière
(épaules) ». Reformuler pour faire joli, c'est livrer un autre programme que
celui du club.

**Le système est déclaratif, et assumé comme tel.** Cocher vingt fermetures vaut
déclaration de vingt fermetures. Il n'y a personne à tromper : il n'y a pas de
classement, pas de comparaison, et la seule lectrice est elle-même.

**Ce qui n'est pas fait n'est pas une faute.** Une semaine à trois séances sur
quatre est une semaine à trois séances, pas un échec affiché en rouge. Le
programme n'accumule pas de retard et ne réclame rien.

**Le téléphone est par terre, pas dans la main.** Toute décision d'ergonomie se
tranche là : elle est en appui sur les mains, elle a les jambes en l'air, elle
transpire. Ce qui demande de la précision au doigt est mal conçu.

---

# PRD — renaissance-gym : le programme de vacances

## 1. En une phrase

Les deux feuilles de vacances de La Renaissance Gymnastique deviennent un
programme de huit semaines qui se déroule tout seul sur le téléphone d'une
gymnaste de treize ans, se sauvegarde sous un pseudonyme, et se retrouve sur
n'importe quel appareil.

## 2. Le problème

La grille papier échoue pour quatre raisons distinctes, et une application qui
n'en résoudrait que trois ne servirait à rien :

1. **Elle ne dit pas quoi faire aujourd'hui.** Trente-six lignes, huit colonnes,
   aucune séance. La composition est laissée à l'enfant, qui ne la fera pas.
2. **Elle ne mesure pas les temps.** « Gainage 1 min », « écart facial 1 min » :
   sans minuteur, on compte dans sa tête, on triche sans le vouloir, et on
   s'arrête trop tôt. Huit des trente-six exercices sont des tenues.
3. **Elle ne survit pas.** Une feuille A4 pliée en quatre dans un sac de sport
   traverse rarement huit semaines de vacances.
4. **Elle est sur un seul support.** Chez la mère, chez le père, chez la
   grand-mère : la feuille est restée là-bas.

L'application répond aux quatre. Le point 4 est celui qui impose un serveur, et
c'est le seul.

## 3. Utilisateurs

Voir la fiche produit ci-dessus. Un point mérite d'être répété ici parce qu'il
gouverne l'interface : **l'utilisatrice n'a pas le téléphone en main pendant
qu'elle s'en sert.** Elle le regarde entre deux exercices, à un mètre, souvent à
l'envers ou de biais. Une interface de bureau miniaturisée échoue ici, même
parfaitement responsive.

## 4. Objectifs et mesures de succès

| Objectif | Mesure | Seuil |
|---|---|---|
| Elle s'en sert vraiment | Semaines où au moins 3 séances sur 4 sont faites | 6 sur 8 |
| Elle ne décroche pas en route | Séances faites en semaines 5 à 8 | ≥ celles des semaines 1 à 4 |
| Elle démarre sans aide | Première séance lancée sans qu'un adulte touche le téléphone | oui / non |
| Le changement de téléphone ne perd rien | Progression retrouvée sur un second appareil | intégrale |

L'application n'instrumente rien pour mesurer cela : il n'y a ni compteur
d'usage, ni journal d'événements, ni analyse. Ces seuils se constatent en
regardant sa grille avec elle en octobre. Un produit destiné à une personne se
mesure en lui parlant.

## 5. Le principe directeur : le téléphone est par terre

Tout le reste en découle.

- **Les caractères de la séance sont énormes.** Le nom de l'exercice en cours et
  le décompte se lisent à un mètre, sans lunettes, sans se relever.
- **Une seule chose à faire à l'écran.** Pendant la séance, l'écran porte
  l'exercice en cours et un geste. Pas de menu, pas d'onglets, pas de retour en
  arrière accidentel.
- **Le son porte ce que l'œil ne peut pas voir.** Elle est en équilibre sur les
  mains, tête en bas : elle n'a pas les yeux sur l'écran. La fin d'un temps de
  gainage est annoncée au son, et le compte à rebours des trois dernières
  secondes aussi.
- **Rien ne dépend d'un geste précis.** Aucun glissement, aucun appui long,
  aucune cible sous 56 px. Les paumes sont moites et le téléphone est à un mètre.
- **L'écran ne s'éteint pas pendant une séance.** Un téléphone qui se verrouille
  au milieu d'un gainage d'une minute annule le minuteur, et elle ne recommence
  pas.

## 6. Périmètre

### Lot 1 — Elle peut s'entraîner (sans serveur)

1. Le programme, en fichier de données éditable et séparé du code : les
   trente-six exercices, leurs familles, leurs objectifs par semaine.
2. La composition des quatre séances de la semaine, déterministe.
3. L'écran d'entrée : prénom, semaine de départ.
4. L'écran du jour : la séance à faire, ou le repos mérité.
5. L'écran de séance : les exercices l'un après l'autre, le minuteur, le son.
6. La grille des huit semaines, qui se remplit.
7. L'état local, qui survit à la fermeture de l'onglet.

### Lot 2 — Elle retrouve tout ailleurs (le serveur)

8. Le compte : pseudonyme et code à six chiffres, créés à l'entrée.
9. L'API de sauvegarde et de reprise, et le magasin de fiches sur volume nommé.
10. La synchronisation : envoi opportuniste, fusion sans écrasement, reprise sur
    un second appareil.
11. Les états de réseau dits à l'écran, sans jamais bloquer l'entraînement.

### Lot 3 — Elle a envie d'y revenir

12. Les badges de fin de semaine et de progression.
13. Les réglages : changer de prénom, revoir son pseudonyme, effacer sa fiche.

### Hors périmètre, avec l'argument

| Écarté | Pourquoi |
|---|---|
| **Vidéos de démonstration** | Elle connaît les mouvements, elle les fait au club toute l'année ; c'est un aide-mémoire, pas un cours. Et rien de fiable, libre de droits et adapté à ces mouvements précis n'existe. Un lien vers une vidéo que personne n'a visionnée met une vidéo inconnue sous les yeux d'une enfant. |
| **Comparaison entre gymnastes** | Personne d'autre n'utilise l'application. Un classement à une participante est une moquerie, et le construire pour « au cas où » ferait entrer des pseudonymes d'enfants dans une page publique. |
| **Saisie du nombre réellement effectué** | La feuille l'autorise (« ou note le nombre »), l'application ne la reprend pas : demander un nombre après chaque exercice, c'est vingt saisies au clavier par séance, sur un téléphone posé par terre, avec les mains moites. Le coût est certain, l'usage hypothétique. Réexaminable si elle le réclame. |
| **Édition du programme depuis l'application** | Le programme vient du club et ne change pas en cours de vacances. Une interface d'édition serait une surface de plus à protéger, sur une application ouverte à tous. |
| **Notifications** | Demande une autorisation navigateur, des clés serveur, et un service worker qui survit. Sur une application utilisée quatre fois par semaine pendant huit semaines, le rappel qui marche est le parent. |
| **Écran pour l'entraîneuse** | Elle ne sait pas que l'application existe, et sa grille papier reste ce qu'elle relèvera à la rentrée. |

## 7. Parcours

### 7.1 La première fois — trois écrans, moins d'une minute

**Écran 1 — « Salut, c'est quoi ton prénom ? »** Un champ, un bouton. Le prénom
sert à lui parler ; il n'a aucune autre fonction.

**Écran 2 — « Tu commences à quelle semaine ? »** Les huit semaines en huit
grosses cibles. Par défaut la semaine 1, mais elle choisit : si elle a déjà fait
deux semaines sur le papier, elle démarre à la 3, et sa grille est cohérente
avec sa feuille.

**Écran 3 — « Pour te retrouver sur un autre téléphone. »** Un pseudonyme, déjà
proposé par l'application et modifiable, et un code à six chiffres qu'elle
choisit. Le texte dit exactement à quoi il sert, en une phrase :

> C'est ce qui te permettra de retrouver tes séances si tu changes de téléphone.
> Note-le quelque part, ou demande à un parent de le noter : personne ne peut te
> le redonner.

Cet écran n'est pas facultatif — il est la raison d'être du serveur. Il est
troisième et non premier parce qu'un formulaire d'inscription en premier écran
fait fermer l'onglet.

### 7.2 Le jour ordinaire

Elle ouvre. Deux cas, et un seul écran pour les deux :

- **Il reste des séances cette semaine** : « Séance 2 sur 4 — L'équilibre », les
  familles d'exercices annoncées, un bouton qui prend la moitié de la largeur.
- **Les quatre sont faites** : « Ta semaine est bouclée. » Le repos est un
  résultat, pas un vide. Elle peut refaire une séance si elle veut, l'application
  ne l'en empêche pas et ne la compte pas deux fois.

### 7.3 La séance

Les exercices défilent l'un après l'autre. Pour chacun : son libellé exact, son
objectif de la semaine en cours, et le geste qui convient.

- **Un exercice qui se compte** (« x20 fermetures ») : elle le fait, elle
  valide. L'application ne compte pas à sa place et ne prétend pas le faire.
- **Un exercice qui se tient** (« 1 min de gainage ») : un compte à rebours
  démarre au geste, s'annonce à trois secondes de la fin, et sonne à zéro. Elle
  peut le remettre à zéro ; elle ne peut pas le raccourcir, parce qu'un minuteur
  qu'on peut abréger n'est plus un minuteur.
- **Un exercice symétrique** (côté droit puis côté gauche) est deux exercices
  dans la feuille et le reste dans l'application : la feuille les a séparés,
  c'est elle qui a autorité.

Entre deux exercices, un temps de transition court et annoncé. À la fin :
l'écran de fin de séance, la case qui se coche dans la grille, et le badge s'il
y a lieu.

Elle peut quitter en cours de séance. Ce qui était fait reste fait ; la séance
reprend où elle en était.

### 7.4 La grille

Les huit semaines et les quatre séances de chacune, en une seule vue tenant dans
un écran — c'est la feuille du club, en mieux : elle se remplit sans stylo, et
elle est à jour partout.

La semaine en cours est distinguée. Les semaines passées gardent ce qui a été
fait, sans jugement sur ce qui ne l'a pas été. Les semaines à venir sont
lisibles mais inertes : on ne coche pas demain.

### 7.5 Sur un autre téléphone

Elle ouvre l'application, et au lieu de créer un compte, elle prend « J'ai déjà
un pseudo ». Elle tape son pseudonyme et son code : tout revient — les séances
faites, la semaine en cours, les badges, et son prénom.

Un code refusé le dit sous le champ, et une temporisation croissante s'installe
(5 s, 15 s, 45 s) : quatre essais par minute au plus. Un million de codes
possibles à quatre essais par minute font quatre ans et demi de tentatives
ininterrompues.

## 8. Le programme

### 8.1 Le fichier de données

Le programme vit dans un **fichier de données éditable, séparé du code**, livré
avec l'application. Corriger un libellé, changer un objectif ou réordonner une
famille ne doit pas demander de toucher au code. Les totaux et la composition
des séances en sont dérivés, jamais recopiés.

### 8.2 Les trente-six exercices

Recopiés des deux feuilles, dans leur ordre et avec leurs libellés exacts. La
colonne « objectif » porte les valeurs telles que la feuille les écrit ; § 8.3
dit comment elles se répartissent sur les huit semaines.

**Feuille 1 — abdominaux, gainage, force**

| # | Exercice | Feuille | Famille |
|---|---|---|---|
| 1 | Fermetures | x10 / x20 | abdominaux |
| 2 | Sur le dos, jambes tendues et écartées à la verticale, se redresser et venir toucher le sol derrière les fesses avec les mains | x10 / x20 | abdominaux |
| 3 | Allongée sur le dos, se redresser pour venir en fermeture assise | x10 / x20 | abdominaux |
| 4 | Allongée sur le dos, se redresser pour venir en équerre jambes serrées | x10 / x20 | abdominaux |
| 5 | Sur le dos, jambes tendues et écartées à la verticale, toucher le pied droit avec la main gauche puis le pied gauche avec la main droite | x10 / x20 | abdominaux |
| 6 | Gainage sur le ventre (Superman) | 30s / 1min | gainage |
| 7 | Gainage sur le dos (Petite cuillère) | 30s / 1min | gainage |
| 8 | Gainage planche (Grande cuillère) sur les mains | 30s / 1min | gainage |
| 9 | Gainage planche (Grande cuillère) sur les coudes | 30s / 1min | gainage |
| 10 | Gainage planche sur le côté droit sur le coude | 30s / 1min | gainage |
| 11 | Gainage planche sur le côté gauche sur le coude | 30s / 1min | gainage |
| 12 | Flexions / extensions (accroupi + saut extension) | x10 / x20 | force |
| 13 | Pompes | x5 / x10 | force |

**Feuille 2 — équilibres, acrobatie, sauts, souplesse**

| # | Exercice | Feuille | Famille |
|---|---|---|---|
| 14 | ATR jambes écartées (équilibre) | 10s / 20s / 30s | équilibres |
| 15 | ATR jambes serrées (équilibre) | 10s / 20s / 30s | équilibres |
| 16 | ATR 1/2 valse ou valse (pour les grandes) | x5 / x10 | équilibres |
| 17 | Équerre jambes serrées | 10s / 20s / 30s | équilibres |
| 18 | Équerre jambes écartées | 10s / 20s / 30s | équilibres |
| 19 | Placement du dos jambes groupées | x5 / x10 | placement |
| 20 | Placement du dos jambes tendues | x5 / x10 | placement |
| 21 | Roue | x10 | acrobatie |
| 22 | Souplesse arrière | x10 | acrobatie |
| 23 | Tic-Tac | x10 | acrobatie |
| 24 | Souplesse avant | x10 | acrobatie |
| 25 | Pivot (pour les grandes) | x10 | acrobatie |
| 26 | Saut extension | x10 | sauts |
| 27 | Saut groupé | x10 | sauts |
| 28 | Saut écart | x10 | sauts |
| 29 | Écart jambe droite | 30s / 1min | souplesse |
| 30 | Écart jambe gauche | 30s / 1min | souplesse |
| 31 | Écart facial | 30s / 1min | souplesse |
| 32 | Écrasement facial | 30s / 1min | souplesse |
| 33 | Fermeture debout | 30s / 1min | souplesse |
| 34 | Fermeture assise | 30s / 1min | souplesse |
| 35 | Assise, mains au sol derrière (épaules) | 30s / 1min | souplesse |
| 36 | Pont | 30s / 1min | souplesse |

L'exercice 25 est écrit « 1/2 pivot (pour les petites) / Pivot (pour les
grandes) » sur la feuille ; l'exercice 16 propose « 1/2 valse ou valse (pour les
grandes) ». L'utilisatrice est une grande : ce sont les variantes « grandes » qui
sont retenues, et le fichier de données porte la mention d'origine pour que la
substitution reste lisible. C'est le seul endroit où l'application choisit à la
place de la feuille, et il est décidé au § 15.1.

### 8.3 Les objectifs montent avec les semaines

C'est la lecture que ce PRD fait de la feuille, et elle mérite d'être écrite
parce qu'elle n'y est pas explicite. Une grille de huit semaines qui donne deux
ou trois valeurs par exercice décrit une **progression**, pas un menu : sinon
l'entraîneuse aurait écrit une seule valeur. Les mentions de niveau sont
ailleurs, sur les mouvements eux-mêmes (« pour les petites », « pour les
grandes »), et se traitent au § 8.2.

| Notation de la feuille | S1-S2 | S3-S4 | S5-S6 | S7-S8 |
|---|---|---|---|---|
| `x10 / x20` | x10 | x13 | x16 | x20 |
| `x5 / x10` | x5 | x6 | x8 | x10 |
| `30s / 1min` | 30 s | 40 s | 50 s | 1 min |
| `10s / 20s / 30s` | 10 s | 15 s | 20 s | 30 s |
| `x10` (valeur unique) | x10 | x10 | x10 | x10 |

Les paliers intermédiaires sont interpolés, arrondis à une valeur qui se compte
et se tient sans calculette. Le premier palier est la valeur basse de la feuille
et le dernier sa valeur haute : les deux bornes viennent du club, les deux
marches du milieu viennent de l'application, et c'est dit ici pour que personne
ne les prenne pour une consigne d'entraîneuse.

Une gymnaste qui démarre en semaine 5 démarre au palier de la semaine 5. Elle a
choisi cette semaine parce qu'elle a déjà travaillé ; la remettre à x10 serait
la contredire.

### 8.4 Les quatre séances de la semaine

Quatre séances, chacune nommée, chacune tirée de familles complémentaires. Les
trente-six exercices sont tous passés au moins une fois par semaine — c'est la
règle qui fait de ces quatre séances une transposition fidèle de la grille, et
non une sélection.

| Séance | Nom | Contenu | Exercices |
|---|---|---|---|
| 1 | **Le socle** | abdominaux, gainage (1re moitié), souplesse | 1-8, 29-31 |
| 2 | **L'équilibre** | équilibres, placement du dos, souplesse | 14-20, 32-34 |
| 3 | **L'acrobatie** | acrobatie, sauts, souplesse | 21-28, 35-36 |
| 4 | **La force** | gainage (2de moitié), force, souplesse | 9-13, 29, 31, 33, 36 |

Vérification de couverture, qui est un test et pas une intention : l'union des
quatre séances vaut exactement les trente-six exercices. La séance 4 reprend
quatre exercices de souplesse déjà vus dans la semaine — la souplesse est le
seul domaine où la répétition dans la semaine est un gain, et c'est ainsi qu'on
progresse en gymnastique.

Chaque séance fait dix à onze exercices, soit quinze à vingt minutes minuteurs
compris. C'est la durée qu'une enfant de treize ans tient sans se forcer, quatre
fois par semaine, pendant huit semaines.

### 8.5 La semaine

La semaine court sur sept jours à partir du jour où la gymnaste a démarré, et
non du lundi : elle commence l'application le jour où elle l'ouvre, et un
premier « il te reste deux jours pour faire quatre séances » serait un mauvais
accueil.

Dans la semaine, les quatre séances se font dans l'ordre, un jour l'une. L'ordre
est fixe parce qu'il équilibre les familles ; le calendrier ne l'est pas, parce
qu'un jour sauté ne doit rien casser. Au septième jour, la semaine avance, faite
ou non : le programme n'accumule pas de retard, il n'y a pas de dette, et une
semaine à deux séances reste une semaine à deux séances dans la grille.

## 9. Règles métier

1. **Une séance est faite quand tous ses exercices sont validés.** Une séance
   abandonnée à mi-parcours n'est pas faite, mais ce qui a été validé est
   conservé et la séance reprend là.
2. **Un exercice validé ne se dévalide pas depuis la séance.** Il se corrige
   depuis la grille, où le geste est explicite.
3. **L'avenir ne se coche pas.** Une semaine dont la date de début est
   postérieure à aujourd'hui est en lecture seule.
4. **Le passé se corrige.** Une case des semaines écoulées se coche et se
   décoche depuis la grille — elle a pu faire sa séance sans le téléphone.
5. **Refaire une séance déjà faite est permis et ne compte pas double.** La
   grille porte des cases, pas des compteurs.
6. **La semaine avance sur le calendrier, jamais sur l'assiduité.** Sept jours
   après son début, la suivante commence.
7. **Au-delà de la semaine 8, le programme est terminé.** L'application le dit,
   garde la grille consultable, et propose de tout recommencer à zéro — ce qui
   est un geste explicite, confirmé, et jamais automatique.
8. **La fusion de deux appareils est une union, jamais un écrasement.** Une case
   cochée quelque part est cochée partout. Aucune case ne se décoche par
   synchronisation ; une décoche volontaire est un fait daté qui se propage
   comme les autres.
9. **Le prénom et la semaine de départ suivent la fiche.** Le dernier écrit
   gagne pour ces deux-là, parce qu'ils n'ont pas de sens en union.

## 10. Le compte : pseudonyme et code

### 10.1 Ce qu'il est, et ce qu'il n'est pas

Ce n'est pas un compte au sens ordinaire : ni adresse électronique, ni mot de
passe, ni vérification, ni récupération. C'est **un identifiant et un jeton**,
repris de `marcq-handball`, avec une différence de taille dite au § 10.3.

Le pseudonyme est proposé par l'application dans une liste de noms communs
(« Renarde-14 », « Comète-7 ») : elle peut le changer, mais le proposé ne
contient jamais de prénom. Le motif accepté est le même que dans
`marcq-handball` : lettres, chiffres, espace, point, tiret, souligné, seize
caractères au plus.

### 10.2 Le code fait six chiffres, et pas quatre

Dans `marcq-handball`, le code garde une ligne de classement — le PRD de cette
application le qualifie lui-même de « jeton qui ne protège rien ». Ici il garde
huit semaines d'entraînement et un prénom d'enfant. Quatre chiffres font dix
mille combinaisons, qu'une machine épuise en une nuit même bridée ; six en font
un million.

Trois mesures, et pas une de plus :

- six chiffres, choisis par elle ;
- une temporisation croissante après un code refusé, sur l'appareil (5 s, 15 s,
  45 s) **et** côté serveur par pseudonyme, parce qu'une temporisation qui ne
  vit que dans le navigateur ne ralentit personne ;
- aucune page ne liste les fiches. Le seul moyen d'en lire une est d'en
  connaître le pseudonyme **et** le code.

### 10.3 Ce que le serveur connaît, et le choix qui a été fait

Le serveur garde, par fiche : le pseudonyme, l'empreinte du code, **le prénom**,
la semaine de départ, et la liste des exercices validés avec leur date.

Le prénom sur le serveur est un **choix explicite du demandeur**, pris contre la
recommandation de ce document et après qu'elle a été énoncée. L'alternative
proposée était de le garder sur l'appareil, comme le fait `marcq-handball`, au
prix de le retaper sur un second téléphone. Le choix inverse a été fait pour que
la reprise soit totale.

Ce que cela coûte, écrit ici pour que personne ne le découvre plus tard : sur une
application `public`, un prénom d'enfant vit sur un serveur joignable depuis
Internet. Il n'est lisible qu'en connaissant pseudonyme et code, il n'est associé
à aucun nom de famille, aucune adresse, aucune date de naissance, aucune photo,
et l'application n'a aucune page qui en liste. Le risque résiduel est qu'un
pseudonyme et un code soient devinés ou communiqués ; ce qui est alors exposé est
un prénom et des cases cochées.

Le code n'est jamais stocké en clair : le serveur en garde une empreinte salée,
et un envoi de code se compare à l'empreinte.

### 10.4 L'API

Trois opérations, et rien d'autre :

| Opération | Effet |
|---|---|
| Créer une fiche | pseudonyme libre + code → fiche vide. Un pseudonyme déjà pris est refusé, et le refus ne dit jamais si le code aurait été bon |
| Lire et fusionner | pseudonyme + code → la fiche fusionnée avec ce que l'appareil apporte |
| Effacer | pseudonyme + code → la fiche disparaît, définitivement |

Il n'y a pas d'opération de liste, pas de recherche, pas de compteur global.

## 11. Contraintes

### 11.1 Persistance

La fiche vit dans un **volume nommé**. Sa perte efface huit semaines
d'entraînement qu'aucun téléphone ne rendra si celui qui les portait a été changé
entre-temps : c'est la seule ressource de cette application qui ne se
reconstitue pas, et elle se sauvegarde.

L'appareil garde de son côté une copie complète : l'application fonctionne
entièrement hors ligne, et le serveur est une sauvegarde et un pont entre
appareils, jamais une dépendance de fonctionnement.

### 11.2 Hors ligne

Une séance entière se fait réseau coupé, minuteur et son compris. Ce qui n'a pas
pu être envoyé part au prochain réseau. L'état de la sauvegarde est dit à
l'écran, en français et sans jargon (« Sauvegardé à l'instant », « Pas de
réseau — ce sera sauvegardé plus tard »), et n'empêche jamais de continuer.

### 11.3 Le reste

- **Aucun compte Google**, aucune installation, aucun magasin d'applications.
  Un lien qui s'ouvre. C'est ce qui impose le palier `public`.
- **Français** pour l'interface, la documentation et le code.
- **Le son** doit fonctionner après un premier geste de l'utilisatrice, ce que
  les navigateurs mobiles imposent : le premier appui de la séance débloque
  l'audio, et l'application ne fait jamais dépendre une information du seul son.
- **L'écran reste allumé** pendant une séance, et seulement pendant une séance.
- **`prefers-reduced-motion`** est respecté ; aucune information n'est portée
  par la seule couleur ; contrastes conformes AA au minimum.
- **Le budget de l'image** est celui de la fabrique : moins de 200 Mo,
  utilisateur non root, aucun port publié, aucun secret.

## 12. Dépendances et prérequis de mise en ligne

1. **Le volume nommé doit survivre au redéploiement** (§ 11.1). C'est le
   prérequis du lot 2 : tant qu'il n'est pas tenu, le serveur promet une
   sauvegarde qu'il ne rend pas, ce qui est pire que pas de serveur.
2. **Le palier reste `public`.** Il n'y a pas de desserrage possible :
   `public` est déjà le plus ouvert. Le resserrer (`google`) fermerait la porte
   à une enfant sans compte Google — c'est-à-dire à l'unique utilisatrice.

## 13. Décisions écartées

| Décision | Pourquoi elle a été écartée |
|---|---|
| Tout garder sur le téléphone, sans serveur | C'était la proposition initiale, approuvée, puis renversée : elle utilise plusieurs téléphones. Le serveur n'existe que pour ça. |
| Un compte proposé après la première séance | Réduit la friction d'entrée, mais laisse perdre la première semaine à celle qui passe outre — et la sauvegarde est la raison d'être du serveur. |
| Le prénom gardé sur l'appareil | Recommandé, non retenu : voir § 10.3. |
| Un code à quatre chiffres, comme au handball | Voir § 10.2 : ce qu'il garde n'a pas la même valeur. |
| Une séance par jour, sept jours sur sept | Quatre séances laissent des jours de repos, que la gymnastique demande, et rendent une semaine ratable sans être perdue. |
| La grille libre à cocher, en plus de la séance guidée | Deux modes d'usage sur la même donnée doublent les états et les malentendus. La grille reste consultable et corrigible ; elle n'est pas un second parcours d'entraînement. |
| Un classement, même à une participante | Voir § 6. |
| La saisie du nombre réellement effectué | Voir § 6. |

## 14. Risques

| Risque | Conséquence | Traitement |
|---|---|---|
| Elle oublie son code | Elle perd sa fiche : personne ne peut le lui redonner | Dit mot pour mot à la création (§ 7.1), et l'appareil garde le code une fois saisi : l'oubli ne se paie qu'au changement de téléphone |
| Le volume est perdu | Huit semaines effacées | § 11.1 : sauvegarde, et copie locale complète sur chaque appareil utilisé |
| Un pseudonyme est déjà pris | Confusion à la création | Refus explicite au moment de la saisie, avec une proposition de remplacement |
| Elle abandonne en semaine 3 | L'application ne sert plus | C'est le risque principal, et aucune fonctionnalité ne le couvre. Les séances courtes, le repos affiché comme un résultat et l'absence de rouge sont ce qui est fait contre lui |
| Elle se blesse en forçant sur un mouvement | Grave | L'application ne prescrit rien qui ne soit sur la feuille du club, ne pousse jamais au-delà de l'objectif de la semaine, et n'affiche aucun encouragement à dépasser |
| Le téléphone se verrouille en plein gainage | Minuteur perdu, agacement | § 5 : l'écran reste allumé pendant la séance |

## 15. Questions ouvertes

### 15.1 Les variantes « petites / grandes » sont figées en dur

L'application retient les variantes « grandes » (§ 8.2) parce que
l'utilisatrice en est une. Le fichier de données porte les deux libellés, mais
rien dans l'interface ne permet de basculer. Si une seconde gymnaste plus jeune
s'en sert, il faudra soit un choix à l'entrée, soit une seconde ligne dans le
fichier de données. **Tranché pour l'instant : figé.** Le coût d'un réglage
utilisé par une personne dépasse son gain.

### 15.2 Que se passe-t-il après la semaine 8 ?

La règle 9.7 dit : le programme est terminé, la grille reste, et tout
recommencer est possible sur geste explicite. Ce que le club distribuera à la
rentrée n'est pas connu. **Rien n'est prévu au-delà**, et c'est assumé : huit
semaines de vacances sont le périmètre.

### 15.3 Le son sur iOS

Le déblocage audio au premier geste est la pratique connue, mais le
comportement d'iOS varie d'une version à l'autre et l'appareil de test n'est pas
connu à la rédaction. **Le minuteur ne doit dépendre du son en aucun cas** : le
visuel porte toujours l'information complète, et le son l'ajoute.

---

## Annexe — provenance de ce document

Ce PRD dérive de deux photographies de feuilles A4 distribuées par La Renaissance
Gymnastique de Marcq-en-Barœul, et d'un cadrage en cinq questions avec le
demandeur, le 14 août 2026. Les décisions qui viennent de lui, et non de ce
document : une utilisatrice unique, une séance du jour guidée plutôt qu'une
grille libre, les variantes « grandes », quatre séances par semaine, la semaine
de départ au choix, la sauvegarde serveur avec le mécanisme de code de
`marcq-handball`, le compte obligatoire à l'entrée, et le prénom sauvegardé
côté serveur.

Les décisions qui viennent de ce document, et qu'il faut donc contester ici et
non ailleurs : la progression des objectifs sur les huit semaines (§ 8.3), la
composition des quatre séances (§ 8.4), le code à six chiffres (§ 10.2), la
semaine glissante de sept jours (§ 8.5), et les six exclusions du § 6.

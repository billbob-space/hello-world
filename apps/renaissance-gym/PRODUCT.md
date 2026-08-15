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

Chaque séance fait neuf à onze exercices, soit quinze à vingt minutes minuteurs
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

---

# Ajouté après les PRP

Ce que l'usage réel a produit, et qu'aucun PRP n'avait prévu. Chaque entrée est
écrite dans le même commit que son code : un PRD qui décrit une application qui
n'existe plus ment, et rien ne le signale.

## A1. Passer un exercice, et le retrouver plus tard

**Remonté par le demandeur après la première utilisation**, le 15 août 2026 :
« il n'est pas possible de sauter un exercice pour pouvoir le refaire plus
tard ».

Le PRP 04 avait fait de la séance une file rigide : un exercice se valide, ou
la séance s'arrête. Or une gymnaste qui bute sur un ATR, qui n'a pas la place
pour une roue dans son salon, ou qui doit céder le tapis à son frère, n'a que
deux issues — mentir en cochant, ou abandonner la séance. Les deux sont pires
que le problème.

**Ce qui est ajouté** : sur l'écran de séance, une action discrète « Passer ».
L'exercice passé n'est **ni validé ni perdu** : il retourne **à la fin de la
file**, et la séance le represente quand les autres sont faits.

- Elle peut le passer autant de fois qu'elle veut : il revient toujours.
- Quand il ne reste que des exercices passés, l'écran le dit — le **nombre**
  en grand, et sous lui « exercices que tu as passés, et qui t'attendent » —
  et les propose à nouveau. Le nombre porte parce qu'une phrase entière à la
  taille d'affichage crie au lieu d'informer.
- Elle peut **terminer la séance sans eux**. Ce qu'elle a fait est conservé ;
  la séance n'est simplement pas cochée dans la grille, parce que la règle §9.1
  ne bouge pas : une séance est faite quand tous ses exercices le sont.
- La grille reste corrigible (§9.4) : une séance finie sans le téléphone se
  coche à la main.

**Ce qui n'est pas fait, et pourquoi** : passer un exercice n'est **jamais
compté ni affiché** comme un manquement. Pas de compteur d'exercices passés,
pas de couleur d'alerte, aucune mention dans la grille. Le §14 le pose :
l'abandon est le risque principal de cette application, et un écran qui tient
le décompte de ce qu'on a évité est une raison de plus de ne pas rouvrir l'app.

## A2. La sonnerie de fin s'entend

**Remonté par le demandeur en même temps** : « j'aimerais aussi avoir une
sonnerie à la fin des décomptes ». Elle existait pourtant, et le code
l'appelait bien au bon moment.

**La cause est physique, pas logique.** Le PRP 04 avait choisi, pour distinguer
la fin des trois bips qui la précèdent, un son « plus bas et plus long » — un
sinus à 220 Hz pendant une demi-seconde. Or un haut-parleur de téléphone ne
restitue presque rien sous 400 Hz : les bips aigus s'entendaient, et la seule
note qui compte — celle qui dit que le gainage est fini — était inaudible.
C'était une décision de conception sonore prise sans tenir compte du matériel
qui la joue.

**Ce qui change** :

- la fin n'est plus une note grave mais une **sonnerie répétée**, dans la bande
  où un haut-parleur de téléphone est efficace, et sensiblement plus forte que
  les bips ;
- elle se distingue des bips par le **rythme et la répétition**, non par la
  hauteur — c'est le seul critère qu'un petit haut-parleur transmet fidèlement ;
- une **vibration** l'accompagne quand l'appareil en est capable. C'est le
  second canal, et le seul qui traverse un téléphone en mode silencieux.

**Ce qui ne change pas** : le §15.3 tient toujours. Le visuel porte l'information
complète, le son ne fait que l'ajouter, et aucun test ne dépend de lui. Sur un
iPhone dont l'interrupteur latéral est sur silence, le son du navigateur est
coupé par le système et **aucune page web ne peut passer outre** : la vibration
et l'écran sont alors les seuls signaux, et c'est assumé.

## A3. La grille montre ce qui a été fait, exercice par exercice

**Remonté par le demandeur après la deuxième séance**, le 15 août 2026 : « dans
la vue grille aucun moyen de voir ce que j'ai déjà fait ».

Le constat est exact, et trois défauts se cumulaient :

1. **Une case était tout ou rien.** Elle ne devenait dorée qu'une fois la
   séance entièrement faite. Dix exercices sur onze s'affichaient exactement
   comme zéro : tout ce qui n'achevait pas une séance était invisible.
2. **Les cases de la semaine en cours étaient inertes.** Celle où elle vit
   était la plus opaque de la grille — elle ne pouvait ni la lire, ni la
   corriger.
3. **Rien ne descendait à l'exercice.** Or c'est la granularité de la feuille
   du club : trente-six lignes, une croix par ligne. La grille montrait des
   séances là où elle attendait des exercices.

Le premier défaut a été **aggravé par A1** : depuis que « Passer » existe, une
séance se termine bien plus souvent incomplète, et donc invisible.

**Ce qui est ajouté** :

- **La case porte son avancement.** Elle se remplit d'or à proportion des
  exercices faits. Une case entamée ne ressemble plus ni à une case vide, ni à
  une case finie — laquelle garde sa coche.
- **Toute case ouvrable s'ouvre** : la semaine en cours comme les semaines
  passées. On y lit **les exercices de la séance, un par un**, ceux qui sont
  faits marqués comme tels. C'est la feuille du club, enfin.
- **La correction descend à l'exercice.** Elle peut cocher ou décocher une
  ligne, et non plus seulement la séance entière — une séance faite sans le
  téléphone se rattrape ligne à ligne, et un exercice coché par erreur se
  défait seul.
- **Les semaines à venir restent inertes** : la règle §9.3 ne bouge pas,
  l'avenir ne se coche pas.

**Ce qui ne change pas** : la règle §9.1 tient — une séance n'est *faite* que
lorsque tous ses exercices le sont, et seule une séance faite porte sa coche.
Un avancement partiel se **voit** sans être compté comme un succès.

**Ce qui reste interdit** : aucun pourcentage, aucun total, aucune moyenne,
nulle part. La case se remplit, elle n'annonce pas « 64 % ». Le §4 et le §14
tiennent : montrer ce qui a été fait est un service, en tenir le score est un
jugement, et cette application n'en rend aucun.

### A3 bis — depuis la liste, lancer l'exercice

Précisé par le demandeur dans la foulée : la liste ne sert pas qu'à lire et à
cocher, elle sert aussi à **faire**.

Depuis le détail d'une séance, chaque exercice porte donc **deux gestes
distincts**, et il ne faut pas les confondre :

| Geste | Ce qu'il fait | Pour quoi |
|---|---|---|
| **Cocher / décocher** | marque l'exercice fait ou pas fait, sans rien lancer | elle l'a fait au club, ou sans le téléphone, ou elle s'est trompée |
| **Lancer** | ouvre l'exercice pour de vrai — objectif de la semaine, minuteur, sonnerie | elle veut le faire maintenant, seul |

**Lancer un exercice seul** l'amène sur l'écran de séance ordinaire, avec le
même minuteur et la même sonnerie, mais pour ce seul exercice. Une fois validé,
elle **revient à la liste** d'où elle est partie, et non à la séance du jour :
c'est de là qu'elle est venue, et il lui en reste peut-être d'autres à
rattraper.

C'est ce qui rend la grille utile après coup : une séance à laquelle il manque
deux exercices se termine depuis la grille, sans avoir à relancer la séance
entière ni à cocher une ligne qu'on n'a pas faite.

**La règle §9.1 ne bouge toujours pas** : la séance devient *faite* — et sa case
porte sa coche — dès que ses exercices le sont tous, qu'ils l'aient été dans la
séance guidée, lancés un par un depuis la grille, ou cochés à la main.

## A4. Les objectifs sont ceux de la feuille, et rien d'autre

**Remonté par le demandeur** le 15 août 2026, interrogé sur la difficulté :
« c'est le programme qui a été donné par les coachs, donc il faut suivre ce
programme qui est adapté ».

Le §8.3 avait **fabriqué deux paliers intermédiaires**. La feuille écrit
« x10 / x20 » ; l'application affichait x10, puis **x13**, puis **x16**, puis
x20. Ces deux valeurs du milieu ne viennent d'aucune entraîneuse : elles
venaient de ce document, qui le disait honnêtement — « les deux marches du
milieu viennent de l'application » — mais les affichait à une enfant comme si
elles venaient du club.

C'était une invention de trop. **Le §8.3 est remplacé** : une notation à deux
valeurs vaut la valeur basse sur la première moitié du programme et la haute
sur la seconde ; une notation à trois valeurs se répartit en trois blocs ; une
valeur unique ne bouge jamais.

| Notation de la feuille | S1-S4 | S5-S8 |
|---|---|---|
| `x10 / x20` | x10 | x20 |
| `x5 / x10` | x5 | x10 |
| `30s / 1min` | 30 s | 1 min |

| Notation à trois valeurs | S1-S3 | S4-S6 | S7-S8 |
|---|---|---|---|
| `10s / 20s / 30s` | 10 s | 20 s | 30 s |

**La leçon dépasse ce réglage** : une transposition peut interpoler ce qu'elle
affiche **en interne**, jamais ce qu'elle présente comme la consigne d'un
tiers. Ce que l'écran donne à faire doit être ce que l'entraîneuse a écrit, ou
n'être pas donné.

## A6. Sortir d'une séance en cours

**Remonté par le demandeur** : « une fois une séance lancée, il est impossible
de sortir afin de revenir au programme et de sauvegarder ce qui a déjà été
réalisé afin de revenir dessus plus tard ».

Le §7.3 le promettait pourtant : « Elle peut quitter en cours de séance. Ce qui
était fait reste fait ; la séance reprend où elle en était. » Le mécanisme
existe — la file est gardée, la reprise fonctionne — mais **aucun bouton ne
permettait de sortir**. La promesse était tenue par le code et introuvable à
l'écran.

**Ce qui est ajouté** : un geste de sortie discret et permanent sur l'écran de
séance. Il ramène à l'écran du jour, garde tout ce qui a été validé, et la
séance reprendra là où elle en était.

Il est **discret et non principal** : pendant une séance, le geste qui compte
est celui qui fait avancer. Mais il est **toujours là**, jamais caché derrière
un appui long ni un glissement — le §5 l'interdit.

## A7. Choisir sa sonnerie, et l'entendre depuis les réglages

**Remonté par le demandeur, deux fois** : la sonnerie de fin ne s'entend
toujours pas. L'appareil est un **Android**, où le son d'une page web suit le
**volume média** — souvent à zéro sans que personne le sache, parce qu'il ne
bouge pas avec les boutons de volume quand aucun média ne joue.

Aucune page web ne peut lever cela. Ce qu'elle peut faire, c'est **le rendre
constatable**.

**Ce qui est ajouté, dans les réglages** :

- **un choix de sonnerie**, parmi quelques timbres nettement différents ;
- **un bouton pour l'écouter tout de suite**, sans lancer de séance. C'est
  l'essentiel : c'est là qu'on découvre en trois secondes que le téléphone est
  muet, au lieu de le découvrir au milieu d'un gainage ;
- **une phrase qui dit quoi faire** si rien ne sort : monter le volume média en
  appuyant sur les boutons de volume **pendant que le son joue**, ce qui est le
  seul moment où ces boutons règlent le bon canal.

La vibration reste, et reste le seul canal qui traverse un téléphone muet.

## A11. Garder l'écran allumé, vraiment, et pouvoir le dire

**Demandé par le demandeur** le 15 août 2026 : une option pour bloquer la mise
en veille du téléphone.

La demande révèle un défaut, car l'application le fait **déjà** — mal. Le §5
l'exige depuis le premier jour : « un téléphone qui se verrouille au milieu
d'un gainage d'une minute annule le minuteur, et elle ne recommence pas. » Le
verrou d'écran est bien demandé au début d'une séance.

**Mais il n'est jamais redemandé.** Le navigateur relâche ce verrou de
lui-même dès que la page passe en arrière-plan — un message reçu, un
basculement d'application, un écran éteint une seule fois — et rien ne le
reprend au retour. Elle le perd donc au premier incident, définitivement, et
le téléphone s'endort au milieu de l'exercice suivant. Le §5 était tenu à la
première seconde de la séance et faux ensuite.

**Ce qui change** :

- **Le verrou se reprend** dès que la page redevient visible, tant qu'une
  séance est en cours. C'est le correctif, et il vaut indépendamment de
  l'option.
- **Une option dans les réglages**, active par défaut : « garder l'écran
  allumé pendant les séances ». Elle peut la couper — c'est sa batterie.
- **L'écran dit ce qui est vrai.** Si le navigateur ne sait pas tenir l'écran
  allumé, l'option le dit au lieu de faire semblant. Une promesse qu'on ne
  tient pas est pire que pas de promesse : elle laisse poser le téléphone
  loin, en confiance.

**Ce qui ne change pas** : le verrou ne vaut **que pendant une séance**, jamais
sur la grille, les réglages ou l'écran du jour. Une application qui empêche un
téléphone de dormir en permanence est une application qu'on désinstalle.

## A12. L'application s'installe sur le téléphone

**Demandé par le demandeur** le 15 août 2026.

Elle devient installable : ajoutée à l'écran d'accueil, elle s'ouvre **en plein
écran, sans barre de navigateur**, avec son icône et ses couleurs. C'est une
application web installée, pas une application de magasin.

**Cela ne contredit pas le §11.3, cela le précise.** Ce que ce paragraphe
excluait — et qui reste exclu — c'est le compte Google, le magasin
d'applications et le téléchargement. Le chemin d'entrée ne change pas : un lien
qui s'ouvre. L'installation est un **geste offert après coup**, jamais un
préalable, et **jamais réclamé** : aucune bannière, aucune invite qui recouvre
l'écran. L'application ne mendie pas son installation.

Ce que l'installation apporte, et qui compte pour cette utilisatrice précise :

- **Le plein écran.** Le téléphone est posé par terre et regardé à un mètre :
  la barre d'adresse et les onglets prennent une place qu'on ne peut pas se
  permettre, et un appui malheureux dessus sort de la séance.
- **Le hors-ligne, pour de vrai.** Le §11.2 exige qu'une séance entière se
  fasse réseau coupé. Aujourd'hui cela ne tient que par le cache du navigateur,
  que rien ne garantit. Une application installée garde sa coque, sa police et
  son programme, et le tient.
- **Une icône sur l'écran d'accueil**, ce qui, pour une enfant de treize ans,
  est la différence entre une adresse qu'on retape et une chose qui existe.

### Le piège, et comment il est tenu

**Une application installée peut ne jamais recevoir les corrections
suivantes.** C'est le défaut classique de ce mécanisme : la version en cache
est servie indéfiniment, et l'utilisatrice reste sur une application dont les
défauts sont pourtant réparés depuis longtemps. Au rythme où celle-ci évolue,
c'est le risque numéro un.

Il se tient par deux règles, et elles ne sont pas négociables :

1. **La coque n'est jamais servie depuis le cache quand le réseau répond.** Le
   réseau d'abord, le cache seulement en secours. Une correction livrée le
   matin est en place à la première ouverture qui a du réseau.
2. **Une version qui change remplace l'ancienne immédiatement**, sans attendre
   la fermeture de tous les onglets, et l'ancien cache est effacé.

Corollaire : ce qui est mis en cache l'est parce que la séance en a besoin hors
ligne — la coque, la police, le programme —, et rien de plus. **Aucune réponse
de l'API n'est jamais mise en cache** : une fiche périmée qui reviendrait à la
place de la vraie ferait perdre des séances, ce qui est exactement ce que le
serveur existe pour éviter.

### Ce que cela retire du contrat

Le PRP 02 avait posé un garde-fou : « aucune invite d'installation, aucun
manifeste », et un test le vérifie. Il visait les bannières qui recouvrent
l'écran d'une enfant, et cette intention reste — le manifeste, lui, est
désormais demandé. **Le test change de cible** : il continue d'interdire toute
invite d'installation faite par l'application, et cesse d'interdire le
manifeste.

## A5. La semaine attend qu'elle l'ait faite

Ce point **corrige le §8.5 et la règle §9.6**, qui disaient l'inverse : « la
semaine avance sur le calendrier, jamais sur l'assiduité. Sept jours après son
début, la suivante commence. »

C'était une erreur, et elle est du genre coûteux : elle punit exactement le
comportement que l'application existe pour soutenir. Une gymnaste qui part cinq
jours chez sa grand-mère perd une semaine entière du programme sans avoir rien
fait de mal. Trois absences de ce genre, et les huit semaines de la feuille sont
consommées en ayant fait la moitié des séances. Le §14 dit que l'abandon est le
risque principal ; un programme qui file tout seul pendant qu'on a le dos tourné
est une machine à l'engendrer.

**La règle devient** : une semaine avance quand ses **quatre séances sont
faites**, et pas avant. Le calendrier ne la pousse plus.

Conséquences, toutes voulues :

- **Rien ne se perd.** Les huit semaines de la feuille sont huit semaines de
  travail, pas huit semaines de calendrier. Elles durent ce qu'elles durent.
- **Elle peut passer à la suivante quand elle veut**, d'un geste explicite et
  confirmé. Une semaine qu'elle décide de laisser incomplète est son choix, pas
  une sanction du temps qui passe.
- **Rien ne réclame, rien ne rattrape.** Aucune notion de retard n'apparaît
  nulle part : il n'y a plus de retard possible, puisqu'il n'y a plus
  d'échéance.
- La date de chaque fait reste enregistrée — c'est elle qui fait la fusion
  entre deux téléphones. Elle ne sert simplement plus à faire avancer le
  programme.

**Ce qui ne change pas** : la règle §9.3 tient. Les semaines **au-delà** de
celle en cours restent en lecture seule — on ne coche pas ce qu'on n'a pas
encore abordé.

## A8. La liste des trente-six exercices

Il n'existait aucun endroit où voir le programme complet. L'application le
déroulait sans jamais le montrer, alors que c'est un document que le club a
distribué et qu'elle a sous les yeux depuis juillet.

**Un écran, atteignable depuis la grille et les réglages** : les trente-six
exercices, dans l'ordre de la feuille, groupés par famille comme sur les deux
pages d'origine. Pour chacun : son libellé exact, l'objectif de la semaine en
cours, et s'il a été fait **au moins une fois cette semaine**.

C'est la feuille du club, à l'écran, et c'est la réponse à la question qu'elle
se pose vraiment : « il me reste quoi à faire cette semaine ? »

**Ce qui reste interdit** : ni compteur, ni pourcentage, ni classement des
exercices par assiduité. On montre ce qui est fait, on n'en tient pas le score.

## A9. Ce qui vient

L'écran du jour annonce la séance à faire et rien d'autre. Une ligne discrète
lui dit **ce qui vient ensuite** : « après, ce sera L'équilibre ».

C'est une seule phrase, et elle a une raison précise : savoir qu'un ATR l'attend
demain change la façon dont on finit aujourd'hui. Un programme dont on ne voit
que le pas suivant se subit ; un programme dont on voit le pas d'après se
prépare.

Sur la dernière séance d'une semaine, la ligne annonce la semaine suivante.

## A10. Changer sa semaine de départ

Elle choisit sa semaine au premier lancement (§7.1), et ce choix était ensuite
définitif. Or c'est exactement le genre de réglage qu'on se trompe une fois : on
tape 1 par réflexe alors qu'on en est à la 3, et on s'en aperçoit le lendemain.

**Les réglages permettent de la changer**, avec les mêmes huit cibles que
l'écran d'entrée, et une confirmation qui dit ce que cela déplace.

**Rien n'est effacé** : les exercices faits restent attachés à la semaine où ils
l'ont été. Changer la semaine de départ change là où elle se trouve dans le
programme, pas ce qu'elle a fait.

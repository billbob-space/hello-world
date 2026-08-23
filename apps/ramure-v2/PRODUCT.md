# RAMURE

> **Product Requirements Document · Spécification de construction**

**Plante un nom, saute de branche en branche.**

Une application d'exploration généalogique de la musique. Un artiste au centre, ses parents
musicaux en orbite, leurs héritiers autour d'eux ; chaque clic promeut une branche au centre
et fait repousser l'arbre. Ce document décrit le produit à construire — le *quoi* et le
*pourquoi*, jamais le *comment*.

| | |
|---|---|
| Nom de travail | **RAMURE** |
| Version | **1.1** — décisions tranchées, annexe, retrait de la v1 |
| Date | **30 juillet 2026**, révisé le **19 août 2026** |
| Destinataire | **équipe de réalisation** |

> Source : artifact [RAMURE — PRD](https://claude.ai/code/artifact/90f89df8-3ea9-4b03-a5cf-267d701bb28d),
> converti en Markdown le 3 août 2026.

## Sommaire

1. [Résumé exécutif](#01--résumé-exécutif)
2. [Problème & proposition de valeur](#02--problème--proposition-de-valeur)
3. [Utilisateurs & cas d'usage](#03--utilisateurs--cas-dusage)
4. [Objectifs & métriques de succès](#04--objectifs--métriques-de-succès)
5. [Concepts & vocabulaire](#05--concepts--vocabulaire)
6. [La boucle principale](#06--la-boucle-principale)
7. [Structure de l'expérience](#07--structure-de-lexpérience)
8. [Exigences fonctionnelles](#08--exigences-fonctionnelles)
9. [Sources de données](#09--sources-de-données)
10. [Exigences non fonctionnelles](#10--exigences-non-fonctionnelles)
11. [Rendu & mouvement](#11--rendu--mouvement)
12. [Accessibilité & ergonomie](#12--accessibilité--ergonomie)
13. [Stratégie de recette](#13--stratégie-de-recette)
14. [Risques](#14--risques)
15. [Découpage en lots](#15--découpage-en-lots)
16. [Hors scope](#16--hors-scope)
17. [Décisions déléguées & questions tranchées](#17--décisions-déléguées--questions-tranchées)
18. [Annexe — les questions qu'un PRD doit avoir tranchées](#18--annexe--les-questions-quun-prd-doit-avoir-tranchées)
19. [RAMURE v2 — ce qu'elle change, et le retrait de la première version](#19--ramure-v2--ce-quelle-change-et-le-retrait-de-la-première-version)

---

## 01 · Résumé exécutif

> *Aucune interface grand public ne montre comment les groupes descendent les uns des autres.
> RAMURE en fait un canevas qu'on parcourt au doigt.*

RAMURE répond à une question que tout auditeur se pose et qu'aucun outil ne traite bien :
**« j'aime ce groupe — qu'est-ce que j'écoute ensuite, et pourquoi ? »** Les services de
streaming répondent par une file de recommandations opaque ; les encyclopédies musicales
répondent par des pages à lire. RAMURE répond par un geste : on plante un nom, un arbre de
parenté pousse autour, on saute d'une branche à l'autre.

Le produit n'héberge aucune musique et ne remplace aucun abonnement. Il se place **en amont de
l'écoute** : il aide à décider quoi écouter, puis passe la main au service de streaming de
l'utilisateur. Il ne constitue pas non plus son propre référentiel de filiations : il compose
des signaux issus de catalogues publics et rend leur combinaison lisible.

### Ce qui distingue la proposition

- **L'affinité est visible** — la proximité entre deux artistes se lit dans la distance et la taille, pas dans un score écrit.
- **Le parcours est mémorisable** — la lignée traversée reste affichée et cliquable ; on sait toujours comment on est arrivé là.
- **La proposition n'est jamais figée** — deux visites du même artiste ne donnent pas le même entourage.
- **La découverte se conserve** — un artiste trouvé se garde, se retrouve et se replante.

| Lots | Exigences | Rôles de données | Session cible | Sauts / session |
|---|---|---|---|---|
| 3 (MVP · V1 · V2) | 42 | 4 | 5 – 20 min | ≥ 4 |

> **Comment lire ce document**
>
> Les exigences sont numérotées **F-xx** (fonctionnelles) et **N-xx** (non fonctionnelles),
> chacune avec un critère d'acceptation observable et un lot de rattachement. Aucune
> technologie, bibliothèque ou fournisseur d'API n'est imposé : la §09 décrit les *rôles* de
> données à couvrir et leurs critères de choix, la §17 liste ce qui est explicitement délégué à
> l'équipe de réalisation.

---

## 02 · Problème & proposition de valeur

| Problème constaté | Réponse de RAMURE |
|---|---|
| **La recommandation est opaque.** On ne sait pas pourquoi un artiste est proposé, donc on ne peut ni faire confiance ni corriger le tir. | L'affinité module deux propriétés visuelles simultanément : la distance au centre et la taille de la pastille. Un voisin proche et gros est un cousin évident ; un petit et lointain est un pari assumé. |
| **Le parcours n'est pas mémorisable.** Trois recommandations plus loin, on ne sait plus d'où l'on part. | La lignée complète reste affichée. Chaque ancêtre est cliquable : on remonte d'un cran ou l'on saute directement à la racine. |
| **La proposition est figée.** Le même artiste donne toujours les mêmes suggestions ; l'outil s'épuise en trois visites. | L'entourage est retiré à chaque visite : quelques voisins évidents restent stables, les autres sont tirés au sort pondérés par l'affinité dans un vivier plus large. Une action explicite permet de rebattre sans changer d'artiste. |
| **Découvrir ne mène nulle part.** On oublie le nom trouvé avant d'avoir écouté quoi que ce soit. | Un signet conserve l'artiste, le contexte de sa découverte et permet de replanter l'arbre dessus plus tard, depuis n'importe quel appareil. |
| **On ne sait pas par où entrer dans une discographie.** Vingt albums, aucun repère. | Discographie classée par appréciation communautaire, filtrable par type de sortie, et palmarès transversal à tout l'arbre affiché. |

### Promesse en une phrase

*Tu pars d'un groupe que tu aimes et, en cinq minutes, tu repars avec trois noms que tu
n'aurais jamais tapés — et tu sais comment tu es tombé dessus.*

### Principes directeurs

- **Le geste avant l'algorithme.** Une recommandation n'a de valeur que si l'utilisateur sent qu'il l'a provoquée.
- **Montrer, pas expliquer.** Ce qui peut être encodé dans la forme ne doit pas être écrit en toutes lettres.
- **Complémentaire, pas captif.** Aucune tentative de retenir l'écoute : l'extrait sert à décider, le lien externe sert à écouter.
- **Dégrader, jamais casser.** Une source muette fait perdre une fonction, jamais l'écran.
- **Chaque session laisse une trace.** Un artiste gardé, une lignée parcourue, un lien partagé.

---

## 03 · Utilisateurs & cas d'usage

### Le creuseur

*Persona primaire — cible du MVP*

Auditeur intensif, connaît le vocabulaire des genres, veut aller plus loin dans une filiation
précise. Il a déjà épuisé les recommandations de son service de streaming et cherche l'obscur,
le rattachement historique, l'album oublié.

**Parcours type :** plante un groupe qu'il vient de découvrir → repère un voisin dont il n'a
jamais entendu parler → ouvre sa fiche → écoute un extrait → le garde → replante dessus →
trois générations plus loin, ouvre son album le mieux noté sur son service d'écoute.

### Le vérificateur

*Persona secondaire — servi dès le MVP*

Vient avec une question fermée : « qu'est-ce que ce groupe a de mieux ? », « qui sonne comme ça
mais en plus rare ? ». Il n'explore pas, il tranche vite.

**Parcours type :** plante un nom → ouvre directement le palmarès → repart avec un titre
d'album. Deux minutes, aucun saut.

### Le partageur

*Persona d'acquisition — lot V1*

A trouvé une branche qui l'a scotché et veut l'envoyer à quelqu'un. C'est le seul mécanisme
d'acquisition organique du produit : chaque partage est une démonstration de la valeur,
adressée à quelqu'un qui a déjà le bon profil.

**Exigence induite :** un lien partagé doit ouvrir l'arbre directement sur l'artiste concerné,
y compris pour un destinataire qui n'a jamais utilisé le produit.

### Anti-personas

Le produit n'est *pas* conçu pour l'auditeur passif qui veut « de la musique en fond » — il
demande une intention et un geste. Il n'est pas non plus conçu pour le documentaliste qui
cherche l'exhaustivité et la rigueur bibliographique : RAMURE privilégie la traversée à la
complétude.

---

## 04 · Objectifs & métriques de succès

Le produit réussit s'il produit des sessions *profondes* qui débouchent sur une écoute réelle
et laissent une trace. Les cibles sont des hypothèses de départ, à réviser dès les premières
mesures ; l'instrumentation qui permet de les calculer fait partie du périmètre du MVP
(cf. N-09).

| ID | Objectif | Métrique | Cible | Lot |
|---|---|---|---|---|
| M-01 | L'exploration est profonde | Nombre médian de sauts par session | ≥ 4 | MVP |
| M-02 | La découverte est réelle, pas circulaire | Part d'artistes centraux jamais visités auparavant | ≥ 60 % | MVP |
| M-03 | La session débouche sur une écoute | Sessions comportant au moins une ouverture de lien d'écoute | ≥ 45 % | MVP |
| M-04 | La découverte se conserve | Sessions comportant au moins un artiste gardé | ≥ 30 % | MVP |
| M-05 | Le premier arbre s'affiche vite | Latence P75 entre la validation d'un nom et l'affichage de l'entourage | ≤ 1,5 s | MVP |
| M-06 | La collection est réutilisée | Part de sessions amorcées depuis un artiste gardé | ≥ 20 % | V1 |
| M-07 | Le partage fonctionne comme acquisition | Part de nouvelles sessions ouvertes depuis un lien partagé | ≥ 10 % | V1 |
| M-08 | Le produit reste utilisable par tous | Violations d'accessibilité de niveau critique | 0 | MVP |

> **Chaque métrique est instrumentée avec la fonction qu'elle mesure**
>
> M-01 à M-05 et M-08 le sont dès le MVP (N-09). M-06 et M-07 arrivent avec les
> fonctions qu'elles jugent — la collection et le partage —, jamais après : une
> fonction livrée sans son compteur est une fonction dont personne ne saura
> jamais si elle a servi. M-07 se lit sous la décision du §17 n° 2 : le
> destinataire d'un lien doit posséder un compte Google, la cible mesure donc le
> partage entre gens déjà équipés.

### Contre-indicateurs à surveiller

- **Sessions à un seul saut** — l'arbre n'a pas donné envie de continuer : le premier entourage est mal choisi.
- **Retours en arrière répétés** — les propositions déçoivent systématiquement.
- **Recherches successives sans exploration** — le produit est utilisé comme un moteur de recherche, pas comme un explorateur.

---

## 05 · Concepts & vocabulaire

Ce vocabulaire est contractuel : il doit être employé tel quel dans l'interface, les maquettes,
le code et les tests. Un même objet nommé de deux façons crée des divergences de compréhension
coûteuses.

| Terme | Définition |
|---|---|
| **Graine** | Le nom d'artiste par lequel l'utilisateur amorce une exploration. |
| **Centre** | L'artiste actuellement au cœur de l'arbre. Un seul à la fois. |
| **Branche** | Un artiste proche du centre, affiché en orbite autour de lui. Cliquable. |
| **Héritier** | Un artiste proche d'une branche, affiché en orbite courte autour d'elle. Deuxième génération, également cliquable. |
| **Affinité** | Degré de proximité entre deux artistes, normalisé entre 0 et 1. Jamais affiché comme un nombre sur le canevas. |
| **Vivier** | L'ensemble des artistes proches connus pour un centre donné, dans lequel les branches sont sélectionnées. |
| **Promotion** | L'action de faire d'une branche le nouveau centre. Le geste fondamental du produit. |
| **Lignée** | La suite ordonnée des centres traversés depuis le début de la session. |
| **Rebattre** | Retirer un nouvel entourage sans changer de centre. |
| **Collection** | L'ensemble des artistes gardés par l'utilisateur, avec leur contexte de découverte. |
| **Palmarès** | Classement des meilleurs albums de tous les artistes actuellement visibles dans l'arbre. |

> **Paramètres de cadrage**
>
> Le produit est dimensionné autour de ces ordres de grandeur, à confirmer par la mesure :
> **8 à 10 branches** par centre (au-delà, le canevas devient illisible ; en deçà,
> l'exploration s'appauvrit), dont **2 stables** d'une visite à l'autre pour conserver un
> repère ; **2 à 3 héritiers** par branche ; un vivier d'au moins **30 candidats** pour que le
> tirage ait du sens.

---

## 06 · La boucle principale

> *Planter · lire · promouvoir · garder — puis recommencer un cran plus loin.*

**01 — Planter.** L'utilisateur saisit un nom d'artiste, avec suggestions au fil de la frappe.
Il peut aussi partir d'une tuile de l'écran d'accueil, d'un artiste déjà gardé, ou d'un lien
partagé.

**02 — Repêcher le nom.** Si le nom saisi n'est pas reconnu, le produit tente une correction à
partir d'une seconde source avant d'annoncer un échec — une faute de frappe ou une variante
orthographique ne doit pas conclure l'exploration.

**03 — Faire pousser.** Le centre et son entourage s'affichent immédiatement. Pochettes,
héritiers et appréciations arrivent progressivement, sans écran d'attente global : à aucun
moment l'utilisateur ne regarde une page vide.

**04 — Élaguer.** Une branche dont on ne peut ni afficher l'illustration ni proposer d'écoute
est retirée : elle n'apporte rien et occupe une place rare. L'élagage ne s'applique que s'il
reste assez de branches pour que l'arbre garde du sens.

**05 — Lire.** La fiche du centre donne présentation, genres, audience et discographie classée
par appréciation, filtrable par type de sortie. Un lecteur enchaîne les extraits. Chaque album
et chaque artiste porte un lien vers le service d'écoute choisi par l'utilisateur.

**06 — Promouvoir.** Un clic sur une branche : le nœud cliqué *voyage* vers le centre en
grossissant pendant que la génération précédente s'efface sur place. La scène n'est jamais
reconstruite, l'illustration ne clignote pas, et le centre précédent est empilé dans la lignée.

**07 — Garder, rebattre ou partager.** Le signet ajoute l'artiste à la collection avec son
contexte de découverte. « Rebattre » relance un entourage sans changer de centre. Le partage
produit un lien qui ouvre l'arbre sur cet artiste chez le destinataire.

---

## 07 · Structure de l'expérience

### Deux états d'écran

#### État A — l'accueil

*Aucune graine plantée*

L'écran d'entrée ne doit jamais être un champ de recherche seul sur fond vide : c'est le moment
où le produit doit donner envie. Il présente un **mur de pochettes plein écran** — les artistes
déjà gardés en priorité, sinon une sélection éditoriale d'amorçage — surmonté d'un bandeau
compact : titre, invitation, accès à la recherche, choix de tri.

- Chaque tuile est une action explicite : planter cet artiste.
- Un tri au choix de l'utilisateur, mémorisé d'une session à l'autre.
- Aucune tuile vide ni décalage de mise en page pendant le chargement des illustrations : une illustration manquante est remplacée par un repli graphique stable.

#### État B — le canevas

*Une graine est plantée*

- **Le centre** — artiste courant, plus grand que tout le reste, illustré et nommé.
- **L'anneau** — les branches, dont la taille et la distance au centre traduisent l'affinité.
- **Les grappes d'héritiers** — en orbite courte autour de leur branche, en éventail, de sorte que le rattachement soit sans ambiguïté.
- **Les liens** — un trait relie chaque branche au centre et chaque héritier à sa branche.
- **La lignée** — affichée en permanence, chaque ancêtre cliquable, avec les actions « rebattre », « palmarès » et « collection ».
- **La fiche** — profil du centre, discographie, lecteur, signet, liens d'écoute.

**Ce que la fiche coûte, et quand.** Le profil et la discographie du centre font
partie de l'écran : ils sont chargés **avec l'arbre**, à chaque promotion. Les
extraits et les liens d'écoute, eux, ne sont demandés qu'**au geste** — ouvrir le
lecteur, cliquer un lien. La distinction n'est pas cosmétique : elle fixe le coût
du geste le plus fréquent du produit (N-03), et elle doit être la même dans tous
les documents qui le chiffrent.

### Deux dispositions

| Élément | Écran étroit | Écran large |
|---|---|---|
| Recherche | Barre dédiée, permanente | Intégrée à une barre d'outils flottante |
| Lignée | Sous la recherche | Dans la barre d'outils |
| Fiche artiste | Panneau ancré en bas de l'écran | Panneau latéral flottant, repliable |
| Palmarès, collection | Panneau glissant depuis le bas | Fenêtre modale centrée |
| Canevas | Toute la largeur disponible | Se recale sur l'espace restant quand un panneau s'ouvre ou se replie |
| Aperçu au survol | Sans objet | Survoler une branche en montre un aperçu sans remplacer le profil du centre |

**Contrainte structurante :** la bascule entre dispositions n'est pas cosmétique. Les deux
variantes d'un même contrôle ne doivent jamais coexister — deux champs de recherche simultanés
produiraient des requêtes en double et deux commandes portant le même intitulé désorienteraient
la navigation assistée.

---

## 08 · Exigences fonctionnelles

### Recherche & amorçage

| ID | Exigence | Critère d'acceptation | Lot |
|---|---|---|---|
| F-01 | Suggestions à la frappe | Des propositions d'artistes apparaissent au fil de la saisie et peuvent être choisies à la souris comme au clavier | MVP |
| F-02 | Navigation clavier complète du champ | Flèches pour parcourir, validation pour planter, effacement en une action ; l'état de la liste est exposé aux technologies d'assistance | MVP |
| F-03 | Rattrapage d'un nom approximatif | Un nom mal orthographié mais identifiable est replanté sous sa forme correcte, sans que l'utilisateur ait à retaper | V1 |
| F-04 | Amorçage externe | Un lien partagé ou une entrée depuis la collection plante l'artiste une seule fois, sans le replanter aux navigations suivantes | MVP |
| F-05 | Mur d'accueil | Occupe toute la hauteur disponible sans défilement ; le nombre de colonnes s'adapte à la largeur ; l'apparition est progressive et neutralisable | MVP |
| F-06 | Tri du mur, mémorisé | Au moins trois ordres proposés dont un aléatoire relançable ; le choix survit au rechargement ; changer de tri ne recharge aucune illustration | V1 |
| F-07 | Retour à l'accueil propre | Revenir à l'écran d'accueil par la navigation principale réinitialise l'état : la dernière graine ne reste pas collée | MVP |

### Canevas & navigation

| ID | Exigence | Critère d'acceptation | Lot |
|---|---|---|---|
| F-08 | Entourage non figé | Deux visites successives du même centre donnent des entourages différents, tout en conservant les voisins les plus évidents | MVP |
| F-09 | L'affinité se lit sans texte | Distance au centre et taille de pastille varient toutes deux avec l'affinité, de façon monotone et perceptible | MVP |
| F-10 | Héritiers rattachés visuellement | Chaque héritier gravite autour de sa branche ; aucun héritier n'apparaît détaché ou attribuable à une autre branche | MVP |
| F-11 | Un seul geste pour naviguer | Un appui tactile unique suffit ; souris et clavier produisent le même résultat ; aucun double geste requis | MVP |
| F-12 | Promotion sans rupture visuelle | Le nœud choisi reste visible durant toute la transition ; le nouveau centre est illustré dès son apparition ; aucun clignotement ni reconstruction de la scène | MVP |
| F-13 | Robustesse aux gestes rapides | Deux promotions enchaînées rapidement aboutissent à un état cohérent ; naviguer dans la lignée pendant une transition en cours mène à la destination demandée | MVP |
| F-14 | Lignée cliquable | Retour d'un cran ou saut direct vers n'importe quel ancêtre, depuis les deux dispositions | MVP |
| F-15 | Rebattre l'entourage | Nouvel entourage à centre constant ; la vue revient à son cadrage neutre | V1 |
| F-16 | Élagage des branches inexploitables | Une branche sans illustration ni écoute possible est retirée, à condition qu'il en reste un nombre suffisant | V1 |
| F-17 | Zoom et déplacement du canevas | Zoom borné, centré sur le point désigné ; déplacement libre ; retour au cadrage neutre en une action, proposée dès que la vue a bougé | MVP |
| F-18 | Reprise de la lignée | Recharger l'application restitue la lignée en cours au lieu de repartir de l'accueil | V2 |

### Fiche artiste, discographie, écoute

| ID | Exigence | Critère d'acceptation | Lot |
|---|---|---|---|
| F-19 | Profil du centre | Présentation, genres, audience, illustration ; sur écran large, survoler une branche n'écrase jamais le profil du centre | MVP |
| F-20 | Discographie fidèle | La discographie affichée appartient bien à l'artiste demandé, sans mélange avec un homonyme, et couvre l'essentiel du catalogue | MVP |
| F-21 | Classement par appréciation | Les albums sont ordonnés par appréciation communautaire une fois celle-ci disponible ; les albums non appréciés conservent un ordre stable ; le reclassement final est perceptible comme tel | V1 |
| F-22 | Filtre par type de sortie | Au minimum : studio, live, compilation, format court. Un album relève d'un seul type. Le filtre est masqué s'il n'y a rien à filtrer et s'applique aussi au palmarès | V1 |
| F-23 | Signal de nouveauté | Une sortie récente est signalée sur la branche concernée et dans la discographie | V2 |
| F-24 | Lecteur d'extraits | Enchaîne les extraits du centre ; contrôles disponibles depuis l'extérieur de l'application quand la plateforme le permet ; réinitialisé à chaque changement de centre | V1 |
| F-25 | Choix du service d'écoute | L'utilisateur choisit son service parmi une liste ; tous les liens d'écoute de l'application le respectent ; le choix le suit d'un appareil à l'autre | V1 |
| F-26 | Liens d'écoute fiables | Un lien mène à la page la plus précise atteignable ; à défaut, à une recherche pré-remplie — jamais à une page vide ou erronée | V1 |
| F-27 | Palmarès de l'arbre | Meilleurs albums de tous les artistes visibles, nombre de résultats borné ; sélectionner un résultat replante l'arbre sur son artiste | V2 |

### Collection & partage

| ID | Exigence | Critère d'acceptation | Lot |
|---|---|---|---|
| F-28 | Garder et retirer un artiste | Action disponible depuis la fiche ; l'artiste apparaît et disparaît immédiatement de la collection | MVP |
| F-29 | Contexte de découverte conservé | Chaque artiste gardé mémorise la lignée complète qui y a mené, ainsi que la date | V1 |
| F-30 | Contexte de découverte affiché | La collection montre le chemin parcouru jusqu'à chaque artiste, pas seulement le nom | V1 |
| F-31 | Replanter depuis la collection | Un clic ferme la collection et recentre l'arbre sur l'artiste choisi | MVP |
| F-32 | Collection multi-appareils | La collection suit le compte de l'utilisateur, quel que soit l'appareil | V1 |
| F-33 | Fonctionnement dégradé de la collection | Sans compte ou sans réseau, la collection reste utilisable localement et se réconcilie à la reconnexion, sans perte ni doublon | V1 |
| F-34 | Partager un arbre | Une action produit un lien vers le centre courant ; le destinataire ouvre l'arbre sur cet artiste, y compris à sa première visite | V1 |
| F-35 | Partager ou exporter sa collection | Le contenu de la collection peut être partagé ou exporté dans un format lisible hors de l'application | V2 |

### États vides, erreurs et attente

| ID | Exigence | Critère d'acceptation | Lot |
|---|---|---|---|
| F-36 | Distinguer « rien à montrer » de « panne » | Un artiste sans voisins connus et un échec de chargement produisent deux messages différents ; seul le second propose de réessayer | MVP · **Critique** |
| F-37 | Un échec n'est jamais mémorisé | Réessayer relance un véritable chargement : aucun résultat vide ni aucune erreur transitoire n'est conservé en mémoire ou sur le poste | MVP · **Critique** |
| F-38 | Aucun chargement sans issue | Tout état d'attente aboutit à un contenu, un message explicite ou une action de sortie — jamais à une attente indéfinie | MVP |
| F-39 | Affichage progressif | Le centre et l'entourage s'affichent avant les illustrations, héritiers et appréciations, sans faire sauter la mise en page | MVP |
| F-40 | Dégradation de l'écoute | Aucun extrait disponible → commande de lecture désactivée et explicite, jamais un bouton inerte | V1 |
| F-41 | Session expirée signalée | Si les échanges avec le serveur échouent parce que la session a expiré, l'utilisateur en est informé et peut se reconnecter — l'application ne laisse jamais croire à une erreur de saisie | V1 |
| F-42 | Mise à jour de l'application signalée | Lorsqu'une nouvelle version est déployée, l'utilisateur en est informé et peut l'appliquer sans vider son cache manuellement | V1 |

---

## 09 · Sources de données

Le produit ne constitue pas son propre référentiel. Il agrège des sources externes, décrites
ici par **rôle** : le choix des fournisseurs est délégué à l'équipe de réalisation, sous réserve
des capacités et critères ci-dessous. Un même fournisseur peut couvrir plusieurs rôles ; un
rôle peut être couvert par plusieurs fournisseurs en cascade.

### Rôle 1 — Proximité entre artistes

*Indispensable · sans lui, pas de produit*

**Doit fournir :** pour un artiste donné, une liste d'artistes proches assortie d'un degré
d'affinité normalisé, plus une présentation textuelle, des genres et un indicateur d'audience.

**Critères de choix :** profondeur du catalogue sur les genres de niche ; qualité de l'affinité
pour les artistes peu connus ; stabilité des conditions d'utilisation ; possibilité d'un usage
serveur.

### Rôle 2 — Catalogue de référence

*Indispensable*

**Doit fournir :** résolution d'un nom vers un identifiant d'artiste non ambigu, discographie
complète rattachée à cet identifiant, illustrations, et extraits audio courts.

**Critères de choix :** *la résolution par identifiant est le critère décisif* — une source qui
ne sait faire que de la recherche par mots-clés produira des discographies polluées
d'homonymes.

### Rôle 3 — Appréciation communautaire

*Souhaitable · dégradation acceptable*

**Doit fournir :** une note agrégée par album, le nombre de votes, et le type d'édition
(studio, live, compilation, format court).

**Critères de choix :** couverture des genres visés ; un seuil minimal de votes doit être
applicable pour écarter les notes non significatives. Une couverture partielle est acceptable :
les albums non appréciés conservent simplement un ordre stable.

### Rôle 4 — Résolution des liens d'écoute

*Souhaitable · repli systématique*

**Doit fournir :** à partir d'un artiste ou d'un album, l'adresse de sa page sur les principaux
services de streaming.

**Critères de choix :** couverture multi-services sans authentification de l'utilisateur. En
l'absence de résolution exacte, le repli obligatoire est une recherche pré-remplie sur le
service choisi.

### Règles d'intégrité — applicables à toutes les sources

- **Correspondance stricte des noms.** Si aucun résultat ne correspond exactement au nom demandé, renvoyer un résultat vide plutôt que le premier candidat approchant. Un appariement approximatif contamine tout un sous-arbre et détruit la confiance : l'utilisateur voit s'afficher la discographie d'un artiste qu'il n'a pas demandé, sans aucun signal d'erreur. Cette règle prime sur le taux de couverture.
- **Une correction de nom doit rester plausible.** Le rattrapage orthographique (F-03) ne doit jamais substituer un artiste à un autre : la correction est bornée en écart et refusée en cas de doute.
- **Aucun état d'échec n'est conservé.** Résultat vide, note absente, erreur réseau : ce sont des états transitoires. Les mémoriser condamne durablement un artiste à un affichage dégradé, même une fois la source rétablie.
- **Les réponses tardives sont ignorées, pas appliquées.** Lorsqu'un utilisateur enchaîne les promotions, la réponse d'un chargement abandonné ne doit jamais s'appliquer au centre courant.
- **Aucune source n'est appelée directement depuis le poste de l'utilisateur.** Les échanges transitent par le serveur du produit, qui porte les identifiants d'accès et applique les politiques de cache et de débit. Aucun secret d'accès ne doit être déductible côté client.

---

## 10 · Exigences non fonctionnelles

| ID | Domaine | Exigence | Lot |
|---|---|---|---|
| N-01 | Réactivité | Le centre et l'entourage s'affichent en moins de 1,5 s au 75ᵉ centile ; la promotion d'une branche déjà affichée est perçue comme instantanée | MVP |
| N-02 | Fluidité | Zoom et déplacement restent fluides sur un appareil mobile de milieu de gamme, quel que soit le nombre de nœuds affichés | MVP |
| N-03 | Budget d'appels | Chaque promotion a un coût borné et documenté en nombre d'appels par source. Les sources les plus contraintes en débit sont réservées au centre ; l'entourage est servi par les sources les plus tolérantes | MVP · **Critique** |
| N-04 | Cache mutualisé | Les réponses des sources externes sont mises en cache **côté serveur, partagé entre tous les utilisateurs**, avec des durées adaptées à la volatilité de chaque donnée. Un cache par navigateur ne protège pas d'un plafond de débit commun | MVP |
| N-05 | Cache et erreurs | Les réponses en erreur ou en dépassement de quota ne sont jamais mises en cache : le statut réel doit remonter pour que la temporisation côté client fonctionne | MVP |
| N-06 | Résilience | L'indisponibilité du cache ou d'une source secondaire dégrade une fonction, jamais l'écran. Le produit reste utilisable, simplement moins riche ou moins rapide | MVP |
| N-07 | Concurrence | Les requêtes identiques simultanées sont mutualisées ; les enchaînements rapides de promotions ne produisent ni requêtes redondantes ni états incohérents | MVP |
| N-08 | Identité & confidentialité | L'identité qui partitionne les données conservées est établie côté serveur et non déclarée par le client. Aucune donnée d'un utilisateur n'est accessible à un autre | V1 |
| N-09 | Observabilité produit | Les événements nécessaires au calcul des métriques de la §04 sont émis et **agrégés côté serveur** dès le MVP. Un journal local non agrégé ne satisfait pas cette exigence | MVP |
| N-10 | Diagnostic | L'utilisateur peut exporter un journal de sa session pour l'attacher à un signalement — indispensable aux anomalies mobiles non reproductibles | V1 |
| N-11 | Installation & hors-ligne | Le produit est installable et démarre sans réseau sur son écran d'accueil ; les illustrations déjà vues restent disponibles | V1 |
| N-12 | Diffusion des mises à jour | Une version déployée atteint les installations existantes sans action manuelle de l'utilisateur, dans un délai borné | V1 |
| N-13 | Coût d'exploitation | L'architecture doit tenir sans contrat payant auprès des sources externes pour le volume visé, ou documenter explicitement le seuil de bascule | MVP |
| N-14 | Équité entre visiteurs | Le quota des sources est partagé par tous les visiteurs. Un visiteur seul ne peut pas le monopoliser : un seul chargement de centre en vol par identité, les suivants attendent leur tour | MVP · **Critique** |

> **Le budget d'appels est une exigence produit, pas un détail**
>
> La promotion est le geste central et le plus coûteux : afficher un centre, son entourage et
> les héritiers de chaque branche peut représenter plusieurs dizaines d'appels externes.
> Enrichir chaque branche avec la même profondeur que le centre conduit mécaniquement au
> dépassement de quota, donc à des illustrations et des branches manquantes — c'est-à-dire à un
> produit visiblement cassé. La règle **« profondeur maximale au centre, strict minimum sur
> l'entourage »** doit être posée dès la conception technique, pas corrigée après coup.

---

## 11 · Rendu & mouvement

Le mouvement porte du sens : le voyage du nœud promu *est* l'explication de ce qui se passe.
Ces exigences décrivent des perceptions attendues, pas des techniques d'animation.

### Caméra

- **Zoomer rapproche vraiment.** L'ensemble de la scène grossit — illustrations comprises. Un zoom qui agrandirait les pastilles sans agrandir leur contenu manque son objectif.
- **Le zoom est centré sur le point désigné** par le curseur ou les doigts : le point visé reste sous le doigt.
- **Les deux gestes sont distincts** : le geste de zoom zoome, le geste de défilement déplace. Aucune ambiguïté.
- **Le zoom est borné** : assez large pour voir tout l'arbre, assez proche pour viser confortablement le plus petit nœud.
- **Un retour au cadrage neutre** est proposé dès que la vue a été modifiée.
- **Une commande produit une animation, un geste n'en produit pas** : la vue doit suivre le doigt sans retard perceptible.

### Lisibilité

- **Un nom n'est jamais masqué** par une pastille voisine, à aucun niveau de zoom.
- **Les liens rejoignent leurs deux extrémités.** Un trait qui s'arrête avant sa cible donne l'impression d'un nœud détaché — défaut particulièrement visible sur grand écran.
- **Une marge est réservée** sur les bords pour que les libellés et les grappes d'héritiers ne soient jamais rognés par les panneaux.
- **Aucune illustration manquante ne laisse un vide** : un repli graphique déterministe et stable tient la place, sans provoquer de décalage à l'arrivée de l'image.

### Transition de promotion

- Le nœud choisi **reste visible en continu** pendant qu'il rejoint le centre : c'est le fil que l'œil suit.
- La génération précédente **s'efface sur place** — elle ne se déplace pas, sous peine de brouiller la lecture.
- Le nouveau centre **est illustré dès sa première apparition**, même si ses données complètes ne sont pas encore chargées.
- La vue **ne se recadre que si l'utilisateur l'avait modifiée** : une caméra qui bouge sans raison donne le vertige.
- La durée doit être **assez longue pour être suivie, assez courte pour ne pas être attendue**. Ordre de grandeur : quelques centaines de millisecondes, à valider par test utilisateur.

### Préférence de mouvement réduit

Lorsque le système signale une préférence de mouvement réduit, toutes les animations sont
**neutralisées, pas simplement accélérées** : la promotion s'applique immédiatement, sans délai
résiduel, et les apparitions progressives deviennent instantanées. Un utilisateur sensible au
mouvement ne doit jamais attendre plus longtemps qu'un autre.

---

## 12 · Accessibilité & ergonomie

Un canevas interactif est le pire cas d'accessibilité possible : contenu spatial, mis à jour en
continu, manipulé au geste. Le niveau visé est **WCAG 2.2 AA**, sans exception sur l'écran
principal.

- **Tout est atteignable au clavier.** Chaque nœud, branche comme héritier, est activable au clavier avec le même résultat qu'au clic.
- **Chaque nœud porte le nom complet de l'artiste** comme intitulé accessible — jamais une initiale, un identifiant ou une position.
- **Le changement de centre est annoncé** aux technologies d'assistance : c'est la seule façon de savoir que l'écran a changé sans le voir.
- **Aucun intitulé accessible en double.** Deux commandes portant le même nom sur un même écran rendent la navigation assistée inutilisable — contrainte à respecter en particulier lors du basculement entre dispositions.
- **Les actions de retour sont distinguées.** Quitter l'exploration et remonter d'un cran dans la lignée sont deux actions différentes : intitulés et icônes doivent les séparer sans ambiguïté.
- **Les cibles tactiles respectent une taille minimale**, y compris les commandes de zoom et les nœuds les plus petits.
- **Le focus est toujours visible** et l'ordre de tabulation suit la logique de lecture, pas l'ordre de rendu.
- **Les panneaux et fenêtres sont titrés**, y compris lorsque le titre n'est pas affiché visuellement.
- **Un lien d'évitement** permet d'atteindre directement le contenu principal.
- **Contraste et thème** : l'interface est lisible en thème clair comme sombre, et ne repose jamais sur la couleur seule pour transmettre une information.

---

## 13 · Stratégie de recette

Ce produit a une caractéristique qui doit orienter la stratégie de test : **ses défauts les plus
coûteux sont invisibles à la vérification automatique classique**. Un trait tronqué, un libellé
masqué, une discographie contaminée par un homonyme ou une animation qui double un décalage
passent tous la compilation et les tests unitaires.

### Ce qui doit être couvert

| Niveau | Objet | Exigence de couverture |
|---|---|---|
| **Unitaire** | Sélection de l'entourage, géométrie du canevas, bornes de zoom, classification des types de sortie, tri | Logique déterministe isolée de l'interface, avec source d'aléa injectable pour rendre les tirages reproductibles |
| **Unitaire** | Intégration des sources externes | Non-contamination entre artistes homonymes, respect des limites de débit, comportement du cache, refus de mémoriser un échec |
| **Intégration** | Chargement d'un centre | Sécurité des requêtes concurrentes, dégradation par source indisponible, affichage progressif |
| **Bout en bout** | Parcours complets | Planter, promouvoir, remonter la lignée, garder, replanter, partager — dans les deux dispositions |
| **Bout en bout** | Géométrie et lisibilité | Vérifications mesurées sur grand écran : les traits rejoignent leur cible, les libellés ne se recouvrent pas, le zoom agrandit bien les illustrations |
| **Bout en bout** | Pannes simulées | Réseau déterministe simulant : source vide, source en erreur, dépassement de quota, extraits indisponibles, session expirée |
| **Automatisé** | Accessibilité | Analyse automatique sur chaque écran, plus une vérification manuelle au clavier et au lecteur d'écran du parcours principal |

### Règles de recette

- **Chaque anomalie corrigée donne lieu à un test qui l'aurait détectée**, nommé d'après le symptôme observé par l'utilisateur. La suite de tests devient ainsi une liste lisible de régressions interdites.
- **Les parcours dépendant de sources externes sont testés contre un réseau simulé.** Tester contre des sources réelles produit des échecs intermittents qui finissent par être ignorés — et masquent alors les vraies régressions.
- **Une base de référence est tenue à jour** : nombre de tests attendus au vert et liste explicite des échecs connus non applicatifs, pour qu'aucune équipe ne rouvre deux fois la même enquête.
- **Les vérifications visuelles ont un viewport large explicite.** Plusieurs défauts de géométrie ne se manifestent qu'au-delà d'une certaine largeur.

---

## 14 · Risques

Chaque risque nomme le test qui le tient, et `./init.sh --check` vérifie que ce
nom existe pour de vrai. Tous les tests cités ici sont écrits et passent depuis
le 21 août 2026 : la dernière promesse encore en l'air — le cadrage plus étroit
sur écran étroit — a été tenue ce jour-là.

| Risque | Grav. | Mitigation exigée | Test |
|---|---|---|---|
| **Dépendance à une source unique de proximité** — sans elle, il n'y a pas d'arbre du tout | Élevée | Évaluer au moins deux fournisseurs pour le rôle 1 avant de s'engager ; encapsuler l'accès derrière une interface interne pour rendre la substitution possible ; distinguer explicitement « aucun voisin » de « source indisponible » (F-36) | `TestCascadeBasculeSurErreur` |
| **Dépassement des quotas partagés** — tous les utilisateurs sortent par la même adresse, le geste central est le plus coûteux | Élevée | Budget d'appels borné et documenté (N-03), cache mutualisé côté serveur (N-04), mutualisation des requêtes identiques (N-07), part équitable par visiteur (N-14), suivi du taux de service par le cache | `TestBudgetRespecteSurUnChargementComplet` |
| **Un visiteur monopolise le quota** — le palier d'exposition n'est pas une liste blanche, et la source la plus contrainte tolère un appel par seconde pour tout le monde | Élevée | Un seul chargement de centre en vol par identité (N-14) ; les autres attendent, aucun n'échoue | `TestUnSeulChargementEnVolParIdentite` |
| **Homonymes d'artistes** — un mauvais appariement contamine tout un sous-arbre sans aucun signal d'erreur | Élevée | Correspondance stricte imposée (§09), résolution par identifiant privilégiée, bornes sur la correction orthographique, tests de non-contamination | `TestDiscographieRattacheeAuMBIDDemande` |
| **Le canevas exige de la place** — le cœur du produit est le moins confortable sur téléphone | Moyenne | Parité stricte tranchée (§17) : le nombre de branches et d'héritiers est fonction de la largeur, et les cibles tactiles sont vérifiées aux deux dispositions | `TestCadragePlusEtroitSurEcranEtroit` |
| **Régressions visuelles invisibles** — géométrie, superpositions, animations | Moyenne | Vérifications mesurées en bout en bout sur grand écran (§13), revue visuelle systématique des écrans modifiés | non testable hors navigateur — la recette bout en bout la couvre, et elle ne tourne pas en intégration continue (§13) |
| **Couverture partielle de l'appréciation** — le classement disparaît sur les genres mal couverts | Faible | Ordre d'origine stable en l'absence de note, aucun réordonnancement intermédiaire, état vide explicite plutôt que classement trompeur | `TestAlbumSansNoteConserveUnOrdreStable` |
| **Métriques non instrumentées** — le produit ne peut pas prouver qu'il fonctionne | Moyenne | Agrégation côté serveur dans le périmètre du MVP (N-09), et non repoussée à une phase ultérieure | `TestInstantanePorteLesMetriquesDuLot` |

---

## 15 · Découpage en lots

Le découpage suit une règle : **chaque lot doit être démontrable et mesurable seul**. Aucun lot
ne livre une fonction dont la valeur dépend entièrement d'un lot ultérieur.

### MVP — la boucle d'exploration, démontrable de bout en bout

Objectif : prouver que le geste fonctionne et que les gens sautent plus d'une fois.

- Recherche, accueil, canevas, promotion, lignée, zoom et déplacement
- Profil du centre et discographie fidèle
- Garder et replanter un artiste (stockage local suffisant à ce stade)
- États vides et d'erreur correctement distingués — non négociable
- Budget d'appels et cache mutualisé en place dès le départ
- Instrumentation agrégée des métriques M-01 à M-05 et M-08

### V1 — la rétention et la diffusion

Objectif : faire revenir les gens et leur donner de quoi faire venir les autres.

- Comptes et collection synchronisée entre appareils, avec fonctionnement dégradé hors ligne
- Contexte de découverte conservé et affiché
- Partage d'un arbre par lien
- Classement par appréciation et filtre par type de sortie
- Lecteur d'extraits et choix du service d'écoute
- Installation, hors-ligne partiel et diffusion des mises à jour
- Rattrapage des noms approximatifs, rebattre, élagage des branches inexploitables

### V2 — la profondeur

Objectif : récompenser l'usage intensif, une fois la valeur de base démontrée.

- Palmarès transversal à l'arbre
- Reprise de la lignée après rechargement
- Signal de nouveauté sur les sorties récentes
- Partage et export de la collection
- Filtres complémentaires sur les branches (époque, notoriété, origine)

### Ultérieur — pistes à valider par la mesure

- Export d'une lignée vers une liste de lecture du service choisi
- Explication de la parenté entre deux artistes à partir de leurs attributs communs
- Intersection de deux arbres : ce qui relie deux artistes distants

---

## 16 · Hors scope

Explicitement exclu, pour éviter que ces sujets ne reviennent par la porte de derrière :

- **La lecture complète de musique.** Extraits courts uniquement ; l'écoute part chez le service choisi par l'utilisateur.
- **La création et l'édition de listes de lecture** dans le produit (l'export reste une piste ultérieure).
- **Un référentiel propriétaire de filiations musicales.** Le produit compose des signaux publics ; il ne se substitue pas aux encyclopédies existantes.
- **L'édition collaborative** des liens entre artistes par les utilisateurs.
- **Un modèle de similarité entraîné en interne.**
- **Les fonctions sociales** : flux d'activité, comparaison de collections, suivi entre utilisateurs.
- **La monétisation** : ni publicité, ni abonnement, ni affiliation dans le périmètre décrit.

---

## 17 · Décisions déléguées & questions tranchées

### Délégué à l'équipe de réalisation

- **Toute la pile technique** : langages, cadres applicatifs, hébergement, base de données, mécanisme de cache. Aucun choix n'est imposé par ce document.
- **Le choix des fournisseurs** pour chacun des quatre rôles de données, sous réserve des capacités et critères de la §09.
- **Le mécanisme d'authentification**, dès lors que l'identité de partitionnement est établie côté serveur (N-08).
- **Les valeurs exactes des paramètres de cadrage** (nombre de branches, taille du vivier, durées d'animation) : les ordres de grandeur de la §05 sont un point de départ, à affiner par test utilisateur.

### Questions tranchées — le 19 août 2026

Les cinq questions que ce document laissait ouvertes sont tranchées. Elles restent
écrites : une décision dont la question a disparu se reprend six mois plus tard
sans savoir qu'elle avait été prise.

1. **Mobile ou desktop en priorité ?** — *L'usage réel de l'écoute est mobile,
   mais le canevas s'exprime pleinement sur grand écran.*
   → **Parité stricte**, décision du commanditaire. Conséquence : les paramètres
   de cadrage du §05 deviennent **fonction de la largeur** — 10 branches et
   3 héritiers sur écran large, 6 branches et 2 héritiers sur écran étroit — pour
   tenir la lisibilité (§11) et les cibles tactiles (§12). Les deux variantes d'un
   même contrôle ne coexistent jamais (§07).
2. **Faut-il un compte pour explorer ?** — *Un accès invité en lecture seule était
   la piste recommandée.*
   → **Sans objet, et l'accès invité est abandonné.** L'application est servie
   derrière une authentification par compte Google appliquée **avant** elle :
   tout visiteur est authentifié dès sa première requête, et il n'existe pas de
   palier public. Deux conséquences à assumer : le cloisonnement des données par
   visiteur n'est pas optionnel (N-08), et le destinataire d'un lien partagé doit
   posséder un compte Google — la cible M-07 est donc à relire comme une mesure
   du partage entre gens déjà équipés, pas comme un canal d'acquisition ouvert.
3. **La session est-elle jetable ?** — *Reprendre une exploration ou la
   recommencer.*
   → **Jetable.** La lignée vit en mémoire et dans l'adresse de la page ; F-18
   reste en lot V2.
4. **Quel volume est visé ?** — *Le seuil de bascule doit être chiffré.*
   → **Usage confidentiel**, sans contrat auprès des sources. La contrainte dure
   est la source de catalogue, un appel par seconde et par adresse, partagée par
   tous les visiteurs : le seuil est d'environ **un nouveau centre non caché par
   seconde**, soit près de **cinq promotions par seconde** tous visiteurs
   confondus à 80 % de service par le cache — une hypothèse, à corriger dès la
   première mesure réelle. Au-delà : miroir de la source, ou contrat. C'est aussi
   ce qui rend N-14 nécessaire.
5. **Francophone ou international ?**
   → **Francophone.** Le vocabulaire du §05 est idiomatique et contractuel ; les
   chaînes affichées restent centralisées en un seul endroit pour ne pas fermer
   la porte.

### Questions tranchées — le 22 août 2026

Deux formes d'écran que la critique visuelle a refusé de trancher seule. Chacune
a été montrée en trois variantes ; ce qui suit dit ce qui est retenu **et ce qui
est écarté**, parce qu'une variante écartée sans trace se repropose.

6. **Que voit-on quand une graine ne donne rien ?** — *Aujourd'hui, l'application
   plante un artiste fantôme : un disque au centre portant le nom mal orthographié
   saisi par le visiteur, démenti par une ligne de gris à l'autre bout de l'écran.
   Elle affirme un résultat qu'elle n'a pas.*
   → **Une bande pleine largeur sous la barre de recherche, l'arbre précédent
   conservé derrière elle, estompé.** L'échec devient une information posée sur
   l'écran plutôt qu'un faux résultat, et le visiteur ne perd pas l'exploration
   en cours : c'est ce que la lignée du §06 promet, une exploration qui ne se
   défait pas sur une faute de frappe. Conséquence assumée : deux plans à tenir à
   l'écran, l'estompe devant rester assez lisible pour qu'on sache où l'on est
   sans qu'elle concurrence le message.

   *Écarté* — **le retour au mur d'accueil, champ armé** : il répare vite, mais
   il efface l'arbre en cours, ce qui punit une faute de frappe par la perte de
   l'exploration. **Le nœud d'échec explicite au centre** : plus économe, il
   garde le nom fautif au centre de l'écran, c'est-à-dire à la place réservée à
   ce qui existe.

7. **Quelle est la forme des tuiles du mur d'accueil sur écran large ?** — *Six
   bandes verticales très étirées, d'un rapport de 1 à 3,2, là où ce document
   parle d'un « mur de pochettes ».*
   → **Des pochettes carrées, en grille centrée.** Le mur cite un objet que tout
   le monde reconnaît, et le carré est la forme de cet objet ; l'écart entre le
   mot et l'image disparaît. La grille centrée évite en outre de rouvrir le vide
   latéral que la même critique venait de fermer.

   *Écarté* — **la tuile d'honneur entourée d'une mosaïque** : elle hiérarchise
   des propositions qui ne sont pas hiérarchisées, et donnerait à la première un
   poids que rien ne justifie. **Les bandes verticales assumées, plein cadre,
   nom à la verticale** : forme la plus affirmée des trois, mais elle éloigne
   encore le mur de la pochette au lieu de l'en rapprocher, et un nom à la
   verticale se lit mal.

### Questions tranchées — le 23 août 2026

La question 7 a donné au mur sa forme de tuile ; elle a laissé intacte la
question de ce que le mur fait du reste de l'écran, et celle de ce qu'il advient
d'un mur plus grand que l'écran. Les deux se tranchent ensemble : la seconde
disqualifie la moitié des réponses possibles à la première.

8. **Qu'est-ce qui occupe les 548 px de noir du mur d'accueil ?** — *Sur écran
   large, les six pochettes carrées de la question 7 tiennent sur une rangée de
   230,7 px, centrée dans une zone de 778 px : 547,7 px de noir, soit 70,4 % de
   la surface du mur. Le carré et la grille centrée ne sont pas rediscutés — la
   seule question est ce qui remplit le vide qu'ils laissent.*
   → **Rien, mais rangé : le mur se cale sous la barre plutôt que de flotter au
   milieu** (variante C). Le noir cesse d'être deux marges symétriques qui
   encadrent une rangée orpheline pour devenir une marge basse franche — 8 px en
   haut, 539 px en bas. La part de noir ne bouge pas d'un point, et c'est assumé :
   **la variante ne remplit pas le vide, elle le met là où il se remplira tout
   seul.** C'est la seule des trois qui ne plafonne pas le mur : à 1440 × 900
   elle tient **36 pochettes**, là où les deux autres en tiennent 6. Le jour où
   F-28 et F-30 font nourrir le mur par la collection, les rangées se remplissent
   vers le bas et la question se referme d'elle-même, sans qu'aucune décision de
   forme ait à être reprise.

   **Ce que « tenir » veut dire, et ce qu'il en coûte.** La tuile n'est pas
   inchangée : `auto-fit` ouvre jusqu'à 9 pistes à cette largeur, et les pistes
   vides s'effondrent au profit des pleines. Le mur passe donc de 6 pochettes de
   230,7 px à 9 pochettes de 151,1 px — puis **la tuile ne bouge plus**, toutes
   les pistes étant ouvertes, et ce sont les rangées qui se remplissent, jusqu'à
   quatre. C'est le plancher de 9 rem qui borne cette descente, et c'est ce qui
   sépare C des deux variantes écartées : elles rétrécissent aussi, mais sans
   plancher ni gain de rangée — A parce que sa tuile est dimensionnée par la
   hauteur disponible, B parce que la phrase occupe la place de la deuxième
   rangée. La différence n'est donc pas « rétrécir ou non », c'est **jusqu'où, et
   contre quoi on l'échange**.

   *Écarté* — **les pochettes elles-mêmes, en 3 × 2 dimensionnées par la
   hauteur** (tuiles de 377 px, part de noir ramenée de 70,4 % à 20,3 %) : c'est
   la seule qui traite vraiment le vide vertical, mais elle le paie deux fois. La
   tuile carrée de 377 px ne remplit plus la largeur et **rouvre 293 px de vide
   latéral**, 146,5 de chaque côté, là où l'écran n'en a plus que 8 — exactement
   le vide que la question 7 invoquait pour retenir la grille centrée, qui
   garderait son nom en perdant sa raison. Et elle plafonne le mur à 6 pochettes :
   au-delà, il faut rétrécir la tuile (9 → 249 px, 12 → 185 px), c'est-à-dire
   défaire la variante pour la faire tenir. **La promesse du produit en grand**,
   la phrase d'invitation portée de 12,8 px de gris à 300 px de haut : elle
   remplit honnêtement 300 des 548 px, mais transforme une partie de l'accueil en
   page d'accroche — utile à la première visite, inerte à toutes les suivantes —
   et occupe la place de la deuxième rangée, plafonnant le mur à 6 pochettes elle
   aussi. Les deux achètent l'écran d'aujourd'hui en hypothéquant celui de demain,
   alors que le mur est fait pour grossir.

9. **Que voit-on quand le mur est plus grand que l'écran ?** — *Le mur est en
   `overflow: hidden` et ses tuiles sont carrées : au-delà de ce que la zone
   peut porter — 36 pochettes à 1440 × 900, moins sur écran étroit — la
   rangée en trop n'est pas réduite, elle est **coupée**. Les tuiles concernées
   restent dans la page : invisibles à l'œil, mais atteintes par la tabulation et
   annoncées par un lecteur d'écran. Le PRD interdit par ailleurs le défilement
   sur l'accueil (§07 état A).*
   → **Le mur n'affiche que ce qui tient, et le plafond suit la taille de la
   fenêtre.** Les tuiles au-delà de la capacité mesurée ne sont pas rendues —
   ni à l'œil, ni au clavier, ni au lecteur d'écran. La capacité est **lue sur la
   grille que la CSS a calculée**, jamais recalculée en parallèle : le nombre de
   colonnes reste la décision de la CSS (§07, « le nombre de colonnes suit la
   largeur par CSS »), le code ne fait qu'en déduire combien de rangées entrent
   dans la hauteur disponible. Elle est réévaluée au redimensionnement, sans quoi
   le plafond d'un écran large survivrait au passage en écran étroit. Ce qui est
   réévalué est le **plafond seul** : ni l'ordre des pochettes ni leur place dans
   la page ne bougent, sans quoi un tri aléatoire se rebattrait à chaque pixel de
   redimensionnement.

   **Exception assumée** — une fenêtre trop courte pour porter ne serait-ce
   qu'une rangée entière montre quand même cette rangée, rognée par le bas. Ne
   jamais afficher zéro pochette prime sur ne jamais rogner : un accueil vide ne
   dit pas au visiteur que sa fenêtre est trop petite, il lui dit que le produit
   est cassé. C'est la seule situation où le mur coupe quelque chose, et elle est
   écrite ici pour qu'une relecture ultérieure ne prenne pas ce garde-fou pour un
   oubli et ne le retire pas.

   *Limite connue de cette exception* — sous environ 296 px de hauteur de
   fenêtre, la rangée montrée dépasse d'un quart et le nom, posé en bas de la
   pochette, tombe entièrement hors de la zone : il reste des aplats cliquables
   sans un mot, l'intitulé accessible tenant seul. Non corrigé, et assumé pour
   deux raisons : la décision ci-dessus porte sur *montrer la rangée*, pas sur
   *garder le nom*, et aucune fenêtre d'appareil réel n'y descend — un téléphone
   couché tient une rangée entière, nom compris. Écrit pour que la limite soit
   connue plutôt que découverte.

10. **Qui possède les 121 px du haut de l'accueil — la recherche, la phrase, ou
    le mur ?** — *Une seconde critique, postérieure au calage haut, relève deux
    choses à la fois. Le champ de recherche vide, 1 000 px de large, est l'objet
    le plus contrasté de l'écran alors qu'il n'est pas ce qu'on vient voir. Et le
    tri par défaut affirme « Gardés récemment » au-dessus de six artistes
    d'amorçage que personne n'a gardés — la chaîne de repli écrite pour ce cas
    exact n'a jamais eu d'appelant. Le calage haut, le carré, la grille centrée,
    le plafond, le plancher de 9 rem et l'absence de défilement ne sont pas
    rediscutés.*
    → **Le mur possède le haut.** Une bande unique de 64 px, sans phrase, puis un
    intertitre de 36 px qui **nomme ce qu'on regarde** — « Pour commencer » tant
    que rien n'est gardé, « Gardés récemment » ensuite — et que le tri termine.
    100 px au total, le plus petit des trois, et le seul qui ne grandisse pas sur
    téléphone.

    Deux raisons, dont la première suffirait. **C'est la seule des trois qui
    répare le libellé qui ment** : les deux autres laissent l'écran affirmer une
    garde qui n'a pas eu lieu, et entre trois arrangements de hiérarchie, celui
    qui supprime une fausse affirmation ne se compare pas aux autres. **Et c'est
    la seule dont le coût ne contredise pas une décision déjà prise** : la
    question 8 a écarté une variante parce qu'une phrase utile à la première
    visite et inerte aux suivantes ne mérite pas le premier rang ; la retenir ici
    en plus petit ferait dire à ce document le contraire de ce qu'il dit deux
    questions plus haut.

    *Coût assumé* — la promesse quitte le haut de l'accueil, et l'intertitre
    devra changer de mot le jour où F-28 et F-30 feront nourrir le mur par la
    collection. Le second n'est pas un coût : distinguer « rien de gardé » de
    « quelque chose de gardé » est de toute façon exigé par ces deux exigences.
    Le premier est réel, et il est **réduit plutôt qu'accepté** : la promesse
    devient le texte d'attente du champ de recherche, emprunté à la variante A
    ci-dessous. Elle ne coûte alors aucune hauteur, et l'accueil continue de dire
    ce qu'il fait à qui ne connaît pas le produit.

    *Écarté* — **la recherche possède le haut, mais à sa taille** (bande de
    64 px, champ ramené de 1 000 à 420 px, la promesse en texte d'attente) : elle
    règle bien le déséquilibre du champ, et c'est d'elle qu'est repris le texte
    d'attente. Mais elle s'arrête là — un texte d'attente **s'efface à la
    première lettre tapée**, il n'est donc pas un titre, et l'accueil n'explique
    plus rien de lui-même à qui commence à taper. Surtout, elle laisse le libellé
    du tri mentir. **La phrase possède le haut** (deux bandes conservées, 112 px,
    la promesse en 20 px pleine encre, première chose lue) : c'est la variante
    écartée de la question 8 en 20 px au lieu de 300, avec le même défaut — un
    texte utile une fois garde le premier rang pour toujours. C'est en outre la
    seule des trois qui **grandit** le haut sur téléphone, là où l'écran est le
    plus disputé, et elle laisse le libellé du tri mentir elle aussi.

   Cette décision est cohérente avec ce que le mur **est** : une sélection — « les
   artistes déjà gardés en priorité, sinon une sélection éditoriale d'amorçage »
   (§07) — et non l'inventaire de la collection, qui a son propre écran (F-25).
   Un mur qui montre les vingt premiers d'une collection de cinquante ne ment
   pas ; un mur qui en coupe trente en les laissant dans la page, si.

   *Écarté* — **rétrécir la tuile sous le plancher de 9 rem** pour tout faire
   tenir : le plancher existe parce qu'en deçà une pochette cesse d'être
   reconnaissable, et un mur de vignettes illisibles ne « donne pas envie »,
   ce qui est la seule chose que le §07 demande à cet écran. La contrainte se
   déplacerait sans disparaître, jusqu'à devenir absurde sur une grande
   collection. **Rouvrir le contrat et autoriser le défilement** : c'est la
   réponse la moins chère à écrire et la plus chère à porter — le §07 interdit le
   défilement sur l'accueil parce que le mur est un tableau qu'on embrasse d'un
   regard, pas une liste qu'on parcourt ; rendre l'accueil défilant en ferait un
   autre écran, décision qui excède de loin le défaut qu'elle corrigerait.

---

## 18 · Annexe — les questions qu'un PRD doit avoir tranchées

Ces quatre questions ne sont pas là par principe : chacune a coûté un défaut
livré ailleurs dans le dépôt. Elles trouvent leur réponse ici, avant la première
ligne de code.

**1 · Combien d'appareils ?** — Plusieurs par personne, et c'est ce qui décide de
tout le reste : un téléphone pour découvrir en marchant, un ordinateur pour
explorer le canevas au large. La collection et le choix du service d'écoute
doivent donc suivre la personne d'un appareil à l'autre (F-25, F-32), ce qu'un
stockage de navigateur ne fait pas : ils vivent côté serveur, partitionnés par
l'identité que l'authentification établit (N-08). Le nombre d'utilisateurs, lui,
ne change rien à cette décision.

**2 · Et si l'utilisateur ne peut pas terminer une étape ?** — RAMURE n'a pas de
parcours guidé en plusieurs étapes : la seule séquence est *planter → arbre*, et
elle n'a pas d'état intermédiaire à sauver. Ses quatre issues sont donc :
reprendre la saisie, accepter la correction proposée (F-03), revenir à l'accueil
qui réinitialise l'état (F-07), ou repartir d'un artiste gardé (F-31). Aucune ne
laisse de brouillon derrière elle, et c'est délibéré : une exploration est un
moment, pas un formulaire.

**3 · Comment quitte-t-on un compte sans l'effacer ?** — L'identité vient de
l'authentification placée devant l'application : se déconnecter est un geste du
navigateur, pas une commande du produit. La symétrie qui doit exister côté
produit est celle de la **donnée** : ce que le serveur conserve d'une personne se
limite à sa collection et à son service d'écoute, chaque artiste gardé se retire
d'un geste (F-28), et l'export de la collection (F-35, lot V2) est ce qui rendra
le départ non destructif. Tant qu'il n'est pas livré, partir signifie retirer ses
artistes un par un — c'est écrit ici pour que personne ne croie l'inverse.

**4 · L'unité de l'original survit-elle à la transposition ?** — L'original n'est
pas une feuille de papier mais un catalogue, et son unité est l'**artiste** —
jamais une date, jamais une session. Le produit ne date donc rien de ce qu'il
affiche. Une seule exception, assumée : l'artiste gardé porte la date de sa
découverte et la lignée qui y a mené (F-29), parce que c'est le contexte, pas le
contenu, qui se perd le premier.

---

## 19 · RAMURE v2 — ce qu'elle change, et le retrait de la première version

Une première version de RAMURE est en ligne. Elle couvre les lots MVP et V1, plus
le palmarès et la reprise de lignée du lot V2, et sert d'étalon : ce document
décrit la seconde, qui la **remplace**.

**Ce que la v2 change**, et qui justifie une réécriture plutôt qu'une correction :

- **le palier d'exposition** — la v1 n'est accessible qu'aux comptes de la liste
  blanche du serveur ; la v2 s'ouvre à tout compte Google, ce qui rend le partage
  (F-34) réalisable et le cloisonnement par visiteur (N-08) obligatoire ;
- **la collection qui survit au redéploiement** (F-32, F-33), portée par un
  espace de stockage nommé et par une identité établie côté serveur ;
- **la source de proximité et son repli** — deux fournisseurs pour le rôle 1
  plutôt qu'un, ce qui retire au produit son point de rupture unique (§14) ;
- **la part équitable du quota entre visiteurs** (N-14), qui n'avait pas lieu
  d'être tant qu'une liste blanche gardait la porte.

**Le retrait de la v1 est la dernière tâche de la mise en ligne de la v2**, pas
une intention. Tant que les deux vivent, elles partagent ce document mot pour
mot : la première correction portée sur l'un des deux exemplaires fait mentir
l'autre en silence, sans qu'aucun contrôle ne le voie. Le retrait est ce qui rend
au PRD son domicile unique.

---

*RAMURE · Product Requirements Document · version 1.1 · 19 août 2026*

# Product — estran

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Go — confirmé par l'utilisateur, aligné sur le reste de la fabrique (`cadran`,
`ramure`, `pilabelle`, `marcq-handball`) : bibliothèque standard, binaire
unique, page HTML embarquée par `go:embed`.

## Users

Un unique utilisateur : l'exploitant du serveur `billbob.ovh`, palier
`private` — seuls les comptes de sa liste blanche entrent. Situation type :
avant de descendre à la plage du Touquet-Paris-Plage / Étaples, vérifier en
une consultation s'il va pleuvoir, s'il fait soleil, quelle température il
fait, et surtout où on en est de la marée — montante ou descendante, et
combien de temps avant la prochaine bascule.

Il n'y a pas d'utilisateur anonyme : Traefik authentifie avant que la requête
n'atteigne l'application.

## Product Purpose

Donner, en un coup d'œil, la météo marine du secteur d'Étaples–Le Touquet :
une prévision à 5 heures (pluie, soleil, température, vent, état de la mer),
une jauge de marée qui montre la position actuelle entre basse mer et pleine
mer et l'heure de la prochaine bascule, et une tendance à 7 jours pour
anticiper la semaine.

Le succès se mesure à l'usage : avant de partir à la plage, une réponse en une
seule consultation, sans recouper un site de météo générale et un site de
marée séparés.

## Positioning

Ce n'est pas une application météo généraliste de plus. Celles-ci noient
l'information utile à la plage — marée, état de mer — dans des données qui ne
servent à rien ici, et aucune ne combine prévision horaire et jauge de marée
sur un seul écran pour un seul secteur. `estran` fait le pari inverse : un
seul lieu, délibérément restreint, et une jauge de marée qui n'existe dans
aucune application météo grand public — elle porte la moitié de la promesse
du produit. L'autre moitié est la prévision courte à 5 heures, celle qu'on
regarde vraiment avant de sortir ; la tendance à 7 jours ne sert qu'à
anticiper la semaine, jamais au même niveau de détail.

## Operating Context

- Le lieu d'ouverture est Étaples–Le Touquet, le secteur du bulletin marine de
  référence consulté par l'utilisateur. Il n'est plus le seul depuis le
  21 août 2026 : voir « Le lieu se choisit » plus bas. Il reste le défaut, et
  l'écran s'ouvre dessus sans qu'on ait rien à choisir.
- Fuseau `Europe/Paris`.
- Consultation aussi bien depuis un téléphone, au moment de partir, que
  depuis un poste.
- Rythme de rafraîchissement des données à fixer à l'implémentation —
  probablement horaire, aligné sur celui des fournisseurs. Rien n'exige un
  flux temps réel.

## Capabilities and Constraints

Fonctions confirmées :

- **Prévision à 5 heures** — pour chaque heure : probabilité de pluie,
  ensoleillement (nébulosité), température, vent (force et direction), état
  de la mer (hauteur de vagues / houle). Un sous-ensemble de ce qu'affiche le
  bulletin marine de référence, restreint à ce qui compte avant d'aller à la
  plage.
- **Jauge de marée** — représentation visuelle de la hauteur d'eau entre
  basse mer et pleine mer, la position actuelle sur cette jauge, l'heure de
  la prochaine bascule (prochaine pleine mer ou basse mer) et un repère clair
  du temps restant avant elle.
- **Tendance à 7 jours** — vue résumée jour par jour (température, risque de
  pluie, grandes lignes), sans le détail horaire de la prévision à 5 heures ;
  pour chaque jour couvert par le fournisseur de marée, la plus haute pleine
  mer et la plus basse basse mer du jour, avec le coefficient — demandé
  explicitement après la première mise en ligne.

Sources de données, arbitrées après recherche (détail dans *Evidence on
Hand*) :

- Météo horaire (pluie, nébulosité, température, vent) : **Open-Meteo** — API
  publique, gratuite, sans clé.
- État de la mer (hauteur de vagues, houle) : **Open-Meteo Marine** — même
  fournisseur, sans clé, couvre la Manche et la façade française à 5 km de
  résolution.
- Marée (heures et hauteurs de pleine/basse mer) : **api-maree.fr** —
  prédictions dérivées du SHOM, gratuites, clé simple par inscription (pas
  d'abonnement payant), quota largement suffisant pour un seul point consulté
  ponctuellement. Le point le plus proche disponible dans leur catalogue
  n'est ni Étaples ni Le Touquet (absents), mais **Berck-Plage/Fort-Mahon**
  (~20 km au sud, même façade ouverte) : une approximation assumée,
  documentée ci-dessous plutôt que présentée comme une précision qu'on ne
  tient pas. La clé (`API_MAREE_KEY`) se déclare en `env:` dans `app.yml` et
  dans le `README`, jamais en valeur littérale dans le dépôt — l'obtenir
  revient à l'exploitant, comme tout secret de la fabrique. Tant qu'elle est
  absente, la jauge de marée affiche « configuration requise » plutôt qu'une
  valeur inventée.

Contraintes techniques :

- Go, bibliothèque standard en priorité, une page unique embarquée
  (`go:embed`), cohérent avec le reste de la fabrique.
- `exposure: private` — pas de système de comptes, l'authentification reste
  celle de Traefik.
- Image finale sous 200 Mo, utilisateur non root, aucun port publié, aucun
  secret en clair.
- L'application démarre sans intervention même si un fournisseur de données
  est temporairement indisponible : elle affiche alors la dernière donnée
  connue plutôt qu'un écran cassé.

Décision écartée à la conception, **rouverte et renversée le 21 août 2026** :
couvrir plusieurs plages ou ports. L'argument d'origine — un seul secteur rend
l'écran plus rapide à lire qu'une application météo générale — tenait sur la
lecture, pas sur le nombre de lieux : c'est de ne rien demander à l'ouverture
que vient la rapidité, et le défaut la conserve. Voir « Le lieu se choisit ».

## Brand Commitments

- Nom : `estran`, celui de son répertoire sous `apps/`. Domaine :
  `estran.apps.billbob.ovh`.
- Interface, commentaires et documentation en français.
- Design soigné, pratique, agréable à utiliser — l'identité visuelle précise
  (palette, typographie, composants) se construit avec `impeccable` au moment
  de la conception de l'interface, pas dans ce document.
- Pas de système de comptes.

## Evidence on Hand

- Le bulletin de référence (`marine.meteoconsult.fr`, port 285,
  Étaples–Le Touquet) montre la forme attendue : vent (direction, force,
  rafales), vagues et houle, pluie, nébulosité, température (air et
  ressentie), et des marées présentées en heure + hauteur + coefficient.
- Recherché et confirmé le 9 août 2026, par appel réel aux API : Open-Meteo
  (météo horaire) et Open-Meteo Marine (état de mer) répondent sans clé sur
  les coordonnées du Touquet-Paris-Plage (`50.517, 1.583`) ; le SHOM n'ouvre
  son API de marée qu'à un abonnement payant ; api-maree.fr couvre la façade
  Manche/Nord-Pas-de-Calais gratuitement mais pas Étaples/Le Touquet
  spécifiquement — `berck-plage-fort-mahon` est le point le plus proche de
  son catalogue. Détail de l'arbitrage : `apps/estran/prp/00-ossature.md`.

Ce qui n'existe pas et ne doit pas être inventé : compte utilisateur,
historique personnel, alertes ou notifications, plusieurs lieux, données de
qualité de l'eau ou de baignade, une précision de marée à l'endroit exact
d'Étaples/Le Touquet — rien de tout cela n'a été demandé, et le dernier point
est une limite connue plutôt qu'un objectif non atteint.

## Product Principles

1. **Rien à choisir pour lire l'écran** — il s'ouvre sur un lieu, tout de
   suite lisible. Choisir en est un geste distinct, jamais un préalable.
   *(Formulé « un seul lieu, pas de recherche » jusqu'au 21 août 2026 ; ce qui
   comptait était l'absence de préalable, pas l'unicité du lieu.)*
2. **La jauge de marée est aussi centrale que la météo** — c'est elle qui
   distingue `estran` d'une application météo généraliste, jamais un ajout
   secondaire.
3. **Dégrader, jamais casser** — une source de données indisponible affiche
   la dernière valeur connue, jamais un écran vide.
4. **Prévision courte avant tendance longue** — les 5 heures sont ce qu'on
   consulte avant de sortir ; les 7 jours ne servent qu'à anticiper, jamais au
   même niveau de détail.

## Ajouté après les PRP

### Naviguer d'un jour à l'autre — 16 août 2026

**Ce qui existe maintenant** : le jour regardé se choisit. Deux flèches
reculent et avancent d'un jour, jusqu'à sept de chaque côté, et un retour à
aujourd'hui ramène à l'écran d'ouverture. Sur un jour qui n'est pas
aujourd'hui, la section marée montre les pleines et basses mers de ce jour —
heure, hauteur, coefficient — au lieu d'une jauge qui n'aurait pas de sens, et
la section horaire montre les vingt-quatre heures du jour au lieu des cinq
prochaines. Les lignes de la tendance à 7 jours mènent directement au jour
qu'elles décrivent. Conception détaillée : `prp/01-navigation-temporelle.md`.

**Ce qui l'a demandé** : l'usage, après la première mise en ligne — puis une
demande explicite le 16 août 2026, deux tentatives antérieures ayant été
abandonnées avant d'atteindre le dépôt.

**Ce que le PRD affirmait avant** : il décrivait un écran figé sur l'instant
présent — « une prévision à 5 heures », « la position actuelle », « une
tendance à 7 jours » — sans jamais écarter de regarder un autre jour : c'était
absent, pas refusé.

**Ce que cela ne rouvre pas** : l'exclusion de l'**historique personnel** tient
toujours, et reste écrite. Ce qui était refusé, c'est de garder trace de ce que
l'utilisateur a consulté ou fait ; ce qui est livré lit la même donnée publique
à une autre date, ne conserve rien, et le jour choisi ne survit même pas au
rechargement de la page. Le PRD en délimite le bord, il ne lève rien.

### Le ciel se décrit par ce qu'on voit, pas par la nébulosité totale — 16 août 2026

**Ce qui existe maintenant** : la description du ciel — soleil, soleil voilé,
partiellement nuageux, couvert — se calcule à partir des trois couches
nuageuses séparées, pondérées par ce que chacune masque réellement du soleil :
les nuages bas le bouchent, les nuages moyens l'atténuent, les cirrus hauts ne
font que le voiler. Un phénomène — brouillard, pluie, neige, orage — l'emporte
toujours sur cette description, et reste lu du code météo comme avant. La
tendance à 7 jours applique la même règle, agrégée sur les heures de jour, pour
qu'une ligne journalière ne contredise jamais la ligne horaire du même jour.

**Ce qui l'a demandé** : l'usage, le 16 août 2026 vers 18 h. L'application
annonçait « couvert » pour les trois heures suivantes sous un plein soleil, quand
le bulletin marine de référence montrait un soleil franc. L'utilisateur a tranché :
c'est le bulletin marine qui fait foi.

**Ce que le PRD affirmait avant** : il listait « ensoleillement (nébulosité) »
parmi les données de la prévision horaire, sans dire *laquelle* des nébulosités —
et l'implémentation avait pris la seule que le fournisseur résume en un chiffre,
la nébulosité totale, toutes couches confondues. Un voile de cirrus à 100 %
suffisait alors à afficher « couvert » alors que l'heure entière était
ensoleillée.

**Ce que cela ne change pas** : la source reste Open-Meteo, et elle n'était pas
en cause — les six modèles comparés donnaient la même chose, et leur prévision
était juste. Ce qui était faux, c'était de traduire un chiffre global en une
phrase que quelqu'un lit debout sur la plage. Aucun modèle n'est privilégié,
aucune clé n'apparaît, et la règle « dégrader, jamais casser » tient : quand les
couches manquent, l'ancienne description reprend la main.

### La journée entière, seize jours, la confiance et le vent — 18 août 2026

**Ce qui existe maintenant** : quatre choses, demandées ensemble et livrées
ensemble.

- La journée en cours n'est plus coupée à cinq heures : la bande horaire va de
  l'heure courante à la fin de la journée, et ne descend jamais sous cinq
  vignettes — le soir, elle déborde sur le lendemain comme avant.
- La tendance couvre **seize jours** au lieu de sept, et la navigation va
  jusqu'au dernier d'entre eux. Le passé reste à sept jours en arrière. Le
  seizième jour n'apparaît que si le fournisseur le donne vraiment : au bord de
  sa fenêtre il ne donne plus rien, et une ligne manquante vaut mieux qu'une
  ligne à zéro.
- Chaque jour de la tendance porte un **indice de confiance**, calculé en
  comparant ce que six modèles météo prévoient pour ce jour : quand ils
  s'accordent la confiance est haute, quand ils divergent elle baisse, et
  quand trop peu d'entre eux portent aussi loin elle se déclare inconnue
  plutôt que d'être devinée.
- Chaque jour porte aussi le **vent** : force maximale, rafale maximale,
  direction dominante.

**Ce qui l'a demandé** : l'usage, le 18 août 2026. D'abord l'impossibilité de
voir la fin de l'après-midi sans passer par demain puis revenir, puis, dans le
même échange, la demande d'aller au-delà de sept jours, avec un indice de
confiance et le vent.

**Ce que le PRD affirmait avant** : « une prévision à 5 heures » et « une
tendance à 7 jours », deux chiffres écrits comme des propriétés du produit
alors qu'ils n'étaient que la première portée choisie. Le principe qu'ils
servaient — prévision courte avant tendance longue — n'est pas touché :
l'écran d'ouverture montre toujours d'abord la marée et les heures qui
viennent, et la tendance reste résumée, sans détail horaire.

**Ce que cela ne change pas** : le lieu reste unique, il n'y a toujours ni
compte ni préférence conservée, et l'indice de confiance ne s'affiche que sur
les jours — les prochaines heures n'en portent pas, pour que l'écran
d'ouverture reste lisible d'un coup d'œil. Conception détaillée :
`prp/02-horizon-confiance-vent.md`.

### Un graphe de pluie, à deux échelles de temps — 19 août 2026

**Ce qui existe maintenant** : une section **Pluie**, entre la marée et les
prochaines heures, qui répond à la seule question qu'on se pose vraiment avant
de sortir. Elle porte deux choses.

- **L'heure qui vient**, aujourd'hui seulement : une bande de soixante minutes
  découpée par pas de cinq puis dix minutes, qui dit *temps sec*, *pluie
  faible*, *modérée* ou *forte*, et une phrase qui donne l'échéance — « pluie
  faible vers 15:20 », « temps sec pour l'heure qui vient ». Elle vient de la
  prévision immédiate de Météo-France, qui porte sur **Le Touquet-Paris-Plage**
  nommément, et non sur un point de grille voisin.
- **La journée entière**, de minuit à minuit, qui suit les flèches de
  navigation comme le reste de l'écran : une courbe, le cumul du jour, un
  repère de l'heure courante. Au pas du **quart d'heure** quand un modèle à
  maille fine couvre ce jour — les jours passés, aujourd'hui, demain —, au pas
  de **l'heure** ensuite, et l'écran dit lequel des deux.

**Ce qui l'a demandé** : l'usage, le 19 août 2026 — « un graphe de pluie le
plus précis possible, par 10 minutes si possible ».

**Ce que le PRD affirmait avant** : il listait « probabilité de pluie » parmi
les grandeurs horaires, et rien d'autre. Une probabilité par heure ne dit ni
combien il tombe, ni quand l'averse commence — deux choses qu'on veut savoir
debout sur le pas de la porte, et que l'écran ne donnait nulle part. C'était
absent, pas refusé.

**Ce que cela ne change pas** : le lieu reste unique, il n'y a toujours ni
compte ni préférence conservée, et le principe 4 tient — la section montre le
court avant le long, et la tendance à seize jours n'y gagne aucun détail. Le
principe 3 non plus n'est pas entamé : la bande de l'heure vient d'une source
sans garantie, et sa panne fait simplement disparaître la bande, jamais la
courbe. Conception détaillée : `prp/03-graphe-de-pluie.md`.

### Les vignettes horaires disent des millimètres, pas un pourcentage — 20 août 2026

**Ce qui existe maintenant** : la ligne de pluie d'une vignette horaire porte la
**lame d'eau attendue pendant cette heure**, en millimètres, tirée de la même
série que la courbe de la section pluie. Additionner les vignettes d'un jour
redonne le cumul affiché sous la courbe. Une heure vraiment sèche affiche
« 0 mm », une bruine que le dixième arrondirait à zéro affiche « < 0,1 mm », et
une heure que la source ne couvre pas n'affiche pas de ligne du tout. Le risque
d'averse ne s'affiche plus en pourcentage sur la vignette : au-delà de 60 %, une
pastille « averse possible » s'allume. Dans la tendance à seize jours, où aucun
modèle à maille fine ne porte aussi loin, le pourcentage reste — mais il est
désormais précédé du mot « risque ».

**Ce qui l'a demandé** : l'usage, le 20 août 2026. « Il n'y a pas de pluie dans
les quantités mais sur les prochaines heures oui. Qui a raison ? » Contrôle fait
sur les trois sources : la courbe annonçait 0 mm pour tout l'après-midi, la
prévision immédiate de Météo-France « temps sec », et les vignettes 98 %, 100 %,
98 % sur les mêmes heures. Aucune ne se trompait.

**Ce que le PRD affirmait avant** : il listait « probabilité de pluie » parmi les
grandeurs horaires, et la section pluie du 19 août lui a ajouté une lame d'eau
sans retirer la probabilité de la vignette. Les deux grandeurs se sont retrouvées
côte à côte sur le même écran, toutes deux rendues par une goutte, et rien ne
disait laquelle était quoi. Un pourcentage de probabilité d'ensemble monte à
100 % un jour d'averses éparses sans qu'une goutte soit prévue au point regardé :
le chiffre était juste, sa lecture impossible.

**Ce qui a été écarté**, montré en maquettes et tranché par l'utilisateur : garder
le pourcentage en lui ajoutant le mot « risque » — le plus petit changement, mais
les deux sections auraient continué de parler deux langues, l'une en millimètres
et l'autre en pourcentages ; et afficher les deux l'un sous l'autre, la quantité
en grand et le risque en petit — rien n'était perdu, mais la vignette montait à
quatre lignes de chiffres.

**Ce que cela ne change pas** : les deux sections gardent des routes, des caches
et des modes de panne séparés — la série de pluie est demandée en parallèle de la
météo et bornée plus court qu'elle, si bien qu'une source lente ou tombée retire
la ligne de pluie des vignettes sans jamais retarder ni vider l'écran. Le
principe 3 tient donc, et le principe « aucune valeur inventée » aussi : une heure
sans donnée n'affiche pas « 0 mm ».

### Le radar et le modèle ne disent pas la même chose, et l'écran le dit — 20 août 2026

**Ce qui existe maintenant** : les deux graphes de la section Pluie annoncent
leur nature sous leur titre — « **Vu au radar**, il y a dix minutes » pour la
bande de l'heure qui vient, « **Prévu par un modèle**, plusieurs heures à
l'avance » pour la courbe du jour. Et les jours où le radar annonce une averse
sur un créneau où la courbe ne dessine aucune barre, une phrase tranche sous
celle-ci : « le radar voit une averse que ce modèle n'a pas prévue ; pour
l'heure qui vient, fiez-vous au graphe du dessus ». Elle ne paraît que ces
jours-là, y compris — surtout — quand la courbe annonce « aucune pluie prévue
aujourd'hui ».

**Ce qui l'a demandé** : l'usage, le 20 août 2026 à 13 h 39. La bande annonçait
une averse à 13 h 50, la courbe du jour ne montrait rien à cette heure-là.
Contrôle fait : le radar avait raison, et aucun modèle n'avait vu l'averse
(0 mm entre 13 h et 15 h sur les deux modèles interrogés).

**Ce que le PRD affirmait avant** : la section Pluie était décrite comme deux
échelles de temps d'une même chose — l'heure qui vient, puis la journée — et le
document d'implémentation leur avait délibérément donné une **grammaire
commune** : mêmes cinq bandes, même vocabulaire, l'une sous l'autre. C'était le
bon choix pour qu'on les compare d'un coup d'œil, et c'est précisément ce qui
promettait qu'elles s'accordent. Elles ne le peuvent pas : l'une observe ce qui
arrive, l'autre restitue un calcul lancé des heures plus tôt, qui ne sait pas
placer une averse de dix minutes au bon quart d'heure.

**Ce qui a été écarté**, montré en maquettes et tranché par l'utilisateur : que
la courbe du jour laisse de côté les soixante prochaines minutes et renvoie au
graphe du dessus — deux graphes ne pourraient alors plus se contredire, mais la
courbe porterait un trou tous les jours, y compris quand les deux sources sont
d'accord ; et que le radar prenne la main sur cette heure-là, remplaçant les
barres du modèle par les siennes — l'averse apparaîtrait là où on la cherche,
mais une heure de la courbe cesserait de se compter en millimètres.

**Ce que cela ne change pas** : aucun graphe n'est retouché, aucune donnée n'est
inventée ni recopiée d'une source à l'autre. Le radar ne rend pas de
millimètres et n'en rendra pas ; la courbe garde son cumul, calculé par le seul
modèle. Les deux sections gardent leurs pannes séparées : sans bande de l'heure,
il n'y a rien à trancher et la phrase se tait d'elle-même.

### Deux décisions d'écran, tranchées sur maquettes — 20 août 2026

Rendues par la première critique UX outillée de l'app, sur trois variantes
chacune. L'utilisateur a tranché ; ce qui est écarté est écrit ici avec sa
raison, sans quoi il reviendra tel quel dans deux mois.

**Où vit le choix du jour — retenu : le bandeau de jours.** Une rangée de jours
en haut de l'écran, sur laquelle on saute directement à celui qu'on veut.

Ce qui l'a emporté n'est pas l'esthétique mais un défaut nommé : le choix du
jour *flottait* entre les deux colonnes sans appartenir à aucune, et sur un jour
autre qu'aujourd'hui la même date se lisait **trois fois en moins de 500 px**.
Le bandeau lui donne une place et supprime les répétitions.

*Écarté — le jour dans l'en-tête*, à côté de l'horloge. Plus discret, et rendu à
sa place logique. Écarté parce que moins repérable : sur un écran qu'on ouvre
pour savoir « et demain ? », le geste principal ne doit pas être le plus petit.

*Écarté — aucun contrôle en haut*, la tendance à seize jours servant seule à
changer de jour. C'est l'écran d'ouverture le plus calme des trois, et
l'argument était sérieux. Écarté parce qu'il rend la navigation implicite : rien
ne dit qu'on peut changer de jour, et ce qui ne se voit pas ne s'utilise pas.

**Ce qu'on voit quand une source ne répond pas — retenu : le même gabarit
partout.** Les quatre sections disent leur indisponibilité exactement de la même
façon.

Le défaut corrigé est là aussi précis : le même écran portait **quatre
présentations différentes pour une seule situation**, dont une section sans
carte du tout. Une panne partielle est un état *ordinaire* de cette app — le
README le promet, « une section seule affiche son indisponibilité » — donc elle
mérite une forme, pas quatre improvisations.

*Écarté — un constat en tête d'écran*, une phrase disant ce qui ne répond pas et
que l'app réessaie, les sections restant sobres en dessous. C'était la variante
la plus informative, et elle répondait le mieux à « est-ce cassé ou partiel ? ».
Écartée pour son coût de tenue : une bannière globale doit rester juste à mesure
que les sources changent, et elle ment le jour où elle ne suit plus.

*Écarté — la dernière valeur connue*, hachurée et datée, plutôt que du vide.
Séduisant : on voit quelque chose. Écarté parce qu'un chiffre périmé sur un
écran de marée et de météo est pire que pas de chiffre — c'est exactement le
genre de donnée sur laquelle on décide d'aller à l'eau.

**Ce que ces deux décisions engagent** : une seule forme d'indisponibilité dans
toute l'app, et le choix du jour est un contrôle visible, jamais déduit d'un
autre élément.

### Deux décisions d'écran de plus, tranchées le 21 août 2026

Rendues par la critique UX du résultat construit — celle du 20 août avait montré
des variantes sans jamais voir ce qui en sortirait. Les deux portent sur ce que
le bandeau de jours a laissé derrière lui.

**Où s'écrit la date du jour regardé — retenu : une seule fois, dans le titre de
la section horaire.** La carte de marée perd la sienne.

Le bandeau devait supprimer la répétition de la date ; il en a supprimé **une
sur trois**. Mesuré à 1440 px sur le dimanche 23 : « Dimanche 23 août » sur la
carte de marée et « DIMANCHE 23 AOÛT » en titre de section, **au même y**. Elles
ne sont plus l'une sous l'autre, elles sont côte à côte sur la même ligne des
yeux — donc plus visibles qu'avant le bandeau, pas moins. Plus la pastille
« DIM 23 » au-dessus, ce qui fait trois.

Ce qui a fait le choix : celui qui ouvre l'app vient d'abord voir les heures.
Laisser la date là où son regard se pose déjà lui évite un déplacement.

*Écarté — une seule date sous le bandeau*, avec les deux titres de rubrique
redevenus stables. Défendable, et plus régulier : un seul endroit où lire où
l'on se trouve. Écarté parce qu'il éloigne la date de la section qu'on lit en
premier, et qu'il ajoute une ligne au-dessus du contenu sur un écran de
téléphone déjà court.

*Écarté — les deux dates restent* (le témoin). Écarté : la répétition était le
défaut nommé qui a motivé le bandeau, la garder viderait la décision du 20 août
de son effet.

**Ce qu'on voit quand le fournisseur ne couvre pas le jour demandé — retenu : le
texte nu, tel quel.** « Aucune prévision pour ce jour » reste une phrase grise
sans cadre.

C'est le témoin, et c'est délibéré. La critique a raison de relever que c'est une
**cinquième forme d'absence** sur un écran qui vient d'en unifier quatre. Mais
l'absence de cadre porte ici une information juste : ce n'est pas une panne,
c'est un vide légitime, et rien n'est cassé. Les quatre cartes disent « la source
ne répond pas » ; cette phrase dit « il n'y a rien à montrer ». Les confondre
sous un même gabarit ferait croire à une panne là où il n'y en a pas.

*Écarté — la même carte que l'indisponibilité*, avec une phrase distinguant la
cause. Le plus régulier des trois. Écarté parce qu'il fait porter à la forme une
distinction que seule la phrase tiendrait : le jour où quelqu'un abrège le texte,
un vide légitime devient une panne à l'œil.

*Écarté — griser dans le bandeau les jours que le fournisseur ne couvre pas.*
C'était la variante la plus riche : elle montrait d'avance où s'arrête la fenêtre
des prévisions, une question restée ouverte depuis le 20 août — la navigation va
plus loin qu'elle. Écarté ici parce qu'elle déplace le sujet du vide vers la
navigation, et qu'elle demande au bandeau de connaître les limites de chaque
source. **À reprendre séparément** : la question « jusqu'où vont les prévisions »
reste entière, et elle ne se règle pas dans une carte vide.

**Ce que ces décisions engagent** : une absence *légitime* et une *panne* ne se
présentent pas de la même façon, et cette différence est portée par la forme,
pas seulement par les mots.

### Le lieu se choisit, et l'écran dit ce qu'il sait de lui — 21 août 2026

**Ce qui existe maintenant** : le nom du secteur, sous le titre, ouvre un écran
de choix. On y cherche une commune française par son nom, ou on laisse
l'appareil donner sa position. Chaque lieu proposé y porte **trois lignes** qui
disent d'avance ce qu'on y trouvera — marée, état de la mer, pluie à la minute —
présentes ou absentes, et pourquoi.

Trois conséquences sur le reste de l'écran :

- **La marée n'est plus figée sur Berck.** Le site de référence est désormais le
  plus proche du lieu regardé, choisi dans le catalogue du fournisseur, et sa
  distance s'affiche toujours — c'est elle qui permet de juger l'approximation.
- **Sur un lieu de littoral, rien ne change** : l'état de la mer est demandé et
  affiché comme au Touquet. C'est la clause centrale de la demande — sur la
  plage, la météo marine est la seule fiable — et aucune section ne la retire.
- **Sur un lieu de l'intérieur**, la carte de marée cède la place à une phrase
  encadrée de pointillés qui dit à quelle distance est la côte, et la houle
  disparaît des vignettes horaires. Ce n'est pas une panne, et la décision du
  21 août 2026 sur la forme des absences s'applique telle quelle.

**Ce qui l'a demandé** : l'usage, le 21 août 2026, depuis la plage du
Touquet-Paris-Plage — « il faut bien pouvoir choisir les zones de littoral, qui
sont différentes des zones intérieures ; il est donc indispensable que la météo
marine soit utilisée ».

**Ce que le PRD affirmait avant** : « le lieu est fixe », « pas de recherche,
pas de menu de villes », et une décision écartée explicite — « couvrir plusieurs
plages ou ports ». C'est le premier renversement d'une décision *écartée* de ce
document, et non le comblement d'un silence. L'argument d'origine reste juste sur
son objet : ce qui rend `estran` plus rapide à lire qu'une application météo
générale, c'est qu'elle ne demande rien avant d'afficher. Le défaut conserve
cette propriété entière ; c'est l'unicité du lieu qui n'en était que le moyen le
plus simple. Le principe 1 est reformulé en conséquence, dans le même commit.

**Ce qui a été écarté**, montré en trois maquettes et tranché par l'utilisateur :

*Écarté — la recherche dans l'en-tête*, un champ qui s'ouvre sous le nom du lieu.
La plus économe : rien n'est ajouté à l'écran d'ouverture, et le geste se devine.
Écartée parce qu'elle ne dit jamais ce qu'on va perdre — on choisit un lieu de
l'intérieur, et on découvre l'absence de marée en voyant un trou.

*Écarté — un bandeau de lieux* au-dessus du bandeau de jours, sur le modèle exact
du choix du jour. La plus rapide à l'usage, et la plus régulière : une grammaire
pour le jour et le lieu, pas deux. Écartée pour une rangée de plus en haut d'un
écran de téléphone déjà court, au-dessus de la marée qu'on vient voir en premier,
et pour la même cécité sur les capacités du lieu. **À rouvrir si l'usage montre
qu'on alterne vraiment entre deux ou trois lieux.**

**Ce que la variante retenue coûte, et qui est assumé** : changer de lieu demande
deux gestes et un écran entier, à chaque fois, alors que l'annonce des capacités
ne sert vraiment que la première visite d'un lieu.

**Ce que cela ne change pas** : toujours aucun compte, et rien envoyé nulle part
— les lieux vus restent dans le navigateur de l'appareil, le lieu regardé vit
dans l'adresse et non dans un stockage. L'exclusion de l'**historique personnel**
tient : cette liste ne dit ni ce qui a été consulté ni quand. Et le principe 3 —
dégrader, jamais casser — reçoit ici une règle plus stricte que d'ordinaire :
**une capacité qu'on ne sait pas évaluer ne s'affiche jamais comme absente.** Une
plage déclarée « intérieur » par une panne réseau serait exactement la valeur
inventée que ce document interdit partout.

**Une limite écrite plutôt que masquée** : la recherche ne couvre que les
communes françaises, et la Méditerranée comme la Corse n'ont **pas de marée**
disponible — aucun fournisseur gratuit ne la donne, et son marnage la rend
accessoire. Un lieu peut donc être de littoral sans avoir de marée : c'est un
troisième cas, dit comme un fait. L'état de la mer, lui, y est servi normalement.
Conception détaillée : `prp/04-le-lieu-devient-une-donnee.md` et
`prp/05-ecran-de-choix.md`.

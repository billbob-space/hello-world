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

- Le lieu est fixe : Étaples–Le Touquet, le secteur du bulletin marine de
  référence consulté par l'utilisateur. Pas de recherche, pas de changement
  de ville.
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

Décision écartée : couvrir plusieurs plages ou ports. L'application n'a qu'un
secteur, et c'est voulu — c'est ce qui la rend plus rapide à lire qu'une
application météo générale.

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

1. **Un seul lieu, tout de suite lisible** — pas de recherche, pas de menu de
   villes.
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

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
  pluie, grandes lignes), sans le détail horaire de la prévision à 5 heures.

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

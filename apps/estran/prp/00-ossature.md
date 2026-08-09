# 00 — Ossature technique de `estran`

Dérivé de `PRODUCT.md`. Ce document fige les décisions techniques prises à
l'implémentation, en particulier celles que le PRD laissait explicitement
ouvertes.

## Lieu

Coordonnées retenues pour la météo et l'état de mer : `50.517, 1.583`
(Le Touquet-Paris-Plage, calculées depuis les coordonnées publiées du port de
référence — 50°31,02' N / 1°34,98' E). Fixes, non configurables : le PRD
exclut explicitement plusieurs lieux.

## Sources de données — arbitrage

### Météo horaire et journalière — Open-Meteo

`https://api.open-meteo.com/v1/forecast`, sans clé. Vérifié en direct le
2026-08-09 (requête réelle, réponse JSON valide) :

- `hourly` : `temperature_2m`, `precipitation_probability`, `cloud_cover`,
  `wind_speed_10m`, `wind_direction_10m`, `weather_code`
- `daily` : `temperature_2m_max`, `temperature_2m_min`,
  `precipitation_probability_max`, `weather_code`
- `timezone=Europe/Paris`, `forecast_days=7`

### État de mer — Open-Meteo Marine

`https://marine-api.open-meteo.com/v1/marine`, sans clé. Vérifié en direct le
2026-08-09 (couverture confirmée sur ce point de la Manche) :

- `hourly` : `wave_height`, `wave_direction`, `wave_period`

### Marée — api-maree.fr, décision tranchée à l'implémentation

Le PRD notait cette source comme non arbitrée : aucune API de marée
française n'est ouverte sans clé, le SHOM réservant la sienne à un
abonnement payant. Recherche complémentaire à l'implémentation :
**api-maree.fr** publie les prédictions de marée (dérivées SHOM) en JSON,
gratuitement, avec une clé simple obtenue par inscription sur leur site —
pas d'abonnement payant, quota 360 req/h largement suffisant pour une seule
app à un seul point.

**Le site exact n'existe pas dans leur liste** — vérifié via `/sites` :
« Le Touquet » et « Étaples » n'y figurent pas. Le point le plus proche
disponible est `berck-plage-fort-mahon` (50.349, 1.516), à ~20 km au sud sur
la même façade ouverte (baie de Canche/Authie), plus proche et plus
comparable que `boulogne-sur-mer` (50.735, 1.581, ~24 km, port abrité au nord
des falaises du Cap Gris-Nez). C'est une **approximation assumée** : les
heures de pleine/basse mer peuvent différer de quelques dizaines de minutes
et les hauteurs de quelques décimètres par rapport au vrai point d'Étaples–Le
Touquet. `PRODUCT.md` (Evidence on Hand) et le `README` le disent
explicitement — aucune précision non tenue n'est affichée.

Endpoints (`https://api-maree.fr`) :

- `GET /tide-extrema?site=berck-plage-fort-mahon&from=...&to=...&tz=Europe/Paris&key=...`
  → pleines/basses mers, heure, hauteur, coefficient.
- `GET /water-levels?site=berck-plage-fort-mahon&from=...&to=...&step=15&tz=Europe/Paris&key=...`
  → hauteur d'eau par pas de temps, pour dessiner la jauge en continu.

**La clé (`API_MAREE_KEY`) n'est pas obtenue par cette session.** Comme tout
secret de la fabrique, seul son NOM est déclaré (`env:` dans `app.yml`),
jamais sa valeur : l'obtenir (inscription gratuite sur api-maree.fr) et la
poser côté serveur revient à l'exploitant. Tant qu'elle est absente,
`API_MAREE_KEY` arrive vide (comportement documenté d'`init.sh` pour un
`env:` non défini côté serveur) et l'application doit traiter cette absence
comme telle : la jauge de marée affiche un état « configuration requise »
plutôt qu'une erreur ou une valeur inventée — c'est le principe « dégrader,
jamais casser » du PRD appliqué à un secret manquant plutôt qu'à une panne
réseau.

## Jauge de marée — calcul

À partir de `/tide-extrema` (l'extremum précédent et le suivant) et
`/water-levels` (hauteur au pas le plus proche de l'heure courante) :

- position sur la jauge = fraction du temps écoulé entre le dernier extremum
  et le suivant (0 = dernier, 1 = prochain), pas une fraction de hauteur —
  la marée n'est pas linéaire en hauteur, elle l'est approximativement en
  progression temporelle sur un cycle semi-diurne ;
- sens (montante/descendante) = type du prochain extremum (`PM` → montante,
  `BM` → descendante) ;
- prochaine bascule = heure et type du prochain extremum, avec le temps
  restant calculé côté serveur (pas côté client, pour rester juste même
  horloge du poste déréglée) ;
- hauteur actuelle affichée = point `/water-levels` le plus proche de
  l'heure serveur courante, jamais interpolée côté client.

## Dégradation

- Météo/état de mer indisponibles (réseau, panne du fournisseur) : dernière
  réponse réussie conservée en mémoire process et resservie, avec un
  indicateur de fraîcheur ; à froid (jamais interrogé avec succès), la
  section correspondante affiche un état d'indisponibilité plutôt qu'un
  écran cassé.
- Marée sans clé configurée : état « configuration requise », jamais une
  valeur inventée.
- Marée avec clé mais fournisseur en panne : même stratégie que
  météo/état de mer — dernière valeur connue, resservie.

## Stack

Go, bibliothèque standard uniquement pour le serveur HTTP et les appels
sortants (`net/http`), `encoding/json` pour le décodage. Une page unique
(`page.html`) embarquée par `go:embed`, JavaScript minimal (fetch des
endpoints internes, rendu de la jauge en SVG). Cohérent avec `cadran`,
`ramure`, `pilabelle`, `marcq-handball`.

## Routes

| Route | Réponse |
|---|---|
| `GET /` | la page |
| `GET /api/previsions` | JSON : prévision à 5 heures + tendance à 7 jours (Open-Meteo + Marine) |
| `GET /api/maree` | JSON : état de la jauge, prochaine bascule, ou état « configuration requise » |
| `GET /healthz` | `200 ok` dès que le serveur écoute — ne dépend d'aucun fournisseur externe |

`/healthz` ne vérifie pas les fournisseurs externes : un `wget` local ne doit
pas rendre le conteneur malsain parce qu'Open-Meteo est indisponible, cohérent
avec « dégrader, jamais casser ».

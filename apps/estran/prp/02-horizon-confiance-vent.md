# 02 — Horizon a 16 jours, indice de confiance, vent journalier

Derive de `PRODUCT.md` et de trois demandes d'usage du 18 aout 2026, groupees
ici parce qu'elles touchent les memes objets (la journee en cours, la tendance,
la fenetre de navigation) et qu'un seul deploiement vaut mieux que trois.

1. **Voir la journee en cours au-dela des cinq prochaines heures.**
2. **Voir la tendance au-dela de sept jours.**
3. **Voir, pour chaque jour de la tendance, un indice de confiance et le vent.**

## 1. La journee en cours ne s'arrete plus a cinq heures

Aujourd'hui, la section horaire montrait exactement `nombreHeuresAffichees = 5`
vignettes, et le detail des vingt-quatre heures n'existait que pour un jour
*autre* qu'aujourd'hui (prp/01). Regarder ce que donne la fin de l'apres-midi
demandait donc de partir sur demain puis de revenir : l'information existait,
le chemin pour l'atteindre n'existait pas.

**Ce qui change** : sans parametre `date`, la reponse porte **toutes les heures
restantes du jour**, de l'heure en cours a 23 h. Les cartes gardent leur forme ;
la bande defile horizontalement, comme celle des autres jours.

**Le minimum de cinq heures reste**, et c'est ce qui evite une regression le
soir : a 22 h, s'arreter a minuit ne laisserait que deux vignettes la ou
l'ancienne version en donnait cinq. La regle est donc : les heures restantes du
jour, **et jamais moins de cinq**, quitte a deborder sur le lendemain — le
comportement d'avant, exactement, entre 19 h et minuit.

**Ce que cela remplace** : prp/01 posait « a l'ouverture, l'ecran est celui
d'aujourd'hui, identique a avant — cinq prochaines heures ». Cette contrainte
tombe ici, sur demande explicite de l'utilisateur ; ce qui reste vrai, c'est
que l'ecran d'ouverture est celui d'aujourd'hui et que la maree y garde sa
jauge instantanee (PRODUCT.md, principes 2 et 4).

## 2. La tendance passe de 7 a 16 jours

`nombreJoursAffiches` passe de 7 a **16** — aujourd'hui compris, donc J0 a J+15,
le maximum qu'Open-Meteo rende sans abonnement.

La fenetre de navigation suit : `joursNavigationAvant` passe de 7 a **15**, pour
qu'une ligne de tendance mene toujours au jour qu'elle decrit. Le passe ne bouge
pas : `joursNavigationArriere` reste a 7.

| Source | Passe | Avenir | Verifie |
|---|---|---|---|
| Open-Meteo (horaire + journalier) | `past_days=7` | `forecast_days=16` | 2026-08-18, 16 jours rendus, J0 a J+15 |
| Open-Meteo Marine (vagues) | `past_days=7` | `forecast_days=16` | 2026-08-18, 384 heures rendues |
| api-maree.fr (`/tide-extrema`) | `from` a J-7 | `to` a J+15 | documentation : fenetre autorisee J-30 a J+30 |

`forecast_days=16` garde le piege deja documente en prp/01 : Open-Meteo compte
aujourd'hui dans sa fenetre, donc 16 rend J0..J+15 et non J0..J+16.

## 3. L'indice de confiance vient de l'accord entre modeles

Un indice deduit de la seule echeance ne dirait rien de plus que la date. Celui-ci
mesure ce qui compte reellement : **est-ce que les modeles meteo disent la meme
chose ?** Un deuxieme appel a Open-Meteo, gratuit et sans cle, demande les memes
grandeurs journalieres a six modeles :

```
models=icon_seamless,gfs_seamless,ecmwf_ifs025,meteofrance_seamless,gem_seamless,ukmo_seamless
daily=temperature_2m_max,precipitation_probability_max
```

La reponse porte un champ par modele (`temperature_2m_max_icon_seamless`, …), et
**des valeurs nulles la ou un modele ne porte pas si loin** — verifie le
2026-08-18 : au-dela de J+10, seul `gfs_seamless` repond encore sur la pluie.
Cette disparition est une information, pas une panne.

**Calcul, par jour** (fonction pure, testee sans reseau) :

- on retient les valeurs non nulles de chaque grandeur, modele par modele ;
- **moins de deux modeles sur la temperature : confiance inconnue**, jamais
  remplacee par une valeur plausible ;
- sinon on prend l'ecart-type de population de chaque grandeur, on le classe,
  et **le niveau du jour est le plus prudent des deux** :

| Grandeur | haute | moyenne | basse |
|---|---|---|---|
| Temperature maximale | ecart-type <= 1 °C | <= 2 °C | au-dela |
| Probabilite de pluie | ecart-type <= 15 points | <= 30 points | au-dela |

La probabilite de pluie est ignoree quand moins de deux modeles la portent : le
niveau vaut alors celui de la temperature seule.

L'ecart-type, et non l'ecart maximum : un seul modele aberrant ne doit pas
declasser un jour sur lequel les cinq autres s'accordent.

**Ou il s'affiche** : sur chaque ligne de la tendance, et **la seulement**. Les
prochaines heures n'en portent pas — a cette echeance la question ne se pose
pas, et l'ecran d'ouverture doit rester lisible d'un coup d'oeil (PRODUCT.md,
principe 4). Le nombre de modeles compares accompagne l'indice, en texte
accessible : c'est ce qui rend l'indice verifiable plutot que magique.

## 4. Le vent entre dans la tendance journaliere

Trois grandeurs journalieres de plus, du meme appel qu'aujourd'hui :
`wind_speed_10m_max`, `wind_gusts_10m_max`, `wind_direction_10m_dominant`.
Affichees en une ligne : force maximale, rafale maximale, direction dominante en
rose des vents a huit branches. Le vent horaire, lui, ne change pas.

## Routes

Aucune route nouvelle, aucun parametre nouveau. Deux reponses s'enrichissent :

| Route | Ce qui change |
|---|---|
| `GET /api/previsions` | `heures` : toutes les heures restantes du jour (minimum cinq) ; `jours` : 16 entrees au lieu de 7, chacune avec `vent_kmh_max`, `rafales_kmh_max`, `vent_direction_deg`, `confiance`, `confiance_modeles` |
| `GET /api/previsions?date=…` | inchange dans sa forme ; la fenetre acceptee va desormais jusqu'a J+15 |
| `GET /api/maree`, `?date=…` | inchangees dans leur forme ; fenetre de maree elargie a J+15 |

`confiance` et `confiance_modeles` sont **absents** (`omitempty`) quand l'accord
n'a pas pu etre calcule : l'absence se lit, elle ne s'invente pas.

## Degradation

Inchangee dans son principe (PRODUCT.md, principe 3), avec une regle de plus qui
la garde vraie : **l'appel d'accord entre modeles ne peut jamais faire echouer la
prevision**. Il porte son propre delai, court ; s'il echoue, il est journalise,
la tendance s'affiche sans indice, et le reste de l'ecran ne s'en apercoit pas.
C'est un ornement verifiable, pas une dependance.

De meme, au-dela de J+7 le fournisseur de vagues peut ne plus rendre de hauteur :
la vignette horaire omet alors la ligne « vagues » au lieu d'afficher zero.

## Ce qui est ecarte

- **Un graphique d'evolution** sur la fenetre : la promesse reste une lecture en
  un coup d'oeil.
- **L'indice de confiance sur les vignettes horaires** : ecarte a l'arbitrage du
  18 aout 2026, pour ne pas charger l'ecran d'ouverture.
- **Elargir le passe au-dela de sept jours** : toujours pas demande.
- **Choisir les modeles depuis l'interface** : la liste est un detail
  d'implementation, pas une preference d'utilisateur.

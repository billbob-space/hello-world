# 2026-08-16 — claude/estran-marine-weather-fix-0sqt73

Branche : `claude/estran-marine-weather-fix-0sqt73`
Périmètre : estran
Mode : `chaud`

## Anomalies

### 1. « couvert » affiché sous un grand soleil : le cirrus compte comme un ciel bouché

**Symptome** — Le 16 août 2026 vers 18 h 10, `estran` annonçait « couvert » (symbole
nuage) pour 18 h, 19 h et 20 h au Touquet, alors qu'il faisait plein soleil et que le
bulletin marine de référence (METEO CONSULT, Étaples–Le Touquet) montrait un soleil
franc à 18 h et 19 h, un soleil voilé à 20 h. Le vent, lui, concordait (Open-Meteo
13,7 km/h / 333° à 18 h contre 6 nd ≈ 11 km/h / 300° au bulletin) : seule la
description du ciel était fausse.

**Cause** — `estran` affichait tel quel le `weather_code` OMM d'Open-Meteo, dérivé de
la nébulosité **totale**, toutes couches confondues. Appel réel le 16 août à 18 h,
coordonnées 50.517 / 1.583 : `cloud_cover` 100 %, mais `cloud_cover_low` 0 %,
`cloud_cover_mid` 45 %, `cloud_cover_high` 100 %, `sunshine_duration` 3600 s
(l'heure entière au soleil), `direct_radiation` 157 W/m². Un voile de cirrus à
100 % suffit donc à produire le code 3, « couvert », alors que le soleil traverse.

Vérifié sur six modèles (`best_match`, `icon_seamless`, `ecmwf_ifs025`,
`gfs_seamless`, `ukmo_seamless`, `meteofrance_seamless`) : tous donnent une
nébulosité basse quasi nulle et 3600 s d'ensoleillement l'après-midi entier. La
prévision n'était pas fausse, sa **traduction** l'était — changer de modèle n'aurait
rien corrigé, et `meteofrance_seamless` s'est même révélé instable sur cette
variable (100 % à 17 h, 0 % à 18 h, 100 % à 19 h). Constat annexe : le champ
`NebulositePct`, récupéré depuis l'origine, n'était lu nulle part.

**Detecte par** — `utilisateur`

**Action** — `arbitrage` — la source restait la bonne ; c'est le choix de traduire un
code OMM global plutôt que les couches nuageuses qui demandait une décision, et le
bulletin marine a servi d'arbitre.

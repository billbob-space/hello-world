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

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-16 à 16:23 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 4 277 | 0,01 $ |
| Écriture de cache | 259 169 | 1,06 $ |
| Lecture de cache | 5 027 686 | 2,19 $ |
| Sortie | 26 596 | 0,65 $ |
| **Total** | **5 317 728** | **3,91 $ — 3,40 €** |

**Ce qui coûte**

- **71 appel(s) au modèle** — un par réponse, outils compris —, dont 30 par des sous-agents — 1 337 174 jetons, 0,62 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  63 945 jetons, écrits une fois par session puis relus à chaque
  échange : 2 557 800 jetons de relecture, 50 % de tout ce qui a été relu.
- **Tours courts** — 43 des 71 tours (60 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 1,77 $, soit 45 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 63 945 jetons relus au premier appel qui relise
  quelque chose, 129 425 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 5317728 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 63945 0 378
2 principal claude-opus-5 663 63945 115
3 principal claude-opus-5 1705 64608 128
4 principal claude-opus-5 172 66313 133
5 principal claude-opus-5 4104 66485 737
6 principal claude-opus-5 8688 70589 496
7 principal claude-opus-5 2122 79277 819
8 principal claude-opus-5 2066 81399 957
9 principal claude-opus-5 2254 83465 250
10 principal claude-opus-5 470 85719 277
11 principal claude-opus-5 472 86189 111
12 principal claude-opus-5 505 86661 1413
13 principal claude-opus-5 2607 87166 1532
14 principal claude-opus-5 3966 89773 726
15 principal claude-opus-5 946 93739 113
16 principal claude-opus-5 1918 94685 3849
17 principal claude-opus-5 4587 96603 216
18 principal claude-opus-5 2874 101190 181
19 principal claude-opus-5 3057 104064 249
20 principal claude-opus-5 562 107121 143
21 principal claude-opus-5 1240 107683 1182
22 principal claude-opus-5 1209 108923 5251
23 principal claude-opus-5 5699 110132 254
24 principal claude-opus-5 422 115831 892
25 principal claude-opus-5 1082 116253 652
26 principal claude-opus-5 932 117335 126
27 principal claude-opus-5 138 118267 269
28 principal claude-opus-5 385 118405 277
29 principal claude-opus-5 3765 118790 643
30 principal claude-opus-5 676 122555 230
31 principal claude-opus-5 428 123231 183
32 principal claude-opus-5 3149 123659 228
33 principal claude-opus-5 462 126808 414
34 principal claude-opus-5 1109 127270 336
35 principal claude-opus-5 488 128379 355
36 principal claude-opus-5 558 128867 1518
37 principal claude-opus-4-7 40986 0 135
38 principal claude-opus-4-7 212 40986 75
39 principal claude-opus-4-7 208 41198 84
40 principal claude-opus-4-7 7095 41406 84
41 principal claude-opus-5 1739 129425 404
42 agent claude-haiku-4-5-20251001 11918 0 4
43 agent claude-haiku-4-5-20251001 1342 11918 2
44 agent claude-haiku-4-5-20251001 237 13260 2
45 agent claude-haiku-4-5-20251001 1187 13497 2
46 agent claude-haiku-4-5-20251001 326 14684 2
47 agent claude-sonnet-5 19527 0 5
48 agent claude-sonnet-5 2500 19527 4
49 agent claude-sonnet-5 10486 22027 7
50 agent claude-sonnet-5 1778 32513 2
51 agent claude-sonnet-5 10210 34291 6
52 agent claude-sonnet-5 1152 44501 20
53 agent claude-sonnet-5 684 45653 3
54 agent claude-sonnet-5 348 46337 3
55 agent claude-sonnet-5 2277 46685 3
56 agent claude-sonnet-5 638 48962 17
57 agent claude-sonnet-5 381 49600 3
58 agent claude-sonnet-5 1406 49981 3
59 agent claude-sonnet-5 371 51387 17
60 agent claude-sonnet-5 389 51758 5
61 agent claude-sonnet-5 1329 52147 2
62 agent claude-sonnet-5 2045 53476 2
63 agent claude-sonnet-5 1473 55521 5
64 agent claude-sonnet-5 1023 56994 5
65 agent claude-sonnet-5 4502 58017 3
66 agent claude-sonnet-5 193 62519 20
67 agent claude-sonnet-5 130 62712 3
68 agent claude-sonnet-5 1101 62842 8
69 agent claude-sonnet-5 250 63943 2
70 agent claude-sonnet-5 154 64193 20
71 agent claude-sonnet-5 147 64347 1
-->
<!-- /cout -->

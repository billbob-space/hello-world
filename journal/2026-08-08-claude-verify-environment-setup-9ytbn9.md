# 2026-08-08 — claude/verify-environment-setup-9ytbn9

Branche : `claude/verify-environment-setup-9ytbn9`
Périmètre : hello-world
Mode : `chaud`

## Anomalies

Aucune anomalie. Session de vérification de l'outillage (13/13 plugins, dont
token-optimizer ; binaire rtk présent) suivie d'un test réel des trois agents
de la fabrique : l'artisan a ajouté un test unitaire dans
`apps/hello-world/main_test.go` (405 attendu sur `POST /healthz`), les tests
de l'app passent, le greffier a committé et poussé, l'analyste a tourné en
parallèle en lecture seule sur `journal/`.

---

Branche reprise depuis `main` après fusion de la PR #96 (mode `/livrer`),
même nom, pour un second tour de travail.

Périmètre : fabrique

### 2. `rtk gain` / `rtk init --show` annoncent à tort que le hook n'est pas installé

**Symptôme** — demande de l'utilisateur : « active le hook rtk pour
l'automatiser ». Or `check-plugins.sh` le rapportait déjà présent, et le hook
`PreToolUse` existe déjà dans `.claude/settings.json`, écrit à la main lors
d'une branche antérieure (`claude/add-plugin-rtk-flamj4`). `rtk gain` et
`rtk init --show` affichent pourtant « No hook installed » / « RTK hook not
configured », ce qui a probablement motivé la demande.

**Cause** — vérifié empiriquement : une commande bash ordinaire, non préfixée
par `rtk`, est bien interceptée et comptée par `rtk gain` sans intervention —
le hook fonctionne. Le diagnostic intégré de `rtk` ne reconnaît que le format
qu'écrirait son propre installeur (`rtk init -g`, qui patche le
`settings.json` **global** de l'utilisateur) ; il ne sait pas lire le hook
écrit à la main dans le `settings.json` **versionné** du dépôt — c'est un faux
négatif du binaire, pas une panne du dépôt.

**Detecte par** — `utilisateur`

**Action** — `contrat` — `memory/outillage.md` documente maintenant ce faux
négatif, pour qu'une prochaine session ne lance pas `rtk init -g` en réponse à
cette alerte : cette commande patcherait le réglage éphémère du conteneur,
pas celui du dépôt, contredisant l'intégration à la main déjà en place et déjà
motivée dans ce même fichier.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-08 à 12:48 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 503 | 0,00 $ |
| Écriture de cache | 155 381 | 0,56 $ |
| Lecture de cache | 6 711 628 | 2,00 $ |
| Sortie | 37 784 | 0,56 $ |
| **Total** | **6 905 296** | **3,12 $ — 2,71 €** |

**Ce qui coûte**

- **60 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  67 037 jetons, écrits une fois par session puis relus à chaque
  échange : 3 955 183 jetons de relecture, 58 % de tout ce qui a été relu.
- **Tours courts** — 23 des 60 tours (38 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 0,97 $, soit 31 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 67 037 jetons relus au premier appel qui relise
  quelque chose, 154 532 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 6905296 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-sonnet-5 67037 0 317
2 principal claude-sonnet-5 1104 67037 198
3 principal claude-sonnet-5 7 68339 316
4 principal claude-sonnet-5 7780 68346 1092
5 principal claude-sonnet-5 1338 76126 487
6 principal claude-sonnet-5 1150 77464 257
7 principal claude-sonnet-5 1342 78614 495
8 principal claude-sonnet-5 1717 79956 163
9 principal claude-sonnet-5 4289 81673 679
10 principal claude-sonnet-5 2243 85962 2019
11 principal claude-sonnet-5 4678 88205 446
12 principal claude-sonnet-5 593 92883 1329
13 principal claude-sonnet-5 2168 93476 244
14 principal claude-sonnet-5 1031 95644 160
15 principal claude-sonnet-5 1534 96675 1515
16 principal claude-sonnet-5 1611 98209 720
17 principal claude-opus-4-7 3663 28233 184
18 principal claude-opus-4-7 2283 31896 169
19 principal claude-sonnet-5 944 99820 293
20 principal claude-sonnet-5 449 100764 151
21 principal claude-sonnet-5 1206 101213 152
22 principal claude-sonnet-5 159 102419 652
23 principal claude-sonnet-5 1183 102578 281
24 principal claude-sonnet-5 2417 103761 134
25 principal claude-sonnet-5 246 106178 271
26 principal claude-sonnet-5 332 106424 298
27 principal claude-sonnet-5 4424 107054 1940
28 principal claude-sonnet-5 383 113418 404
29 principal claude-sonnet-5 1789 113801 680
30 principal claude-sonnet-5 13 116270 315
31 principal claude-sonnet-5 1329 116283 135
32 principal claude-sonnet-5 771 117612 315
33 principal claude-sonnet-5 771 118383 332
34 principal claude-sonnet-5 17 119486 821
35 principal claude-sonnet-5 2605 119503 468
36 principal claude-sonnet-5 1693 122108 913
37 principal claude-sonnet-5 972 123801 113
38 principal claude-sonnet-5 254 124773 781
39 principal claude-sonnet-5 853 125027 1993
40 principal claude-sonnet-5 6538 125880 1367
41 principal claude-sonnet-5 1435 132418 695
42 principal claude-sonnet-5 885 133853 114
43 principal claude-sonnet-5 219 134738 1819
44 principal claude-sonnet-5 2667 134957 1998
45 principal claude-sonnet-5 2496 139622 544
46 principal claude-sonnet-5 901 142118 429
47 principal claude-sonnet-5 632 143019 3523
48 principal claude-sonnet-5 3616 143651 172
49 principal claude-sonnet-5 350 147267 172
50 principal claude-sonnet-5 456 147617 177
51 principal claude-sonnet-5 469 148073 1452
52 principal claude-sonnet-5 2058 148542 559
53 principal claude-sonnet-5 633 150600 174
54 principal claude-sonnet-5 182 151233 1058
55 principal claude-sonnet-5 1154 151415 97
56 principal claude-sonnet-5 426 152569 313
57 principal claude-sonnet-5 409 152995 99
58 principal claude-sonnet-5 307 153404 557
59 principal claude-sonnet-5 821 153711 106
60 principal claude-sonnet-5 349 154532 127
-->
<!-- /cout -->

# 2026-08-07 — claude/dockhand-production-debug-hsuflj

Branche : `claude/dockhand-production-debug-hsuflj`
Périmètre : `fabrique`
Mode : `chaud`

## Anomalies

### 1. Le dépôt n'avait aucun chemin vers sa propre production

**Symptome** — la question posée était « comment te donner la capacité de débug
sur l'infra de production ». La réponse honnête, avant cette branche, était
« aucune » : ni SSH, ni socket Docker, ni la moindre route HTTP. Tout
`*.billbob.ovh` est derrière Traefik, qui exige un compte Google ; un agent n'a
pas de navigateur, donc pas de compte. Le seul moyen de savoir ce qu'une
application déployée fait vraiment était de demander une capture d'écran.

**Cause** — `memory/perimetre.md` énumère ce qui vit hors du dépôt — Traefik, le
DNS, la liste blanche, les valeurs des secrets — et conclut « n'écris pas de
demande pour lui ». Cette phrase est juste pour la *configuration*, et elle a été
lue comme valant aussi pour l'*observation*. Or les deux ne se ressemblent que de
loin : demander un réglage, c'est demander à quelqu'un d'agir une fois ;
regarder un journal, c'est ce qu'on fait vingt fois par heure quand quelque
chose ne marche pas. Le premier se délègue, le second non — et rien dans le
contrat ne distinguait les deux.

**Detecte par** — `utilisateur`

**Action** — `contrat` — le `README` porte désormais la section « Regarder la
production » : la porte de service, les deux variables, et le contrôle en trois
`curl` qui prouve que la porte reste étroite. `CLAUDE.md` y renvoie depuis le
paragraphe du déploiement, seul endroit où un agent pense à la production.

### 2. `dockhand` en édition libre ne sait pas faire un jeton en lecture seule

**Symptome** — le plan initial annoncé à l'utilisateur était « crée un jeton, je
m'en sers pour lire ». Vérification faite dans la documentation : le contrôle
d'accès par rôles est réservé à l'édition Enterprise, et en édition libre « tout
utilisateur authentifié a un accès administrateur complet ». Le jeton demandé
pouvait donc arrêter les neuf conteneurs de la stack, et rien côté `dockhand` ne
permettait de l'en empêcher.

**Cause** — avoir supposé qu'un outil d'administration moderne offre forcément
un palier de lecture. C'est vrai de la plupart, faux de celui-ci, et la
distinction ne se lit que dans la page des tarifs — pas dans la page de l'API,
qui est celle qu'on ouvre quand on cherche à automatiser.

**Detecte par** — `auteur`

**Action** — `contrat` — la lecture seule est obtenue **avant** `dockhand`, par
la règle du routeur Traefik : `Method(GET)`. Un `POST` ne l'atteint jamais, il
retombe sur le routeur d'origine et repart vers Google. Le `README` dit
explicitement que ce routeur est le seul verrou, pour que personne n'élargisse
la règle en croyant que `dockhand` garde encore quelque chose derrière.

### 3. Le premier test réussi ne prouvait rien : `/api/health` est ouvert

**Symptome** — porte ouverte, premier appel : `GET /api/health` répond `200`
avec un jeton. Conclusion tentante et fausse — « le jeton fonctionne ». Le même
appel **sans** jeton répond `200` lui aussi : cette route est publique dans
`dockhand`, l'en-tête d'autorisation n'a jamais été regardé. Il a fallu
`/api/containers` — `401` sans jeton, `200` avec — pour savoir quoi que ce soit.

**Cause** — une route de santé est faite pour répondre à un superviseur qui n'a
pas d'identité ; elle est donc, par construction, le pire endroit où tester une
authentification. Le réflexe « je commence par le point le plus simple » choisit
pourtant exactement celui-là.

**Detecte par** — `auteur`

**Action** — `comportement` — un contrôle d'accès se vérifie sur une route qui
porte des **données**, et toujours dans les deux sens : avec jeton et sans. Les
trois `curl` du `README` sont écrits comme ça, et le troisième — un `POST` qui
doit être refusé — est celui qui compte, parce qu'il est le seul dont l'échec
serait une urgence.

### 4. Le contrat était à une ligne de son plafond

**Symptome** — `CLAUDE.md` faisait 249 lignes pour un plafond de 250. Mentionner
`prod.sh` — deux phrases — a consommé le dernier crédit. Le sujet a donc été
écrit dans le `README` et seulement *annoncé* dans le contrat, alors que
`memory/` est l'endroit prévu pour ça.

**Cause** — le plafond est une bonne contrainte et il fonctionne : il a bien
empêché d'élargir le contrat. Mais il ne dit pas *où* déplacer ce qui déborde, et
`memory/` impose une contrepartie — `Tenu par : --check|CI|hook` — qu'un sujet
purement documentaire ne peut pas honorer. « Regarder la production » n'est tenu
par aucun contrôle : c'est une capacité, pas une règle. Il n'avait donc sa place
ni dans le contrat, ni dans `memory/`, et le `README` l'a reçu par défaut.

**Detecte par** — `auteur`

**Action** — `arbitrage` — soit le plafond monte, soit `memory/` accepte un
sujet tenu par « rien » à condition qu'il ne porte aucune règle. Les deux se
défendent, et aucun agent ne devrait trancher seul un réglage qui décide de ce
que tous les suivants liront en permanence.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-07 à 21:57 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 746 | 0,00 $ |
| Écriture de cache | 216 581 | 1,35 $ |
| Lecture de cache | 5 787 490 | 2,89 $ |
| Sortie | 38 364 | 0,96 $ |
| **Total** | **6 043 181** | **5,21 $ — 4,52 €** |

**Ce qui coûte**

- **51 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  58 454 jetons, écrits une fois par session puis relus à chaque
  échange : 2 922 700 jetons de relecture, 50 % de tout ce qui a été relu.
- **Tours courts** — 16 des 51 tours (31 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 1,23 $, soit 23 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 58 454 jetons relus au premier appel qui relise
  quelque chose, 158 630 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 6043181 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 58454 0 584
2 principal claude-opus-5 5396 58454 247
3 principal claude-opus-5 9727 63850 402
4 principal claude-opus-5 5478 73577 648
5 principal claude-opus-5 1640 79055 82
6 principal claude-opus-5 1114 80695 270
7 principal claude-opus-5 1704 81809 490
8 principal claude-opus-5 1260 83513 1415
9 principal claude-opus-5 2628 84773 2027
10 principal claude-opus-5 2215 87401 298
11 principal claude-opus-5 323 89616 1388
12 principal claude-opus-5 993 91327 183
13 principal claude-opus-5 302 92320 303
14 principal claude-opus-5 657 92622 733
15 principal claude-opus-5 910 93279 1997
16 principal claude-opus-5 3170 94189 241
17 principal claude-opus-5 772 97359 1816
18 principal claude-opus-5 804 99947 2477
19 principal claude-opus-5 62302 40936 407
20 principal claude-opus-5 535 103238 392
21 principal claude-opus-5 683 103773 211
22 principal claude-opus-5 1549 104456 348
23 principal claude-opus-5 827 106005 679
24 principal claude-opus-5 1359 106832 819
25 principal claude-opus-5 4233 108191 384
26 principal claude-opus-5 10529 112424 439
27 principal claude-opus-5 2453 122953 223
28 principal claude-opus-5 1996 125406 663
29 principal claude-opus-5 1251 127402 1092
30 principal claude-opus-5 1340 128653 301
31 principal claude-opus-5 3523 129993 455
32 principal claude-opus-5 504 133516 99
33 principal claude-opus-5 284 134020 696
34 principal claude-opus-5 838 134304 4284
35 principal claude-opus-5 4332 135142 106
36 principal claude-opus-5 418 139474 364
37 principal claude-opus-5 763 139892 424
38 principal claude-opus-5 682 140655 561
39 principal claude-opus-5 4907 141337 183
40 principal claude-opus-5 376 146244 125
41 principal claude-opus-5 830 146620 1845
42 principal claude-opus-5 1914 147450 593
43 principal claude-opus-5 1161 149364 285
44 principal claude-opus-5 883 150525 1075
45 principal claude-opus-5 1291 151408 504
46 principal claude-opus-5 550 152699 293
47 principal claude-opus-5 492 153249 3247
48 principal claude-opus-5 3319 153741 97
49 principal claude-opus-5 1052 157060 301
50 principal claude-opus-5 518 158112 1171
51 principal claude-opus-5 1340 158630 97
-->
<!-- /cout -->

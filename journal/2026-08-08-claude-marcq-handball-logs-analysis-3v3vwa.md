# 2026-08-08 — claude/marcq-handball-logs-analysis-3v3vwa

Branche : `claude/marcq-handball-logs-analysis-3v3vwa`
Périmètre : marcq-handball
Mode : `chaud`

## Anomalies

### 1. Les journaux du conteneur étaient la mauvaise place pour mesurer l'usage

**Symptome** — Question du décideur : est-ce que des familles ont réussi à se
servir de l'app ? `./scripts/prod.sh journaux marcq-handball 20000` rend
1 540 lignes, dont 1 234 sondes `/healthz`, et **la plus ancienne date de dix
heures** : elle commence au démarrage du conteneur. Les cinq jours d'usage
antérieurs n'existent nulle part. La seule trace durable était
`classement.json`, qui dit qui s'est inscrit — deux enfants — et rien de ce qui
s'est passé pour ceux qui n'ont pas été jusque-là.

**Cause** — Le raisonnement de départ était juste et la conclusion fausse : le
contrat dit bien que `dockhand` recrée **toute** la stack à chaque déploiement,
y compris les apps qu'on n'a pas touchées. J'en avais tiré la conséquence sur la
disponibilité — quelques secondes de coupure — et pas celle sur les journaux :
un `docker compose up` qui recrée un conteneur ne redémarre pas un processus,
il jette le conteneur et son journal `json-file` avec. À raison de plusieurs
déploiements par jour dans une fabrique partagée, la fenêtre d'observation d'une
app n'est pas `log_max_size`, c'est **le temps écoulé depuis le déploiement de
n'importe quelle autre app**. Aucun document ne le disait, et le réglage
`log_max_size: 10m` de `fabrique.yml` suggère même le contraire.

**Detecte par** — `production`

**Action** — `contrat` — le contrat décrit la portée du redéploiement du point
de vue de la disponibilité (« dockhand recrée toute la stack ») sans dire qu'elle
emporte aussi les journaux. Une app dont le succès se mesure à l'usage doit
poser ses compteurs dans son volume, et ça ne s'invente pas au moment où on se
pose la question — c'est trop tard, la mesure manquante est déjà perdue.

### 2. « POST 200 » se lisait pareil qu'un envoi plein ou vide

**Symptome** — Le fichier de production porte une fiche créée le 7 août à 22 h 31
avec `"faits": {}` — zéro exercice coché — et un `vuLe` du lendemain 7 h 31, donc
un téléphone qui a bien reparlé au serveur. Trois `POST /api/classement 200` ce
matin-là dans les journaux, et rien qui permette de trancher entre les deux
explications, qui n'appellent pas la même réponse : un enfant inscrit qui ne
s'entraîne pas, ou un écran qui n'envoie pas ce qu'il croit envoyer. Deux
`POST 403` précèdent, et là non plus le statut ne dit pas lequel des deux refus
— nom déjà pris, ou code faux — puisque l'API les confond **délibérément** dans
sa réponse pour ne pas devenir un oracle de disponibilité de pseudonymes.

**Cause** — Le middleware de journalisation trace méthode, chemin, statut et
durée, ce qui est le bon minimum pour une app publique et une consigne du
`README` (« les journaux ne portent que… »). Mais la règle avait été écrite
contre une fuite de données nominatives, et je l'avais appliquée à tout : les
**nombres** que le serveur calcule déjà — combien d'exercices reçus, combien
ignorés, combien de participants — n'identifient personne et manquaient. La
confusion des deux refus dans la *réponse* est un choix de sécurité ; l'étendre
au *journal du serveur*, qui n'est lu que par nous, ne protégeait rien et
coûtait la seule information utile.

**Detecte par** — `production`

**Action** — `rien` — réparée par ce commit : une ligne par envoi, une par refus,
toujours sans valeur reçue.

### 3. L'élagage laissait passer un jour de plus, indéfiniment

**Symptome** — Le test du plafond de rétention des compteurs échoue à 401
journées conservées pour un plafond de 400.

**Cause** — J'élaguais au changement de date, **avant** d'insérer la journée
neuve : la carte revenait à 400, puis l'insertion la remettait à 401, et
l'élagage suivant refaisait exactement la même chose. Le plafond n'était donc pas
un plafond mais un plancher décalé d'un cran — une fuite d'une entrée par jour,
que rien n'aurait signalé en production avant la 401ᵉ journée.

**Detecte par** — `test`

**Action** — `rien` — l'élagage a été déplacé après l'insertion. Le test qui l'a
attrapé est celui qui pousse jusqu'au plafond plutôt que de vérifier le principe
sur trois entrées.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-08 à 10:59 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 118 | 0,00 $ |
| Écriture de cache | 167 773 | 1,05 $ |
| Lecture de cache | 7 840 717 | 3,92 $ |
| Sortie | 49 956 | 1,25 $ |
| **Total** | **8 058 564** | **6,22 $ — 5,40 €** |

**Ce qui coûte**

- **62 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  58 159 jetons, écrits une fois par session puis relus à chaque
  échange : 3 547 699 jetons de relecture, 45 % de tout ce qui a été relu.
- **Tours courts** — 24 des 62 tours (38 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 1,87 $, soit 30 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 58 159 jetons relus au premier appel qui relise
  quelque chose, 166 105 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 8058564 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 58159 0 373
2 principal claude-opus-5 3729 58159 267
3 principal claude-opus-5 5126 61888 288
4 principal claude-opus-5 2216 67014 296
5 principal claude-opus-5 2763 69230 472
6 principal claude-opus-5 10405 71993 355
7 principal claude-opus-5 2710 82398 279
8 principal claude-opus-5 749 85108 523
9 principal claude-opus-5 2970 85857 807
10 principal claude-opus-5 3105 88827 1905
11 principal claude-opus-5 4911 91932 2074
12 principal claude-opus-5 5605 96843 1384
13 principal claude-opus-5 26 102448 1447
14 principal claude-opus-5 1819 102474 1562
15 principal claude-opus-5 5342 104293 376
16 principal claude-opus-5 697 109635 203
17 principal claude-opus-5 1977 110332 3753
18 principal claude-opus-5 4592 112309 176
19 principal claude-opus-5 1256 116901 5426
20 principal claude-opus-5 5609 118157 312
21 principal claude-opus-5 391 123766 180
22 principal claude-opus-5 236 124157 486
23 principal claude-opus-5 1212 124393 2843
24 principal claude-opus-5 3118 125605 1180
25 principal claude-opus-5 1350 128723 326
26 principal claude-opus-5 624 130073 493
27 principal claude-opus-5 626 130697 218
28 principal claude-opus-5 479 131323 525
29 principal claude-opus-5 651 131802 186
30 principal claude-opus-5 241 132453 140
31 principal claude-opus-5 437 132694 337
32 principal claude-opus-5 394 133131 174
33 principal claude-opus-5 231 133525 181
34 principal claude-opus-5 1065 133756 4797
35 principal claude-opus-5 4852 134821 449
36 principal claude-opus-5 1053 139673 259
37 principal claude-opus-5 581 140726 357
38 principal claude-opus-5 548 141307 180
39 principal claude-opus-5 238 141855 258
40 principal claude-opus-5 316 142093 124
41 principal claude-opus-5 1540 142409 262
42 principal claude-opus-5 4480 143949 652
43 principal claude-opus-5 2015 148429 694
44 principal claude-opus-5 749 150444 827
45 principal claude-opus-5 883 151193 1432
46 principal claude-opus-5 1620 152076 143
47 principal claude-opus-5 180 153696 421
48 principal claude-opus-5 816 153876 83
49 principal claude-opus-5 677 154692 1750
50 principal claude-opus-5 1805 155369 391
51 principal claude-opus-5 446 157174 153
52 principal claude-opus-5 1337 157620 1228
53 principal claude-opus-5 1288 158957 412
54 principal claude-opus-5 472 160245 549
55 principal claude-opus-5 739 160717 480
56 principal claude-opus-5 539 161456 518
57 principal claude-opus-5 574 161995 1927
58 principal claude-opus-5 2004 162569 131
59 principal claude-opus-5 431 164573 102
60 principal claude-opus-5 794 165004 94
61 principal claude-opus-5 307 165798 1643
62 principal claude-opus-5 1668 166105 93
-->
<!-- /cout -->

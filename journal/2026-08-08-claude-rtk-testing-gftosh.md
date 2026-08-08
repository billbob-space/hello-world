# 2026-08-08 — claude/rtk-testing-gftosh

Branche : `claude/rtk-testing-gftosh`
Périmètre : fabrique
Mode : `chaud`

## Anomalies

### 1. `check-plugins.sh` decoupait la description d'un binaire de hook en autant de faux manquants

**Symptome** — demande de test de `rtk` sur ce conteneur, ou le binaire n'est pas
installe (setup script pas encore joue). Le rapport `SessionStart` attendu etait
une seule ligne « rtk ABSENT — la compression des commandes bash est inactive. »,
mais en a affiche six : `rtk ABSENT — la.`, `compression ABSENT — compression.`,
`des ABSENT — des.`, `commandes ABSENT — commandes.`, `est ABSENT — est.`,
`inactive ABSENT — inactive.` — `bash`, seul mot de la phrase qui soit aussi une
commande reellement presente, n'apparaissait pas dans la liste des manquants.

**Cause** — `HOOK_BINAIRES="rtk:la compression des commandes bash est inactive"`
est parcourue par `for h in $HOOK_BINAIRES`, sans guillemets : le shell decoupe
sur les espaces, donc sur chaque mot de la description elle-meme, et traite
chaque mot comme un nom de binaire a tester avec `command -v`. Le format
`binaire:description` ne marchait que pour une description sans espace ; le seul
triplet existant (`TRIPLETS`, `plugin:binaire:stack`) n'a jamais expose le
defaut parce qu'aucun de ses champs n'en contient.

**Detecte par** — `auteur`

**Action** — `garde-fou` — `HOOK_BINAIRES` est desormais parcourue avec
`while IFS= read -r h; do ... done <<EOF` plutot que `for h in $HOOK_BINAIRES`,
pour que la description d'un futur second binaire de hook puisse elle aussi
contenir des espaces sans se faire decouper.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-08 à 11:28 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 2 016 | 0,01 $ |
| Écriture de cache | 106 858 | 0,40 $ |
| Lecture de cache | 1 410 250 | 0,42 $ |
| Sortie | 10 119 | 0,15 $ |
| **Total** | **1 529 243** | **0,98 $ — 0,85 €** |

**Ce qui coûte**

- **16 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  66 630 jetons, écrits une fois par session puis relus à chaque
  échange : 999 450 jetons de relecture, 70 % de tout ce qui a été relu.
- **Tours courts** — 7 des 16 tours (43 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 0,27 $, soit 27 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 66 630 jetons relus au premier appel qui relise
  quelque chose, 106 236 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 1529243 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-sonnet-5 66630 0 648
2 principal claude-sonnet-5 1406 66630 388
3 principal claude-sonnet-5 10388 68036 1574
4 principal claude-sonnet-5 4498 78424 1330
5 principal claude-sonnet-5 10215 82922 374
6 principal claude-sonnet-5 2082 93137 267
7 principal claude-sonnet-5 3952 95219 249
8 principal claude-sonnet-5 371 99171 130
9 principal claude-sonnet-5 1361 99542 1320
10 principal claude-sonnet-5 1398 100903 477
11 principal claude-sonnet-5 555 102301 119
12 principal claude-sonnet-5 359 102856 2363
13 principal claude-sonnet-5 2455 103215 118
14 principal claude-sonnet-5 318 105670 158
15 principal claude-sonnet-5 248 105988 502
16 principal claude-sonnet-5 622 106236 102
-->
<!-- /cout -->

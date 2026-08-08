# 2026-08-08 — claude/add-plugin-rtk-flamj4

Branche : `claude/add-plugin-rtk-flamj4`
Périmètre : fabrique
Mode : `chaud`

## Anomalies

### 1. rtk-ai/rtk n'est pas un plugin Claude Code au sens du contrat

**Symptome** — la demande etait « ajoute ce plugin », mais le depot rtk-ai/rtk ne
porte aucun `.claude-plugin/marketplace.json` ni `plugin.json` : il n'est pas
installable par `claude plugin install`. C'est un binaire Rust independant qui
reecrit les commandes bash, avec son propre installeur (`rtk init -g`) qui patche
`~/.claude/settings.json` — le settings.json **de l'utilisateur**, jamais celui,
versionne et partage, du depot.

**Cause** — rtk est concu pour un usage global sur la machine d'un developpeur,
pas pour une fabrique multi-app dont l'outillage doit etre identique a chaque
clone. Le tableau des plugins de `memory/outillage.md` ne couvrait que les
plugins de marketplace ; rien n'y decrivait un outil hook installe comme binaire
independant.

**Detecte par** — `auteur`

**Action** — `contrat` — integre a la main (binaire installe par
`cloud-setup.sh`, hook `PreToolUse` ecrit directement dans le `settings.json` du
depot, verifie par `check-plugins.sh`) et documente dans `memory/outillage.md`
comme un cas distinct des plugins de marketplace, aux cotes des serveurs LSP.

### 2. Un hook qui appelle un binaire absent bloquerait bash pour tout le monde

**Symptome** — le hook `PreToolUse` de rtk (`rtk hook claude`) s'execute a
**chaque** appel de l'outil Bash. Sur un clone sans le binaire installe (poste
local sans `cloud-setup.sh`, ou avant son premier passage), l'appeler tel quel
aurait fait echouer la commande d'interception elle-meme.

**Cause** — le mecanisme d'installation de rtk suppose toujours que son binaire
est deja present quand le hook est enregistre ; rien ne protege le cas contraire.

**Detecte par** — `auteur`

**Action** — `garde-fou` — la commande du hook est ecrite
`command -v rtk >/dev/null 2>&1 && rtk hook claude || true` : sans le binaire,
bash continue de fonctionner normalement, juste sans la compression.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-08 à 11:14 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 1 858 | 0,01 $ |
| Écriture de cache | 162 564 | 0,61 $ |
| Lecture de cache | 5 884 497 | 1,77 $ |
| Sortie | 31 303 | 0,47 $ |
| **Total** | **6 080 222** | **2,85 $ — 2,48 €** |

**Ce qui coûte**

- **48 appel(s) au modèle** — un par réponse, outils compris —, aucun par des sous-agents.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  66 531 jetons, écrits une fois par session puis relus à chaque
  échange : 3 126 957 jetons de relecture, 53 % de tout ce qui a été relu.
- **Tours courts** — 24 des 48 tours (50 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 1,14 $, soit 40 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 66 531 jetons relus au premier appel qui relise
  quelque chose, 162 258 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 6080222 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-sonnet-5 66531 0 404
2 principal claude-sonnet-5 5462 66531 253
3 principal claude-sonnet-5 1049 71993 612
4 principal claude-sonnet-5 3706 73042 178
5 principal claude-sonnet-5 206 76748 181
6 principal claude-sonnet-5 1393 76954 294
7 principal claude-sonnet-5 5649 78347 735
8 principal claude-sonnet-5 6495 83996 829
9 principal claude-sonnet-5 1298 90491 2699
10 principal claude-sonnet-5 2852 91789 747
11 principal claude-sonnet-5 4243 94641 290
12 principal claude-sonnet-5 509 98884 245
13 principal claude-sonnet-5 1812 99393 243
14 principal claude-sonnet-5 2735 101205 621
15 principal claude-sonnet-5 1756 103940 1057
16 principal claude-sonnet-5 3224 105696 284
17 principal claude-sonnet-5 999 108920 1394
18 principal claude-sonnet-5 1623 109919 983
19 principal claude-sonnet-5 2588 111542 6760
20 principal claude-sonnet-5 14853 114130 423
21 principal claude-sonnet-5 1559 128983 228
22 principal claude-sonnet-5 2006 130542 546
23 principal claude-sonnet-5 4080 132548 149
24 principal claude-sonnet-5 280 136628 120
25 principal claude-sonnet-5 1502 136908 2127
26 principal claude-sonnet-5 2222 138410 465
27 principal claude-sonnet-5 539 140632 478
28 principal claude-sonnet-5 557 141171 821
29 principal claude-sonnet-5 876 141728 199
30 principal claude-sonnet-5 2157 142604 263
31 principal claude-sonnet-5 342 144761 676
32 principal claude-sonnet-5 875 145103 966
33 principal claude-sonnet-5 1020 145978 95
34 principal claude-sonnet-5 2125 146998 309
35 principal claude-sonnet-5 1304 149123 305
36 principal claude-sonnet-5 472 150427 106
37 principal claude-sonnet-5 2130 150899 271
38 principal claude-sonnet-5 273 153029 892
39 principal claude-sonnet-5 966 153302 243
40 principal claude-sonnet-5 290 154268 109
41 principal claude-sonnet-5 599 154558 612
42 principal claude-sonnet-5 662 155157 156
43 principal claude-sonnet-5 471 155819 134
44 principal claude-sonnet-5 2092 156290 236
45 principal claude-sonnet-5 421 158382 205
46 principal claude-sonnet-5 2224 158803 1136
47 principal claude-sonnet-5 1231 161027 100
48 principal claude-sonnet-5 306 162258 124
-->
<!-- /cout -->

# 2026-08-08 — claude/gym-pilate-app-prd-bw0a8m

Branche : `claude/gym-pilate-app-prd-bw0a8m`
Périmètre : pilabelle, fabrique
Mode : `chaud`

## Anomalies

Aucune anomalie. Rédaction du PRD de `pilabelle` (programme pilates doux
quotidien, personnalisé, palier `private`), après un brainstorming avec
l'utilisateur sur le nom, le suivi de mesures, la durée de séance et les
mécaniques de challenge. Aucun code écrit à ce stade — seul `PRODUCT.md` est
livré, conformément à `memory/produit.md` (« un répertoire qui ne porte que
ces documents est légitime »).

Rédaction ensuite des huit PRP (`apps/pilabelle/prp/`), dérivés de ce PRD, sur
le modèle de `marcq-handball` (serveur qui tient l'état, un PRP = une branche
= une PR) adapté à l'inverse de son partage serveur/navigateur : ici le
serveur tient l'identité, la persistance et l'algorithme, puisque la
progression doit se retrouver sur n'importe quel appareil (PRD §6 item 8),
ce qu'un stockage `localStorage` ne permettrait pas. Toujours aucun code
écrit — seuls les PRP et `apps/pilabelle/CLAUDE.md` (régénéré par
`./init.sh`) changent.

Deux points non tranchés par le PRD ont été résolus par lecture plutôt
qu'escaladés, et documentés comme tels dans `00-ossature.md` §6 et dans
`02-dictionnaire.md` (le tirage sans repli silencieux, PRD §12) : la série
compte les jours actifs déclarés, pas les jours calendaires. Un point reste
un verrou ouvert et nommé, faute de spécification : le contenu et la règle de
génération du défi de la semaine (`06-defi-semaine.md`), écrit en profondeur
« contrat » plutôt qu'exécutable pour cette raison — même choix que les PRP
07 à 11 de `marcq-handball` sur des verrous comparables.

---

Reprise sur la même branche (PR #101 fusionnée depuis) pour implémenter le
lot 1 (PRP 01 à 05) et mettre l'application en ligne, en mode `/livrer`.
Décision prise seule et non escaladée : un seul commit d'activation
(`enabled: true`) à la fin de CETTE branche plutôt que la séquence en deux
PR décrite dans les PRP — vérifié sur `.github/workflows/build.yml:355-374`
que le job `deploy` ne tourne jamais sur un `pull_request`, seulement sur un
`push` vers `main` après fusion, et que `build` (qui publie l'image) le
précède dans le même run via `needs:`. Le risque que la séquence en deux PR
protégeait — un `app.yml` activé avant que l'image existe sur le registre —
ne se produit donc pas si l'activation est fusionnée dans le même run qui
publie l'image pour la première fois.

Le lot 1 (PRP 01 à 05) est implémenté, testé (38 tests Go, 10 tests Node) et
activé (`enabled: true`). Avant d'activer, un smoke-test manuel du binaire
compilé (hors des tests automatisés) a exercé le parcours complet : création
de profil, `GET /api/jour` — l'exercice `cu-jambes-1` a bien été retenu malgré
la contre-indication `genou` déclarée sur un autre exercice de la même zone,
preuve que le filtrage §8.2 étape 1 opère réellement et pas seulement en
test unitaire —, puis `POST /api/ressenti` : série à 1, second envoi le même
jour renvoyant `deja_compte: true` sans rien modifier. `docker build` n'a pas
pu être exercé localement (pas de démon Docker dans ce conteneur) ; la
construction réelle est laissée à la CI, `--check` ayant déjà vérifié
statiquement la forme du `Dockerfile`.

---

Sur demande explicite en conversation (« vas-y, écris les vidéos et messages
manquants toi-même »), fermeture des deux dettes de contenu notées plus haut
— l'utilisateur a explicitement levé la réserve du PRD §12 pour cette fois.
Vérification faite avec `WebSearch`/`WebFetch`, jamais une URL devinée
(PRD §12, condition 1) :

- `Mobilisation du bassin` : confirmée par le titre exact de sa vidéo déjà
  présente (« STANDING HIP CIRCLES improve hip mobility »), video.statut
  passé de `a_valider` à `ok`.
- `Balancement latéral du buste` : aucun remplaçant fidèle au geste décrit
  (sway relâché) trouvé après plusieurs recherches — toutes les vidéos
  gentiment « side to side » trouvées étaient soit une fente avec transfert
  de poids, soit une danse. Plutôt que de forcer un mauvais raccord,
  l'exercice est **renommé** `Étirement latéral debout` avec une vidéo
  réelle et vérifiée par sa miniature (Cleveland Clinic, geste conforme à
  la nouvelle consigne). `Action: comportement` — id renommé sans risque de
  migration, l'app vient d'être déployée, aucun profil réel n'a encore
  d'historique.
- `data/messages.json` : 4 variantes par famille de pique (contre 1), 6
  encouragements, 6 mots doux — écrits pour rester dans le registre du PRD
  §10.1 (tendre, taquin, jamais culpabilisant).

`./init.sh --check` et `./apps/pilabelle/test.sh` verts après ces
changements.

**Décidé seul, à revoir par vous plus tard : activer malgré deux dettes de
contenu non résolues**, déjà documentées dans `prp/README.md` et l'ossature
§11 — trois vidéos `a_rechercher`/`a_valider` dans `exercices.md`, et
`data/messages.json` qui ne porte qu'un message par famille de pique et par
stock d'encouragements/mots doux. Aucune des deux n'est un défaut de code :
un exercice sans vidéo vérifiée s'affiche sans lecteur (comportement voulu,
PRD §12), et un stock à un seul message ne peut simplement pas varier tant
qu'il n'en contient pas plus. Le PRD réserve explicitement ce contenu à vous
(§12 : « le seul contenu de l'application qui gagne à être écrit par vous
plutôt que déduit du PRD ») — je ne l'ai donc pas inventé à votre place.
`Action: comportement`, pas `arbitrage` : rien ici ne demandait une décision
que je ne pouvais pas prendre, seulement du texte que je ne devais pas
écrire à votre place.

---

Vous avez testé l'app et demandé de réinitialiser votre profil de test.
Je n'ai pas d'accès en écriture en production (`prod.sh` est lecture seule
par construction du routeur) — c'est un des trois arrêts du mode `/livrer`
(effacer des données), donc j'ai posé la question plutôt que de trancher.
Réponse : ajouter un vrai geste de réinitialisation dans l'app, plutôt que
d'agir moi-même côté serveur ou de laisser le profil de test tel quel.

Capacité neuve, documentée dans `PRODUCT.md` (« Ajouté après les PRP »),
dans le même commit que le code (`memory/produit.md`) : `DELETE
/api/profil` efface le profil du compte appelant, et seulement le sien
(`identite()` le garantit déjà pour toute route `/api/*`), idempotent.
Bouton dans les réglages, confirmation native avant d'agir — geste
irréversible.

**Anomalie relevée en écrivant ce commit** : les réglages (PRP 03)
n'avaient en réalité jamais été reliés à un point d'entrée — `vue-
reglages.js` existait, rien n'y menait depuis l'écran du jour. Le PRP 03
l'annonçait à la charge du PRP 04, le PRP 04 ne l'a pas fait, et rien ne
l'a détecté puisque les tests portent sur les routes, jamais sur la
navigation entre écrans. Corrigé dans ce commit avec le bouton de
réinitialisation. `Detecte par: auteur` — `Action: garde-fou` : aucun test
de ce dépôt ne peut aujourd'hui détecter un écran orphelin, silencieux
jusqu'à ce qu'un humain clique dessus.

---

Demande explicite : « retravaille l'ui pour avoir quelque chose de plus
beau et agréable à utiliser » — via `/impeccable`. Polish complet
(confirmé par l'utilisateur sur trois options proposées), direction déjà
fixée par le PRD §11 (kawaii doux, jamais infantilisant) donc non
rediscutée. Palette étendue (rose/lavande/menthe/corail), échelle
typographique, cartes avec ombre portée réelle, focus-visible et
sélection de texte thémés, barre de progression pendant la séance, états
de boutons complets (hover/focus/active/disabled). Police système plutôt
qu'importée — mode Operate, l'app doit rester légère hors ligne capricieuse.
Comportement et routes API inchangés. Détecteur mécanique Impeccable
(`detect.mjs`) lancé une fois sur tous les fichiers touchés : un
avertissement (easing "bounce" tape-à-l'œil sur l'animation de palier),
corrigé, second passage propre.

---

Deux retours d'usage réel après le polish :

1. **« Je ne comprends pas le principe du chronomètre »** — le polish avait
   remplacé le mot « Effort »/« Repos » par une simple différence de
   couleur, illisible et non accessible (daltonisme). `Detecte par:
   utilisateur` — `Action: garde-fou` : rien dans `detect.mjs` ne repère
   un etat porte par la seule couleur ; corrigé (label textuel + emoji
   ajoutés au-dessus du décompte).
2. **« La vidéo Étirement chat-vache ne correspond pas »** — vérifiée à sa
   création par le titre seul (« Cat Cow Stretch... »), qui matchait. La
   miniature, regardée maintenant, montre en réalité une « Compass pose »
   (hanche/ischios) : la vidéo est un enchaînement de plusieurs poses dont
   le titre ne nomme que la première, pas forcément celle vue en premier
   sur le Short. `Detecte par: utilisateur` — `Action: garde-fou` : un
   titre qui matche ne suffit pas à confirmer le contenu d'un Short
   multi-poses ; la miniature reste nécessaire même quand le titre semble
   net. Remplacée par une vidéo Cleveland Clinic dédiée, miniature vérifiée
   conforme.

---

**« Je n'ai pas vu les petits mots d'encouragement »** — c'est pour sa
femme, demande explicite de mots d'amour. Deux causes, une réelle
anomalie et un réglage à resserrer :

- **Bug** : `vue-fin.js` ne montrait ni encouragement ni mot doux sur
  l'écran « séance déjà comptée » — un `return` précoce les jetait alors
  que le serveur les calcule dans les deux cas (`main.go` les pose hors du
  `if/else` sur `deja_compte`). En testant plusieurs fois la même séance
  (normal en test), c'est cet écran qu'on retombe dessus, jamais l'autre.
  `Detecte par: utilisateur` — `Action: garde-fou` : aucun test ne
  couvrait le rendu de `deja_compte` avec un `recap.mot_doux` non vide.
  Corrigé : le mot doux s'affiche maintenant dans les deux cas.
- **Contenu** : `data/messages.json.mots_doux` élargi avec des mots
  ouvertement amoureux (« je t'aime », pas seulement « bravo »), et la
  fréquence de tirage resserrée de 1/3 à 1/2 (`motDouxDeTempsEnTemps`,
  `domaine.go`) — décision seule, PRD §10.1 ne fixe pas de cadence,
  révisable au prochain retour d'usage.

---

Retour sur l'audit d'usage demandé par l'utilisateur après la mise en ligne : les trois
agents dédiés (`artisan`, `greffier`, `analyste`) n'ont quasiment pas servi sur cette
branche — 61 des 814 appels au modèle relevaient d'un sous-agent, tous issus de
`/impeccable` (le polish visuel), aucun de `artisan` ni de `greffier`. Tout le code, les
PRP et les commits ont été écrits et enregistrés par la conversation principale
elle-même.

**Cause** — ni le contrat (`Comment on travaille`) ni `/livrer` ne disaient d'appeler ces
agents : ils sont décrits dans `memory/travail.md` comme des outils disponibles, avec
leurs règles, mais rien dans la boucle de travail effective (« écris le code »,
« git add -A && git commit ») ne renvoyait vers eux. Un outil documenté mais jamais
invoqué dans le chemin normal ne sert à rien.

`Detecte par` — `utilisateur`, après la mise en ligne, en comparant le coût de cette
branche à une autre construite avant que l'outillage n'existe.
`Action` — `contrat` — `CLAUDE.md` (§ Comment on travaille) et `.claude/commands/livrer.md`
(étape 3) disent maintenant explicitement de déléguer le code d'une app à `artisan` et
l'enregistrement git au `greffier`, plutôt que de les faire soi-même.

---

Reprise sur la même branche (PR #107 fusionnée depuis) pour le lot 2 : défi de la
semaine (PRP 06) et écran personnel (PRP 07), en mode `/livrer`, sujet choisi par
l'utilisateur parmi trois options faute de travail en cours dans la conversation.

Le verrou du PRP 06 (contenu et règle de génération du défi, laissé ouvert à
l'écriture initiale) est tranché seul : `PRODUCT.md` §12 borne la réserve de
contenu humain aux piques et aux mots doux (« le **seul** contenu... qui gagne à
être écrit par vous ») — le défi n'en fait pas partie, il se déduit du PRD comme
le dictionnaire d'exercices. Décision et sa justification écrites dans le PRP
lui-même (§ « Le verrou, tranché le 9 août 2026 ») plutôt que recopiées ici :
c'est là qu'un futur lecteur du PRP les cherchera.

Conformément à la correction faite plus haut sur cette branche, le code des deux
PRP est délégué à l'agent `artisan`, l'enregistrement git au `greffier` — la
conversation principale n'écrit que les PRP (dialogue déjà eu, ici avec
moi-même en l'absence de désaccord à arbitrer) et ne touche à aucun fichier de
code de l'app.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-09 à 10:18 UTC, sur 2 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 27 630 | 0,08 $ |
| Écriture de cache | 5 340 492 | 19,70 $ |
| Lecture de cache | 293 768 790 | 87,80 $ |
| Sortie | 91 908 | 1,21 $ |
| **Total** | **299 228 820** | **108,79 $ — 94,48 €** |

**Ce qui coûte**

- **814 appel(s) au modèle** — un par réponse, outils compris —, dont 61 par des sous-agents — 4 928 772 jetons, 2,66 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  66 917 jetons, écrits une fois par session puis relus à chaque
  échange : 50 321 584 jetons de relecture, 17 % de tout ce qui a été relu.
- **Tours courts** — 710 des 814 tours (87 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 90,27 $, soit 82 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 66 917 jetons relus au premier appel qui relise
  quelque chose, 719 230 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 299228820 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-sonnet-5 66917 0 0
2 principal claude-sonnet-5 5622 66917 0
3 principal claude-sonnet-5 2572 72539 0
4 principal claude-sonnet-5 7111 75111 0
5 principal claude-sonnet-5 3016 82222 0
6 principal claude-sonnet-5 1225 85238 0
7 principal claude-sonnet-5 12895 86463 0
8 principal claude-sonnet-5 1012 99358 0
9 principal claude-sonnet-5 1249 100370 0
10 principal claude-sonnet-5 329 101619 0
11 principal claude-sonnet-5 1386 101948 0
12 principal claude-sonnet-5 1562 103334 0
13 principal claude-sonnet-5 1372 104896 0
14 principal claude-sonnet-5 454 106268 0
15 principal claude-sonnet-5 520 106722 0
16 principal claude-sonnet-5 368 107242 0
17 principal claude-sonnet-5 1697 106268 0
18 principal claude-sonnet-5 10286 107965 0
19 principal claude-sonnet-5 5032 118251 0
20 principal claude-sonnet-5 4277 123283 0
21 principal claude-sonnet-5 192 127560 0
22 principal claude-sonnet-5 7585 127752 0
23 principal claude-sonnet-5 1597 135337 0
24 principal claude-sonnet-5 237 136934 0
25 principal claude-sonnet-5 854 137171 0
26 principal claude-sonnet-5 892 138025 0
27 principal claude-sonnet-5 112 138917 0
28 principal claude-sonnet-5 297 139029 0
29 principal claude-sonnet-5 790 139326 0
30 principal claude-sonnet-5 90222 49064 0
31 principal claude-sonnet-5 3604 139286 0
32 principal claude-sonnet-5 9 146464 0
33 principal claude-sonnet-5 10826 146473 0
34 principal claude-sonnet-5 841 157299 0
35 principal claude-sonnet-5 457 158140 0
36 principal claude-sonnet-5 1069 158597 0
37 principal claude-sonnet-5 624 159666 0
38 principal claude-sonnet-5 2409 160290 0
39 principal claude-sonnet-5 732 162699 0
40 principal claude-sonnet-5 388 163431 0
41 principal claude-sonnet-5 346 163819 0
42 principal claude-sonnet-5 391 164165 0
43 principal claude-sonnet-5 753 164556 0
44 principal claude-sonnet-5 377 165309 0
45 principal claude-sonnet-5 10182 165686 0
46 principal claude-sonnet-5 952 175868 0
47 principal claude-sonnet-5 453 176820 0
48 principal claude-sonnet-5 429 177273 0
49 principal claude-sonnet-5 365 177702 0
50 principal claude-sonnet-5 327 178067 0
51 principal claude-sonnet-5 920 178394 0
52 principal claude-sonnet-5 131 179656 0
53 principal claude-sonnet-5 2970 179787 0
54 principal claude-sonnet-5 3385 182757 0
55 principal claude-sonnet-5 533 186142 0
56 principal claude-sonnet-5 468 186675 0
57 principal claude-sonnet-5 836 187143 0
58 principal claude-sonnet-5 469 187979 0
59 principal claude-sonnet-5 1341 188448 0
60 principal claude-sonnet-5 830 189789 0
61 principal claude-sonnet-5 668 190619 0
62 principal claude-sonnet-5 2901 191287 0
63 principal claude-sonnet-5 207 194188 0
64 principal claude-sonnet-5 444 194395 0
65 principal claude-sonnet-5 655 194839 0
66 principal claude-sonnet-5 11 195780 0
67 principal claude-sonnet-5 9 197825 0
68 principal claude-sonnet-5 2019 197834 0
69 principal claude-sonnet-5 680 199853 0
70 principal claude-sonnet-5 1038 200533 0
71 principal claude-sonnet-5 592 201571 0
72 principal claude-sonnet-5 552 202163 0
73 principal claude-sonnet-5 556 202715 0
74 principal claude-sonnet-5 22 203416 0
75 principal claude-sonnet-5 1351 203438 0
76 principal claude-sonnet-5 531 204789 0
77 principal claude-sonnet-5 407 205320 0
78 principal claude-sonnet-5 427 205727 0
79 principal claude-sonnet-5 1541 206239 0
80 principal claude-sonnet-5 43 211788 0
81 principal claude-sonnet-5 164 214481 0
82 principal claude-sonnet-5 7774 214645 0
83 principal claude-sonnet-5 1059 222419 0
84 principal claude-sonnet-5 689 223478 0
85 principal claude-sonnet-5 879 224167 0
86 principal claude-sonnet-5 715 225046 0
87 principal claude-sonnet-5 1069 225761 0
88 principal claude-sonnet-5 7776 226830 0
89 principal claude-sonnet-5 428 234606 0
90 principal claude-sonnet-5 415 235034 0
91 principal claude-sonnet-5 712 235449 0
92 principal claude-sonnet-5 1694 236161 0
93 principal claude-sonnet-5 3940 237855 0
94 principal claude-sonnet-5 20 241922 0
95 principal claude-sonnet-5 627 241942 0
96 principal claude-sonnet-5 331 242569 0
97 principal claude-sonnet-5 465 242900 0
98 principal claude-sonnet-5 582 243365 0
99 principal claude-sonnet-5 591 243947 0
100 principal claude-sonnet-5 4545 244630 0
101 principal claude-sonnet-5 1681 249175 0
102 principal claude-sonnet-5 3564 250856 0
103 principal claude-sonnet-5 6985 254420 0
104 principal claude-sonnet-5 501 261405 0
105 principal claude-sonnet-5 663 261906 0
106 principal claude-sonnet-5 275 262569 0
107 principal claude-sonnet-5 598 262844 0
108 principal claude-sonnet-5 361 263442 0
109 principal claude-sonnet-5 299 263803 0
110 principal claude-sonnet-5 713 264102 0
111 principal claude-sonnet-5 128 265149 0
112 principal claude-sonnet-5 2042 265277 0
113 principal claude-sonnet-5 2624 267319 0
114 principal claude-sonnet-5 4031 269943 0
115 principal claude-sonnet-5 1113 273974 0
116 principal claude-sonnet-5 965 275087 0
117 principal claude-sonnet-5 431 276052 0
118 principal claude-sonnet-5 395 276483 0
119 principal claude-sonnet-5 395 276878 0
120 principal claude-sonnet-5 1163 277273 0
121 principal claude-sonnet-5 465 278436 0
122 principal claude-sonnet-5 404 278901 0
123 principal claude-sonnet-5 630 279305 0
124 principal claude-sonnet-5 536 279935 0
125 principal claude-sonnet-5 741 280471 0
126 principal claude-sonnet-5 232549 49064 0
127 principal claude-sonnet-5 2176 281613 0
128 principal claude-sonnet-5 2849 283789 0
129 principal claude-sonnet-5 5947 286638 0
130 principal claude-sonnet-5 991 292585 0
131 principal claude-sonnet-5 1079 293576 0
132 principal claude-sonnet-5 1037 294655 0
133 principal claude-sonnet-5 734 295692 0
134 principal claude-sonnet-5 387 296426 0
135 principal claude-sonnet-5 388 296813 0
136 principal claude-sonnet-5 519 297201 0
137 principal claude-sonnet-5 670 297720 0
138 principal claude-sonnet-5 2842 298390 0
139 principal claude-sonnet-5 3771 301328 0
140 principal claude-sonnet-5 1810 305099 0
141 principal claude-sonnet-5 1476 306909 0
142 principal claude-sonnet-5 4025 308385 0
143 principal claude-sonnet-5 1143 312410 0
144 principal claude-sonnet-5 904 313553 0
145 principal claude-sonnet-5 2307 314457 0
146 principal claude-sonnet-5 917 316764 0
147 principal claude-sonnet-5 1700 317681 0
148 principal claude-sonnet-5 1623 319381 0
149 principal claude-sonnet-5 1093 321004 0
150 principal claude-sonnet-5 662 322097 0
151 principal claude-sonnet-5 1058 322759 0
152 principal claude-sonnet-5 590 323817 0
153 principal claude-sonnet-5 947 324407 0
154 principal claude-sonnet-5 276920 49064 0
155 principal claude-sonnet-5 1522 325984 0
156 principal claude-sonnet-5 360 327506 0
157 principal claude-sonnet-5 805 327866 0
158 principal claude-sonnet-5 463 328671 0
159 principal claude-sonnet-5 520 329134 0
160 principal claude-sonnet-5 134 329758 0
161 principal claude-sonnet-5 1081 329892 0
162 principal claude-sonnet-5 749 330973 0
163 principal claude-sonnet-5 608 331722 0
164 principal claude-sonnet-5 483 332330 0
165 principal claude-sonnet-5 133 332850 0
166 principal claude-sonnet-5 2586 332983 0
167 principal claude-sonnet-5 126 335835 0
168 principal claude-sonnet-5 4384 336184 0
169 principal claude-sonnet-5 1977 340568 0
170 principal claude-sonnet-5 557 342545 0
171 principal claude-sonnet-5 1255 343102 0
172 principal claude-sonnet-5 1473 344357 0
173 principal claude-sonnet-5 802 345830 0
174 principal claude-sonnet-5 871 346632 0
175 principal claude-sonnet-5 1383 347503 0
176 principal claude-sonnet-5 793 348886 0
177 principal claude-sonnet-5 1047 349679 0
178 principal claude-sonnet-5 1449 350726 0
179 principal claude-sonnet-5 316 352175 0
180 principal claude-sonnet-5 301 352491 0
181 principal claude-sonnet-5 495 352792 0
182 principal claude-sonnet-5 557 353287 0
183 principal claude-sonnet-5 533 353844 0
184 principal claude-sonnet-5 1056 354377 0
185 principal claude-sonnet-5 122 355887 0
186 principal claude-sonnet-5 2685 356009 0
187 principal claude-sonnet-5 181 358694 0
188 principal claude-sonnet-5 2367 358875 0
189 principal claude-sonnet-5 639 361590 0
190 principal claude-sonnet-5 962 362229 0
191 principal claude-sonnet-5 18576 49063 0
192 principal claude-sonnet-5 388 67639 0
193 principal claude-sonnet-5 4448 68027 0
194 principal claude-sonnet-5 11210 72475 0
195 principal claude-sonnet-5 821 83685 0
196 principal claude-sonnet-5 2735 84506 0
197 principal claude-sonnet-5 2233 87241 0
198 principal claude-sonnet-5 871 89474 0
199 principal claude-sonnet-5 2452 90345 0
200 principal claude-sonnet-5 14883 92797 0
201 principal claude-sonnet-5 5207 107680 0
202 principal claude-sonnet-5 6751 112887 0
203 principal claude-sonnet-5 3942 119638 0
204 principal claude-sonnet-5 3752 123580 0
205 principal claude-sonnet-5 2066 127332 0
206 principal claude-sonnet-5 9988 129398 0
207 principal claude-sonnet-5 7399 139386 0
208 principal claude-sonnet-5 499 146785 0
209 principal claude-sonnet-5 232 147284 0
210 principal claude-sonnet-5 8352 147516 0
211 principal claude-sonnet-5 548 155868 0
212 principal claude-sonnet-5 2381 156416 0
213 principal claude-sonnet-5 13087 158797 0
214 principal claude-sonnet-5 4469 171884 0
215 principal claude-sonnet-5 5241 176353 0
216 principal claude-sonnet-5 16192 181594 0
217 principal claude-sonnet-5 6153 197786 0
218 principal claude-sonnet-5 8987 203939 0
219 principal claude-sonnet-5 5770 212926 0
220 principal claude-sonnet-5 3620 218696 0
221 principal claude-sonnet-5 1669 222316 0
222 principal claude-sonnet-5 2173 223985 0
223 principal claude-sonnet-5 1270 226158 0
224 principal claude-sonnet-5 285 227428 0
225 principal claude-sonnet-5 820 227713 0
226 principal claude-sonnet-5 1021 228533 0
227 principal claude-sonnet-5 315 229554 0
228 principal claude-sonnet-5 1261 229869 0
229 principal claude-sonnet-5 413 231130 0
230 principal claude-sonnet-5 149 231543 0
231 principal claude-sonnet-5 406 231692 0
232 principal claude-sonnet-5 1254 232098 0
233 principal claude-sonnet-5 360 233352 0
234 principal claude-sonnet-5 1508 233712 0
235 principal claude-sonnet-5 1881 235220 0
236 principal claude-sonnet-5 1316 237101 0
237 principal claude-sonnet-5 613 238417 0
238 principal claude-sonnet-5 518 239030 0
239 principal claude-sonnet-5 1675 239548 0
240 principal claude-sonnet-5 333 241223 0
241 principal claude-sonnet-5 865 241918 0
242 principal claude-sonnet-5 2960 242783 0
243 principal claude-sonnet-5 944 245743 0
244 principal claude-sonnet-5 260 246777 0
245 principal claude-sonnet-5 3252 247037 0
246 principal claude-sonnet-5 2759 250289 0
247 principal claude-sonnet-5 2482 253048 0
248 principal claude-sonnet-5 1534 255530 0
249 principal claude-sonnet-5 2393 257064 0
250 principal claude-sonnet-5 1198 259457 0
251 principal claude-sonnet-5 512 260655 0
252 principal claude-sonnet-5 954 261167 0
253 principal claude-sonnet-5 740 262121 0
254 principal claude-sonnet-5 2695 262861 0
255 principal claude-sonnet-5 207 265556 0
256 principal claude-sonnet-5 219 265763 0
257 principal claude-sonnet-5 192 265982 0
258 principal claude-sonnet-5 168 266174 0
259 principal claude-sonnet-5 156 266342 0
260 principal claude-sonnet-5 160 266498 0
261 principal claude-sonnet-5 116 266658 0
262 principal claude-sonnet-5 1012 266774 0
263 principal claude-sonnet-5 1699 267786 0
264 principal claude-sonnet-5 286 269485 0
265 principal claude-sonnet-5 1072 269771 0
266 principal claude-sonnet-5 525 270843 0
267 principal claude-sonnet-5 509 271368 0
268 principal claude-sonnet-5 147 271877 0
269 principal claude-sonnet-5 523 272024 0
270 principal claude-sonnet-5 432 272547 0
271 principal claude-sonnet-5 2326 272979 0
272 principal claude-sonnet-5 433 275305 0
273 principal claude-sonnet-5 374 275738 0
274 principal claude-sonnet-5 1075 276112 0
275 principal claude-sonnet-5 449 277187 0
276 principal claude-sonnet-5 464 277636 0
277 principal claude-sonnet-5 222 278100 0
278 principal claude-sonnet-5 1334 278322 0
279 principal claude-sonnet-5 868 279656 0
280 principal claude-sonnet-5 495 280524 0
281 principal claude-sonnet-5 131 281019 0
282 principal claude-sonnet-5 1505 281150 0
283 principal claude-sonnet-5 568 282655 0
284 principal claude-sonnet-5 2167 283223 0
285 principal claude-sonnet-5 1088 285390 0
286 principal claude-sonnet-5 508 286478 0
287 principal claude-sonnet-5 502 286986 0
288 principal claude-sonnet-5 220 287488 0
289 principal claude-sonnet-5 411 287708 0
290 principal claude-sonnet-5 971 288119 0
291 principal claude-sonnet-5 133 289090 0
292 principal claude-sonnet-5 90 289223 0
293 principal claude-sonnet-5 17042 289313 0
294 principal claude-sonnet-5 547 306355 0
295 principal claude-sonnet-5 5637 306902 0
296 principal claude-sonnet-5 3383 312539 0
297 principal claude-sonnet-5 2093 315922 0
298 principal claude-sonnet-5 174 318015 0
299 principal claude-sonnet-5 116 318189 0
300 principal claude-sonnet-5 420 318305 0
301 principal claude-sonnet-5 722 318725 0
302 principal claude-sonnet-5 786 319447 0
303 principal claude-sonnet-5 1228 320233 0
304 principal claude-sonnet-5 5108 321461 0
305 principal claude-sonnet-5 388 326569 0
306 principal claude-sonnet-5 1465 326957 0
307 principal claude-sonnet-5 856 328422 0
308 principal claude-sonnet-5 356 329278 0
309 principal claude-sonnet-5 283 329634 0
310 principal claude-sonnet-5 922 329917 0
311 principal claude-sonnet-5 123 330839 0
312 principal claude-sonnet-5 90 330962 0
313 principal claude-sonnet-5 884 331052 0
314 principal claude-sonnet-5 1231 331936 0
315 principal claude-sonnet-5 2033 333167 0
316 principal claude-sonnet-5 1735 335200 0
317 principal claude-sonnet-5 760 336935 0
318 principal claude-sonnet-5 2047 337695 0
319 principal claude-sonnet-5 2306 339742 0
320 principal claude-sonnet-5 757 342048 0
321 principal claude-sonnet-5 347 342805 0
322 principal claude-sonnet-5 403 343152 0
323 principal claude-sonnet-5 632 343555 0
324 principal claude-sonnet-5 1168 344187 0
325 principal claude-sonnet-5 1347 345355 0
326 principal claude-sonnet-5 963 346702 0
327 principal claude-sonnet-5 544 347665 0
328 principal claude-sonnet-5 2043 348209 0
329 principal claude-sonnet-5 487 350252 0
330 principal claude-sonnet-5 4772 350739 0
331 principal claude-sonnet-5 1326 355511 0
332 principal claude-sonnet-5 495 356837 0
333 principal claude-sonnet-5 376 357332 0
334 principal claude-sonnet-5 382 357708 0
335 principal claude-sonnet-5 1029 358090 0
336 principal claude-sonnet-5 118 359119 0
337 principal claude-sonnet-5 90 359237 0
338 principal claude-sonnet-5 502 359327 0
339 principal claude-sonnet-5 154 359829 0
340 principal claude-sonnet-5 1486 359983 0
341 principal claude-sonnet-5 3296 361469 0
342 principal claude-sonnet-5 520 364765 0
343 principal claude-sonnet-5 597 365285 0
344 principal claude-sonnet-5 1646 365882 0
345 principal claude-sonnet-5 873 367528 0
346 principal claude-sonnet-5 3219 368401 0
347 principal claude-sonnet-5 748 371620 0
348 principal claude-sonnet-5 466 372368 0
349 principal claude-sonnet-5 380 372834 0
350 principal claude-sonnet-5 1776 373214 0
351 principal claude-sonnet-5 527 374990 0
352 principal claude-sonnet-5 1399 375517 0
353 principal claude-sonnet-5 1051 376916 0
354 principal claude-sonnet-5 1618 377967 0
355 principal claude-sonnet-5 986 379585 0
356 principal claude-sonnet-5 1015 380571 0
357 principal claude-sonnet-5 1250 381586 0
358 principal claude-sonnet-5 719 382836 0
359 principal claude-sonnet-5 532 383555 0
360 principal claude-sonnet-5 692 384087 0
361 principal claude-sonnet-5 250 384779 0
362 principal claude-sonnet-5 354 385029 0
363 principal claude-sonnet-5 506 385383 0
364 principal claude-sonnet-5 306 385889 0
365 principal claude-sonnet-5 569 386195 0
366 principal claude-sonnet-5 386 386764 0
367 principal claude-sonnet-5 1195 387150 0
368 principal claude-sonnet-5 748 388345 0
369 principal claude-sonnet-5 892 389093 0
370 principal claude-sonnet-5 1228 389985 0
371 principal claude-sonnet-5 534 391213 0
372 principal claude-sonnet-5 1002 391747 0
373 principal claude-sonnet-5 608 392749 0
374 principal claude-sonnet-5 396 393357 0
375 principal claude-sonnet-5 640 393753 0
376 principal claude-sonnet-5 274 394393 0
377 principal claude-sonnet-5 581 394667 0
378 principal claude-sonnet-5 435 395248 0
379 principal claude-sonnet-5 1422 395683 0
380 principal claude-sonnet-5 512 397105 0
381 principal claude-sonnet-5 493 397617 0
382 principal claude-sonnet-5 397 398110 0
383 principal claude-sonnet-5 1673 398507 0
384 principal claude-sonnet-5 133 400180 0
385 principal claude-sonnet-5 90 400313 0
386 principal claude-sonnet-5 426 400403 0
387 principal claude-sonnet-5 909 400829 0
388 principal claude-sonnet-5 961 401738 0
389 principal claude-sonnet-5 868 402699 0
390 principal claude-sonnet-5 277 403567 0
391 principal claude-sonnet-5 1919 403844 0
392 principal claude-sonnet-5 640 405763 0
393 principal claude-sonnet-5 474 406403 0
394 principal claude-sonnet-5 519 406877 0
395 principal claude-sonnet-5 144 407396 0
396 principal claude-sonnet-5 480 407540 0
397 principal claude-sonnet-5 2976 408020 0
398 principal claude-sonnet-5 2257 410996 0
399 principal claude-sonnet-5 678 413253 0
400 principal claude-sonnet-5 518 413931 0
401 principal claude-sonnet-5 644 414449 0
402 principal claude-sonnet-5 1474 415093 0
403 principal claude-sonnet-5 714 416567 0
404 principal claude-sonnet-5 358 417281 0
405 principal claude-sonnet-5 910 417639 0
406 principal claude-sonnet-5 395 418549 0
407 principal claude-sonnet-5 530 418944 0
408 principal claude-sonnet-5 625 419474 0
409 principal claude-sonnet-5 304 420099 0
410 principal claude-sonnet-5 895 420403 0
411 principal claude-sonnet-5 148 421298 0
412 principal claude-sonnet-5 8644 421446 0
413 principal claude-sonnet-5 1323 430090 0
414 principal claude-sonnet-5 855 431413 0
415 principal claude-sonnet-5 526 432268 0
416 principal claude-sonnet-5 908 432794 0
417 principal claude-sonnet-5 525 433702 0
418 principal claude-sonnet-5 252 434227 0
419 principal claude-sonnet-5 192 434479 0
420 principal claude-sonnet-5 1099 434671 0
421 principal claude-sonnet-5 379 435770 0
422 principal claude-sonnet-5 415 436149 0
423 principal claude-sonnet-5 611 436564 0
424 principal claude-sonnet-5 981 437175 0
425 principal claude-sonnet-5 332 438156 0
426 principal claude-sonnet-5 142 438488 0
427 principal claude-sonnet-5 429 438630 0
428 principal claude-sonnet-5 1846 439059 0
429 principal claude-sonnet-5 668 440905 0
430 principal claude-sonnet-5 191 441573 0
431 principal claude-sonnet-5 612 441764 0
432 principal claude-sonnet-5 414 442376 0
433 principal claude-sonnet-5 2232 442790 0
434 principal claude-sonnet-5 1967 445022 0
435 principal claude-sonnet-5 435 446989 0
436 principal claude-sonnet-5 5130 447424 0
437 principal claude-sonnet-5 242 452554 0
438 principal claude-sonnet-5 486 452796 0
439 principal claude-sonnet-5 551 453282 0
440 principal claude-sonnet-5 709 453833 0
441 principal claude-sonnet-5 1613 454542 0
442 principal claude-sonnet-5 1207 456155 0
443 principal claude-sonnet-5 436 457362 0
444 principal claude-sonnet-5 519 457798 0
445 principal claude-sonnet-5 173 458317 0
446 principal claude-sonnet-5 1791 458490 0
447 principal claude-sonnet-5 3180 460281 0
448 principal claude-sonnet-5 981 463461 0
449 principal claude-sonnet-5 1427 464442 0
450 principal claude-sonnet-5 812 465869 0
451 principal claude-sonnet-5 545 466681 0
452 principal claude-sonnet-5 371 467226 0
453 principal claude-sonnet-5 943 467597 0
454 principal claude-sonnet-5 515 468540 0
455 principal claude-sonnet-5 1843 469055 0
456 principal claude-sonnet-5 535 470898 0
457 principal claude-sonnet-5 1245 471433 0
458 principal claude-sonnet-5 424522 49063 0
459 principal claude-sonnet-5 980 473585 0
460 principal claude-sonnet-5 256 474565 0
461 principal claude-sonnet-5 962 474821 0
462 principal claude-sonnet-5 819 475817 0
463 principal claude-sonnet-5 925 476636 0
464 principal claude-sonnet-5 274 477561 0
465 principal claude-sonnet-5 1366 477864 0
466 principal claude-sonnet-5 982 479230 0
467 principal claude-sonnet-5 646 480236 0
468 principal claude-sonnet-5 913 480882 0
469 principal claude-sonnet-5 674 481795 0
470 principal claude-sonnet-5 181 482469 0
471 principal claude-sonnet-5 261 482650 0
472 principal claude-sonnet-5 700 482946 0
473 principal claude-sonnet-5 993 483646 0
474 principal claude-sonnet-5 6358 484639 0
475 principal claude-sonnet-5 279 490997 0
476 principal claude-sonnet-5 597 491276 0
477 principal claude-sonnet-5 1095 491873 0
478 principal claude-sonnet-5 1065 492968 0
479 principal claude-sonnet-5 174 494033 0
480 principal claude-sonnet-5 593 494207 0
481 principal claude-sonnet-5 998 494800 0
482 principal claude-sonnet-5 644 495816 0
483 principal claude-sonnet-5 701 496460 0
484 principal claude-sonnet-5 402 497161 0
485 principal claude-sonnet-5 4290 497563 0
486 principal claude-sonnet-5 325 501853 0
487 principal claude-sonnet-5 1077 502201 0
488 principal claude-sonnet-5 448 503278 0
489 principal claude-sonnet-5 1571 503726 0
490 principal claude-sonnet-5 5685 505297 0
491 principal claude-sonnet-5 321 510982 0
492 principal claude-sonnet-5 362 511303 0
493 principal claude-sonnet-5 311 511665 0
494 principal claude-sonnet-5 607 511976 0
495 principal claude-sonnet-5 1282 512583 0
496 principal claude-sonnet-5 580 513865 0
497 principal claude-sonnet-5 1019 514494 0
498 principal claude-sonnet-5 482 515513 0
499 principal claude-sonnet-5 378 515995 0
500 principal claude-sonnet-5 432 516389 0
501 principal claude-sonnet-5 414 516821 0
502 principal claude-sonnet-5 1631 517235 0
503 principal claude-sonnet-5 911 518866 0
504 principal claude-sonnet-5 6245 519777 0
505 principal claude-sonnet-5 599 526022 0
506 principal claude-sonnet-5 537 526663 0
507 principal claude-sonnet-5 411 527200 0
508 principal claude-sonnet-5 264 527611 0
509 principal claude-sonnet-5 928 527875 0
510 principal claude-sonnet-5 3104 528803 0
511 principal claude-sonnet-5 619 531907 0
512 principal claude-sonnet-5 532404 0 2029
513 principal claude-sonnet-5 2043 532404 155
514 principal claude-sonnet-5 376 534447 65
515 principal claude-sonnet-5 184 534823 101
516 principal claude-sonnet-5 1580 535007 551
517 principal claude-sonnet-5 666 536587 342
518 principal claude-sonnet-5 1436 537253 242
519 principal claude-sonnet-5 1440 538689 563
520 principal claude-sonnet-5 802 540129 245
521 principal claude-sonnet-5 339 540931 60
522 principal claude-sonnet-5 408 541270 338
523 principal claude-sonnet-5 431 541678 118
524 principal claude-sonnet-5 143 542109 60
525 principal claude-sonnet-5 408 542252 580
526 principal claude-sonnet-5 1688 542660 3332
527 principal claude-sonnet-5 3796 544348 251
528 principal claude-sonnet-5 312 548144 630
529 principal claude-sonnet-5 691 548456 897
530 principal claude-sonnet-5 1099 549147 185
531 principal claude-sonnet-5 733 550246 115
532 principal claude-sonnet-5 1062 550979 590
533 principal claude-sonnet-5 670 552041 210
534 principal claude-sonnet-5 1250 552711 379
535 principal claude-sonnet-5 435 553961 435
536 principal claude-sonnet-5 491 554396 186
537 principal claude-sonnet-5 980 554887 410
538 principal claude-sonnet-5 602 555867 135
539 principal claude-sonnet-5 419 556469 128
540 principal claude-sonnet-5 501 556888 296
541 principal claude-sonnet-5 1051 557389 436
542 principal claude-sonnet-5 1088 558440 1505
543 principal claude-sonnet-5 1586 559528 234
544 principal claude-sonnet-5 343 561114 149
545 principal claude-sonnet-5 576 561457 857
546 principal claude-sonnet-5 1077 562033 88
547 principal claude-sonnet-5 367 563110 92
548 principal claude-sonnet-5 4332 563477 78
549 principal claude-sonnet-5 193 567809 592
550 principal claude-opus-4-7 33314 0 159
551 principal claude-sonnet-5 910 568002 970
552 principal claude-opus-4-7 209 33314 98
553 principal claude-opus-4-7 219 33523 112
554 principal claude-sonnet-5 1501 568912 110
555 principal claude-sonnet-5 233 570413 15
556 principal claude-opus-4-7 231 33742 114
557 principal claude-opus-4-7 2811 33973 88
558 principal claude-opus-4-7 963 36784 358
559 principal claude-opus-4-7 618 37747 173
560 principal claude-opus-4-7 1308 38365 109
561 principal claude-opus-4-7 212 39673 173
562 principal claude-opus-4-7 487 39885 624
563 principal claude-sonnet-5 521953 49064 1785
564 principal claude-sonnet-5 1954 571017 1207
565 principal claude-sonnet-5 1938 572971 581
566 principal claude-sonnet-5 637 574909 183
567 principal claude-sonnet-5 1538 575546 810
568 principal claude-sonnet-5 842 577084 119
569 principal claude-sonnet-5 796 577926 503
570 principal claude-sonnet-5 557 578722 107
571 principal claude-sonnet-5 505 579279 181
572 principal claude-sonnet-5 233 579784 77
573 principal claude-sonnet-5 359 580017 1094
574 principal claude-sonnet-5 1238 580376 93
575 principal claude-sonnet-5 165 581614 244
576 principal claude-sonnet-5 300 581779 116
577 principal claude-sonnet-5 299 582079 113
578 principal claude-sonnet-5 761 582378 352
579 principal claude-sonnet-5 408 583139 79
580 principal claude-sonnet-5 276 583547 209
581 principal claude-sonnet-5 317 583823 1206
582 principal claude-sonnet-5 1267 584140 97
583 principal claude-sonnet-5 1003 585407 1356
584 principal claude-sonnet-5 1416 586410 75
585 principal claude-sonnet-5 642 587826 619
586 principal claude-sonnet-5 675 588468 117
587 principal claude-sonnet-5 221 589143 417
588 principal claude-sonnet-5 579 589364 220
589 principal claude-sonnet-5 733 589943 856
590 principal claude-sonnet-5 915 590676 86
591 principal claude-sonnet-5 131 591591 250
592 principal claude-sonnet-5 449 591722 127
593 principal claude-sonnet-5 311 592171 106
594 principal claude-sonnet-5 125 592482 113
595 principal claude-sonnet-5 228 592607 638
596 principal claude-sonnet-5 698 592835 95
597 principal claude-sonnet-5 129 593533 80
598 principal claude-sonnet-5 487 593662 252
599 principal claude-sonnet-5 598 594149 133
600 principal claude-sonnet-5 246 594747 129
601 principal claude-sonnet-5 169 594993 134
602 principal claude-sonnet-5 286 595162 921
603 principal claude-sonnet-5 996 595448 202
604 principal claude-sonnet-5 481 596444 67
605 principal claude-sonnet-5 4102 596925 176
606 principal claude-sonnet-5 567 601027 499
607 principal claude-sonnet-5 715 601594 273
608 principal claude-opus-4-7 6991 28233 200
609 principal claude-opus-4-7 316 35224 117
610 principal claude-opus-4-7 172 35540 77
611 principal claude-opus-4-7 180 35712 153
612 principal claude-sonnet-5 542 602309 888
613 principal claude-sonnet-5 929 602851 87
614 principal claude-sonnet-5 206 603780 20
615 principal claude-sonnet-5 557626 49064 208
616 principal claude-sonnet-5 828 606690 155
617 principal claude-sonnet-5 415 607518 18
618 principal claude-opus-4-7 7269 35892 2823
619 principal claude-opus-4-7 6157 43161 1886
620 principal claude-sonnet-5 1112 607951 137
621 principal claude-sonnet-5 1097 609063 164
622 principal claude-sonnet-5 205 610160 137
623 principal claude-sonnet-5 595 610365 121
624 principal claude-sonnet-5 537 610960 35
625 principal claude-sonnet-5 1122 611532 121
626 principal claude-sonnet-5 442 612654 483
627 principal claude-sonnet-5 749 613096 14
628 principal claude-sonnet-5 1237 613859 66
629 principal claude-sonnet-5 410 615096 134
630 principal claude-sonnet-5 164 615506 178
631 principal claude-sonnet-5 198 615670 310
632 principal claude-sonnet-5 1544 615868 23
633 principal claude-sonnet-5 3766 617435 420
634 principal claude-sonnet-5 776 621201 244
635 principal claude-sonnet-5 4343 621977 163
636 principal claude-sonnet-5 3479 626320 2661
637 principal claude-sonnet-5 2764 629799 138
638 principal claude-sonnet-5 1524 632563 304
639 principal claude-sonnet-5 1736 634087 518
640 principal claude-sonnet-5 6305 635823 6377
641 principal claude-sonnet-5 6698 642128 163
642 principal claude-sonnet-5 340 648826 516
643 principal claude-sonnet-5 669 649166 1345
644 principal claude-sonnet-5 1405 649835 1482
645 principal claude-sonnet-5 1542 651240 647
646 principal claude-sonnet-5 707 652782 958
647 principal claude-sonnet-5 1165 653489 323
648 principal claude-sonnet-5 383 654654 380
649 principal claude-sonnet-5 2022 655037 790
650 principal claude-sonnet-5 853 657059 256
651 principal claude-sonnet-5 488 657912 120
652 principal claude-sonnet-5 391 658400 232
653 principal claude-sonnet-5 295 658791 935
654 principal claude-sonnet-5 996 659086 406
655 principal claude-sonnet-5 545 660082 296
656 principal claude-sonnet-5 498 660627 277
657 principal claude-sonnet-5 502 661125 115
658 principal claude-sonnet-5 287 661627 437
659 principal claude-sonnet-5 599 661914 296
660 principal claude-sonnet-5 291 662513 133
661 principal claude-sonnet-5 196 662804 101
662 principal claude-sonnet-5 437 663000 173
663 principal claude-sonnet-5 213 663437 134
664 principal claude-sonnet-5 338 663650 702
665 principal claude-sonnet-5 946 663988 101
666 principal claude-sonnet-5 4104 664934 137
667 principal claude-sonnet-5 423 669038 611
668 principal claude-opus-4-7 9100 28233 126
669 principal claude-sonnet-5 928 669461 844
670 principal claude-opus-4-7 210 37333 80
671 principal claude-opus-4-7 296 37543 91
672 principal claude-opus-4-7 1565 37839 87
673 principal claude-sonnet-5 1375 670389 102
674 principal claude-opus-4-7 401 39404 94
675 principal claude-sonnet-5 219 671764 10
676 principal claude-opus-4-7 1832 39805 91
677 principal claude-sonnet-5 625612 49064 156
678 principal claude-sonnet-5 787 674676 102
679 principal claude-sonnet-5 221 675463 30
680 principal claude-opus-4-7 993 41637 91
681 principal claude-opus-4-7 1344 42630 92
682 principal claude-opus-4-7 950 43974 93
683 principal claude-opus-4-7 639 44924 94
684 principal claude-opus-4-7 556 45563 1310
685 principal claude-sonnet-5 1118 675714 137
686 principal claude-sonnet-5 1097 676832 141
687 principal claude-sonnet-5 182 677929 137
688 principal claude-sonnet-5 967 678111 113
689 principal claude-sonnet-5 529 679078 23
690 principal claude-sonnet-5 1288 679630 66
691 principal claude-sonnet-5 354 680918 109
692 principal claude-sonnet-5 139 681272 129
693 principal claude-sonnet-5 317 681540 1090
694 principal claude-sonnet-5 1333 681857 510
695 principal claude-sonnet-5 688 683190 119
696 principal claude-sonnet-5 660 683878 1105
697 principal claude-sonnet-5 1165 684538 174
698 principal claude-sonnet-5 1929 685703 217
699 principal claude-sonnet-5 277 687632 107
700 principal claude-sonnet-5 132 687909 115
701 principal claude-sonnet-5 262 688041 436
702 principal claude-sonnet-5 598 688303 133
703 principal claude-sonnet-5 183 688901 146
704 principal claude-sonnet-5 153 689084 100
705 principal claude-sonnet-5 596 689237 174
706 principal claude-sonnet-5 402 689833 136
707 principal claude-sonnet-5 254 690235 308
708 principal claude-sonnet-5 333 690489 60
709 principal claude-sonnet-5 408 690822 355
710 principal claude-sonnet-5 1485 691230 118
711 principal claude-sonnet-5 1445 692715 232
712 principal claude-sonnet-5 330 694160 151
713 principal claude-sonnet-5 345 694490 60
714 principal claude-sonnet-5 408 694835 340
715 principal claude-sonnet-5 401 695243 108
716 principal claude-sonnet-5 238 695644 375
717 principal claude-sonnet-5 431 695882 343
718 principal claude-sonnet-5 396 696313 126
719 principal claude-sonnet-5 166 696709 134
720 principal claude-sonnet-5 485 696875 724
721 principal claude-sonnet-5 799 697360 101
722 principal claude-sonnet-5 4114 698159 161
723 principal claude-sonnet-5 306 702273 522
724 principal claude-opus-4-7 4261 28233 173
725 principal claude-sonnet-5 842 702579 707
726 principal claude-opus-4-7 1771 32494 146
727 principal claude-sonnet-5 1238 703421 102
728 principal claude-sonnet-5 223 704659 163
729 principal claude-opus-4-7 460 34265 1219
730 principal claude-opus-4-7 1255 34725 69
731 principal claude-sonnet-5 657210 49064 137
732 principal claude-sonnet-5 1266 706274 141
733 principal claude-sonnet-5 182 707540 137
734 principal claude-sonnet-5 598 707722 101
735 principal claude-sonnet-5 519 708320 17
736 principal claude-sonnet-5 1125 708856 116
737 principal claude-sonnet-5 152 709981 59
738 principal claude-sonnet-5 648 710192 792
739 principal claude-sonnet-5 1581 710840 739
740 principal claude-sonnet-5 965 712421 110
741 principal claude-sonnet-5 182 713386 115
742 principal claude-sonnet-5 324 713568 549
743 principal claude-sonnet-5 605 713892 177
744 principal claude-sonnet-5 230 714497 724
745 principal claude-sonnet-5 953 714727 282
746 principal claude-sonnet-5 1177 715680 1015
747 principal claude-sonnet-5 1244 716857 198
748 principal claude-sonnet-5 227 718101 132
749 principal claude-sonnet-5 139 718328 88
750 principal claude-sonnet-5 296 718467 114
751 principal claude-sonnet-5 154 718763 134
752 principal claude-sonnet-5 313 718917 742
753 principal claude-sonnet-5 817 719230 88
754 agent claude-sonnet-5 39896 0 6
755 agent claude-sonnet-5 2800 39896 4
756 agent claude-sonnet-5 1408 42696 5
757 agent claude-sonnet-5 4504 44104 2
758 agent claude-sonnet-5 386 48608 2
759 agent claude-sonnet-5 511 48994 2
760 agent claude-sonnet-5 1615 49505 2
761 agent claude-sonnet-5 5447 51120 2
762 agent claude-sonnet-5 4092 56567 2
763 agent claude-sonnet-5 4190 60659 4
764 agent claude-sonnet-5 728 64849 3
765 agent claude-sonnet-5 5362 65577 3
766 agent claude-sonnet-5 2281 70939 2
767 agent claude-sonnet-5 1603 73220 2
768 agent claude-sonnet-5 387 74823 3
769 agent claude-sonnet-5 5805 75210 3
770 agent claude-sonnet-5 1094 81015 2
771 agent claude-sonnet-5 5244 82109 2
772 agent claude-sonnet-5 2853 87353 2
773 agent claude-sonnet-5 2059 90206 4
774 agent claude-sonnet-5 1554 92265 2
775 agent claude-sonnet-5 1508 93819 2
776 agent claude-sonnet-5 292 95327 3
777 agent claude-sonnet-5 4179 95619 3
778 agent claude-sonnet-5 2220 99798 1
779 agent claude-sonnet-5 4053 102018 9
780 agent claude-sonnet-5 2967 106071 2
781 agent claude-sonnet-5 497 109038 3
782 agent claude-sonnet-5 3988 109535 3
783 agent claude-sonnet-5 2330 113523 1
784 agent claude-sonnet-5 2800 115853 3
785 agent claude-sonnet-5 3169 118653 2
786 agent claude-sonnet-5 1854 121822 2
787 agent claude-sonnet-5 262 123676 3
788 agent claude-sonnet-5 727 123938 2
789 agent claude-sonnet-5 2710 124665 2
790 agent claude-sonnet-5 39900 0 6
791 agent claude-sonnet-5 2795 39900 4
792 agent claude-sonnet-5 6232 42695 5
793 agent claude-sonnet-5 3933 48927 8
794 agent claude-sonnet-5 4001 52860 5
795 agent claude-sonnet-5 5838 56861 6
796 agent claude-sonnet-5 5890 62699 2
797 agent claude-sonnet-5 4079 68589 2
798 agent claude-sonnet-5 2110 72668 3
799 agent claude-sonnet-5 5049 74778 3
800 agent claude-sonnet-5 7213 79827 5
801 agent claude-sonnet-5 6843 87040 2
802 agent claude-sonnet-5 6254 93883 4
803 agent claude-sonnet-5 1600 100137 2
804 agent claude-sonnet-5 3009 101737 2
805 agent claude-sonnet-5 3206 104746 2
806 agent claude-sonnet-5 41779 0 3
807 agent claude-sonnet-5 14744 41779 2
808 agent claude-sonnet-5 9232 56523 4
809 agent claude-sonnet-5 5635 65755 3
810 agent claude-sonnet-5 590 71390 2
811 agent claude-sonnet-5 3006 71980 5
812 agent claude-sonnet-5 2833 74986 2
813 agent claude-sonnet-5 4641 77819 5
814 agent claude-sonnet-5 5501 82460 2
-->
<!-- /cout -->

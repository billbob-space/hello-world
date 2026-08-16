# Plan d'amélioration de la fabrique

Ce plan sort de l'instruction de cinq axes (sessions, démarrage, garde-fous, cadrage, boucle
de construction) menée après la fabrication de `renaissance-gym` — 266 $ / 559 M jetons en
2 jours, 2433 appels, 29 anomalies, dont 77 % de la facture en relecture de contexte — puis de
la critique de chacun de ces axes contre le dépôt lui-même. Chaque geste ci-dessous vise un
fichier existant, repose sur une mesure prise dans le dépôt, et est classé par rentabilité :
gain divisé par coût de mise en place. Les propositions dont la critique a montré la mesure
fausse ou la cible erronée sont en fin de document, section « Écarté, et pourquoi ».

## État : les seize gestes sont appliqués

Écrits sur la branche `claude/gym-app-retrospective-hpjfl4`, en six commits, dans l'ordre
d'exécution ci-dessous. Le plan est conservé tel qu'il a été arbitré — ce qu'il annonçait et ce
qui a été fait doivent pouvoir se comparer. Deux écarts, tous deux consignés au journal de la
branche : la mesure du geste 16 a été corrigée (27,4 $ mesurés à la main était faux d'un facteur
2,5 ; le chiffre juste est celui du script), et le geste 14 a révélé que l'alerte de contexte ne
se déclenchait que sur une branche ayant déjà une entrée de journal — corrigé dans le même geste.

Trois contrôles neufs avertissent aujourd'hui sur le dépôt tel qu'il est : `marcq-handball`,
`pilabelle` et `renaissance-gym` exposent l'attribut `hidden` à un écrasement de `display`
(geste 13). Ce sont des travaux d'app, hors de ce plan.

## La table des gestes

| # | Geste | Gain | Coût | Fichier |
|---|---|---|---|---|
| 1 | Chiffrer le seuil de coupure de session et dire comment on reprend | 50 à 70 $ par fabrication comparable | 3 lignes de texte | `memory/travail.md` |
| 2 | Dimensionner un chantier d'artisan : un seul PRP, sous 100 000 jetons | ~30 $ mesurés, sur un poste de 113 $ | 8 + 3 lignes de texte | `.claude/agents/artisan.md`, `memory/travail.md` |
| 3 | Couper les 4 connecteurs de compte jamais utilisés, et le documenter | part des 39,7 M jetons de relecture de démarrage | 15 lignes + un réglage hors dépôt | `memory/outillage.md`, `CLAUDE.md` |
| 4 | L'artisan vérifie une vue par les chiffres, pas par l'image | une phase de finition entière (4 commits) | 20 + 10 lignes de texte | `.claude/agents/artisan.md`, `memory/outillage.md` |
| 5 | Un déploiement par lot cohérent, pas un par correctif | 7 déploiements de 2-3 min ramenés à 2 ou 3 | 5 lignes de texte | `memory/travail.md` |
| 6 | `--check` voit aussi les fichiers `.md` neufs, pas encore indexés | un aller-retour complet `pret.sh` vert / CI rouge | fonction de 4 lignes + 2 cas de test | `init.sh`, `test-init.sh` |
| 7 | Réparer le motif encore faux du garde-fou « objectif en dur » | 3 faux positifs déjà subis, le 4ᵉ attend | 1 ligne + 1 commentaire | `apps/renaissance-gym/tests/programme.test.js` |
| 8 | `check-plugins.sh` connaît `typescript-lsp`, et sa dérive se voit | diagnostics TypeScript perdus en silence | 2 lignes + boucle de 4 lignes | `.claude/check-plugins.sh`, `init.sh` |
| 9 | Interdire mécaniquement l'import automatique de `memory/` | 15 000 jetons qui resteraient hors du coût par tour | 6 lignes bash + 1 clause | `init.sh`, `CLAUDE.md` |
| 10 | Le PRD répond à quatre questions de cadrage et nomme un test par risque | 12 des 20 capacités ajoutées après coup | 20 lignes de texte | `memory/produit.md`, `CLAUDE.md` |
| 11 | Une action `garde-fou`/`contrat` sans suite se voit avant la PR | 96 actions consignées, 11 commits de suite | 10 lignes bash + 1 cas de test | `scripts/pret.sh`, `test-pret.sh` |
| 12 | Vérifier que le test nommé dans un tableau de risques existe | le 409 spécifié 3 fois, testé 0 fois côté client | 40-60 lignes bash + tests | `init.sh`, `test-init.sh` |
| 13 | Une règle `[hidden]` globale par app qui utilise l'attribut | 3 occurrences, 2 apps, 3 apps encore exposées | 15 lignes bash + 1 cas de test | `init.sh`, `test-init.sh` |
| 14 | Un second seuil de contexte, celui-là bloquant | bloquerait les 2 pires contextes du dépôt | 2 scripts + 2 cas de test, et un arbitrage | `scripts/cout.sh`, `scripts/pret.sh` |
| 15 | `/livrer` sans argument regarde le contexte avant de reprendre | le point exact où le choix couper/continuer se prend | 5 lignes de texte | `.claude/commands/livrer.md` |
| 16 | `cout.sh` compte les agents de workflow, aujourd'hui invisibles | un relevé qui rendait 21 % du coût réel | 1 motif de glob + 1 cas de test | `scripts/cout.sh`, `test-cout.sh` |

---

## 1. Chiffrer le seuil de coupure de session et dire comment on reprend

**Ce qu'on change.** `memory/travail.md`, section « Le relevé de coût — `./scripts/cout.sh` »,
tableau des trois chiffres de « Ce qui coûte » (~ligne 163). La cellule de droite de la ligne
« **croissance** de la relecture » dit aujourd'hui seulement : « dit à partir de quand une
session devrait être coupée en deux ». La remplacer par :

> au-delà de `COUT_CONTEXTE_ALERTE`, soit **300 000 jetons** (`scripts/cout.sh:45`), `cout.sh`
> avertit à chaque `pret.sh` : « coupe la session, ou confie la suite a l'artisan ». **Couper**
> veut dire : terminer la session, en rouvrir une **sur la même branche**, qui reprend par le
> PRD, les PRP, l'entrée de journal et les messages de commit déjà écrits — **jamais par le
> fil de la conversation**.

Ne pas recopier le nombre ailleurs qu'ici : le seuil vit dans `cout.sh`, ce tableau le nomme et
renvoie à son message, pour que les deux textes ne dérivent pas si le seuil change.

**La mesure.** `COUT_CONTEXTE_ALERTE=300000` est en place depuis le commit `37eb474` (PR #91,
2026-08-08), donc avant `renaissance-gym`. Sur les 22 entrées de journal portant un bloc de coût
détaillé, **9 (41 %) ont franchi ce seuil** sans qu'aucune ne coupe : 365 824, 369 152, 372 773,
387 557, 420 589, 533 850, 566 161, 652 382 et 703 497 jetons au dernier appel relevé. Le pire
cas est `renaissance-gym`, à 2,34 fois le seuil, sur la branche la plus chère du dépôt.

**Ce qu'on gagne.** `apps/renaissance-gym/RETROSPECTIVE.md` §2.1 chiffre ce seul levier :
« Le levier principal : couper la session (~50 à 70 $) », sur une facture de 266 $.

**Ce que ça retire.** Rien n'est retiré, et rien n'a besoin de l'être : `memory/*.md` n'est
importé nulle part (`grep '@memory' CLAUDE.md .claude/agents/*.md` ne rend rien), il est lu à la
demande sur le déclencheur du sommaire — coût nul par tour. Le déclencheur existant de
`memory/travail.md` (« avant de remplir le journal, d'ouvrir une PR ou de lancer un agent »)
couvre déjà le moment utile ; `CLAUDE.md` n'est pas touché.

**Ce que ça risque de casser.** Rien de technique. C'est de la prose : rien ne garantit qu'un
agent la lise et la suive — c'est déjà le cas du `warn()` actuel, qui dit la même chose moins
visiblement.

**Vérifiable mécaniquement :** non.

## 2. Dimensionner un chantier d'artisan : un seul PRP, sous 100 000 jetons

**Ce qu'on change.** Deux fichiers, parce qu'il y a deux lecteurs distincts et qu'aucun ne lit
le texte de l'autre (`artisan.md` liste `memory/` hors de son périmètre, « sans exception »).

`.claude/agents/artisan.md`, nouvelle section courte après « ## Ton perimetre » :

> ## La taille de ton chantier
>
> Un chantier porte **un seul PRP**, jamais deux, et se dimensionne pour tenir sous
> **100 000 jetons de contexte, PRP compris**. Lis le PRP, pas `apps/<nom>/PRODUCT.md` :
> `prp/README.md` fixe l'ordre d'autorité et le PRP est autoportant. Si tu te surprends à relire
> les mêmes fichiers de nombreuses fois, ou si le chantier s'étire au-delà, écris-le dans
> « Ce que tu n'as pas pu faire » et rends la main : ton appelant relancera un artisan neuf.

`memory/travail.md`, section « ## Les trois agents », à la fin du paragraphe sur l'artisan
(~ligne 301), la règle côté lanceur :

> Ne lui confie **pas plus d'un PRP à la fois**, et relance un artisan **neuf** plutôt que de
> poursuivre le même au-delà d'un chantier qui s'étire : c'est la session appelante, pas
> l'artisan, qui décide du périmètre passé à l'agent. Un chantier se dimensionne pour tenir sous
> 100 000 jetons, PRP compris.

**La mesure.** Contexte moyen relu par appel de sous-agent, branche à branche :
`renaissance-gym` 1819 appels à **181 026** jetons ; `gym-pilate-app-prd` 372 à 79 459 ;
`weather-app-ui-redesign` 20 à 46 155 ; `token-optimizer-plugin` 20 à 15 972 ;
`touquet-marine-weather-app` 14 à 14 102. `artisan.md` ne contient aujourd'hui **aucune**
occurrence de « PRD », « PRP » ou « PRODUCT », ni aucune limite de taille de chantier. Le chiffre
de 100 000 n'est pas inventé ici : c'est celui que fixe `RETROSPECTIVE.md` §2.2.

**Ce qu'on gagne.** Le poste sous-agents de `renaissance-gym` pèse 113,3 $ sur 266 $, presque
entièrement de la relecture. `RETROSPECTIVE.md` §2.2 chiffre ~30 $ sur **cette branche** le
défaut précis visé (« le même artisan a porté les PRP 05 et 07 ensemble ») — ce n'est pas un taux
généralisable, aucune autre branche n'est chiffrée à ce grain.

**Ce que ça retire.** `memory/travail.md` : rien, coût nul par tour (voir geste 1).
`artisan.md` est en revanche le prompt système de l'agent, **relu à chaque appel** : 8 lignes
≈ 120 jetons × 1641 appels d'artisans sur `renaissance-gym` ≈ 0,2 M jetons, soit **0,07 %** des
~297 M jetons de relecture des artisans de cette branche. Le surcoût est réel et assumé ; c'est
pourquoi la section est en puces courtes et non en explication.

**Ce que ça risque de casser.** Un chantier découpé trop finement multiplierait les
allers-retours au lieu de les réduire. Aucune garantie mécanique : c'est de la prose lue par un
modèle.

**Vérifiable mécaniquement :** non.

## 3. Couper les 4 connecteurs de compte jamais utilisés, et le documenter

**Ce qu'on change.** `memory/outillage.md`, nouvelle section, sur la forme de la section
existante « ## rtk — un binaire, pas un plugin de marketplace » :

> ## Connecteurs de compte, distincts des plugins du dépôt
>
> La branche `renaissance-gym` a chargé, en plus des 13 plugins de `settings.json`, **six
> serveurs MCP** de connecteur : Canva, Gmail, Google Drive, Notion, GitHub, Playwright. Deux
> seulement ont servi. Canva, Gmail, Drive et Notion n'ont **aucune trace d'usage** dans tout le
> dépôt. Ils ne sont **ni** dans `.claude/settings.json` **ni** dans `.claude/cloud-setup.sh` :
> ce sont des réglages du compte claude.ai, hors dépôt, que `./init.sh` ne peut ni voir ni
> corriger. **Décoche-les dans les réglages de connecteurs du compte avant d'ouvrir une session
> de fabrique.** Le gain se lit ensuite dans le bloc « Démarrage » de la prochaine entrée de
> journal, comparé à la plage habituelle de 55 k à 68 k jetons.

Mettre à jour dans le même geste la ligne « Quand lire » en tête de `memory/outillage.md` et la
colonne « Quand le lire » de `CLAUDE.md` ligne 203, en y ajoutant : « ou avant d'ouvrir une
session cloud ». Sans ce déclencheur, la section existe mais rien n'indique quand l'ouvrir : dans
ce dépôt une entrée `memory/` ne se lit que sur le déclencheur écrit au sommaire.

**La mesure.** `RETROSPECTIVE.md` lignes 116-119 pour les six serveurs et les deux utilisés.
`grep -ril "canva|notion|gmail|google.drive"` sur `apps/`, `journal/`, `memory/`, `.claude/`,
`fabrique.yml` : **zéro usage réel** — toutes les occurrences sont des faux positifs vérifiés un
à un (le mot français « notion », `<canvas>`/« canevas », l'adresse `amuteau@gmail.com`).
L'audit du 7 août consigné dans `memory/outillage.md` chiffrait 5 plugins inutilisés à ~2 % du
démarrage, mais **ne couvrait pas les connecteurs**. Le démarrage de `renaissance-gym` pèse
64 719 jetons, relus 39 672 747 fois cumulées, soit 7 % de toute la relecture de la branche.

**Ce qu'on gagne.** Non chiffrable depuis le dépôt seul — c'est à dire franchement : le poids
exact des définitions d'outils de ces quatre serveurs n'est mesurable qu'en comparant deux
démarrages. Le gain porte sur une part de 39,7 M jetons, pour quelques minutes de réglage.

**Ce que ça retire.** `CLAUDE.md` gagne cinq mots dans une cellule existante, pas une ligne :
le fichier reste à 206 lignes pour un plafond `CLAUDE_MAX_LIGNES=250`. La section elle-même vit
dans `memory/`, à coût nul par tour.

**Ce que ça risque de casser.** Rien d'applicatif : aucune app, aucun manifeste ne s'appuie sur
ces quatre connecteurs. Si une app en a un jour besoin, il faudra retirer la consigne et
documenter l'exception.

**Vérifiable mécaniquement :** non — le réglage vit hors du dépôt.

## 4. L'artisan vérifie une vue par les chiffres, pas par l'image

**Ce qu'on change.** `.claude/agents/artisan.md`, nouvelle section après « ## Comment tu
verifies », déclenchée **seulement** si les fichiers touchés incluent une vue (CSS, HTML, JS de
rendu) :

> ## Quand tu touches une vue
>
> Sers l'app en local, puis pour chaque écran touché lance Chromium depuis Bash :
> `node` avec `require('/opt/node22/lib/node_modules/playwright')` et
> `executablePath: '/opt/pw-browsers/chromium'`. **Pas le plugin MCP playwright** : il n'est pas
> dans tes outils, et son canal par défaut `chrome` est absent de l'image.
> Vérifie **deux largeurs**, dont le seuil déclaré par l'app si elle en a un, et vérifie des
> **faits calculés** par `page.evaluate` — `getComputedStyle` : `display`, `clip-path` résolu,
> `border-radius`, angle — plutôt qu'une capture. Une capture coûte 439 jetons en 390×844 et
> 1536 en 1280×900, **relus à chaque tour suivant** ; si tu en prends une, sauve-la en fichier
> pour l'humain et ne la réinjecte pas. Nomme les écrans vérifiés et la méthode dans ta rubrique
> **2. Les tests**.

Écrire dans la rubrique 2 et non dans une cinquième : « Ce que tu rends » annonce « Quatre
rubriques, courtes, dans cet ordre ».

Dans le même geste, `memory/outillage.md`, nouvelle sous-section dédiée (il n'existe
aujourd'hui aucun paragraphe playwright, seulement deux mentions de passage lignes 32-33 et 47) :

> ## Chromium — le canal du plugin MCP est absent de l'image
>
> `browser_navigate` et `browser_resize` échouent par défaut :
> « Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome ».
> `/opt/google/chrome/` n'existe pas. Ce qui répond : `/opt/pw-browsers/chromium`, invoqué via
> Bash et le paquet `playwright` installé sous `/opt/node22/lib/node_modules/`. C'est le chemin
> que suit `artisan.md`, qui n'a pas accès au plugin MCP.

**La mesure.** `grep -ciE 'navigateur|ecran|capture|screenshot|playwright|chromium'
.claude/agents/artisan.md` rend **0**, et son en-tête `tools:` liste `Read, Edit, Write, Bash,
Grep, Glob` — pas le plugin MCP. L'échec du canal `chrome` a été rejoué et rend exactement le
message cité. Une assertion `page.evaluate` coûte ~1,2 s et quelques centaines de jetons de JSON,
et a reproduit la grandeur de l'anomalie 13 (clip-path résolu) sans lire aucune image. Les
6 défauts visuels que 152 tests verts n'ont pas vus (anomalies 12, 13, 15, 16) sont **tous** des
faits géométriques ou de style calculé, aucun n'est une question de goût.

**Ce qu'on gagne.** `RETROSPECTIVE.md` §7 : « supprime une phase de finition entière (4 commits
ici) » — les commits `3243c4e`, `ef94e04`, `a609bbe`, `86fb9d4`, consécutifs.

**Ce que ça retire.** Rien dans `memory/`, coût nul par tour. Dans `artisan.md`, ~20 lignes de
plus au prompt système relu à chaque appel (~300 jetons, soit ~0,2 % du contexte moyen d'un
artisan) : c'est le prix, il est chiffré et non caché. Le déclencheur conditionnel (« si tu
touches une vue ») évite tout coût d'exécution sur les chantiers sans interface.

**Ce que ça risque de casser.** Des captures accumulées gonfleraient le contexte de l'artisan —
d'où la règle « sauve, ne réinjecte pas ». Le proxy de l'environnement bloque le navigateur en
**production** (anomalie 18) : cette étape ne vaut que pour la vérification **locale**.

**Vérifiable mécaniquement :** non.

## 5. Un déploiement par lot cohérent, pas un par correctif

**Ce qu'on change.** `memory/travail.md`, section « ## Les deux modes de développement »,
paragraphe séparé — **pas** un quatrième « arrêt » : les trois arrêts existants suspendent une
session autonome pour une décision humaine, une cadence ne bloque personne.

> `CLAUDE.md` dit déjà « on pousse à chaque commit ; la pull request vient à la fin, une fois
> l'ensemble cohérent ». **« Ensemble cohérent » veut dire un lot fonctionnel** — une
> construction, ou une série de retours d'usage groupés — **jamais un correctif isolé d'une
> ligne**. Exception : un correctif qui débloque un usage en cours part tout de suite.

**La mesure.** 12 PR (#118 → #129) toutes issues de la même branche
`claude/gym-la-renaissance-app-xpgswt`, 7 déploiements. `RETROSPECTIVE.md` §3 : « Sept
déploiements pour vingt ajouts, dont plusieurs d'une ligne. Grouper les retours d'usage aurait pu
ramener 7 déploiements à 2 ou 3. » Chaque déploiement prend 2-3 min et `dockhand` y recrée
**toute** la stack, remettant en jeu les apps non touchées.

**Ce qu'on gagne.** 4 à 5 recréations complètes de stack en moins par fabrication, et autant de
mises en jeu des autres apps.

**Ce que ça retire.** Rien : le paragraphe **précise** une phrase déjà présente dans `CLAUDE.md`
au lieu d'en ajouter une, et il vit dans `memory/`, à coût nul par tour. Il cite la phrase du
contrat explicitement pour que les deux textes ne divergent pas.

**Ce que ça risque de casser.** Retarde un correctif attendu si l'exception est mal jugée. Aucun
mécanisme ne distingue « urgent » de « accumulable » à la place d'un humain — même nature que le
vocabulaire `arbitrage` déjà en place.

**Vérifiable mécaniquement :** non.

## 6. `--check` voit aussi les fichiers `.md` neufs, pas encore indexés

**Ce qu'on change.** `init.sh`. Ajouter une fonction près des autres utilitaires de listage :

```sh
fichiers_md() {  # suivis ET non suivis non ignores : un fichier neuf est deja une violation
  { git ls-files "$@"; git ls-files --others --exclude-standard -- "$@"; } | LC_ALL=C sort -u
}
```

puis remplacer `< <(git ls-files '*.md')` (~ligne 2498, contrôle du doublon de
`PRODUCT.md`/`README.md`) par `< <(fichiers_md '*.md')`, et
`< <(git ls-files 'docs/*.md' 'docs/**/*.md')` (~ligne 2525, contrôle du document d'app égaré
sous `docs/`) par `< <(fichiers_md 'docs/*.md' 'docs/**/*.md')`. **Ne pas toucher aux trois
autres usages de `git ls-files`** (journal, secrets, fichiers d'app) : leur restriction aux
fichiers suivis est délibérée et documentée dans leurs propres commentaires (« une entrée non
suivie est un travail en cours, et ne se juge pas »).

**La mesure.** Reproduit en direct : avec un `docs/test-ardoise-uncommitted.md` non commité
contenant le nom d'une app existante, `./init.sh --check` répond quand même « ok  aucun document
d'app egare sous docs/ ». C'est exactement le mécanisme qui a rendu `pret.sh` vert puis la CI
rouge le 2026-08-16.

**Ce qu'on gagne.** Un aller-retour complet `pret.sh` vert → commit → CI rouge → correctif, sur
un défaut qui aurait été visible avant le premier `git add`.

**Ce que ça risque de casser.** Quasi rien : les deux contrôles visés sont déjà des `bad()`
bloquants, aucune sévérité nouvelle n'est créée ; le contrôle voit seulement plus tôt ce qu'il
aurait signalé de toute façon. Seul cas limite, un fichier de brouillon non destiné au dépôt qui
porterait par hasard le nom d'une app sous `docs/` — aucun exemple observé.

**Coût réel.** 4 lignes de fonction, deux points d'appel, **et** au moins deux cas dans
`test-init.sh` (414 lignes, gaté par le job « verrou » de la CI) : un fichier non suivi nommant
une app sous `docs/`, et un doublon non suivi de `PRODUCT.md`.

**Vérifiable mécaniquement :** oui.

## 7. Réparer le motif encore faux du garde-fou « objectif en dur »

**Ce qu'on change.** `apps/renaissance-gym/tests/programme.test.js`, ligne 217. Remplacer
`/\b\d+\s*(?:s|min)\b/i` par `/\b\d+\s*(?:s|min)(?![A-Za-zÀ-ÖØ-öø-ÿ0-9])/i`. Enrichir le message
d'assertion pour dire explicitement qu'un **commentaire ou un mot voisin** suffit à déclencher le
test — sinon on cherche un bug de code qui n'existe pas. Poser la leçon en **commentaire
au-dessus de `motifsSuspects`**, dans ce même fichier.

**La mesure.** `node -e "console.log(/\b\d+\s*(?:s|min)\b/i.test('SEMAINE 1SÉANCE 1 SUR 4'))"`
rend **`true`** aujourd'hui : le motif reconnaît « 1S » dans « 1SÉANCE ». Les correctifs des
anomalies 10 et 14 ont reformulé le commentaire fautif, pas le motif. Le motif proposé a été
testé : `false` sur le cas fautif, et toujours `true` sur « 30s », « 5 min », « 10s. ».

**Ce qu'on gagne.** Trois faux positifs déjà subis sur une seule branche ; le quatrième attend
son prochain commentaire.

**Ce que ça risque de casser.** Le motif reste un test de texte brut : il peut encore se
déclencher sur une vraie valeur numérique suivie d'un mot accentué. Mieux qu'aujourd'hui, pas
parfait — d'où le message d'échec explicite.

**Ce qu'on n'écrit pas.** Rien dans `memory/regles-imperatives.md` : ce fichier exige un champ
« Tenu par » réel et `--check` refuse explicitement `Tenu par : rien` — y loger une leçon que
rien ne rattrape rendrait le fichier trompeur sans que `--check` puisse le voir.

**Vérifiable mécaniquement :** oui — le test lui-même le prouve.

## 8. `check-plugins.sh` connaît `typescript-lsp`, et sa dérive se voit

**Ce qu'on change.** Deux gestes, à faire ensemble.

`.claude/check-plugins.sh` : ajouter `"typescript-lsp@claude-plugins-official"` à la variable
`PLUGINS` et le triplet `"typescript-lsp:typescript-language-server:typescript"` à `TRIPLETS`
(format `plugin:binaire:stack`, déjà utilisé par `gopls-lsp:gopls:go`).

`init.sh`, fonction `check_outillage()` (~ligne 2591), sur le modèle exact de la boucle qui
vérifie déjà `cloud-setup.sh` :

```sh
drift=0
for p in "${PLUGIN_IDS[@]}"; do grep -qF "$p" .claude/check-plugins.sh || drift=1; done
for t in "${LSP_TRIPLETS[@]-}"; do [ -z "$t" ] || grep -qF "$t" .claude/check-plugins.sh || drift=1; done
[ "$drift" = 0 ] && ok "check-plugins.sh aligne sur ${#PLUGIN_IDS[@]} plugins" \
                 || warn "check-plugins.sh desynchronise — un plugin attendu n'y est pas verifie"
```

**La mesure.** `.claude/settings.json` déclare **14** plugins, `PLUGINS` dans
`check-plugins.sh` en liste **13** : `typescript-lsp@claude-plugins-official` manque, et son
binaire n'est dans aucun triplet. `marcq-handball` est la seule app `stack: typescript` du dépôt
(vérifié sur les 9 `app.yml`). `compute_tooling()` (~ligne 889) calcule pourtant déjà
`typescript-lsp` dès qu'une app le déclare, et `check_outillage()` vérifie déjà l'alignement de
`settings.json` et de `cloud-setup.sh` — **mais jamais celui de `check-plugins.sh`**, dont seule
l'exécutabilité est contrôlée (~ligne 2617).

**Ce qu'on gagne.** Un artisan travaillant sur `marcq-handball` peut aujourd'hui perdre les
diagnostics du compilateur TypeScript sans que rien ne le signale — un défaut invisible coûte
plus en allers-retours qu'aucune économie de jetons ne rapporte. La boucle de dérive empêche que
la prochaine app dans un stack neuf (Python → `pyright-lsp`, par exemple) recrée le même silence.

**Ce que ça risque de casser.** Si `typescript-language-server` est réellement absent de
l'environnement, chaque ouverture de session affichera un manquant de plus jusqu'à ce que
`.claude/cloud-setup.sh` soit recollé — bruit correct, pas une régression. Le nouveau contrôle
est un `warn`, jamais un `bad` : il ne bloque aucun commit.

**Vérifiable mécaniquement :** oui.

## 9. Interdire mécaniquement l'import automatique de `memory/`

**Ce qu'on change.** `init.sh`, dans `check_outillage()`, sur le style du `grep` existant du bloc
`"env"` de `settings.json` :

```sh
if grep -l '@memory/' CLAUDE.md apps/*/CLAUDE.md .claude/agents/*.md 2>/dev/null | grep -q .; then
  bad "import automatique @memory/ — memory/ se lit a la demande ; importe, il serait relu a chaque tour"
else
  ok "aucun import automatique de memory/"
fi
```

**Ce qu'on n'écrit pas** : le paragraphe d'interdiction dans `CLAUDE.md`. Une règle posée dans le
fichier le plus cher du dépôt — relu à chaque tour, pour toujours — pour un risque qui n'existe
pas encore serait exactement le mauvais échange. Au plus, une **clause** ajoutée à la phrase
d'introduction déjà présente du sommaire de `memory/` : « … jamais importés automatiquement,
`--check` le vérifie ». Une clause, pas une phrase, pas une ligne.

**La mesure.** `memory/*.md` : 10 fichiers, 60 550 octets (~15 000 jetons). `grep -n
"@memory\|@\./" CLAUDE.md .claude/agents/*.md` ne rend **rien** : ces 15 000 jetons sont
aujourd'hui à coût nul par tour. `CLAUDE.md`, lui, pèse 206 lignes / 11 219 octets (~2 800
jetons) **relus à chaque échange**.

**Ce qu'on gagne.** Empêche qu'un futur commit, en voulant « donner plus de contexte d'un coup »,
transforme 15 000 jetons lus à la demande en charge fixe par tour — cinq fois le poids du contrat
lui-même.

**Ce que ça risque de casser.** Rien : le contrôle porte sur un comportement qui n'existe pas
encore, il est vert dès le premier lancement. Un `bad` plutôt qu'un `warn` se justifie : il n'a
aucune raison légitime de se déclencher.

**Vérifiable mécaniquement :** oui — et c'est tout l'intérêt de ne pas s'en tenir à la phrase.

## 10. Le PRD répond à quatre questions de cadrage et nomme un test par risque

**Ce qu'on change.** `memory/produit.md`, deux règles d'écriture dans la section « Ce qu'on
écrit, et où » :

1. **Colonne « Test ».** Tout tableau « Risques » d'un PRD (§14) et tout tableau de cas d'échec
   d'un PRP porte une **colonne finale « Test »**, contenant soit le nom exact d'un test entre
   guillemets inverses, soit la mention « non testable » suivie de la raison. Une cellule vide
   n'est pas une option silencieuse. Le format existe déjà : `apps/pilabelle/prp/01-socle.md`
   ligne 269, « Sans identité, l'API refuse | `TestIdentiteExigee` ».
2. **Quatre questions dans l'Annexe.** L'Annexe « provenance de ce document » répond par écrit,
   avant la première ligne de code : combien d'appareils l'utilisatrice a-t-elle ; que se
   passe-t-il si elle ne peut pas terminer une étape d'un parcours guidé (sauter / quitter /
   revenir / refaire) ; comment quitte-t-on un compte sans l'effacer ; l'unité de l'original
   (séance, exercice, date) survit-elle à la transposition.

Élargir la colonne « Quand le lire » de `CLAUDE.md` ligne 202 (`memory/produit.md`, aujourd'hui
« avant de livrer un ajout que nul PRP ne prévoyait ») avec « et avant d'écrire un PRD » : sans
ce déclencheur, la règle n'est lue qu'après coup, jamais au moment où le tableau s'écrit.

**La mesure.** Les tableaux « Risques » de `renaissance-gym` (§14, lignes 544-553, 6 lignes) et
de `marcq-handball` (lignes 592-601, 7 lignes) ont **3 colonnes**, aucune ne nomme de test.
`pilabelle` n'a même pas de section Risques. Le refus 409 (pseudonyme déjà pris) est spécifié
**trois fois** — PRD §14, PRP 03 chantier D, PRP 06 chantier B — et livré côté client avec un
`.catch(() => {})` sans aucun test ; le test serveur `TestPseudoDejaPrisRend409` existait déjà et
n'a rien empêché. Sur les quatre questions : le tableau §5 de `RETROSPECTIVE.md` classe **quatre
familles sur cinq** comme prévisibles, soit **12 capacités sur 20** ; les trois premières
questions n'en couvrent que deux (Échappatoires, Cycle de vie du compte), la quatrième vient du
§4.2a et couvre les anomalies 23 et 24. « Contraintes physiques du téléphone » et « Visibilité de
la progression » restent hors de portée de ces quatre questions — c'est à dire, pas à masquer.

**Ce qu'on gagne.** Une colonne obligatoire vide aurait été visible à la relecture, avant
l'écriture du `.catch(() => {})` qui a coûté l'anomalie A18 (accès perdu aux données d'une
enfant).

**Ce que ça retire.** Rien de `memory/`, coût nul par tour. `CLAUDE.md` gagne cinq mots dans une
cellule existante, pas une ligne.

**Ce que ça risque de casser.** Une colonne remplie sans vérification ne vaut rien — d'où le
geste 12, qui la rend mécanique. Seule la **présence** d'une réponse est vérifiable, jamais sa
pertinence : une case cochée sans réflexion reste une case cochée.

**Vérifiable mécaniquement :** non par lui-même ; oui une fois le geste 12 en place.

## 11. Une action `garde-fou`/`contrat` sans suite se voit avant la PR

**Ce qu'on change.** `scripts/pret.sh`, juste après la vérification du journal de la branche
courante (~ligne 86). Compter dans l'entrée de journal les lignes ``**Action** — `garde-fou` ``
et ``**Action** — `contrat` `` ; si ce compte est positif et qu'aucun chemin sous `memory/`,
`.claude/`, `init.sh`, `scripts/` **ou `CLAUDE.md`** n'apparaît dans la sortie de
`fichiers_touches()` (fonction déjà définie ligne 29, et qui inclut le travail non committé —
cohérent avec le reste du script), émettre un **`warn`** nommant le nombre d'actions, les cinq
chemins attendus, et l'échappatoire : « si le correctif vit dans une autre branche, dis-le dans
le champ Action ». Non bloquant : certaines actions se traitent légitimement ailleurs.

**La mesure.** 234 anomalies consignées dans 41 entrées de journal ; distribution des Actions :
`comportement` 59, **`garde-fou` 57**, `rien` 48, **`contrat` 39**, `arbitrage` 24, `outillage` 9
— soit **96 actions (41 %) qui promettent un changement de la surface partagée**. En face :
**11 commits sur 97** (hors fusions) ont jamais touché `init.sh`, `scripts/`, `memory/` ou
`.claude/`. Sur `renaissance-gym` : 10 actions `garde-fou`/`contrat`, et l'entrée de journal le
dit elle-même — « ni `memory/`, ni `.claude/`, ni `init.sh`, ni `scripts/` n'ont changé d'une
ligne ». `CLAUDE.md` doit figurer dans la liste : 2 commits du dépôt le touchent, dont 1 sans
toucher aucun des quatre autres chemins — l'oublier ferait avertir à tort.

**Ce qu'on gagne.** C'est le déficit qui explique pourquoi les gestes 6, 7, 12 et 13 de ce plan
étaient déjà identifiés par leur propre auteur dans le journal, sans jamais recevoir de suite.

**Ce que ça risque de casser.** Faux positifs quand l'action vise sciemment une autre branche ou
un `apps/<nom>/README.md` — d'où le `warn` et le message d'échappatoire, jamais un `bad`.

**Coût réel.** ~10 lignes bash, plus un cas dans `test-pret.sh` (147 lignes, 12 cas, lancé par
la CI comme verrou).

**Vérifiable mécaniquement :** oui.

## 12. Vérifier que le test nommé dans un tableau de risques existe

**Ce geste s'enchaîne après le 10** : il ne vaut que si le format de colonne existe.

**Ce qu'on change.** `init.sh`, **fonction interne** `check_traces_risques()`, appelée depuis
`check_applications()` (~ligne 2396) juste après `check_app_files`. Elle extrait les noms de
tests entre guillemets inverses dans la dernière colonne des tableaux de risques et de cas
d'échec de chaque `apps/*/PRODUCT.md` et `apps/*/prp/*.md`, puis vérifie leur existence réelle
par `grep` dans les tests de l'app (`*_test.go`, `tests/*.test.js`). **`warn` uniquement, jamais
`bad`.**

Écrire une fonction interne et **pas** un `scripts/*.sh` : tous les contrôles de `--check` sont
des fonctions internes (`check_app_files`, `check_volume_noms`, `check_fabrique`…), et `CLAUDE.md`
dit « `scripts/` les cinq autres métiers » — `ls scripts/*.sh` en donne exactement cinq plus
`jetons.sh`. Un script de plus obligerait à corriger cette phrase du contrat dans le même commit.

**La mesure.** `apps/pilabelle/prp/*.md` pratique déjà ce format à la main : 8 lignes
« # | Constat | `NomDuTest` » sur 5 fichiers, datées des 8-9 août, **avant** `renaissance-gym`
(14-16 août) qui ne l'a pas repris. Aucun contrôle du dépôt ne vérifie ce lien aujourd'hui.

**Ce qu'on gagne.** Aurait signalé sur `renaissance-gym` l'absence de tout test client pour le
409, alors que le PRD, le PRP 03 et le PRP 06 en parlaient chacun.

**Ce que ça risque de casser.** Un parseur de tableau markdown est fragile — colonnes qui
bougent, cellules multi-lignes : faux positifs **et** faux négatifs attendus. D'où le `warn`
strict, conforme au contrat (« les avertissements ne bloquent pas »).

**Coût réel.** 40-60 lignes bash, plus des cas dans `test-init.sh`.

**Vérifiable mécaniquement :** oui, avec une précision imparfaite qu'il faut assumer.

## 13. Une règle `[hidden]` globale par app qui utilise l'attribut

**Ce qu'on change.** `init.sh --check`. Pour chaque app dont le **JS utilise réellement**
`.hidden = true` ou `setAttribute('hidden', …)`, vérifier que sa feuille de style contient
`[hidden] { display: none !important; }` (ou un bloc équivalent avec `!important`). Si la règle
manque **et** que la même feuille déclare `display:` sur une classe, `warn` :

> `<app>` déclare `display` sur une classe sans règle `[hidden]{display:none!important}` globale
> — déjà vu 3 fois (ramure, renaissance-gym ×2) ; le remède est une seule règle globale, pas un
> correctif classe par classe.

Le filtre sur l'usage réel en JS est indispensable, pas décoratif.

**La mesure.** Trois occurrences : `ramure` le 2026-08-03, `renaissance-gym` anomalies 16 puis 21
le 2026-08-14 (« deuxième occurrence, même fichier, même cause »). Seul
`apps/ramure/web/ramure.css:112` porte aujourd'hui la règle globale. Apps réellement concernées,
recomptées : **`marcq-handball`, `pilabelle`, `renaissance-gym`** encore exposées, `ramure` déjà
corrigée. **Non concernées** : `ardoise`, `cadran`, `compteur`, `estran`, `hello-world`,
`ramure-v2` — `estran` et `hello-world` n'ont que des `aria-hidden` et des `overflow: hidden`,
sans rapport avec le défaut de priorité CSS. Sans le filtre, 6 apps sur 10 seraient signalées à
tort.

**Ce qu'on gagne.** Ferme la quatrième occurrence d'un défaut qui a coûté deux corrections sur la
même branche.

**Ce que ça risque de casser.** Le filtre mal écrit produit des avertissements sur des apps sans
rapport, et un avertissement bruyant apprend à s'ignorer. `warn`, jamais `bad`.

**Coût réel.** ~15 lignes bash, plus un cas dans `test-init.sh`.

**Vérifiable mécaniquement :** oui.

## 14. Un second seuil de contexte, celui-là bloquant

**Ce geste s'enchaîne après le 1** : bloquer sur un seuil que le contrat n'explique pas encore
serait un refus sans mode d'emploi.

**Ce qu'on change.** `scripts/cout.sh` : ajouter `COUT_CONTEXTE_CRITIQUE=600000` à côté de
`COUT_CONTEXTE_ALERTE` (ligne 45), et faire sortir `cout.sh --rappel` avec un **code dédié
(`exit 3`)** quand ce seuil est franchi, `exit 0` dans tous les autres cas comme aujourd'hui.
Attention : ce code n'existe pas encore — en mode `--rappel`, `cout.sh` sort **toujours** en 0
(ligne 325), et `cout_alerte` ne fait qu'un `warn()`. Le `|| true` de `pret.sh:86` protège contre
un plantage du script, **pas** contre un seuil franchi.

`scripts/pret.sh` ligne 86 : remplacer `./scripts/cout.sh --rappel || true` par une capture
explicite, pour ne bloquer que ce cas précis et laisser passer tout autre incident comme avant :

```sh
rc=0; ./scripts/cout.sh --rappel || rc=$?
[ "$rc" = 3 ] && bad "contexte critique — ouvre une session neuve sur cette branche avant de committer"
```

Plus deux cas dans `test-cout.sh`, sur le modèle de la paire `porte`/`tait` déjà écrite pour le
seuil de 300 000 (lignes 321/326).

**La mesure.** Sur les 9 branches qui dépassent 300 000, **2 seulement** dépassent 600 000 :
`marcq-handball-app-phases` (652 382) et `renaissance-gym` (703 497) — précisément les deux
contextes les plus lourds du dépôt.

**Ce qu'on gagne.** Empêche mécaniquement de committer au-delà du double d'un seuil déjà ignoré
neuf fois.

**Ce que ça risque de casser.** Beaucoup, et c'est un arbitrage humain, pas un geste technique :
cela rompt le principe explicitement écrit dans `cout.sh` (« refuser un commit pour un chiffre
serait plus coûteux que le chiffre »), et peut bloquer un commit en pleine tâche **sans
échappatoire propre** — il faudrait littéralement ouvrir une session neuve pour repasser sous le
seuil. À trancher avant d'écrire une ligne.

**Vérifiable mécaniquement :** oui.

## 15. `/livrer` sans argument regarde le contexte avant de reprendre

**Ce qu'on change.** `.claude/commands/livrer.md` (6 743 octets), §« La sequence » point 1. Le
fichier dit aujourd'hui, sans condition : « Sinon, reprends le travail en cours de la
conversation. » Ajouter : avant de reprendre, lancer `./scripts/cout.sh --dry-run` et, si le
contexte relevé dépasse le seuil documenté au geste 1, **proposer** d'ouvrir une session neuve
sur la même branche plutôt que de continuer. Une proposition faite par l'agent à partir d'un
chiffre qu'il vient de lire — pas une nouvelle question qui bloque l'utilisateur, ce serait
contraire à l'esprit « sans rien redemander » de `/livrer`.

Lire `cout.sh --dry-run`, **pas** le bloc de coût du journal : ce dernier est structurellement en
retard, et `cout_rappel` le détecte lui-même (« relevé à X jetons, la conversation en compte Y »).

**La mesure.** Aucune des 9 branches ayant franchi le seuil ne s'est coupée, et `/livrer` est le
point d'entrée exact où le choix continuer/couper se prend aujourd'hui sans y penser.

**Ce que ça risque de casser.** Une étape de plus dans le mode autonome. **Limite mécanique à
écrire noir sur blanc** : ce contrôle ne fonctionne que si `/livrer` reprend **dans le même
conteneur** — le fichier de conversation, seule source de `cout.sh`, disparaît avec lui. Rien ne
permet de juger « faut-il rouvrir une session » avant que la session en cours n'ait écrit son
propre relevé.

**Vérifiable mécaniquement :** non.

---

## 16. `cout.sh` compte les agents de workflow, aujourd'hui invisibles

**Ce geste précède les gestes 1 et 14** : tous deux se règlent sur un chiffre que `cout.sh`
rend faux dès qu'on délègue à une équipe d'agents.

**Ce qu'on change.** `scripts/cout.sh` ligne 73. La boucle de découverte lit aujourd'hui :

```sh
for f in "$d"/*.jsonl "$d"/*/subagents/*.jsonl; do
```

Un sous-agent lancé par l'outil `Task` écrit bien sous `<session>/subagents/agent-*.jsonl` et
il est compté — c'est ainsi que la branche `renaissance-gym` a pu attribuer 1 819 appels à ses
artisans. Mais un agent lancé par un **workflow** écrit un niveau plus bas,
`<session>/subagents/workflows/<run>/agent-*.jsonl`, et le glob ne descend pas jusque-là.
Ajouter le motif manquant :

```sh
for f in "$d"/*.jsonl "$d"/*/subagents/*.jsonl "$d"/*/subagents/workflows/*/agent-*.jsonl; do
```

Le reste du script suit sans retouche : la détection de sous-agent (ligne 145) teste
`FILENAME ~ /\/subagents\//`, qui matche déjà le chemin plus profond. Ajouter un cas à
`test-cout.sh` sur le modèle des cas de sidechain existants, sans quoi le motif se reperdra.

**La mesure.** Prise sur cette branche même, qui a lancé onze agents en workflow pour produire
ce plan. Avant correctif, le relevé annonçait **7,24 $ et « aucun appel par des sous-agents »**.
Après, sur la même branche : **21,99 $, dont 256 appels de sous-agents pour 10,41 $**. La
moitié du coût était invisible.

Ne mesure pas ces transcriptions à la main pour vérifier : les 642 lignes portant une facture
ne correspondent qu'à 256 requêtes — une réponse occupe plusieurs lignes qui reportent toutes
la même facture. Une somme naïve rend 27,4 $, soit 2,5 fois trop. Le groupement par
`requestId` que fait `cout.sh` est la seule lecture juste, et c'est le piège dans lequel les
huit premiers relevés du journal sont tombés.

**Ce qu'on gagne.** Le chiffre sur lequel reposent le seuil de coupure (geste 1), le seuil
bloquant (geste 14) et toute comparaison entre branches. Un plan qui recommande de déléguer
davantage à des agents — ce que font les gestes 2 et 4 — se mesure avec un outil aveugle à
exactement cette délégation.

**Ce que ça risque de casser.** Rien au fond, mais le total des branches passées reste faux et
ne se recalcule pas : les transcriptions ont disparu avec leur conteneur. Une ligne de
`memory/travail.md` doit dire que les relevés antérieurs à ce correctif sous-comptent les
workflows, comme elle le dit déjà des relevés antérieurs au 2026-08-05.

**Vérifiable mécaniquement :** oui.

## Ce qui ne se mécanise pas

Sept des quinze gestes sont de la prose : 1, 2, 3, 4, 5, 10 (pour moitié) et 15. Rien ne garantit
qu'un agent les lise ni les suive — c'est déjà le cas du `warn()` de `cout.sh`, ignoré neuf fois.
Ce qu'on peut dire honnêtement :

- **Le seuil de coupure et le dimensionnement d'un chantier** (1, 2) resteront des consignes tant
  que le geste 14 n'est pas tranché ; leur seul renfort mécanique possible est un refus, dont le
  coût est peut-être supérieur au gain.
- **Les quatre questions de cadrage** (10) : seule la *présence* d'une réponse dans l'Annexe est
  vérifiable par mot-clé, jamais sa pertinence. Une case cochée sans réflexion vaut ce qu'elle
  vaut, et rien ne peut le garantir.
- **Les connecteurs de compte** (3) vivent hors du dépôt : `./init.sh --check` ne les voit pas,
  ne les verra jamais, et le gain ne se lira qu'en comparant deux blocs « Démarrage ».
- **La cadence de déploiement** (5) demande de distinguer « urgent » d'« accumulable » — un
  jugement humain, de la même nature que le vocabulaire `arbitrage` du journal.
- **La vérification d'écran** (4) dépend de l'environnement : le proxy bloque le navigateur en
  production, et la panne du canal Chromium peut réapparaître si l'image cloud change.

## Écarté, et pourquoi

- **`pret.sh` régénère les artefacts avant les tests** — `./init.sh` prend 9,3 s mesurées (et
  `--check`, déjà en tête de `pret.sh`, 16 s) : +58 % à chaque commit de chaque branche, contre
  l'objectif de réduire le temps ; et l'anomalie visée se produit chez l'**artisan**, qui lance
  `test.sh` bien avant tout `pret.sh`. La bonne cible est ailleurs : une ligne dans `emit_notice()`
  d'`init.sh`, sous `[ "$A_STACK" = go ]`, rappelant qu'un module Go neuf exige un `./init.sh` à
  la racine — reste à faire, hors de ce plan.
- **Interdire le `catch` vide autour d'un appel réseau** — le dépôt porte 17 `.catch(() => {})`
  actuels (8 dans `ramure`, 6 dans `renaissance-gym`) pour **une seule** occurrence qui fut jamais
  un bug : le catch vide découle d'un principe écrit au PRD §11.2 (« le réseau n'est jamais une
  dépendance de fonctionnement »). Plus de 90 % de faux positifs — un avertissement qu'on apprend
  à ignorer. La « deuxième occurrence » invoquée (anomalie 21) est en fait un bug CSS sans rapport.
- **Un rappel de vérification visuelle dans la notice générée des apps `ui: true`** — redondant
  avec le geste 4, dont le déclencheur (« si tu touches une vue ») couvre déjà toutes les apps
  sans toucher une seule notice ; et `artisan.md` est chargé comme prompt système **avant** que
  l'artisan n'ouvre la notice. Coût réel : éditer `emit_notice()`, fonction partagée par toutes
  les apps, et recommitter 9 notices générées. Aucun gain que le geste 4 n'ait déjà.

## L'ordre d'exécution

Le geste 16 d'abord, seul de sa catégorie : une ligne, et sans lui les gestes 1 et 14 se règlent
sur un chiffre faux. Ensuite les gestes 1 à 5 : de la prose dans `memory/` et `artisan.md`, coût nul par tour, qui
attaquent les deux plus gros postes mesurés — la relecture de session (50-70 $) et celle des
artisans (113 $). Ensuite 6 à 9, quatre correctifs mécaniques courts qui ferment des trous
démontrés aujourd'hui. Puis 10 à 13, dans cet ordre : la convention d'écriture du PRD (10) avant
le contrôle qui la vérifie (12). Le geste 14 vient en dernier et seulement si l'arbitrage
« bloquer un commit sur un chiffre » est tranché ; 15 le suppose acquis.

# La revue et le bout en bout dans la chaîne de la fabrique

**Date** : 2026-08-20
**Branche** : `claude/dev-chain-code-reviews-vq4kyo`
**Périmètre** : `fabrique` — rayon de souffle maximal (chaîne partagée, dix apps)

---

## 1. Le problème

La chaîne de la fabrique vérifie aujourd'hui la **forme** et jamais le **fond**.

| Ce qui existe | Où |
|---|---|
| Manifestes cohérents, compose synchronisé, service par service | `init.sh --check`, job `contrat` |
| Tests de chaque app touchée | `apps/<nom>/test.sh`, job `test` |
| Labels et taille de l'image finie | job `build` |
| Branche dédiée, journal rempli, tests verts, PRD à jour | `scripts/pret.sh` |

Rien d'autre. Aucune analyse statique au-delà de `go vet`, aucun contrôle de
sécurité, aucune détection de dépendance vulnérable, aucune mesure de
couverture, aucune détection de duplication, aucune relecture — ni du code, ni
des écrans.

`memory/outillage.md` l'écrit noir sur blanc à propos du plugin `code-review` :
« la revue passe par `--check`, les quatre harnais de test et la relecture
humaine avant fusion ». C'est-à-dire par rien d'automatique.

**Le bout en bout est dans le même état.** Trois apps sur dix ont une suite
(`ardoise`, `compteur`, `ramure-v2`), et **aucune ne tourne en intégration
continue** : `ardoise/e2e/lancer.sh` et `compteur/e2e/lancer.sh` portent en
commentaire « n'est PAS lancé par la CI », et `ramure-v2/test.sh` garde la
sienne derrière `RAMURE_E2E`, variable posée nulle part dans le workflow. Le
commentaire du script le dit lui-même : « cette suite ne tourne donc JAMAIS en
CI ».

## 2. Ce qui a été décidé

Quatre arbitrages, pris avec l'utilisateur avant l'écriture de cette spec.

| Question | Décision |
|---|---|
| Sévérité de la revue | **Tout bloque** |
| Les dix apps existantes | **Mesurer maintenant, corriger plus tard** — sauf la sécurité, corrigée tout de suite |
| Bout en bout | **À chaque changement**, en CI |
| Relecture | **Un agent en fin de branche**, pas à chaque commit |
| Critique UX/UI | **Un agent `impeccable` en fin de branche**, sur les écrans qui bougent **seulement** |
| Autorité de l'agent UX | Il **corrige seul l'objectif**, il **montre** le subjectif et l'utilisateur tranche |

## 3. Le principe directeur : un cliquet, pas un objectif

« Tout bloque » et « ne rien corriger tout de suite » sont contradictoires si la
barre est absolue. Mesure faite avant d'écrire quoi que ce soit :

```
cadran           coverage: 64.0%
hello-world      coverage: 36.0%
compteur         coverage: 32.7%
```

N'importe quel plancher fixe et défendable — 60 %, 70 %, 80 % — aurait bloqué la
moitié ou la totalité des apps dès le premier commit, sur du code que personne
n'avait touché. Un plancher absolu juge un **état** ; on veut juger un **geste**.

**La barre de chaque app est relevée à son niveau du jour, écrite dans son
`app.yml`, et ne peut plus que monter.** Rien n'est rouge au démarrage ; la
dette existante est visible et figée ; toute modification qui la ferait croître
est refusée.

Le cliquet est mécanique : `revue.sh --releve` met les seuils à jour **à la
hausse uniquement**. Une baisse s'écrit à la main dans `app.yml` — donc elle
apparaît dans le diff, donc elle se discute en relecture de pull request. C'est
le même choix que le journal : rendre visible plutôt qu'interdire.

## 4. Les six relecteurs

| | Quand | Qui | Bloquant |
|---|---|---|---|
| A. Qualité, sécurité, couverture, duplication | chaque étape + CI | `scripts/revue.sh` | oui |
| B. Bout en bout, navigateur réel | chaque changement, CI | `apps/<nom>/e2e/lancer.sh` | oui |
| C. Accessibilité mesurée | chaque changement, CI | `@axe-core/playwright`, dans B | oui |
| D. Relecture du code | fin de branche | agent `relecteur` | oui, par le corps de la PR |
| E. Critique UX/UI | fin de branche, écrans touchés | agent `esthete` | oui, par la fraîcheur de la critique |
| F. Contrat, tests, PRD | inchangé | `--check`, `pret.sh` | oui |

### A. `scripts/revue.sh` — la revue outillée

Le sixième métier de `scripts/`. Il juge les apps, jamais la fabrique.

```bash
./scripts/revue.sh                  # les apps touchées par la branche
./scripts/revue.sh <app> [<app>…]   # ces apps
./scripts/revue.sh --toutes         # les dix
./scripts/revue.sh --releve         # mesure et écrit les seuils dans app.yml (cliquet)
./scripts/revue.sh --json           # sortie machine, pour la CI
```

La langue de chaque app se déduit de la présence de `go.mod` et de
`package.json` — comme `test.sh` le fait déjà implicitement. La fabrique n'a
pas à connaître les langages ; elle a à connaître les **axes**.

| Axe | Go | Node / TypeScript | Verdict |
|---|---|---|---|
| Qualité, simplification, code mort | `staticcheck` | `tsc --noEmit` là où TypeScript existe | KO à la première remontée |
| Sécurité | `gosec` | — | KO si sévérité ≥ MEDIUM **et** confiance ≥ MEDIUM |
| Dépendances vulnérables | `govulncheck` | `npm audit --audit-level=high` | KO à la première vulnérabilité atteignable |
| Couverture des lignes | `go test -coverprofile` | `node --test --experimental-test-coverage --test-coverage-lines`, `vitest --coverage` | KO sous `revue.couverture` de l'`app.yml` |
| Duplication | `jscpd` | `jscpd` | KO au-dessus de `revue.duplication` |

**Aucune installation globale.** Les outils Go passent par
`go run <module>@<version>`, les outils Node par `npx --yes <paquet>@<version>`.
Les versions sont **épinglées dans `fabrique.yml`**, sous une clé `outils_revue`
neuve, jamais recopiées ailleurs — même règle que `tarifs` et `taux_usd_eur` :
une valeur qui change avec le temps vit à un seul endroit.

**Un outil indisponible est un KO, jamais un vert.** Le dépôt a déjà payé cette
leçon sur l'inspection des labels Traefik : « un contrôle de sécurité qui échoue
en ouvert est pire que pas de contrôle : il rassure ». Pas de `|| true`, pas de
dégradation silencieuse. Le premier appel sans réseau échoue en disant quoi
télécharger.

**La duplication se mesure sur le code de production seulement** — `*_test.go`,
`tests/` et `e2e/` sont exclus. Un tableau de cas répétés dans un test est une
duplication légitime et fréquente ; la compter apprendrait à écrire moins de
tests, exactement l'inverse du but.

#### Le bloc `revue:` de `app.yml`

Neuf, facultatif à la lecture, obligatoire une fois relevé.

```yaml
revue:
  couverture: 32       # % de lignes, plancher — ne peut que monter
  duplication: 4       # % de lignes dupliquées, plafond — ne peut que descendre
```

`init.sh --check` vérifie sa forme : deux entiers de 0 à 100, aucune clé
inconnue. Il ne vérifie **pas** les valeurs — les mesurer demande de lancer les
tests, ce que `--check` ne fait pas et ne doit pas faire.

#### Ce que `pret.sh` en fait

`pret.sh` appelle `revue.sh` sur les apps touchées, comme il appelle déjà
`test.sh`, et **comme un processus séparé** : la même frontière délibérée que
pour `init.sh --check` et `cout.sh --rappel`. Un KO de la revue est un point
bloquant de plus, présenté comme les autres.

Le bout en bout **n'entre pas** dans `pret.sh` : il demande Docker et un
navigateur, il coûte des minutes, et `pret.sh` passe à chaque étape. Il tourne
en CI à chaque changement, et à la main avant une mise en ligne.

### B. Le bout en bout — le contrat `apps/<nom>/e2e/lancer.sh`

Même forme que `test.sh` : **chaque app dit comment elle se joue dans un
exécutable**, et la fabrique n'a pas à connaître son moteur.

Le contrat, vérifié par `--check` :

- `apps/<nom>/e2e/lancer.sh` existe et est exécutable.
- Il est **autonome** : il construit l'image de l'app, monte ce dont elle a
  besoin sur un réseau dédié, attend qu'elle réponde, joue les tests, démonte
  tout. Il ne dépend jamais de la stack partagée ni d'un service en ligne.
- Il rend 0 si tout est vert, autre chose sinon.
- Son port vient de `<APP>_E2E_PORT`, avec un défaut. Deux suites doivent
  pouvoir tourner côte à côte sur un runner.
- **Aucune sortie réseau vers un service tiers.** Le PRD de `ramure` a déjà
  tranché : « tester contre des sources réelles produit des échecs
  intermittents qui finissent par être ignorés, et masquent alors les vraies
  régressions ». Les sources externes se simulent.
- Il inclut un **passage d'accessibilité `@axe-core/playwright` sur chaque écran
  visité**. C'est ce passage, et lui seul, qui rend l'accessibilité bloquante.

`ardoise/e2e/lancer.sh` et `compteur/e2e/lancer.sh` respectent déjà presque
tout : il leur manque le passage axe. `ramure-v2` a sa suite dans
`web/tests/`, derrière `RAMURE_E2E` — elle reçoit un `e2e/lancer.sh` qui
l'appelle, et la variable disparaît.

Sept suites restent à écrire : `cadran`, `estran`, `hello-world`,
`marcq-handball`, `pilabelle`, `ramure`, `renaissance-gym`.

**La montée en charge est explicite** : tant que les dix n'existent pas,
l'absence de `e2e/lancer.sh` est un **avertissement** de `--check`. Une
constante unique dans `init.sh` — `E2E_OBLIGATOIRE` — la fait passer en KO
quand la dernière est écrite. Le drapeau est dans le code, pas dans une
intention.

### C. `relecteur` — la relecture du code

`.claude/agents/relecteur.md`. Outils **en lecture seule** : `Read`, `Grep`,
`Glob`, `Bash`. Modèle `sonnet`, comme l'artisan — le contexte réduit et le
modèle moins cher sont ce qui rend le geste lançable sans y réfléchir.

Il lit `git diff origin/main...HEAD`, le `PRODUCT.md` de l'app touchée et ses
PRP. Il juge, dans cet ordre : **justesse**, **sécurité**, **simplicité**,
**duplication**, **couverture du comportement neuf**, **conformité au PRD** (une
capacité neuve est-elle déclarée ?). Il rend une liste ordonnée — fichier,
ligne, gravité, correctif proposé. Il n'écrit aucun fichier : c'est ce qui le
rend lançable en tâche de fond sans risque, comme l'analyste.

**Le garde-fou est le corps de la pull request.** Le gabarit
`.github/pull_request_template.md` reçoit une section `## Revue` où se
consignent les deux verdicts — code et UX — avec leur date. Le job `contrat`,
sur les événements `pull_request` seulement, vérifie que la section est présente
et remplie. Mécanique, bloquant, sans état local à inventer.

### D. `esthete` — la critique UX/UI

`.claude/agents/esthete.md`. Outils : lecture, plus les outils de navigateur
Playwright. Il invoque la compétence `impeccable` en mode critique. Modèle non
épinglé : il hérite de la session — la critique demande du jugement, pas du
débit.

Il ouvre les écrans de l'app à **390 px et 1440 px**, mesure, et écrit sa
critique dans `apps/<nom>/.impeccable/critique/<horodatage>__<page>.md`. Le
format existe déjà : deux critiques de cette forme vivent dans
`apps/ramure/.impeccable/critique/`.

**Le partage d'autorité, décidé avec l'utilisateur :**

- **Il corrige seul ce qui est objectif** : contraste insuffisant, cible
  tactile trop petite, message d'erreur muet, nom accessible manquant, ordre de
  tabulation cassé, état vide absent.
- **Il montre le reste.** Une remarque de goût — placement, hiérarchie,
  formulation — devient **deux ou trois maquettes** publiées en artefact, et
  l'utilisateur tranche. C'est la règle déjà écrite au contrat : « un choix qui
  revient à l'utilisateur se montre ». Ce qui est retenu **et ce qui est
  écarté** vont dans le `PRODUCT.md` de l'app, dans le même commit.

**Le garde-fou est la fraîcheur de la critique**, et il est mécanique : pour
chaque app dont la branche touche les écrans (`web/`, `page.html`, `*.html`),
on compare la date de la critique la plus récente à la date du dernier
changement d'écran.

Il est posé **à deux moments**, comme le journal l'est déjà :

- `pret.sh` **avertit** dès le premier commit qui touche un écran — la critique
  vient en fin de branche, bloquer à chaque étape serait faux.
- Le job `contrat`, **sur `pull_request` seulement**, met **KO**. C'est là que
  l'historique complet est disponible, et c'est le dernier moment où la
  correction coûte encore peu.

Décision de l'utilisateur, appliquée telle quelle : **seuls les écrans qui
bougent désormais** sont concernés. Une app dont les écrans ne changent pas et
qui n'a jamais eu de critique ne déclenche rien. Les sept apps sans critique ne
sont pas rattrapées.

## 5. Ce que ça touche

| Fichier | Nature |
|---|---|
| `scripts/revue.sh` | **neuf** — le sixième métier |
| `test-revue.sh` | **neuf** — ses tests, branchés sur le job `tests-de-l-outillage` |
| `memory/revue.md` | **neuf** — le détail, lu à la demande |
| `.claude/agents/relecteur.md`, `.claude/agents/esthete.md` | **neufs** |
| `apps/<nom>/e2e/lancer.sh` | **7 neufs**, 3 alignés |
| `fabrique.yml` | clé `outils_revue` — versions épinglées |
| `apps/*/app.yml` | bloc `revue:` — dix fois, semé par `--releve` |
| `scripts/pret.sh` | appelle `revue.sh` ; avertit sur la fraîcheur UX |
| `init.sh` | `--check` : forme du bloc `revue:`, présence de `e2e/lancer.sh` ; `--help` |
| `.github/workflows/build.yml` | jobs `revue` et `bout-en-bout` ; `deploy` en dépend ; `contrat` juge le corps de la PR et la fraîcheur UX |
| `.github/pull_request_template.md` | section `## Revue` |
| `CLAUDE.md` | une section courte ; `memory/` gagne une ligne au sommaire |
| `memory/travail.md` | la table des agents passe de trois à cinq |
| `memory/outillage.md` | la ligne `code-review` ment aujourd'hui — elle est réécrite |

## 6. L'ordre de mise en œuvre

Une phase, un commit vérifié.

| # | Phase | Ce qui la clôt |
|---|---|---|
| 0 | **État des lieux** — mesurer les dix apps, ne rien corriger | un relevé écrit dans le journal de la branche |
| 1 | `revue.sh` + `test-revue.sh` + bloc `revue:` + `--check` | `./scripts/revue.sh --toutes` vert, seuils semés |
| 2 | Job CI `revue` | la CI refuse une régression de couverture |
| 3 | **Correctifs de sécurité** trouvés en phase 0 | `gosec` et `govulncheck` verts sur les dix |
| 4 | Contrat bout en bout, 3 suites alignées, job CI `bout-en-bout` | trois suites vertes en CI, axe compris |
| 5 | Les 7 suites manquantes — **une par app, déléguées à `artisan`** | `E2E_OBLIGATOIRE` passe à 1 |
| 6 | Agents `relecteur` et `esthete`, gabarit de PR, gardes de fraîcheur | une PR sans section `## Revue` est refusée |
| 7 | Contrat et mémoire | `--check` vert, `CLAUDE.md` et `memory/` à jour |

La phase 5 est la plus longue et la plus parallélisable : sept apps
indépendantes, un artisan par app, aucun état partagé.

## 7. Ce qu'on ne fait pas

- **Pas de tableau de bord ni d'historique de métriques.** Le journal et
  `versions.yml` disent déjà ce qui s'est passé ; un troisième registre se
  périme.
- **Pas de `golangci-lint`.** `staticcheck` couvre la qualité et la
  simplification sans une configuration de deux cents lignes que personne ne
  relit.
- **Pas de service tiers** — ni SonarQube, ni Codecov, ni scanner hébergé. La
  fabrique n'envoie pas son code dehors, et un contrôle qui dépend d'un compte
  tombe le jour où le compte tombe.
- **Pas de revue IA à chaque commit** — décision de l'utilisateur, motivée par
  le coût que le dépôt surveille déjà de près.
- **Pas de rattrapage UX des sept apps existantes** — décision de l'utilisateur.
- **Pas de seuil de couverture ambitieux.** Le cliquet monte ; il ne se décrète
  pas.

## 8. Les risques, et ce qu'on fait s'ils se réalisent

**La chaîne devient trop lente.** `pret.sh` passe de quelques secondes à une ou
deux minutes. La parade est déjà dans le script : il ne juge que les apps
**touchées**, jamais les dix. Si ça reste insupportable, la couverture et la
duplication passent en CI seulement, et `pret.sh` ne garde que la sécurité.

**Le bout en bout devient intermittent.** Un test qui échoue au hasard apprend à
ignorer le rouge — c'est écrit dans le PRD de `ramure`, et c'est le seul risque
qui puisse annuler tout le bénéfice. Parades : aucune sortie réseau, `retries:
0` en local et `1` en CI, et **une suite qui échoue deux fois de suite sur des
commits différents est désactivée avec une entrée de journal** plutôt que
tolérée. Un test tolérant est un test mort qui coûte encore.

**`jscpd` est bruyant sur du Go.** Son support y est plus jeune que sur
JavaScript. À trancher **après la phase 0**, sur la mesure : si le bruit est
élevé, la duplication devient avertissement pour Go et reste bloquante pour
JS/TS. Le choix se consigne dans `memory/revue.md`.

**Les outils se téléchargent au premier appel.** Sans réseau, `revue.sh` est
KO — jamais vert. C'est documenté au `README` de la revue, et c'est délibéré.

**Le garde-fou UX se contourne** en touchant un écran puis en datant une
critique creuse. Rien ne l'empêche mécaniquement, et rien ne le doit : le même
raisonnement que pour le journal, dont `pret.sh` refuse le gabarit nu mais ne
juge pas la prose. Le contournement est visible dans le diff de la PR.

---

# Annexe A — L'état des lieux du 2026-08-20 (phase 0)

Mesuré sur les dix apps avant d'écrire une ligne d'implémentation. Les versions
d'outils sont celles que la spec épingle : `staticcheck` 2025.1.1, `gosec`
v2.28.0, `govulncheck` v1.7.0, `jscpd` 4.0.5.

## A.1 Couverture et duplication — les valeurs qui sèment le cliquet

La couverture est arrondie **à l'entier inférieur**, la duplication **à l'entier
supérieur** : dans les deux cas la barre est posée exactement au niveau du jour,
exprimée en nombre entier. Aucune marge n'est accordée — la desserrer est une
édition à la main de `app.yml`, donc visible dans le diff d'une pull request.

| App | Couverture Go | Couverture navigateur | Duplication | Plancher Go | Plancher web | Plafond dup. |
|---|---|---|---|---|---|---|
| `ardoise` | 37,8 % | — | 0 % | 37 | — | 0 |
| `cadran` | 64,0 % | — | 0 % | 64 | — | 0 |
| `compteur` | 32,7 % | — | 0 % | 32 | — | 0 |
| `estran` | 87,1 % | — | 0,27 % | 87 | — | 1 |
| `hello-world` | 33,8 % | — | 0 % | 33 | — | 0 |
| `marcq-handball` | 80,5 % | 86,83 % | 0 % | 80 | 86 | 0 |
| `pilabelle` | 69,1 % | 55,97 % | 2,91 % | 69 | 55 | 3 |
| `ramure` | 54,2 % | — | 0,14 % | 54 | — | 1 |
| `ramure-v2` | 84,3 % ⚠ | à mesurer (vitest) | 0,91 % | à confirmer | à mesurer | 1 |
| `renaissance-gym` | 80,3 % | 97,79 % | 1,42 % | 80 | 97 | 2 |

⚠ `ramure-v2` : les neuf paquets `internal/` se mesurent (78,8 % à 100 %), le
paquet principal ne compile pas sans `npm run build` préalable. Sa valeur est
confirmée en phase 1, une fois `prepare.sh` en place (voir A.5).

**La duplication n'est pas un problème dans cette fabrique** — 0 % à 2,91 %. Le
risque annoncé au §8 (« `jscpd` bruyant sur du Go ») **ne se réalise pas** : il
reste bloquant pour les deux langages, comme prévu. Le risque réel était
l'inverse, et il s'est réalisé — voir A.4.

## A.2 Ce que la sécurité a trouvé — à corriger en phase 3

**Dépendances vulnérables (`govulncheck`) — 5 occurrences, 2 vulnérabilités.**

| Vulnérabilité | Où | Correctif |
|---|---|---|
| `GO-2026-5970` — `golang.org/x/text@v0.32.0` | `ardoise`, `compteur`, `ramure-v2` | monter en `v0.39.0` |
| `GO-2026-5004` — `github.com/jackc/pgx/v5@v5.7.6` | `ardoise`, `compteur` | monter en `v5.9.2` |

Deux montées de version règlent les cinq. Les sept autres apps sont indemnes.

**Analyse statique de sécurité (`gosec`) — 4 constats à instruire d'abord.**

| Gravité | App | Règle | Où |
|---|---|---|---|
| HIGH/HIGH | `pilabelle` | `G703` traversée de chemin | `stockage.go:70`, `stockage.go:104` |
| HIGH/HIGH | `ramure` | `G704` SSRF | `deezer.go:85`, `deezer.go:91` |
| MEDIUM/HIGH | `ramure-v2` | `G705` XSS | `internal/api/diagnostic.go:28` |
| MEDIUM/HIGH | `marcq-handball`, `ramure-v2`, `renaissance-gym` | `G304` inclusion de fichier par variable | `classement.go:247`, `internal/collection/file.go:60`, `fiche.go:351` |

Les quatre premières lignes sont à instruire **avant** de conclure : une analyse
par teinte suit une valeur depuis son entrée, elle ne sait pas si un
assainissement en chemin la neutralise. Chacune est soit corrigée, soit écartée
avec sa raison écrite — jamais laissée sans verdict.

**Durcissement sans urgence.** `G112` (`ReadHeaderTimeout` absent, donc Slowloris
possible) sur `ardoise`, `compteur`, `pilabelle` ; `G114` sur l'outil de
prévisualisation de `hello-world` ; `G203` (`text/template` au lieu de
`html/template`) sur `cadran` ; `G404` et `G115` sur `ramure` et `ramure-v2` —
tirage aléatoire faible et conversion d'entiers dans un calcul de géométrie, sans
portée de sécurité, à écarter avec leur raison.

## A.3 Qualité — `staticcheck` sur les dix apps

Six apps sur dix sont vierges. Quatre constats :

| App | Constat |
|---|---|
| `marcq-handball` | `main.go:34` — directive `go:embed` désamorcée par une espace (SA9009) |
| `marcq-handball` | `domaine.go:264` — `seanceDe` jamais appelée (U1000) |
| `marcq-handball` | `classement_test.go:677-678` — caractères Unicode de formatage en littéral (ST1018) |
| `pilabelle` | `domaine.go:302` — `minutageDe` jamais appelée (U1000) |

Le premier mérite d'être nommé : la vraie directive existe trois lignes plus bas
et l'app fonctionne. Le jour où la prose survit sans elle, l'image part avec un
`embed.FS` vide et sert des 404 — sans qu'aucune construction n'ait échoué.
C'est très exactement ce que `go vet` seul laisse passer.

## A.4 Le mode d'échec rencontré pendant la mesure elle-même

**`jscpd` a annoncé « 0 % de duplication » sur du code qu'il n'avait jamais lu.**
Les noms de format de `@jscpd/tokenizer` sont `go` et `markup` ; la première
mesure passait `golang` et `html`. Un format inconnu est **écarté en silence** —
pas d'avertissement, code de retour 0, rapport JSON bien formé, périmètre vide.
`ramure` déclarait 132 lignes analysées pour ~150 Ko de Go.

C'est le mode d'échec que le dépôt a déjà nommé sur l'inspection des labels
Traefik : « un contrôle de sécurité qui échoue en ouvert est pire que pas de
contrôle : il rassure ». **Conséquence sur la conception** : `revue.sh` ne se
contente jamais du code de retour d'un outil. Pour chaque axe, il compare le
**périmètre effectivement analysé** au périmètre attendu — nombre de fichiers
pour `jscpd`, paquets compilés pour `staticcheck` et `gosec` — et met KO quand
l'écart n'est pas explicable. **Un axe qui ne lit rien doit crier, pas rendre 0.**

## A.5 Trois corrections apportées à la conception

**1. Le bloc `revue:` devient des clés plates `revue_*`.** Le socle
(`lib/socle.sh`) ne lit que des scalaires en colonne 0, plus des listes et des
listes de mappings ; un mapping imbriqué simple n'est pas dans le sous-ensemble
admis, et l'y ajouter serait « une source de bogues muets » — les termes du
socle lui-même. La forme retenue se lit avec `yget` sans une ligne de parseur
neuve, et suit celle des scalaires déjà présents (`port`, `memory`, `exposure`) :

```yaml
revue_couverture: 37        # % de lignes Go, plancher — ne peut que monter
revue_couverture_web: 86    # % de lignes navigateur, si l'app en a
revue_duplication: 1        # % de lignes dupliquées, plafond — ne peut que descendre
```

**2. Un contrat `apps/<nom>/prepare.sh`, facultatif.** La spec supposait qu'une
app se mesure à froid. C'est faux dès que le binaire embarque un artefact
construit : `ramure-v2` ne compile pas sans `npm run build` préalable, comme son
`test.sh` le documente déjà. `test.sh` et `revue.sh` appellent tous deux
`prepare.sh` quand il existe — donc la préparation s'écrit **une** fois. C'est la
règle du socle appliquée un cran au-dessus : une chose devient partagée quand un
**deuxième** métier en a besoin, jamais avant. Ici le deuxième arrive.

**3. `npm audit` ne tourne que s'il y a un `package-lock.json`.**
`marcq-handball`, `pilabelle` et `renaissance-gym` portent un `package.json` sans
verrou, et leurs propres descriptions l'expliquent : « aucune dépendance, aucun
script, aucun node_modules » — le fichier ne sert qu'à déclarer `"type":
"module"`. `npm audit` y sort en erreur `ENOLOCK`, ce qui, lu naïvement, est un
KO de sécurité sur trois apps saines. `revue.sh` saute l'axe **et le dit** :
« rien à auditer » et « audit non fait » sont deux phrases différentes, que le
silence confondrait.

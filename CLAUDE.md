# CONTRAT DÉPLOIEMENT — billbob.ovh

Dépôt = **fabrique**. Beaucoup apps. Chaque app avoir son code, son PRD, son URL,
son palier exposition. Toutes partir ensemble dans **une seule stack dockhand**.
Règles venir de infrastructure. Toi casser règle → pas erreur claire, déploiement
mourir en silence.

**Nom app = nom répertoire sous `apps/`.** Nom devenir sous-domaine, nom
conteneur, nom routeur Traefik. Donc nom devoir être label DNS valide. Org,
dépôt, domaine dormir dans `fabrique.yml`.

## TOI PARLER COMMENT

**Toi parler français. Toi parler simple. Homme qui lire pas technicien.** Lui
décider quoi on construire. Lui pas lire code. Réponse lui pas comprendre =
réponse nulle, même si travail dedans très beau.

- **Toujours français** — réponses, questions, explications.
- **Court** — peu de phrases, ou trois à cinq puces : quoi fait, quoi reste,
  quoi bloque. Reste = encombrement.
- **Dire effet, pas mécanisme** — « site répondre encore » et pas « healthcheck
  repasser healthy ». Mot technique seulement si obligatoire, et alors toi
  expliquer lui en peu de mots.
- **Pas jargon pour faire joli** — pas noms fichiers, pas options, pas bouts de
  code. Sauf si homme demander, ou si homme devoir faire geste : alors commande
  exacte, seule.
- **Dire vrai quand ça marche pas** — « ça marche pas encore, voilà pourquoi »
  = bonne réponse.

**Règle valoir pour ce que toi DIRE, pas pour ce que toi ÉCRIRE dans dépôt.**
Messages commit, entrées `journal/`, `README`, corps PR garder toute précision
technique : leur lecteur = développeur ou agent.

## OÙ CHOSES VIVRE

```
apps/<nom>/    une app. `--add` écrire ici app.yml, .dockerignore, test.sh,
               README.md, PRODUCT.md ; Dockerfile et code = à toi
               PRODUCT.md porter PRD, prp/ porter documents implémentation
               CLAUDE.md GÉNÉRÉ — notice de app, chargée seulement quand on
               toucher ce répertoire : périmètre, URL, palier, volumes
docs/          ce qui appartenir à aucune app : specs et plans de fabrique
journal/       une entrée par branche : anomalies rencontrées
memory/        un fichier par sujet sorti du contrat : ce que `--check` tenir déjà
compose.yaml   GÉNÉRÉ — stack entière : trois sortes de services, plus bloc
               volumes: si et seulement si un service monter un volume
fabrique.yml   org, dépôt, registre, domaine, réseau, plafonds, shared_services
init.sh        générateur et vérificateur ; scripts/ cinq autres métiers,
               lib/ leur commun
```

**Partagé** : stack, CI, réseau, domaine, `shared_services`, outillage Claude
Code. **À chaque app** : son code, son `Dockerfile`, son PRD, son URL, son
palier exposition, ses volumes, ses services annexes, ses tests.

**Tout ce qui parler de une app vivre dans son répertoire** : PRD dans
`apps/<nom>/PRODUCT.md` — un seul document, fiche produit puis exigences —, PRP
dans `apps/<nom>/prp/`. Répertoire qui porter seulement ces documents = bon :
app dont code pas encore écrit. Compétences `superpowers` écrire leurs specs
sous `docs/` : toi déplacer sous `apps/<nom>/` avant commit, sinon `--check`
refuser document de `docs/` nommé comme une app.

## TOI DÉMARRER

```bash
./init.sh          # régénère les artefacts dérivés depuis les manifestes
./init.sh --check  # vérifie les manifestes, puis le dépôt service par service
./init.sh --help   # les autres options, et les cinq métiers de scripts/
```

Trois artefacts **toujours réécrits**, fonction directe des manifestes :
`compose.yaml`, `go.work`, et notice `apps/<nom>/CLAUDE.md` de chaque app. Toi
jamais éditer eux à la main — toi éditer manifeste. Reste — workflow CI,
`.claude/` — être ordinaire : `--check` regarder propriétés qui compter, pas
égalité à un générateur. `--dry-run` écrire **rien**, même pas `app.yml` que
`--enable` changerait : lui montrer vieille et nouvelle valeur, puis le diff.
`init.sh` créer **ni** `Dockerfile` **ni** code : technologie = ton choix, app par app.

## `apps/<nom>/app.yml` — TOI DÉCIDER

Un fichier par app, **jamais réécrit par `init.sh`** : lui être source de
vérité, toi éditer à la main puis relancer `./init.sh`. Valeurs décidées là —
port, mémoire, healthcheck, palier, volumes, services annexes — toutes
vérifiées. Détail et pièges dans `memory/app-yml.md`.

## TOI AJOUTER APP

**Construire d'abord, brancher ensuite** : premier commit faire publier image
par CI, deuxième commit seulement faire entrer app dans compose. Voilà pourquoi
app naître `enabled: false`. Commit 1 emporter **artefacts régénérés**, pas
seulement `apps/<nom>` : sinon job `contrat` tomber en CI sur « compose.yaml
désynchronisé », et CI rouge pour tout le monde. Séquence exacte, ce que `--add`
réécrire et ce que lui pas réécrire : `memory/ajouter-une-app.md`.

## TROIS SORTES DE SERVICES — UNE SEULE ROUTÉE

`compose.yaml` porter trois sortes de services dans espace de noms **plat** :
app, ses annexes `<app>-<nom>`, et `shared_services` de la fabrique. **Seule app
joignable depuis Internet.** Deux autres porter `traefik.enable=false` — c'est ce
label qui retirer eux, pas absence de label. Détail, budget mémoire, collisions
de noms : `memory/services.md`.

## VOLUMES NOMMÉS

Chose qui devoir survivre au redéploiement vivre dans **volume nommé**, jamais
dans système de fichiers du conteneur. Et `Dockerfile` faire `chown` de son
chemin avant `USER`. Formes, préfixe du propriétaire, sauvegarde, pièges :
`memory/volumes.md`.

## TOI TRAVAILLER : BRANCHE, PUIS COMMITS PAR ÉTAPES

**Jamais toucher `main` directement.** Branche ouvrir dès **première**
modification, nom `<app>/<sujet>` — ou `fabrique/<sujet>` pour ce qui toucher
`init.sh`, `fabrique.yml`, CI, contrat, outillage. Préfixe dire quel rayon de
souffle en jeu, avant même que toi ouvrir diff.

```bash
./scripts/branche.sh cadran/fuseaux-multiples
./scripts/branche.sh fabrique/garde-fous-git
```

Nom validé avant création : préfixe connu, sujet en minuscules. Branche partir
de `origin/main`, jamais du HEAD courant — greffée sur autre branche de travail,
elle traîner ses commits dans sa PR.

**Une exception, subie et pas choisie : `claude/<sujet>`**, que harnais cloud
assigner lui-même. Ce préfixe **dire rien du périmètre** : sur telle branche,
rayon de souffle se lire dans champ `Périmètre` de entrée de journal, et nulle
part ailleurs. Toi remplir lui tôt.

**Un commit par étape vérifiée**, pas commit au kilomètre. Avant chaque commit :

```bash
./scripts/pret.sh     # branche dédiée ? contrat vert ? tests des apps touchées verts ?
```

`pret.sh` relancer seulement apps vraiment modifiées depuis la base : ainsi
chaque commit se relire seul et casser rien. Toi pousser à chaque commit ;
**pull request venir à la fin**, quand tout être cohérent. Corps de PR servir à
décider s'il faut relire et par où commencer, pas à rendre compte : une phrase,
trois à cinq puces, ce qui a été vérifié en chiffres —
`.github/pull_request_template.md`, généré, donner la forme. Raisonnement long
aller dans **messages de commit**, où lui survivre à la fusion.

**Ce que branche coûter se relever avec `./scripts/cout.sh`**, qui écrire lui
dans son entrée de journal ; `pret.sh` réclamer lui. Pas relevé avant fusion = perdu.

**Par défaut on consulter toi** ; `/livrer` envoyer toi seul jusqu'à mise en
ligne vérifiée, sauf trois gestes irréversibles ; `/pas-a-pas` sortir toi de là.
Deux modes, journal et ses vocabulaires, trois agents, garde-fous, coût :
`memory/travail.md`.

## PRD DIRE VRAI, OU PRD MENTIR

Ajout qui venir de aucun PRP = normal, usage réel faire ça. Ajout écrit nulle
part = pas normal : alors `PRODUCT.md` décrire app qui exister plus, et rien
crier.

**Correction** passer par ligne déjà écrite du PRD et faire bouger elle toute
seule. **Capacité neuve** passer par aucune ligne : elle se déclarer dans
section « Ajouté après les PRP », **dans même commit que code**. Si elle lever
une ligne de un « hors périmètre », cette ligne pas s'effacer — elle renvoyer à
ce qui rouvrir elle. PRP livré, lui, jamais se rouvrir : état réel se lire dans
PRD.

`pret.sh` avertir quand app recevoir code neuf et son `PRODUCT.md` pas bouger.
Deux registres, levée qui être pas délimitation, angle mort du garde-fou :
`memory/produit.md`.

## RAYON DE SOUFFLE

Une seule stack, donc un seul `docker compose up`, atomique : une erreur dans
bloc de une app faire tomber déploiement de **toutes** les autres, même celles
que toi pas toucher. D'où trois garde-fous — `enabled`, inspection des images en
CI, `--check` service par service — et aucun se contourner.

## TON OUTILLAGE

`.claude/settings.json` être fichier ordinaire, **versionné** : tout clone
repartir avec même outillage. **Déclarer un plugin pas installer lui** — seul
*setup script* de environnement cloud faire ça, et `.claude/cloud-setup.sh`
porter le contenu à recoller après tout changement de `stack` ou de `ui`. Liste
des plugins, serveurs LSP, rapport d'ouverture de session :
`memory/outillage.md`. **Jamais bloc `env` dans `.claude/settings.json`** : lui
être public par construction.

## TROIS PALIERS EXPOSITION

Qui pouvoir atteindre une app être décidé par `exposure` dans son `app.yml`,
appliqué par Traefik avant que requête arriver au conteneur.

| `exposure` | Middleware Traefik | Qui entrer | Quand prendre lui |
|---|---|---|---|
| `private` *(défaut)* | `forwardauth` | **Seulement comptes de la liste blanche** du serveur | Tout ce qui toucher administration, infra, shell, ou données personnelles |
| `google` | `forwardauth-open` | **N'importe quel compte Google authentifié** | App dont surface toucher seulement API tierces ou contenu pas sensible, ou dont données être bien cloisonnées par utilisateur |
| `public` | `public` | **Tout le monde, sans authentification** | App pour gens qui avoir pas de compte, et rien de sensible vivre côté serveur |

Toi pas confondre `forwardauth-open` et `public` : premier exiger compte Google,
second exiger rien. Toi hésiter entre deux paliers → toi prendre le plus fermé :
`private` se desserrer en une ligne, l'inverse avoir déjà montré les données. Ce
que `public` impliquer, `X-Forwarded-User`, cloisonnement par utilisateur :
`memory/exposition.md`.

## RÈGLES DURES

Un `Dockerfile` par app dans `apps/<nom>/`, multi-étapes, image **< 200 Mo**,
tournant en **utilisateur pas root**. **Aucun port publié**, **aucun secret**,
**aucun `LABEL traefik.*`**, logs sur sortie standard, et app démarrer sans
intervention. Chaque règle refusée par `./init.sh --check` ou par CI, avec la
raison : `memory/regles-imperatives.md`.

## PAS À TOI

Base, cache, volume, service annexe **appartenir à toi maintenant** : toi
déclarer eux dans un manifeste, pas demander eux dans un `README`. Seule
exception, **valeurs** des secrets : toi écrire le nom dans `env:` et dans ton
`README`, infrastructure injecter la valeur. Topologie réseau, trois refus,
alternatives : `memory/perimetre.md`.

## AVANT POUSSER

```bash
./init.sh --check
```

Manifestes, puis artefacts dérivés, puis compose service par service, puis
documents du dépôt. Avertissements pas bloquer, KO bloquer. Même contrôle
tourner en CI, en verrou de tous les autres jobs : avec stack partagée, un
compose faux fusionné casser toutes les apps d'un coup. Déploiement partir à
chaque fusion sur `main` — deux à trois minutes jusqu'à mise en ligne. Ce que
app faire **une fois déployée** se regarder avec `./scripts/prod.sh` — état,
journaux, fichiers, en lecture seule ; détour qui autoriser ça être au `README`.

## SOMMAIRE DE `memory/`

Avant d'agir sur un de ces sujets, toi lire son fichier. Contrat garder
seulement l'essentiel ; détail, formes admises et pièges vivre là-bas.

| Sujet | Fichier | Quand lire lui |
|---|---|---|
| Volumes nommés | `memory/volumes.md` | avant d'ajouter ou de renommer un `volumes:` |
| Champs de `app.yml` | `memory/app-yml.md` | avant de créer ou modifier un `app.yml` |
| Trois sortes de services | `memory/services.md` | avant d'ajouter un service à une app ou à la fabrique |
| Journal, garde-fous, agents | `memory/travail.md` | avant de remplir le journal ou de lancer un agent |
| Ajouter une application | `memory/ajouter-une-app.md` | avant `--add`, et avant chacun de ses deux commits |
| Le PRD suit l'app | `memory/produit.md` | avant de livrer un ajout que nul PRP ne prévoyait |
| Outillage, plugins, LSP | `memory/outillage.md` | quand un plugin ou un LSP manque |
| Paliers d'exposition, détail | `memory/exposition.md` | avant de changer une `exposure` ou de lire une identité |
| Règles impératives, détail | `memory/regles-imperatives.md` | avant d'écrire un `Dockerfile` ou un `test.sh` |
| Ce qui ne t'appartient pas, détail | `memory/perimetre.md` | avant de demander dans un README ce qui se déclare |

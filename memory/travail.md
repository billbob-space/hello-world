# Comment on travaille — le détail

Quand lire : avant de remplir une entrée de journal, de relever ce qu'une branche a
coûté, de lancer l'`analyste`, le `greffier` ou l'`artisan`, ou de conclure qu'une
branche peut être supprimée.
Tenu par : --check — gabarit nu committé, en-tête `Périmètre`/`Mode`, deux champs
fermés par anomalie, présence des trois agents ; pret.sh — relevé de coût manquant ou
périmé, en avertissement ; hook — `garde-branche.sh` refuse d’éditer sur `main`,
`garde-commit.sh` refuse un arbre sale

## La fin de vie d'une branche ne t'appartient pas

**Une session cloud ouvre des branches et ne peut pas en fermer.** Le relais git du
harnais refuse la suppression de refs — `HTTP 403` sur `git-receive-pack`, puis `git`
affiche `Everything up-to-date`, qui ressemble à un succès. Le serveur MCP GitHub
expose `create_branch` sans son inverse. Les branches fusionnées s'accumulent donc,
et rien ne le signale.

```bash
./scripts/fusionnees.sh    # dit quoi supprimer, ne supprime rien
```

Le critère est l'**équivalence de patch**, pas l'appartenance à l'ascendance de
`main` : cette dernière se trompe dans les deux sens — elle classe « non fusionnée »
une branche écrasée en un commit, et ne dit rien d'une branche dont la PR est
fusionnée mais qui porte des commits écrits **après**. Sa limite est dans le nom de
sa seconde section, `à regarder` : un patch inédit ne prouve pas un travail perdu —
un contenu repris ailleurs ou refait à la main produit un patch différent. Compare
avant de conclure.

## Deux garde-fous, parce qu'une règle écrite s'oublie

| Hook | Ce qu'il fait |
|---|---|
| `.claude/garde-branche.sh` (`PreToolUse`) | refuse toute édition tant que HEAD est sur `main`, et donne la commande exacte |
| `.claude/garde-commit.sh` (`Stop`) | refuse de terminer sur un arbre de travail sale |

Fichiers ordinaires dans `.claude/`, édités directement ; `--check` vérifie
qu'ils existent et portent le bit exécutable. Aucun ne dépend de `jq` ni de
`python` : un garde-fou qui ne démarre pas sur une machine dépouillée ne garde
rien. Le garde-fou de branche n'ouvre pas la branche à ta place : seul celui
qui édite connaît le sujet.

## Le journal des anomalies

**Une branche, une entrée dans `journal/`.** Elle s'ouvre avec la branche —
`./scripts/branche.sh` la crée préremplie — et se remplit **au fil du travail**, pas à
la fin : écrite à chaud elle retient les anomalies mineures, reconstituée elle ne
garde que les spectaculaires. Or ce sont les mineures qui disent où le contrat a un
trou. Le nom du fichier vient de la branche : `fabrique/garde-fous-git` →
`journal/2026-08-03-fabrique-garde-fous-git.md`.

Ce journal enregistre les **anomalies**, pas le déroulé : ce qui a surpris, cassé ou
s'est révélé faux — y compris tes propres erreurs de raisonnement, les plus utiles et
les plus faciles à taire. Ce que le changement fait va dans le message de commit ; ce
qu'il a coûté d'apprendre va ici.

Chaque anomalie porte quatre champs. `Symptôme` et `Cause` sont en prose libre. Les
deux autres ont un **vocabulaire fermé**, et `--check` le vérifie :

```
**Detecte par** — `utilisateur`
**Action** — `garde-fou` — pourquoi, en une ligne.
```

| `Detecte par` | qui a rattrapé, du moins cher au plus cher |
|---|---|
| `compilateur` | immédiat, coût nul |
| `test` | avant même de lancer |
| `CI` | avant la fusion |
| `relecture` | humaine ou outillée, avant livraison |
| `auteur` | en cours de travail, après coup |
| `utilisateur` | après livraison : un aller-retour, et un garde-fou manquant |
| `production` | après déploiement |

| `Action` | ce que l'anomalie devrait changer |
|---|---|
| `rien` | réparée, rien à en tirer |
| `contrat` | ce fichier dit quelque chose de faux, ou ne dit rien |
| `garde-fou` | `--check`, `pret.sh` ou un hook devrait le voir |
| `outillage` | un plugin, un LSP, un agent manque |
| `comportement` | façon de travailler, aucun artefact à changer |
| `arbitrage` | demande une décision humaine, pas un correctif |

**Le vocabulaire est fermé parce que le lecteur peut être un agent** : en prose libre,
« moi », « la critique impeccable » et « le compilateur » ne s'agrègent pas, et la
distribution que ce journal promet n'est plus calculable. `Detecte par` est **ordonné
par coût croissant**, et c'est ce qui le rentabilise : l'agrégat utile n'est pas le
nombre d'anomalies mais **jusqu'où la distribution glisse vers la droite** — une masse
sur `utilisateur` et `production` dit que les garde-fous laissent passer, une masse
sur `compilateur`, `test` et `CI` dit qu'ils tiennent, quel qu'en soit le nombre.

**L'en-tête porte deux champs, vérifiés eux aussi :**

```
Périmètre : fabrique
Mode : `chaud`
```

`Périmètre` — les apps touchées, ou `fabrique` ; le laisser au gabarit fait échouer
`--check`. `Mode` — vocabulaire fermé : `chaud` (valeur du gabarit et cas normal,
puisque `branche.sh` ouvre l'entrée en même temps que la branche) ou `retrospective`,
qui dit qu'elle a été reconstituée après coup. L'`analyste` lit une entrée
rétrospective mais s'interdit d'en tirer une mesure — encore faut-il qu'il puisse la
trouver, ce qu'un champ vérifié garantit là où une phrase en prose ne le faisait pas.

Deux vérifications tiennent l'ensemble, dans l'ordre de dureté :

- `./scripts/pret.sh` **refuse** l'étape si la branche n'a pas d'entrée, si elle est
  encore le gabarit nu, ou si son en-tête est incomplet ;
- `./init.sh --check`, donc la CI, refuse un gabarit nu ou un en-tête incomplet
  **committé**. Une entrée non suivie par git est un travail en cours et ne se juge
  pas — c'est ce qui laisse `--check` vert entre l'ouverture de la branche et le
  premier commit.

Une session sans anomalie écrit « Aucune anomalie » et retire le marqueur : une
entrée vide et une entrée jamais ouverte ne disent pas la même chose.

## Le relevé de coût — `./scripts/cout.sh`

**La consommation d'une branche ne vit pas dans le dépôt.** Elle est écrite au fil
de l'échange dans le fichier de conversation du conteneur, sous
`~/.claude/projects/<chemin-du-dépôt>/`, un fichier JSON par ligne. Ce conteneur est
éphémère : quand il disparaît, le chiffre disparaît avec lui, et **aucun outil ne le
reconstitue**. D'où une commande qui le fige dans l'entrée de journal, seul endroit
du dépôt qui appartienne à la branche.

```bash
./scripts/cout.sh              # relève, affiche, et écrit le bloc dans l'entrée
./scripts/cout.sh --dry-run    # affiche seulement
```

Le bloc est **généré, jamais recopié à la main** : il est délimité par deux
commentaires markdown et remplacé en place à chaque relance. Il porte les quatre
postes — entrée, écriture de cache, lecture de cache, sortie — parce qu'ils ne se
facturent pas au même prix, et un total en dollars et en euros.

| Ce qui est lu | Où | Pourquoi là |
|---|---|---|
| jetons consommés | fichier de conversation du conteneur | seule source, éphémère |
| tarifs par modèle, en dollars par million de jetons | `fabrique.yml`, clé `tarifs` | change avec les modèles, se met à jour à la main |
| taux de change et sa date | `fabrique.yml`, `taux_usd_eur` / `taux_date` | figés : un contrôle qui appelle le réseau échoue le jour où le réseau manque |
| écriture de cache à 1,25x l'entrée, lecture à 0,1x | `cout.sh` | vrai pour toute l'API, indépendant du modèle |

`pret.sh` compare le total consigné à celui de la conversation et **avertit sans
bloquer** — quand le bloc manque, et quand il a dérivé de plus d'un dixième. Il
avertit plutôt qu'il ne refuse parce que le relevé peut encore s'écrire au commit
suivant ; il se répète à chaque étape parce qu'une branche fusionnée sans lui a
perdu le sien pour de bon.

Quatre limites, toutes dites par la commande elle-même :

- il ne voit que les sessions **du conteneur courant** — celles d'un conteneur
  précédent sont perdues, et le bloc écrit combien il en a lues ;
- un modèle absent de `tarifs` est compté en jetons mais **pas en argent** ;
- au-delà de quatre-vingt-dix jours, le taux de change est signalé comme vieux ;
- c'est un **prix d'API, pas une facture** : sous abonnement, rien n'est refacturé
  à ce tarif. Le montant se lit comme une valeur de consommation.

## Les trois agents

```
Agent(subagent_type: "analyste")   # lit le journal, rend un plan
Agent(subagent_type: "greffier")   # branche, vérifie, committe et pousse
Agent(subagent_type: "artisan")    # écrit le code d'UNE app, ne committe pas
```

**Aucun agent lançable en tâche de fond ne peut modifier le dépôt.** C'est la règle,
et elle se lit dans les deux sens. L'`analyste` et le `greffier` sont restreints à
`Bash`, `Read` et `Grep` : **l'absence d'outil d'édition n'est pas un détail de
configuration**, c'est ce qui garantit qu'un agent lancé en fond ne touchera pas au
dépôt pendant que tu travailles dessus. L'`artisan`, lui, écrit par définition — donc
**il ne se lance jamais en tâche de fond**. Même règle, autre conséquence.

L'`analyste` agrège les deux champs fermés, cherche les causes qui reviennent d'une
branche à l'autre, et rend **dans sa réponse** un plan de trois à six actions
groupées par `Action` — les `arbitrage` listés à part, tels quels : ce sont des
questions pour toi. Deux consignes le tiennent au réel : ne pas compter une entrée
rétrospective comme une mesure fiable, et ne pas proposer de garde-fou pour une
anomalie déjà rattrapée par le compilateur ou par un test.

Le `greffier` s'arrête et rapporte si `./scripts/pret.sh` échoue — réparer n'est pas
son rôle. Il ne réécrit jamais l'histoire (`--force`, `--amend`, `rebase`,
`reset --hard`, `merge` lui sont interdits) et n'ouvre pas de pull request. Il ne peut
pas non plus remplir le journal, et c'est délibéré : seul celui qui a fait le travail
connaît les anomalies rencontrées.

L'`artisan` reçoit un nom d'app et travaille dans `apps/<nom>/`, nulle part ailleurs.
Son premier geste est imposé : lire `apps/<nom>/CLAUDE.md`, la notice générée de
l'app, qui lui donne périmètre, URL, palier, volumes et secrets sans qu'il ouvre un
seul fichier partagé. Si son travail exige de toucher au compose, à `fabrique.yml`, à
l'outillage ou à une autre app, **il s'arrête et rapporte** : une seule stack se
déploie d'un bloc, et l'agent au contexte volontairement réduit est celui qui voit le
moins bien ce qu'il casserait. Il n'enregistre rien dans git — c'est le `greffier`,
lancé après lui — et il ne remplit pas le journal, mais il rapporte les anomalies
rencontrées dans une rubrique dédiée, que tu recopies dans l'entrée de branche.

**Le registre des agents est lu au démarrage de la session** : un agent ajouté en
cours de session n'est invocable qu'à la suivante — même piège que les plugins.


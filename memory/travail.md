# Comment on travaille — le détail

Quand lire : avant de remplir une entrée de journal, de lancer l'`analyste`
ou le `greffier`, ou de conclure qu'une branche peut être supprimée.
Tenu par : --check — gabarit nu committé, en-tête `Périmètre`/`Mode`, deux champs
fermés par anomalie ; hook — `garde-branche.sh` refuse d’éditer sur `main`,
`garde-commit.sh` refuse un arbre sale

## La fin de vie d'une branche ne t'appartient pas

**Une session cloud ouvre des branches et ne peut pas en fermer.** Le relais git du
harnais refuse la suppression de refs — `HTTP 403` sur `git-receive-pack`, puis `git`
affiche `Everything up-to-date`, qui ressemble à un succès. Le serveur MCP GitHub
expose `create_branch` sans son inverse. Les branches fusionnées s'accumulent donc,
et rien ne le signale.

```bash
./init.sh --branches-fusionnees    # dit quoi supprimer, ne supprime rien
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

Générés par `init.sh` comme le reste de `.claude/`, et `--check` refuse qu'ils
divergent de leur générateur. Aucun ne dépend de `jq` ni de `python` : un garde-fou
qui ne démarre pas sur une machine dépouillée ne garde rien. Le garde-fou de branche
n'ouvre pas la branche à ta place : seul celui qui édite connaît le sujet.

## Le journal des anomalies

**Une branche, une entrée dans `journal/`.** Elle s'ouvre avec la branche —
`./init.sh --branche` la crée préremplie — et se remplit **au fil du travail**, pas à
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
| `garde-fou` | `--check`, `--pret` ou un hook devrait le voir |
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
puisque `--branche` ouvre l'entrée en même temps que la branche) ou `retrospective`,
qui dit qu'elle a été reconstituée après coup. L'`analyste` lit une entrée
rétrospective mais s'interdit d'en tirer une mesure — encore faut-il qu'il puisse la
trouver, ce qu'un champ vérifié garantit là où une phrase en prose ne le faisait pas.

Deux vérifications tiennent l'ensemble, dans l'ordre de dureté :

- `./init.sh --pret` **refuse** l'étape si la branche n'a pas d'entrée, si elle est
  encore le gabarit nu, ou si son en-tête est incomplet ;
- `./init.sh --check`, donc la CI, refuse un gabarit nu ou un en-tête incomplet
  **committé**. Une entrée non suivie par git est un travail en cours et ne se juge
  pas — c'est ce qui laisse `--check` vert entre l'ouverture de la branche et le
  premier commit.

Une session sans anomalie écrit « Aucune anomalie » et retire le marqueur : une
entrée vide et une entrée jamais ouverte ne disent pas la même chose.

## Les agents `analyste` et `greffier`

```
Agent(subagent_type: "analyste")   # lit le journal, rend un plan
Agent(subagent_type: "greffier")   # branche, vérifie, committe et pousse
```

Tous deux sont restreints à `Bash`, `Read` et `Grep`, et **lançables en tâche de
fond**. **L'absence d'outil d'édition n'est pas un détail de configuration** : c'est
ce qui garantit qu'un agent lancé en fond ne peut pas modifier le dépôt pendant que
tu travailles dessus.

L'`analyste` agrège les deux champs fermés, cherche les causes qui reviennent d'une
branche à l'autre, et rend **dans sa réponse** un plan de trois à six actions
groupées par `Action` — les `arbitrage` listés à part, tels quels : ce sont des
questions pour toi. Deux consignes le tiennent au réel : ne pas compter une entrée
rétrospective comme une mesure fiable, et ne pas proposer de garde-fou pour une
anomalie déjà rattrapée par le compilateur ou par un test.

Le `greffier` s'arrête et rapporte si `./init.sh --pret` échoue — réparer n'est pas
son rôle. Il ne réécrit jamais l'histoire (`--force`, `--amend`, `rebase`,
`reset --hard`, `merge` lui sont interdits) et n'ouvre pas de pull request. Il ne peut
pas non plus remplir le journal, et c'est délibéré : seul celui qui a fait le travail
connaît les anomalies rencontrées.

**Le registre des agents est lu au démarrage de la session** : un agent ajouté en
cours de session n'est invocable qu'à la suivante — même piège que les plugins.


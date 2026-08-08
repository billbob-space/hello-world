# Comment on travaille — le détail

Quand lire : avant de remplir une entrée de journal, de relever ce qu'une branche a
coûté, de lancer l'`analyste`, le `greffier` ou l'`artisan`, ou de conclure qu'une
branche peut être supprimée.
Tenu par : --check — gabarit nu committé, en-tête `Périmètre`/`Mode`, deux champs
fermés par anomalie, présence des trois agents et des deux commandes de mode ;
pret.sh — relevé de coût manquant ou
périmé, en avertissement ; hook — `garde-branche.sh` refuse d’éditer sur `main`,
`garde-commit.sh` refuse un arbre sale ; test-cout.sh — le relevé rend un nombre
qu'aucune relecture ne vérifie à l'œil, dix cas le tiennent

## Le préfixe `claude/`, subi et non choisi

Le harnais cloud assigne lui-même le nom de la branche et interdit de pousser
ailleurs. `branche.sh` accepte donc ce préfixe pour **rejoindre** une branche
existante — sans quoi une session cloud ne pourrait pas ouvrir son entrée de
journal — et le refuse pour en **créer** une : personne ne le choisit. Une
branche neuve prend `<app>/<sujet>` ou `fabrique/<sujet>`, dont le préfixe dit
le rayon de souffle avant même qu'on ouvre le diff.

## La fin de vie d'une branche ne t'appartient pas

**Une session cloud ouvre des branches et ne peut pas en fermer.** Le relais git du
harnais refuse la suppression de refs — `HTTP 403` sur `git-receive-pack`, puis `git`
affiche `Everything up-to-date`, qui ressemble à un succès. Le serveur MCP GitHub
expose `create_branch` sans son inverse. Les branches fusionnées s'accumulent donc,
et rien ne le signale.

```bash
./scripts/fusionnees.sh    # dit quoi supprimer, ne supprime rien
```

**GitHub, lui, en ferme à la fusion** — et le harnais réassigne le même nom
`claude/` au sujet suivant. La référence de suivi locale survit alors à une
branche distante disparue : `git` annonce « ahead by 1 commit », puis refuse le
`push` avec `stale info`, mot qui évoque un conflit là où il n'y a qu'une
référence périmée. **Élague avant de pousser sur un nom déjà fusionné** —
`git remote prune origin`, puis un `push` ordinaire.

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

**Un total ne dit pas où agir**, et c'était la limite du bloc jusqu'à ce qu'on la
rencontre : trois chiffres de plus s'y ajoutent, sous « Ce qui coûte ».

| Ce qu'il dit | Ce qu'on en fait |
|---|---|
| appels au modèle, dont ceux des **sous-agents** | savoir ce que coûte le geste « je lance un agent », qui n'avait pas de prix |
| poids du **démarrage** — contrat, outillage, définitions d'outils — et sa part de la relecture | il est écrit une fois par session puis **relu à chaque appel** : mesuré entre la moitié et 80 % de toute la relecture, dont le contrat du dépôt ne fait que 7 %. C'est le seul poste qu'on réduise en élaguant l'outillage plutôt qu'en travaillant moins |
| **croissance** de la relecture, du premier au dernier appel | dit à partir de quand une session devrait être coupée en deux |

Et le bloc porte `cout-detail` : **un appel par ligne** — rang, agent, modèle,
écriture, lecture, sortie. Compact et illisible à dessein, son lecteur est un
outil. C'est la seule donnée qui survive au conteneur : un total ne se recalcule
pas, une suite d'appels si — à d'autres tarifs, ou sous un autre angle.

**Les relevés antérieurs au 2026-08-05 sont faux**, gonflés d'un facteur voisin
de deux, et le resteront : le fichier de conversation qui permettrait de les
recalculer n'existe plus. Ils se reconnaissent à l'absence de section « Ce qui
coûte ». Ne les compare pas aux suivants.

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
  précédent sont perdues, et le bloc écrit combien il en a lues. Un conteneur
  voit en revanche **plusieurs branches** : celles qui ne sont pas la branche
  courante sont écartées du total et comptées à part, sans quoi la dernière
  relevée hérite du travail de toutes les autres ;
- un modèle absent de `tarifs` est compté en jetons mais **pas en argent** ;
- au-delà de quatre-vingt-dix jours, le taux de change est signalé comme vieux ;
- c'est un **prix d'API, pas une facture** : sous abonnement, rien n'est refacturé
  à ce tarif. Le montant se lit comme une valeur de consommation.

## Les deux modes de développement

```
/livrer [sujet]    # autonome : jusqu'à la mise en ligne vérifiée, sans question
/pas-a-pas         # normal : l'agent consulte et rend la main à chaque étape
```

Fichiers ordinaires dans `.claude/commands/`, dont `--check` vérifie la présence.
Le nom de la commande **est** celui du fichier, d'où `pas-a-pas` sans accents :
un caractère accentué dans un nom de commande n'est garanti nulle part.

**Une commande écrite est invocable tout de suite** — vérifié : le registre des
commandes est relu en cours de session, contrairement à ceux des agents, des
plugins et des **compétences**, qui ne le sont qu'au démarrage. Les quatre
registres se ressemblent et ne se comportent pas pareil ; ne déduis le
comportement d'aucun des quatre de celui d'un autre. Une compétence ajoutée à
`.claude/skills/` répond `Unknown skill` jusqu'à la session suivante — vérifié
le 7 août 2026, en tentant de l'invoquer dans la session qui venait de l'écrire.

`/livrer` s'invoque à n'importe quel moment — avec un sujet, ou sans, auquel cas
il reprend le travail en cours. C'est ce qui le rend utilisable aux deux moments
où on le veut : au départ d'une demande, ou au milieu d'un échange qui traîne.

**Le point d'arrivée est le site qui répond**, pas la pull request ouverte ni la
fusion. Une PR verte dit que les tests passent, une fusion dit que le workflow
est parti ; ni l'un ni l'autre ne dit que l'app tourne. Or le déploiement est
atomique : rendre la main à la fusion, c'est partir juste avant le seul moment où
l'on peut casser les applications qu'on n'a pas touchées. La CI rouge et le
déploiement raté sont donc dans le mode, pas des motifs d'en sortir : on répare,
on repousse, on recommence.

**Le mode ne retire aucun garde-fou, il retire les questions.** Même chemin
qu'en mode normal — branche dédiée, journal à chaud, `pret.sh` avant chaque
commit, `--check` avant de pousser, `cout.sh` avant la fin. Un mode autonome qui
se donnerait des raccourcis serait un second chemin à maintenir, et le seul que
personne ne relirait jamais.

**Trois arrêts, et rien d'autre** — ouvrir une app plus largement (`exposure`
desserrée), effacer des données (volume supprimé, renommé ou écrasé), toucher à
ce qui est partagé alors que ce n'était pas la demande. Le troisième porte sa
condition avec lui : si le sujet **est** la fabrique, ce n'est pas un
débordement, c'est le travail — l'arrêt vise le dommage collatéral. Partout
ailleurs l'agent tranche, et **écrit son choix dans l'entrée de journal** ; ce
qui demandait vraiment une décision humaine y devient une anomalie
`Action: arbitrage`. C'est ce qui rend une session autonome relisable après coup,
et c'est la seule contrepartie exigée en échange du silence.

**Deux limites, dites plutôt que masquées.** Le mode ne survit pas à la session :
une session cloud est éphémère, et un mode autonome qui survivrait déciderait un
jour à votre place sans qu'on l'ait rouvert. Et il ne désactive pas les demandes
d'autorisation du harnais — elles viennent du mode de permission de la session,
qu'aucun fichier du dépôt n'atteint. `/livrer` le signale à l'utilisateur quand
il en rencontre une ; zéro interruption réelle demande une session lancée en mode
« ne pas demander ».

Rien ne vérifie automatiquement que l'agent a bien obéi, et c'est délibéré : le
journal et le diff le disent déjà, et un contrôle de l'autonomie devrait décider
ce qu'est une question légitime — il ne saurait pas.

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


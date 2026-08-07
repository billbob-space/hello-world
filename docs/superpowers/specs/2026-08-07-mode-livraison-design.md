# Le mode de développement — `/livrer` et `/pas-a-pas`

**Date** : 2026-08-07
**Périmètre** : fabrique — `.claude/commands/`, `init.sh`, `memory/travail.md`, `CLAUDE.md`

## Le problème

Le rail de travail du dépôt est complet — `branche.sh`, `pret.sh`, les deux
hooks, le journal, la pull request à la fin, le déploiement automatique à la
fusion — mais il est **conversationnel de bout en bout**. Chaque étape rend la
main : l'agent code, vérifie, committe, puis s'arrête et rapporte. Celui qui
décide doit relancer à chaque fois, et rien ne dit à l'agent qu'il a le droit
d'aller plus loin sans demander.

Résultat : une correction d'une ligne demande cinq allers-retours, dont quatre
n'apportent aucune information. Le coût n'est pas seulement humain — chaque tour
relit tout le contexte, et le relevé de coût de la branche précédente le chiffre
à 27 % des tours pour 26 % de la facture.

Ce qui manque n'est pas un outil : c'est une **déclaration d'intention**, dite
une fois, qui vaut jusqu'à ce qu'on la retire.

## Ce qu'on ajoute

Deux commandes, invocables à n'importe quel moment de la session.

| Commande | Ce qu'elle fait |
|---|---|
| `/livrer [sujet]` | bascule en mode autonome et va jusqu'au site vérifié en ligne |
| `/pas-a-pas` | revient au mode normal, où l'agent consulte |

Sans argument, `/livrer` reprend le travail en cours ; avec un argument, il le
prend pour sujet. C'est ce qui la rend utilisable aux deux moments : au départ
d'une demande, ou au milieu d'un échange qui traîne.

**Le nom des fichiers est sans accents** — `pas-a-pas.md` donne `/pas-a-pas` —
comme les messages de commit du dépôt : le nom de la commande est celui du
fichier, et un caractère accentué dans un nom de commande n'est garanti nulle
part.

## Le point d'arrivée : le site répond

Le mode ne s'arrête ni à la pull request ouverte, ni à la fusion. Il va
jusqu'à **la vérification que l'application répond en production**, par
`./scripts/prod.sh`.

C'est le seul point d'arrivée qui prouve quelque chose. Une PR verte dit que les
tests passent ; une fusion dit que le workflow est parti. Ni l'un ni l'autre ne
dit que l'app est en ligne — et le rayon de souffle du dépôt est précisément là :
une seule stack, un `docker compose up` atomique, une erreur dans le bloc d'une
app fait échouer le déploiement de **toutes** les autres. S'arrêter à la fusion,
c'est rendre la main juste avant le seul moment où l'on peut casser les huit
applications qu'on n'a pas touchées.

## Les trois arrêts, et rien d'autre

En mode autonome, l'agent tranche seul et consigne. Il ne s'arrête que devant
trois gestes, choisis parce qu'aucun ne se défait :

1. **Ouvrir une app à tout Internet** — passer une `exposure` à `public`, ou de
   `private` à `google`. Le contrat le dit déjà pour le mode normal : « si tu
   hésites entre deux paliers, prends le plus fermé ; `private` se desserre en
   une ligne, l'inverse a déjà exposé les données. » Un agent autonome n'a pas
   plus de titre à trancher ça qu'un agent consultatif.
2. **Effacer des données** — supprimer ou renommer un volume nommé, écraser un
   volume en production. Le contenu d'un volume ne vit que là.
3. **Toucher à ce qui est partagé alors que ce n'était pas la demande** —
   `fabrique.yml`, `init.sh`, `lib/`, `.github/`, `.claude/`, les
   `shared_services`. La condition compte autant que la liste : si le sujet
   *est* la fabrique, ce n'est pas un débordement, c'est le travail. L'arrêt
   vise le dommage collatéral, pas le périmètre demandé.

Hors de ces trois cas, l'agent décide. **Chaque choix non évident est écrit dans
l'entrée de journal de la branche**, en anomalie `Action: arbitrage` quand il
demandait vraiment une décision humaine. C'est ce qui rend le mode relisable
après coup : le journal existe déjà, il a un vocabulaire fermé, et
`arbitrage` y signifie exactement « demande une décision humaine, pas un
correctif ».

## Ce que le mode ne change pas

Rien du rail. Le mode autonome emprunte **le même chemin** que le mode normal :
branche dédiée, entrée de journal remplie à chaud, un commit par étape vérifiée,
`./scripts/pret.sh` avant chaque commit, `./init.sh --check` avant de pousser,
`./scripts/cout.sh` avant la fin, pull request à la fin.

C'est délibéré. Un mode autonome qui se donnerait des raccourcis serait un
second chemin à maintenir, et le seul à n'être jamais relu par un humain. Le
mode ne retire aucun garde-fou : il retire les **questions**, pas les
vérifications.

**L'échec fait partie du chemin.** Contrôle rouge, CI rouge, déploiement raté :
l'agent diagnostique, répare, repousse, et recommence. Revenir vers l'utilisateur
pour un test cassé, c'est exactement l'interruption que le mode supprime.

## Ce que le mode ne peut pas régler

Les demandes d'autorisation du harnais. Elles viennent du mode de permission de
la session, pas du dépôt : un fichier de commande ne peut pas les désactiver, et
ne devrait pas pouvoir. La commande le **dit** à l'utilisateur lorsqu'elle en
rencontre une, plutôt que de laisser croire à une promesse qu'elle ne tient pas.

## Comment c'est tenu

- `./init.sh --check` vérifie la **présence** des deux fichiers de commande, à
  côté des trois agents et des deux hooks. Même raison : un outillage déclaré
  dans le contrat mais absent du clone ne se signale pas tout seul.
- `memory/travail.md` porte le détail — la liste des trois arrêts, la séquence,
  le point d'arrivée. Le fichier est déjà celui des agents et des garde-fous ;
  les modes de développement sont du même sujet.
- `CLAUDE.md` gagne une mention et **pas une ligne** : le contrat est à son
  plafond de 250 lignes, et l'anomalie 4 de la branche précédente a déjà signalé
  que le déborder est un arbitrage non tranché.

## Ce qu'on ne fait pas

- **Pas de persistance du mode entre sessions.** Le mode vaut pour la
  conversation en cours. Une session cloud est éphémère ; un mode autonome qui
  survivrait à la session serait un mode qu'on active un jour et qui décide à
  votre place un autre jour.
- **Pas de nouveau garde-fou pour vérifier que l'agent a bien obéi.** Le journal
  et le diff le disent déjà. Un contrôle automatique de l'autonomie devrait
  décider ce qu'est une question légitime, et ne saurait pas.
- **Pas de nouvel agent.** `/livrer` n'est pas un sous-agent : il conduit la
  session principale, qui est la seule à avoir le contexte de la demande.

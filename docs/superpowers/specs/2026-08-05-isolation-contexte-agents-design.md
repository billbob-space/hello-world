# Isoler le contexte des agents de développement

> Sujet de fabrique : un troisième artefact généré, un troisième agent, et les
> vérifications qui les tiennent. Validé le 2026-08-05.

## Le problème, tel qu'il se pose vraiment

La fabrique porte sept applications dans une arborescence plate. Un agent qui
vient écrire le code de l'une d'elles démarre avec le contrat racine — quatre
cents lignes de règles communes — et découvre les six autres par leur nom, dans
la liste des répertoires, dans `compose.yaml` et dans `go.work`.

**Il ne lit pas leur code**, et c'est la première chose à corriger dans l'énoncé
du problème : la pollution de contexte redoutée n'existe pas sous la forme qu'on
imagine. Ce qu'un agent porte en permanence, c'est le contrat de fabrique, qui
est commun par construction et n'a pas à disparaître.

Le vrai défaut est ailleurs, et il est double :

- **Rien ne borne l'agent.** Aucune consigne ne lui dit que son travail s'arrête
  au répertoire de son app. Il n'a donc pas de raison de ne pas aller lire
  ailleurs, ni de s'arrêter quand son changement déborde sur la stack partagée —
  alors que le déploiement est atomique et qu'un débordement casse les six
  autres apps.
- **Rien ne lui donne le contexte de son app d'un seul coup.** Pour connaître le
  port, le palier d'exposition, les volumes ou les secrets de l'app qu'il
  écrit, il ouvre `app.yml`, `compose.yaml`, `fabrique.yml`, et recoud. Trois
  fichiers dont deux sont pour l'essentiel consacrés à d'autres applications.

Les deux se corrigent avec la même pièce : un document court, propre à chaque
app, que l'outillage charge **seulement quand on touche à cette app**.

## Périmètre

**Dans le périmètre** — un artefact généré par application, un agent
supplémentaire, les contrôles qui vérifient l'un et l'autre, et les entrées de
contrat correspondantes.

**Hors périmètre, décidé explicitement :**

- **Aucune barrière technique.** Le cloisonnement repose sur la consigne donnée
  à l'agent, pas sur un mécanisme qui l'empêcherait de lire ailleurs. Les
  worktrees isolés, les listes d'outils restreintes par chemin et les
  sous-processus confinés ne sont pas retenus : ils coûtent cher et ne
  protègent de rien ici, puisque l'agent travaille de toute façon dans le clone
  courant. Ce qu'on gagne est qu'il n'a **plus de raison** de sortir.
- **Aucun découpage du contrat racine.** Les règles communes restent communes et
  restent chargées en permanence. Un agent qui ne les connaîtrait plus casserait
  le déploiement de toute la stack en croyant ne toucher qu'à son app — c'est
  précisément le risque que les garde-fous existants adressent.
- **Aucun changement aux agents `analyste` et `greffier`.** Leur invariant — pas
  d'outil d'édition, donc lançables en tâche de fond sans risque — est conservé
  tel quel. Le nouvel agent ne le partage pas, et le contrat doit le dire.
- **Aucune migration de contenu.** La notice ne reprend rien de ce qui vit déjà
  dans `PRODUCT.md` ou dans le `README` de l'app : elle y renvoie.

## Pièce 1 — la notice d'application, `apps/<nom>/CLAUDE.md`

### Pourquoi ce nom de fichier et pas un autre

Claude Code charge automatiquement un `CLAUDE.md` situé dans un sous-répertoire
**au moment où un fichier de ce répertoire est lu ou modifié**, et lui seul. Ce
comportement est exactement la propriété recherchée : la notice de `cadran` ne
pèse rien tant qu'on travaille sur `ardoise`. Aucun autre nom de fichier ne
l'obtient — un `README` n'est chargé que si quelqu'un pense à l'ouvrir.

### Un troisième artefact toujours réécrit

`init.sh` réécrit aujourd'hui deux artefacts à chaque exécution, fonction
directe des manifestes : `compose.yaml` et `go.work`. La notice devient le
troisième. Elle est **committée** comme les deux autres — un clone frais doit
l'avoir — et porte en première ligne un en-tête `GÉNÉRÉ` qui interdit l'édition
à la main.

Ce choix est ce qui rend la pièce gratuite à l'usage : il n'y a pas de troisième
document d'application à tenir à jour, puisque la notice n'a pas de contenu
propre. Tout ce qu'elle dit est déjà décidé dans `apps/<nom>/app.yml` et dans
`fabrique.yml`.

### Ce qu'elle contient

Une vingtaine de lignes, dans cet ordre :

1. **L'en-tête généré** — « GÉNÉRÉ par `init.sh` — ne pas éditer ».
2. **Le périmètre** — une phrase : ce répertoire est le périmètre de travail ;
   tout ce qui est en dehors se signale au lieu de se modifier. La liste courte
   de ce qui est en dehors : `compose.yaml`, `fabrique.yml`, `init.sh`,
   `scripts/`, `.github/`, et les autres répertoires de `apps/`.
3. **L'identité** — le nom de l'app, son URL complète (composée du nom et du
   domaine de `fabrique.yml`), son palier d'exposition **traduit en clair**
   — qui entre, pas le nom du middleware —, et si elle est déployée ou non
   (`enabled`).
4. **L'exécution** — technologie (`stack`), port, mémoire allouée, chemin et
   commande de healthcheck.
5. **Ce qu'elle garde** — ses volumes nommés sous leur **nom réel** (préfixé du
   nom de l'app), ses services annexes avec leur nom de service réel, les
   `shared_services` dont elle dépend, et les noms de secrets attendus dans
   `env`. Section omise quand l'app n'a rien de tout cela.
6. **Comment la tester** — la commande exacte, `./apps/<nom>/test.sh`.
7. **Ses documents** — renvois vers `PRODUCT.md`, `README.md` et `prp/`, avec
   une ligne disant ce que chacun porte.
8. **Les règles qui s'appliquent à son image** — une ligne de rappel (image
   multi-étapes sous 200 Mo, utilisateur non root, aucun port publié, aucun
   secret, aucun label Traefik) et le renvoi vers
   `memory/regles-imperatives.md` pour le détail.

### Le cas des applications sans manifeste

Deux répertoires — `marcq-handball` et `ramure-v2` — n'ont pas d'`app.yml` :
ce sont des applications dont le code n'est pas encore écrit, cas légitime que
le contrat prévoit. Ils reçoivent une notice **dégradée** : périmètre, nom,
renvois vers les documents, rappel des règles d'image, et une phrase disant que
le manifeste reste à écrire.

Ce n'est pas un cas marginal à traiter par acquit de conscience : c'est
exactement la situation où un agent va écrire beaucoup de code, donc celle où le
bornage sert le plus.

### Les vérifications

- **`./init.sh --check`** exige qu'une notice existe pour chaque répertoire de
  `apps/` et qu'elle soit **identique à ce que le générateur produirait**. Une
  notice désynchronisée est un **KO**, au même titre qu'un `compose.yaml`
  désynchronisé, et pour la même raison : un artefact généré qui a dérivé ment.
- **`./init.sh --add <nom>`** l'écrit, comme il écrit déjà `app.yml`,
  `.dockerignore`, `test.sh`, `README.md` et `PRODUCT.md`.
- **`./init.sh --dry-run`** affiche son diff sans l'écrire, comme pour les deux
  autres artefacts.
- **Le contrôle des documents égarés sous `docs/`** n'est pas concerné : la
  notice vit sous `apps/`, là où le contrat exige que vive tout ce qui décrit
  une app.

## Pièce 2 — l'agent `artisan`

### Ce qu'il est

Un troisième agent à côté de l'`analyste` et du `greffier`, déclaré dans
`.claude/agents/artisan.md`. On lui donne un nom d'application ; il démarre avec
un contexte neuf, lit d'abord la notice de cette application, écrit son code et
lance ses tests.

    Agent(subagent_type: "artisan")   # ecrit le code d'UNE app, ne committe pas

Ses outils : `Read`, `Edit`, `Write`, `Bash`, `Grep`, `Glob`.

### L'invariant qu'il ne partage pas, et qui doit être écrit

`memory/travail.md` énonce aujourd'hui que les agents de la fabrique n'ont pas
d'outil d'édition, et que **ce n'est pas un détail de configuration** : c'est ce
qui garantit qu'un agent lancé en tâche de fond ne peut pas modifier le dépôt
pendant qu'on travaille dessus.

L'`artisan` écrit, par définition. La règle ne disparaît pas, elle se déplace :
**l'`artisan` ne se lance jamais en tâche de fond.** L'invariant devient « aucun
agent lançable en fond ne peut modifier le dépôt », et le contrat doit porter la
distinction explicitement, sans quoi la première session qui lancera un
`artisan` en fond découvrira le problème par un arbre de travail corrompu.

### Ses trois interdits

- **Il ne sort pas du répertoire de son app.** S'il lui faut modifier
  `compose.yaml`, `fabrique.yml`, `init.sh`, la CI, l'outillage ou une autre
  application, il **s'arrête et rapporte** ce qu'il aurait fallu changer et
  pourquoi. Réparer la fabrique n'est pas son geste — même raison qui interdit
  au `greffier` de réparer ce que `pret.sh` refuse.
- **Il n'enregistre rien dans git.** Ni branche, ni `add`, ni `commit`, ni
  `push`, ni pull request : c'est le rôle du `greffier`, lancé après lui.
- **Il ne remplit pas le journal des anomalies.** Il **rapporte** en revanche ce
  qui l'a surpris, cassé ou s'est révélé faux, dans une section dédiée de sa
  réponse, pour que la session appelante l'écrive dans l'entrée de branche. Le
  journal appartient à la branche, pas au sous-agent.

Une exception nécessaire à l'interdit git : il peut **lire** l'état du dépôt
(`git status`, `git diff`) pour savoir ce qu'il a touché.

### Ce qu'il rend

Un rapport court et fixe : les fichiers touchés, le résultat des tests (la
commande et son verdict, pas son déroulé), ce qu'il n'a pas pu faire et
pourquoi, et les anomalies rencontrées. Ce format fixe est ce qui permet à la
session appelante de décider en une lecture s'il faut appeler le `greffier` ou
reprendre le travail.

## Ce qu'il faut écrire dans le contrat

- **`CLAUDE.md`** — dans l'arborescence, la notice ajoutée à la ligne de
  `apps/<nom>/` ; dans la section de démarrage, « deux artefacts toujours
  réécrits » devient trois.
- **`memory/travail.md`** — l'`artisan` ajouté à la section des agents,
  l'invariant du lancement en tâche de fond reformulé comme ci-dessus.
- **`memory/outillage.md`** — rien à changer : aucun plugin ni serveur LSP n'est
  en jeu.

Le contrat racine est déjà proche de son plafond de lignes ; les ajouts se
tiennent en quelques lignes, et le détail va dans `memory/travail.md`, ce qui est
sa fonction.

## Le piège de mise en service

**Le registre des agents est lu au démarrage de la session.** Un `artisan`
ajouté aujourd'hui ne sera invocable qu'à la session suivante. Ce n'est pas un
défaut à corriger, c'est un fait à connaître : la vérification de bout en bout
de la pièce 2 ne peut pas avoir lieu dans la session qui l'écrit, et le dire
d'avance évite d'en faire une anomalie.

## Ce que cette spec ne promet pas

Le gain en volume de contexte est **modeste** : la notice économise l'ouverture
de deux ou trois fichiers partagés, pas le contrat racine. Le gain réel est de
discipline — un agent borné par écrit, qui s'arrête au lieu de déborder sur une
stack que sept applications partagent. C'est ce second gain qui justifie la
pièce, et c'est à lui qu'il faudra la juger.

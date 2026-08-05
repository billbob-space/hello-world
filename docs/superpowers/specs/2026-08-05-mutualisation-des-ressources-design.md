# Mutualisation des ressources, et annonce des réglages serveur

> Sujet de fabrique : deux règles ajoutées au contrat, aucune ligne de code.
> Validé le 2026-08-05.

## Le problème, en deux faits

**Premier fait.** Les deux dernières applications à porter un état — `ardoise`
et `compteur` — partagent le cache de la fabrique mais déclarent chacune son
propre Postgres. Ce choix était défendable au moment où il a été fait : palier
d'exposition différent (`private` contre `google`), un seul mot de passe pour
toute une instance Postgres, et un `fabrique.yml` dont la modification
reconstruit toutes les applications. Il n'a pourtant jamais été *écrit* comme un
choix : le contrat dit « un service dont plusieurs apps ont besoin ne se
duplique pas » sans jamais faire de la duplication une exception à justifier.
Résultat mesurable : 352 Mo de bases annexes, et une mémoire engagée de
1088 Mo pour un plafond de 1024.

**Second fait.** `ardoise` et `compteur` ont besoin de `POSTGRES_PASSWORD`, dont
la valeur ne vit que côté serveur. Le nom figure dans leur `app.yml` et dans
leur `README`. Personne ne l'a dit à l'utilisateur au moment du déploiement. Le
défaut vide de `init.sh` — délibéré, pour qu'un nom manquant ne fasse pas
échouer le `compose up` de la stack entière — transforme l'oubli en panne
silencieuse : la variable arrive vide plutôt qu'absente, et Postgres refuse de
s'initialiser sans que rien n'ait signalé la cause.

## Périmètre

**Dans le périmètre** — deux règles écrites dans le contrat et ses documents de
mémoire, la rubrique correspondante dans le gabarit de `README` d'application,
et un tableau récapitulatif dans le `README` de la fabrique.

**Hors périmètre, décidé explicitement :**

- **Aucun regroupement des bases existantes.** `ardoise` et `compteur` gardent
  chacune la leur. La règle vaut pour les applications à venir. Le dépassement
  du plafond mémoire reste un constat ouvert, pas un chantier ouvert ici.
- **Aucune justification rétroactive.** Les deux applications existantes n'ont
  pas à ajouter dans leur `PRODUCT.md` la motivation qu'exige la règle A : leur
  choix est daté d'avant elle, et le présent document en tient lieu de trace.
  La règle s'applique à la prochaine application qui déclarera une ressource en
  propre.
- **Aucun garde-fou outillé.** Ni `init.sh --check`, ni la CI, ni aucun script
  ne sont modifiés. Les deux règles reposent sur le contrat, pas sur une
  vérification automatique. C'est un choix assumé : il est réversible, et poser
  un garde-fou plus tard ne demandera pas de revenir sur ce qui est écrit ici.

## Règle A — on met en commun, sauf raison écrite

### L'énoncé

Toute ressource dont une seconde application pourrait se servir — base de
données, cache, file d'attente, moteur de recherche, tout service annexe — se
déclare **une seule fois**, dans `shared_services` de `fabrique.yml`. Une
application qui déclare la sienne en propre écrit dans son `PRODUCT.md`
pourquoi elle ne pouvait pas faire autrement.

La charge de la preuve change de camp. Aujourd'hui, mutualiser est une
possibilité que personne n'a à défendre ; demain, ne pas mutualiser est une
exception qui se motive par écrit, dans le document produit de l'application,
là où le prochain agent la lira avant d'écrire une ligne de code.

### Les deux seules raisons recevables

| Raison | Ce qu'elle recouvre |
|---|---|
| **Des données qui n'ont pas le même public** | Une application en `private` ne partage pas sa base avec une application en `google` ou `public`. Une instance Postgres partagée n'a qu'un jeu d'identifiants : la mutualiser aligne la protection des données de la plus fermée sur la porte de la plus ouverte. |
| **Un contenu qui bouge au rythme de l'application** | Ce qui est mutualisé vit dans `fabrique.yml`, commun à toutes les applications : le modifier fait reconstruire toutes les images au prochain passage en CI. Acceptable pour un cache dont l'image ne change jamais ; coûteux pour une ressource dont la définition suit les versions d'une seule application. |

**Ce qui n'est pas une raison recevable**, et qu'il est inutile d'écrire : « plus
simple chacun chez soi », « je ne veux pas toucher au fichier commun »,
« l'autre application n'existe pas encore ». La première est du confort, la
deuxième est le coût normal d'une ressource partagée, la troisième se règle en
mutualisant dès la seconde application qui en a besoin.

### Le cas de la base de données, nommément

Rien dans l'outillage n'empêche aujourd'hui de déclarer un Postgres dans
`shared_services` avec son volume, et de laisser chaque application y tenir sa
propre base logique — `init.sh` le génère sans modification. La règle A rend ce
chemin le chemin par défaut dès lors que deux applications de **même palier
d'exposition** ont besoin d'une base.

Deux points de vigilance à écrire au moment où ce cas se présentera, et qui
n'appellent pas de décision aujourd'hui : le préfixe qui sépare les données de
deux applications dans une même instance — l'équivalent du préfixe de clé qui
sépare déjà `ardoise:lignes` de `compteur:valeur` dans le cache commun —, et le
fait qu'une base partagée, contrairement au cache, porte un volume dont la perte
n'est pas rattrapable.

## Règle B — dire ce que seul le serveur peut poser

### L'énoncé

Quand une application déclare un `env:`, le contrat impose **trois** annonces,
pas une :

1. **Dans le `README` de l'application** — une rubrique « À poser côté serveur »
   nommant chaque variable, son rôle, et ce qui casse si elle manque. Cette
   rubrique existe déjà en pratique dans `apps/compteur/README.md` ; la règle la
   rend obligatoire et le gabarit de `--add` la porte d'office.
2. **Dans le `README` de la fabrique** — un tableau récapitulatif, application
   par application, de tout ce qui doit être posé côté serveur. Il rejoint le
   tableau des secrets `DOCKHAND_*` déjà présent, au même endroit : celui qui
   reprend la main après des semaines n'ouvre pas six répertoires pour savoir
   où il en est.
3. **Dans la conversation, au moment de livrer le déploiement** — c'est
   l'annonce qui manquait. Au commit qui passe une application à
   `enabled: true`, l'agent dit à l'utilisateur, en français simple, les noms
   exacts à créer dans `dockhand`, qu'il en choisit lui-même la valeur, et ce
   qui se passe s'il ne le fait pas.

### Pourquoi les trois, et pas seulement les deux premières

Un document n'agit pas au bon moment. La rubrique du `README` et le tableau
récapitulatif servent celui qui *cherche* ; l'annonce en conversation sert celui
qui ne sait pas encore qu'il doit chercher. C'est exactement la situation qui a
produit le problème : la documentation était juste, complète, et personne n'a
eu de raison de l'ouvrir avant que la base ne refuse de démarrer.

### La forme de l'annonce

Elle suit la règle de réponse du contrat — français, court, l'effet plutôt que
le mécanisme :

> Avant de fusionner, il faut créer dans dockhand un réglage nommé
> `POSTGRES_PASSWORD`, avec le mot de passe de votre choix. Sans lui, la base de
> l'application refusera de démarrer, et les autres applications de la stack ne
> seront pas affectées.

Trois éléments obligatoires : le **nom exact**, le fait que la **valeur est
choisie par l'utilisateur**, et la **conséquence de l'oubli**.

## Les fichiers touchés

| Fichier | Ce qui change |
|---|---|
| `CLAUDE.md` | Règle A ajoutée à la section sur les trois sortes de services ; règle B ajoutée là où le contrat traite déjà des secrets et de la séquence en deux commits |
| `memory/services.md` | Le détail de la règle A : l'énoncé, les deux raisons recevables, les non-raisons, le cas de la base de données |
| `memory/perimetre.md` | Le détail de la règle B : les trois annonces, la forme de la troisième |
| `init.sh` | Le gabarit de `README` écrit par `--add` gagne la rubrique « À poser côté serveur ». Aucune autre modification — ni `--check`, ni génération |
| `README.md` | Le tableau récapitulatif des réglages serveur, application par application |

## Comment on saura que c'est fait

- Le contrat et les deux documents de mémoire portent les deux règles, sans se
  contredire ni se répéter mot pour mot — le contrat garde l'essentiel, la
  mémoire porte le détail, c'est la convention en place.
- `./init.sh --add` sur une application jetable produit un `README` dont la
  rubrique « À poser côté serveur » est présente.
- `./init.sh --check` reste vert, y compris son contrôle de liens morts et son
  refus d'un document de `docs/` nommant une application.
- Le `README` de la fabrique liste `POSTGRES_PASSWORD` pour `ardoise` et pour
  `compteur` : le récapitulatif est juste dès sa première version, il ne part
  pas vide.

# Architecture mémoire de la fabrique — conception

Date : 2026-08-04
Périmètre : fabrique (`CLAUDE.md`, `memory/`, `init.sh`, `.claude/`, `.github/`)
État : validé, à implémenter en deux lots

## Le problème

`CLAUDE.md` fait 750 lignes (41,8 ko), lues intégralement à l'ouverture de
chaque session. Trois chapitres en portent la moitié : la façon de travailler
(179 lignes), les champs de `app.yml` (120), les trois sortes de services (72).

Ce n'est pas un problème de style : c'est un coût fixe payé par toute session,
quel que soit son sujet, et un fichier que l'humain qui décide ne relit plus.
Le contrat a grossi parce que rien ne bornait sa taille — chaque anomalie
rattrapée y a ajouté un paragraphe, aucun ne l'a jamais quitté.

L'objectif est un contrat **court et lisible par un humain non technicien**, et
un répertoire `memory/` **écrit pour un agent**, chargé seulement quand son
sujet est en jeu. Deux lecteurs, deux registres, deux fichiers différents.

## Le critère : une règle ne sort que si un contrôle la rattrape

Sortir une règle du contrat, c'est accepter qu'une session ne la lise pas. Le
tri ne peut donc pas se faire au jugé. Le critère est vérifiable :

> Une règle quitte le contrat si et seulement si `./init.sh --check`, la CI ou
> un hook refuse déjà l'erreur qu'elle décrit.

Dans ce cas, l'oublier ne coûte rien : un KO nomme le fichier, la ligne et la
raison. Le fichier de `memory/` n'est plus la règle, c'est son explication —
lue quand on travaille le sujet, ou quand un contrôle vient de la rappeler.

Si rien ne tient la règle, elle reste sous les yeux. C'est ce qui empêche
l'allègement de devenir une perte silencieuse, et le journal des anomalies
documente déjà quatre fois ce mode d'échec : une règle non lue est enfreinte
sans un mot.

Relevé de ce que `init.sh` tient réellement aujourd'hui, vérifié dans le code :
ports interdits (KO), `USER` non root (KO), bind mounts (KO), noms et `name:`
des volumes, collisions de volumes entre apps, `chown` du chemin monté (attn),
labels `traefik.enable=false` et absence de tout autre label sur un service non
routé (KO), middleware du palier service par service (KO), lecture de
`X-Forwarded-User` en `exposure: public` (KO), `needs:` inconnu (KO), secrets
littéraux (KO), budget mémoire (attn), artefacts dérivés désynchronisés (KO),
en-tête et gabarit nu du journal (KO), liens morts et titres `##` en double
(KO). La CI ajoute la taille d'image (attn) et le `LABEL traefik` hérité (KO).

## Lot 1 — le contrat allégé et `memory/`

### Ce qui reste dans le contrat

Rien ne le vérifie, ou c'est une décision qui appartient à l'humain :

| Chapitre | Pourquoi il reste |
|---|---|
| Chapitre | Pourquoi il reste | Lignes |
|---|---|---|
| Comment tu réponds | aucun contrôle possible sur la langue et le registre | 20 |
| Arborescence, Démarrage | la porte d'entrée : où sont les choses, quelles commandes | 35 |
| Comment on travaille, **condensé** | le hook attrape `main`, rien n'attrape le rythme des commits ni un journal rempli après coup | 45 |
| Ajouter une application | l'app neuve naît désactivée, l'ordre des deux commits : rien ne l'attrape avant la CI | 29 |
| Le choix du palier d'exposition, tableau seul | un arbitrage, jamais un contrôle | 12 |
| Le rayon de souffle | le pourquoi de tous les garde-fous | 7 |
| Avant de pousser, **condensé** | une commande, `./init.sh --check` | 5 |
| Le sommaire de `memory/` | le point d'entrée vers le reste | 15 |

Soit environ 168 lignes de chapitres, plus le titre et l'introduction. Cible :
**environ 200 lignes**, contre 750.

Le chapitre « Comment on travaille » est le seul qui se scinde : la branche, le
rythme des commits, l'entrée de journal remplie à chaud et `--pret` restent ; les
deux vocabulaires fermés du journal, les agents, la fin de vie d'une branche et
le détail des hooks partent, parce que `--check` les tient.

### Ce qui part dans `memory/`

Un fichier par sujet, nommé par le sujet :

| Fichier | Contenu déplacé | Lignes reprises | Tenu par |
|---|---|---|---|
| `memory/app-yml.md` | les champs de `app.yml`, un par un, avec les quatre sections optionnelles | 120 | `--check` |
| `memory/services.md` | les trois sortes de services, `shared_services`, l'espace de noms plat | 72 | `--check` |
| `memory/volumes.md` | volumes nommés, préfixe du propriétaire, `name:`, le piège du `chown` | 70 | `--check` |
| `memory/exposition.md` | middlewares des trois paliers, `X-Forwarded-User`, contraintes du palier public | 45 | `--check` |
| `memory/regles-imperatives.md` | ports, `USER` non root, taille d'image, `LABEL traefik`, logs sur la sortie standard | 32 | `--check` + CI |
| `memory/perimetre.md` | ce qui ne t'appartient pas, les trois refus et leur alternative | 35 | `--check` |
| `memory/outillage.md` | plugins, serveurs LSP, `cloud-setup.sh`, `settings.local.json` | 55 | `--check` + hook |
| `memory/journal.md` | les deux vocabulaires fermés et l'en-tête, les agents `analyste` et `greffier`, la fin de vie d'une branche, le détail des deux hooks | 110 | `--check` |

Soit environ 540 lignes déplacées pour 750 de départ, ce qui recoupe les 200
lignes visées pour le contrat.

Le contenu est déplacé, pas réécrit : la valeur de ces pages est dans les
pièges qu'elles décrivent, tous payés par une anomalie réelle.

`memory/journal.md` est le cas le plus net du critère : `--check` compte les
`### ` d'une entrée et exige autant de champs `Detecte par` et `Action` dans le
vocabulaire, refuse un gabarit nu committé et un en-tête incomplet. Le
vocabulaire n'a donc pas besoin d'être sous les yeux — il est rappelé par le KO,
et le gabarit ouvert par `--branche` le porte déjà en commentaire.

### La forme d'un fichier de `memory/`

Le lecteur est un agent. La forme suit.

Deux lignes d'en-tête, vérifiées, immédiatement après le titre `#` :

```
Quand lire : avant d'ajouter ou de renommer un volume dans un app.yml
Tenu par : --check — noms, collisions, chown
```

`Quand lire` est en prose libre : c'est la condition de déclenchement, elle doit
se reconnaître d'un coup d'œil depuis le sommaire.

`Tenu par` a un **vocabulaire fermé** — `--check`, `CI`, `hook`, `rien` — suivi
d'un tiret et de ce qui est vérifié. Plusieurs valeurs se séparent par `+`.
**`rien` est refusé dans `memory/`** : c'est le critère de sortie rendu
exécutable. Une règle que rien ne rattrape ne peut pas quitter le contrat.

Le corps est dense : puces impératives, tableaux pour les variantes, et chaque
piège en trois temps — symptôme, cause, parade. Pas de prose d'explication, pas
de pédagogie, pas de répétition d'un fichier à l'autre. Ce qui vaut pour le
contrat — un sujet, une seule source de vérité — vaut ici : un même piège ne
s'écrit qu'une fois, et les autres fichiers y renvoient.

### Le sommaire

En fin de contrat, un tableau à trois colonnes — sujet, fichier, quand le lire —
précédé d'une consigne impérative : avant d'agir sur un de ces sujets, lire son
fichier. Le sommaire est la seule chose qui reste chargée en permanence ; il
doit donc tenir en une quinzaine de lignes.

### Les vérifications ajoutées

Dans `init.sh`, au même endroit que les contrôles documentaires existants :

1. **Sommaire exact** — le sommaire du contrat liste exactement les fichiers
   présents dans `memory/`, ni manquant ni fantôme. KO. Même esprit que le bloc
   `volumes:` de premier niveau, qui doit déclarer exactement les volumes
   montés.
2. **En-tête présent** — chaque `memory/*.md` porte `Quand lire :` et
   `Tenu par :`. KO.
3. **`Tenu par` valide** — vocabulaire fermé, et `rien` refusé. KO.
4. **Documents** — les contrôles existants (liens morts, deux titres `##`
   identiques dans un même fichier) s'étendent à `memory/*.md` : il suffit
   d'ajouter le glob aux deux boucles qui listent déjà `README.md CLAUDE.md
   PRODUCT.md apps/*/*.md journal/*.md`.
5. **Plafond du contrat** — au-delà de 250 lignes, `CLAUDE.md` déclenche un
   avertissement. Ce n'est pas un KO : un contrat à 260 lignes n'est pas un
   défaut de déploiement. C'est la seule chose qui l'empêchera de regrossir
   jusqu'à 750.

Les fichiers de `memory/` sont **écrits à la main et jamais générés**. `--check`
en vérifie la forme, jamais le contenu. C'est ce qui permet de corriger une
phrase sans relancer un générateur.

## Lot 2 — `init.sh` cesse d'être le propriétaire de l'outillage

`init.sh` fait 3 848 lignes, dont **environ 870 ne sont que des copies de
fichiers déjà versionnés** : le workflow de CI (382), les deux agents (149), le
script de setup cloud (97), le rapport de plugins (77), les deux hooks (79), le
gabarit de PR (26), les réglages Claude (61). `--check` refuse que ces fichiers
diffèrent de la copie portée par le générateur.

Cette architecture n'a de sens que pour amorcer un dépôt vide. Ce scénario ne se
reproduira pas. Ce qu'elle coûte, en revanche, se paie à chaque correction :
changer une phrase dans un agent demande d'éditer un texte enfoui dans un script
bash, puis de relancer le générateur. Et l'argument « cela garantit que tout
clone a le même outillage » ne tient pas : ce qui le garantit, c'est git.

### Ce qui reste généré

- **`compose.yaml`** — vraiment calculé depuis les manifestes, c'est sa raison
  d'être et le verrou du rayon de souffle.
- **`go.work`** — dérivé de la présence des modules Go.
- **L'échafaudage `--add`** — écrit une fois par app, jamais relu ensuite.

### Ce qui devient un fichier ordinaire

| Artefact | Décision |
|---|---|
| `.github/workflows/build.yml` | fichier ordinaire. Les quatre valeurs venues de `fabrique.yml` (registre, org, dépôt, taille max) sont lues au runtime par une étape shell ; la liste des apps de l'entrée `toutes` devient un glob sur `apps/*/app.yml`. Le workflow ne porte plus aucune valeur figée. |
| `.claude/settings.json` | fichier ordinaire. La dérivation automatique de la liste de plugins disparaît : elle ne sert qu'à l'arrivée d'un langage nouveau, soit une fois tous les plusieurs mois. |
| `.claude/agents/*.md`, `.claude/garde-branche.sh`, `.claude/garde-commit.sh`, `.claude/check-plugins.sh`, `.claude/cloud-setup.sh`, `.github/pull_request_template.md` | fichiers ordinaires, édités directement. |

### Les vérifications qui remplacent la comparaison au gabarit

Une comparaison au gabarit vérifie une égalité inutile ; ce qui compte est une
propriété :

- le workflow existe, son job `contrat` lance `./init.sh --check`, et il ne
  porte aucune occurrence figée du registre, de l'org ou du dépôt — sinon un
  changement de `fabrique.yml` le rendrait faux en silence ;
- les scripts de `.claude/` existent et portent le bit exécutable — un hook non
  exécutable ne garde rien ;
- `.claude/settings.json` ne contient aucun bloc `env` (règle existante), et un
  `stack` déclaré par une app sans son plugin LSP dans la liste déclenche un
  avertissement ;
- `--check` ne compare plus aucun contenu d'outillage.

Cible : `init.sh` autour de **2 900 lignes**.

## Ce que cette conception ne fait pas

- **Pas de rappel automatique** au moment d'éditer un fichier (un hook qui
  glisserait le bon fichier de `memory/` sous les yeux). Ça dépend du harnais,
  ça ne couvre rien de ce qui ne passe pas par un fichier, et le sommaire plus
  le critère de sortie suffisent d'abord. À rouvrir si l'usage montre que les
  fichiers ne sont pas lus.
- **Pas de découpage de `memory/` en sous-répertoires.** Huit fichiers plats se
  lisent ; une arborescence demanderait un index de plus.
- **Pas de réécriture du contenu déplacé.** Le déplacement doit être relisable
  comme un déplacement.
- **Pas de génération de `CLAUDE.md` ni de `memory/` par `init.sh`.** C'est
  l'inverse de ce que le lot 2 corrige.

## Comment on mesure que c'est réussi

Lot 1 :

- `wc -l CLAUDE.md` ≤ 250 ;
- `ls memory/*.md` et le sommaire du contrat coïncident, vérifié par `--check` ;
- aucun `Tenu par : rien` dans `memory/` ;
- `./init.sh --check` vert, CI verte ;
- aucune règle disparue : chaque chapitre déplacé est retrouvable, et le total
  des lignes du contrat plus `memory/` reste du même ordre que les 750 de
  départ.

Lot 2 :

- `wc -l init.sh` autour de 2 900 ;
- `./init.sh --check` vert, CI verte, déploiement inchangé ;
- une correction dans un agent ou un hook ne demande plus de relancer
  `./init.sh`.

## Risques et parades

**Une règle sort alors que rien ne la tient.** C'est le risque principal. Parade :
`Tenu par : rien` refusé par `--check`, donc par la CI.

**Le sommaire dérive du contenu de `memory/`.** Parade : vérification 1, KO.

**`--check` ne dira plus qu'un hook a été vidé de son contenu.** Accepté : le
fichier est versionné, un diff le montre en relecture, et un hook vide se voit à
la première édition sur `main`. Le contrôle perdu ne valait que contre une
modification volontaire non relue.

**Le lot 2 touche la CI, donc le déploiement de toutes les apps.** Parade : il
part après le lot 1, sur une branche séparée, et la CI est le juge — un workflow
faux échoue avant de déployer.

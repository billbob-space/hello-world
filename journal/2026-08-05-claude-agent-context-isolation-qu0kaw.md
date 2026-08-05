# 2026-08-05 — claude/agent-context-isolation-qu0kaw

Branche : `claude/agent-context-isolation-qu0kaw`
Périmètre : fabrique
Mode : `chaud`

## Anomalies

### 1. Un artefact généré peut mentir sans qu'aucun contrôle ne le voie

**Symptome** — La notice générée de `ardoise` ne mentionnait aucun volume, alors que
l'app en a un. Celle des deux apps sans manifeste annonçait avoir été générée « depuis
`apps/ramure-v2/app.yml` », fichier qui n'existe pas. Les deux fautes ont traversé
`./init.sh --check` au vert, et les cinq cas de test de la notice aussi.

**Cause** — `--check` valide un artefact généré en le comparant à ce que le générateur
produirait. Une erreur *du générateur* est donc invisible par construction : le
fichier est exactement ce qu'on attend de lui, et ce qu'on en attend est faux. Pour le
volume, la cause de fond est que `A_VOLUMES` était vide : le volume d'`ardoise` est
déclaré par son service annexe, pas par l'app, alors que son nom réel est bien préfixé
par l'app — c'est celui-là qui se sauvegarde.

**Detecte par** — `auteur`

**Action** — `comportement` — un générateur nouveau se relit sur une sortie réelle, la
plus chargée du dépôt ; la comparaison au générateur ne prouve que la stabilité.

### 2. Le plan citait des valeurs au lieu de les lire

**Symptome** — Le cas de test écrit dans le plan attendait `https://cadran.billbob.ovh`.
Le domaine de la fabrique est `apps.billbob.ovh` : le test aurait échoué sur une
notice pourtant correcte.

**Cause** — Le plan a été rédigé en citant de mémoire une valeur qui vit dans
`fabrique.yml`, à un moment où le fichier avait déjà été ouvert pour autre chose.

**Detecte par** — `auteur`

**Action** — `comportement` — une valeur qui vit dans un manifeste se recopie depuis
le manifeste au moment de l'écrire, jamais de mémoire.

### 3. Le découpage du plan séparait deux choses indissociables

**Symptome** — Le plan confiait `repertoires_apps()` à la tâche 2. En écrivant la
tâche 1, la fonction s'est imposée immédiatement : `liste_derives()` doit énumérer
tous les répertoires de `apps/`, pas seulement ceux qu'`discover_apps` retient. Les
tâches 1 et 2 ont fusionné en un seul commit.

**Cause** — Le plan a découpé par *cas fonctionnel* — « les apps normales », puis
« les apps sans manifeste » — alors que le code se découpe par *point d'entrée* : une
seule fonction d'énumération sert les deux cas, et la scinder aurait produit un état
intermédiaire où `--check` exige une notice pour cinq apps sur sept.

**Detecte par** — `auteur`

**Action** — `comportement` — un plan se découpe sur les fonctions qu'il crée, pas sur
les cas qu'elles traitent ; deux cas d'une même fonction sont une seule tâche.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-05 à 17:59 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 335 | 0,00 $ |
| Écriture de cache | 655 045 | 2,96 $ |
| Lecture de cache | 19 032 382 | 8,89 $ |
| Sortie | 153 417 | 3,21 $ |
| **Total** | **19 841 179** | **15,07 $ — 13,09 €** |

<!-- cout-total: 19841179 -->
<!-- /cout -->

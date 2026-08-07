# Les PRP de marcq-handball

Onze documents d'implémentation, dérivés du PRD
[`apps/marcq-handball/PRODUCT.md`](../PRODUCT.md).

**Commence par [`00-ossature.md`](00-ossature.md).** C'est le contrat technique
commun — arborescence, format de `programme.json`, interface de `domaine.js`,
clés `localStorage`, routes HTTP, règles de dates. Aucun PRP ne s'exécute sans
l'avoir lu, et aucun n'introduit un nom qui n'y figure pas sans le déclarer.

## Le niveau de découpe, et pourquoi celui-là

**Un PRP = une branche `marcq-handball/<sujet>` = une pull request = un état
déployable de plus.** La frontière tombe là où un relecteur pourrait accepter
l'un et refuser son voisin, et où le livrable tient dans une phrase vérifiable.

**Une exception, et une seule : le PRP 01.** Il porte deux branches et deux pull
requests — `marcq-handball/socle` puis `marcq-handball/activation` — et deux
commits n'y suffiraient pas : **sur une pull request, la CI construit sans
publier**. L'image n'existe donc sur le registre qu'une fois la première PR
fusionnée, et l'application ne peut entrer dans le compose qu'après. C'est la
séquence « construire d'abord, brancher ensuite » du contrat, portée à l'échelle
de la PR, et c'est le seul PRP qui la traverse.

Ce n'est donc pas un PRP par item du PRD : le socle et le programme n'y sont pas
numérotés alors qu'ils portent tout le reste, tandis que les items 3, 4 et 6 du
lot 1 ne se relisent pas séparément — ils décrivent un seul geste, cocher.

Les deux découpes écartées : un PRP par item du PRD, qui produit trois documents
qu'on ne peut pas relire seuls ; un PRP par lot, dont le premier contiendrait
cinq écrans et ne s'exécuterait pas en une passe.

## Ce qu'ils couvrent

### Lot 1 — en ligne sous 48 h

| PRP | Branche | Ce qui devient vrai |
|---|---|---|
| [01](01-socle.md) | `socle` | L'URL répond. L'app est dans la stack, l'image est publiée, `--check` est vert. |
| [02](02-programme.md) | `programme` | Le programme est une donnée vérifiée, le domaine une fonction pure. Sept assertions verrouillent la saisie. |
| [03](03-entree.md) | `entree` | L'enfant ouvre le lien, donne son prénom, arrive sur sa séance. |
| [04](04-seance.md) | `seance` | L'enfant coche, ça persiste, le passé se rattrape et l'avenir reste fermé. |
| [05](05-perso.md) | `perso` | L'enfant lit ce qu'il a accompli : progression, volume, calendrier. |
| [06](06-recompenses.md) | `recompenses` | C'est plaisant à ouvrir, et utilisable sans un seul mouvement. |

### Lot 2 — dès que le lot 1 est en ligne

| PRP | Branche | Ce qui devient vrai |
|---|---|---|
| [07](07-classement-api.md) | `classement-api` | Le serveur tient un classement qui survit à un redéploiement. |
| [08](08-rejoindre.md) | `rejoindre` | L'enfant rejoint le classement en connaissance de cause, ou refuse sans rien perdre. |
| [09](09-equipe.md) | `equipe` | Podium, position, jauge de groupe — et personne n'est nommé dernier. |
| [10](10-ressenti-et-coach.md) | `ressenti-et-coach` | Trois émojis en fin de séance, et le coach voit l'état de son groupe. |

### Lot 3 — avant le 21 août

| PRP | Branche | Ce qui devient vrai |
|---|---|---|
| [11](11-bilan.md) | `bilan` | Le 22 août, l'app bascule sur le bilan au lieu de mourir en silence. |

## L'ordre d'exécution

```
01 socle ──┬─> 03 entree ──> 04 seance ──┬─> 05 perso ──> 06 recompenses
           │                             │
02 programme┘                            └─> 10 ressenti+coach
                                         │
07 classement-api ──> 08 rejoindre ──> 09 equipe
                                         │
                                      11 bilan
```

01 et 02 se mènent en parallèle — l'un est du déploiement, l'autre de la donnée
pure. **04 est le goulot du lot 1** : trois PRP en dépendent.

## Les verrous, et qui les lève

| Verrou | PRD | Qui tranche | Bloque |
|---|---|---|---|
| ~~Volume persistant pour les scores~~ | §12.1 | — | **Levé le 2026-08-06** : le volume appartient à l'app et se déclare dans `app.yml`, `init.sh` sait le monter. Rien à attendre |
| Page 3 sur 3 de la note du coach | §12.3 | le coach | **02**, avant le 17 août |
| Le coach regardera-t-il son écran ? | §15.3 | le coach | **10** en entier |

**Le verrou §12.2 du PRD n'en est pas un.** Le PRD affirme que `./init.sh
--check` refuse l'état par utilisateur en `exposure: public` et que le lot 2
exige de desserrer cette règle. Vérification faite sur `init.sh:1444-1452` : la
règle refuse exactement une chose — qu'un fichier suivi de
`apps/marcq-handball/`, hors `.md`, contienne la chaîne `x-forwarded-user`. Le
classement, réduit à des pseudonymes, des scores et un code à 4 chiffres, ne lit
jamais cet en-tête. Rien n'est à desserrer.

## Où on en est

**Les onze PRP sont livrés.** Le 2026-08-06, en trois passes.

| Lot | État |
|---|---|
| **Lot 1** — PRP 01 à 06 | en ligne : https://marcq-handball.apps.billbob.ovh |
| **Lot 2** — PRP 07 à 10 | livré : le classement côté serveur et son volume, l'écran pour le rejoindre, le podium et la position, le ressenti et la page du coach |
| **Lot 3** — PRP 11 | livré : le bilan du 22 août |

**Livrés ne veut pas dire à jour.** Sept changements sont arrivés après, le
7 août, sans passer par un PRP — trois d'entre eux déplacent le périmètre. Ces
onze documents décrivent donc le travail *planifié*, pas l'état de
l'application : celui-ci se lit dans le PRD, dont le § 16 tient la liste des
ajouts postérieurs. Un PRP livré ne se rouvre pas pour les y ajouter ; il est le
compte rendu d'une intention, à sa date.

**Deux verrous restent ouverts, et aucun n'est technique.**

- **Le coach regardera-t-il son écran ?** (PRD §15.3) Le PRP 10 est le seul dont
  la réponse pouvait être « on ne le fait pas ». Il a été livré parce que la
  moitié serveur l'était déjà depuis le PRP 07 et que le coût restant était
  faible ; si la réponse est non, ce sont les deux livrables — le ressenti et la
  page — qu'il faut retirer ensemble.
- **La page 3 sur 3 de la note du coach** (PRD §12.3), avant le 17 août. Rien
  dans le code n'en dépend : `programme.json` gagne des séances, tous les
  dénominateurs suivent, et les identifiants déjà cochés restent valides. Seuls
  les sept totaux attendus des tests se recalculent.

**L'arbitrage du PRP 09 est reporté dans le PRD** — §7.5 et §9 portent désormais
*« le dénominateur inclut celui qui regarde »* : le dénominateur affiché à un
non-participant vaut `participants + 1`. Sans cette phrase, le prochain lecteur
aurait pris l'écran pour un défaut, le §7.5 disant « 3e sur 9 » sans la préciser.

## Ce que les PRP ont appris sur eux-mêmes

Trois PRP sur onze contenaient une contradiction interne — un bloc de code qui ne
passe pas un test dicté deux paragraphes plus haut, deux motifs différents pour
la même validation. La cause est toujours la même : **un PRP est relu comme de la
prose, jamais exécuté**. La parade tient en un geste, et il est dans le journal :
appliquer les blocs de code d'un PRP et lancer ses blocs de test avant de figer
le document.

Deux PRP figeaient aussi une lecture du contrat de la fabrique à leur date
d'écriture — le PRP 07 demandait d'écrire une demande de volume dans un `README`
que le contrat interdit désormais d'écrire. Relis le contrat avant d'appliquer
une consigne qui parle de la fabrique.

## Deux profondeurs, et pourquoi

Les PRP du **lot 1 sont exécutables** : tâches, tests écrits avant le code, code
réel, commandes exactes, commits. Un agent les applique sans rien décider.

Les PRP des **lots 2 et 3 sont des contrats** : objectif, interfaces complètes,
règles métier citées, critères d'acceptation, verrous en tête. Trois de leurs
dépendances ne sont pas tranchées ; y écrire du code détaillé serait du travail
à jeter, et un faux détail se relit comme une décision prise.

# Ce que la fabrique a coûté, et ce que son journal a appris

Relevé le 7 août 2026, à la fin du projet `marcq-handball`. Deux mesures, une
seule source : les entrées de `journal/`. Rien ici n'est propre à une app — les
constats valent pour la prochaine.

## 1. Les jetons

### Ce qu'on sait, et ce qu'on ne sait pas

**Tous les chiffres de cette section se refont par `./scripts/jetons.sh`.** Ils
datent du 7 août et bougeront à chaque branche ; c'est la commande qui fait
foi, pas eux.

Quatorze entrées de journal sur vingt-quatre portent un relevé de coût, pour
**1 171 053 726 jetons** cumulés. Mais seules **six** portent le détail par tour
(`<!-- cout-detail -->`, ajouté après coup) : tout ce qui suit se calcule sur ces
six branches — 1 537 tours, 361 972 689 jetons, **227,63 $**. Les huit autres ne
rendent qu'un total, et rien ne les reconstitue : le conteneur qui portait la
conversation a disparu. `./init.sh --check` les compte et le dit.

Une nuance qui explique un écart de 7 $ avec la première version de ce bilan :
les tours passés sur un modèle absent de `fabrique.yml` sont comptés en jetons
et **pas en argent** — c'est la règle du contrat, et `jetons.sh` la suit là où
le calcul à la main les avait facturés au tarif du voisin.

**Première leçon, et elle ne concerne pas les jetons** : une mesure d'outillage
s'écrit dans sa forme définitive dès le premier relevé, ou les premières
branches restent muettes pour toujours.

### Où part l'argent

| Poste | Coût | Part |
|---|---:|---:|
| Écriture de cache | 38,26 $ | 17 % |
| **Lecture de cache** | **170,62 $** | **75 %** |
| Sortie | 18,76 $ | 8 % |

**97 % des jetons facturés sont du contexte relu.** Écrire moins ne change
rien — la sortie entière pèse 8 %. Le seul levier est le nombre de tours
multiplié par la taille du contexte à chaque tour.

### Les quatre leviers, du plus sûr au plus discutable

**1. L'amorce, relue à chaque tour — 46,04 $, 20 % de la facture.**
Contrat, outillage et définitions d'outils pèsent 55 000 à 68 000 jetons selon
la branche, écrits une fois par session puis relus à chaque échange — près de
cent millions de jetons de relecture pure. Le contrat n'y est presque pour rien — `CLAUDE.md`
fait 13,8 ko, soit ~4 000 jetons, 7 % de l'amorce. **Le reste est de
l'outillage** : treize plugins déclarés dans `.claude/settings.json`, plus les
connecteurs du compte, chacun payant ses définitions d'outils à chaque tour de
chaque session. Une branche qui touche une app Go n'a besoin ni de Canva ni de
Gmail. C'est le levier le mieux compris et le moins exploité.

**2. Les tours courts — 112,83 $, 50 % de la facture.**
877 tours sur 1 537 (57 %) sortent moins de 300 jetons : un appel d'outil nu.
Ils coûtent la moitié de tout, presque uniquement en relecture de contexte.
Un `ls` dans une session de 400 000 jetons coûte 0,20 $, quel que soit ce qu'il
affiche. **Grouper les appels d'outils indépendants dans un même tour** divise
directement ce poste ; c'est la seule optimisation qui ne coûte rien en qualité.

**3. La croissance du contexte — jusqu'à 32 % théoriques.**
Les deux branches de `marcq-handball` ont atteint 566 161 et 652 382 jetons de
contexte, pour 568 et 454 tours. Le coût d'une session croît comme le carré de
sa longueur : chaque tour paie tout ce qui précède. Simulation en tranches de
120 tours : environ un tiers de la facture, soit **75 $ économisés**. Le chiffre est
optimiste — il ne compte pas la relecture des fichiers qu'une session neuve doit
refaire — mais l'ordre de grandeur tient, et il dit qu'une session très longue
se paie deux fois.

**4. Les sous-agents — jamais utilisés.**
**0 tour de sous-agent sur 1 537.** La fabrique définit pourtant trois agents
(`analyste`, `artisan`, `greffier`) dont c'est précisément la raison d'être :
l'`artisan` lit et écrit dans le contexte *de l'agent*, pas dans celui de la
session, et ne rend qu'un résumé. Un chantier de 60 tours mené par l'artisan
laisse 1 tour dans le contexte principal au lieu de 60. C'est le levier 3 sans
son inconvénient — la mémoire du travail reste dans la session principale.

### Ce qu'il ne faut pas faire

Raccourcir les réponses, les messages de commit ou les documents : 8 % de la
facture, et c'est le poste qui porte toute la valeur qui survit à la session.

## 2. Le journal

148 anomalies sur 24 entrées, au 7 août — `./init.sh --check` en donne le
compte à jour. Distribution des actions : `comportement` 42, `garde-fou` 35,
`rien` 29, `contrat` 23, `arbitrage` 12, `outillage` 7. Distribution des
détections : `auteur` 81, `utilisateur` 25, `test` 18, `relecture` 17,
`production` 3, `compilateur` 2, `CI` 2.

*Ces comptes se refont par le motif ancré que `--check` utilise —
``^\*\*Action\*\* — `<vocabulaire>` `` — et jamais par « le premier mot entre
accents graves de la ligne » : dix lignes portent un autre terme en tête de leur
explication, et le filet large les compte comme des valeurs.*

**Le compilateur n'attrape que deux fois, l'utilisateur vingt-cinq.** C'est le
signe d'un projet dont l'essentiel du risque est dans le produit et la
documentation, pas dans le typage.

### Les quatre familles qui reviennent, et ce qui manque à chacune

**A. Un PRP est relu comme de la prose, jamais exécuté — 7 occurrences.**
Anomalies 2 à 6 de `...-phases-1yk38x`, 4 et 5 de `...-app-7zqifi` : le bloc de
code dicté par un PRP ne passe pas le test dicté deux paragraphes plus haut ;
un motif de validation est donné deux fois, différemment. L'action `contrat` a
été écrite deux fois, sans jamais devenir un geste.
*Ce qui manque* : appliquer les blocs de code d'un PRP et lancer ses blocs de
test **avant** de figer le document. Aucun outil ne le fait ; le faire à la main
suffirait.

**B. Un garde-fou de source attrape autre chose que sa cible — 5 occurrences.**
Un test qui cherche la sous-chaîne `ip` dans du base64 aléatoire échoue une fois
sur trois ; un commentaire fait tomber le garde-fou qu'il explique, trois fois ;
une apostrophe dans un commentaire casse la liste de la coque hors ligne.
*Ce qui manque* : la technique du filet large est bonne, mais un motif de source
se conçoit en se demandant **ce qu'il attrape d'autre** — chercher `"ip"` avec
ses guillemets, ignorer les commentaires, viser une clé JSON et non une suite de
lettres.

**C. Un garde-fou devenu vide, et rien ne le signale — 3 occurrences.**
Un garde-fou de style ne gardait plus rien depuis le PRP 04 ; la barre d'onglets
débordait de l'écran depuis le PRP 05 sans qu'aucun test ne puisse le voir.
*Ce qui manque* : un test qui n'échoue jamais sur aucune entrée est un test
mort. Le vérifier demande une seule chose — prouver que le motif attrape encore
un cas volontairement fautif.

**D. Un document affirme le contraire de ce que l'app fait — 7 occurrences.**
Toute la branche `...-oem1sp` : le PRD affirmant l'inverse du code, une
procédure d'ajout d'app en trois copies dont deux fausses, `--check` décrit deux
fois dans le README. Deux de plus le 7 août (§ 1 de l'entrée du jour).
*Ce qui existe déjà* : `pret.sh` avertit quand une app reçoit du code neuf sans
que son `PRODUCT.md` bouge — c'est la parade née de cette famille.
*L'angle mort qui reste, et ce n'est pas celui qu'on croit* : étendre cet
avertissement au `README.md` ne servirait à rien. La dérive trouvée le 7 août —
une récompense décrite alors qu'elle venait d'être retirée — est arrivée dans un
commit où le `README.md` **a bougé de 85 lignes**. Un garde-fou qui regarde si
un fichier a été touché ne voit pas un document mis à jour à moitié. Ce qui le
voit est un test qui lit ce que le document **dit** : l'app le fait déjà pour le
texte du § 7.4 du PRD, jamais pour ses nombres.

### Ce qui se transporte à la prochaine app

1. **Grouper les appels d'outils** — la moitié de la facture est dans des tours
   qui ne produisent rien d'autre qu'un appel.
2. **Confier un chantier à l'`artisan`** plutôt que de le mener dans la session
   principale, et mesurer l'écart : c'est le seul levier non testé.
3. **N'activer que l'outillage utile à l'app** ; l'amorce est relue à chaque
   tour, pas une fois.
4. **Exécuter un PRP avant de le figer** — la famille A n'a jamais été outillée.
5. **Prouver qu'un garde-fou de source attrape encore quelque chose** — sinon il
   ne garde plus rien, et sans bruit.
6. **Faire lire les documents par les tests** — leurs nombres sont calculables
   depuis les données de l'app ; ceux qui ne le sont plus doivent faire échouer
   quelque chose.

Le plan qui les met en œuvre, avec le test de validation de chacun :
`docs/superpowers/plans/2026-08-07-gardes-documentaires-et-mesure-des-jetons.md`.

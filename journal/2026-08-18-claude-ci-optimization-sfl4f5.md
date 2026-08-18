# 2026-08-18 — claude/ci-optimization-sfl4f5

Branche : `claude/ci-optimization-sfl4f5`
Périmètre : fabrique
Mode : `chaud`

## Anomalies

### 1. La CI dure dix minutes, et personne ne mesurait où

**Symptome** — l'utilisateur signale une CI « extraordinairement longue ». Mesure
sur le run 32162296876 (push sur `main`, 9 min 49 s) : le job
`tests-de-l-outillage` occupe 8 min 12 s à lui seul, en quatre scripts joués en
séquence — `test-init.sh` 5 min 30, `test-cout.sh` 21 s, `test-pret.sh` 2 min 13,
`test-jetons.sh` 2 s. Tout le reste du graphe — `contrat` 19 s, la matrice `test`
des neuf apps, la matrice `build` des neuf images — est terminé à 2 min 15. Le job
`deploy`, qui a `tests-de-l-outillage` dans ses `needs`, attend donc six minutes
sans rien faire.

**Cause** — le job qui teste l'outillage a grossi script par script sans que rien
ne mesure sa durée. Il est resté un job unique et séquentiel là où ses quatre
scripts sont indépendants, et il verrouille `deploy`.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — aucun contrôle ne dit qu'un job de CI dépasse un
plafond de durée ; la dérive s'installe sans signal.

### 2. Le test le plus lent passait 209 secondes sur 210 dans un controle dont il ignore le verdict

**Symptome** — `test-pret.sh` mettait 2 min 13 en CI pour dix cas rigoureusement
equivalents : 20 s chacun, aucun cas cher. Chronometrage interne : 99,4 % de
chaque cas est le `./init.sh --check` que `scripts/pret.sh` lance a la ligne 62.
Or aucune des dix assertions ne regarde ce verdict — elles ne cherchent qu'une
ligne d'avertissement dans la sortie, et l'en-tete du fichier le disait deja :
« on n'observe que cette ligne, jamais son code de sortie ».

**Cause** — « lancer `pret.sh` en entier » etait un choix delibere et juste — le
chemin reel est celui ou une variable renommee ailleurs casse le garde-fou — mais
personne n'avait remarque que le payer DIX fois n'achete rien de plus que le
payer une. Une doublure d'`init.sh` dans le bac a sable, sauf pour un cas qui
garde le vrai binaire, ramene le fichier a 29 s.

**Detecte par** — `auteur`

**Action** — `rien` — reparee ; le cout venait d'un effet de bord, pas d'une regle
manquante.

### 3. La branche verte de pret.sh n'avait jamais ete exercee

**Symptome** — dans un bac a sable neuf, `./init.sh --check` echoue TOUJOURS :
`compose.yaml` desynchronise, `CLAUDE.md` de l'app factice absent. La ligne
`ok "contrat respecte"` de `scripts/pret.sh` etait donc morte pour la suite de
tests, qui n'a jamais pu la voir s'imprimer.

**Cause** — le bac est construit pour tester un autre garde-fou, et son etat
rouge est un effet de bord accepte. Il fallait pouvoir rendre un verdict vert a
volonte pour l'atteindre — ce que la doublure de l'anomalie 2 permet, et c'est sa
seconde raison d'etre. Deux cas neufs couvrent desormais les deux verdicts ; le
fichier passe de dix a douze cas en tournant sept fois plus vite.

**Detecte par** — `auteur`

**Action** — `rien` — reparee dans le meme commit.

### 4. test-jetons.sh ne verifie pas les nombres qu'il existe pour verifier

**Symptome** — `scripts/jetons.sh` sabote de deux facons independantes — compteur
de tours qui n'incremente plus, total de jetons qui ne s'accumule plus — laisse
`test-jetons.sh` a « 9 reussi(s), 0 echec(s) ». Verifie sur la version d'origine
du fichier, avant toute modification de cette branche : l'aveuglement preexiste,
il n'a pas ete introduit ici.

**Cause** — ses neuf cas cherchent des MOTIFS dans la sortie, jamais des valeurs :
ils prouvent que le rapport a la bonne forme, pas qu'il porte les bons chiffres.
Or la raison d'etre de ce fichier, ecrite dans le workflow, est que `jetons.sh`
« rend des nombres a sept chiffres qu'aucune relecture ne verifie a l'oeil ». La
garantie annoncee n'est pas celle qui est tenue. `test-cout.sh` fait l'inverse et
montre la forme juste : son premier cas est un temoin qui compare un total a
1115, precisement pour qu'un `cout.sh` rendant zero partout ne passe pas au vert.

**Detecte par** — `auteur`

**Action** — `garde-fou` — il manque a `test-jetons.sh` un temoin chiffre sur le
modele de celui de `test-cout.sh`. Hors du sujet de cette branche, qui optimise
la duree de la CI et non la qualite de ses tests : signale, pas corrige ici.

### 5. Une suite de tests qui perd trente-cinq cas sur trente-six et s'affiche verte

**Symptome** — premiere version parallelisee de `test-init.sh` : « 1 reussi(s),
0 echec(s) ». Aucun cas rouge, aucun message d'erreur, code de sortie 0. Trente-
cinq cas sur trente-six avaient disparu sans laisser de trace.

**Cause** — le compteur de fiches etait appele en substitution de commande,
`f=$(numero)`, si bien que son `IDX=$((IDX+1))` tournait dans un sous-shell et
etait perdu au retour. Les trente-six cas ont donc ecrit dans la meme fiche, et
le decompte des verdicts a lu un seul temoin. Le meme piege — une affectation
faite dans `$( )` ne survit pas — avait deja ete rencontre le meme jour sur le
bac partage de `test-cout.sh` : deux fois dans une seule branche, sur deux
fichiers sans rapport.

Ce qui l'a attrape n'est pas une relecture mais un controle ecrit *avant* d'en
avoir besoin, par simple mefiance envers le parallelisme : compter les cas
lances, et refuser que la somme des verdicts s'en ecarte. Sans lui, une suite de
tests vide serait entree dans la CI en s'affichant verte — et y serait restee,
puisqu'une suite qui ne teste rien ne peut plus jamais devenir rouge.

**Detecte par** — `test`

**Action** — `rien` — reparee, et le garde-fou qui l'a vue est dans le meme
commit que le defaut qu'il a attrape.

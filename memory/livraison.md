# La livraison s'achève à la main — le détour d'épinglage

Quand lire : quand un run sur `main` a construit les images mais échoué à
enregistrer leur version, ou quand tu te demandes pourquoi une app est en ligne
dans une version d'avant alors que `main` est vert.
Tenu par : CI — le run sur `main` passe au rouge sur le seul job `deploy`, à son
avant-dernier pas, et c'est le signal ; pret.sh — l'avertissement « livraison »
nomme ensuite les apps dont l'image en ligne est antérieure à ce qui est
fusionné, et s'éteint quand l'épinglage est juste.

## Pourquoi la chaîne ne finit pas son travail

Le job `deploy` a besoin d'écrire dans le dépôt **quelle version il vient de
mettre en ligne** : c'est `versions.yml`, et c'est le seul écrit de toute la
chaîne. Il l'écrit **directement sur `main`**, avec le jeton de la CI.

Le règlement de branche `Auto merge` exige deux vérifications de **toute**
poussée sur `main`, pas seulement d'une pull request. Or les vérifications ne
démarrent que sur une pull request : une poussée directe n'en rapporte aucune,
elles ne peuvent donc jamais être satisfaites, et la règle refuse **par
construction**. Signature dans les journaux du job :

```
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: - 2 of 2 required status checks are expected.
```

**Il n'existe pas de dérogation.** Une liste d'acteurs en dérogation n'est
offerte qu'aux dépôts appartenant à une **organisation** ; `billbob-space` est
un compte personnel. Aucun réglage ne rend ce cas possible, et « GitHub
Actions » ne figure de toute façon pas parmi les acteurs éligibles. Le seul
autre levier serait de retirer les vérifications du règlement — c'est-à-dire de
renoncer au verrou qui protège une stack partagée. **Arbitrage rendu le 16 août :
on garde le verrou, on finit la livraison à la main.**

Cette règle dormait tant que le dépôt était privé : GitHub n'applique pas un
règlement de branche sur un dépôt privé de compte personnel gratuit. Le passage
en public l'a réveillée, sans un mot.

## Reconnaître le cas

Le run sur `main` est **rouge**, mais tout y est vert **sauf** `deploy`, et dans
`deploy` tout est vert sauf l'avant-dernier pas. Les images **sont publiées** —
`build` a réussi. Ce qui manque, c'est seulement le lien entre elles et le
serveur. `./scripts/pret.sh` le dit aussi, en local, et nomme les apps.

## Le détour, pas à pas

L'épinglage n'a pas besoin d'être écrit **par la CI** ; il a besoin d'être **sur
`main`**. Une pull request l'y porte par la porte que la règle laisse ouverte —
celle qu'elle protège au lieu de la fermer.

```bash
# 1. le commit avec lequel les images ont ete construites : c'est le head_sha
#    du run qui a echoue, autrement dit le commit de fusion.
SHA=<le sha complet, 40 caracteres>

# 2. epingler les apps QUE CE RUN A CONSTRUITES — celles de detect.outputs.apps,
#    lisibles dans la ligne « -> apps : [...] » du job detect. Jamais a la main
#    dans versions.yml : --pin ecrit les deux fichiers d'un coup.
./init.sh --pin ardoise=$SHA --pin cadran=$SHA --pin ...

# 3. verifier, committer, pousser, ouvrir la pull request, fusionner
./init.sh --check && ./scripts/pret.sh
```

L'avertissement « livraison » de `pret.sh` doit s'être **éteint** après
l'épinglage : c'est le contrôle que les valeurs sont les bonnes.

## Pourquoi la fusion suffit, et ne repousse rien

À la fusion de cette pull request, `detect` ne voit **aucune app** changer mais
voit **`compose.yaml`** changer. C'est la distinction que le workflow écrit
noir sur blanc : « il y a quelque chose à redéployer » n'est pas « on a
construit une image ».

Alors `test` et `build` sautent, faute d'app. L'étape d'épinglage saute avec eux
— elle est gardée par `apps != '[]'`. Et l'étape de poussée saute à son tour,
gardée par la sortie de la précédente : **c'est ce qui fait que rien n'est
poussé sur `main` hors pull request, et donc que la règle ne se déclenche pas.**

Il reste les deux pas qui comptent : la vérification que chaque image du compose
est tirable, puis l'appel du webhook. `dockhand` recrée la stack, deux à trois
minutes.

La boucle **termine** : le run de cette fusion ne construit aucune image, donc
n'a rien à épingler, donc ne produit pas une seconde pull request.

## Vérifier que c'est bien en ligne

Le contrôle qui vaut n'est pas « le job est vert », c'est **l'image que le
serveur fait tourner** :

```bash
./scripts/prod.sh                      # les services sont-ils repartis, et sains
./scripts/prod.sh inspecter <app>      # la ligne « Image » porte-t-elle le bon tag
```

Le tag lu doit être celui de `versions.yml`. Les apps `public` se vérifient en
plus par une requête ordinaire ; les apps `private` et `google` répondent `307`
vers Google, ce qui prouve le routeur et non le conteneur.

## Ce que ce détour coûte, et quand il disparaîtra

Il livre, il ne répare pas. **C'est un humain ou un agent qui écrit ce que la
machine sait**, et une erreur d'épinglage — mauvais commit, app oubliée — ne
serait rattrapée par rien d'autre que l'avertissement de `pret.sh`. Épingle
depuis le run, jamais de mémoire.

Il disparaît le jour où le dépôt appartient à une organisation : la liste des
acteurs en dérogation devient alors disponible, et la CI retrouve le droit
d'enregistrer elle-même ce qu'elle vient de mettre en ligne.

# 2026-08-03 — claude/ramure-design-implementation-4fnao0

Branche : `claude/ramure-design-implementation-4fnao0`
Périmètre : apps/ramure

> **Entrée rétrospective.** Cette branche a vécu et fusionné avant que le journal
> n'existe : ce qui suit est reconstitué, pas écrit à chaud. Les anomalies
> spectaculaires y sont fiables ; les mineures manquent probablement, et c'est
> exactement l'effet que le mécanisme cherche à éviter.

## Anomalies

### 1. L'export de design référencé par le PRD était absent du dépôt

**Symptôme** — le PRD demandait d'implémenter `RAMURE Maquettes.dc.html` et un
bundle `_ds/`. Aucun des deux n'existait dans le workspace.

**Cause** — DesignSync exige une authentification interactive, indisponible en
session cloud. L'export n'avait donc jamais été rapatrié.

**Detecte par** — `auteur`

**Action** — `rien` — le PRD demandait de poser les questions avant de démarrer ;
ça a fonctionné. À noter comme mode de défaillance récurrent des sessions cloud :
tout ce qui exige un login interactif est absent, et le PRD ne peut pas le savoir.

### 2. Un correctif de cascade CSS a créé un P0

**Symptôme** — une bannière flottante, un bouton d'effacement et « Retirer au
hasard » restaient visibles alors qu'ils portaient `hidden`. J'ai ajouté
`[hidden] { display: none !important; }`. Après quoi les écrans d'état vide et
d'erreur se rendaient à hauteur nulle sur le chemin d'entrée — donc invisibles.

**Cause** — `#etat-ecran` vivait à l'intérieur de `section.exploration[hidden]`.
Tant que `[hidden]` était battu par les règles de classe, l'écran d'état
s'affichait par accident. Le correctif a supprimé l'accident sans que je vérifie
qui en dépendait.

**Detecte par** — `auteur` — en vérifiant mon propre correctif : `montreEtat()`
n'avait aucun `basculeVers`, et `alerte(` zéro appelant.

**Action** — `comportement` — un correctif qui change une règle de cascade doit être
suivi de l'énumération de ses consommateurs. Aucune vérification automatique
évidente ici, d'où `comportement` plutôt que `garde-fou`.

### 3. Correctifs appliqués à un seul site sur plusieurs

**Symptôme** — `fond()` sondait le chargement des images, mais `dessineNoeud()`
non : les 28 nœuds du canevas cassaient malgré le correctif. De même le contraste
avait été relevé pour le texte, pas pour les bordures des contrôles.

**Cause** — j'ai corrigé le site où le défaut avait été observé, pas la classe de
défaut.

**Detecte par** — `relecture` — la critique `impeccable`.

**Action** — `comportement` — quand un défaut a une classe, énumérer les sites
avant de corriger le premier.

### 4. J'ai présenté un échantillon de 3 scènes comme une mesure

**Symptôme** — j'ai annoncé à l'utilisateur que les collisions de libellés
étaient « au tiers de ce que j'avais annoncé ». La mesure réelle, sur 54 scènes
et 22 centres, donnait 44 % à 1440 px et 95 % à 390 px — et 59 %/86 % de noms
enfouis sous les pastilles.

**Cause** — trois scènes observées, une conclusion générale énoncée sur ce
fondement, avec le ton de la rigueur.

**Detecte par** — `auteur` — par la mesure à 54 scènes que j'avais commanditée,
donc **après** avoir énoncé le mauvais chiffre à l'utilisateur.

**Action** — `comportement` — l'anomalie la plus coûteuse de la branche : un petit
échantillon présenté comme rigueur est pire que pas de mesure du tout, parce
qu'il coupe court à la vérification.

### 5. Mon propre test affirmait ce que le code ne promettait pas

**Symptôme** — `TestLEntrelacementNeLaissePasDeSecteurVideNiDouble` échouait.

**Cause** — le test bucketait des angles *rendus* en secteurs, alors que la gigue
et la rotation font que les angles rendus ne retombent pas dans leur secteur
d'origine. Le test vérifiait une propriété que la fonction n'a jamais eue.

**Detecte par** — `test` — à l'exécution de la suite.

**Action** — `comportement` — quand un test est difficile à écrire, c'est souvent
qu'il manque une couture, pas que la propriété est fausse. `secteurEntrelace` a
été extraite au niveau paquet et sa bijection testée directement.

### 6. Le nom de branche imposé par le harnais viole la convention du contrat

**Symptôme** — la branche s'appelle `claude/ramure-design-implementation-4fnao0`.
Le préfixe `claude` n'est ni une app ni `fabrique`.

**Cause** — le harnais cloud assigne le nom de branche et interdit de pousser
ailleurs. Le contrat, lui, impose `<app>/<sujet>` et fait valider le nom par
`./init.sh --branche`, qui aurait refusé celui-ci.

**Detecte par** — `auteur` — en écrivant ce journal, soit par l'acte même de le
tenir, longtemps après le fait.

**Action** — `arbitrage` — deux règles se contredisent et rien ne le signale :
`--branche` refuse un préfixe inconnu, mais aucune vérification ne s'applique à
une branche créée hors de lui. Une session cloud travaille donc systématiquement
hors convention sans qu'aucun garde-fou ne bronche. À trancher : soit le contrat
admet le préfixe du harnais, soit `--check` signale une branche hors convention.

### 7. La CI `contrat` a échoué sur la PR #19 sans que la branche ait changé

**Symptôme** — `.claude/agents/greffier.md desynchronise`, alors que le fichier
n'avait pas été touché.

**Cause** — la CI teste `refs/pull/19/merge`, pas la tête de branche. `main` avait
avancé de dix commits entre-temps (fusion de la PR #20), dont un qui régénérait
le greffier. La fusion théorique portait donc un fichier généré périmé.

**Detecte par** — `CI` — coût : une fusion de `origin/main` et un `./init.sh`.

**Action** — `rien` — c'est exactement le travail du job `contrat`, et il l'a fait.
À connaître parce que ça se reproduira sur toute branche à durée de vie longue
dans une fabrique qui bouge.

### 8. Boucle de redirection sur `/`

**Symptôme** — `ERR_TOO_MANY_REDIRECTS` à la racine.

**Cause** — le `FileServer` de Go redirige `/index.html` vers `./` ; ma réécriture
de chemin renvoyait vers `/index.html`, fermant la boucle.

**Detecte par** — `auteur` — au navigateur.

**Action** — `rien` — corrigé en retirant la réécriture.

### 9. Débordement d'entier sur une constante de hachage

**Symptôme** — `0x9E3779B97F4A7C15` refusé : dépasse `int64`.

**Cause** — la constante tient sur 64 bits non signés, pas signés.

**Detecte par** — `compilateur`

**Action** — `rien` — le contre-exemple utile : une anomalie rattrapée par
l'outillage ne mérite pas d'analyse, et surtout pas un garde-fou de plus.

### 10. « Tu n'as pas update le compose ? »

**Symptôme** — l'utilisateur a cru que `compose.yaml` n'avait pas été mis à jour.

**Cause** — il l'était, mais sur la branche. `main` ne l'avait pas, la PR #19 étant
déjà fusionnée : le commit d'activation ne pouvait pas l'atteindre sans une
nouvelle PR. J'avais signalé ce point, mais après avoir annoncé l'étape comme
faite — donc dans l'ordre qui laisse croire au contraire.

**Detecte par** — `utilisateur`

**Action** — `comportement` — le contrat en deux temps crée un état où « fait » et
« déployé » divergent. En rendre compte, c'est dire **où vit le changement** avant
de dire qu'il est fait, pas après.

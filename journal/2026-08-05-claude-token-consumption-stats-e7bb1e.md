# 2026-08-05 — claude/token-consumption-stats-e7bb1e

Branche : `claude/token-consumption-stats-e7bb1e`
Périmètre : fabrique
Mode : `chaud`

Sujet : rendre le relevé de coût juste, attribué, et exploitable. Parti d'une
demande de statistiques sur le journal, qui a mis au jour un compteur faux.

## Anomalies

### 1. Le relevé comptait chaque requête deux à trois fois

**Symptome** — les huit entrées de journal déjà relevées portent un total gonflé
d'un facteur voisin de deux. Mesuré sur la session courante : 35 lignes de
facture pour 15 requêtes réelles, soit 2,23x. La fabrique n'a pas coûté 363 $
mais de l'ordre de 150 $, et aucun des chiffres consignés n'est comparable à un
autre — le facteur dépend du nombre d'outils appelés par réponse.

**Cause** — le fichier de conversation écrit **une ligne par bloc de la
réponse** — la réflexion, le texte, chaque appel d'outil — et chacune reporte le
même objet `usage`. Le relevé additionnait toutes les lignes portant le motif
sans jamais se demander si deux d'entre elles décrivaient la même requête. Le
commentaire de la fonction traitait pourtant deux pièges *internes* à `usage`
(`iterations`, `cache_creation`) : l'attention était sur la structure de l'objet,
jamais sur sa multiplicité.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — `test-cout.sh`, qui n'existait pas : le relevé rend un
nombre à sept chiffres qu'aucune relecture ne peut vérifier à l'œil, et un nombre
faux ressemble trait pour trait à un nombre juste. La déduplication se fait sur
`requestId`, présent sur 100 % des lignes facturées et unique par requête.

### 2. Deux branches d'un même conteneur se volaient leur consommation

**Symptome** — `2026-08-04-ardoise-activation.md` porte 275 M jetons et
`2026-08-04-compteur-activation.md` 282 M, relevés à **deux minutes d'écart**.
Ce n'est pas deux fois le travail : c'est le même travail, écrit dans deux
entrées, la seconde ayant recompté la première.

**Cause** — `cout_releve` lisait tous les `*.jsonl` du répertoire sans regarder
`gitBranch`, pourtant présent sur chaque ligne. Le champ existait, il n'était pas
lu.

**Detecte par** — `auteur`

**Action** — `garde-fou` — attribution par branche, et ce qui appartient à une
autre branche est **dit** plutôt que tu. Sont retenus la branche courante, la
base et les lignes sans champ : une session cloud ouvre sa branche après
quelques échanges, et les exclure amputerait le relevé de son propre début.

### 3. Le relevé mesurait sans permettre de décider

**Symptome** — question posée : « où optimiser ? ». Les quatre postes — entrée,
écriture, lecture, sortie — n'y répondaient pas. Il a fallu écrire du Python
jetable sur le fichier brut pour découvrir que **le démarrage pèse 54 738 jetons
relus à chaque appel, soit la moitié à 80 % de toute la relecture** selon la
longueur de la session, et que le contrat du dépôt n'en fait que 7 % — le reste
étant l'outillage embarqué.

**Cause** — le relevé avait été conçu pour figer un chiffre avant que le
conteneur disparaisse, pas pour dire où agir. Objectif atteint, question suivante
non anticipée.

**Detecte par** — `utilisateur`

**Action** — `contrat` — section « Ce qui coûte » : appels au modèle, part des
sous-agents, poids du démarrage et sa part de la relecture, croissance du premier
au dernier appel. `memory/travail.md` décrivait les quatre postes comme le
contenu du bloc ; il décrit maintenant ce qui s'y ajoute et pourquoi.

### 4. Rien ne survivait au conteneur, sauf un total

**Symptome** — dix des dix-huit branches n'ont aucun relevé, et les huit qui en
ont un ne gardent qu'un total désormais connu comme faux — donc irrécupérable :
recalculer demanderait le fichier de conversation, qui n'existe plus.

**Cause** — le bloc consignait le résultat, jamais la donnée. Un total ne se
recalcule pas ; une suite d'appels, si.

**Detecte par** — `auteur`

**Action** — `contrat` — le bloc porte désormais `cout-detail`, un appel par
ligne : rang, agent, modèle, écriture, lecture, sortie. Compact et illisible à
dessein, son lecteur est un outil. Les huit relevés antérieurs restent faux et le
resteront ; ils se reconnaissent à l'absence de section « Ce qui coûte ».

### 5. La notice d'une app se désynchronise sans que personne n'y touche

**Symptome** — `./init.sh --check` refusait le dépôt sur
`apps/ramure-v2/CLAUDE.md desynchronise`, sur une branche qui n'a jamais ouvert
`apps/`. L'écart : une ligne, l'entrée `PRODUCT.md` dans « Ses documents ».

**Cause** — ajouter un `PRODUCT.md` à une app change sa notice générée. Le commit
qui l'a ajouté n'a pas relancé `./init.sh`, et le contrat étant le verrou de tous
les autres jobs, cet oubli bloque la CI de **toutes** les apps, sur n'importe
quelle branche.

**Detecte par** — `auteur`

**Action** — `rien` — resynchronisé en commit séparé. Le garde-fou existe déjà et
a fonctionné : `--check` l'a nommé, et `pret.sh` le lance avant chaque commit.

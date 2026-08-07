# 2026-08-07 — claude/account-deletion-nf7jbq

Branche : `claude/account-deletion-nf7jbq`
Périmètre : `marcq-handball`
Mode : `chaud`

## Anomalies

### 1. Le seul geste de sortie du produit n'était offert qu'à ceux qui n'en avaient pas besoin

**Symptome** — un parent, après mise en ligne : *« j'ai déjà fait une boulette en
allant voir depuis mon téléphone et en créant un compte pour Charlie que je
n'arrive plus à supprimer pour qu'il me fasse lui-même de son tél »*.

Le serveur savait pourtant faire : `POST /api/classement` avec `supprimer: true`
accepte un nom et son code d'où que vienne la requête, et `classement.go` le dit
en toutes lettres — « le pseudonyme redevient libre », « aucune pierre tombale ».
C'est `monterSuppression` qui sortait par `return null` dès que
`lireClassement().pseudo` valait `null`, c'est-à-dire dès que le téléphone ne
portait plus le nom. Le chemin de sortie n'existait donc que pour celui qui
n'avait rien à réparer.

Pire, le produit **fabrique** lui-même l'état où le bouton disparaît : « Changer
d'enfant » efface la clé locale sans toucher au serveur. Son avertissement le
dit — *« plus personne ne pourra le supprimer. Supprime-le d'abord »* — ce qui
était exact, et aurait dû se lire comme le signalement d'un trou plutôt que comme
une mise en garde suffisante. Une phrase qui décrit une impasse à celui qui va y
entrer n'est pas un garde-fou : c'est la documentation du défaut.

**Cause** — le commentaire qui gardait la condition raisonnait juste sur une
prémisse fausse : « proposer de supprimer un nom qu'on n'a pas serait une
question sans réponse ». Vraie pour un enfant qui n'a jamais rejoint ; fausse
pour quiconque a créé un nom **ailleurs** — l'autre téléphone du foyer, ou le
sien avant d'avoir changé d'enfant. Le cas n'est pas exotique : c'est le premier
retour d'usage reçu sur cet écran.

La règle générale derrière : **un geste de sortie ne se conditionne pas à un état
local**. Le local dit ce que ce téléphone sait, jamais ce qui existe sur le
serveur, et un produit sans compte perd cet état par conception — c'est même la
promesse du § 5. Les deux autres gestes destructeurs de l'app, « changer
d'enfant » et « corriger son prénom », n'agissent que sur le téléphone : la
condition leur convenait, et elle a été reconduite sans être rejugée sur le seul
geste qui, lui, agit sur le serveur.

**Detecte par** — `utilisateur`

**Action** — `arbitrage` — aucun garde-fou automatique ne voit qu'un chemin de
sortie est conditionné à un état que le produit efface lui-même : il faudrait
relier une condition d'affichage à ce qu'une autre vue détruit. La question à
poser, elle, se pose à la main et tient en une ligne — *quel écran reste pour
défaire ceci, une fois ce téléphone remis à zéro ?* Elle vaut pour toute app de
la fabrique servant du `public` sans compte.

### 2. Le PRD n'était pas faux, et l'écran ne le tenait quand même pas

**Symptome** — le § 14 promettait un pseudonyme « supprimable », le § 7.4 fait du
code la clé qui commande la fiche. Aucune des deux lignes n'était démentie par
le code : le serveur les tenait toutes les deux. Le manquement vivait
**entre** le document et l'écran, dans une condition d'affichage que le PRD
n'énonçait nulle part et n'avait aucune raison d'énoncer.

**Cause** — le garde-fou de `pret.sh` cherche un fichier de code neuf dans une
app dont le `PRODUCT.md` ne bouge pas, et `memory/produit.md` oppose la
correction — qui « passe par une ligne déjà écrite » — à la capacité neuve. Ce
cas-ci n'est ni l'un ni l'autre proprement : il ne crée aucun fichier de code, et
la ligne du § 14 qu'il traverse était **déjà vraie**. Le rapprochement du
garde-fou reste bon ; c'est la grille à deux cases qui a un troisième cas, et il
est resté sans nom : *une promesse tenue par le serveur et non par l'écran*.

**Detecte par** — `utilisateur`

**Action** — `contrat` — la section « Ce que le PRD dit reste vrai, ou il ment »
n'a que deux registres. Il en manque un troisième, celui-ci, et sa règle
d'écriture : préciser la ligne existante — ici *« supprimable depuis n'importe
quel téléphone »* — plutôt que d'ouvrir une capacité neuve pour ce qui était
déjà promis.

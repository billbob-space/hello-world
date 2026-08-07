# 2026-08-07 — claude/claude-md-caveman-format-ylhb9k

Branche : `claude/claude-md-caveman-format-ylhb9k`
Périmètre : `fabrique`
Mode : `chaud`

## Anomalies

### 1. Le style caveman n'a pas raccourci le contrat, il l'a allongé

**Symptome** — la conversion du contrat en style caveman est partie de 250
lignes et est arrivée à 253, au-dessus du plafond `claude_max_lignes`. Trois
resserrages successifs n'ont rien changé au compte : chacun raccourcissait la
phrase sans faire remonter un mot sur la ligne précédente.

**Cause** — deux erreurs de raisonnement de ma part. D'abord j'ai supposé qu'un
style qui supprime articles et subordonnées produirait un fichier plus court :
faux, il remplace des phrases longues par beaucoup de phrases courtes, et le
volume de caractères ne bouge presque pas. Ensuite, le contrôle compte des
**lignes** dans un fichier enveloppé à 80 colonnes : tant qu'une réécriture ne
libère pas 80 caractères d'affilée dans un même paragraphe, le compte reste
identique, même si le texte est visiblement plus court. J'ai fait quatre
modifications sans effet avant de vérifier le compte après chacune.

**Detecte par** — `relecture`

**Action** — `comportement` — sur un fichier borné en lignes, mesurer après
chaque modification plutôt qu'après une série ; et viser un paragraphe entier à
réécrire, pas une tournure à raccourcir.

### 2. Rien ne vérifie que le contrat dit toujours la même chose

**Symptome** — `./init.sh --check` a validé la réécriture intégrale du contrat :
sommaire de `memory/` exact, aucun lien mort, aucun titre en double, 250 lignes.
Ces quatre contrôles portent sur la structure. Aucun ne regarde le contenu : une
règle perdue, un seuil changé (« < 200 Mo »), un palier d'exposition décrit à
l'envers passeraient tous les quatre.

**Cause** — le contrat est le seul document du dépôt dont le lecteur principal
est un agent, et le seul dont aucun test ne dépend. Les garde-fous existants ont
été posés sur les dérives observées — croissance, doublons de section, sommaire
menteur — qui sont toutes des dérives de forme. Une réécriture de fond est un
cas nouveau, et le fait que `--check` soit vert ne prouve ici rien d'autre que
l'absence de dégât structurel.

**Detecte par** — `auteur`

**Action** — `arbitrage` — la relecture du contenu revient à l'humain : c'est
son contrat, et le style est sa décision. Rien à automatiser tant que la
réécriture intégrale reste exceptionnelle.

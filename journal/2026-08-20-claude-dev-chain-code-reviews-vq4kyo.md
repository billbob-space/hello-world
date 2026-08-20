# 2026-08-20 — claude/dev-chain-code-reviews-vq4kyo

Branche : `claude/dev-chain-code-reviews-vq4kyo`
Périmètre : `fabrique` — `scripts/`, `.github/workflows/build.yml`, `init.sh`,
`.claude/agents/`, `CLAUDE.md`, `memory/`, et un `revue:` neuf dans les dix
`apps/*/app.yml`. Rayon de souffle maximal : la chaine partagee.
Mode : `chaud`

## Anomalies

### 1. La chaine de developpement n'a aucune relecture outillee

**Symptome** — a l'ouverture de la branche, la CI verifie le contrat, lance
`apps/<nom>/test.sh` et inspecte l'image. Rien d'autre. Aucun controle de
securite (ni analyse statique, ni dependances vulnerables), aucune mesure de
couverture, aucune detection de duplication, aucune relecture. Les tests bout en
bout existent pour trois apps sur dix (`ardoise`, `compteur`, `ramure-v2`) et
ne tournent JAMAIS en CI : `ardoise/e2e/lancer.sh` et `compteur/e2e/lancer.sh`
disent eux-memes « n'est PAS lance par la CI », et `ramure-v2/test.sh` garde son
bout en bout derriere `RAMURE_E2E`, variable posee nulle part dans le workflow.

**Cause** — la fabrique s'est dotee tot de garde-fous sur la *forme* (`--check`,
inspection des images, `pret.sh`) et jamais sur le *fond*. `memory/outillage.md`
l'ecrit noir sur blanc pour le plugin `code-review` : « la revue passe par
`--check`, les quatre harnais de test et la relecture humaine avant fusion » —
c'est-a-dire par rien d'automatique.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — c'est l'objet de cette branche. Voir
`docs/superpowers/specs/2026-08-20-revue-et-bout-en-bout-design.md`.

### 2. Un seuil de couverture unique aurait rendu la chaine rouge partout

**Symptome** — la decision prise etait « tout bloque ». Mesure faite avant
d'ecrire quoi que ce soit, la couverture des lignes va de 32,7 % (`compteur`) a
64,0 % (`cadran`), 36,0 % pour `hello-world`. N'importe quel plancher fixe et
raisonnable — 60 %, 70 %, 80 % — aurait bloque la moitie ou la totalite des apps
des le premier commit, sur du code que personne n'avait touche.

**Cause** — un plancher absolu juge un etat, pas un geste. La dette existante et
la regression introduite par la branche courante ne se distinguent plus.

**Detecte par** — `auteur`

**Action** — `arbitrage` — arbitre avec l'utilisateur : la barre de chaque app
est relevee a son niveau du jour, ecrite dans son `app.yml`, et ne peut plus que
monter. Rien n'est rouge au demarrage, la dette ne peut plus croitre. Le detail
est dans la spec ; le principe est un cliquet, pas un objectif.

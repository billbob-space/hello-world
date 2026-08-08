# 2026-08-08 — claude/verify-environment-setup-9ytbn9

Branche : `claude/verify-environment-setup-9ytbn9`
Périmètre : hello-world
Mode : `chaud`

## Anomalies

Aucune anomalie. Session de vérification de l'outillage (13/13 plugins, dont
token-optimizer ; binaire rtk présent) suivie d'un test réel des trois agents
de la fabrique : l'artisan a ajouté un test unitaire dans
`apps/hello-world/main_test.go` (405 attendu sur `POST /healthz`), les tests
de l'app passent, le greffier a committé et poussé, l'analyste a tourné en
parallèle en lecture seule sur `journal/`.

---

Branche reprise depuis `main` après fusion de la PR #96 (mode `/livrer`),
même nom, pour un second tour de travail.

Périmètre : fabrique

### 2. `rtk gain` / `rtk init --show` annoncent à tort que le hook n'est pas installé

**Symptôme** — demande de l'utilisateur : « active le hook rtk pour
l'automatiser ». Or `check-plugins.sh` le rapportait déjà présent, et le hook
`PreToolUse` existe déjà dans `.claude/settings.json`, écrit à la main lors
d'une branche antérieure (`claude/add-plugin-rtk-flamj4`). `rtk gain` et
`rtk init --show` affichent pourtant « No hook installed » / « RTK hook not
configured », ce qui a probablement motivé la demande.

**Cause** — vérifié empiriquement : une commande bash ordinaire, non préfixée
par `rtk`, est bien interceptée et comptée par `rtk gain` sans intervention —
le hook fonctionne. Le diagnostic intégré de `rtk` ne reconnaît que le format
qu'écrirait son propre installeur (`rtk init -g`, qui patche le
`settings.json` **global** de l'utilisateur) ; il ne sait pas lire le hook
écrit à la main dans le `settings.json` **versionné** du dépôt — c'est un faux
négatif du binaire, pas une panne du dépôt.

**Detecte par** — `utilisateur`

**Action** — `contrat` — `memory/outillage.md` documente maintenant ce faux
négatif, pour qu'une prochaine session ne lance pas `rtk init -g` en réponse à
cette alerte : cette commande patcherait le réglage éphémère du conteneur,
pas celui du dépôt, contredisant l'intégration à la main déjà en place et déjà
motivée dans ce même fichier.

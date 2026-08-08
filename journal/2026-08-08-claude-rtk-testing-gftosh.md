# 2026-08-08 — claude/rtk-testing-gftosh

Branche : `claude/rtk-testing-gftosh`
Périmètre : fabrique
Mode : `chaud`

## Anomalies

### 1. `check-plugins.sh` decoupait la description d'un binaire de hook en autant de faux manquants

**Symptome** — demande de test de `rtk` sur ce conteneur, ou le binaire n'est pas
installe (setup script pas encore joue). Le rapport `SessionStart` attendu etait
une seule ligne « rtk ABSENT — la compression des commandes bash est inactive. »,
mais en a affiche six : `rtk ABSENT — la.`, `compression ABSENT — compression.`,
`des ABSENT — des.`, `commandes ABSENT — commandes.`, `est ABSENT — est.`,
`inactive ABSENT — inactive.` — `bash`, seul mot de la phrase qui soit aussi une
commande reellement presente, n'apparaissait pas dans la liste des manquants.

**Cause** — `HOOK_BINAIRES="rtk:la compression des commandes bash est inactive"`
est parcourue par `for h in $HOOK_BINAIRES`, sans guillemets : le shell decoupe
sur les espaces, donc sur chaque mot de la description elle-meme, et traite
chaque mot comme un nom de binaire a tester avec `command -v`. Le format
`binaire:description` ne marchait que pour une description sans espace ; le seul
triplet existant (`TRIPLETS`, `plugin:binaire:stack`) n'a jamais expose le
defaut parce qu'aucun de ses champs n'en contient.

**Detecte par** — `auteur`

**Action** — `garde-fou` — `HOOK_BINAIRES` est desormais parcourue avec
`while IFS= read -r h; do ... done <<EOF` plutot que `for h in $HOOK_BINAIRES`,
pour que la description d'un futur second binaire de hook puisse elle aussi
contenir des espaces sans se faire decouper.

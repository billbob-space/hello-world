# 2026-08-16 — claude/redeploiement-apps-verification-1jhfby

Branche : `claude/redeploiement-apps-verification-1jhfby`
Périmètre : fabrique
Mode : `chaud`

Session ouverte sur « redéploie toutes les apps maintenant que la CI est
réparée, et vérifie que toutes les dernières évolutions sont bien livrées ».
La vérification vient en premier et elle tient dans une comparaison : pour
chaque app, l'arbre `apps/<nom>` au commit épinglé dans `versions.yml` contre
le même arbre sur `main`. Trois apps diffèrent — `estran`, `renaissance-gym`,
`hello-world` —, les six autres sont identiques au bit près. Le redéploiement
lui-même a buté sur un levier qui n'en était pas un.

## Anomalies

### 1. Les fusions passées pendant la panne de CI ne sont jamais reconstruites

**Symptome** — `estran` tourne en ligne dans une version d'avant sa navigation
temporelle : `versions.yml` l'épingle sur `7c18d32`, alors que `main` porte
trois commits de plus sur `apps/estran` — 1 666 lignes ajoutées, dont
`main_test.go`, `prp/01-navigation-temporelle.md` et la refonte de l'échelle
typographique. Même écart pour `renaissance-gym` (`RETROSPECTIVE.md` et ses
tests) et `hello-world` (un test unitaire). Rien ne le signalait : `main` est
vert, les PR sont fusionnées, le dépôt a l'air à jour.

**Cause** — le déploiement est accroché à l'événement `push` sur `main`, et à
lui seul. Les deux fusions concernées — #133 le 16 août à 12:18 et #130 à
12:30 — ont bien poussé sur `main`, mais leurs runs sont tombés dans la fenêtre
où aucun runner n'était attribué (entrée du 16 août, anomalie 1) : `contrat` et
`detect` en échec en deux secondes, `build` et `deploy` sautés. La CI réparée à
13:03, **rien ne les rejoue** — le déclencheur était l'événement, et l'événement
est passé. Un `git push` ne se rejoue pas ; une panne d'infrastructure laisse
donc des fusions définitivement non construites, et le dépôt ne porte aucune
trace de l'écart puisque `versions.yml` n'est écrit que par les déploiements qui
ont eu lieu.

**Detecte par** — `auteur`

**Action** — `garde-fou` — l'écart est calculable sans réseau et sans jeton :
`git rev-parse <épingle>:apps/<nom>` contre le même arbre sur `HEAD` dit en une
comparaison si l'image en ligne correspond au code fusionné. Le mettre dans
`--check` demande cependant l'historique, que le clone superficiel de la CI n'a
pas ; c'est `pret.sh` — qui tourne en local, sur un dépôt complet — qui est la
bonne place, en avertissement.

### 2. L'entrée « toutes » reconstruisait tout et ne déployait rien

**Symptome** — le workflow expose exactement le levier qu'appelle la situation :
`workflow_dispatch` avec `toutes: reconstruire toutes les apps`. Actionné, il
aurait publié les neuf images et laissé la production intacte — `versions.yml`
inchangé, `compose.yaml` inchangé, webhook jamais appelé —, en sortant **vert**.

**Cause** — `detect` traite bien le cas (`tout=1`, liste complète, `deploy=true`)
et `build` publie, puisque sa condition de poussée est `event_name != pull_request`.
Mais le job `deploy` s'ouvrait sur `github.event_name == 'push'` : le dispatch
n'y entrait pas. Les deux moitiés de la chaîne ne s'accordaient pas sur ce que
`toutes` veut dire — construire pour l'une, mettre en ligne pour l'autre. Le
levier de rattrapage de la fabrique, celui-là même qu'on actionne après une
panne de CI, s'arrêtait à mi-chemin sans le dire.

**Detecte par** — `auteur`

**Action** — `rien` — réparé ici : `deploy` admet `workflow_dispatch` à côté de
`push`, la garde qui compte restant `ref == refs/heads/main`, commune aux deux
événements.

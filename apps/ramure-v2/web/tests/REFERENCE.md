# Base de référence des tests — RAMURE v2

<!-- apps/ramure-v2/web/tests/REFERENCE.md -->

PRP 09, tâche 1 (PRD §13) : « une base de référence est tenue à jour : nombre
de tests attendus au vert et liste explicite des échecs connus non
applicables, pour qu'aucune équipe ne rouvre deux fois la même enquête. »

Relevé le 19 août 2026, sur le commit qui introduit ce fichier.

## Ce qui tourne toujours (`./apps/ramure-v2/test.sh`, CI comprise)

| Suite | Commande | Attendu au vert |
|---|---|---|
| Client TypeScript | `npm run --prefix web test` (vitest) | **165 tests**, 13 fichiers |
| Go, tous paquets | `go test -race -count=1 ./...` | **161 fonctions de test**, 10 paquets (`.`, `internal/api`, `internal/arbre`, `internal/budget`, `internal/cache`, `internal/collection`, `internal/equite`, `internal/identite`, `internal/mesure`, `internal/source`) |

Le premier repère (PRP 02) était de 26 fonctions dans `internal/` ; la série
en compte maintenant 161 sur l'ensemble du module.

## Ce que joue `apps/ramure-v2/e2e/lancer.sh` (CI comprise)

| Fichier | Ce qu'il joue | Tests |
|---|---|---|
| `web/tests/e2e/parcours.spec.ts` | Le parcours complet du PRD (§13) — planter (avec faute de frappe corrigée) → promouvoir → **remonter la lignée (F-14, sur un arbre réellement promu)** → garder → replanter depuis la collection → partager — dans les deux dispositions | 2 |
| `web/tests/e2e/pannes.spec.ts` | Les cinq pannes simulées, une par cas : source vide (F-36), source en erreur (F-37), dépassement de quota (N-14), extraits indisponibles (F-40), session expirée (F-41) | 5 |
| `web/tests/e2e/geometrie.spec.ts` | Géométrie mesurée à 1920×1080 : les traits rejoignent leur cible, les libellés ne se recouvrent pas, le zoom agrandit réellement les illustrations (largeur rendue, pas le rayon SVG) | 1 |
| `web/tests/e2e/accessibilite.spec.ts` | Scan automatisé (axe-core) de cinq écrans, dans les deux dispositions : accueil, arbre + fiche, collection ouverte, correction proposée, bannière de mise à jour | 10 |
| `web/tests/e2e/collection-hors-ligne.spec.ts` | **F-33** : un vrai cycle hors ligne → garder/retirer → retour en ligne → réconciliation, dans le navigateur (`context.setOffline` + requêtes qui échouent réellement) | 2 |
| `web/tests/e2e/mise-a-jour.spec.ts` | **F-42/N-12** : détection → bannière → clic → activation, en un seul passage, avec un vrai redémarrage du serveur Go entre deux versions de `sw.js` | 1 |
| **Total** | | **21** |

Cette suite tourne dans le job « bout-en-bout » de la CI, via
`apps/ramure-v2/e2e/lancer.sh` — plus derrière `RAMURE_E2E`, qui n'était posée
nulle part dans le workflow (l'ancien garde de `apps/ramure-v2/test.sh` a été
retiré avec la variable). Elle reste jouable à la main de la même façon :

```bash
./apps/ramure-v2/e2e/lancer.sh
```

Prérequis pour la jouer : `npm ci --prefix web` (installe `@playwright/test`
et `@axe-core/playwright` — `lancer.sh` s'en charge via `./prepare.sh`), un
Chromium accessible (`playwright install chromium`, ou
`PLAYWRIGHT_CHROMIUM_PATH=/chemin/vers/chromium` si un navigateur est déjà
présent sur la machine — c'est le cas du bac à sable où cette suite a été
écrite, `/opt/pw-browsers/chromium`, et `lancer.sh` le détecte tout seul), et
le binaire `go` sur le `PATH` (chaque fichier démarre son propre serveur réel
via `go run .` — voir `web/tests/e2e/support/serveur.ts`).

## Anomalies découvertes en écrivant cette recette

Hors périmètre de la tâche 1 (recette seule). Les anomalies 1 à 7 ont été
**corrigées** dans un chantier ultérieur (recette avant mise en ligne) : les
assertions correspondantes ont été **retournées** pour vérifier le
comportement correct, et retirées de cette liste — voir le message de commit
et les commentaires laissés au site d'assertion pour le détail du mécanisme
corrigé. Seule l'anomalie 8 reste hors périmètre, documentée ci-dessous, non
corrigée : une décision de conception (un vrai algorithme d'évitement de
collision), délibérément exclue de ce chantier.

| # | Où l'observer | Résumé |
|---|---|---|
| 8 | `geometrie.spec.ts`, en-tête du fichier (documenté, pas asserté) | Aucun algorithme d'évitement de collision n'existe pour les libellés texte (`canevas.ts` place chaque libellé à une position fixe dérivée du nœud). Avec des noms d'artistes voisins **longs** sur des héritiers rapprochés (`RAYON_HERITIER = 34px`, `geometrie.ts`), les libellés se recouvrent réellement — reproduit manuellement pendant l'écriture de ce fichier, non gardé comme assertion automatique pour ne pas lier ce test au choix arbitraire d'un jeu de noms « longs ». |

Aucun échec **non applicable** (faux positif d'environnement) n'est
actuellement connu.

## Ce que la géométrie et le lecteur d'extraits ne couvrent pas

`.lecteur-bouton` (F-24) est cliquable et son état désactivé est correct
(F-40, couvert par `pannes.spec.ts` cas 4/5), mais aucun élément `<audio>`
n'est créé nulle part dans `fiche.ts`/`main.ts` : cliquer « Lire » ne
déclenche aujourd'hui ni son ni changement visuel observable. Noté dans
`parcours.spec.ts`, non goldé en assertion (rien à mesurer depuis le
navigateur qui ne soit déjà couvert par les deux points ci-dessus).

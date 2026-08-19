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

## Ce qui ne tourne QUE sur demande (`RAMURE_E2E=1 ./apps/ramure-v2/test.sh`)

| Fichier | Ce qu'il joue | Tests |
|---|---|---|
| `web/tests/e2e/parcours.spec.ts` | Le parcours complet du PRD (§13) — planter (avec faute de frappe corrigée) → promouvoir → **remonter la lignée (F-14, sur un arbre réellement promu)** → garder → replanter depuis la collection → partager — dans les deux dispositions | 2 |
| `web/tests/e2e/pannes.spec.ts` | Les cinq pannes simulées, une par cas : source vide (F-36), source en erreur (F-37), dépassement de quota (N-14), extraits indisponibles (F-40), session expirée (F-41) | 5 |
| `web/tests/e2e/geometrie.spec.ts` | Géométrie mesurée à 1920×1080 : les traits rejoignent leur cible, les libellés ne se recouvrent pas, le zoom agrandit réellement les illustrations (largeur rendue, pas le rayon SVG) | 1 |
| `web/tests/e2e/accessibilite.spec.ts` | Scan automatisé (axe-core) de cinq écrans, dans les deux dispositions : accueil, arbre + fiche, collection ouverte, correction proposée, bannière de mise à jour | 10 |
| `web/tests/e2e/collection-hors-ligne.spec.ts` | **F-33** : un vrai cycle hors ligne → garder/retirer → retour en ligne → réconciliation, dans le navigateur (`context.setOffline` + requêtes qui échouent réellement) | 2 |
| `web/tests/e2e/mise-a-jour.spec.ts` | **F-42/N-12** : détection → bannière → clic → activation, en un seul passage, avec un vrai redémarrage du serveur Go entre deux versions de `sw.js` | 1 |
| **Total** | | **21** |

Cette suite ne tourne **jamais en CI** : `RAMURE_E2E` n'est posée nulle part
dans le workflow de la fabrique (voir `apps/ramure-v2/test.sh`, dont le
`else` l'annonce explicitement). C'est une recette qu'on joue à la main avant
une mise en ligne — assumé, PRP 09 tâche 1.

Prérequis pour la jouer : `npm ci --prefix web` (installe `@playwright/test`
et `@axe-core/playwright`), un Chromium accessible (`playwright install
chromium`, ou `PLAYWRIGHT_CHROMIUM_PATH=/chemin/vers/chromium` si un
navigateur est déjà présent sur la machine — c'est le cas du bac à sable où
cette suite a été écrite, `/opt/pw-browsers/chromium`), et le binaire `go`
sur le `PATH` (chaque fichier démarre son propre serveur réel via `go run .`
— voir `web/tests/e2e/support/serveur.ts`).

## Anomalies découvertes en écrivant cette recette, pas corrigées ici

Hors périmètre de la tâche 1 (recette seule) : chacune est **assertée telle
quelle**, avec un commentaire au site d'assertion qui explique le mécanisme
exact. Un correctif futur fera échouer l'assertion correspondante — c'est le
signal qu'il faut la retirer, pas la laisser traîner.

| # | Où l'observer | Résumé |
|---|---|---|
| 1 | `parcours.spec.ts`, étape 5 (F-14) | Après une faute de frappe corrigée PUIS une promotion, `lignee.lignee` (identifiants, `promotion.ts`) et `ligneeNoms` (noms, `main.ts`) se désynchronisent d'une entrée : `GestionnaireLignee.commencerPromotion` pousse dès que `#centreId !== null`, `main.ts` ne pousse sur `ligneeNoms` que `if (nomCentreCourant)` (une chaîne vide, rendue par la plantation ratée, est fausse). « Remonter d'un cran » laisse alors le bouton visible un cran de trop. |
| 2 | `parcours.spec.ts`, étape 7 (F-30) | `ajouterALaCollection` (`main.ts`) construit `EntreeAPI.lignee` à partir de `lignee.lignee` (identifiants opaques) au lieu de `ligneeNoms` (noms lisibles) — composé avec l'anomalie 1, le préfixe technique `racine:` et le nom **mal orthographié** de la recherche corrigée fuient tous deux, durablement, dans la collection affichée à l'utilisateur. |
| 3 | `pannes.spec.ts`, cas 1/5 et 2/5 (F-36/F-37) | `reconstruireScene()`/`promouvoirVers()` (`main.ts`) posent le bon message distinctif dans `#etat`, puis appellent `annoncer()` **inconditionnellement** juste après ; `annoncerNouveauCentre` diffère d'un tour de boucle (`setTimeout(fn, 0)`) et écrase toujours le premier message avant qu'une technologie d'assistance n'ait pu le lire. La région `aria-live="polite"` finit par annoncer « Nouveau centre : … » — un message trompeur — au lieu du message F-36/F-37 attendu. |
| 4 | `accessibilite.spec.ts`, « arbre et fiche du centre » | `color-contrast` (axe-core, impact *serious*) : `.fiche-lien-artiste` et `.discographie-lien` (`web/index.html`) n'ont aucune couleur de texte déclarée ; le navigateur retombe sur le bleu de lien par défaut (`#0000ee`), illisible sur le fond sombre du panneau (ratio mesuré 1.92:1, WCAG 2 AA exige 4.5:1). |
| 5 | `accessibilite.spec.ts`, « correction orthographique proposée » | `aria-command-name` (axe-core, impact *serious*) : même cause que l'anomalie 3 côté visuel — un centre `aucun_voisin` sans artiste résolu est quand même dessiné (F-38, « toujours un contenu »), avec `aria-label=""` : une commande ARIA sans nom accessible. |
| 6 | `collection-hors-ligne.spec.ts`, premier test | `synchroniserMiroir()` (`main.ts`, déclenchée par l'événement `"online"`) réussit la synchronisation mais n'appelle jamais `MiroirHorsLigne.confirmer()` — contrairement à `ajouterALaCollection`/`retirerDeLaCollection`, qui l'appellent tous les deux sur le chemin « en ligne au moment du clic ». Le miroir local ne se vide donc jamais après une reconnexion réussie : pas de perte ni de doublon visible (le serveur dédoublonne par `mbid`), mais des envois réseau inutiles à chaque futur événement `"online"`. |
| 7 | `parcours.spec.ts`, étape 2 (disposition étroite) | La liste de suggestions (`#suggestions`) ne se ferme jamais automatiquement quand la bannière de correction apparaît ; en disposition étroite, elle recouvre physiquement le bouton « Oui, planter … » (confirmé par le refus de clic de Playwright pendant 45 s : *« … intercepts pointer events »*). Un doigt réel rencontrerait le même obstacle. |
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

# estran — notice de contexte

<!-- GENERE par ./init.sh. Cette app n a pas encore de manifeste.
     Ne l'edite pas : --check refuse une notice qui a derive. -->

## Ton perimetre

Tu travailles dans `apps/estran/` et nulle part ailleurs. Si ton changement demande
de toucher `compose.yaml`, `fabrique.yml`, `init.sh`, `scripts/`, `lib/`,
`.github/`, `.claude/` ou une autre application, arrete-toi et dis ce qu'il
faudrait changer, sans le faire : une seule stack se deploie d'un bloc, et une
erreur ici casse le deploiement de toutes les autres applications.

## Ce que tu ecris

Cette application n'a pas encore de manifeste : le manifeste reste a ecrire.
Son nom — donc son sous-domaine, son conteneur et sa route — sera `estran`.
Echafaude-le avec `./init.sh --add estran`, puis relance `./init.sh`.

## Ses documents

- `apps/estran/PRODUCT.md` — la fiche produit, puis les exigences.

## Les regles qui s'appliquent a son image

Dockerfile multi-etapes, image sous 200 Mo, utilisateur non root, aucun port
publie, aucun secret, aucun label traefik, les logs sur la sortie standard, et
l'app demarre sans intervention. Le detail : `memory/regles-imperatives.md`.

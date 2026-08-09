# estran — notice de contexte

<!-- GENERE par ./init.sh depuis apps/estran/app.yml et fabrique.yml.
     Ne l'edite pas : --check refuse une notice qui a derive. -->

## Ton perimetre

Tu travailles dans `apps/estran/` et nulle part ailleurs. Si ton changement demande
de toucher `compose.yaml`, `fabrique.yml`, `init.sh`, `scripts/`, `lib/`,
`.github/`, `.claude/` ou une autre application, arrete-toi et dis ce qu'il
faudrait changer, sans le faire : une seule stack se deploie d'un bloc, et une
erreur ici casse le deploiement de toutes les autres applications.

## Ce que tu ecris

- Nom : `estran` — c'est aussi son sous-domaine, son conteneur et sa route.
- URL : https://estran.apps.billbob.ovh
- Qui entre : uniquement les comptes de la liste blanche du serveur (`exposure: private`).
- Deployee : oui.

## Comment elle tourne

- Technologie : `go`
- Port : `8080`
- Memoire : `128m`
- Healthcheck : `/healthz` — `wget --spider -q http://localhost:8080/healthz`

## Ce qu'elle garde

- Attend le secret `API_MAREE_KEY` : le NOM est dans le depot, la VALEUR est injectee par l'infrastructure.

## Comment la tester

    ./apps/estran/test.sh

## Ses documents

- `apps/estran/PRODUCT.md` — la fiche produit, puis les exigences.
- `apps/estran/README.md` — le mode d'emploi technique.
- `apps/estran/prp/` — les documents d'implementation.

## Les regles qui s'appliquent a son image

Dockerfile multi-etapes, image sous 200 Mo, utilisateur non root, aucun port
publie, aucun secret, aucun label traefik, les logs sur la sortie standard, et
l'app demarre sans intervention. Le detail : `memory/regles-imperatives.md`.

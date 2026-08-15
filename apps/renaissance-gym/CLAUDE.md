# renaissance-gym — notice de contexte

<!-- GENERE par ./init.sh depuis apps/renaissance-gym/app.yml et fabrique.yml.
     Ne l'edite pas : --check refuse une notice qui a derive. -->

## Ton perimetre

Tu travailles dans `apps/renaissance-gym/` et nulle part ailleurs. Si ton changement demande
de toucher `compose.yaml`, `fabrique.yml`, `init.sh`, `scripts/`, `lib/`,
`.github/`, `.claude/` ou une autre application, arrete-toi et dis ce qu'il
faudrait changer, sans le faire : une seule stack se deploie d'un bloc, et une
erreur ici casse le deploiement de toutes les autres applications.

## Ce que tu ecris

- Nom : `renaissance-gym` — c'est aussi son sous-domaine, son conteneur et sa route.
- URL : https://renaissance-gym.apps.billbob.ovh
- Qui entre : tout le monde, sans authentification (`exposure: public`).
- Deployee : oui.

## Comment elle tourne

- Technologie : `go`
- Port : `8080`
- Memoire : `128m`
- Healthcheck : `/healthz` — `wget --spider -q http://localhost:8080/healthz`

## Ce qu'elle garde

- Volume `renaissance-gym-donnees`, monte sur `/var/lib/renaissance-gym` — il survit au redeploiement.

## Comment la tester

    ./apps/renaissance-gym/test.sh

## Ses documents

- `apps/renaissance-gym/PRODUCT.md` — la fiche produit, puis les exigences.
- `apps/renaissance-gym/README.md` — le mode d'emploi technique.
- `apps/renaissance-gym/prp/` — les documents d'implementation.

## Les regles qui s'appliquent a son image

Dockerfile multi-etapes, image sous 200 Mo, utilisateur non root, aucun port
publie, aucun secret, aucun label traefik, les logs sur la sortie standard, et
l'app demarre sans intervention. Le detail : `memory/regles-imperatives.md`.

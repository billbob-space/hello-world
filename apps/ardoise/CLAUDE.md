# ardoise — notice de contexte

<!-- GENERE par ./init.sh depuis apps/ardoise/app.yml et fabrique.yml.
     Ne l'edite pas : --check refuse une notice qui a derive. -->

## Ton perimetre

Tu travailles dans `apps/ardoise/` et nulle part ailleurs. Si ton changement demande
de toucher `compose.yaml`, `fabrique.yml`, `init.sh`, `scripts/`, `lib/`,
`.github/`, `.claude/` ou une autre application, arrete-toi et dis ce qu'il
faudrait changer, sans le faire : une seule stack se deploie d'un bloc, et une
erreur ici casse le deploiement de toutes les autres applications.

## Ce que tu ecris

- Nom : `ardoise` — c'est aussi son sous-domaine, son conteneur et sa route.
- URL : https://ardoise.apps.billbob.ovh
- Qui entre : uniquement les comptes de la liste blanche du serveur (`exposure: private`).
- Deployee : oui.

## Comment elle tourne

- Technologie : `go`
- Port : `8080`
- Memoire : `128m`
- Healthcheck : `/healthz` — `wget --spider -q http://localhost:8080/healthz`

## Ce qu'elle garde

- Service annexe `ardoise-base` (`postgres:17-alpine`) — prive, sans URL.
  - Volume `ardoise-donnees`, monte sur `/var/lib/postgresql/data` — il survit au redeploiement.
- Depend de `redis`, service partage de la fabrique — un exemplaire pour toutes les apps.
- Attend le secret `POSTGRES_PASSWORD` : le NOM est dans le depot, la VALEUR est injectee par l'infrastructure.

## Comment la tester

    ./apps/ardoise/test.sh

## Ses documents

- `apps/ardoise/PRODUCT.md` — la fiche produit, puis les exigences.
- `apps/ardoise/README.md` — le mode d'emploi technique.
- `apps/ardoise/prp/` — les documents d'implementation.

## Les regles qui s'appliquent a son image

Dockerfile multi-etapes, image sous 200 Mo, utilisateur non root, aucun port
publie, aucun secret, aucun label traefik, les logs sur la sortie standard, et
l'app demarre sans intervention. Le detail : `memory/regles-imperatives.md`.

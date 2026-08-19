# ramure-v2 — notice de contexte

<!-- GENERE par ./init.sh depuis apps/ramure-v2/app.yml et fabrique.yml.
     Ne l'edite pas : --check refuse une notice qui a derive. -->

## Ton perimetre

Tu travailles dans `apps/ramure-v2/` et nulle part ailleurs. Si ton changement demande
de toucher `compose.yaml`, `fabrique.yml`, `init.sh`, `scripts/`, `lib/`,
`.github/`, `.claude/` ou une autre application, arrete-toi et dis ce qu'il
faudrait changer, sans le faire : une seule stack se deploie d'un bloc, et une
erreur ici casse le deploiement de toutes les autres applications.

## Ce que tu ecris

- Nom : `ramure-v2` — c'est aussi son sous-domaine, son conteneur et sa route.
- URL : https://ramure-v2.apps.billbob.ovh
- Qui entre : n'importe quel compte Google authentifie (`exposure: google`).
- Deployee : pas encore — son bloc n'entre pas dans `compose.yaml`.

## Comment elle tourne

- Technologie : `go`
- Port : `8080`
- Memoire : `128m`
- Healthcheck : `/healthz` — `wget --spider -q http://localhost:8080/healthz`

## Ce qu'elle garde

- Volume `ramure-v2-donnees`, monte sur `/var/lib/ramure` — il survit au redeploiement.
- Attend le secret `LASTFM_API_KEY` : le NOM est dans le depot, la VALEUR est injectee par l'infrastructure.

## Comment la tester

    ./apps/ramure-v2/test.sh

## Ses documents

- `apps/ramure-v2/PRODUCT.md` — la fiche produit, puis les exigences.
- `apps/ramure-v2/README.md` — le mode d'emploi technique.
- `apps/ramure-v2/prp/` — les documents d'implementation.

## Les regles qui s'appliquent a son image

Dockerfile multi-etapes, image sous 200 Mo, utilisateur non root, aucun port
publie, aucun secret, aucun label traefik, les logs sur la sortie standard, et
l'app demarre sans intervention. Le detail : `memory/regles-imperatives.md`.

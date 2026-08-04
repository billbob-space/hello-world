# Bout en bout d'ardoise

Ce que les tests unitaires ne peuvent pas prouver : qu'une ligne écrite survit
à un redéploiement, que le cache sert vraiment la deuxième lecture, qu'un
humain dans un vrai navigateur peut écrire sa ligne et la voir. Rien n'est
simulé — trois conteneurs réels, sur un réseau dédié.

## Lancer

```bash
cd apps/ardoise/e2e
npm install         # une fois
./lancer.sh
```

`lancer.sh` construit l'image, démarre `ardoise-base` (Postgres 17) et `redis`
(Valkey 8) avec les mêmes images que `fabrique.yml` et `apps/ardoise/app.yml`,
attend `/healthz`, lance les tests, puis démonte tout — y compris le volume,
qui n'est donc **pas** celui de production.

## Ce que ça exige, et ce que ça ne fait pas

Docker, Node, un navigateur. Ce script est un geste **manuel**, avant une pull
request qui touche `ardoise` — ni `test.sh` ni la CI ne le lancent, faute de
Docker en CI pour cette fabrique.

`playwright.config.js` pointe explicitement sur le Chromium préinstallé de
l'environnement de développement (`executablePath`) : sans ça, la version de
`@playwright/test` installée par `npm install` peut attendre une révision de
navigateur différente de celle en cache et refuser de démarrer. Sur une
machine sans ce Chromium préchargé, retire cette ligne — Playwright
téléchargera son propre navigateur.

## Ce que `tests/ardoise.spec.js` vérifie

| Test | Ce qu'il prouve |
|---|---|
| parcours complet | A8 du PRD : écrire, voir sa ligne, et la provenance qui passe de « base » à « cache » entre deux lectures consécutives (§5, R4) |
| ligne vide refusée | R1, message en français |
| 140 caractères | le champ ne laisse jamais dépasser — R2 lui-même est vérifié exhaustivement par `domaine_test.go`, sans navigateur |
| balises HTML | le texte s'affiche par `textContent`, jamais interprété |

Ce que ce dossier ne re-teste pas, faute d'utilité : A3 (survie au
redéploiement), A5 à A7 (invalidation, cache et base indisponibles) sont
couverts par `base_test.go` et `cache_test.go` contre une infrastructure
réelle, sans navigateur — plus rapides, et Playwright n'y ajouterait rien.

# Bout en bout de compteur

Même geste que [`apps/ardoise/e2e`](../../ardoise/e2e/README.md) : construire
l'image, monter `compteur`, `compteur-base` (Postgres 17) et `redis` (Valkey 8,
sur ce réseau dédié utilisé ici seul) sur un réseau isolé, attendre
`/healthz`, lancer Playwright, tout démonter.

```bash
cd apps/compteur/e2e
npm install
./lancer.sh
```

## Ce que `tests/compteur.spec.js` vérifie

| Test | Ce qu'il prouve |
|---|---|
| parcours complet | A8 du PRD : cliquer, voir le total avancer, la provenance qui passe de « base » à « cache » entre deux lectures consécutives |
| deux clics | l'incrémentation reste correcte sur plusieurs clics d'affilée |

Ce que ce dossier ne re-teste pas : A3 (survie au redéploiement), A5 (partage
de `redis` avec `ardoise`, sans collision), A6 et A7 (cache et base
indisponibles) sont couverts par `base_test.go` et `cache_test.go` contre une
infrastructure réelle — voir en particulier `TestNeSeMarchePasSurArdoise`,
qui écrit sous les deux clés à la fois.

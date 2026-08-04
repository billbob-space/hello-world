#!/usr/bin/env bash
# Contrat de test de la fabrique : la CI lance ce fichier, et rien d'autre.
set -euo pipefail
cd "$(dirname "$0")"

go vet ./...
go test ./...

# Les tests qui ont besoin d'une base ou d'un cache reels se sautent quand
# COMPTEUR_TEST_BASE_URL / COMPTEUR_TEST_REDIS_ADDR sont absents (voir
# base_test.go, cache_test.go) : la CI, qui ne monte pas la stack, reste
# verte. e2e/lancer.sh les exerce contre une stack reelle.

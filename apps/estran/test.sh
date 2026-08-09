#!/usr/bin/env bash
# Contrat de test de la fabrique : la CI lance ce fichier, et rien d'autre.
set -euo pipefail
cd "$(dirname "$0")"

go vet ./...
go test ./...

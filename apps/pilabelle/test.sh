#!/usr/bin/env bash
# Contrat de test de la fabrique : la CI lance ce fichier, et rien d'autre.
set -euo pipefail
cd "$(dirname "$0")"

go vet ./...
go test ./...

if command -v node >/dev/null 2>&1 && [ -d tests ] && [ -n "$(ls -A tests 2>/dev/null)" ]; then
  node --test tests/
fi

#!/usr/bin/env bash
# Contrat de test de la fabrique : la CI lance ce fichier, et rien d'autre.
set -euo pipefail
cd "$(dirname "$0")"

go vet ./...
go test ./...

# node --test tests/ traite "tests" comme un fichier : on lui passe des
# fichiers, pas le repertoire (meme piege documente dans marcq-handball).
node --test tests/*.test.js

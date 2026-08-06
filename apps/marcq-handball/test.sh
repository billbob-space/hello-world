#!/usr/bin/env bash
# Contrat de test de la fabrique : la CI lance ce fichier, et rien d'autre.
set -euo pipefail
cd "$(dirname "$0")"

# Le domaine et l'etat vivent dans le navigateur. Ils se testent avec le
# node --test de la bibliotheque standard : aucune dependance, aucune
# installation, le runner de la CI fournit Node. On lui passe des fichiers et
# non le repertoire : `node --test tests/` traite `tests` comme un fichier.
node --test tests/*.test.js

go vet ./...
go test ./...

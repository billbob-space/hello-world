#!/usr/bin/env bash
# Contrat de test de la fabrique : la CI lance ce fichier, et rien d'autre.
#
# Deux chaines, parce que l'app en a deux : le serveur Go, et les modules ES du
# navigateur. Les seconds sont testes par le node --test de la bibliotheque
# standard, sur les fichiers memes que le navigateur charge — aucune dependance
# npm n'est installee, il n'y en a pas.
set -euo pipefail
cd "$(dirname "$0")"

go vet ./...
go test ./...
node --test tests/*.test.js

#!/usr/bin/env bash
# Contrat de test de la fabrique : la CI lance ce fichier, et rien d'autre.
set -euo pipefail
cd "$(dirname "$0")"

# Le programme, le domaine et les vues vivent dans le navigateur. Ils se testent
# avec le node --test de la bibliotheque standard : aucune dependance, aucune
# installation, le runner de la CI fournit Node. On lui passe des fichiers et
# non le repertoire : `node --test tests/` traiterait `tests` comme un fichier.
node --test tests/*.test.js

# Le serveur Go (PRP 06) : le magasin de fiches, l'API et le point d'entree.
go vet ./...
go test ./...

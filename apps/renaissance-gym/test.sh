#!/usr/bin/env bash
# Contrat de test de la fabrique : la CI lance ce fichier, et rien d'autre.
set -euo pipefail
cd "$(dirname "$0")"

# Le programme, le domaine et les vues vivent dans le navigateur. Ils se testent
# avec le node --test de la bibliotheque standard : aucune dependance, aucune
# installation, le runner de la CI fournit Node. On lui passe des fichiers et
# non le repertoire : `node --test tests/` traiterait `tests` comme un fichier.
node --test tests/*.test.js

# Le serveur Go arrive au lot 2 (PRP 06). Ses deux lignes — go vet ./... et
# go test ./... — s'ajoutent ici DANS LE MEME COMMIT que le premier fichier .go :
# declarees plus tot, elles echouent sur « directory prefix . does not contain
# modules », et la CI est rouge pour toute la fabrique.

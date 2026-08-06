#!/usr/bin/env bash
# Contrat de test de la fabrique : la CI lance ce fichier, et rien d'autre.
#
# Les modules ES du navigateur sont testes par le node --test de la
# bibliotheque standard, sur les fichiers memes que le navigateur charge :
# aucune dependance npm n'est installee, il n'y en a pas.
set -euo pipefail
cd "$(dirname "$0")"

node --test tests/*.test.js

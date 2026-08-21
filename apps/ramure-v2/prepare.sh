#!/usr/bin/env bash
#
# prepare.sh — ce qu'il faut construire AVANT de compiler, tester ou relire.
#
# Contrat facultatif de la fabrique : quand ce fichier existe et est executable,
# « test.sh » et « scripts/revue.sh » l'appellent tous les deux. C'est la raison
# pour laquelle il existe separement de test.sh : la revue mesure la couverture
# en compilant, et « //go:embed web/dist » n'accepte ni chemin absent ni
# repertoire vide. Sans cette etape, « go test » echoue au SETUP du paquet
# principal — l'app parait alors non couverte alors qu'elle n'a pas ete lue.
#
# Ecrit ici et pas deux fois : deux copies de la meme preparation finissent par
# diverger, et c'est celle que personne ne lance qui a raison.
set -euo pipefail
cd "$(dirname "$0")"

npm ci --prefix web
npm run --prefix web build        # esbuild -> web/dist, requis par go:embed

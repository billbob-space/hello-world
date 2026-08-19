#!/usr/bin/env bash
# apps/ramure-v2/test.sh
#
# Contrat de test de la fabrique : la CI lance ce fichier, et rien d'autre.
# Il est appele depuis la racine du depot (./apps/ramure-v2/test.sh), d'ou le
# cd : les commandes Go doivent tourner dans le module, pas au-dessus.
#
# set -e est indispensable : sans lui, l'echec de go vet serait avale par le
# code de sortie de la derniere commande, et la CI resterait verte. Une
# commande par outil, aucun `|| true` : un test.sh qui avale un echec rend
# vert un job qui ne verifie rien (PRP 05, tache 1, piege 4).
set -euo pipefail
cd "$(dirname "$0")"

# La chaine TypeScript (PRP 05) construit AVANT Go : //go:embed web/dist
# n'accepte ni chemin absent ni repertoire vide, donc `go build` seul, sans
# `npm run build` prealable, ne compile plus (piege 3). Le runner de la CI
# fournit Go et Node : `npm ci` y fonctionne sans rien installer (piege 4).
npm ci --prefix web
npm run --prefix web build        # esbuild -> web/dist, requis par go:embed
npm run --prefix web typecheck    # tsc --noEmit
npm run --prefix web test         # vitest

# go vet d'abord : il attrape les fautes que le compilateur laisse passer
# (verbes de format, copies de mutex) et coute quelques secondes.
go vet ./...
# -race : la mutualisation des requetes (N-07) est la seule partie du produit
# dont le defaut ne se voit pas sans detecteur de concurrence.
# -count=1 : jamais de resultat servi par le cache de test.
go test -race -count=1 ./...

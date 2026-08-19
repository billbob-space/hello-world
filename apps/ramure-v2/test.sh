#!/usr/bin/env bash
# apps/ramure-v2/test.sh
#
# Contrat de test de la fabrique : la CI lance ce fichier, et rien d'autre.
# Il est appele depuis la racine du depot (./apps/ramure-v2/test.sh), d'ou le
# cd : les commandes Go doivent tourner dans le module, pas au-dessus.
#
# set -e est indispensable : sans lui, l'echec de go vet serait avale par le
# code de sortie de la derniere commande, et la CI resterait verte.
set -euo pipefail
cd "$(dirname "$0")"

# go vet d'abord : il attrape les fautes que le compilateur laisse passer
# (verbes de format, copies de mutex) et coute quelques secondes.
go vet ./...
# -race : la mutualisation des requetes (N-07) est la seule partie du produit
# dont le defaut ne se voit pas sans detecteur de concurrence.
# -count=1 : jamais de resultat servi par le cache de test.
go test -race -count=1 ./...

#!/usr/bin/env bash
# Contrat de test de la fabrique : la CI lance ce fichier, et rien d'autre.
#
# La suite couvre ce que la §13 du PRD designe comme les defauts les plus
# couteux du produit — ceux qui "passent tous la compilation et les tests
# unitaires" quand on ne les vise pas explicitement :
#
#   nom_test.go        la contamination par homonyme, et les bornes du
#                      rattrapage orthographique
#   arbre_test.go      la geometrie du canevas : monotonie de l'affinite,
#                      non-superposition des libelles, rattachement des
#                      heritiers, plancher de l'elagage
#   cache_test.go      le refus de memoriser un echec (F-37, critique),
#                      la mutualisation des requetes identiques
#   api_test.go        la distinction vide / panne (F-36, critique) et le
#                      cloisonnement des collections, contre un reseau simule
#   catalogue_test.go  la classification des types de sortie, la stabilite du
#                      classement, les liens d'ecoute, la reconciliation de la
#                      collection, les metriques
#
# Aucun test ne sort sur le reseau : la §13 l'interdit — "tester contre des
# sources reelles produit des echecs intermittents qui finissent par etre
# ignores, et masquent alors les vraies regressions".
set -euo pipefail
cd "$(dirname "$0")"

go vet ./...
go test ./...

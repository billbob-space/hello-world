#!/usr/bin/env bash
# Tests de l'application. Appele par .github/workflows/test.yml, un job par
# app, et lancable seul depuis la racine du depot : ./apps/hello-world/test.sh
set -euo pipefail
cd "$(dirname "$0")"

go vet ./...
go test ./...

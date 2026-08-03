# Construction multi-etapes : la chaine Go reste dans l'etage de build, l'image
# finale ne contient que le binaire statique, ses polices et ses pages.
# Environ 25 Mo, loin des 200 Mo du contrat.
#
# Le contexte de construction est apps/ramure, jamais la racine du depot :
# c'est ce qui isole cette app des autres applications de la fabrique.

FROM golang:1.24-alpine AS build
WORKDIR /src

# Couche de dependances separee : elle n'est reconstruite que si go.mod change.
# go.sum n'existe pas — l'application n'a aucune dependance externe, ce qui lui
# evite un telechargement de modules a la construction et une surface de mise a
# jour. Le motif go.su[m] rend le fichier optionnel sans faire echouer le COPY
# le jour ou il apparaitrait.
COPY go.mod go.su[m] ./
RUN go mod download

COPY . .

# Identifiant de la version deployee. La CI passe le SHA du commit ; une
# construction locale garde "dev". Il est expose par /healthz, par
# /api/diagnostic et par l'en-tete X-Ramure-Version — c'est ce qui permet au
# bandeau de mise a jour (F-42) de savoir qu'une nouvelle version existe.
ARG VERSION=dev

# Les tests tournent dans l'etage de build : une image ne peut pas etre publiee
# si la geometrie du canevas ou la correspondance stricte des noms a regresse.
# La CI lance deja test.sh, mais elle le fait sur un autre chemin ; ce garde-fou
# vaut aussi pour une construction locale.
RUN go vet ./... && go test ./...

# CGO desactive : binaire statique, executable tel quel dans l'image finale.
RUN CGO_ENABLED=0 go build -trimpath \
      -ldflags="-s -w -X main.version=$VERSION" \
      -o /out/ramure .

FROM alpine:3.21

# Base alpine plutot que scratch, pour deux raisons distinctes :
#
#  1. busybox y fournit wget, dont le healthcheck declare dans app.yml a besoin.
#     Une image sans shell imposerait health_cmd none.
#
#  2. ca-certificates. C'est le piege de cette application, et il est SILENCIEUX
#     a la construction : ramure appelle des sources externes en HTTPS, et une
#     image Alpine nue n'embarque AUCUNE autorite de certification. Sans ce
#     paquet, chaque appel echoue en "x509: certificate signed by unknown
#     authority" — l'application demarre, repond, passe son healthcheck, et
#     n'affiche jamais le moindre artiste. Rien dans le journal de construction
#     ne l'annonce.
RUN apk add --no-cache ca-certificates \
 && adduser -D -H -u 10001 app

COPY --from=build /out/ramure /usr/local/bin/ramure

# Aucun port n'est publie ici : Traefik joint le conteneur par apps_net.
# EXPOSE ne fait que documenter le port d'ecoute.
EXPOSE 8080

# Et surtout : aucun label de routage dans ce fichier — le contrat de la
# fabrique l'interdit sans exception, et `./init.sh --check` refuse un
# Dockerfile qui en porte. Docker fusionne les labels de l'image dans ceux du
# conteneur : un label de routage grave dans l'image publierait un routeur
# SUPPLEMENTAIRE, que le compose ne peut pas ecraser puisqu'il porte un autre
# nom — donc une URL servie sans authentification.
#
# (La verification est un simple grep sur le nom du routeur, volontairement
# sans nuance : c'est pourquoi ce commentaire ne l'ecrit pas non plus.)

USER app
ENTRYPOINT ["/usr/local/bin/ramure"]

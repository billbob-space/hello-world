# Construction multi-etapes : la chaine Go reste dans l'etage de build, la
# page web (web/) est embarquee dans le binaire final par go:embed.
#
# Le contexte de construction est apps/estran, pas la racine du depot.

FROM golang:1.24-alpine AS build
WORKDIR /src

# Aucune dependance externe : pas de go.sum a resoudre.
COPY go.mod ./
RUN go mod download

COPY . .

ARG VERSION=dev

RUN CGO_ENABLED=0 go build -trimpath \
      -ldflags="-s -w -X main.version=$VERSION" \
      -o /out/estran .

FROM alpine:3.21
# Base alpine plutot que scratch : busybox y fournit wget, dont le health_cmd
# declare dans app.yml a besoin.
#
# La base des fuseaux horaires n'est PAS installee ici : l'import time/tzdata
# l'embarque dans le binaire (cf. apps/cadran/main.go).
RUN adduser -D -H -u 10001 estran

COPY --from=build /out/estran /usr/local/bin/estran

# Aucun port n'est publie : Traefik joint le conteneur par apps_net.
EXPOSE 8080

USER estran
ENTRYPOINT ["/usr/local/bin/estran"]

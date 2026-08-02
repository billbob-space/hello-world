# Construction multi-etapes : la chaine Go reste dans l'etage de build, l'image
# finale ne contient que le binaire statique. Environ 12 Mo, loin des 200 Mo.

FROM golang:1.24-alpine AS build
WORKDIR /src

# Couche de dependances separee : elle n'est reconstruite que si go.mod change.
COPY go.mod ./
RUN go mod download

COPY . .

# Identifiant de la version deployee, affiche sur la page d'accueil : il rend
# un deploiement verifiable d'un coup d'oeil. La CI passe le SHA du commit ;
# une construction locale garde "dev".
ARG VERSION=dev

# CGO desactive : binaire statique, executable tel quel dans l'image finale.
RUN CGO_ENABLED=0 go build -trimpath \
      -ldflags="-s -w -X main.version=$VERSION" \
      -o /out/hello-world .

FROM alpine:3.21
# Base alpine plutot que scratch : busybox y fournit wget, dont le healthcheck
# declare dans app.yml a besoin. Une image sans shell imposerait health_cmd none.
RUN adduser -D -H -u 10001 app

COPY --from=build /out/hello-world /usr/local/bin/hello-world

# Aucun port n'est publie ici : Traefik joint le conteneur par apps_net.
# EXPOSE ne fait que documenter le port d'ecoute.
EXPOSE 8080

USER app
ENTRYPOINT ["/usr/local/bin/hello-world"]

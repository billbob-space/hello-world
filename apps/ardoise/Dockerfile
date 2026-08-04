# Construction multi-etapes : la chaine Go reste dans l'etage de build, l'image
# finale ne contient que le binaire statique et l'interface, embarquee dedans.
#
# Le contexte de construction est apps/ardoise, pas la racine du depot : c'est ce
# qui empeche une edition dans une autre app d'invalider le cache de celle-ci.

FROM golang:1.24-alpine AS build
WORKDIR /src

# Couche de dependances separee : elle n'est reconstruite que si go.mod ou
# go.sum change. go.sum est OBLIGATOIRE ici — sans lui, « go mod download »
# refuse de resoudre les modules en mode reproductible.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Identifiant de la version deployee, affiche sur la page : il rend un
# deploiement verifiable d'un coup d'oeil. La CI passe le SHA du commit ; une
# construction locale garde "dev".
ARG VERSION=dev

# CGO desactive : binaire statique, executable tel quel dans l'image finale.
RUN CGO_ENABLED=0 go build -trimpath \
      -ldflags="-s -w -X main.version=$VERSION" \
      -o /out/ardoise .

FROM alpine:3.21
# Base alpine plutot que scratch : busybox y fournit wget, dont le health_cmd
# declare dans app.yml a besoin. Une image sans shell imposerait health_cmd none.
RUN adduser -D -H -u 10001 ardoise

COPY --from=build /out/ardoise /usr/local/bin/ardoise

# Aucun volume n'est monte dans CETTE image : les donnees vivent dans le volume
# ardoise-donnees, monte par l'annexe ardoise-base (l'image officielle postgres,
# qui chown son propre PGDATA). Rien a creer ni a donner ici — un chown d'un
# chemin absent de cette image n'egarerait que le lecteur.

# Aucun port n'est publie : Traefik joint le conteneur par apps_net.
# EXPOSE ne fait que documenter le port d'ecoute.
EXPOSE 8080

USER 10001:10001
ENTRYPOINT ["/usr/local/bin/ardoise"]

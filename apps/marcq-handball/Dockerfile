# Construction multi-etapes : la chaine Go reste dans l'etage de build, l'image
# finale ne contient que le binaire statique — coque web comprise, embarquee par
# go:embed. Environ 14 Mo, loin des 200 Mo du plafond.
#
# Le contexte de construction est apps/marcq-handball, jamais la racine du
# depot : c'est ce qui isole cette app des autres applications de la fabrique.

FROM golang:1.24-alpine AS build
WORKDIR /src

# Couche de dependances separee : elle n'est reconstruite que si go.mod change.
# go.sum n'existe pas — l'application n'a aucune dependance externe — et le
# motif go.su[m] le rend optionnel sans faire echouer le COPY le jour ou il
# apparaitrait.
COPY go.mod go.su[m] ./
RUN go mod download

COPY . .

# Identifiant de la version deployee. Il est annonce en en-tete X-App-Version et
# nomme le cache du service worker : la CI passe le SHA du commit, une
# construction locale garde "dev".
ARG VERSION=dev

# CGO desactive : binaire statique, executable tel quel dans l'image finale.
RUN CGO_ENABLED=0 go build -trimpath \
      -ldflags="-s -w -X main.version=$VERSION" \
      -o /out/marcq-handball .

FROM alpine:3.21
# Base alpine plutot que scratch : busybox y fournit wget, dont le healthcheck
# declare dans app.yml a besoin. Une image sans shell imposerait health_cmd none.
RUN adduser -D -H -u 10001 app

COPY --from=build /out/marcq-handball /usr/local/bin/marcq-handball

# Le point de montage du volume « donnees » declare dans app.yml. Il est cree ET
# donne a l'utilisateur AVANT USER : au premier montage, Docker recopie dans le
# volume vide le repertoire tel qu'il existe dans l'IMAGE, proprietaire compris.
# Repertoire absent ou appartenant a root, et le volume appartient a root : l'app
# non-root n'y ecrirait jamais, et le symptome serait « l'app demarre et perd
# tout », jamais un message clair.
RUN mkdir -p /var/lib/marcq-handball && chown 10001:10001 /var/lib/marcq-handball

# L'interrupteur du classement. Cette variable n'est pas un secret : c'est le
# chemin de montage declare dans app.yml, et il vaut mieux qu'il vive a cote du
# chown qui le rend inscriptible. Non definie — en construction locale, sous
# « go test » —, le classement est desactive et l'app sert exactement le lot 1.
ENV MARCQ_DONNEES=/var/lib/marcq-handball

# Aucun port n'est publie ici : Traefik joint le conteneur par apps_net.
# EXPOSE ne fait que documenter le port d'ecoute.
EXPOSE 8080

USER app
ENTRYPOINT ["/usr/local/bin/marcq-handball"]

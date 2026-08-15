# Construction multi-etapes : la chaine Go reste dans l'etage de build, l'image
# finale ne contient que le binaire statique — coque web/ comprise, embarquee
# par go:embed. Largement sous les 200 Mo du plafond.
#
# Le contexte de construction est apps/renaissance-gym, jamais la racine du
# depot : c'est ce qui isole cette app des autres applications de la fabrique.

FROM golang:1.24-alpine AS build
WORKDIR /src

# Couche de dependances separee : elle n'est reconstruite que si go.mod
# change. go.sum n'existe pas — aucune dependance tierce, ossature §6 — et le
# motif go.su[m] rend le fichier optionnel sans faire echouer le COPY le jour
# ou il apparaitrait.
COPY go.mod go.su[m] ./
RUN go mod download

COPY . .

# CGO desactive : binaire statique, executable tel quel dans l'image finale.
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/renaissance-gym .

# Alpine plutot que scratch : busybox y fournit wget, dont le healthcheck
# declare dans app.yml a besoin (« wget --spider -q ... /healthz »). Une image
# scratch imposerait de changer la forme du healthcheck dans le manifeste.
FROM alpine:3.21
RUN adduser -D -H -u 10001 app

COPY --from=build /out/renaissance-gym /usr/local/bin/renaissance-gym

# Le point de montage du volume « donnees » declare dans app.yml. Cree ET
# donne a l'utilisateur AVANT USER : au premier montage, Docker recopie dans
# le volume vide le repertoire tel qu'il existe dans l'IMAGE, proprietaire
# compris. Fait apres USER, ou repertoire absent, le volume appartiendrait a
# root et l'app non-root n'y ecrirait jamais — le symptome le plus couteux a
# diagnostiquer de la fabrique, silencieux jusqu'au premier redemarrage.
RUN mkdir -p /var/lib/renaissance-gym && chown 10001:10001 /var/lib/renaissance-gym
ENV GYM_DONNEES=/var/lib/renaissance-gym

# Aucun port n'est publie ici : Traefik joint le conteneur par apps_net.
# EXPOSE ne fait que documenter le port d'ecoute.
EXPOSE 8080

USER 10001
ENTRYPOINT ["/usr/local/bin/renaissance-gym"]

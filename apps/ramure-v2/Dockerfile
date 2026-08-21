# apps/ramure-v2/Dockerfile
#
# Le contexte de construction est apps/ramure-v2, JAMAIS la racine du depot :
# c'est ce qui empeche une edition dans cadran ou hello-world d'invalider le
# cache de couches de celle-ci, et inversement.

# Etage client (PRP 05) : esbuild compile web/src -> web/dist, requis par le
# //go:embed web/dist de main.go. node_modules ne quitte JAMAIS cet etage :
# seul web/dist franchit la frontiere vers l'etage Go, via COPY --from.
FROM node:22-alpine AS client
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/src ./src
# Le manifeste et l'icone (PRP 08) sont COPIES eux aussi : le script de
# construction les recopie vers dist/, et il echoue s'ils manquent. Ce defaut
# ne se voit qu'ICI — en local, tout web/ est present, donc la commande passe ;
# dans l'image, seul ce qui est COPIE existe. C'est exactement la classe de
# panne que le PRP 05 annonce : « le Dockerfile s'ecrit et se relit, il ne se
# construit pas » depuis une session cloud.
COPY web/manifest.webmanifest web/icone.svg ./
RUN npm run build

FROM golang:1.25-alpine AS serveur
WORKDIR /src

# Couche de dependances separee : elle n'est reconstruite que si go.mod bouge.
# go.sum n'existe pas tant que l'application n'a aucune dependance externe ; le
# motif go.su[m] le rend optionnel sans faire echouer le COPY le jour ou il
# apparaitra (PRP 02 et suivants).
COPY go.mod go.su[m] ./
RUN go mod download

COPY . .
# Le bundle du client, produit par l'etage precedent. Sans cette copie,
# //go:embed web/dist echouerait a la compilation : le repertoire doit
# exister et n'etre pas vide (PRP 05, piege 3).
COPY --from=client /src/web/dist ./web/dist

# Identifiant de la version deployee. La CI passe le SHA du commit
# (build-args: VERSION=${{ github.sha }}) ; une construction locale garde "dev".
ARG VERSION=dev

# CGO desactive : binaire statique, donc executable tel quel dans l'image
# finale sans embarquer la libc de l'etage de construction.
# -trimpath retire les chemins du poste de construction du binaire ;
# -s -w retirent la table des symboles : quelques megaoctets de moins.
# La cible du -X est internal/api.Version (PRP 04) : c'est ce paquet qui
# pose l'en-tete X-Ramure-Version sur chaque reponse, main.go ne portant
# plus sa propre variable de version.
RUN CGO_ENABLED=0 go build -trimpath \
        -ldflags "-s -w -X github.com/billbob-space/hello-world/apps/ramure-v2/internal/api.Version=${VERSION}" \
        -o /out/ramure-v2 .

FROM alpine:3.20
# alpine et non scratch : busybox y fournit wget, dont le health_cmd declare
# dans app.yml a besoin. Une image scratch ou distroless n'a aucun shell et
# imposerait health_cmd: none — donc un conteneur dont personne ne sait s'il
# va bien.
RUN adduser -D -H -u 10001 ramure

COPY --from=serveur /out/ramure-v2 /usr/local/bin/ramure-v2

# Point de montage du volume nomme « ramure-v2-donnees » declare dans app.yml.
# Au PREMIER montage, Docker recopie dans le volume vide le repertoire tel qu'il
# existe DANS L'IMAGE, proprietaire compris : c'est donc ce chown, et lui seul,
# qui decide si l'app pourra ecrire. Absent, le volume appartient a root, l'app
# tourne en 10001, et le symptome est « elle demarre et perd tout » — sans une
# erreur. La ligne vient AVANT USER : apres, elle ne serait plus permise.
RUN mkdir -p /var/lib/ramure && chown 10001:10001 /var/lib/ramure

# Le chemin de persistance est fixe par l'IMAGE, pas demande a l'exploitant :
# une seule source de verite, et le PRP 07 y trouve FileStore sans reglage.
ENV RAMURE_DATA_DIR=/var/lib/ramure

# Aucun port n'est publie : Traefik joint le conteneur par le reseau apps_net,
# et compose.yaml n'a pas de section ports:. EXPOSE ne fait que documenter.
EXPOSE 8080

# L'application ne tourne pas en root : exigence de la fabrique, verifiee par
# ./init.sh --check.
USER ramure
ENTRYPOINT ["/usr/local/bin/ramure-v2"]

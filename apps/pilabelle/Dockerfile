# Construction multi-etapes : la chaine Go reste dans l'etage de build, le
# navigateur et les donnees de contenu sont embarques dans le binaire final.
#
# Le contexte de construction est apps/pilabelle, pas la racine du depot.

FROM golang:1.24-alpine AS build
WORKDIR /src

# Une dependance externe (github.com/SherClockHolmes/webpush-go, pour les
# notifications push) depuis le 9 aout 2026 : go.sum resout desormais quelque
# chose.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG VERSION=dev

RUN CGO_ENABLED=0 go build -trimpath \
      -ldflags="-s -w -X main.version=$VERSION" \
      -o /out/pilabelle .

FROM alpine:3.21
# Base alpine plutot que scratch : busybox y fournit wget, dont le health_cmd
# declare dans app.yml a besoin.
RUN adduser -D -H -u 10001 pilabelle \
 && mkdir -p /var/lib/pilabelle \
 && chown 10001:10001 /var/lib/pilabelle

COPY --from=build /out/pilabelle /usr/local/bin/pilabelle

EXPOSE 8080

USER 10001:10001
ENTRYPOINT ["/usr/local/bin/pilabelle"]

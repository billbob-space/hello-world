#!/usr/bin/env bash
# Bout en bout d'ardoise : construit l'image, monte les trois services sur un
# reseau dedie (le meme trio que compose.yaml : ardoise, ardoise-base, redis),
# attend qu'ils repondent, lance les tests Playwright, demonte tout.
#
# LANCE PAR LA CI, job « bout-en-bout (ardoise) », depuis que ce job existe.
# La phrase precedente disait le contraire -- « n'est PAS lance par la CI » --
# et elle etait devenue fausse sans que personne ne la relise : le job qui
# l'invoque a ete ajoute au workflow sans que cet en-tete bouge. Un commentaire
# faux coute plus cher que pas de commentaire du tout : il a servi a classer un
# echec de CI comme « suite manuelle, pas mon probleme ».
#
# Il reste lancable a la main, avant une pull request qui touche ardoise. Il
# exige Docker, un module Node installe (npm install dans ce repertoire) et un
# navigateur.
set -euo pipefail
cd "$(dirname "$0")"

RESEAU=ardoise-e2e
VOLUME=ardoise-e2e-donnees
PORT="${ARDOISE_E2E_PORT:-18080}"
MDP=e2e-$(date +%s 2>/dev/null || echo test)

nettoyer() {
  docker rm -f ardoise-e2e-app ardoise-e2e-base ardoise-e2e-redis >/dev/null 2>&1 || true
  docker network rm "$RESEAU" >/dev/null 2>&1 || true
  docker volume rm "$VOLUME" >/dev/null 2>&1 || true
}
trap nettoyer EXIT

nettoyer
docker network create "$RESEAU" >/dev/null
docker volume create "$VOLUME" >/dev/null

echo "==> construction de l'image"
docker build -t ardoise:e2e-local --build-arg VERSION="$(git rev-parse --short HEAD 2>/dev/null || echo local)" ..

echo "==> base et cache"
docker run -d --name ardoise-e2e-base --network "$RESEAU" --network-alias ardoise-base \
  -e POSTGRES_PASSWORD="$MDP" -v "$VOLUME:/var/lib/postgresql/data" \
  postgres:17-alpine >/dev/null

docker run -d --name ardoise-e2e-redis --network "$RESEAU" --network-alias redis \
  valkey/valkey:8-alpine valkey-server --maxmemory 64mb --maxmemory-policy allkeys-lru --save "" >/dev/null

echo "==> application"
docker run -d --name ardoise-e2e-app --network "$RESEAU" \
  -e POSTGRES_PASSWORD="$MDP" -p "$PORT:8080" \
  ardoise:e2e-local >/dev/null

echo "==> attente de /healthz"
for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:$PORT/healthz" >/dev/null 2>&1; then break; fi
  sleep 1
done
# Le conteneur tourne-t-il encore ?
#
# Meme defaut que sur les huit suites natives, et meme correctif : sans ce
# controle, un conteneur qui demarre puis meurt (boucle de redemarrage,
# migration ratee) pendant qu'un processus etranger repond sur le meme port
# laisse curl /healthz reussir, et Playwright teste alors le serveur du voisin.
# Contre-epreuve faite sur hello-world avec un imposteur : le test de sonde de
# sante PASSAIT AU VERT contre le mauvais serveur.
#
# On interroge l'etat du conteneur qu'on a nomme, pas le port : c'est la seule
# chose que personne d'autre ne peut usurper.
if [ "$(docker inspect -f '{{.State.Running}}' ardoise-e2e-app 2>/dev/null)" != "true" ]; then
  echo "le conteneur ardoise-e2e-app ne tourne plus — si quelque chose repond sur :$PORT, c'est un AUTRE processus" >&2
  docker logs ardoise-e2e-app >&2 || true
  exit 1
fi

curl -fsS "http://localhost:$PORT/healthz" >/dev/null || {
  echo "l'application ne repond pas sur /healthz" >&2
  docker logs ardoise-e2e-app >&2 || true
  exit 1
}

# /healthz NE DIT RIEN DE LA BASE, et l'app l'affirme elle-meme : « ce que
# /healthz affirme est le serveur ecoute, rien de plus » (api.go). Les routes
# de donnees, elles, repondent 503 « la base n'est pas encore prete » tant que
# postgres n'est pas joignable. Or ce script recree un volume VIDE a chaque
# passage : postgres doit donc derouler son initdb -- plusieurs secondes --
# pendant que le binaire Go ecoute, lui, en quelques centaines de millisecondes.
#
# Attendre /healthz seul revient donc a lancer les tests contre une app qui ne
# peut pas encore servir la moindre donnee. Constate en integration continue le
# 2026-08-21 sur ardoise : le seul test qui ecrit puis relit a echoue, les
# quatre qui ne touchent pas la base sont passes, et le meme job etait vert
# huit minutes plus tot sur un code quasi identique. C'est une course, pas un
# aleatoire -- elle se gagne ou se perd selon la vitesse du runner.
#
# On attend donc la route de DONNEES, la seule a dire la verite sur l'etat
# reel : « curl -f » echoue tant qu'elle repond 503. Et si elle ne repond
# jamais, on s'arrete FORT -- une attente qui abandonne en silence rendrait la
# main a Playwright contre une app inutilisable, ce qui est precisement le
# defaut qu'on corrige ici.
echo "==> attente de la base (au-dela de /healthz)"
pret=0
for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:$PORT/api/lignes" >/dev/null 2>&1; then pret=1; break; fi
  sleep 1
done
if [ "$pret" != 1 ]; then
  echo "la base n'est jamais devenue prete : /api/lignes ne repond toujours pas 2xx apres 60 s" >&2
  docker logs ardoise-e2e-base >&2 || true
  docker logs ardoise-e2e-app >&2 || true
  exit 1
fi

echo "==> tests Playwright"
if [ ! -d node_modules ]; then
  echo "node_modules absent : lance 'npm install' dans apps/ardoise/e2e d'abord." >&2
  exit 1
fi
ARDOISE_E2E_URL="http://localhost:$PORT" npx playwright test

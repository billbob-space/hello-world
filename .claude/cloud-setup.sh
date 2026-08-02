#!/usr/bin/env bash
#
# Genere par init.sh — A COLLER dans le champ "Setup script" de l'environnement
# cloud : claude.ai/code, icone nuage au-dessus de la zone de saisie, engrenage
# de l'environnement. Ce fichier n'est jamais execute par le depot ni par la CI.
#
# Pourquoi il existe. En session cloud, Claude Code charge les plugins AVANT de
# les installer : un hook SessionStart s'execute apres ce chargement, et
# /reload-plugins n'existe pas sur le web. Les plugins y atterriraient sur le
# disque sans jamais servir — et comme chaque session cloud demarre sur une VM
# neuve, le cas se represente a chaque fois. Ce script, lui, tourne avant le
# lancement de Claude Code, et son resultat est fige dans un instantane du
# disque : il ne rejoue qu'apres modification de l'environnement ou expiration
# du cache (~7 jours). C'est le seul endroit qui installe l'outillage ; le hook
# du depot ne fait que le verifier.
#
# Deux contraintes imposees par l'infrastructure cloud :
#   - sortir en 0, sinon la session refuse de demarrer — d'ou les || true ;
#   - tenir sous ~5 minutes, sinon le cache ne se construit pas.
#
# Cette liste vit hors du depot : apres un ./init.sh qui change une stack ou un
# ui, recolle ce fichier dans l'environnement. ./init.sh --check signale l'ecart.

set -u

# --- serveurs de langage : absents de l'image de base ---
# L'image cloud fournit les compilateurs, jamais les serveurs de langage. Sans
# ces binaires, les plugins LSP sont installes mais inertes : aucun diagnostic
# apres edition. Toutes les installations partent en parallele.
pids=() noms=()

( PATH="/usr/local/go/bin:$PATH" GOBIN=/usr/local/bin go install golang.org/x/tools/gopls@latest ) >/tmp/gopls-setup.log 2>&1 &
pids+=($!) noms+=(gopls)


# --- plugins Claude Code ---
# Le setup script tourne en root, avec un PATH plus maigre que celui de la
# session : le binaire vit dans l'image node embarquee par Claude Code.
command -v claude >/dev/null || export PATH="/opt/node22/bin:$PATH"

# Avant le premier lancement de Claude Code, aucune marketplace n'est
# enregistree — pas meme l'officielle. La declarer ici separe un setup script
# qui installe d'un qui echoue en silence.
claude plugin marketplace add anthropics/claude-plugins-official || true
claude plugin marketplace add pbakaus/impeccable || true
for p in \
    superpowers@claude-plugins-official \
    mattpocock-skills@claude-plugins-official \
    code-review@claude-plugins-official \
    code-simplifier@claude-plugins-official \
    commit-commands@claude-plugins-official \
    security-guidance@claude-plugins-official \
    context7@claude-plugins-official \
    github@claude-plugins-official \
    gopls-lsp@claude-plugins-official \
    frontend-design@claude-plugins-official \
    playwright@claude-plugins-official \
    impeccable@impeccable
do
  claude plugin install "$p" || echo "   echec : $p" >&2
done

for i in "${!pids[@]}"; do
  wait "${pids[$i]}" || { echo "echec ${noms[$i]} :" >&2; tail -3 "/tmp/${noms[$i]}-setup.log" >&2; }
  if command -v "${noms[$i]}" >/dev/null || [ -x "/usr/local/bin/${noms[$i]}" ]; then
    echo "${noms[$i]} present."
  else
    echo "${noms[$i]} absent — son plugin restera inerte." >&2
  fi
done

# Toujours 0 : un outil manquant degrade l'outillage, il ne doit pas empecher
# la session de demarrer.
exit 0

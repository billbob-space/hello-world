#!/usr/bin/env bash
#
# Genere par init.sh — A COLLER dans le champ "Setup script" de l'environnement
# cloud : claude.ai/code, icone nuage au-dessus de la zone de saisie, engrenage
# de l'environnement. Ce fichier n'est jamais execute par le depot ni par la CI.
#
# Pourquoi il existe. En session cloud, Claude Code charge les plugins AVANT de
# les installer : le hook SessionStart de .claude/settings.json s'execute apres
# ce chargement, et /reload-plugins n'existe pas sur le web. Les plugins
# atterrissent donc sur le disque sans jamais servir — et comme chaque session
# cloud demarre sur une VM neuve, le --if-needed du hook ne rattrape rien. Le
# setup script, lui, tourne avant le lancement de Claude Code, et son resultat
# est fige dans un instantane du disque : il ne rejoue qu'apres modification de
# l'environnement ou expiration du cache (~7 jours).
#
# Deux contraintes imposees par l'infrastructure cloud :
#   - sortir en 0, sinon la session refuse de demarrer — d'ou les || true ;
#   - tenir sous ~5 minutes, sinon le cache ne se construit pas.
#
# Cette liste vit hors du depot : apres un ./init.sh --force qui change stack ou
# ui, recolle ce fichier dans l'environnement. ./init.sh --check signale l'ecart.

set -u

# --- gopls : absent de l'image de base ---
# L'image cloud fournit les compilateurs, pas les serveurs de langage. Sans ce
# binaire, le plugin gopls-lsp est installe mais inerte : aucun diagnostic apres
# edition. En arriere-plan, pour ne pas serialiser avec les plugins.
(
  PATH="/usr/local/go/bin:$PATH" GOBIN=/usr/local/bin go install golang.org/x/tools/gopls@latest
) >/tmp/gopls-setup.log 2>&1 &
lsp_pid=$!

# --- plugins Claude Code ---
# Le setup script tourne en root, avec un PATH plus maigre que celui de la
# session : retrouve le binaire s'il n'y est pas.
command -v claude >/dev/null || {
  c=$(ls -1 /opt/*/bin/claude /usr/local/bin/claude 2>/dev/null | head -1)
  [ -n "${c:-}" ] && PATH="$(dirname "$c"):$PATH" && export PATH
}

if command -v claude >/dev/null; then
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
    echo "-> $p"
    claude plugin install "$p" || echo "   echec : $p" >&2
  done
else
  echo "claude introuvable dans le PATH — aucun plugin installe." >&2
fi

wait "$lsp_pid" || { echo "echec gopls :" >&2; tail -3 /tmp/gopls-setup.log >&2; }
if command -v gopls >/dev/null || [ -x /usr/local/bin/gopls ]; then
  echo "gopls present."
else
  echo "gopls absent — le plugin gopls-lsp restera inerte." >&2
fi

# Toujours 0 : un outil manquant degrade l'outillage, il ne doit pas empecher
# la session de demarrer.
exit 0

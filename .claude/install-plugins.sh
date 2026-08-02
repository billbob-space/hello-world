#!/usr/bin/env bash
#
# Genere par init.sh — installe les plugins declares dans .claude/settings.json.
#
# Declarer un plugin ne l'installe pas : Claude Code le signale manquant tant
# qu'il n'a pas ete recupere. Le stockage des plugins est local a la machine,
# pas au depot : chaque conteneur d'agent repart donc de zero.
#
# Le hook SessionStart de .claude/settings.json lance ce script avec
# --if-needed a chaque ouverture de session : le premier conteneur installe,
# les suivants sortent sans rien faire. En session deja ouverte au moment de
# l'installation, il reste a taper /reload-plugins — commande du terminal.
#
# EN SESSION CLOUD, CE SCRIPT NE SUFFIT PAS. Claude Code charge les plugins
# avant de les installer : le hook s'execute apres, les plugins finissent bien
# sur le disque mais la session en cours ne les voit pas, et /reload-plugins
# n'existe pas sur le web. Chaque session cloud partant d'une VM neuve, le cas
# se represente a chaque fois. Colle .claude/cloud-setup.sh dans le champ
# "Setup script" de ton environnement sur claude.ai/code : il tourne avant le
# lancement de Claude Code, et son resultat est mis en cache.
#
# Pour changer la liste : edite stack/ui dans app.yml, puis ./init.sh --force

set -u

PLUGINS="superpowers@claude-plugins-official mattpocock-skills@claude-plugins-official code-review@claude-plugins-official code-simplifier@claude-plugins-official commit-commands@claude-plugins-official security-guidance@claude-plugins-official context7@claude-plugins-official github@claude-plugins-official gopls-lsp@claude-plugins-official frontend-design@claude-plugins-official playwright@claude-plugins-official impeccable@impeccable"

# --if-needed : sortie silencieuse si tout est deja la. C'est le mode du hook,
# appele a chaque session — il ne doit ni bavarder ni echouer inutilement.
IF_NEEDED=0
[ "${1:-}" = --if-needed ] && IF_NEEDED=1

tout_installe() {
  local etat="$HOME/.claude/plugins/installed_plugins.json" p
  [ -f "$etat" ] || return 1
  for p in $PLUGINS; do
    grep -q "\"$p\"" "$etat" || return 1
  done
  command -v gopls >/dev/null || return 1
  return 0
}

[ "$IF_NEEDED" = 1 ] && tout_installe && exit 0

command -v claude >/dev/null || {
  [ "$IF_NEEDED" = 1 ] && exit 0
  echo "claude introuvable dans le PATH — rien a faire." >&2; exit 1; }

claude plugin marketplace add pbakaus/impeccable || true
failed=0
for p in $PLUGINS; do
  echo "-> $p"
  claude plugin install "$p" || { echo "   echec : $p" >&2; failed=1; }
done

# gopls-lsp lance le serveur LSP, il ne le fournit pas : sans le binaire gopls
# sur la machine, le plugin s'installe mais reste inerte, sans rien dire.
if command -v gopls >/dev/null; then
  echo "-> gopls deja present"
elif ! command -v go >/dev/null; then
  echo "note : go absent du PATH — gopls ne peut pas etre installe, le plugin gopls-lsp restera inerte." >&2
else
  echo "-> gopls (requis par gopls-lsp)"
  if go install golang.org/x/tools/gopls@latest; then
    command -v gopls >/dev/null || echo "   note : gopls installe mais hors du PATH — ajoute le repertoire de binaires de go au PATH." >&2
  else
    echo "   echec : gopls" >&2
    failed=1
  fi
fi
[ "$failed" = 0 ] && echo "Termine." || echo "Termine avec des echecs." >&2
exit $failed

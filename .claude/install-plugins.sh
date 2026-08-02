#!/usr/bin/env bash
#
# Genere par init.sh — installe les plugins declares dans .claude/settings.json.
#
# Declarer un plugin ne l'installe pas : Claude Code le signale manquant tant
# qu'il n'a pas ete recupere. Lance ce script une fois par machine ou par
# conteneur d'agent, puis /reload-plugins dans une session deja ouverte.
#
# Pour changer la liste : edite stack/ui dans app.yml, puis ./init.sh --force

set -u

command -v claude >/dev/null || {
  echo "claude introuvable dans le PATH — rien a faire." >&2; exit 1; }

claude plugin marketplace add pbakaus/impeccable || true
failed=0
for p in superpowers@claude-plugins-official mattpocock-skills@claude-plugins-official code-review@claude-plugins-official code-simplifier@claude-plugins-official commit-commands@claude-plugins-official security-guidance@claude-plugins-official context7@claude-plugins-official github@claude-plugins-official gopls-lsp@claude-plugins-official frontend-design@claude-plugins-official playwright@claude-plugins-official impeccable@impeccable; do
  echo "-> $p"
  claude plugin install "$p" || { echo "   echec : $p" >&2; failed=1; }
done

command -v gopls >/dev/null || echo "note : gopls absent du PATH — le plugin gopls-lsp restera inactif tant qu'il n'est pas installe." >&2
[ "$failed" = 0 ] && echo "Termine." || echo "Termine avec des echecs." >&2
exit $failed

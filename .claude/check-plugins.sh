#!/usr/bin/env bash
#
# Genere par init.sh — rapport d'outillage, lance par le hook SessionStart.
#
# Il n'installe rien, et c'est delibere : un hook s'execute APRES que Claude
# Code a charge ses plugins. Il arrive donc toujours trop tard pour reparer
# quoi que ce soit — mais juste a temps pour dire ce qui manque. L'installation
# appartient au setup script de l'environnement (.claude/cloud-setup.sh), seul
# point d'accroche anterieur au lancement de Claude Code.
#
# Sa sortie standard est injectee dans le contexte de l'agent : une ligne quand
# tout va bien, le detail seulement quand il y a un trou.
#
# Pour changer la liste : edite stack/ui dans app.yml, puis ./init.sh --force

set -u

PLUGINS="superpowers@claude-plugins-official mattpocock-skills@claude-plugins-official code-review@claude-plugins-official code-simplifier@claude-plugins-official commit-commands@claude-plugins-official security-guidance@claude-plugins-official context7@claude-plugins-official github@claude-plugins-official gopls-lsp@claude-plugins-official frontend-design@claude-plugins-official playwright@claude-plugins-official impeccable@impeccable"

# Un plugin installe = un repertoire non vide dans le cache local, range sous
# <marketplace>/<nom>. installed_plugins.json n'est pas lu : ce manifeste
# survit a un cache efface, et decrirait alors un outillage disparu.
n=0 total=0 manquants=""
for p in $PLUGINS; do
  total=$(( total + 1 ))
  d="$HOME/.claude/plugins/cache/${p#*@}/${p%@*}"
  if [ -d "$d" ] && [ -n "$(ls -A "$d" 2>/dev/null)" ]; then
    n=$(( n + 1 ))
  else
    manquants="$manquants $p"
  fi
done

echo "Outillage : $n/$total plugins installes."
[ -n "$manquants" ] && {
  echo "  manquants :$manquants"
  echo "  -> colle .claude/cloud-setup.sh dans le champ Setup script de l'environnement : claude.ai/code, icone nuage, engrenage."
}
# Si le plugin lui-meme manque, il est deja dans la liste ci-dessus : inutile de
# le dire deux fois, et il serait faux de l'annoncer installe.
case " $manquants " in
  *" gopls-lsp@claude-plugins-official "*) ;;
  *)
    if command -v gopls >/dev/null; then
      echo "  gopls present — diagnostics go actifs."
    else
      echo "  gopls ABSENT — gopls-lsp est installe mais inerte : aucun diagnostic apres edition."
      echo "  -> sa commande d'installation est dans .claude/cloud-setup.sh."
    fi ;;
esac

# Toujours 0 : un rapport ne fait pas echouer l'ouverture d'une session.
exit 0

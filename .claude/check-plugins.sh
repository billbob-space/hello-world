#!/usr/bin/env bash
#
# Rapport d'outillage, lance par le hook SessionStart.
#
# Il n'installe rien, et c'est delibere : un hook s'execute APRES que Claude
# Code a charge ses plugins. Il arrive donc toujours trop tard pour reparer
# quoi que ce soit — mais juste a temps pour dire ce qui manque. L'installation
# appartient au setup script de l'environnement (.claude/cloud-setup.sh), seul
# point d'accroche anterieur au lancement de Claude Code.
#
# Sa sortie standard est injectee dans le contexte de l'agent A CHAQUE SESSION :
# une ligne quand tout va bien, quel que soit le nombre d'applications, le
# detail seulement quand il y a un trou.
#
# Pour changer la liste : edite directement PLUGINS et TRIPLETS ci-dessous.

set -u

PLUGINS="superpowers@claude-plugins-official mattpocock-skills@claude-plugins-official code-review@claude-plugins-official code-simplifier@claude-plugins-official commit-commands@claude-plugins-official security-guidance@claude-plugins-official context7@claude-plugins-official github@claude-plugins-official gopls-lsp@claude-plugins-official frontend-design@claude-plugins-official playwright@claude-plugins-official impeccable@impeccable token-optimizer@alexgreensh-token-optimizer"
# plugin:binaire:stack — un triplet par serveur de langage attendu
TRIPLETS="gopls-lsp:gopls:go"
# binaire:description — un binaire par ligne, attendu par un hook du depot sans
# plugin associe. Une ligne, pas un mot separe par un espace : la description
# contient des espaces, et "for h in $HOOK_BINAIRES" les aurait pris pour autant
# de binaires distincts.
HOOK_BINAIRES="rtk:la compression des commandes bash est inactive"

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

# Un plugin LSP peut etre installe et pourtant inerte : Claude Code lance le
# binaire en clair, il doit exister sur la machine. Les deux etats divergent.
lsp_ok=0 lsp_total=0 lsp_detail=""
for t in $TRIPLETS; do
  plugin=${t%%:*}; reste=${t#*:}; bin=${reste%%:*}; stack=${reste##*:}
  # Si le plugin lui-meme manque, il est deja dans la liste ci-dessous :
  # inutile de le dire deux fois, et il serait faux de l'annoncer installe.
  case " $manquants " in *" $plugin@claude-plugins-official "*) continue ;; esac
  lsp_total=$(( lsp_total + 1 ))
  if command -v "$bin" >/dev/null 2>&1; then
    lsp_ok=$(( lsp_ok + 1 ))
  else
    lsp_detail="$lsp_detail
  $bin ABSENT — $plugin est installe mais inerte : aucun diagnostic $stack apres edition."
  fi
done

# Binaires attendus par un hook du depot, sans plugin qui en depende : meme
# principe que les LSP, sans le lien "deja signale via un plugin manquant".
hook_ok=0 hook_total=0 hook_detail=""
while IFS= read -r h; do
  [ -n "$h" ] || continue
  bin=${h%%:*}; desc=${h#*:}
  hook_total=$(( hook_total + 1 ))
  if command -v "$bin" >/dev/null 2>&1; then
    hook_ok=$(( hook_ok + 1 ))
  else
    hook_detail="$hook_detail
  $bin ABSENT — $desc."
  fi
done <<EOF
$HOOK_BINAIRES
EOF

resume="Outillage : $n/$total plugins installes"
[ "$lsp_total" -gt 0 ] && resume="$resume, $lsp_ok/$lsp_total serveurs LSP presents"
[ "$hook_total" -gt 0 ] && resume="$resume, $hook_ok/$hook_total binaires de hook presents"
echo "$resume."
[ -n "$manquants" ] && {
  echo "  manquants :$manquants"
  echo "  -> colle .claude/cloud-setup.sh dans le champ Setup script de l'environnement : claude.ai/code, icone nuage, engrenage."
}
[ -n "$lsp_detail" ] && {
  echo "$lsp_detail"
  echo "  -> leurs commandes d'installation sont dans .claude/cloud-setup.sh."
}
[ -n "$hook_detail" ] && {
  echo "$hook_detail"
  echo "  -> leurs commandes d'installation sont dans .claude/cloud-setup.sh."
}

# Toujours 0 : un rapport ne fait pas echouer l'ouverture d'une session.
exit 0

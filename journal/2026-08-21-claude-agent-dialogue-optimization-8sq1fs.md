# 2026-08-21 — claude/agent-dialogue-optimization-8sq1fs



Branche : `claude/agent-dialogue-optimization-8sq1fs`
Périmètre : fabrique
Mode : `chaud`

## Anomalies

### 1. L'endroit qu'on croit couteux n'est pas celui qui coute

**Symptome** — la demande etait « abreger les dialogues entre agents ». Le geste
evident est de reecrire les cinq fichiers de `.claude/agents/`, qui sont la seule
chose qui ressemble a un dialogue permanent. Mesure faite avant d'y toucher :
ces cinq fichiers pesent 6 510 jetons, soit **0,2 %** des 1 504 $ consommes par
le depot. Le poste reel est ailleurs — 42 % des tours sont des sous-agents, a
138 752 jetons relus par tour, et ce volume est decide par la MISSION qu'on leur
donne, pas par leur consigne.

**Cause** — la consigne d'un agent est ecrite une fois et se voit ; la mission et
le rapport sont ecrits a chaque appel et ne se voient nulle part. L'intuition
suit ce qui se voit.

**Detecte par** — `auteur`

**Action** — `contrat` — le chiffre et son raisonnement sont ecrits dans
`memory/travail.md`, sans quoi la meme intuition reviendra a la prochaine
tentative d'optimisation.

### 2. --check annoncait cinq agents et n'en verifiait que trois

**Symptome** — `memory/travail.md` disait « presence des cinq agents » dans son
champ `Tenu par`. La boucle de `check_outillage` ne listait que `analyste`,
`greffier` et `artisan` : `esthete.md` et `relecteur.md` pouvaient disparaitre
sans un mot. Le registre des agents n'etant relu qu'au demarrage d'une session,
l'absence ne se serait remarquee qu'a la session suivante, sur un
`Agent(subagent_type: "esthete")` qui ne rend rien.

**Cause** — la liste a ete ecrite quand il y avait trois agents et n'a pas suivi
les deux ajouts. Rien ne relie le nombre annonce dans `memory/` a la liste du
programme.

**Detecte par** — `auteur`

**Action** — `garde-fou` — le nouveau parcours du protocole traverse les cinq
agents nommes et refuse un fichier absent ; deux cas de `test-init.sh` le
tiennent.

### 3. Le contrat depasse son propre plafond, et cette branche l'aggrave

**Symptome** — `--check` avertit depuis un moment : `CLAUDE.md` 271 lignes pour
un plafond de 250. La regle du protocole en ajoute deux, a 273. L'avertissement
ne bloque pas, personne ne le traite, et chaque branche le repousse d'un cran.

**Cause** — l'avertissement dit quoi faire (« sors un sujet dans `memory/` »)
mais pas LEQUEL, et choisir ce qui quitte le contrat engage ce que tout futur
agent lira par defaut. Aucune branche ne veut prendre cette decision en passant.

**Detecte par** — `auteur`

**Action** — `arbitrage` — quel sujet de `CLAUDE.md` descend dans `memory/` est
une decision a prendre avec l'utilisateur, pas un correctif a glisser dans une
branche dont ce n'est pas le sujet.

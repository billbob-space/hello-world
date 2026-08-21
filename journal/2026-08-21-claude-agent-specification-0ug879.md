# 2026-08-21 — claude/agent-specification-0ug879

Branche : `claude/agent-specification-0ug879`
Périmètre : fabrique — `.claude/agents/`, `init.sh --check`, `fabrique.yml`, `memory/travail.md`
Mode : `chaud`

Demande initiale : spécifier les agents pour être efficace et économique. L'utilisateur
a ensuite demandé qu'une équipe d'agents soit lancée et que le choix soit tranché par un
banc de mesure plutôt qu'au jugé.

## Anomalies

### 1. `run_in_background: false` reste sans effet — troisième occurrence

**Symptôme** — l'artisan du banc a été lancé avec `run_in_background: false`, seul
réglage qui traduise la règle « l'artisan ne se lance JAMAIS en tâche de fond ». Le
harnais a répondu « Async agent launched successfully. […] The agent is working in the
background ».

**Cause** — le drapeau n'est pas honoré par le harnais cloud. `memory/travail.md`
le signale déjà : « deux entrées de journal rapportent le harnais démarrant en fond un
artisan lancé avec le drapeau explicite ». C'est la troisième.

**Detecte par** — `auteur` — en lisant la réponse de l'outil juste après l'appel.

**Action** — `arbitrage` — la règle « jamais en tâche de fond » n'a aucun moyen
d'exécution : elle décrit une intention que l'outil ignore. Trois options, et le choix
n'est pas le mien : la retirer et lui substituer l'isolation par arbre de travail, qui
elle est effective ; la garder comme intention en disant explicitement qu'elle n'est pas
tenue ; ou sérialiser côté appelant en n'ayant jamais deux agents écrivains en vol. Ce
banc a pris la troisième par prudence, et elle a coûté du temps de mur pour rien.

### 2. Mon relevé de vérité a perdu une valeur entière, un agent l'a vu

**Symptôme** — la vérité de référence du banc de l'analyste annonçait 355 anomalies.
Les trois analystes ont rendu 381, avec une valeur `CI 26` absente de mon relevé.

**Cause** — mon dépouillement filtrait sur `[a-zé]+`. Les sept valeurs de `Detecte par`
sont en minuscules sauf une, `CI`, en majuscules. Le filtre l'écartait en silence : il ne
rendait pas d'erreur, il rendait un total plus petit et parfaitement plausible.

**Detecte par** — `relecture` — en comparant les trois rendus à ma propre référence.
C'est l'agent mesuré qui a corrigé le banc, pas l'inverse.

**Action** — `comportement` — un vocabulaire fermé ne se dépouille pas par classe de
caractères mais par la liste des valeurs admises, celle-là même que `init.sh` contrôle.
Un filtre qui rend un sous-ensemble plausible est pire qu'un filtre qui échoue.

### 3. Deux moteurs réellement facturés sont absents de `tarifs`

**Symptôme** — `./scripts/jetons.sh --leviers` termine par « modele hors tarifs, non
facture : claude-opus-4-7 » et « claude-haiku-4-5-20251001 ». Ces deux moteurs portent
1 088 et 840 appels dans le journal.

**Cause** — `fabrique.yml` déclare `claude-haiku-4-5` quand le modèle se nomme en réalité
`claude-haiku-4-5-20251001`, et n'a jamais reçu `claude-opus-4-7`. Le rapprochement se
fait sur le nom exact, donc silencieusement à vide.

**Detecte par** — `auteur` — la commande le dit elle-même, sous « ce qui manque ».

**Action** — `garde-fou` — tout le travail des agents en haiku est aujourd'hui compté en
jetons et pas en argent, c'est-à-dire invisible dans la seule mesure qui sert à décider.
`jetons.sh` devrait rendre KO, et non signaler en passant, quand un moteur porte des
appels sans tarif.

### 4. L'esthète écrit hors de son arbre de travail, par son navigateur

**Symptôme** — l'esthète du banc travaillait dans un arbre de travail git dédié, sous
`scratchpad/`, et sa mission le lui disait explicitement. À la fin du relevé, huit
fichiers non suivis étaient apparus **à la racine du vrai dépôt** : `.playwright-mcp/`
et sept captures d'écran.

**Cause** — le serveur MCP du navigateur n'écrit pas relativement au répertoire sur
lequel l'agent travaille, mais relativement à la racine de la session. Un agent peut
donc respecter scrupuleusement son périmètre dans tous ses gestes de fichier et salir
malgré tout le dépôt par un geste de navigateur. La règle « tu ne sors pas de
`apps/<nom>/` » ne couvre que ce que l'agent contrôle.

**Detecte par** — `CI` — le garde-fou de commit, qui a refusé de laisser passer huit
fichiers non enregistrés. Sans lui, ils partaient dans le commit suivant.

**Action** — `garde-fou` — `.gitignore` devrait porter `.playwright-mcp/` et les
captures de racine, car aucune consigne d'agent ne peut empêcher un outil d'écrire où
il veut. Le contrat demande à l'esthète de ne pas sortir de son app ; il faut aussi que
le dépôt survive au cas où il en sort sans le vouloir.

### 5. L'esthète coûte dix à vingt fois n'importe quel autre agent, et personne ne l'avait mesuré

**Symptôme** — une seule critique de `cadran`, une app d'un seul écran, a coûté 6,19 $
sur le moteur intermédiaire : 16 745 072 jetons relus, 94 gestes, quinze minutes. Les
huit autres relevés du banc coûtent entre 0,07 $ et 1,95 $.

**Cause** — chaque geste de navigateur ramène une capture ou un arbre d'accessibilité
dans le contexte, et tout le contexte est relu au geste suivant. Le coût croît donc avec
le carré du nombre de gestes, pas linéairement. Aucun plafond ne borne ce nombre.

**Detecte par** — `auteur` — en chiffrant le banc, poste par poste.

**Action** — `garde-fou` — l'esthète est le seul agent dont le coût justifie un plafond
chiffré dans sa consigne, et il est aujourd'hui le seul, avec l'analyste, à ne déclarer
aucun moteur : il tourne donc sur le plus cher, par défaut et non par décision.

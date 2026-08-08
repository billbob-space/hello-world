# 2026-08-08 — claude/marcq-handball-logs-analysis-3v3vwa

Branche : `claude/marcq-handball-logs-analysis-3v3vwa`
Périmètre : marcq-handball
Mode : `chaud`

## Anomalies

### 1. Les journaux du conteneur étaient la mauvaise place pour mesurer l'usage

**Symptome** — Question du décideur : est-ce que des familles ont réussi à se
servir de l'app ? `./scripts/prod.sh journaux marcq-handball 20000` rend
1 540 lignes, dont 1 234 sondes `/healthz`, et **la plus ancienne date de dix
heures** : elle commence au démarrage du conteneur. Les cinq jours d'usage
antérieurs n'existent nulle part. La seule trace durable était
`classement.json`, qui dit qui s'est inscrit — deux enfants — et rien de ce qui
s'est passé pour ceux qui n'ont pas été jusque-là.

**Cause** — Le raisonnement de départ était juste et la conclusion fausse : le
contrat dit bien que `dockhand` recrée **toute** la stack à chaque déploiement,
y compris les apps qu'on n'a pas touchées. J'en avais tiré la conséquence sur la
disponibilité — quelques secondes de coupure — et pas celle sur les journaux :
un `docker compose up` qui recrée un conteneur ne redémarre pas un processus,
il jette le conteneur et son journal `json-file` avec. À raison de plusieurs
déploiements par jour dans une fabrique partagée, la fenêtre d'observation d'une
app n'est pas `log_max_size`, c'est **le temps écoulé depuis le déploiement de
n'importe quelle autre app**. Aucun document ne le disait, et le réglage
`log_max_size: 10m` de `fabrique.yml` suggère même le contraire.

**Detecte par** — `production`

**Action** — `contrat` — le contrat décrit la portée du redéploiement du point
de vue de la disponibilité (« dockhand recrée toute la stack ») sans dire qu'elle
emporte aussi les journaux. Une app dont le succès se mesure à l'usage doit
poser ses compteurs dans son volume, et ça ne s'invente pas au moment où on se
pose la question — c'est trop tard, la mesure manquante est déjà perdue.

### 2. « POST 200 » se lisait pareil qu'un envoi plein ou vide

**Symptome** — Le fichier de production porte une fiche créée le 7 août à 22 h 31
avec `"faits": {}` — zéro exercice coché — et un `vuLe` du lendemain 7 h 31, donc
un téléphone qui a bien reparlé au serveur. Trois `POST /api/classement 200` ce
matin-là dans les journaux, et rien qui permette de trancher entre les deux
explications, qui n'appellent pas la même réponse : un enfant inscrit qui ne
s'entraîne pas, ou un écran qui n'envoie pas ce qu'il croit envoyer. Deux
`POST 403` précèdent, et là non plus le statut ne dit pas lequel des deux refus
— nom déjà pris, ou code faux — puisque l'API les confond **délibérément** dans
sa réponse pour ne pas devenir un oracle de disponibilité de pseudonymes.

**Cause** — Le middleware de journalisation trace méthode, chemin, statut et
durée, ce qui est le bon minimum pour une app publique et une consigne du
`README` (« les journaux ne portent que… »). Mais la règle avait été écrite
contre une fuite de données nominatives, et je l'avais appliquée à tout : les
**nombres** que le serveur calcule déjà — combien d'exercices reçus, combien
ignorés, combien de participants — n'identifient personne et manquaient. La
confusion des deux refus dans la *réponse* est un choix de sécurité ; l'étendre
au *journal du serveur*, qui n'est lu que par nous, ne protégeait rien et
coûtait la seule information utile.

**Detecte par** — `production`

**Action** — `rien` — réparée par ce commit : une ligne par envoi, une par refus,
toujours sans valeur reçue.

### 3. L'élagage laissait passer un jour de plus, indéfiniment

**Symptome** — Le test du plafond de rétention des compteurs échoue à 401
journées conservées pour un plafond de 400.

**Cause** — J'élaguais au changement de date, **avant** d'insérer la journée
neuve : la carte revenait à 400, puis l'insertion la remettait à 401, et
l'élagage suivant refaisait exactement la même chose. Le plafond n'était donc pas
un plafond mais un plancher décalé d'un cran — une fuite d'une entrée par jour,
que rien n'aurait signalé en production avant la 401ᵉ journée.

**Detecte par** — `test`

**Action** — `rien` — l'élagage a été déplacé après l'insertion. Le test qui l'a
attrapé est celui qui pousse jusqu'au plafond plutôt que de vérifier le principe
sur trois entrées.

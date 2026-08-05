# 2026-08-05 — claude/db-non-mutualisees-analyse-37plw8

Branche : `claude/db-non-mutualisees-analyse-37plw8`
Périmètre : fabrique
Mode : `chaud`

## Anomalies

### 1. Le contrat autorisait la duplication d'une ressource sans jamais la faire justifier

**Symptome** — `ardoise` et `compteur`, les deux dernières applications à porter
un état, partagent le cache de la fabrique mais déclarent chacune son propre
Postgres : 352 Mo de bases annexes, et une mémoire engagée de 1088 Mo pour un
plafond de 1024. Interrogé sur ce choix, aucun document du dépôt ne le porte :
ni les `PRODUCT.md`, ni les PRP, ni les entrées de journal des deux activations
ne disent pourquoi le cache a été mutualisé et pas la base. La motivation a dû
être reconstituée après coup, à partir des propriétés du contrat — paliers
d'exposition différents, jeu d'identifiants unique d'une instance Postgres, coût
d'une modification de `fabrique.yml`.

**Cause** — `memory/services.md` énonce « un service dont plusieurs apps ont
besoin ne se duplique pas », mais l'énoncé décrit une possibilité, pas une
obligation : rien n'exige de motiver une ressource déclarée en propre, et le
`PRODUCT.md` de `compteur` documente longuement le partage de `redis` — qui
était l'objet du run 2 — sans un mot sur la base qui ne l'est pas. Un choix qui
ne coûte rien à ne pas écrire ne s'écrit pas.

**Detecte par** — `utilisateur`

**Action** — `contrat` — la charge de la preuve s'inverse : on mutualise par
défaut, et déclarer une ressource en propre s'écrit dans le `PRODUCT.md` de
l'application, avec l'une des deux seules raisons recevables.

### 2. Un déploiement livré sans dire quel réglage l'utilisateur devait poser

**Symptome** — `ardoise` puis `compteur` ont été activées en déclarant
`POSTGRES_PASSWORD` dans `env:`. Le nom figure dans les deux `app.yml`, dans les
deux `README` d'application et dans les PRP ; il n'a jamais été dit à
l'utilisateur au moment où il pouvait agir, c'est-à-dire au commit qui passe
`enabled: true`. L'anomalie est remontée par une demande explicite, plusieurs
jours après la mise en ligne.

**Cause** — le contrat traite ce sujet comme une question de documentation :
« déclare aussi les noms dans ton `README` », et `memory/perimetre.md` en fait
la seule demande légitimement adressée au serveur. Écrire n'est pourtant pas
prévenir — un document sert celui qui cherche, pas celui qui ignore qu'il doit
chercher. Le défaut vide émis par `init.sh` aggrave le silence : il est
délibéré, pour qu'un nom manquant ne fasse pas échouer le `compose up` de la
stack entière, mais il transforme l'oubli en variable vide plutôt qu'en
variable absente — donc en panne au démarrage de la base, sans cause affichée.

**Detecte par** — `utilisateur`

**Action** — `contrat` — trois annonces au lieu d'une : la rubrique du `README`
d'application, un tableau récapitulatif dans le `README` de la fabrique, et
l'annonce en conversation au moment de livrer le déploiement.

### 3. La règle décidée reste sans garde-fou, et c'est un choix

**Symptome** — les deux anomalies ci-dessus sont détectées par `utilisateur`,
la position la plus coûteuse de l'échelle avant `production`. La correction
retenue est écrite dans le contrat et nulle part ailleurs : ni `--check`, ni
`pret.sh`, ni un hook ne verront un oubli. Deux vérifications étaient pourtant
à portée — deux applications déclarant la même image en annexe privée, et une
application dont un nom d'`env:` n'apparaît dans aucun `README`.

**Cause** — arbitrage explicite de l'utilisateur, entre « consigne écrite
seulement » et « écrit plus vérification automatique ». Consigné ici parce que
l'analyste lira une distribution chargée sur `utilisateur` et proposera un
garde-fou : celui-ci a été proposé, et écarté à cette date, pas oublié.

**Detecte par** — `auteur`

**Action** — `arbitrage` — la décision est prise et réversible ; poser le
garde-fou plus tard ne demandera pas de revenir sur ce qui est écrit.

# 2026-08-07 — claude/dockhand-production-debug-hsuflj

Branche : `claude/dockhand-production-debug-hsuflj`
Périmètre : `fabrique`
Mode : `chaud`

## Anomalies

### 1. Le dépôt n'avait aucun chemin vers sa propre production

**Symptome** — la question posée était « comment te donner la capacité de débug
sur l'infra de production ». La réponse honnête, avant cette branche, était
« aucune » : ni SSH, ni socket Docker, ni la moindre route HTTP. Tout
`*.billbob.ovh` est derrière Traefik, qui exige un compte Google ; un agent n'a
pas de navigateur, donc pas de compte. Le seul moyen de savoir ce qu'une
application déployée fait vraiment était de demander une capture d'écran.

**Cause** — `memory/perimetre.md` énumère ce qui vit hors du dépôt — Traefik, le
DNS, la liste blanche, les valeurs des secrets — et conclut « n'écris pas de
demande pour lui ». Cette phrase est juste pour la *configuration*, et elle a été
lue comme valant aussi pour l'*observation*. Or les deux ne se ressemblent que de
loin : demander un réglage, c'est demander à quelqu'un d'agir une fois ;
regarder un journal, c'est ce qu'on fait vingt fois par heure quand quelque
chose ne marche pas. Le premier se délègue, le second non — et rien dans le
contrat ne distinguait les deux.

**Detecte par** — `utilisateur`

**Action** — `contrat` — le `README` porte désormais la section « Regarder la
production » : la porte de service, les deux variables, et le contrôle en trois
`curl` qui prouve que la porte reste étroite. `CLAUDE.md` y renvoie depuis le
paragraphe du déploiement, seul endroit où un agent pense à la production.

### 2. `dockhand` en édition libre ne sait pas faire un jeton en lecture seule

**Symptome** — le plan initial annoncé à l'utilisateur était « crée un jeton, je
m'en sers pour lire ». Vérification faite dans la documentation : le contrôle
d'accès par rôles est réservé à l'édition Enterprise, et en édition libre « tout
utilisateur authentifié a un accès administrateur complet ». Le jeton demandé
pouvait donc arrêter les neuf conteneurs de la stack, et rien côté `dockhand` ne
permettait de l'en empêcher.

**Cause** — avoir supposé qu'un outil d'administration moderne offre forcément
un palier de lecture. C'est vrai de la plupart, faux de celui-ci, et la
distinction ne se lit que dans la page des tarifs — pas dans la page de l'API,
qui est celle qu'on ouvre quand on cherche à automatiser.

**Detecte par** — `auteur`

**Action** — `contrat` — la lecture seule est obtenue **avant** `dockhand`, par
la règle du routeur Traefik : `Method(GET)`. Un `POST` ne l'atteint jamais, il
retombe sur le routeur d'origine et repart vers Google. Le `README` dit
explicitement que ce routeur est le seul verrou, pour que personne n'élargisse
la règle en croyant que `dockhand` garde encore quelque chose derrière.

### 3. Le premier test réussi ne prouvait rien : `/api/health` est ouvert

**Symptome** — porte ouverte, premier appel : `GET /api/health` répond `200`
avec un jeton. Conclusion tentante et fausse — « le jeton fonctionne ». Le même
appel **sans** jeton répond `200` lui aussi : cette route est publique dans
`dockhand`, l'en-tête d'autorisation n'a jamais été regardé. Il a fallu
`/api/containers` — `401` sans jeton, `200` avec — pour savoir quoi que ce soit.

**Cause** — une route de santé est faite pour répondre à un supervisieur qui n'a
pas d'identité ; elle est donc, par construction, le pire endroit où tester une
authentification. Le réflexe « je commence par le point le plus simple » choisit
pourtant exactement celui-là.

**Detecte par** — `auteur`

**Action** — `comportement` — un contrôle d'accès se vérifie sur une route qui
porte des **données**, et toujours dans les deux sens : avec jeton et sans. Les
trois `curl` du `README` sont écrits comme ça, et le troisième — un `POST` qui
doit être refusé — est celui qui compte, parce qu'il est le seul dont l'échec
serait une urgence.

### 4. Le contrat était à une ligne de son plafond

**Symptome** — `CLAUDE.md` faisait 249 lignes pour un plafond de 250. Mentionner
`prod.sh` — deux phrases — a consommé le dernier crédit. Le sujet a donc été
écrit dans le `README` et seulement *annoncé* dans le contrat, alors que
`memory/` est l'endroit prévu pour ça.

**Cause** — le plafond est une bonne contrainte et il fonctionne : il a bien
empêché d'élargir le contrat. Mais il ne dit pas *où* déplacer ce qui déborde, et
`memory/` impose une contrepartie — `Tenu par : --check|CI|hook` — qu'un sujet
purement documentaire ne peut pas honorer. « Regarder la production » n'est tenu
par aucun contrôle : c'est une capacité, pas une règle. Il n'avait donc sa place
ni dans le contrat, ni dans `memory/`, et le `README` l'a reçu par défaut.

**Detecte par** — `auteur`

**Action** — `arbitrage` — soit le plafond monte, soit `memory/` accepte un
sujet tenu par « rien » à condition qu'il ne porte aucune règle. Les deux se
défendent, et aucun agent ne devrait trancher seul un réglage qui décide de ce
que tous les suivants liront en permanence.

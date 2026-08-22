# Règles impératives — le détail

Quand lire : avant d'écrire ou de modifier un `Dockerfile`, un `test.sh`, ou le
démarrage d'une app.
Tenu par : --check — section `ports:` refusée, `USER` absent refusé, bind mount
refusé, `LABEL traefik.*` dans le Dockerfile refusé ; CI — taille d’image et
`LABEL traefik` hérité de l’image de base

- **Un `Dockerfile` par app, dans `apps/<nom>/`**, construction multi-étapes, image
  finale **< 200 Mo** — le disque du serveur est à 92 %. Le contexte de construction
  est `apps/<nom>`, pas la racine : c'est ce qui empêche une édition dans une app
  d'invalider le cache des autres.
- **L'app tourne en utilisateur non root** (`USER` dans le `Dockerfile`).
- **Ne publie aucun port.** Pas de section `ports:`. Traefik joint le conteneur par
  `apps_net` ; deux apps peuvent écouter sur le même port, rien n'est publié sur
  l'hôte.
- **Le fichier Compose s'appelle `compose.yaml`**, à la racine : c'est le seul nom que
  `dockhand` ouvre côté serveur — un `docker-compose.yml` lui renvoie « Compose file
  not found ». Il est **généré**, ne l'édite jamais à la main.
- **Le routage vit dans les labels du `compose.yaml`**, générés. N'y touche pas : le
  middleware du palier et `priority=100` y sont posés — cette priorité empêche un
  serveur catch-all de capter l'URL et de servir un 404 silencieux.
- **Chaque app déclare ses tests dans `apps/<nom>/test.sh`**, exécutable. La CI ne
  lance que ce fichier ; la fabrique n'a pas à connaître ton langage. **Il tourne
  réseau coupé** — `RESEAU_COUPE`, dans `lib/socle.sh` — parce qu'un test qui
  interroge un vrai fournisseur ment dans les deux sens : réussi, il ne se voit
  pas ; échoué, il se lit comme la panne que le test couvrait justement. Deux
  tests d'`estran` l'ont fait pendant des semaines. Ce qui doit être **installé**
  va dans `prepare.sh`, lancé avant et hors du piège : installer n'est pas
  tester. La coupure vaut aujourd'hui pour **Go seulement** ; `lib/socle.sh` dit
  pourquoi Node y échappe, plutôt que de laisser croire qu'il est couvert.
- **Aucun `LABEL traefik.*` dans l'image**, sans exception — ni écrit dans le
  `Dockerfile`, ni **hérité de l'image de base**. Un label de routage gravé dans
  l'image publie un routeur **supplémentaire**, que le compose ne peut pas écraser
  puisqu'il porte un autre nom — donc **sans authentification**. `--check` lit le
  `Dockerfile`, où un label hérité n'apparaît pas ; la CI inspecte donc en plus
  l'**image construite** et refuse la construction. Si l'image de base en porte un, il
  faut en changer.
- **Aucun secret** dans le dépôt ni dans l'image : déclare les noms attendus dans
  `env:` et dans le `README`, jamais les valeurs.
- **Ce qui doit survivre au redéploiement vit dans un volume nommé**, et le
  `Dockerfile` `chown` son chemin avant `USER`.
- **Écris les logs sur la sortie standard**, pas dans un fichier.
- **L'app doit démarrer sans intervention** : pas de migration manuelle, pas de
  question interactive, pas de fichier à créer à la main.

## Un piège de shell qui rend un faux verdict : `printf … | grep -q`

Cette forme, courante dans les tests et les garde-fous, est une **course** :

```bash
printf '%s\n' "$sortie" | grep -q -- "$motif"   # NON
grep -q -- "$motif" <<< "$sortie"               # OUI
```

`grep -q` sort **dès qu'il a trouvé** et ferme le tuyau ; `printf`, qui a encore
de quoi écrire, reçoit `EPIPE` et rend non nul. Sous `set -o pipefail` — que
posent 22 des 29 scripts du dépôt — le pipeline rend donc **non nul alors que le
motif a été trouvé**, et l'assertion conclut l'exactement contraire de ce qu'elle
observe. Le herestring `<<<` n'a pas de tuyau à casser.

Même cause, autre symptôme : un pipeline d'affichage terminé par `head -N` tue
son étage précédent dès qu'il a ses N lignes, et sous `set -e` la fonction meurt
**au milieu**. Termine-le par `|| true`, ou fais sortir le producteur lui-même —
`grep -m1` plutôt que `grep … | head -1`.

**Ça ne se déclenche que sur une sortie volumineuse** : en dessous de la taille du
tampon de tuyau, `printf` a fini d'écrire avant que `grep` ne sorte, et tout va
bien. D'où sa méchanceté — la forme marche sur les petites valeurs, où le dépôt
l'emploie légitimement une douzaine de fois, et ne trahit que sur la sortie d'un
programme entier. Elle a rendu la CI rouge le 18 août 2026 sur un motif pourtant
présent en première ligne, et seulement une fois les cas joués en parallèle.

**Aucun contrôle automatique ne la surveille, et c'est délibéré** : distinguer la
petite valeur de la grande demanderait de deviner ce que contient une variable.
Un `--check` qui signalerait les deux crierait à tort douze fois sur treize —
et un garde-fou qui crie à tort ne garde rien.

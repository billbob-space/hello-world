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
  lance que ce fichier ; la fabrique n'a pas à connaître ton langage.
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

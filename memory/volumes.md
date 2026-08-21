# Les volumes nommés — ce qui survit au redéploiement

Quand lire : avant d'ajouter, de renommer ou de supprimer une entrée `volumes:`
dans un `app.yml`, dans `shared_services` ou dans un service annexe.
Tenu par : --check — forme du spec, préfixe du propriétaire, collisions entre
apps, bloc de premier niveau et `name:`, `chown` du chemin monté (avertissement)

Le système de fichiers d'un conteneur est jeté à chaque déploiement : ce qui doit
persister se déclare dans `volumes:`, et **rien d'autre ne survit**. La forme est
`<nom>:<chemin conteneur>[:ro]` — nom logique à gauche conforme à
`^[a-z0-9][a-z0-9-]*$`, chemin absolu à droite, `:ro` seul suffixe admis.

`donnees:/var/lib/ramure` déclaré par `ramure-v2` devient le volume
**`ramure-v2-donnees`** : c'est le préfixe du propriétaire qui empêche deux apps de se
marcher dessus, et deux propriétaires produisant le même nom réel sont refusés. Le
chemin à droite ne commande rien du nom — celui-ci est resté `/var/lib/ramure`
après le renommage de l'app, et le volume s'appelle bien `ramure-v2-donnees`.

**Un `/` à gauche est un bind mount, refusé à la génération.** Il faudrait créer le
chemin d'hôte à la main avant le premier déploiement, et Docker créerait un
répertoire absent **en root** — que l'app, non-root, n'écrirait jamais. Les volumes
nommés existent pour supprimer ce geste : `docker compose up` crée le volume au
premier démarrage et le conserve entre deux déploiements. **Aucune action sur
l'hôte, jamais, pour aucune app.**

**Le piège a déménagé dans ton `Dockerfile`.** Au premier montage, Docker recopie
dans le volume vide le contenu du répertoire **tel qu'il existe dans l'image**,
propriétaire compris : répertoire absent de l'image, ou appartenant à root, et le
volume appartient à root — ton app non-root ne peut pas y écrire. Le symptôme est
« l'app démarre et perd tout », jamais un message clair. La parade tient en une
ligne, **avant** `USER` :

```dockerfile
RUN mkdir -p /var/lib/ramure && chown 10001:10001 /var/lib/ramure
USER 10001:10001
```

`./init.sh --check` relit ton `Dockerfile` et **avertit** — sans bloquer, un `chown`
prenant des formes qu'un grep ne voit pas — quand un chemin monté n'y est jamais
donné à personne. C'est le dernier moment où le piège se rattrape avant la
production. L'avertissement couvre les volumes de l'app **plus** ceux de ses annexes
bâties sur l'image de l'app (`ghcr.io/<org>/<dépôt>/<app>:*`) ; restent hors de
portée, faute de `Dockerfile` ici, une annexe sur image **tierce** et les volumes
des `shared_services`.

**`name:` — pourquoi le compose porte deux fois le même nom.** Compose préfixe par
défaut les volumes de premier niveau par le nom du projet : le volume réel
s'appellerait `<projet>_ramure-v2-donnees`, et la commande de sauvegarde ci-dessous,
montant le nom court, le ferait **créer vide** par Docker — `tar` archiverait un
répertoire vide et **sortirait en 0**, l'illusion parfaite d'une sauvegarde.
`init.sh` émet donc `name: <nom>` sous chaque entrée, et `--check` refuse un bloc où
il manque. Corollaire : le nom devient **global à l'hôte** ; le préfixe par nom
d'app rend une collision avec une autre stack improbable, pas impossible.

**Sauvegarder, effacer, borner.** Un volume nommé ne s'ouvre pas avec un `cat` : son
contenu passe par un conteneur jetable, lancé côté serveur.

```bash
docker run --rm -v ramure-v2-donnees:/d -v "$PWD":/sortie alpine \
  tar czf /sortie/ramure-v2-donnees.tgz -C /d .
```

**Le disque du serveur est à 92 %**, et un volume n'a aucune borne : il grossit
jusqu'à ce que la stack entière n'ait plus de place. Un volume de cache doit donc
être **borné par ton code et jetable** — ce que ton app ne sait pas reconstruire n'a
rien à y faire. Et la séparation entre ce qui se sauvegarde et ce qui s'efface doit
se lire **dans les noms** : `donnees` se sauvegarde, `cache` se supprime. Celui qui
fait de la place à trois heures du matin n'aura que ces noms pour décider, et
`docker volume rm` est irréversible.

Le reste est vérifié pour toi, à la génération comme au `--check` : le même nom deux
fois dans une liste, ou deux volumes sur le même chemin conteneur — le second
masquerait le premier — sont refusés ; le bloc `volumes:` de premier niveau doit
déclarer **exactement** les volumes montés, chacun avec son `name:`. Un montage
absent de ce bloc n'est **pas** réinterprété en bind mount : Compose refuse le projet
entier, avant qu'un seul conteneur ne démarre. Une app désactivée ne contribue aucun
volume, puisqu'aucun de ses services n'est émis.


# Les trois sortes de services — une seule est routée

Quand lire : avant d'ajouter un service annexe à une app, un `shared_services`
à la fabrique, ou avant de nommer une app.
Tenu par : --check — `traefik.enable=false` sur tout service non routé, aucun
autre label `traefik.*`, collision de noms dans l’espace plat, `needs:` inconnu

`compose.yaml` porte trois sortes de services dans un espace de noms **plat**, et
une seule est joignable depuis Internet :

| Service | D'où il vient | Labels Traefik |
|---|---|---|
| `<app>` | `apps/<app>/app.yml` | **oui** : un routeur, l'URL `https://<app>.apps.billbob.ovh`, le middleware d'authentification, `priority=100` |
| `<app>-<nom>` | section `services:` du même `app.yml` | `traefik.enable=false`, **et lui seul** |
| `<nom>` | `shared_services` de `fabrique.yml` | `traefik.enable=false`, **et lui seul** |

**Ce qui expose un service à Internet, ce sont ses labels, pas le réseau.** Les
trois sortes vivent sur `apps_net`, se joignent par leur nom de service et ne
publient aucun port sur l'hôte.

**Mais l'absence de label ne retire rien du routage — c'est l'inverse de
l'intuition.** Traefik tourne par défaut avec `exposedByDefault` : un conteneur
**qui ne porte aucun label** obtient quand même un routeur, joignable et **sans
authentification**. Docker fusionne par ailleurs les labels gravés dans l'**image**
avec ceux du conteneur : une image tierce, ou compromise, portant un
`LABEL traefik.*` publierait un routeur que `compose.yaml` ne peut pas écraser,
puisqu'il porte un autre nom.

Un seul label **retire** réellement un service du routage, et `init.sh` le pose
**systématiquement** sur chaque annexe et chaque service partagé :

```yaml
    labels:
      - "traefik.enable=false"
```

Inoffensif si le serveur pose déjà `exposedByDefault: false`, indispensable sinon.
`./init.sh --check` en fait un KO bloquant **dans les deux sens** : un service non
routé qui ne le porte pas est refusé, et tout **autre** label `traefik.*` sur ce
service l'est aussi, puisqu'il publierait une URL qu'aucun middleware ne protège.

**L'espace de noms étant plat**, `<app>`, `<app>-<nom>` et `<nom>` se disputent les
mêmes noms. Une app nommée `redis` face à un `shared_services` nommé `redis` est un
doublon de clé YAML : légal, silencieux, la dernière gagne et la première disparaît
du déploiement sans un mot. `init.sh` refuse la collision au lieu de la générer.

## `shared_services` — un exemplaire pour toute la fabrique

Un service dont plusieurs apps ont besoin ne se duplique pas : il se déclare une
fois dans `fabrique.yml`, avec les mêmes sections `volumes:` et `env:` qu'une app.

```yaml
shared_services:
  - name: redis
    image: valkey/valkey:8-alpine
    memory: 128m
    command: --maxmemory 96mb --maxmemory-policy allkeys-lru
    volumes:
      - donnees:/data            # volume nommé « redis-donnees »
```

Son `image` est tirée telle quelle. Le garde-fou de CI inspecte **chaque** image du
compose, dédoublonnée, avant l'appel du webhook, et les traite **toutes pareil** :
une seule introuvable, fût-elle tierce, refuse le déploiement — `docker buildx
imagetools inspect` interroge le registre en **anonyme** faute d'identifiants, donc
une image tierce mal orthographiée est un fait constatable ici, pas un droit
manquant. La laisser passer ferait tomber **toutes** les apps, le `compose up`
étant atomique.

`fabrique.yml` étant commun, le modifier fait **reconstruire toutes les apps** au
prochain passage en CI : plus rien ne garantit alors que les images publiées
correspondent aux manifestes courants.

**Le budget mémoire compte les trois sortes.** `memory_budget` plafonne la somme de
tous les `mem_limit` : un worker à 64 Mo et un Redis à 128 Mo y pèsent autant qu'une
app, parce que l'OOM killer ne fait pas la différence et que tout démarre d'un coup.
`--check` affiche la somme, le nombre de services, et avertit au-delà.


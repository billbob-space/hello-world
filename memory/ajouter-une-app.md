# Ajouter une application — le détail

Quand lire : avant `./init.sh --add`, et avant chacun des deux commits qui
suivent.
Tenu par : --check — « compose.yaml désynchronisé des manifestes » sur un commit
qui n'emporte pas les artefacts régénérés, et l'avertissement de plugin manquant
; CI — le job `contrat`, verrou de tous les autres jobs

## Les deux commits

```bash
./init.sh --add ma-nouvelle-app --stack go --exposure private
# écris apps/ma-nouvelle-app/{Dockerfile,test.sh,PRODUCT.md,README.md,code}
./init.sh --check
git add apps/ma-nouvelle-app compose.yaml .gitignore go.work
git commit                                    # commit 1 : la CI publie l'image

./init.sh --app ma-nouvelle-app --enable      # une fois l'image publiée
./init.sh --check
git add apps/ma-nouvelle-app/app.yml compose.yaml && git commit   # commit 2
```

Le chemin en un seul commit fonctionne aussi. La séquence en deux fait arriver
l'échec « l'image ne se construit pas » sur un commit qui **ne peut pas** casser
les autres apps — c'est tout ce qu'elle achète, et c'est cher payé une fois
qu'on a cassé le déploiement de sept applications pour une huitième.

## Ce que le commit 1 doit emporter

**Les artefacts régénérés, pas seulement `apps/<nom>`.** `--add` réécrit
`compose.yaml`, complète `.gitignore`, et régénère `go.work` dès que le module
Go existe. N'ajouter que `apps/<nom>` fait échouer le job `contrat` en CI sur
« compose.yaml désynchronisé des manifestes », **avant même la construction** :
l'app neuve ne casse rien, mais la CI est rouge pour tout le monde.

**Ce que `--add` ne réécrit pas** — et c'est le piège inverse, celui qui fait
committer des fichiers intacts en croyant les avoir régénérés :

| Fichier | Qui l'écrit |
|---|---|
| `compose.yaml`, `.gitignore`, `go.work` | `--add`, à chaque fois |
| `apps/<nom>/CLAUDE.md` | `init.sh`, à chaque fois |
| `.github/workflows/build.yml` | personne — fichier ordinaire ; `--check` en vérifie deux propriétés, pas l'égalité à un générateur |
| `.claude/settings.json`, `.claude/cloud-setup.sh` | personne — à éditer à la main quand l'app introduit un langage ou un `ui: true` nouveau ; `--check` avertit si un plugin manque |

Le commit 2 ne touche que `app.yml` et `compose.yaml` : `--enable` ne touche
rien d'autre.

**`--add` ne réécrit jamais un `PRODUCT.md` ni un `README.md` déjà présents,
`--force` compris.** C'est ce qui rend légitime un `apps/<nom>/` qui ne porte
que ses documents — une app dont le code n'est pas encore écrit — et ce qui
permet de relancer `--add` sur une app existante sans perdre son PRD.

## Pourquoi une app naît `enabled: false`

Une image absente du registre fait échouer `docker compose up` **pour la stack
entière**. Une app neuve n'a pas encore d'image : la publier prend un passage en
CI, et `enabled: false` est ce qui l'empêche d'entrer dans le compose avant.
C'est le premier des trois garde-fous du rayon de souffle.

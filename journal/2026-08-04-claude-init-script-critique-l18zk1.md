# 2026-08-04 — claude/init-script-critique-l18zk1

Branche : `claude/init-script-critique-l18zk1`
Périmètre : fabrique
Mode : `chaud`

Session ouverte par une demande d'avocat du diable sur `init.sh`. La critique a
tenu sur cinq points ; deux se sont révélés faux à la lecture du code, et c'est
en construisant le garde-fou qui manquait — des tests du générateur — qu'un
défaut latent de génération est apparu.

## Anomalies

### 1. Un volume déclaré au niveau de l'app portait un nom réel doublement préfixé

**Symptôme** — un `volumes:` en colonne 0 dans un `app.yml` produit un volume
nommé `hello-world-hello-world-donnees` au lieu de `hello-world-donnees`.
Invisible : le compose reste cohérent avec lui-même — le service monte le nom
qu'il déclare — et `--check` passe au vert, y compris le contrôle qui compare le
bloc `volumes:` de premier niveau aux volumes montés. Latent aussi : les deux
seules apps qui déclarent des volumes (`ardoise`, `compteur`) les portent dans
un service annexe, chemin qui préfixe correctement, et sont l'une et l'autre
`enabled: false`. Le `compose.yaml` committé était donc juste.

**Cause** — `load_app` remplissait `A_VOLUMES` avec `"$APP-$nom:$chemin"`, alors
que ses cinq consommateurs passent tous par `check_volume()`, qui préfixe
lui-même par le propriétaire. Le préfixe était posé deux fois. `A_VOL_NOMS`, qui
sert à détecter une collision entre apps, doit lui porter le nom réel : les deux
tableaux ont la même forme et des rôles opposés, et rien ne le disait.

La conséquence n'est pas cosmétique. `memory/volumes.md` documente le nom réel
comme `<app>-<nom>` et donne une commande de sauvegarde qui monte ce nom-là. Sur
un nom qui n'existe pas, Docker crée le volume vide, `tar` archive un répertoire
vide et **sort en 0** — exactement l'illusion de sauvegarde contre laquelle ce
même fichier met en garde à propos du préfixe de projet Compose.

**Detecte par** — `test`

**Action** — `garde-fou` — aucun contrôle ne regardait la VALEUR produite, tous
comparant le compose aux manifestes ; `test-init.sh` ajoute le cas manquant.

### 2. `init.sh` était le seul programme du dépôt que rien ne testait

**Symptôme** — 3 406 lignes, verrou de CI de tous les autres jobs, aucun test,
aucun contrôle de syntaxe. Chaque app a son `test.sh` ; le programme qui les
autorise toutes n'avait rien. Un « ok » erroné de sa part laisse passer une
faute dans les quatre apps à la fois.

**Cause** — le script s'est construit par ajouts successifs de garde-fous, tous
tournés vers le dépôt, aucun vers lui-même. Symptôme visible de cette absence de
relecture d'ensemble : `ylist()` y est défini **deux fois** (lignes 143 et 195),
la première définition étant morte depuis.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — `test-init.sh` et le job `tests-du-generateur`.

### 3. Un test qui passait alors que le contrôle testé était entièrement neutralisé

**Symptôme** — le cas « un secret dans la commande d'un service annexe est
refusé » restait vert avec `SECRET_WORD` remplacé par un motif qui ne reconnaît
plus rien.

**Cause** — le harnais cherchait le mot attendu dans **toute** la sortie de
`--check`, or celle-ci imprime `-- secrets` et `-- volumes` comme titres de
section à chaque exécution. Le motif se rencontrait donc toujours. Corrigé en
restreignant la recherche aux lignes de refus (`KO` ou `ERREUR :`).

Deuxième leçon du même passage : la première tentative de mutation — neutraliser
le refus des bind mounts — n'a fait rougir aucun cas, non par faiblesse du test
mais parce que **deux** gardes indépendants refusent cette forme. Une mutation
qui ne rougit pas ne condamne pas le test avant qu'on ait cherché le second
garde.

**Detecte par** — `auteur`

**Action** — `comportement` — un test écrit après coup ne prouve rien tant qu'on
ne l'a pas vu échouer ; ici seule la mutation du code testé l'a établi.

### 4. Deux objections de la critique se sont révélées fausses à la vérification

**Symptôme** — deux reproches avancés avec assurance, et retirés après lecture :

- « les contrôles de documentation bloquent la mise en ligne des quatre apps
  pour un titre en double ». Faux : le job `contrat` tourne sur chaque
  `pull_request`, donc l'échec porte sur la proposition qui a introduit le
  défaut, avant fusion. Aucune app tierce n'est retenue.
- « les contrôles sur `memory/` sont de la convention ». Faux : `Tenu par` est
  le critère de sortie du contrat rendu exécutable — il empêche une règle de
  quitter `CLAUDE.md` sans que rien ne la rattrape. Les desserrer aurait
  supprimé le garde-fou en croyant ranger.

**Cause** — critique menée sur la forme du script (tailles, découpage, comptage
de lignes) avant d'avoir lu ce que chaque contrôle protège et quand il s'exécute.
L'étape « desserrer la police des documents », validée sur ces deux prémisses, a
été annulée avant d'écrire une ligne.

**Detecte par** — `auteur`

**Action** — `comportement` — mesurer avant d'affirmer : le premier découpage
annoncé (« une fonction de 558 lignes ») était lui aussi faux, l'outil de mesure
ayant pris pour une fonction le corps de `--check`, qui n'en est pas une.

### 5. Un quart du fichier est du commentaire, et c'est ce qui vaut le plus

**Symptôme** — 934 lignes de commentaire sur 3 406. Une critique qui vise le
nombre de lignes conduit mécaniquement à les supprimer.

**Cause** — ces commentaires ne décrivent pas le code : chacun consigne
l'incident qui a motivé la règle. Ils sont la seule trace de ce qui a coûté cher.
« Réduire » était un mauvais objectif ; les deux vrais défauts sont la **forme**
— le corps de `--check` fait 464 lignes hors de toute fonction, donc intestable
par morceaux — et le **périmètre** : cinq métiers dans un fichier, dont le
comptage de jetons, qui dépend d'un format interne de Claude Code que rien ne
garantit.

**Detecte par** — `auteur`

**Action** — `arbitrage` — le découpage du corps de `--check` reste à faire ; la
sortie des trois métiers hors sujet demande une décision.

<!-- cout : genere par ./init.sh --cout, ne pas editer a la main -->
## Coût

Relevé le 2026-08-04 à 21:31 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 14 328 | 0,07 $ |
| Écriture de cache | 953 590 | 2,75 $ |
| Lecture de cache | 24 135 477 | 10,08 $ |
| Sortie | 220 637 | 3,59 $ |
| **Total** | **25 324 032** | **16,50 $ — 14,33 €** |

<!-- cout-total: 25324032 -->
<!-- /cout -->

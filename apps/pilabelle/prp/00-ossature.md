# Ossature — pilabelle

> Contrat technique partagé par tous les PRP. Chaque PRP le lit avant de
> commencer, et n'invente aucun nom qui n'y figure pas.
>
> **Source produit :** `apps/pilabelle/PRODUCT.md`
> — le PRD tranche le *quoi* et le *pourquoi*. Ce fichier tranche le *où* et
> le *comment nommer*. En cas de désaccord, le PRD gagne et ce fichier est
> corrigé.

---

## 1. Identité de l'application

| | |
|---|---|
| Nom (donc répertoire, sous-domaine, conteneur, routeur) | `pilabelle` |
| URL | `https://pilabelle.apps.billbob.ovh` |
| Palier d'exposition | `private` — comptes de la liste blanche du serveur uniquement |
| Image | `ghcr.io/billbob-space/hello-world/pilabelle:main` |
| Branches | `pilabelle/<sujet>` |

`apps/pilabelle/app.yml`, dans son état final :

```yaml
enabled: true
port: 8080
memory: 128m
health_path: /healthz
health_cmd: wget --spider -q http://localhost:8080/healthz
exposure: private
stack: go
ui: true
volumes:
  - name: donnees
    source: donnees
    target: /var/lib/pilabelle
```

(la forme exacte de la section `volumes:` est celle que produit `--add` avec
un volume déclaré à la main ensuite — voir `memory/volumes.md` et PRP 01 §3.)

**`stack: go`, pas `typescript`.** À la différence de `marcq-handball`, le
serveur ici n'est pas une coque mince : l'identité, la persistance et
l'algorithme de sélection (§5) sont tout le poids métier de l'application, et
vivent en Go. Le navigateur ne fait tourner ni domaine ni stockage — il
affiche ce que le serveur a déjà calculé et fait tourner des chronomètres. Le
volume de code est donc majoritairement Go, comme `cadran`, `ardoise` et
`compteur`.

`ui: true` ajoute `frontend-design`, `playwright` et `impeccable` à
l'outillage du dépôt — déjà présents, aucun changement de `.claude/`.

---

## 2. Le partage serveur / navigateur

C'est la décision qui structure tous les PRP, et elle est **l'inverse** de
celle de `marcq-handball`.

**Le serveur connaît l'utilisateur, et tient tout son état.** Traefik pose
`X-Forwarded-User` avant que la requête n'atteigne le conteneur (palier
`private`) ; le serveur lit systématiquement cet en-tête et l'utilise pour
cloisonner un fichier de profil par compte, sur le volume monté. C'est ce qui
permet à la progression, la série et les réponses au questionnaire de
« se retrouver à la reconnexion, sur n'importe quel appareil » (PRD §6, item
8) — un stockage `localStorage` ne le permettrait pas, puisqu'il ne quitte
jamais l'appareil.

**Le domaine (algorithme de sélection, évolution de niveau, calcul du jour)
est du Go pur, testé côté serveur.** Le navigateur reçoit la séance du jour
déjà calculée — exercices choisis, vidéos, minutages — et ne recalcule rien.

**Le navigateur porte l'interaction en temps réel : chronomètres, lecture
vidéo, transitions.** Une fois la séance du jour reçue en un seul appel, tout
le déroulé de la séance (décompte, pause, passage à l'exercice suivant) tourne
en JavaScript de navigateur sans nouvel aller-retour, jusqu'au ressenti final
qui, lui, referme la boucle par un appel serveur (PRP 05).

Modules ES natifs, comme `marcq-handball` : pas de bundler, pas de
`node_modules` dans l'image, pas de transpilation. `stack: go` choisit le LSP
principal ; le peu de JavaScript reste sans outillage de construction.

---

## 3. Arborescence

```
apps/pilabelle/
  app.yml              déclaré, jamais réécrit par init.sh
  Dockerfile           multi-étapes, USER non root, image < 200 Mo
  .dockerignore        généré par --add, complété : exclure tests/
  test.sh              exécutable — le seul point d'entrée que la CI connaît
  README.md            usage, variables d'environnement attendues (noms seuls)
  PRODUCT.md           le PRD de l'app (déjà écrit)
  exercices.md         contenu source du dictionnaire (déjà écrit, PRP 02 le lit)
  go.mod               module github.com/billbob-space/hello-world/apps/pilabelle
  main.go              serveur : routes, identité, orchestration
  main_test.go
  domaine.go           PUR : sélection du jour, évolution de niveau, jours actifs
  domaine_test.go
  stockage.go          lecture/écriture atomique des profils sur le volume
  stockage_test.go
  data/                EMBARQUÉ dans le binaire par go:embed
    dictionnaire.json  le dictionnaire d'exercices — donnée, jamais du code
    messages.json       piques de retrouvailles, encouragements, mots doux
  web/                 EMBARQUÉ dans le binaire par go:embed
    index.html          coque unique, <script type="module" src="/app.js">
    app.js               amorçage, routage d'écran
    api.js                les cinq appels fetch, un par route (§7)
    minuteur.js           PUR : machine à états du chronomètre (§8)
    vue-questionnaire.js
    vue-jour.js
    vue-seance.js
    vue-fin.js
    vue-reglages.js
    vue-personnel.js      lot 2
    style.css             jetons de couleur et de forme, kawaii (§9)
  tests/                HORS de l'image : jamais embarqué, exclu du contexte
    minuteur.test.js
  prp/                  ces documents
```

`data/` et `web/` sont deux racines `go:embed` distinctes : la première ne
change qu'avec le contenu (exercices, messages), la seconde qu'avec l'écran.
Séparer les deux évite qu'une correction de vidéo invalide le cache de couche
Docker de tout `web/`.

Les modules ES s'importent par chemin relatif : `import { ... } from
'./minuteur.js'` depuis `web/`, `import { ... } from '../web/minuteur.js'`
depuis `tests/`. Le navigateur et Node lisent le même fichier.

---

## 4. `data/dictionnaire.json` — le contrat de données

Le PRD §8.1 l'exige : *« Le dictionnaire est séparé du code [...] y ajouter un
exercice, corriger une vidéo, ou reclasser un niveau ne doit jamais demander
de toucher à l'application. »* PRP 02 le construit à partir de
[`exercices.md`](../exercices.md), contenu déjà rédigé, sans en changer le
sens.

```json
{
  "echelle_niveaux": [
    { "niveau": 1, "effort_s": 20, "repos_s": 20, "tours": 1 },
    { "niveau": 2, "effort_s": 25, "repos_s": 15, "tours": 1 },
    { "niveau": 3, "effort_s": 30, "repos_s": 15, "tours": 2 },
    { "niveau": 4, "effort_s": 40, "repos_s": 15, "tours": 2 }
  ],
  "exercices": [
    {
      "id": "mr-respiration-debout",
      "zone": "mise_en_route",
      "famille": null,
      "niveau": null,
      "nom": "Respiration profonde debout",
      "consigne": "Debout, pieds écartés largeur de hanche : inspirer en levant les bras, expirer en les redescendant, lentement.",
      "contre_indications": [],
      "minutage": { "effort_s": 20, "repos_s": 10, "tours": 1 },
      "video": { "statut": "ok", "url": "https://www.youtube.com/shorts/ZKVqUCwsMPs" }
    },
    {
      "id": "vt-transverse-1",
      "zone": "ventre",
      "famille": "respiration_et_transverse",
      "niveau": 1,
      "nom": "Respiration abdominale allongée",
      "consigne": "Allongée sur le dos, genoux pliés, pieds au sol, mains sur le ventre : inspirer en gonflant le ventre, expirer en rentrant le nombril vers la colonne.",
      "contre_indications": [],
      "minutage": null,
      "video": { "statut": "ok", "url": "https://www.youtube.com/shorts/yaEGYEPcnuw" }
    }
  ]
}
```

### Les règles que ce format porte

**`zone` ∈ `{ mise_en_route, ventre, cuisses, retour_au_calme }`.** Seules
`ventre` et `cuisses` portent `famille` et `niveau` (PRD §8.1) : les deux
autres zones ont `famille: null, niveau: null` et forment chacune un pool
unique, non gradué.

**`minutage: null` signifie « prendre `echelle_niveaux[niveau]` ».** C'est le
cas par défaut pour `ventre` et `cuisses`, conforme à la note d'`exercices.md`
*« le minutage indicatif s'applique sauf mention contraire »*. Un exercice de
`mise_en_route` ou `retour_au_calme` porte toujours un `minutage` explicite,
puisqu'il n'a pas de `niveau` pour indexer l'échelle. Un exercice de
`ventre`/`cuisses` peut aussi porter un `minutage` explicite pour déroger à
l'échelle (« mention contraire ») — c'est le seul cas où le code lit ce champ
avant l'échelle.

**`contre_indications`** est une liste de chaînes libres mais issues d'un
vocabulaire fermé, dérivé de ceux déjà employés dans `exercices.md` : `genou`,
`dos`, `epaule`, `cheville`, `equilibre`, `poignet`, `hanche`, `cou`. PRP 02
fige cette liste et `--check`-style un test unitaire refuse toute étiquette
hors de cette liste, pour qu'une faute de frappe dans le contenu ne rende pas
un exercice invisible à l'algorithme sans que personne ne le remarque.

**`video.statut` ∈ `{ ok, a_valider, a_rechercher }`**, décalqué des deux
marqueurs d'`exercices.md` (« ⚠️ à valider » et « à rechercher »). `url` est
vide quand `statut` vaut `a_rechercher`. La PRP 04 (écran de séance) affiche
l'exercice sans lecteur vidéo quand `url` est vide — jamais un lecteur cassé
— conformément au PRD §12 : *« un mauvais lien découvert par elle en séance
coûte plus cher qu'un exercice provisoirement sans vidéo. »*

**Trois exercices sont aujourd'hui `a_rechercher` et deux `a_valider`**
(relevé sur `exercices.md` au 8 août 2026). Convertir le contenu n'attend pas
qu'ils soient résolus — PRP 02 les convertit tels quels — mais **l'activation
de l'app** (le second commit de PRP 01, `enabled: true`) ne devrait pas
intervenir tant qu'ils le restent : voir le verrou en §10.

### L'interface de chargement

```go
// apps/pilabelle/domaine.go
func ChargerDictionnaire(brut []byte) (Dictionnaire, error)
// Échoue si : JSON invalide, id dupliqué, zone hors vocabulaire, famille/niveau
// présents sur mise_en_route ou retour_au_calme, niveau hors de echelle_niveaux,
// contre-indication hors du vocabulaire fermé (§4), ou video.statut invalide.
```

Une erreur ici est **fatale au démarrage** (`log.Fatal`), jamais absorbée : un
dictionnaire invalide ne doit jamais tourner à moitié.

---

## 5. `domaine.go` — l'interface pure

Aucun accès disque, aucune horloge implicite : « aujourd'hui » est toujours un
**paramètre**, comme dans `marcq-handball`. C'est ce qui rend le module
testable sans dépendre du volume ni de l'heure système.

```go
// Le niveau de départ de chaque zone, déduit du questionnaire initial (PRD §8.2).
func NiveauInitial(reponses Reponses) Niveaux // -> { Ventre: 1|2, Cuisses: 1|2 }

// Vrai si dateISO est un jour d'entraînement déclaré (PRD §6 item 1, §7.5).
// Un jour non déclaré actif est un jour de repos automatique.
func JourActif(joursActifs []time.Weekday, dateISO string) bool

// La séance du jour, ou l'état de repos. aujourdhui et dernierJourActifFait
// sont des chaînes YYYY-MM-DD, comparées lexicographiquement.
func SeanceDuJour(dico Dictionnaire, profil Profil, aujourdhui string) (Seance, Cas, error)
// Cas ∈ { CasRepos, CasDejaFaite, CasAFaire }
// N'échoue QUE si un bloc gradué (ventre ou cuisses) n'a plus aucun candidat
// après filtrage — jamais en choisissant un niveau ou une contre-indication
// approximatifs : le PRD §12 est explicite, « un dictionnaire trop petit fait
// échouer l'algorithme en silence » est le défaut à ne jamais reproduire, donc
// l'échec ici est bruyant (erreur renvoyée, journalisée, 500 côté route).

// Applique le ressenti d'une séance terminée aux deux niveaux travaillés
// (PRD §8.2, §9). historiqueRecent ne contient que les entrées de la MÊME zone,
// les plus récentes d'abord ; ajusterNiveau ne regarde que ce qu'il faut pour
// détecter trois "facile" consécutifs.
func AjusterNiveau(dico Dictionnaire, zone Zone, niveauCourant int, ressenti Ressenti, historiqueRecent []Ressenti) int
// difficile  -> niveauCourant - 1, jamais sous le plancher de la zone (niveau
//               le plus bas qui a un candidat compte tenu des contre-indications)
// facile x3  -> niveauCourant + 1, jamais au-dessus du plafond du dictionnaire
// correct    -> niveauCourant, inchangé
// Le plancher tient compte des contre-indications ACTUELLES du profil : il
// peut donc changer si les réglages changent (PRP 03).

// Met à jour la série après une séance faite le jour dateISO (PRD §9).
// Compte les JOURS ACTIFS consécutifs, pas les jours calendaires : un jour de
// repos déclaré ne casse ni ne construit la série. Voir §6 pour le choix et
// sa justification.
func MettreAJourSerie(serie Serie, joursActifs []time.Weekday, dateISO string) Serie
```

`Ressenti` est une énumération à trois valeurs : `facile`, `correct`,
`difficile`, sérialisée telle quelle en JSON (chaînes, pas des entiers — un
entier laisserait croire à une échelle ordonnée que le PRD refuse
explicitement, §7.4 : *« aucun chiffre, aucun tu as fait moins bien
qu'hier »*).

### Les dates, précisément

Toutes les dates du domaine sont des jours calendaires `YYYY-MM-DD`, comparées
comme des chaînes. Le jour courant est calculé **une fois**, dans `main.go`,
dans le fuseau `Europe/Paris` (les deux comptes autorisés sont en France) :

```go
func aujourdhui() string {
    return time.Now().In(parisTZ).Format("2006-01-02")
}
```

(`_ "time/tzdata"` importé comme dans `cadran` : une image Alpine n'embarque
pas la base des fuseaux.)

---

## 6. Un choix que le PRD ne tranche pas explicitement : la série compte les jours actifs

Le PRD §9 dit *« la série se casse au premier jour manqué »* et, dans le même
paragraphe, *« un jour sans séance est un jour de repos [...], jamais une
dette »*. Les deux phrases coexistent sans dire si un jour de repos
**déclaré** (§6 item 1, « jours disponibles ») compte comme un jour qui aurait
pu casser la série.

**Décision retenue ici : la série ne compte que les jours actifs déclarés.**
Un jour non actif ne construit ni ne casse la série ; seul un jour actif sans
séance la casse. Raison : les « jours disponibles » n'ont autrement aucun
effet sur rien dans le reste du document — sans cette règle, la question
posée au questionnaire ne servirait à rien de vérifiable par l'utilisatrice.
C'est un choix d'implémentation, pas un point bloquant ; il se change en une
fonction (`MettreAJourSerie`, §5) si l'usage réel montre qu'elle attend
l'inverse.

---

## 7. `stockage.go` — le profil, un fichier par compte

**Identité.** `X-Forwarded-User` est haché (SHA-256, 16 premiers caractères
hexadécimaux) pour nommer le fichier — jamais l'adresse en clair sur disque,
alors qu'un export du volume (`memory/volumes.md`, sauvegarde par conteneur
jetable) est un geste ordinaire de la fabrique.

```go
func identifiantFichier(email string) string // sha256(email)[:16], hex
func cheminProfil(racine, email string) string // racine/profil-<hash>.json
```

**Format**, un fichier JSON par compte :

```json
{
  "version_schema": 1,
  "reponses": {
    "niveau_depart": "debutante",
    "douleurs": ["genou"],
    "jours_actifs": ["lundi", "mercredi", "vendredi", "samedi"]
  },
  "niveaux": { "ventre": 1, "cuisses": 2 },
  "faciles_consecutifs": { "ventre": 0, "cuisses": 1 },
  "serie": { "actuelle": 4, "record": 9 },
  "historique": [
    {
      "date": "2026-08-07",
      "ressenti": "correct",
      "exercices": ["mr-respiration-debout", "vt-transverse-1", "cu-pont-1", "rc-etirement-1"]
    }
  ],
  "derniers_messages": { "pique": "", "encouragement": "", "mot_doux": "" },
  "defi_semaine": null
}
```

**Écriture atomique**, comme le magasin de classement de `marcq-handball`
(PRP 07 de cette app-là) : écrire dans un fichier temporaire sur le même
volume puis `os.Rename` — jamais une écriture en place, qui laisserait un
fichier tronqué lisible par la requête suivante en cas d'interruption.

```go
func LireProfil(racine, email string) (Profil, error) // erreur "absent" distincte, os.IsNotExist
func EcrireProfil(racine, email string, p Profil) error // temp + rename
```

**`historique` n'est pas borné dans ce document.** Une séance par jour, un
enregistrement de quelques dizaines d'octets : même après plusieurs années
d'usage quotidien, le fichier reste de l'ordre de quelques centaines de kilo-
octets. Aucune purge n'est nécessaire — à revisiter seulement si l'usage réel
contredit cette estimation (`memory/volumes.md` : *« un volume de données se
sauvegarde, contrairement à un cache »*, et purger de l'historique reviendrait
à en jeter).

---

## 8. `web/minuteur.js` — la machine à états du chronomètre

Pur, sans DOM ni horloge implicite : testable par `node --test` comme
`domaine.js` de `marcq-handball` l'était.

```js
// Construit un minuteur pour un exercice { effort_s, repos_s, tours }.
export function creerMinuteur(exercice)
// -> { etat, phase, restant_s, demarrer(), pause(), reprendre(), estTermine() }
// etat  ∈ { attente, en_cours, pause, termine }
// phase ∈ { effort, repos }         // absent tant que etat === 'attente'
```

**Démarrage explicite** (PRD §7.3, « jamais tout seul ») : `creerMinuteur`
rend un objet en `etat: 'attente'` ; seul un appel à `demarrer()` déclenche le
décompte. **Pause sans confirmation** : `pause()`/`reprendre()` sont
symétriques et instantanés, jamais de dialogue. **Fin de tour automatique** :
au terme de `repos_s` du dernier tour, `estTermine()` devient vrai et
`vue-seance.js` avance à l'exercice suivant après un court répit (PRD §7.3).

Ce module ne connaît ni la vidéo ni le réseau : `vue-seance.js` orchestre les
deux à côté de lui.

---

## 9. Les routes HTTP

| Route | Réponse |
|---|---|
| `GET /` | `web/index.html` |
| `GET /app.js`, `/api.js`, `/minuteur.js`, `/vue-*.js`, `/style.css` | le fichier de `web/`, type MIME correct |
| `GET /healthz` | `200 ok`, `text/plain` |
| `GET /api/profil` | `404 {"erreur":"absent"}` si pas encore de fichier, sinon la fiche (réponses, niveaux, série) |
| `POST /api/profil` | crée le profil à partir du questionnaire — PRP 03 |
| `PUT /api/profil` | modifie les réponses (réglages) — PRP 03, jamais rétroactif |
| `GET /api/jour` | l'état du jour : `cas`, et si `a-faire`, la séance résolue — PRP 04 |
| `POST /api/ressenti` | referme la séance du jour, renvoie le récap — PRP 05 |
| `GET /api/personnel` | série, calendrier, niveaux — PRP 07, lot 2 |
| `GET /api/defi` | le défi de la semaine — PRP 06, lot 2 |
| tout le reste | `404` |

Toutes les réponses portent `X-App-Version` (SHA du commit, comme dans
`hello-world`) : un déploiement se vérifie sans ouvrir la page.

**Toute route `/api/*` exige `X-Forwarded-User`.** Son absence est un `400`
— jamais un utilisateur anonyme silencieux, jamais un profil orphelin. En
développement local (`test.sh`), les tests posent l'en-tête eux-mêmes ; il n'y
a pas de mode « sans identité ».

```go
func identite(r *http.Request) (string, error) // "" + erreur si l'en-tête est vide
```

---

## 10. Ce que chaque PRP doit respecter sans qu'on le lui répète

Ces contraintes viennent du contrat de la fabrique (`CLAUDE.md`) et du PRD
§11. Elles s'appliquent à **tous** les PRP.

- **Français** pour l'interface, les commentaires, la documentation, les
  messages de commit et les noms de fonctions.
- **Les accents vont dans ce que l'utilisatrice lit, pas dans le code.** Les
  libellés, phrases affichées et messages d'erreur destinés à l'écran portent
  leurs accents ; identifiants, noms de fonctions et de tests, commentaires de
  code et messages de commit restent en ASCII.
- **Aucun secret**, aucune section `ports:`, aucun `LABEL traefik.*`.
- **`USER` non root**, construction multi-étapes, image finale < 200 Mo,
  `chown` du chemin de volume avant `USER` (`memory/volumes.md`).
- **Les journaux sur la sortie standard**, et ils ne portent jamais l'e-mail
  en clair — seulement le hash (§7) s'il faut identifier une ligne.
- **Démarrage sans intervention.**
- **`compose.yaml`, `.github/`, `.claude/`, `go.work` ne s'éditent jamais à la
  main.** On change `app.yml` et on relance `./init.sh`.
- **`./init.sh --check` doit être vert avant chaque commit**, et
  `./scripts/pret.sh` avant de committer.
- **Mobile uniquement, iOS et Android** (PRD §11) : zones de tap ≥ 44 px,
  lisible à distance, aucune interaction dépendant du survol, mise en page
  qui respecte les zones sûres (encoche, île dynamique, barre système).
- **Kawaii, jamais infantilisant** (PRD §11) : les jetons de `style.css`
  (couleurs, rayons d'arrondi) portent cette direction, mais jamais au prix de
  la lisibilité en plein effort.
- **`prefers-reduced-motion` respecté** : tout reste utilisable sans un seul
  mouvement (PRD §10.1).
- **Vidéo en lecture intégrée YouTube, jamais retéléchargée**, silencieuse par
  défaut (PRD §7.3, §11).

---

## 11. La séquence des PRP et ce qui bloque quoi

```
01 socle ──┬─> 03 profil ──┬─> 04 jour-et-seance ──> 05 fin-et-recompenses ──┬─> 06 defi-semaine
02 dictionnaire ┘           │                                                 └─> 07 ecran-personnel
                             └────────────────────────────────────────────────────────┘
```

- **01 et 02 sont parallélisables** : l'un est du déploiement (identité,
  volume, squelette de serveur), l'autre de la donnée et du domaine pur
  (conversion d'`exercices.md`, algorithme). Ils se rejoignent au PRP 03, qui
  a besoin des deux (l'identité de 01, le `NiveauInitial` de 02).
- **04 est le goulot du lot 1** : 05 en dépend, et par 05, tout le lot 2.
- **06 et 07 sont parallélisables entre eux** une fois 05 en ligne.

### Ce qui reste ouvert, et pour qui

| Point | Qui tranche | Bloque |
|---|---|---|
| Trois vidéos `a_rechercher`, deux `a_valider` dans `exercices.md` | vous, en contenu | l'activation de PRP 01 (§4) — le code peut être écrit et testé sans elles, la mise en ligne non |
| Contenu des piques et mots doux (PRD §12, stocks à écrire par vous) | vous, en contenu | l'activation de PRP 05 |
| La série compte les jours actifs, pas les jours calendaires | résolu ici (§6), révisable sur l'usage | rien — décision prise, pas un blocage |

Ces deux premiers points sont des **dettes de contenu**, pas de code : PRP 02
et PRP 05 livrent le mécanisme (le champ `video.statut`, le tirage sans
répétition) sans attendre que le contenu soit complet ; c'est `enabled: true`
(l'activation, second commit de chaque séquence en deux commits) qui attend.

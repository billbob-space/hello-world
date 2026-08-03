# PRP 07 — Le classement côté serveur

> **Pour l'agent qui exécute :** applique ce PRP avec
> `superpowers:subagent-driven-development` ou `superpowers:executing-plans`.
> Les étapes sont des cases à cocher.
>
> **Ossature :** `apps/marcq-handball/prp/00-ossature.md` — lu avant de commencer.
> **PRD :** `docs/superpowers/specs/2026-08-03-marcq-handball-prd.md`

| | |
|---|---|
| **Lot** | 2 |
| **Branche** | `marcq-handball/classement-api` |
| **Dépend de** | PRP 01 (`routes`, `withVersion`, `logging`, `env`, `version`, `test.sh`, `README.md`), PRP 02 (`web/programme.json` et ses 53 identifiants) |
| **Débloque** | PRP 08 (rejoindre), PRP 09 (podium et position), PRP 10 (vue coach et ressentis) |
| **Sections du PRD** | §5, §7.4, §7.5 (« L'équipe »), §7.6, §9 (règles de classement), §12.1, §12.2, §13 (mot de passe coach écarté), §14 |

---

> ⛔ **Verrou** — ce PRP ne démarre pas avant que **le volume persistant du
> classement** soit tranché. Le PRD §12.1 le pose : *« Les scores du classement
> doivent survivre à un redéploiement. Un classement remis à zéro à chaque
> publication d'image serait pire que pas de classement. »* Le contrat de la
> fabrique tranche qui décide : *« Si tu as besoin de quelque chose que le
> contrat ne prévoit pas — une base de données, un cache, un volume persistant
> […] — écris-le dans le `README` et arrête-toi. C'est une décision
> d'infrastructure, elle se prend côté serveur. »* Tant qu'il tient, le travail
> en aval — PRP 08, 09, 10 — est spéculatif : ils n'ont rien à qui parler.

Ce verrou a **deux moitiés**, et la seconde n'est pas visible depuis le PRD.

1. **Le volume existe côté serveur** — décision d'exploitation. Chemin de
   montage, taille, droits d'écriture pour l'uid `10001` du conteneur.
2. **`compose.yaml` sait le monter** — décision de la fabrique. Vérification
   faite : `init.sh` ne contient **pas une seule occurrence** de `volume` ;
   `service_block` (`init.sh:288-330`) n'émet ni section `volumes:` de service,
   ni bloc `volumes:` de premier niveau, et `app.yml` n'a pas de clé pour le
   déclarer (`load_app`, `init.sh:141-148`, lit huit clés et ignore les autres).
   Monter un volume demande donc **une modification d'`init.sh`**, donc une
   branche `fabrique/<sujet>` avec son propre rayon de souffle — pas cette
   branche-ci, qui reste `marcq-handball/classement-api` et ne touche jamais au
   générateur. Éditer `compose.yaml` à la main est refusé par `./init.sh
   --check`.

**Ce PRP ne se met pas en attente pour autant.** Le chantier 3 pose un
interrupteur qui n'est pas un drapeau : `MARCQ_DONNEES` vide ⇒ pas de magasin ⇒
les trois routes répondent `503`, et l'application reste exactement le lot 1.
Le code peut donc être fusionné et déployé avant que le volume existe, et le
classement s'allume le jour où la variable pointe sur un répertoire inscriptible.
C'est ce qui découple la livraison du code de la décision d'infrastructure.

## Le blocage du PRD §12.2 n'existe pas — et c'est un blocage en moins

Le PRD §12.2 affirme : *« Le garde-fou `--check` refuse l'état par utilisateur en
`exposure: public`. Le classement, même réduit à des pseudonymes et des scores,
constitue un tel état. Le lot 2 ne peut pas être livré sans que cette règle soit
desserrée. »*

**C'est faux.** Lecture faite de `init.sh:1444-1452`, la règle du palier public
fait exactement deux choses :

```bash
if [ "$A_EXPOSURE" = public ]; then
  warn "$p palier public — accessible SANS authentification"
  if git ls-files -z "apps/$APP" 2>/dev/null | grep -zvE '\.md$' \
       | xargs -0 -r grep -liI 'x-forwarded-user' 2>/dev/null | grep -q .; then
    bad "$p lit X-Forwarded-User en exposure public — en-tete forgeable par n'importe qui"
```

Un avertissement non bloquant, puis un refus si — et seulement si — un fichier
**suivi par git**, sous `apps/marcq-handball/`, **hors `.md`**, contient la
chaîne `x-forwarded-user`. Aucune notion d'« état », aucune inspection de ce que
le serveur écrit sur disque, aucun compte de routes. Le classement ne lit jamais
cet en-tête : il n'a aucune raison de le faire, l'identité qu'il manipule est un
pseudonyme choisi et transmis dans le corps de la requête.

**Aucune règle n'est à desserrer, aucune branche `fabrique/` n'est nécessaire de
ce côté-là.** Le PRD §12.2 est à corriger, pas à contourner. Il reste un piège
réel, mais inversé — voir « Points d'attention » : ne pas écrire le nom de cet
en-tête dans un commentaire Go pour expliquer qu'on ne le lit pas.

## Objectif

Le serveur gagne un état — le premier du projet — qui classe des pseudonymes sur
la part d'exercices accomplis **parmi ceux déjà programmés à sa propre date**,
survit à un redéploiement, et ne peut structurellement pas recevoir le prénom
d'un enfant.

## Ce qui est vérifiable à la fin

- `./init.sh --check` est vert, dont la ligne `[marcq-handball] aucune lecture de
  X-Forwarded-User`.
- `cd apps/marcq-handball && go test ./...` passe, et `domaine_test.go` affirme
  depuis `web/programme.json` les **sept mêmes totaux** que
  `tests/domaine.test.js` : 226 pompes, 345 squats, 105 burpees, 210 abdos,
  1425 s de gainage, 235 min de course, 53 cases.
- `MARCQ_DONNEES` pointant sur un répertoire vide :
  `POST /api/classement` avec `{"pseudo":"Renard","code":"4821","faits":["s1-c1"]}`
  répond `201` et un `rang` ; le même envoi avec `"code":"0000"` répond `403`
  `code-refuse` ; `classement.json` existe et ne contient **ni** `4821` **ni**
  `0000` en clair.
- Le processus tué puis relancé sur le même répertoire resert le même
  `GET /api/classement`, participants et rangs identiques.
- `MARCQ_DONNEES` non défini : les trois routes répondent `503`
  `classement-indisponible`, tandis que `GET /` et `GET /healthz` répondent `200`.
- `POST /api/classement` avec `{"pseudo":"Renard","code":"4821","faits":[],"prenom":"Lucas"}`
  répond `400` `json-invalide`, et ni `classement.json` ni la sortie standard ne
  contiennent `Lucas`.

## Périmètre

**Dedans :** la demande d'infrastructure dans `README.md` ; le portage Go du
domaine ; le magasin sur fichier et son écriture atomique ; les trois routes
`GET /api/classement`, `POST /api/classement`, `GET /api/coach` ; la validation
du pseudonyme et du code à 4 chiffres ; le calcul du rang à l'horloge du serveur ;
les trois fichiers de test Go.

**Dehors, et pourquoi :**
- **Tout `web/`** — aucun fichier du navigateur n'est touché. L'écran de
  consentement, le choix du pseudonyme, l'envoi et la mémorisation dans
  `marcq.v1.classement` sont le **PRP 08** ; le podium, la position et la jauge
  de groupe sont le **PRP 09**. Ce PRP livre une API sans un seul appelant, et
  c'est voulu : un serveur d'état se relit seul, un serveur d'état mêlé à deux
  écrans ne se relit pas.
- **La page HTML du coach** — **PRP 10**. Ce PRP livre `GET /api/coach`, pas la
  page qui la lit.
- **La saisie du ressenti** — **PRP 10** côté navigateur. Le champ `ressentis`
  de l'envoi et sa restitution dans `/api/coach` sont définis **ici**, et c'est
  délibéré : voir le chantier 4.
- **`init.sh`, `compose.yaml`, `.github/`, `.claude/`** — la moitié « fabrique »
  du verrou est une autre branche, avec un autre rayon de souffle.
- **L'écran de bilan du 22 août** — **PRP 11**. Ce PRP fige le classement après
  `prog.Fin` (PRD §9) ; il n'affiche rien.

## Interfaces

**Consomme** — exactement, sans rien redéfinir :

```go
// apps/marcq-handball/main.go — PRP 01
func routes(web fs.FS, sw []byte) http.Handler   // ELARGI par ce PRP, voir Produit
func fichier(web fs.FS, nom, typeMime, cache string) http.HandlerFunc
func withVersion(next http.Handler) http.Handler
func logging(next http.Handler) http.Handler
func env(cle, defaut string) string
var version string                               // -ldflags -X main.version
```

```
apps/marcq-handball/web/programme.json  — PRP 02, embarque par //go:embed web
  { titre, debut: "2026-08-03", fin: "2026-08-21", seances: [ { date, semaine,
    titre, blocs: [ { type, titre?, tours, repos?, exercices: [ { id, libelle,
    mesure: { unite, valeur } } ] } ] } ] }
  53 identifiants stables, s1-c1 … s7-r6.
```

```js
// web/domaine.js — PRP 02, ossature §5 : la reference que le portage Go doit egaler
progression(prog, aujourdhui, faits)  // -> { cochees, programmees, part }
totauxPrescrits(prog)                 // -> { pompes: 226, squats: 345, burpees: 105,
                                      //      abdos: 210, gainage_s: 1425,
                                      //      min_course: 235, fentes, cases: 53 }
```

De l'ossature : §5 (dates `YYYY-MM-DD` comparées comme des chaînes, fuseau
`Europe/Paris` figé), §6 (`marcq.v1.classement = { pseudo, code, dernierEnvoi,
dernierRangConnu }` — écrite par le PRP 08, jamais lue ici), §7 (les trois routes
du lot 2), §9 (les contraintes de la fabrique).

**Produit** — ce que les PRP 08, 09 et 10 consomment :

```go
// apps/marcq-handball/main.go — signature elargie
func routes(web fs.FS, sw []byte, cl *classement) http.Handler
// cl == nil est un etat valide : les trois routes /api/* repondent alors 503.

// apps/marcq-handball/classement.go
func ouvrirClassement(dossier string, prog *Programme, horloge func() time.Time) (*classement, error)
func (c *classement) lire(jour string) reponseClassement
func (c *classement) enregistrer(e envoiClassement, jour string) (reponseEnvoi, bool, error)
func (c *classement) coach(jour string) reponseCoach

// apps/marcq-handball/domaine.go
func chargerProgramme(donnees []byte) (*Programme, error)
func totauxPrescrits(p *Programme) Totaux
func totauxAccomplis(p *Programme, faits map[string]bool) Totaux
func (p *Programme) programmes(jour string) map[string]bool
func progression(p *Programme, jour string, faits map[string]bool) (cochees, programmees int, part float64)
func jourParis(t time.Time) string    // -> "2026-08-07"
```

Les trois routes, corps compris, sont écrites au chantier 4. La variable
d'environnement produite est `MARCQ_DONNEES` — un nom, jamais une valeur
(CLAUDE.md, ossature §9).

## Fichiers

- **Créer :**
  - `apps/marcq-handball/domaine.go`
  - `apps/marcq-handball/domaine_test.go`
  - `apps/marcq-handball/classement.go`
  - `apps/marcq-handball/classement_test.go`
  - `apps/marcq-handball/api.go`
  - `apps/marcq-handball/api_test.go`
- **Modifier :**
  - `apps/marcq-handball/README.md` — la demande d'infrastructure (chantier 1),
    puis les routes et `MARCQ_DONNEES` (chantiers 3 et 4)
  - `apps/marcq-handball/main.go` — ouverture du magasin, signature de `routes`,
    `ReadTimeout`, import `_ "time/tzdata"`
- **Tester :** `apps/marcq-handball/test.sh` — **inchangé**. Il lance déjà
  `go vet ./...` puis `go test ./...` ; les trois fichiers `*_test.go` y entrent
  sans qu'une ligne bouge. C'est la propriété qui rend le contrat de test de la
  fabrique utile : *« la CI ne lance que ce fichier »*.

---

# Ce qu'il faut construire

## Chantier 1 — La demande d'infrastructure, et l'arrêt

**Ce qu'il fait.** Il écrit dans `apps/marcq-handball/README.md` ce que le lot 2
demande au serveur, puis **il s'arrête**. C'est le geste que le contrat impose
(CLAUDE.md, « Ce qui ne t'appartient pas ») et c'est la première tâche du PRP,
pas la dernière : formuler la demande **avant** d'écrire le magasin évite
d'écrire un magasin dont la forme dépendrait d'une réponse qu'on n'a pas.

**Ce que la section doit contenir**, sous le titre « Ce que le lot 2 demande à
l'infrastructure » :

| Point | Valeur demandée | Pourquoi ce chiffre |
|---|---|---|
| Un volume persistant | monté sur un chemin unique, ex. `/donnees` | Sans lui le classement repart de zéro à chaque publication d'image — PRD §12.1 |
| Droits d'écriture | pour l'uid `10001` du conteneur | Le `Dockerfile` crée `adduser -D -H -u 10001 app` ; un montage appartenant à root fait échouer **toutes** les écritures |
| Taille | 10 Mio | Borne calculée : 200 participants × 53 identifiants × ~40 octets ≈ 500 Kio. Le disque du serveur est à 92 %, la demande doit être chiffrée, pas arrondie vers le haut |
| Variable d'environnement | `MARCQ_DONNEES`, valant le chemin de montage | Aucune valeur dans le dépôt ; le nom seul, comme l'exige le contrat |
| Sauvegarde | **aucune demandée** | Voir ci-dessous |

**La sauvegarde n'est pas demandée, et c'est une propriété du produit, pas une
négligence.** Le magasin est un **cache de ce que les téléphones détiennent
déjà** : chaque envoi du PRP 08 transmet l'intégralité de l'ensemble `faits`
d'un participant. Un fichier perdu se répare tout seul au prochain envoi de
chacun — en une journée d'usage normal. Ce qui ne se répare pas est l'ordre des
ex æquo, reconstruit alors dans l'ordre des renvois. La demande porte donc sur
la **persistance entre deux déploiements**, pas sur la durabilité des données :
c'est une demande beaucoup plus faible, et il faut l'écrire ainsi pour ne pas
faire porter au serveur une exigence que le produit n'a pas.

**Les deux issues, et rien entre les deux.** La section se termine sur ce
qu'implique chaque réponse, pour que la décision se prenne en connaissance de
cause :

- **Un volume est monté** — le lot 2 se livre. Reste la moitié fabrique :
  `init.sh` doit apprendre à émettre une section `volumes:` pour une app qui en
  déclare une (`app.yml` gagne une clé, `service_block` et le bloc de premier
  niveau l'émettent, `check_service` la vérifie service par service). Branche
  `fabrique/<sujet>`, PR distincte.
- **Aucun volume** — le lot 2 **ne se livre pas**. Un classement en mémoire, remis
  à zéro à chaque publication d'image, est ce que le PRD §12.1 qualifie de *« pire
  que pas de classement »* ; le proposer comme repli serait contredire le PRD.
  Deux replis sont à écarter nommément dans le `README` : un fichier dans l'image
  (réécrit à chaque déploiement, donc identique à la mémoire) et un service de
  stockage tiers (il exigerait un secret, interdit dans le dépôt et dans l'image).

**Critère d'acceptation.** `apps/marcq-handball/README.md` porte la section, elle
chiffre les cinq lignes du tableau, elle nomme les deux issues, et **aucun autre
fichier n'est modifié**. Le PRP reprend quand la réponse arrive.

---

## Chantier 2 — Le domaine en Go : le même programme, l'horloge du serveur

**Ce qu'il fait.** Il porte en Go la part de `web/domaine.js` dont le rang a
besoin, en relisant **le même `web/programme.json`**, déjà embarqué par le
`//go:embed web` du PRP 01. C'est le seul endroit du projet où le domaine existe
en deux langages, et l'ossature §2 dit pourquoi : *« un rang calculé par le
client serait un rang déclaré par le client. »*

**Le portage est partiel, et la frontière est nette :** le serveur a besoin de
compter des cases parmi celles déjà programmées, pas d'afficher un calendrier.
`etatSeance`, `seanceDuJour` et `calendrier` **ne sont pas portés** — les porter
créerait trois fonctions à maintenir en double sans un seul appelant.

**Les types, décalqués de `programme.json` :**

```go
type Mesure struct {
	Unite  string `json:"unite"`
	Valeur int    `json:"valeur"`
}

type Exercice struct {
	ID      string `json:"id"`
	Libelle string `json:"libelle"`
	Mesure  Mesure `json:"mesure"`
}

type Bloc struct {
	Type      string     `json:"type"`
	Titre     string     `json:"titre,omitempty"`
	Tours     int        `json:"tours"`
	Repos     string     `json:"repos,omitempty"`
	Exercices []Exercice `json:"exercices"`
}

type Seance struct {
	Date    string `json:"date"`
	Semaine int    `json:"semaine"`
	Titre   string `json:"titre"`
	Blocs   []Bloc `json:"blocs"`
}

type Programme struct {
	Titre   string   `json:"titre"`
	Debut   string   `json:"debut"`
	Fin     string   `json:"fin"`
	Seances []Seance `json:"seances"`
}

// Totaux porte les six volumes prescrits et le nombre de cases. Les champs
// suivent les unites de l'ossature §4 ; « autre » n'y entre pas.
type Totaux struct {
	Pompes    int `json:"pompes"`
	Squats    int `json:"squats"`
	Burpees   int `json:"burpees"`
	Abdos     int `json:"abdos"`
	GainageS  int `json:"gainage_s"`
	MinCourse int `json:"min_course"`
	Fentes    int `json:"fentes"`
	Cases     int `json:"cases"`
}
```

**Les fonctions :**

```go
// chargerProgramme lit et valide le programme. Elle leve si un identifiant est
// duplique, si une unite est inconnue, ou si les seances ne sont pas en ordre
// de date croissant — les trois memes refus que chargerProgramme du navigateur.
func chargerProgramme(donnees []byte) (*Programme, error)

func totauxPrescrits(p *Programme) Totaux
func totauxAccomplis(p *Programme, faits map[string]bool) Totaux

// programmes rend les identifiants des seances dont la date est <= jour.
// C'est le denominateur du PRD §9, et le filtre de tout envoi.
func (p *Programme) programmes(jour string) map[string]bool

// progression compte les cases cochees parmi celles deja programmees.
// part vaut 0 si programmees vaut 0. Aucune horloge ici : jour est un parametre,
// comme dans domaine.js (ossature §5).
func progression(p *Programme, jour string, faits map[string]bool) (cochees, programmees int, part float64)

// jourParis rend le jour calendaire du club. Le fuseau est fige : il doit etre
// celui de aujourdhui() dans app.js, sans quoi le denominateur du serveur et
// l'affichage du telephone divergeraient d'un jour chaque soir.
func jourParis(t time.Time) string
```

**`part` est arrondie une seule fois, ici, à trois décimales** —
`math.Round(x*1000) / 1000`. Sans arrondi unique et côté serveur, le podium
afficherait 90,9 % là où l'écran perso afficherait 91 % pour le même enfant.

**Les règles du PRD que ce chantier applique :**

- **§9, le dénominateur** : *« Le rang est établi sur la part d'exercices
  accomplis parmi ceux déjà programmés à ce jour — pas sur le total du
  programme, sinon tout le monde est à 15 % le 5 août. »* C'est `programmes(jour)`,
  et rien d'autre.
- **§9, le gel** : *« Après le 21 août […] le classement est figé. »* `jour` est
  écrêté à `p.Fin` avant tout calcul : au-delà, le dénominateur vaut les 53
  cases et ne bouge plus.
- **§8** : les totaux sont **calculés**, jamais recopiés. Le code ne contient
  aucun des sept nombres ; seuls les tests les portent.

**Ce que les tests affirment** (`domaine_test.go`) :

1. `chargerProgramme` accepte le fichier embarqué sans erreur.
2. `totauxPrescrits` rend exactement `226 / 345 / 105 / 210 / 1425 / 235` et
   `Cases == 53` — les sept assertions de l'ossature §4, **les mêmes constantes
   que `tests/domaine.test.js`, sur le même fichier**. Deux implémentations qui
   tombent sur les mêmes sept nombres depuis la même donnée est ce qui interdit à
   la version Go de dériver en silence.
3. Les 53 identifiants sont ceux énumérés au PRP 02, sans doublon ni manquant.
4. `programmes("2026-08-03")` rend les 8 cases de la première séance ;
   `programmes("2026-08-02")` en rend 0 ; `programmes("2026-09-01")` en rend 53.
5. `progression` avec un ensemble contenant un identifiant d'une séance future
   ne le compte pas, et `part` vaut 0 quand `programmees` vaut 0.
6. Un programme dont deux exercices partagent un `id`, et un programme portant
   une unité inconnue, font échouer `chargerProgramme`.

**Critère d'acceptation.** `go test ./...` passe, les sept nombres du point 2
sont écrits en clair dans le test et nulle part dans `domaine.go`, et modifier
une valeur de `web/programme.json` fait échouer le test sans qu'aucun code Go
change.

---

## Chantier 3 — Le magasin : un fichier, une écriture atomique, aucune donnée nominative

**Ce qu'il fait.** Il tient en mémoire la liste des participants, la relit au
démarrage, et la réécrit à chaque modification. Un fichier JSON, pas une base :
la borne haute est de 200 participants sur trois semaines, et une base de données
serait une seconde décision d'infrastructure là où le PRD n'en autorise déjà
qu'une.

### La forme stockée

```json
{
  "schema": 1,
  "participants": [
    {
      "pseudo": "Renard",
      "cle": "renard",
      "sel": "8Yx3n1p2q4r5s6t7u8v9wA==",
      "empreinte": "Qk9…32 octets en base64…=",
      "iterations": 100000,
      "faits": {
        "s1-c1": "2026-08-03T18:22:11Z",
        "s1-r1": "2026-08-03T18:31:02Z"
      },
      "ressentis": { "2026-08-03": "correct" },
      "creeLe": "2026-08-03T18:22:11Z",
      "vuLe": "2026-08-05T19:02:44Z"
    }
  ]
}
```

Chaque champ porte une décision :

- **`cle`** est le pseudonyme normalisé, stocké et non recalculé. S'il était
  recalculé, changer un jour la règle de normalisation ferait entrer en collision
  deux participants existants — donc fusionner deux enfants — en silence.
- **`sel` et `empreinte`** : le code n'est jamais stocké en clair. Le motif n'est
  pas qu'il protège quelque chose sur le serveur — le PRD §7.4 dit qu'il n'y a
  rien à protéger — mais qu'**un ado saisira très probablement le code de
  déverrouillage de son téléphone**. Ce code-là, lui, protège quelque chose, et
  il n'a rien à faire en clair dans un fichier.
  `crypto/pbkdf2` (bibliothèque standard depuis Go 1.24 — vérifié :
  `/usr/local/go/src/crypto/pbkdf2/pbkdf2.go`), SHA-256, sel de 16 octets tiré de
  `crypto/rand`, 100 000 itérations, 32 octets de sortie :
  `pbkdf2.Key(sha256.New, code, sel, iterations, 32)`. Quatre chiffres font
  10 000 possibilités : le dérivateur ne rend pas l'empreinte inattaquable, il
  rend l'attaque non gratuite et interdit la réutilisation directe.
- **`iterations`** est stocké **par participant** : relever le coût plus tard
  n'invalide alors aucune fiche existante, on vérifie avec le coût inscrit.
- **`faits`** associe un identifiant à **l'horodatage du serveur**, jamais à
  celui du client. C'est ce qui rend l'ex æquo du PRD §9 incontestable : le
  client n'a aucun champ où poser une date.
- **`creeLe`, `vuLe`** : horodatages serveur, en UTC, RFC 3339. `vuLe` sert au
  diagnostic et au dénombrement des inactifs de `/api/coach`.
- **Ce qui n'y est pas, et ne doit jamais y entrer** : aucune adresse IP, aucun
  agent utilisateur, aucun horodatage venu du client, aucun prénom — aucun champ
  ne peut en accueillir un.

### L'écriture

```go
// ecrireAtomique ecrit dans un fichier temporaire du MEME repertoire, force
// l'ecriture sur le disque, renomme, puis force le repertoire.
//
// Le temporaire est voisin de la cible parce que os.Rename n'est atomique que
// dans un systeme de fichiers : un temporaire dans os.TempDir() traverserait le
// point de montage du volume et echouerait sur EXDEV. Le Sync avant le renommage
// evite le cas ou la coupure laisse un fichier de la bonne taille et vide.
func ecrireAtomique(chemin string, donnees []byte) error
```

Ordre imposé : `os.CreateTemp(dir, "classement-*.tmp")` → `Write` → `Sync` →
`Close` → `os.Rename` → ouvrir le répertoire et `Sync`. Un échec à n'importe
quelle étape supprime le temporaire et remonte l'erreur : le fichier en place
n'est jamais touché.

**L'écriture est immédiate, à chaque envoi accepté.** Pas de différé, pas de
regroupement : une équipe produit quelques dizaines d'envois par jour, et un
tampon qui n'est vidé qu'à l'arrêt est précisément ce qu'un `docker compose up`
n'attend pas.

### Le démarrage, et ses quatre cas

`ouvrirClassement(dossier, prog, horloge)` :

| Cas | Comportement | Pourquoi |
|---|---|---|
| `dossier` vide (`MARCQ_DONNEES` non défini) | rend `(nil, nil)` | Le classement est désactivé, pas en panne. `main` le trace une fois et l'app sert le lot 1. C'est l'interrupteur qui découple la livraison du code de la décision d'infrastructure |
| `classement.json` absent | classement vide, création au premier envoi | *« Démarrage sans intervention »* — aucun fichier à créer à la main |
| `classement.json` illisible (JSON invalide, `schema` inconnu) | renommé en `classement.corrompu-<RFC3339>.json`, on repart vide, trace sur la sortie standard | Réécrire par-dessus détruirait le seul exemplaire ; refuser de démarrer rendrait le conteneur malsain en permanence et emporterait **toute** l'application pour une fonction optionnelle |
| `dossier` non inscriptible | rend une erreur ; `main` trace fort et continue avec `cl = nil` | Un montage appartenant à root est le mode de panne le plus probable, et il est invisible de l'extérieur — d'où la sonde d'écriture ci-dessous |

**La sonde d'écriture au démarrage** : `ouvrirClassement` écrit puis supprime un
fichier `.ecriture-test` dans le dossier. Sans elle, un volume en lecture seule
ne se manifesterait qu'au premier envoi d'un enfant, un soir, sous la forme d'un
503 que personne ne relie au montage. Avec elle, la ligne apparaît au démarrage,
dans les journaux du conteneur, avant tout trafic.

**`/healthz` répond `200` dans les quatre cas.** C'est une décision, pas un
oubli : `health_cmd` gouverne la santé du conteneur, et un conteneur malsain sur
un volume manquant retirerait du service une application qui, à 95 %, fonctionne
hors ligne dans le navigateur.

### La concurrence

Un `sync.Mutex` unique protège la carte en mémoire **et** l'écriture disque. Un
seul conteneur (`container_name: marcq-handball`, aucune réplique), donc aucun
verrou inter-processus n'est nécessaire — et cette propriété doit être écrite
dans le `README` : le jour où la stack tournerait en deux exemplaires, deux
processus écriraient le même fichier et le dernier écraserait l'autre.

La lecture (`lire`, `coach`) recalcule tout à chaque appel, sans cache. Mesure de
la borne : 200 participants × 53 identifiants, c'est quelques dizaines de
microsecondes. Un cache serait un état de plus à invalider — notamment à minuit,
quand le dénominateur change — pour une économie invisible.

**Critère d'acceptation.** `classement_test.go` : un magasin ouvert sur un
`t.TempDir()`, un envoi, une réouverture sur le même répertoire rendent le même
classement ; un `classement.json` contenant `{` est mis de côté et le magasin
démarre vide ; le fichier écrit ne contient jamais le code en clair ; deux
enregistrements concurrents lancés par `t.Parallel` laissent un fichier valide.

---

## Chantier 4 — Les trois routes

**Ce qu'il fait.** Il expose le magasin sous les trois routes que l'ossature §7
réserve au lot 2, et **rien de plus** : aucune route de suppression, aucune route
d'administration. Toutes portent `X-App-Version` par `withVersion` (PRP 01),
`Content-Type: application/json; charset=utf-8` et `Cache-Control: no-store` — un
classement mis en cache est un classement faux, et c'est déjà le réglage de
`/api/heure` dans `cadran`.

### `GET /api/classement`

Aucun paramètre, aucun corps. Réponse `200` :

```json
{
  "jour": "2026-08-07",
  "programmees": 22,
  "participants": 9,
  "classement": [
    { "rang": 1, "cochees": 22, "part": 1,     "pseudo": "Renard" },
    { "rang": 2, "cochees": 20, "part": 0.909, "pseudo": "K7" },
    { "rang": 3, "cochees": 19, "part": 0.864, "pseudo": "Bibou" },
    { "rang": 4, "cochees": 19, "part": 0.864 },
    { "rang": 5, "cochees": 14, "part": 0.636 },
    { "rang": 6, "cochees": 12, "part": 0.545 },
    { "rang": 7, "cochees":  9, "part": 0.409 },
    { "rang": 8, "cochees":  6, "part": 0.273 },
    { "rang": 9, "cochees":  0, "part": 0 }
  ],
  "groupe": { "cochees": 121, "programmees": 198, "part": 0.611 }
}
```

- **`pseudo` n'est présent que sur les trois premières lignes.** PRD §9 : *« Le
  podium nomme trois personnes, la position en nomme zéro. »* La règle est
  appliquée **par le serveur**, pas par l'écran : le nom du quatrième ne transite
  pas, donc aucun bogue d'affichage du PRP 09 ne peut le faire apparaître.
- **Les rangs sont stricts, de 1 à N, jamais répétés.** Le PRD §9 impose un
  départage : *« À égalité, le premier arrivé à ce score est devant. »* « 3e sur
  9 » n'aurait aucun sens si trois enfants étaient 3e.
- **Le tri**, dans cet ordre : `cochees` décroissant ; puis l'instant où le
  participant a **atteint** ce nombre, croissant ; puis `cle`, croissant. Le
  deuxième critère se **dérive**, il n'est pas stocké : c'est le plus tardif des
  horodatages serveur des identifiants comptés — l'instant du n-ième. Le
  troisième est un départage de dernier recours, pour que l'ordre soit total et
  stable d'un redémarrage à l'autre.
- **`programmees` est le même pour tout le monde** — il ne dépend que de la date
  du serveur. Classer par `part` revient donc à classer par `cochees` ; `part` est
  renvoyée quand même, pour que le client affiche l'arrondi du serveur.
- **`classement` porte toutes les lignes, anonymes au-delà de la troisième.**
  C'est ce qui permet au PRP 09 d'afficher « tu es 3e sur 9 » à un enfant **qui
  n'a pas rejoint** : il compte localement ses cases et se place, sans rien
  envoyer. PRD §7.5 : *« ma position, affichée même sans avoir rejoint »*.
- **`participants` vaut `len(classement)`.** C'est le « sur 9 » du PRD §7.5, et
  le §9 en fixe le sens : *« Le dénominateur est honnête : on compte les
  participants au classement, pas l'effectif de l'équipe. »*
- **`groupe`** est la jauge collective du §7.5 : somme des `cochees`, sur
  `participants × programmees`. Elle vaut `0` quand il n'y a aucun participant.
- **`jour`** est le jour du serveur. Le PRP 09 l'affiche avec la valeur mise en
  cache : un rang de la veille doit se présenter comme tel.

### `POST /api/classement`

`Content-Type: application/json`. Corps, **exactement quatre champs** :

```json
{
  "pseudo": "Renard",
  "code": "4821",
  "faits": ["s1-c1", "s1-c2", "s1-r1", "s2-c1"],
  "ressentis": { "2026-08-03": "correct", "2026-08-05": "dur" }
}
```

`ressentis` est **facultatif** ; les trois autres sont obligatoires.

Réponse `201` à la création du pseudonyme, `200` à chaque mise à jour :

```json
{
  "pseudo": "Renard",
  "jour": "2026-08-07",
  "rang": 2,
  "participants": 9,
  "cochees": 20,
  "programmees": 22,
  "part": 0.909,
  "ignores": 3
}
```

**L'envoi remplace, il n'ajoute pas.** L'ensemble reçu devient l'ensemble du
participant : décocher se propage. Conséquence à annoncer dans le `README` et à
reprendre par le PRP 08 : deux téléphones sous le même pseudonyme s'écrasent
mutuellement — c'est précisément ce que le code à 4 chiffres empêche —, et un
navigateur vidé qui renvoie un ensemble vide retombe à zéro (PRD §14, risque
assumé et annoncé).

**Les horodatages survivent au remplacement.** Un identifiant déjà présent garde
son horodatage serveur d'origine ; un nouvel identifiant prend l'instant présent ;
un identifiant retiré perd le sien. Sans quoi chaque envoi remettrait à zéro le
départage des ex æquo.

**`ignores`** compte les identifiants reçus qui n'ont pas été retenus : inconnus
du programme, ou appartenant à une séance dont la date est postérieure au jour du
serveur. Il est renvoyé pour que le PRP 08 puisse écrire *« 3 exercices ne
comptent pas encore »* au lieu de laisser l'enfant constater un écart muet entre
son écran et le podium. C'est la face visible de l'ossature §5 : *« L'horloge du
téléphone décide de l'affichage, celle du serveur décide du rang. »*

**Les identifiants futurs ne sont ni comptés ni stockés.** Les stocker pour les
compter le jour venu récompenserait à retardement une horloge de téléphone
avancée ; les jeter ne perd rien, puisque l'envoi transmet l'ensemble complet à
chaque fois et que le client renverra l'identifiant quand son jour sera venu.

**Les identifiants inconnus du programme sont ignorés, pas refusés.** Un
navigateur peut servir une version antérieure de `programme.json` depuis le cache
de son service worker ; refuser l'envoi entier l'exclurait du classement jusqu'au
prochain rechargement.

### `GET /api/coach`

Aucune authentification. PRD §13 : *« Le mot de passe statique sur la vue coach.
Écarté. […] Sur une page publique, il donnerait l'apparence d'une protection sans
en être une. »* Et §7.6 : la page coach *« n'expose rien de plus que la page de
stats »* — **c'est la contrainte qui borne cette route** : elle ajoute des
agrégats, jamais un nom au-delà du podium.

Réponse `200` :

```json
{
  "jour": "2026-08-07",
  "programmees": 22,
  "participants": 9,
  "classement": [ { "rang": 1, "cochees": 22, "part": 1, "pseudo": "Renard" } ],
  "groupe": { "cochees": 121, "programmees": 198, "part": 0.611 },
  "assiduite": { "aucune": 1, "faible": 2, "moyenne": 3, "forte": 3 },
  "seances": [
    {
      "date": "2026-08-03",
      "titre": "Endurance + Renforcement",
      "exercices": 8,
      "cochees": 61,
      "participantsActifs": 8,
      "participantsAyantFini": 6
    }
  ],
  "ressentis": { "facile": 4, "correct": 11, "dur": 6 }
}
```

- **`classement`** est **le tableau identique** à celui de `/api/classement`,
  pseudonymes limités aux trois premiers. Le §7.6 dit *« exactement ce qui est
  déjà public »* ; le §9 dit que la position ne nomme personne. Les deux tiennent
  ensemble si et seulement si le coach voit la même chose que les enfants.
- **`assiduite`** répartit les participants sur leur `part` : `aucune` = 0 ;
  `faible` = ]0 ; 0,3[ ; `moyenne` = [0,3 ; 0,6[ ; `forte` = ≥ 0,6. La borne
  haute est celle du PRD §4 — *« Part des exercices cochés […] cible > 60 % »* —
  pour que le coach lise sa cible sans la recalculer.
- **`seances`** ne liste que les séances déjà programmées au jour du serveur.
  `participantsActifs` = au moins une case cochée dans cette séance ;
  `participantsAyantFini` = toutes ses cases. La deuxième mesure du PRD §4 —
  *« Part de l'effectif encore active à la séance du 17 août »* — se lit
  directement sur la ligne du 17, sans rien instrumenter.
- **`ressentis`** agrège les trois valeurs du PRD §6 lot 2 item 10 sur tous les
  participants et toutes les dates. Le champ existe et reste à zéro tant que le
  PRP 10 n'envoie rien.

**Pourquoi le champ `ressentis` est défini ici et non au PRP 10.** Le décodeur
refuse les champs inconnus (chantier 5) : un client du PRP 10 qui ajouterait
`ressentis` à un serveur qui ne le connaît pas recevrait `400` sur **tous** ses
envois, y compris ceux du classement. Ouvrir deux fois une route publique
d'écriture, c'est deux occasions de rater une validation ; et l'ossature §7 fixe
la liste des routes du lot 2 à trois — une quatrième route pour le ressenti la
contredirait. Validation : au plus une entrée par séance du programme, la clé
doit être une date de séance, la valeur ∈ `{facile, correct, dur}`.

### Le pseudonyme

| Règle | Valeur | Motif |
|---|---|---|
| Rognage | espaces de tête et de queue retirés, suites d'espaces internes réduites à un seul | « Le Renard » et « Le  Renard » sont le même enfant qui a tapé deux fois |
| Longueur | 2 à 16 **runes** | Compté en runes et non en octets, sans quoi « Léa » et « Lea » n'auraient pas la même limite |
| Accepté | lettres Unicode, chiffres, espace, `-`, `'`, `_` | De quoi écrire un surnom, y compris accentué |
| Refusé | toute rune des catégories `Cc`, `Cf`, `Co`, `Cs` et `Mn` | Les commandes bidirectionnelles (`U+202E`) réordonnent l'affichage de la ligne voisine sur une page publique ; les caractères de largeur nulle permettent deux pseudonymes visuellement identiques ; les marques combinantes (`Mn`) sont refusées pour la raison expliquée aux points d'attention |
| Clé d'unicité | minuscules (`strings.ToLower`) du pseudonyme rogné | « renard » et « Renard » ne sont pas deux enfants sur un podium |
| Forme affichée | telle que saisie | Le pseudonyme du podium est celui que l'enfant a choisi |

Aucun filtrage de contenu : le PRD §14 tranche déjà ce risque — *« le pseudonyme
proposé par défaut n'est pas le prénom ; il reste modifiable par l'enfant, et
supprimable »* — et une liste de mots interdits sur une page lue par une équipe
qui se connaît serait de l'esbroufe.

### Le code à 4 chiffres

**Ce qu'il fait, exactement :** il attache un pseudonyme au premier envoi qui le
crée, et tout envoi ultérieur sur ce pseudonyme doit présenter le même code. Il
n'ouvre aucune lecture, ne protège aucune donnée, n'identifie personne.
PRD §7.4 : *« il empêche quelqu'un d'autre de modifier son score depuis un autre
téléphone. Ce n'est pas un mot de passe protégeant des données sensibles — il n'y
en a pas sur le serveur. »*

- **Format** : exactement quatre chiffres ASCII, `^[0-9]{4}$`. Tout le reste est
  refusé en `400`.
- **Aucun code n'est interdit** — ni `0000`, ni `1234`. Interdire serait de la
  friction sur un jeton qui ne protège rien, et donnerait à croire l'inverse.
- **Aucune récupération.** Un code oublié ne se réinitialise pas : réinitialiser
  demanderait une identité, et il n'y en a aucune. Le recours est de choisir un
  autre pseudonyme. Le PRP 08 doit l'écrire avant que l'enfant ne choisisse.
- **Vérification en temps constant** : `hmac.Equal` sur l'empreinte. Une
  comparaison octet à octet donnerait, sur une page publique, un canal de mesure
  gratuit.
- **Une seule erreur pour deux situations.** « Ce pseudonyme est pris par un
  autre » et « ton code est faux » rendent le même `403 code-refuse` et le même
  message : *« Ce nom est déjà pris, ou le code ne correspond pas. »* Les
  distinguer transformerait la route en oracle de disponibilité de pseudonymes.
- **Interdits de vocabulaire pour le PRP 08**, imposés par le §7.4 : jamais
  « mot de passe », jamais « sécurise », jamais « protège tes données ». La
  formulation admise est du type : *« Ce code empêche quelqu'un d'autre de
  changer ton score. Il ne protège rien d'autre : tout ce qui est ici est
  public. »*

### Les erreurs, une seule enveloppe

```json
{ "erreur": "code-refuse", "message": "Ce nom est déjà pris, ou le code ne correspond pas." }
```

| Cas | Statut | `erreur` |
|---|---|---|
| corps illisible, > 8 Kio, ou champ inconnu | `400` | `json-invalide` |
| pseudonyme vide, trop long, caractère refusé | `400` | `pseudo-invalide` |
| code différent de quatre chiffres | `400` | `code-invalide` |
| `faits` absent, non tableau, ou plus d'entrées que le programme n'a d'exercices | `400` | `faits-invalide` |
| `ressentis` mal formé | `400` | `ressentis-invalide` |
| pseudonyme existant, code différent | `403` | `code-refuse` |
| 5 codes refusés en 15 min sur ce pseudonyme | `429` + `Retry-After: 900` | `trop-d-essais` |
| 200 participants atteints et le pseudonyme est nouveau | `409` | `classement-plein` |
| envoi après `prog.Fin` | `409` | `classement-fige` |
| magasin absent ou non inscriptible | `503` + `Retry-After: 60` | `classement-indisponible` |

`message` est en français, destiné à être affiché tel quel par le PRP 08 : une
API dont le client doit traduire les codes produit deux vocabulaires qui divergent.

**Critère d'acceptation.** `api_test.go` couvre, via `httptest` et `routes(...)`
— jamais un `ServeMux` reconstruit dans le test, pour la raison que donne
`cadran/main.go:153-156` — : les trois routes en cas nominal ; les dix lignes du
tableau d'erreurs ; le `201` puis `200` sur le même pseudonyme ; l'absence de
`pseudo` à partir de la quatrième ligne ; l'ordre des ex æquo ; `cl == nil` qui
rend `503` sur les trois routes pendant que `/healthz` rend `200`.

---

## Chantier 5 — Ce que le serveur fait d'une charge utile hostile

**Ce qu'il fait.** Il borne tout ce qu'un inconnu peut faire de cette API. Le
PRD §11 le pose sans détour : *« L'app encaisse du trafic non sollicité — robots
d'indexation, scanners. Le rate-limit du palier (50 req/s par IP) n'est pas une
protection. »* Ce chantier n'est pas du durcissement décoratif : c'est le seul
endroit du projet où un inconnu peut écrire.

**Une charge utile forgée.**

- `http.MaxBytesReader(w, r.Body, 8<<10)` avant tout décodage. Un corps d'un
  gigaoctet est coupé à 8 Kio et rend `400`, jamais `500` : la coupure remonte un
  `*http.MaxBytesError`, à reconnaître par `errors.As` et à mapper sur
  `json-invalide`. 8 Kio est large : 53 identifiants font environ 600 octets.
- `json.Decoder` avec **`DisallowUnknownFields()`**. Un corps portant `"prenom"`,
  `"email"` ou `"telephone"` est refusé en bloc — la valeur n'est ni décodée, ni
  stockée, ni tracée.
- Après décodage, `decodeur.Decode(&reste) != io.EOF` refuse un second objet JSON
  concaténé au premier.
- `len(faits)` supérieur au nombre d'exercices du programme rend `400` avant
  toute allocation par identifiant ; les doublons sont réduits ensuite.
- Chaque identifiant est vérifié contre le programme. Un identifiant inventé
  n'entre nulle part et ne gonfle aucun numérateur.

**Un pseudonyme de 10 000 caractères.** Il est arrêté deux fois : par la borne de
corps de 8 Kio, et par la longueur de 16 runes. La validation compte les runes
**avant** toute écriture et **avant** toute trace ; rien de la valeur refusée
n'apparaît dans le message d'erreur — un message d'erreur qui renvoie l'entrée
refusée est un point d'injection dans les journaux.

**Mille requêtes par seconde.**

- `GET /api/classement` et `GET /api/coach` sont servies depuis la mémoire, sans
  écriture, sans allocation notable. Un robot qui les martèle consomme du CPU et
  rien d'autre. `Cache-Control: no-store` et aucun en-tête CORS : aucune page
  tierce ne peut les lire depuis un navigateur.
- `POST` sur un pseudonyme existant avec un mauvais code : **5 échecs en 15
  minutes** et le pseudonyme répond `429` pendant 15 minutes, code correct ou
  non. Sans cela, 10 000 possibilités à 50 req/s — la limite du palier — sont
  épuisées en 200 secondes : la limite du palier n'est pas une protection, elle
  est un plafond de débit. Ce compteur vit **en mémoire** et se perd au
  redémarrage : le persister demanderait un élagage, et une pénalité de quinze
  minutes annulée par un redéploiement ne met rien en danger.
- **Le plafond de 200 participants** est la vraie borne. La seule croissance non
  bornée de cette API est la création de pseudonymes ; au-delà de 200, un
  pseudonyme nouveau rend `409` et les participants existants continuent
  normalement. 200 est très au-dessus d'une équipe — le PRD §4 dit *« une équipe,
  pas une cohorte »* — et 200 fiches font environ 500 Kio sur un disque à 92 %.
  Remplir les 200 places reste possible : c'est une nuisance, réparable à la main
  en éditant le fichier et en redémarrant, pas une fuite.
- **Après le 21 août, il n'y a plus d'écriture du tout** : `classement-fige`
  ferme la seule route d'écriture pour toute la durée de vie restante de
  l'application. C'est la meilleure réponse possible à *« l'URL finira par être
  trouvée »*.
- `ReadTimeout: 10 * time.Second` est ajouté au `http.Server` de `main.go`, à
  côté du `ReadHeaderTimeout` du PRP 01 : sans lui, un corps envoyé octet par
  octet immobilise une connexion indéfiniment.

**Aucune donnée nominative ne peut atteindre ce serveur.** Le PRD §5 est la règle
qui prime sur toutes les autres : *« Le prénom de l'enfant ne quitte jamais son
appareil. »* Voici pourquoi la **forme** de l'API le rend impossible, et pas
seulement déconseillé :

1. **Aucun champ ne peut l'accueillir.** Le corps accepté a exactement quatre
   champs — `pseudo`, `code`, `faits`, `ressentis` — et `DisallowUnknownFields`
   rejette tout le reste en `400`. Un client bavard ne fait pas passer une valeur
   en trop : il fait échouer sa requête.
2. **Le seul texte libre est borné et choisi.** `pseudo`, 16 runes, sans
   caractères de commande : on n'y glisse pas une phrase, et sa valeur est
   précisément ce que l'enfant a décidé de publier après l'écran de consentement
   du §7.4.
3. **Aucun en-tête n'est lu.** Ni identité, ni adresse d'origine, ni agent
   utilisateur. `--check` vérifie déjà le cas le plus dangereux ; les autres ne
   sont simplement pas dans le code.
4. **Les journaux ne portent que méthode, chemin, statut, durée** — le `logging`
   du PRP 01, inchangé. Jamais un corps, jamais un pseudonyme. Ossature §9 :
   *« les journaux […] n'enregistrent aucune identité »*.
5. **Le fichier stocké n'a aucun champ pour une donnée nominative** : quatre
   champs de fiche, deux horodatages, et une carte d'identifiants d'exercices.
6. **Le PRP 08 ne doit jamais importer `lirePrenom`** dans le module qui compose
   l'envoi. `marcq.v1.prenom` et `marcq.v1.classement` sont deux clés distinctes
   (ossature §6) ; le prénom n'a aucun chemin vers la couche réseau.

La formulation honnête, et celle à reprendre dans le `README` : le serveur ne
peut pas recevoir le prénom **en tant que prénom** — aucun champ, aucun en-tête,
aucune trace. Qu'un enfant choisisse son prénom comme pseudonyme reste son droit,
et le PRD §7.4 le prévoit explicitement : *« il peut le remplacer par ce qu'il
veut, y compris son prénom : c'est son choix, il a été informé de ce qu'il
implique. »* Le rôle de l'écran de consentement du PRP 08 est de rendre ce choix
éclairé ; le rôle de cette API est de n'offrir aucune autre porte.

**Critère d'acceptation.** `api_test.go` : un corps de 64 Kio rend `400` ; un
corps portant `"prenom"` rend `400` et le fichier du magasin ne contient pas la
valeur ; un pseudonyme de 10 000 caractères rend `400` sans que le message ne le
répète ; six envois avec un mauvais code rendent `403` cinq fois puis `429` avec
`Retry-After` ; le 201e pseudonyme rend `409` ; un envoi daté après `prog.Fin`
rend `409` `classement-fige`.

---

## Ce qui reste à trancher avant d'exécuter

| Question | Qui tranche | Ce qui bouge selon la réponse |
|---|---|---|
| **Un volume persistant existe-t-il, sur quel chemin, inscriptible par l'uid 10001 ?** (PRD §12.1) | l'exploitation du serveur | Tout. « Non » ⇒ le lot 2 ne se livre pas, les PRP 08, 09 et 10 tombent |
| **`init.sh` apprend-il à monter un volume par app ?** | le mainteneur de la fabrique, sur une branche `fabrique/<sujet>` | Sans lui, `compose.yaml` ne peut pas monter le volume et `--check` refuse l'édition manuelle. Le code de ce PRP se fusionne quand même : `MARCQ_DONNEES` vide ⇒ trois routes en `503` |
| **Page 3 sur 3 de la note du coach** (PRD §12.3) | le coach, avant le 17 août | Rien dans ce code. `programme.json` gagne des séances, les dénominateurs suivent, les identifiants déjà stockés restent valides. Seuls les sept nombres de `domaine_test.go` sont à mettre à jour, comme ceux de `tests/domaine.test.js` |
| **Le coach regardera-t-il son écran ?** (PRD §15.3) | le coach | Décision prise ici : `/api/coach` et le champ `ressentis` sont construits quand même — quarante lignes, contre la certitude de devoir rouvrir une route publique d'écriture plus tard. Un « non » du coach supprime la page du PRP 10, pas cette route |
| **Le plafond de 200 participants** | le décideur du PRD | Une équipe U15 en compte une vingtaine. Le chiffre borne le disque ; il se relève d'une constante si plusieurs équipes s'y mettent |

---

## Points d'attention

**N'écris pas le nom de l'en-tête d'identité dans un commentaire Go.**
`init.sh:1444-1452` grep les fichiers suivis **non-`.md`** de `apps/marcq-handball/`
sans distinguer code et commentaire. Un commentaire expliquant qu'on ne lit pas
cet en-tête ferait échouer `./init.sh --check` avec un message qui ressemble à un
faux positif alors qu'il est exact. Ce document-ci est un `.md` : il a le droit de
le nommer, `classement.go` ne l'a pas. Même piège que le test de pureté du PRP 02.

**`_ "time/tzdata"` est obligatoire.** L'image finale est Alpine, qui n'embarque
pas la base des fuseaux ; `time.LoadLocation("Europe/Paris")` y échoue alors
qu'elle réussit sur un poste de développement. Sans cet import, `jourParis` se
replierait sur UTC et, chaque soir d'été entre 22 h et minuit heure de Paris, le
serveur compterait la veille : le dénominateur du classement serait faux deux
heures par jour, tous les jours. `cadran/main.go:26-30` a déjà le précédent, pour
environ 450 Ko dans le binaire.

**Ne lis pas `TZ`.** `cadran` le fait, ce serveur ne doit pas : le jour du
classement est celui du club, et l'ossature §5 fige `Europe/Paris` côté navigateur
pour exactement cette raison — *« un enfant en vacances à l'étranger doit voir la
séance du jour de son club »*. Un `TZ` posé un jour sur la stack ferait diverger
le dénominateur du serveur de l'affichage des téléphones, sans qu'aucun test ne
le voie.

**Le temporaire de l'écriture atomique doit être dans le répertoire cible.**
`os.Rename` n'est atomique qu'au sein d'un système de fichiers : un temporaire
dans `os.TempDir()` traverse le point de montage du volume et échoue sur `EXDEV`.
Et sans `Sync()` avant le renommage, une coupure laisse un fichier de la bonne
taille et vide de contenu.

**Le montage appartenant à root est le mode de panne le plus probable, et le plus
silencieux.** Le conteneur tourne en uid 10001 ; toutes les écritures échouent
avec `EACCES`, `/healthz` reste vert, l'app sert parfaitement, et seul le
classement répond `503`. C'est ce que la sonde d'écriture au démarrage rend
visible dans les journaux avant tout trafic.

**Les marques combinantes sont refusées faute de normalisation Unicode.** La
bibliothèque standard ne fournit pas NFC — `golang.org/x/text/unicode/norm` est
hors de la règle « stdlib seule » de l'ossature §2. Sans normalisation, « Léa »
précomposé et « Léa » avec accent combinant seraient deux participants
visuellement identiques. Refuser la catégorie `Mn` supprime la classe entière :
un clavier ordinaire produit la forme précomposée, et le refus est explicite au
lieu d'être une collision silencieuse.

**Le rang change à minuit sans que personne n'ait bougé.** À 00 h 00 heure de
Paris, `programmees` augmente d'un jour de séance et toutes les `part` chutent ;
un envoi juste avant et un envoi juste après ne sont pas comparables. Le PRP 09
ne doit pas animer un changement de position qu'il n'a pas causé — d'où le champ
`jour` dans chaque réponse, à comparer au `dernierRangConnu` mis en cache.

**`enregistrer` ne connaît pas HTTP.** Elle rend des erreurs sentinelles
(`errCodeRefuse`, `errTropDEssais`, `errClassementPlein`, `errClassementFige`, …)
que `api.go` traduit en statut et en code. Ce découpage est ce qui rend
`classement_test.go` lisible sans `httptest`, et c'est le même que celui de
`cadran`, où `angles` ne connaît pas `http`.

**Le `405` ne porte pas l'enveloppe d'erreur JSON.** `http.ServeMux` répond
lui-même `405 Method Not Allowed` avec un `Allow` correct et un corps en texte
brut dès lors qu'un motif correspond au chemin mais pas à la méthode. C'est le
comportement de la bibliothèque standard, et il est conservé. Le PRP 08 doit donc
ne tenter de décoder l'enveloppe JSON que si le `Content-Type` de la réponse est
`application/json`.

**Les sources Go de la fabrique s'écrivent en français sans accents.**
`cadran/main.go` et `hello-world/main.go` en donnent le précédent : les
commentaires sont en français, les caractères restent ASCII. Les chaînes visibles
par l'utilisateur — les `message` des erreurs — portent, elles, leurs accents.

**Un seul processus écrit ce fichier.** La stack ne déclare aucune réplique et
`container_name: marcq-handball` interdit le second exemplaire. Le `sync.Mutex`
du magasin suffit tant que cela reste vrai ; le jour où deux exemplaires
tourneraient, le dernier écrivain écraserait l'autre sans qu'aucun test ne le
détecte. À écrire dans le `README`, au même endroit que la demande de volume.

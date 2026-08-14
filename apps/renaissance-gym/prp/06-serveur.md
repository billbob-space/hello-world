# PRP 06 — Le serveur : les fiches, le code, l'API

| | |
|---|---|
| **Lot** | 2 |
| **Dépend de** | rien dans le dépôt — **mais un verrou d'exploitation, ci-dessous** |
| **Débloque** | PRP 03 écran 3, PRP 07 |
| **PRD** | §10 en entier, §11.1, §12 |

> ⛔ **Verrou** — le PRD §12.1 pose que le volume nommé doit survivre au
> redéploiement. Tant qu'il n'est pas tenu, le serveur promet une sauvegarde
> qu'il ne rend pas, ce qui est **pire que pas de serveur** : l'application
> aurait cessé de suffire à elle-même en échange de rien. Le volume
> `renaissance-gym-donnees` est déclaré dans `app.yml` ; sa sauvegarde relève
> de l'exploitation et non de ce dépôt.

## Objectif

Garder une fiche par gymnaste, ne la rendre qu'à qui connaît le pseudonyme
**et** le code, et ne rien savoir d'autre.

## Ce qui est vérifiable à la fin

- `go vet ./...` et `go test ./...` passent.
- Un test écrit une fiche avec le code `481920`, relit **le fichier produit sur
  le disque**, et échoue s'il y trouve `481920` — ossature §7 point 5.
- Un test assert qu'un mauvais code et un pseudonyme inexistant produisent
  **exactement la même réponse**, corps et statut compris : sinon l'API est un
  oracle d'existence de pseudonymes.
- Un test assert que la fusion serveur est une union et ne perd aucun fait,
  quel que soit l'ordre d'arrivée (PRD §9.8).
- Un test assert que la quatrième tentative de code dans la même minute, pour un
  même pseudonyme, est refusée avec un délai, et que le délai est **par
  pseudonyme** et non global : un attaquant ne doit pas pouvoir bloquer la
  gymnaste en pilonnant son pseudonyme depuis ailleurs. Le refus renvoie donc un
  délai, jamais un verrouillage définitif.
- Un test assert qu'aucune route ne liste, ne compte, ni ne recherche de fiches.

## Chantier A — `fiche.go`, le magasin

Un fichier JSON par fiche, sous `$GYM_DONNEES` (défaut `/var/lib/renaissance-gym`),
nommé d'après l'empreinte du pseudonyme et non du pseudonyme lui-même : le
listing du répertoire ne doit pas rendre les pseudonymes lisibles.

```go
type Fiche struct {
    Pseudo     string   // tel qu'elle l'a ecrit, pour le lui reafficher
    CodeSel    string   // 16 octets, base64
    CodeHash   string   // argon2id ou scrypt de (code + sel)
    Prenom     string   // PRD §10.3 — choix explicite du demandeur
    SemaineDep int
    Faits      []Fait   // { Exercice, Semaine, Seance, A time.Time }
    Badges     []string
    CreeeLe    time.Time
    MajLe      time.Time
}
```

**Le code n'est jamais stocké en clair.** `scrypt` de la bibliothèque étendue
n'est pas disponible sans dépendance ; utiliser `golang.org/x/crypto` est exclu
par la règle « aucune dépendance tierce » de l'ossature §6. La forme retenue est
**PBKDF2-HMAC-SHA256 avec 200 000 itérations**, écrit à la main sur
`crypto/hmac` et `crypto/sha256` de la bibliothèque standard — une trentaine de
lignes, et le seul choix qui tienne les deux contraintes à la fois. La
comparaison se fait par `hmac.Equal`, jamais par `==`.

**L'écriture est atomique** : fichier temporaire dans le même répertoire, puis
`os.Rename`. Un redémarrage au mauvais moment ne doit pas laisser une fiche
tronquée — c'est huit semaines d'entraînement.

**Un verrou par pseudonyme** sérialise les écritures concurrentes : deux
téléphones qui synchronisent en même temps ne doivent pas s'écraser.

## Chantier B — `api.go`, les trois opérations

`POST /api/fiche` porte les trois, distinguées par un champ `operation`. Une
seule route, parce que trois routes qui prennent le même couple d'identifiants
multiplient par trois la surface à protéger.

| `operation` | Corps | Réponse |
|---|---|---|
| `creer` | pseudo, code, prenom, semaineDepart | `201` + la fiche ; `409` si le pseudonyme est pris |
| `synchroniser` | pseudo, code, faits, badges, prenom, semaineDepart | `200` + la fiche **fusionnée** |
| `effacer` | pseudo, code | `204` |

`401` pour un couple refusé — **le même corps et le même statut** que pour un
pseudonyme inexistant. `429` avec un champ `attendreMs` quand la temporisation
est active.

**La fusion est une union** (PRD §9.8) : `faits` reçus ∪ `faits` stockés,
dédoublonnés sur `(exercice, semaine, seance)`, la date la plus ancienne
gagnant. `prenom` et `semaineDepart` prennent la valeur reçue si elle est non
vide — ce sont les deux champs du PRD §9.9 où le dernier écrit gagne.

**Bornes, refusées avant lecture** : corps de 256 Kio au plus, 2 000 faits au
plus par fiche, pseudonyme de 16 caractères, code de 6 chiffres exactement.
Un dépassement rend `400` et n'écrit rien.

## Chantier C — `main.go`

- Sert `web/` en statique, avec les bons types MIME et un `Cache-Control` court
  sur `index.html`, long sur la police.
- `/healthz` rend `200` sans toucher au disque.
- Écoute sur `:8080`, ferme proprement sur `SIGTERM`.
- **Journalise sur la sortie standard**, une ligne par requête, **sans jamais
  écrire un pseudonyme, un prénom ni un code**. Les journaux du conteneur sont
  lisibles par l'exploitation ; ce qui est protégé par un code ne doit pas s'y
  retrouver en clair.
- Aucun port publié, aucun secret, aucun label Traefik : ce sont les règles
  impératives de la fabrique.

## Chantier D — la temporisation

En mémoire, par empreinte de pseudonyme : les échecs consécutifs et l'instant du
dernier. Les délais sont ceux du PRD §7.5 — 5, 15, 45 s — et le compteur se
remet à zéro sur un succès.

Elle vit en mémoire et non sur le disque : un redémarrage la perd, ce qui est
acceptable. Écrire un compteur d'échecs à chaque tentative offrirait à un
attaquant un moyen d'user le disque, et le vrai rempart est le million de
combinaisons du PRD §10.2, pas la temporisation — qui ne fait que retirer
l'attaque en ligne du domaine du raisonnable.

## Chantier E — le `Dockerfile`

Multi-étapes, image finale `scratch` ou `alpine`, binaire statique, utilisateur
non root `10001`.

```dockerfile
RUN mkdir -p /var/lib/renaissance-gym && chown 10001:10001 /var/lib/renaissance-gym
USER 10001
ENV GYM_DONNEES=/var/lib/renaissance-gym
```

Le `chown` est **avant** `USER` : au premier montage, Docker recopie dans le
volume vide le répertoire tel qu'il est dans l'image, propriétaire compris. Fait
après, l'application démarre et perd tout — le symptôme le plus coûteux à
diagnostiquer de toute la fabrique.

Si l'image finale est `alpine`, elle porte `wget` pour le healthcheck déclaré
dans `app.yml` ; si elle est `scratch`, le healthcheck doit changer de forme dans
`app.yml` — **et c'est une modification de manifeste, donc un `./init.sh` à
relancer.**

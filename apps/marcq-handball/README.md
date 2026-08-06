# marcq-handball

URL : https://marcq-handball.apps.billbob.ovh — palier d'exposition : `public`.

Le programme d'été U15 du Marcq Handball, du 3 au 21 août 2026 : les séances du
coach, cochables d'un tap, sur le téléphone de l'enfant.

## Le partage serveur / navigateur

Le serveur ne connaît **aucun** utilisateur. Il sert la coque embarquée par
`go:embed`, une sonde de santé, et — depuis le lot 2 — **un seul état** : le
classement. Le domaine, la progression et le prénom vivent dans le navigateur,
en modules ES natifs : pas de bundler, pas de `node_modules`, pas de
transpilation.

Le palier est `public` : Traefik n'authentifie personne, ne pose donc aucun
en-tête d'identité, et l'application n'en lit aucun. Ce qui est propre à un
visiteur reste sur son appareil (`localStorage`), à l'exception de ce qu'il
choisit d'envoyer au classement : un pseudonyme, un code à 4 chiffres et des
identifiants d'exercices.

**Le prénom de l'enfant ne quitte jamais son appareil** (PRD §5), et c'est la
*forme* de l'API qui le garantit, pas une consigne : le corps accepté a
exactement cinq champs, tout champ inconnu fait échouer la requête entière,
aucun en-tête n'est lu, les journaux ne portent que méthode, chemin, statut et
durée, et la fiche stockée n'a aucun champ pour accueillir un nom.

## Routes

| Route | Réponse |
|---|---|
| `GET /` | `web/index.html` |
| `GET /<fichier>` | le fichier de `web/`, servi à la racine |
| `GET /programme.json` | `application/json`, `Cache-Control: no-cache` |
| `GET /sw.js` | `application/javascript`, `Cache-Control: no-cache`, version injectée |
| `GET /healthz` | `200 ok`, `text/plain` |
| `GET /api/classement` | le classement du jour, `no-store` |
| `POST /api/classement` | un envoi, ou un retrait — voir plus bas |
| `GET /api/coach` | le même tableau, plus des agrégats, `no-store` |
| tout le reste | `404` |

Toutes les réponses portent `X-App-Version` : vérifier un déploiement ne
demande pas d'ouvrir la page.

## Le classement

### Ce qu'il classe

La **part d'exercices accomplis parmi ceux déjà programmés à la date du
serveur** — pas sur les 53 du programme entier, sinon tout le monde est à 15 %
le 5 août (PRD §9). Le dénominateur est le même pour tous et change à minuit,
heure de Paris ; c'est pourquoi chaque réponse porte son champ `jour`.

Trois règles sont appliquées **par le serveur**, donc inviolables par un bogue
d'affichage : le podium nomme trois personnes et le champ `pseudo` n'est pas
émis au-delà de la troisième ligne ; les rangs sont stricts, de 1 à N, jamais
répétés — à égalité, le premier arrivé à ce score est devant ; les identifiants
d'une séance future ou inconnus du programme sont ignorés, ni comptés ni
stockés.

Après le 21 août, l'envoi répond `409 classement-fige` : le classement ne bouge
plus. Le **retrait**, lui, reste ouvert — le gel protège le rang, pas le droit
d'effacer sa fiche (PRD §14).

### `POST /api/classement`

`Content-Type: application/json`, **exactement cinq champs**, aucun autre
accepté :

```json
{
  "pseudo": "Renard",
  "code": "4821",
  "faits": ["s1-c1", "s1-c2"],
  "ressentis": { "2026-08-03": "correct" },
  "supprimer": false
}
```

`pseudo` et `code` sont toujours obligatoires ; `faits` l'est sauf en
suppression ; `ressentis` et `supprimer` sont facultatifs. Réponse `201` à la
création du pseudonyme, `200` à chaque mise à jour.

**L'envoi remplace, il n'ajoute pas.** L'ensemble reçu *devient* l'ensemble du
participant : décocher se propage. Deux conséquences à annoncer à l'enfant —
c'est le rôle du PRP 08 : deux téléphones sous le même pseudonyme s'écrasent
mutuellement, ce que le code à 4 chiffres empêche ; et un navigateur vidé qui
renvoie un ensemble vide retombe à zéro. Les horodatages serveur, eux, survivent
au remplacement, sans quoi chaque envoi remettrait à zéro le départage des ex
æquo.

`{"pseudo": "…", "code": "…", "supprimer": true}` efface la fiche entière et
**libère le pseudonyme**. L'opération est idempotente : un second appel rend
`200` et `"supprime": false`, jamais une erreur.

**Le code à 4 chiffres n'est pas un mot de passe.** Il attache un pseudonyme au
premier envoi qui le crée, et rien d'autre : il n'ouvre aucune lecture, ne
protège aucune donnée, n'identifie personne. Il n'est jamais stocké en clair —
pbkdf2-sha256, sel de 16 octets, 100 000 itérations — non pour protéger le
serveur, où il n'y a rien à protéger, mais parce qu'un ado saisira très
probablement le code de déverrouillage de son téléphone. Un code oublié **ne se
récupère pas** : le recours est de choisir un autre pseudonyme.

### Les erreurs

Une seule enveloppe, `{"erreur": "<code>", "message": "<français>"}`, le
`message` étant destiné à être affiché **tel quel**.

| Cas | Statut | `erreur` |
|---|---|---|
| corps illisible, > 8 Kio, ou champ inconnu | `400` | `json-invalide` |
| pseudonyme vide, trop long, caractère refusé | `400` | `pseudo-invalide` |
| code différent de quatre chiffres | `400` | `code-invalide` |
| `faits` absent (hors suppression) ou trop long | `400` | `faits-invalide` |
| `ressentis` mal formé | `400` | `ressentis-invalide` |
| pseudonyme existant, code différent | `403` | `code-refuse` |
| 5 codes refusés en 15 min sur ce pseudonyme | `429` + `Retry-After: 900` | `trop-d-essais` |
| 200 participants atteints, pseudonyme nouveau | `409` | `classement-plein` |
| envoi après le 21 août | `409` | `classement-fige` |
| magasin absent ou non inscriptible | `503` + `Retry-After: 60` | `classement-indisponible` |

Le `405` d'une mauvaise méthode vient de `http.ServeMux` et ne porte **pas**
cette enveloppe : ne décoder le JSON que si le `Content-Type` de la réponse est
`application/json`.

### Où il est stocké

Un fichier `classement.json` dans le volume `marcq-handball-donnees`, réécrit
atomiquement à chaque modification. Le magasin est un **cache de ce que les
téléphones détiennent déjà** : chaque envoi transmet l'ensemble complet d'un
participant, donc un fichier perdu se répare tout seul au prochain envoi de
chacun, en une journée d'usage. Ce qui ne se répare pas est l'ordre des ex æquo.

**Un seul processus écrit ce fichier.** La stack ne déclare aucune réplique et
`container_name: marcq-handball` interdit le second exemplaire ; le `sync.Mutex`
du magasin suffit tant que cela reste vrai. Le jour où deux exemplaires
tourneraient, le dernier écrivain écraserait l'autre **sans qu'aucun test ne le
détecte**.

Trois pannes ne mettent jamais l'application à terre — `/healthz` répond `200`
dans tous les cas, parce qu'un conteneur malsain retirerait du service une app
qui, à 95 %, fonctionne hors ligne dans le navigateur :

| Panne | Ce qui se passe |
|---|---|
| `MARCQ_DONNEES` non défini | classement désactivé, les trois routes `/api` rendent `503`, le reste sert normalement |
| volume appartenant à root | une sonde d'écriture le dit **au démarrage** dans les journaux, avant tout trafic ; puis même comportement que ci-dessus |
| `classement.json` illisible | renommé en `classement.corrompu-<date>.json`, on repart vide, trace sur la sortie standard |

## Développement

```bash
./apps/marcq-handball/test.sh          # go vet, go test, node --test

cd apps/marcq-handball
go run .                               # sur http://localhost:8080
PORT=3000 go run .                     # ailleurs
MARCQ_DONNEES=/tmp/marcq go run .      # avec le classement (le répertoire doit exister)
```

**`web/` est figé dans le binaire** par `go:embed` : après toute modification
d'un fichier de `web/`, il faut relancer `go run .`, sinon le serveur continue
de servir la version qu'il avait au démarrage. C'est la contrepartie — voulue —
de l'absence de chaîne de construction.

Sans `MARCQ_DONNEES`, le serveur local est exactement celui du lot 1 : les trois
routes `/api` rendent `503` et le reste fonctionne. C'est aussi l'état sous
`go test`, sauf dans les tests qui ouvrent leur propre magasin.

Le service worker met la coque en cache par version. En développement local la
version vaut `dev` et le cache ne change donc jamais de nom : recharger avec le
cache désactivé, ou vider `marcq-dev` dans les outils du navigateur.

## Variables d'environnement

Aucun secret n'est attendu, et rien de sensible ne doit transiter : tout ce que
le navigateur reçoit est public par construction.

| Nom | Rôle | Défaut |
|---|---|---|
| `PORT` | port d'écoute HTTP en clair dans le conteneur | `8080` |
| `MARCQ_DONNEES` | répertoire du classement. **Vide ou absent : le classement est désactivé** et les trois routes `/api` rendent `503`. Posée par le `Dockerfile` à `/var/lib/marcq-handball`, le point de montage du volume | *(vide en local)* |

## Besoins d'infrastructure

**Un volume nommé, et rien d'autre** : ni base de données, ni cache, ni port
supplémentaire, ni secret. Il est déclaré dans `app.yml` et `docker compose up`
le crée tout seul — aucune action sur le serveur, jamais.

| | |
|---|---|
| Volume | `donnees:/var/lib/marcq-handball`, soit `marcq-handball-donnees` |
| Propriétaire | uid `10001`, donné par le `Dockerfile` **avant** `USER` |
| Taille attendue | ~500 Kio : 200 participants × 53 identifiants × ~40 octets |
| Sauvegarde | **non demandée** — voir ci-dessous |

Le motif est le PRD §12.1 : *« Les scores du classement doivent survivre à un
redéploiement. Un classement remis à zéro à chaque publication d'image serait
pire que pas de classement. »* La demande porte donc sur la **persistance entre
deux déploiements**, pas sur la durabilité des données — une exigence beaucoup
plus faible, et il faut la lire ainsi : le magasin est un cache de ce que les
téléphones détiennent déjà.

`docker volume rm marcq-handball-donnees` n'est pourtant pas gratuit : chaque
enfant repart à zéro jusqu'à son prochain envoi, et l'ordre des ex æquo se
reconstruit dans l'ordre des renvois. Pour le sauvegarder :

```bash
docker run --rm -v marcq-handball-donnees:/d -v "$PWD":/sortie alpine \
  tar czf /sortie/marcq-handball-donnees.tgz -C /d .
```

## Modifier le programme

Le programme vit dans `web/programme.json` et nulle part ailleurs. Le changer ne
demande de toucher à aucune ligne de code : les totaux affichés en sont
recalculés (`web/domaine.js`), et `tests/domaine.test.js` les vérifie.

Le format est fixé par `prp/00-ossature.md` §4. Trois règles suffisent à ne pas
se tromper :

- **Une ligne d'exercice est une case à cocher**, quel que soit le nombre de
  tours. `tours` multiplie le volume, jamais le nombre de cases.
- **`id` est stable et ne se réattribue jamais.** C'est la clé de la progression
  enregistrée sur le téléphone de chaque enfant : renuméroter un identifiant
  efface la progression de tout le monde. Un exercice retiré laisse son
  identifiant à la retraite.
- **`mesure.valeur` est le volume d'un seul tour**, et `mesure.unite` vaut
  `pompes`, `squats`, `burpees`, `abdos`, `gainage_s`, `min_course`, `fentes` ou
  `autre`. Un exercice sans volume calculable — une distance sans durée, une
  chaise contre un mur — porte `autre` et n'entre dans aucun total.

Pour les blocs de course, on retient la durée totale du bloc, récupérations
comprises, dès que le coach a écrit les durées ; `autre` dès qu'il n'a écrit
qu'une distance. On ne convertit jamais une distance en durée.

Après toute modification :

```bash
./test.sh
```

Les assertions de totaux échoueront tant que le fichier ne se recalcule pas sur
les valeurs attendues. Si le programme change vraiment de contenu, ce sont ces
valeurs attendues qu'il faut mettre à jour — dans le test, jamais dans le code.

### Reste à recevoir

La page 3 sur 3 de la note du coach manque (PRD §12.3). La capture reçue
s'arrête après le lundi 17 août ; les sept séances saisies ici couvrent tout ce
qui est connu. Si la troisième page ajoute des séances, elles s'ajoutent à
`web/programme.json` — dates, identifiants `s8-*` et suivants, volumes — et les
totaux attendus du test se recalculent. À lever **avant le 17 août**.

## Les écrans et leurs routes

Le navigateur porte tout : le domaine, l'état et les écrans. Le serveur sert des
fichiers statiques et une sonde de santé, et ne connaît aucun utilisateur.

| Route | Écran | Fichier |
|---|---|---|
| `#/` (ou adresse sans ancre) | la séance du jour, ou le repos, ou la fin | `web/vue-jour.js` |
| `#/seance/<YYYY-MM-DD>` | une séance : la liste complète, cochable si sa date est passée ou en cours (PRD §9) | `web/vue-seance.js` |
| `#/perso` | ma progression : la part, le volume accompli, le calendrier | `web/vue-perso.js` |
| `#/reglages` | corriger le prénom, changer d'enfant | `web/vue-reglages.js` |

Tant qu'aucun prénom n'est enregistré, aucune route n'est honorée :
`web/vue-prenom.js` s'affiche à la place. C'est le seul péage de l'application.

**Ajouter un écran** demande trois lignes dans `web/app.js` — un `import`, une
entrée dans `ECRANS`, et un lien dans `LIENS` si l'écran mérite un onglet — plus
son fichier `web/vue-*.js`. Un écran est une fonction `(hote, ctx) => démontage`,
`hote` étant vidé par le routeur avant chaque montage. Le contexte `ctx` porte
`prog`, `aujourdhui`, `prenom`, `faits`, `route`, `aller(route)` et
`rafraichir()` ; il est relu à chaque rendu, et un écran ne le mute jamais.

**Ce qui est enregistré sur le téléphone**, et rien d'autre (`web/etat.js`) :

| Clé | Valeur |
|---|---|
| `marcq.v1.prenom` | le prénom, 24 caractères au plus |
| `marcq.v1.faits` | `{ "<id d'exercice>": "<horodatage ISO>" }` |
| `marcq.v1.classement` | `{ pseudo, code, dernierEnvoi, dernierRangConnu }` — écrite seulement si l'enfant a rejoint |

Un stockage refusé — navigation privée — ou plein ne casse rien : les valeurs
sont gardées en mémoire pour la durée de l'onglet. Elles ne survivent alors pas
à la fermeture, ce que la page de réglages annonce.

## L'écran « Ma progression »

Trois choses, dans cet ordre (PRD §7.5) : la **part** des exercices accomplis
parmi ceux **programmés à ce jour** — jamais sur les 53 du programme entier,
sinon tout le monde est à 15 % le 5 août (PRD §9) ; le **volume cumulé
accompli**, somme de ce qui a été coché, en langage d'ado (« 112 pompes, …
2 h 10 de course ») ; et le **calendrier des dix-neuf jours**, où les jours sans
séance sont du repos et non un trou.

Les six états d'une case viennent du domaine et ne sont ni fusionnés ni
inventés : `faite`, `commencée`, `aujourd’hui`, `à venir`, `manquée`, `repos`.
Une case de séance ouvre sa séance ; une case de repos n'est pas cliquable.

Le volume ne produit **aucun classement** (PRD §9) : il est déduit du programme,
il classerait dans le même ordre que la régularité. La comparaison à l'équipe est
le second niveau du §7.5 et arrive au lot 2, sous le calendrier.

## Rejoindre le classement, côté navigateur

Deux modules, et la séparation est le sujet : `web/classement.js` décide **ce
qui est envoyé**, `web/vue-rejoindre.js` **ce qui est dit**. C'est ce qui rend
vérifiable, sans navigateur ni réseau, que le prénom ne peut pas atteindre la
couche réseau — deux tests lisent la source des deux fichiers et échouent si le
mot y apparaît, commentaires compris.

**Le consentement n'est pas un écran d'accueil.** On y arrive par un bouton posé
sous le calendrier de « Ma progression », jamais par un onglet : le PRD §7.4 le
veut « au moment où il y a un vrai choix à faire ». `#/rejoindre` existe dans le
routeur et dans aucun menu.

**Il n'y a pas de file d'attente, il y a une comparaison.** Chaque envoi porte
l'ensemble complet des cases cochées, jamais un delta : il est donc idempotent,
et deux envois successifs ne se composent pas. On garde l'empreinte du dernier
envoi *accepté* — nombre de cases, plus horodatage le plus récent — et un envoi
est dû dès que l'état local en diffère. Un envoi perdu ne laisse aucune trace, et
le déclencheur suivant le refait tout seul.

Quatre déclencheurs, et eux seuls : une fois au démarrage (après le premier
rendu), à la fin d'une séance, au retour du réseau, et sur un geste explicite.
**Jamais à chaque case cochée** — 53 requêtes sur un programme, c'est ce qui
ferait mordre la limite de débit du palier public sur un enfant réel plutôt que
sur un robot.

### Trois comportements à connaître avant de les découvrir

**Un second téléphone écrase le score, il ne le fusionne pas.** Le même
pseudonyme et le même code saisis ailleurs, c'est exactement ce que le code sert
à permettre. Mais l'envoi porte l'état complet : le téléphone qui envoie en
dernier gagne, et s'il a moins de cases cochées, le score baisse. L'alternative —
un serveur qui garde le maximum — casserait le « le passé se corrige » du PRD §9,
décocher n'ayant alors plus aucun effet.

**Changer de nom, c'est supprimer puis rejoindre.** Il n'y a pas de renommage :
un envoi sous un nouveau pseudonyme créerait une seconde entrée et laisserait la
première orpheline. La séquence est sûre — la fiche supprimée libère le
pseudonyme, qui peut être repris avec un autre code. Le prix : le départage des
ex æquo repart de la date de la nouvelle inscription, et les cases cochées sont
renvoyées au premier envoi qui suit.

**« Changer d'enfant » orpheline le pseudonyme.** Ce geste efface les clés
locales mais ne touche pas au serveur : le nom reste au classement et plus
personne n'en détient le code. La confirmation gagne donc une phrase — et
seulement lorsqu'un pseudonyme existe — qui invite à le supprimer d'abord.

**Le code vit en clair dans `localStorage`.** Sur un téléphone partagé, un frère
peut supprimer le pseudonyme. C'est cohérent avec le PRD §14, qui assume déjà
qu'il n'y a ni compte ni sauvegarde ; le chiffrer demanderait un secret, que le
palier `public` interdit de faire descendre au navigateur.

## L'équipe : podium, position, jauge

Le second niveau du PRD §7.5, sous le calendrier de « Ma progression ». Trois
blocs, dans cet ordre : le **podium**, qui nomme trois personnes ; la
**position**, qui n'en nomme aucune ; la **jauge collective**, la seule mesure où
personne n'est dernier — et c'est elle qu'on lit en refermant.

**Le dénominateur inclut celui qui regarde.** Un enfant qui n'a pas rejoint lit
« 4e sur 4 » et non « 4e sur 3 » : l'ensemble comparé, ce sont les inscrits *plus
lui*. Trois raisons, et la première suffirait — sans le « + 1 », quelqu'un de
moins avancé que tous les inscrits serait « 10e sur 9 », et écrêter son rang
reviendrait à lui promettre qu'il n'est pas dernier alors qu'il l'est. Corollaire
qui compte : **le dénominateur ne bouge pas quand on rejoint**, donc rejoindre
n'est jamais présenté comme un moyen de mieux se classer, et « Non merci » reste
un choix complet.

*(À reporter dans le PRD §7.5 et §9, dont l'exemple chiffré dit encore « 3e sur
9 » : sans cette phrase, le prochain lecteur prendra l'écran pour un défaut.)*

**Le rang tranché par le serveur n'est jamais recalculé.** Le client ne calcule
une position que pour quelqu'un que le serveur ne connaît pas — et le rang et son
dénominateur viennent alors *de la même réponse*, jamais l'un du serveur et
l'autre d'un instantané plus ancien.

**Deux lignes datent deux choses différentes.** « Classement de vendredi 7 août »
date les *nombres affichés* — le jour dont le dénominateur est celui du
classement. La ligne juste dessous date la *réception*. Un podium sans sa date se
lit comme un podium en direct.

**Le rang s'anime, mais seulement quand on a vu le changement arriver** (PRD §10).
Quatre conditions : le bloc portait déjà un rang, le jour n'a pas changé, le rang
a réellement changé, et la position existait avant. À minuit, toutes les parts
chutent parce que le dénominateur grandit — une app ouverte toute la nuit ne doit
pas annoncer une dégringolade à 00 h 01.

**Deux choses que cet écran refuse d'afficher**, et deux tests le tiennent : un
second classement fondé sur le volume — il classerait dans le même ordre que la
régularité, à du bruit près, et deux podiums qui disent la même chose font un
podium plus de la confusion (PRD §13) — et un effectif d'équipe : tout
dénominateur vient de `participants`, jamais d'un nombre écrit en dur (PRD §4).

## Le ressenti de fin de séance

Trois émojis — 🙂 Facile, 😐 Correct, 🥵 Dur — **dans** le panneau qui célèbre la
fin d'une séance, entre les compteurs et le bouton. Jamais un second panneau :
deux fenêtres modales ouvertes sur le même événement, c'est un écran inerte et un
enfant coincé.

**Jamais obligatoire, et l'écran le dit.** « Tu peux fermer sans répondre » est
écrit sous les trois boutons. `Continuer` garde le focus initial — sans cela, une
touche Entrée machinale enregistrerait « Facile », et la répartition lue par le
coach serait faussée dans le sens le plus flatteur.

**Le ressenti part par le même canal que le score, sous la même autorisation, et
jamais séparément.** Celui d'un enfant qui n'a pas rejoint le classement ne quitte
donc **jamais** son téléphone. Le panneau pose pourtant la question de la même
façon aux deux : aucune phrase du type « rejoins pour partager ton ressenti »,
aucun bouton grisé. « Non merci » est un choix complet, pas une punition.

Un ressenti déclenche un envoi **tout de suite** : sinon celui tapé le lundi soir
n'arriverait qu'au prochain cochage — mercredi — et la répartition serait vide le
soir où le coach regarde.

**Il ne se modifie pas après coup**, et c'est assumé : la seule façon de le
changer est de décocher puis recocher la dernière case, ce qui rouvre le panneau.
C'est cohérent avec ce qu'il mesure — une humeur datée, pas une déclaration.

## La vue coach — et pourquoi elle n'a pas de mot de passe

Le lien à envoyer au coach : **https://marcq-handball.apps.billbob.ovh/#/coach**.
Il n'est listé nulle part dans la navigation de l'application.

Elle montre l'assiduité en quatre paliers, le classement, une ligne par séance et
la répartition des ressentis. Les deux mesures du PRD §4 s'y lisent directement :
le palier haut est libellé « 60 % et plus — la cible », et la part de l'effectif
encore active se lit sur la dernière ligne de séance.

**Le mot de passe statique a été écarté** (PRD §13). Sur une page publique il
donnerait l'apparence d'une protection sans en être une, et devrait de toute façon
être injecté par l'environnement — donc être un secret de plus, que le contrat de
la fabrique interdit dans le dépôt et dans l'image. Il aurait en outre un effet
inverse à celui qu'on lui prête : il ferait croire au coach que cette page peut
recevoir un jour des données nominatives.

Ce qui rend son absence acceptable n'est pas une promesse, c'est une propriété
**vérifiée** : la page n'a rien à protéger. Quatre assertions de source la
tiennent — elle n'importe aucun module qui touche au stockage du navigateur, ni
directement ni transitivement ; elle ne parle qu'à sa propre route ; elle ne
nomme jamais le prénom ; elle n'utilise pas `innerHTML`. Chaque ajout futur devra
passer par elles, et c'est ce qui empêche la dérive la plus probable de cette
page : « puisqu'on y est, montrons aussi… ».

**Si le coach veut le détail nominatif par enfant, ce sera une seconde
application**, en `exposure: private` — un autre répertoire sous `apps/`, avec son
image et son URL. Ce n'est pas un durcissement de celle-ci.

**La répartition affichée est partielle par construction** : elle ne compte que
les enfants qui ont rejoint le classement. Un coach qui lirait « 4 facile /
11 correct / 6 dur » comme le compte de son effectif se tromperait — la page le
dit, ce README aussi.

## Le bilan, après le 21 août

Le 22 août au matin, ouvrir le lien ne montre plus un programme terminé : il
montre ce que l'enfant a fait pendant trois semaines. **La bascule se produit
sans qu'un humain touche à quoi que ce soit et sans déploiement ce jour-là** —
elle ne dépend que de `fin` dans `programme.json` et de l'horloge du téléphone.
Aucune date n'est écrite dans le code : éditer le programme pour la saison
prochaine défait la bascule tout seul.

**Seule la racine bascule.** « Ma progression », les réglages et chaque séance
continuent de répondre : le PRD §9 dit que l'application bascule, pas qu'elle
ferme. Après le 21 août on peut encore corriger un prénom, relire une séance et
changer d'enfant.

**`#/bilan` est ouvrable à toute date**, et c'est délibéré : une route qui
n'existerait qu'à partir du 22 août ne pourrait être essayée pour la première
fois que le 22 août — le jour où il est trop tard pour la corriger. Ouvert en
avance, l'écran dit en une ligne que ce n'est pas fini.

**Le ton est la seule vraie décision de cet écran** : le bilan raconte ce qui a
été fait, il ne compte pas ce qui a manqué. « 3 séances bouclées et 22 exercices
cochés » et non « tu n'as fait que 3 séances sur 7 » — même donnée, lecture
opposée. Une séance non ouverte n'affiche aucun chiffre : « 0 exercice sur 6 »
est un reproche chiffré, l'absence de chiffre est un fait. Le mot du domaine
reste `manquee` — il pilote la couleur — mais l'écran écrit « non faite ». Un
test lit les phrases de trois bilans, dont celui de quelqu'un qui n'a rien fait,
et échoue sur `manqu`, `dommage`, `seulement`, `raté`, `bravo`, `champion` ou
`guerrier`.

**Aucune animation, aucun rien qui bouge.** Le mouvement est une récompense qui
vient après l'action ; ici la dernière case a été cochée il y a des jours.

Le classement gelé s'affiche, sans le bouton pour le rejoindre : il proposerait
d'entrer dans un classement fermé, et le serveur répondrait par une erreur pour
un geste que l'écran venait de proposer. Le gel lui-même n'est implémenté nulle
part côté navigateur — le serveur écrête le jour à la fin du programme et refuse
tout envoi postérieur, donc le classement est constant par construction.

## Les récompenses

`web/recompenses.js` est branché une seule fois, à l'amorçage, par `web/app.js`.
Il écoute `marcq:seance-complete` et ouvre le panneau de fin de séance.

Deux des récompenses n'ont **aucun JavaScript** : la ligne qui se barre et la
barre de progression qui rebondit sont des transitions CSS. C'est ce qui
garantit qu'un tap ne peut pas être retardé par ce module — il ne l'exécute pas.

Trois règles s'appliquent, et ce sont des critères d'acceptation (PRD §10) :

- rien ne bloque l'interaction plus d'une demi-seconde — aucune transition ne
  dépasse 400 ms ;
- rien ne bouge tout seul : aucune animation en boucle, aucune animation sans
  geste. Ouvrir une séance déjà cochée n'anime rien ;
- `prefers-reduced-motion: reduce` supprime tout mouvement et l'application
  reste entièrement utilisable : les compteurs affichent leur valeur, le panneau
  s'affiche sans confettis, et il se ferme des trois mêmes façons.

# marcq-handball

URL : https://marcq-handball.apps.billbob.ovh — palier d'exposition : `public`.

Le programme d'été U15 du Marcq Handball, du 3 au 21 août 2026 : les séances du
coach, cochables d'un tap, sur le téléphone de l'enfant.

## Le partage serveur / navigateur

Le serveur ne connaît **aucun** utilisateur et n'a **aucun** état. Il sert la
coque embarquée par `go:embed` et une sonde de santé. Le domaine, la
progression et le prénom vivent dans le navigateur, en modules ES natifs — pas
de bundler, pas de `node_modules`, pas de transpilation.

Le palier est `public` : Traefik n'authentifie personne, ne pose donc aucun
en-tête d'identité, et l'application n'en lit aucun. Ce qui est propre à un
visiteur reste sur son appareil (`localStorage`).

## Routes

| Route | Réponse |
|---|---|
| `GET /` | `web/index.html` |
| `GET /<fichier>` | le fichier de `web/`, servi à la racine |
| `GET /programme.json` | `application/json`, `Cache-Control: no-cache` |
| `GET /sw.js` | `application/javascript`, `Cache-Control: no-cache`, version injectée |
| `GET /healthz` | `200 ok`, `text/plain` |
| tout le reste | `404` |

Toutes les réponses portent `X-App-Version` : vérifier un déploiement ne
demande pas d'ouvrir la page.

## Développement

```bash
./apps/marcq-handball/test.sh          # go vet, go test, node --test

cd apps/marcq-handball
go run .                               # sur http://localhost:8080
PORT=3000 go run .                     # ailleurs
```

Le service worker met la coque en cache par version. En développement local la
version vaut `dev` et le cache ne change donc jamais de nom : recharger avec le
cache désactivé, ou vider `marcq-dev` dans les outils du navigateur.

## Variables d'environnement

Aucun secret n'est attendu, et rien de sensible ne doit transiter : tout ce que
le navigateur reçoit est public par construction.

| Nom | Rôle | Défaut |
|---|---|---|
| `PORT` | port d'écoute HTTP en clair dans le conteneur | `8080` |

## Besoins d'infrastructure

Aucun pour le lot 1 : ni base de données, ni cache, ni volume, ni port
supplémentaire.

**Le lot 2 en demandera un** : le classement doit survivre à un redéploiement
(PRD §12.1). Un magasin remis à zéro à chaque publication d'image serait pire
que pas de classement. C'est une décision d'exploitation, elle se prend côté
serveur ; le PRP 07 ne démarre pas avant.

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

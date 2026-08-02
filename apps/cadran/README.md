# cadran

Application de la fabrique, servie sur `cadran.apps.billbob.ovh`,
authentification `private` (liste blanche du serveur).

Elle affiche **l'heure du serveur** `billbob.ovh` sur un cadran à aiguilles.
Pas l'heure du poste qui regarde : l'heure de la machine qui fait tourner les
applications.

## Pourquoi l'heure du serveur, et comment

Une horloge qui lit `Date.now()` n'affiche que l'horloge du poste — ce que le
système d'exploitation sait déjà. Ici, la page arrive avec l'horodatage du
serveur ; le navigateur mesure **une fois** l'écart entre cette valeur et sa
propre horloge, puis compte à partir de là. Un poste déréglé de dix minutes
affiche donc quand même l'heure juste.

L'écart est réévalué toutes les minutes par `GET /api/heure`, et à chaque
retour sur l'onglet — un onglet endormi fige le compteur. Un échec de
resynchronisation n'a aucun effet visible : on continue sur le dernier écart
connu, dont la dérive se compte en millisecondes par minute.

Le fuseau est celui du serveur. Il est transmis sous la forme `UTC+02:00`, et
le navigateur lit l'heure murale avec les seuls accesseurs UTC : il n'a jamais
besoin de connaître `Europe/Paris`, ce que tous les navigateurs ne garantissent
pas.

## Sans JavaScript

Les angles des trois aiguilles sont calculés **au serveur** et posés dans la
page. Sans JavaScript, le cadran est donc juste mais figé — jamais sans
aiguilles — et la mention « heure du rendu » apparaît sous la date pour ne pas
laisser croire à une horloge arrêtée.

## Routes

| Route | Réponse |
|---|---|
| `GET /` | le cadran |
| `GET /api/heure` | `{"iso":…,"zone":…,"decalage_s":…}`, `Cache-Control: no-store` |
| `GET /healthz` | `200 ok` en texte brut, dès que le serveur écoute |

Tout autre chemin renvoie 404.

## Technologie

Go 1.24, bibliothèque standard uniquement — aucune dépendance externe.

| Fichier | Rôle |
|---|---|
| `main.go` | serveur HTTP, calcul des angles, formats français |
| `page.html` | le cadran, embarqué dans le binaire (`go:embed`) |
| `main_test.go` | les angles, les routes, le repli de fuseau, les formats |

**Le piège des fuseaux dans une image Alpine** : elle n'embarque pas la base
`tzdata`, donc `time.LoadLocation("Europe/Paris")` y échouerait alors qu'il
fonctionne sur un poste de développement — une panne qui n'apparaîtrait qu'en
production. L'import `_ "time/tzdata"` embarque la base dans le binaire :
environ 450 Ko, et aucun paquet ajouté à une image installée sur un serveur
déjà à 92 % de disque.

Le cadran est entièrement en CSS : les graduations sont des calques carrés de
la taille du disque, pivotés, la marque étant peinte en haut du calque — aucun
calcul de position, seulement un angle. Conséquence non évidente : une rotation
agrandit la zone de débordement d'un facteur √2, d'où l'`overflow: hidden` sur
le disque. Sans lui, la page défile latéralement sur téléphone — constaté, puis
mesuré : disque large de 304 px pour un `scrollWidth` de 407.

Aucune image, aucune police distante, aucune requête sortante depuis le
navigateur : le seul appel réseau est `/api/heure`, en même origine.

## Variables d'environnement

| Nom | Défaut | Rôle |
|---|---|---|
| `TZ` | `Europe/Paris` | fuseau affiché ; un nom inconnu retombe sur UTC avec une trace |
| `PORT` | `8080` | port d'écoute dans le conteneur |

Aucun secret n'est attendu ni lu par cette application.

## Développement

Depuis ce répertoire :

```bash
go test ./...
TZ=Europe/Paris go run .      # écoute sur :8080
curl localhost:8080/api/heure
```

Depuis la racine du dépôt, comme le fait la CI :

```bash
./apps/cadran/test.sh
docker build -t cadran apps/cadran
```

## Ce que cette application ne fait pas

Pas d'alarme, pas de chronomètre, pas de choix de fuseau par l'utilisateur, pas
de second cadran. Elle répond à une question et une seule : **quelle heure
est-il sur le serveur ?**

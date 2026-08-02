# Product — cadran

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

L'exploitant du serveur `billbob.ovh` et les comptes de sa liste blanche
(palier `private`). Situation type : on veut savoir quelle heure il est **sur
le serveur** — parce qu'un journal, un horodatage de déploiement ou une tâche
planifiée s'y réfèrent, et que l'heure du poste ne répond pas à cette question.

Second usage, plus courant en pratique : ouvrir la page parce qu'un cadran qui
tourne est agréable à regarder, et qu'il prouve du même coup que la fabrique
sert bien plus d'une application.

Il n'y a pas d'utilisateur anonyme : Traefik authentifie avant que la requête
n'atteigne l'application.

## Product Purpose

Afficher l'heure du serveur sur un cadran à aiguilles, lisible d'un coup d'œil
et juste à la seconde.

Le succès a deux formes. À l'usage : on lit l'heure du serveur sans ouvrir de
terminal, et sans se demander si c'est bien la sienne qu'on regarde. Pour la
fabrique : c'est la deuxième application, celle qui prouve que deux services
coexistent dans une stack unique avec des URL distinctes.

## Positioning

Ce n'est pas une horloge décorative. Une horloge décorative lit l'horloge du
navigateur et n'apprend rien à personne ; celle-ci mesure quelque chose que le
poste ne sait pas — l'heure d'une autre machine — et c'est tout son intérêt.

Elle est aussi la démonstration que deux applications de la fabrique peuvent
partager un monde visuel sans partager une ligne de code : le langage est
reproduit à la main, les contextes de construction restent étanches.

## Operating Context

- L'heure de référence est celle du serveur, transmise au chargement puis
  resynchronisée toutes les minutes et à chaque retour sur l'onglet.
- Le fuseau vient de la variable `TZ`, `Europe/Paris` par défaut. Un nom inconnu
  retombe sur UTC : le contrat impose une application qui démarre sans
  intervention.
- La base des fuseaux est embarquée dans le binaire (`time/tzdata`) : l'image
  Alpine n'en fournit aucune, et l'erreur ne serait apparue qu'en production.
- La consultation se fait aussi bien depuis un poste que depuis un téléphone.
  *(Déduit de l'usage de `hello-world`, non confirmé par l'utilisateur.)*

## Capabilities and Constraints

Fonctions confirmées :

| Route | Réponse |
|---|---|
| `GET /` | le cadran, avec les angles calculés au serveur |
| `GET /api/heure` | horodatage, fuseau et décalage, non mis en cache |
| `GET /healthz` | `200 ok`, texte brut, dès que le serveur écoute |

Tout autre chemin renvoie 404.

Contraintes techniques :

- Go 1.24, bibliothèque standard uniquement, aucune dépendance externe.
- `page.html` est **un fichier unique** embarqué par `go:embed`. Pas de chaîne
  de construction front, aucun asset séparé, aucune police distante ; le seul
  appel réseau du navigateur est `/api/heure`, en même origine.
- Le cadran est entièrement en CSS : les graduations sont des calques pivotés,
  ce qui impose `overflow: hidden` sur le disque — une rotation agrandit la zone
  de débordement, et la page défilerait latéralement sur téléphone.
- Sans JavaScript, les aiguilles gardent l'angle calculé au serveur : juste mais
  figé, et la page le dit.
- Image finale Alpine d'environ 13 Mo, utilisateur non root, aucun port publié.
- Les journaux vont sur la sortie standard et n'enregistrent pas l'identité.
- Aucun secret n'est attendu ni lu. Deux variables d'environnement : `TZ`, `PORT`.
- `main_test.go` verrouille le calcul des angles — c'est la seule vraie logique.
  En particulier : à 6 h 30 l'aiguille des heures est à 195°, pas à 180°.

Décision écartée : afficher l'heure locale du navigateur. Elle ferait de cette
application un doublon de l'horloge du système.

## Brand Commitments

- Nom : `cadran`, celui de son répertoire sous `apps/`. Domaine :
  `cadran.apps.billbob.ovh`.
- L'interface, les commentaires et la documentation sont en français.
- Même monde visuel que `hello-world` : un objet physique dans une pièce sombre,
  encre blanc chaud, et l'ambre réservé à une seule chose — ici la trotteuse,
  là-bas la ligne « vous ». La couleur de signal ne sert jamais à décorer.
- Pas de système de comptes : l'authentification appartient à Traefik.

## Evidence on Hand

Tout ce que la page affiche est mesuré : l'heure du serveur, son fuseau, son
décalage, la version de l'image déployée.

Ce qui n'existe pas et ne doit pas être inventé : dérive mesurée de l'horloge,
synchronisation NTP, précision annoncée en millisecondes, heure d'autres
machines, fuseaux multiples. L'application ne mesure rien de tout cela.

## Product Principles

1. **Une horloge doit être juste avant d'être belle.** Si l'heure affichée peut
   être celle d'un poste déréglé, l'application ne sert à rien.
2. **Rien d'affiché qui ne soit mesuré.** Pas de précision annoncée qu'on ne
   tient pas, pas d'indicateur décoratif.
3. **Dégrader, jamais casser.** Sans JavaScript le cadran est figé mais juste ;
   sans réseau il continue sur le dernier écart connu ; sans fuseau valide il
   affiche UTC. Aucun de ces cas n'empêche l'application de servir.
4. **L'ambre est un signal, pas une décoration.** Une seule chose est vivante
   sur le cadran, et c'est elle qui la porte.

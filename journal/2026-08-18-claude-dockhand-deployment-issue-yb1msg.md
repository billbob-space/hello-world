# 2026-08-18 — claude/dockhand-deployment-issue-yb1msg

Branche : `claude/dockhand-deployment-issue-yb1msg`
Périmètre : fabrique
Mode : `chaud`

Session ouverte sur « analyse le problème de déploiement unitaire qui ne
fonctionne pas dans dockhand », en partant du message posté le 8 août sur
[`Finsys/dockhand#419`](https://github.com/Finsys/dockhand/issues/419). Le
`README` décrivait déjà le symptôme et concluait que le dépôt n'y pouvait rien ;
la lecture du code source de `dockhand` a montré que ce n'était pas tout à fait
vrai.

## Anomalies

### 1. « Le dépôt n'y peut rien » avait été conclu sans lire le code de l'outil

**Symptome** — le `README` consacre une section entière au redémarrage sélectif
qu'on n'obtient pas, et la referme sur trois issues : relancer la demande chez
`dockhand`, changer d'outil, ou vivre avec. La lecture du code source de
`dockhand` — clone public, vingt minutes — en ouvre une quatrième, et corrige au
passage deux affirmations : la recréation forcée ne tient pas à un réglage
manquant mais à **une ligne**, `forceRecreate = syncResult.updated` dans le
chemin git, et `updated` vaut « un fichier a changé **dans le répertoire du
compose** », c'est-à-dire le dépôt entier puisque le nôtre est à la racine. Plus
utile encore : `dockhand` **contient déjà** la primitive juste —
`updateStackService()`, qui fait `docker compose up -d <service>` sans forcer —
et **personne ne l'appelle**. Le correctif chez eux tient en quelques lignes, ce
qui change ce qu'on peut raisonnablement leur demander.

**Cause** — l'analyse s'était arrêtée aux traces d'exécution et à la
documentation de l'outil, toutes deux suffisantes pour établir le symptôme et
sa cause immédiate. Elles ne disent pas ce que l'outil sait faire par ailleurs.
Un composant libre est lisible : ne pas le lire, c'est traiter comme une limite
ce qui n'est qu'un chemin non câblé.

**Detecte par** — `auteur`

**Action** — `comportement` — devant un défaut d'un composant libre, lire son
code avant de conclure à une limite : le clone est gratuit, et il change la
liste des issues possibles.

### 2. Le levier existait, la porte de service interdisait de l'actionner

**Symptome** — l'API de `dockhand` sait recréer **un** conteneur en gardant tous
ses réglages, et c'est exactement la livraison unitaire cherchée. Elle est
pourtant inatteignable depuis la CI : le routeur Traefik qui expose `/api` sans
authentification est restreint à la méthode `GET`, et c'est cette restriction —
et elle seule — qui rend le jeton d'API inoffensif s'il fuit.

**Cause** — la porte de service a été taillée pour un besoin de lecture, le seul
qui existait alors. Elle n'a pas de réglage plus fin que la méthode HTTP : elle
ouvre tout `GET` ou rien.

**Detecte par** — `auteur`

**Action** — `arbitrage` — soumis à l'utilisateur avec son coût : entrouvrir la
porte sur trois chemins précis, ou éclater la stack en une pile par app. Choix
retenu : entrouvrir, ce qui déplace un peu le verrou et se referme en une ligne.

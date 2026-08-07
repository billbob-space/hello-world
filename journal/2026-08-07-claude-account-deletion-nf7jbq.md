# 2026-08-07 — claude/account-deletion-nf7jbq

Branche : `claude/account-deletion-nf7jbq`
Périmètre : `marcq-handball`
Mode : `chaud`

## Anomalies

### 1. Un bouton nommé par sa raison, et non par son effet, est introuvable

**Symptome** — un parent, après mise en ligne : *« j'ai déjà fait une boulette en
allant voir depuis mon téléphone et en créant un compte pour Charlie que je
n'arrive plus à supprimer pour qu'il me fasse lui-même de son tél »*.

Le geste qu'il cherchait existait : « Changer d'enfant », dans les réglages. Il
efface le prénom, la progression et la clé du classement. Personne ne va le
chercher sous ce nom-là — il désigne une **situation** (un frère, une sœur, un
téléphone partagé), pas une action. Un parent qui veut effacer un profil créé par
erreur n'est dans aucune de ces trois situations, donc n'ouvre pas ce bouton.

**Cause** — le nom vient du § 7.2 du PRD, qui décrivait le geste par son cas
d'usage. Le PRD a raison de raisonner en parcours ; c'est l'**étiquette du
bouton** qui n'avait pas à recopier le vocabulaire du parcours. Une étiquette
répond à « qu'est-ce que ça fait ? », un parcours à « pourquoi je suis là ? », et
les deux ne se rédigent pas pareil.

**Detecte par** — `utilisateur`

**Action** — `rien` — réparé par le renommage. Aucun garde-fou ne juge un
libellé, et l'inventer coûterait plus que le défaut.

### 2. Le geste effaçait la clé qui commandait ce qu'il laissait en ligne

**Symptome** — « Changer d'enfant » efface la clé locale du classement, donc le
**code**, mais ne touche pas au serveur : le nom restait au classement, visible
par tous, et plus personne — pas même celui qui l'avait créé — ne pouvait le
retirer. Le produit fabriquait ainsi lui-même l'état dont le parent se plaignait.

Le geste **l'annonçait** : *« Ton nom au classement restera visible, et plus
personne ne pourra le supprimer. Supprime-le d'abord si tu ne veux pas le
laisser. »* La phrase était exacte, et c'est ce qui l'a rendue rassurante : elle
avait l'air d'un garde-fou. Une phrase qui décrit une impasse à celui qui va y
entrer n'en est pas un — c'est la documentation du défaut, et elle a servi
d'excuse à ne pas le corriger.

**Cause** — le geste a été écrit quand rien du produit ne vivait sur le serveur.
Le classement est arrivé au lot 2 et a ajouté une **seconde moitié** au profil ;
les deux gestes destructeurs existants n'ont pas été rejugés à ce moment-là. Le
tort n'est pas d'avoir oublié une ligne, c'est de n'avoir pas relu les gestes
destructeurs quand la surface qu'ils détruisent a changé de nature.

**Detecte par** — `utilisateur`

**Action** — `comportement` — quand une app gagne un état côté serveur, relire
ses gestes destructeurs existants fait partie du lot, au même titre que ses
écrans de lecture. Rien à outiller : la question tient en une ligne — *ce bouton
efface-t-il encore tout ce qu'il prétend effacer ?*

### 3. Un premier correctif livré, puis annulé — la solution ne visait pas la cause

**Symptome** — le premier jet ajoutait un écran où l'on retape un nom et son code
pour retirer une fiche que ce téléphone ne porte pas. Correct, testé, poussé,
puis annulé sur demande : *« pour moi c'est le bouton changer d'enfant qui
devrait s'appeler supprimer mon profil »*. Deux commits et onze tests jetés.

**Cause** — le symptôme rapporté — *« je n'arrive plus à supprimer »* — a été lu
comme *« il manque un chemin »*, alors qu'il disait *« le chemin existant ne se
trouve pas et ne finit pas le travail »*. Ajouter un troisième geste de sortie à
un produit dont le défaut était que ses deux gestes existants ne se distinguaient
pas aggravait la cause en traitant l'effet.

Le questionnement l'avait pourtant effleuré : la question posée listait « il ne
trouve pas le bouton » parmi les cas possibles, et la réponse fut « je ne sais
pas — couvre les trois ». Trois cas couverts par une seule solution, c'est le
signe qu'aucun n'a été diagnostiqué. **Une hypothèse retenue par défaut n'est pas
une hypothèse.** Il fallait relire les gestes existants avant d'en proposer un
neuf — la relecture qui a produit le bon correctif a pris dix minutes, après
coup.

**Detecte par** — `utilisateur`

**Action** — `comportement` — devant une demande d'ajout née d'un usage réel,
inventorier d'abord ce qui existe déjà pour la couvrir, et pourquoi ça n'a pas
suffi. « Ajouter » est le réflexe le plus cher : il double la surface, et il
laisse en place la chose qui n'allait pas.

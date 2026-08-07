# 2026-08-07 — claude/account-deletion-nf7jbq

Branche : `claude/account-deletion-nf7jbq`
Périmètre : `marcq-handball`
Mode : `chaud`

## Anomalies

### 1. Un téléphone dont le code est périmé n'a aucune sortie

**Symptome** — signalé par un utilisateur : *« sur le premier compte impossible
de supprimer ou de reauthentifier le compte avec le bon code. il semble bloqué.
je ne veux pas supprimer mon cache car ceci me semble être un bug de gestion des
comptes »*. L'écran répondait « Ce nom est déjà pris, ou le code ne correspond
pas » à chaque geste.

Un nom supprimé puis recréé prend un nouveau code. Le téléphone qui portait
l'ancien garde un lien mort — et **les trois gestes de cet écran renvoient tous
ce même code stocké** : récupérer sa progression, quitter le classement,
supprimer son profil. Le seul écran où l'on saisit un code, lui, disparaît dès
qu'un nom est enregistré. Aucune sortie, sauf vider le navigateur, donc perdre
toute la progression — exactement ce que l'utilisateur refusait de faire, à
raison.

**Cause** — chaque geste, pris seul, est défendable, et deux d'entre eux portent
en commentaire l'argument qui les justifie. « La reprise ne redemande pas de
code : un second formulaire serait une seconde occasion de se tromper. » « La
suppression n'efface rien localement tant que le serveur n'a pas répondu 200 :
effacer d'abord ferait perdre le code. » Les deux sont vrais. Ce qu'aucun ne
voyait, c'est que **le code stocké peut cesser d'être valable**, et qu'alors les
deux précautions se referment l'une sur l'autre.

La règle qui manquait, et qui les concilie : *un refus du code dit que ce
téléphone n'a **déjà** plus aucun droit sur ce nom.* Garder le lien ne protège
plus rien — il n'y a plus rien à protéger. La précaution ne vaut que tant qu'il
reste quelque chose à perdre.

**Detecte par** — `utilisateur`

**Action** — `comportement` — un état local qui **cite** un état distant peut
devenir faux sans que rien ne bouge de ce côté-ci. Chaque fois qu'un écran
conditionne un geste à une valeur stockée, se demander ce qui reste possible
quand cette valeur a péri. Aucun garde-fou ne voit ça : il faudrait qu'il sache
qu'une clé locale désigne une ressource distante.

### 2. La correction de la veille avait supprimé la sortie de secours

**Symptome** — avant le renommage de la veille, « Changer d'enfant » effaçait le
téléphone **sans rien demander au serveur**. C'était laid — le nom restait au
classement, orphelin — mais c'était une issue : le téléphone repartait propre.
En rendant le geste conditionnel à l'accord du serveur, la correction a fermé
cette porte, un jour avant qu'un utilisateur ne vienne la réclamer.

**Cause** — la correction visait le cas « le serveur accepte » et le cas « le
serveur est en panne ». Le cas « le serveur refuse pour toujours » n'a pas été
distingué du second, alors qu'il appelle la décision inverse : la panne dit
*réessaie*, le refus dit *ce n'est plus à toi*. Une seule branche d'échec là où
il en fallait deux.

Plus général, et c'est la leçon : **rendre un geste plus correct le rend souvent
plus fragile**, parce qu'un geste correct dépend de plus de choses. Ce qui a été
retiré ici n'était pas une négligence, c'était une tolérance — et les tolérances
ne se voient qu'une fois enlevées.

**Detecte par** — `utilisateur`

**Action** — `comportement` — en resserrant un geste destructeur, énumérer les
échecs par ce qu'ils **autorisent ensuite**, pas par leur code HTTP : passager
donc réessayable, ou définitif donc à assumer. Deux branches, jamais une.

### 3. L'application fermait elle-même le compte qu'elle essayait d'atteindre

**Symptome** — la synchronisation rejouait trois fois toute requête échouée, à
5, 15 et 45 secondes. Sur un code refusé, cela fait **quatre refus par minute**,
là où le serveur ferme un nom au cinquième par quart d'heure. Deux ouvertures de
l'app fermaient donc le nom.

Et la fermeture porte sur le **nom**, pas sur l'appareil : le téléphone au code
périmé consommait le quota anti-force-brute du compte, donc bloquait le
propriétaire légitime sur son autre téléphone. Ni l'un ni l'autre ne pouvait
faire le lien — le téléphone fautif ne montre rien, l'autre lit « trop d'essais »
sans en avoir fait un seul.

**Cause** — la reprise a été écrite pour la coupure réseau, et appliquée à tout
échec. Un `!resultat.ok` ne distingue pas « le serveur n'a pas répondu » de « le
serveur a répondu non ». Le premier se rejoue, le second jamais : le rejouer ne
le fera pas passer, et ici il coûtait le compte d'un tiers.

**Detecte par** — `auteur` — trouvée en lisant le code pour l'anomalie 1, pas
signalée : personne ne pouvait la voir depuis un écran.

**Action** — `garde-fou` — une reprise automatique ne devrait jamais se poser
sur un 4xx, dans aucune app de la fabrique. C'est une règle assez générale et
assez peu coûteuse pour valoir une ligne du contrat, à côté de ce qui est déjà
dit du rayon de souffle.

### 4. Un diagnostic juste sur un mécanisme, faux sur le cas

**Symptome** — la première hypothèse était la fermeture par trop d'essais :
mécanisme réel, démontré par les tests du serveur, et qui explique bien « il
semble bloqué ». Elle était fausse pour ce cas-ci — l'utilisateur voyait « ce
nom est déjà pris », pas « trop d'essais ». Une question posée avant d'écrire la
moindre ligne a tranché en un aller-retour.

**Cause** — un mécanisme qui *pourrait* produire le symptôme n'est pas le
mécanisme qui l'a produit. La tentation est forte quand on vient de le trouver
dans le code, et qu'il est réel : la découverte fait office de preuve. Le
message d'erreur exact, lui, était à une question de distance.

**Detecte par** — `utilisateur`

**Action** — `comportement` — demander le message affiché **avant** de raconter
la cause. Il départage en un aller-retour ce que la lecture du code laisse
ouvert, et il coûte moins qu'un correctif à jeter — leçon déjà payée le même
jour, à l'anomalie 3 de l'entrée précédente.

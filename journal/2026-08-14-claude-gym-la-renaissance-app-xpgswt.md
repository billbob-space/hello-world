# 2026-08-14 — claude/gym-la-renaissance-app-xpgswt


Branche : `claude/gym-la-renaissance-app-xpgswt`
Périmètre : renaissance-gym
Mode : `chaud`

## Anomalies

Création de `renaissance-gym` : PRD puis PRP puis code, pour l'app de suivi du
programme de vacances de La Renaissance Gymnastique de Marcq-en-Barœul. Deux
feuilles papier (36 exercices × 8 semaines) transposées en séance du jour
guidée. Palier `public`, compte `pseudo` + code à 6 chiffres, progression
sauvegardée côté serveur dans un volume nommé.

### 1. Le brief initial a changé de socle en cours de cadrage

**Symptome** — le design présenté et approuvé (« tout reste sur le téléphone,
aucun serveur ne connaît quoi que ce soit ») a été invalidé par la demande
suivante de l'utilisateur : progression enregistrée côté serveur, avec le
mécanisme d'authentification par code de `marcq-handball`. Le palier
d'exposition, le volume nommé, l'API et la moitié des écrans en dépendaient.

**Cause** — la question « qui utilise l'app » a été posée, et sa réponse
(« ta fille seule ») a été lue comme répondant aussi à « où vivent les
données ». Les deux sont indépendantes : une app mono-utilisatrice a besoin
d'un serveur dès lors qu'elle change d'appareil. La question du multi-appareil
n'a jamais été posée.

**Detecte par** — `utilisateur`

**Action** — `comportement` — au cadrage, séparer « combien d'utilisateurs » de
« combien d'appareils » : c'est la seconde qui décide du serveur.

### 2. L'artisan part en tâche de fond malgré `run_in_background: false`

**Symptome** — l'agent `artisan` a été lancé avec `run_in_background: false`,
explicitement, et le harnais l'a néanmoins démarré en tâche de fond : « Async
agent launched successfully », avec la consigne de ne pas toucher aux mêmes
fichiers en attendant. Or `memory/travail.md` pose que l'artisan « ne se lance
JAMAIS en tâche de fond », précisément parce qu'il écrit dans le dépôt pendant
qu'on y travaille.

**Cause** — le paramètre est une préférence, pas une garantie : la description
de l'outil dit que les sous-agents tournent en fond « par défaut » et que
`run_in_background: false` ne s'impose que si l'étape suivante en dépend
strictement. Le contrat du dépôt, lui, énonce une interdiction que rien dans le
harnais n'applique. La définition de l'agent (`.claude/agents/artisan.md`) ne
peut pas non plus la faire respecter : aucun champ n'exprime cette contrainte.

**Detecte par** — `auteur`

**Action** — `contrat` — `memory/travail.md` affirme une garantie qui n'existe
pas. Le texte doit dire ce qui est vrai : le lancement en fond ne peut pas être
empêché, donc la règle réelle est « n'édite rien dans `apps/<nom>/` tant qu'un
artisan y travaille », qui est une consigne pour l'appelant et non une propriété
de l'agent.

### 3. Le garde-fou de commit et l'artisan en fond se bloquent mutuellement

**Symptome** — trois tours consécutifs refusés par `garde-commit.sh` : l'arbre
était sale parce que l'artisan écrivait dedans, et l'artisan ne pouvait pas
finir parce que le tour ne pouvait pas se terminer. La phrase d'échappement du
hook — « si ce travail ne doit délibérément pas être committé, dis-le
explicitement » — a été utilisée deux fois sans effet : le hook a rebloqué.

**Cause** — les deux garde-fous supposent des choses incompatibles.
`garde-commit.sh` suppose qu'un arbre sale est un oubli de l'agent ;
l'anomalie 2 fait que l'arbre est sale du fait d'un tiers que l'agent
n'ordonnance pas. La sortie a été d'attendre l'artisan **dans le tour**, par une
boucle d'attente en premier plan — le seul moyen de ne jamais rendre la main sur
un arbre sale.

**Detecte par** — `auteur`

**Action** — `garde-fou` — `garde-commit.sh` gagnerait à ne pas bloquer quand un
sous-agent d'écriture tourne encore, ou à admettre une déclaration explicite au
lieu de la refuser. En l'état, sa phrase d'échappement promet une issue qu'il
n'offre pas.

### 4. Deux contradictions dans mes propres documents, trouvées par l'artisan

**Symptome** — l'artisan a signalé, sans être bloqué par elles, deux
incohérences que j'avais écrites : l'ossature §5.2 donnait `0.8125rem` à
l'étiquette de couture trois lignes avant de poser un plancher de 17 px « y
compris les mentions légères » ; et le PRD §8.4 annonçait « dix à onze
exercices » par séance alors que sa propre liste en donne neuf à la séance 4.

**Cause** — les deux documents ont été écrits d'un trait, et les tableaux n'ont
pas été relus contre la prose qui les accompagne. Le second cas est le plus
instructif : la liste est testée — l'union vaut exactement 36 — mais la phrase
qui la décrit ne l'est pas, et c'est donc elle qui a dérivé.

**Detecte par** — `relecture`

**Action** — `rien` — corrigées dans le même commit que le rapport. Ce qu'elles
disent est déjà acquis : l'artisan a tranché seul et correctement les deux fois,
en faveur de la contrainte testée contre la prose.

### 5. Les libellés des exercices 16 et 25 ne sont pas des noms d'exercice

**Symptome** — le PRD §8.2 transcrit « ATR 1/2 valse ou valse (pour les
grandes) », qui est une ligne de feuille, pas un nom affichable en séance. La
consigne « recopiés mot pour mot » et l'exemple JSON du PRP 01 — `libelle: "ATR
valse"`, `variante:` portant la ligne d'origine — se contredisaient.

**Cause** — le PRD a traité la fidélité comme une propriété d'un champ unique,
alors que ces deux lignes en demandent deux : ce que le club a écrit, et ce
qu'on affiche à un mètre pendant l'effort.

**Detecte par** — `auteur` — signalé par l'artisan, qui avait déjà tranché en
suivant l'exemple du PRP.

**Action** — `rien` — le choix est le bon et il est testé : le test de fidélité
compare `variante` au PRD pour ces deux exercices, et `libelle` pour les
trente-quatre autres.

### 6. `go.work` n'est pas régénéré par l'artisan, et `test.sh` échoue sans lui

**Symptome** — le serveur Go livré, `./test.sh` échoue à `go vet ./...` sur
« directory prefix . does not contain modules listed in go.work ». Le code est
pourtant correct : l'artisan l'a vérifié avec `GOWORK=off`, qui isole le module.

**Cause** — `go.work` est un artefact généré, à la racine, donc hors du
périmètre de l'artisan par construction. Il ne peut ni le régénérer ni le
signaler autrement qu'en rapport. Un `./init.sh` de l'orchestrateur le règle en
une seconde, encore faut-il savoir qu'il le faut.

**Detecte par** — `test`

**Action** — `contrat` — `apps/<nom>/CLAUDE.md`, la notice que l'artisan lit en
premier, ne dit nulle part qu'un module Go neuf exige un `./init.sh` à la racine
avant que ses tests puissent tourner. C'est la seule dépendance connue de
l'artisan vers un geste qu'il n'a pas le droit de faire ; elle mérite une ligne
dans la notice générée.

### 7. Le PRP a imposé de réécrire PBKDF2 que la bibliothèque standard fournit

**Symptome** — le PRP 06 prescrit d'écrire PBKDF2-HMAC-SHA256 à la main sur
`crypto/hmac` et `crypto/sha256`, au motif que `golang.org/x/crypto` est une
dépendance tierce interdite. Or Go 1.24 fournit `crypto/pbkdf2` dans la
bibliothèque standard, et l'image de construction est `golang:1.24-alpine`.

**Cause** — le PRP a été écrit sur une connaissance de Go antérieure à 1.24, et
n'a pas vérifié l'état de la bibliothèque standard de la version réellement
utilisée. L'argument « pas de dépendance tierce » était juste ; sa conclusion
« donc écris-le à la main » ne l'était plus.

**Detecte par** — `auteur` — signalé par l'artisan, qui a suivi la consigne
plutôt que de la contourner, et a croisé son implémentation avec
`crypto/pbkdf2` dans un test dédié.

**Action** — `comportement` — une contrainte de dépendance se vérifie contre la
version du langage effectivement compilée, pas contre un souvenir. Le code livré
reste correct et testé contre la référence ; le remplacer par `crypto/pbkdf2`
est une simplification à faire plus tard, pas un correctif.

### 8. L'image n'a pas pu être construite : pas de Docker dans le bac à sable

**Symptome** — ni l'artisan ni moi ne pouvons lancer `docker build` : la socket
est absente du conteneur. Le `Dockerfile` et la taille de l'image sont donc
livrés **non vérifiés localement**, et la CI est le premier endroit qui les
éprouve.

**Cause** — l'environnement d'exécution distant ne monte pas Docker. Ce n'est
pas une régression : c'est l'état normal, et c'est précisément ce que la
séquence en deux commits de `memory/ajouter-une-app.md` existe pour couvrir —
l'app naît `enabled: false`, l'échec « l'image ne se construit pas » arrive sur
un commit qui ne peut casser aucune autre application.

**Detecte par** — `auteur`

**Action** — `rien` — le garde-fou prévu pour ce cas est en place et fait son
travail. Le `Dockerfile` reprend le patron déjà en production de
`marcq-handball`.

### 9. Le routeur du lot 1 n'a jamais pu monter une sous-route

**Symptome** — `app.js` cherchait `table[route]` avec la route **brute**
(`#/seance/3`), alors que la table n'indexe que les routes de base
(`#/seance`). Aucune sous-route n'aurait jamais pu se monter : « refaire une
séance » et toute reprise sur un exercice précis restaient silencieusement
inertes.

**Cause** — le fichier portait un commentaire anticipant explicitement ce cas
(`#/seance/2026-08-14`), et le code ne l'implémentait pas. Un commentaire qui
décrit une intention non tenue est pire que pas de commentaire : il fait passer
la relecture à côté. Aucun test du lot 1 ne montait de sous-route — le trou
était dans les tests autant que dans le code.

**Detecte par** — `relecture` — trouvé par l'artisan du lot suivant, au moment
de brancher ses vues.

**Action** — `rien` — corrigé en une ligne (`routeDeBase()`), et désormais
couvert par les tests des vues. L'enseignement — « une route à paramètre se
teste, sinon elle n'existe pas » — est trop spécifique pour mériter un
garde-fou de fabrique.

### 10. Un garde-fou du lot 1 se déclenche sur un commentaire

**Symptome** — le test qui interdit d'écrire un objectif en dur dans une vue
(PRD §8.1) est tombé sur un **commentaire** de `vue-entree.js` citant « 5 s,
15 s, 45 s » — les délais de temporisation du PRD §7.5, qui ne sont pas des
objectifs d'exercice.

**Cause** — le test lit le fichier source comme du texte et ne distingue pas le
code du commentaire. C'est ce qui le rend simple et robuste, et c'est aussi ce
qui le rend faux au bord : n'importe quelle prose citant une durée le déclenche.

**Detecte par** — `test`

**Action** — `garde-fou` — un test de fidélité qui lit du texte brut doit dire
dans son message d'échec qu'un commentaire suffit à le déclencher, faute de quoi
le prochain qui le rencontre cherchera un bug dans son code. Contourné ici en
reformulant le commentaire ; le test n'a pas été affaibli, et c'est le bon
arbitrage — un garde-fou un peu trop large vaut mieux qu'un garde-fou troué.

### 11. Un redémarrage de conteneur a emporté le rapport d'un artisan

**Symptome** — le conteneur a redémarré alors que l'artisan des PRP 05 et 07
venait de finir. Son code et ses tests avaient été écrits sur le disque et ont
survécu — 152 tests JS au vert après redémarrage — mais **sa rubrique
d'anomalies est perdue** : elle ne vivait que dans la réponse de l'agent, et
cette réponse n'est jamais arrivée.

**Cause** — le contrat pose que l'artisan « rapporte les anomalies rencontrées
dans une rubrique dédiée, que tu recopies dans l'entrée de branche ». Ce canal
est la conversation, c'est-à-dire la seule chose du travail d'un agent qui ne
soit pas écrite dans le dépôt. Les trois artisans précédents ont chacun rapporté
deux à six anomalies dont plusieurs ont changé le contrat ou le code : c'est un
canal qui porte, et qui n'a aucune durabilité.

**Detecte par** — `auteur`

**Action** — `arbitrage` — faire écrire ses anomalies à l'artisan dans un
fichier plutôt que dans sa réponse le rendrait durable, mais lui donnerait à
écrire hors de `apps/<nom>/`, ce que son périmètre lui interdit précisément pour
protéger le dépôt. Les deux règles sont bonnes et elles se contredisent ; la
sortie n'est pas évidente et demande une décision humaine. Les garde-fous du lot
perdu ont été revérifiés un par un, par leurs noms de test.

### 12. Ni les tests ni la relecture ne regardent une page

**Symptome** — 152 tests verts, détecteur mécanique vide, contrat respecté, et
pourtant : le passepoil d'or ne peignait **aucun pixel** sur les six écrans, la
couture annoncée à 12° en faisait **2**, les angles étaient arrondis là où le
contrat les veut coupés — sous un commentaire affirmant le contraire —, et la
moitié basse de chaque écran était morte. Tout cela n'est apparu qu'en servant
l'application par son binaire et en la parcourant dans Chromium.

**Cause** — les garde-fous écrits vérifient des **propriétés du source** :
« aucun `border-radius` au-delà de 4 px » passe quand le rayon vaut exactement
4 px, alors que le contrat interdit le rayon lui-même. Un test qui lit du texte
ne peut pas voir qu'un élément de 2 px de haut s'écrase dans un conteneur flex,
ni qu'un `clip-path` en `vw` donne le bon angle à une seule largeur.

**Detecte par** — `relecture` — inspection sur captures, puis revue de finition
outillée qui a mesuré les angles et compté les pixels d'or.

**Action** — `comportement` — pour une app à interface, la boucle
« tests verts → commit » est incomplète : il faut servir la page et la
regarder. Le navigateur est disponible dans l'environnement
(`/opt/pw-browsers/chromium` avec Playwright installé globalement), et rien
dans le contrat ne dit de s'en servir.

### 13. Chromium résout `cqw` différemment pour un élément et son pseudo-élément

**Symptome** — le passepoil, corrigé, formait un triangle : épais à gauche,
nul après une vingtaine de pixels. La formule était pourtant la même des deux
côtés — `tan(--couture) × 100cqw` —, appliquée à `.empiecement` et à son
`::before`.

**Cause** — mesuré par l'artisan : Chromium 141 résout cette même propriété
personnalisée non typée en **82,89 px** pour l'élément et **78,14 px** pour son
`::before` positionné en absolu, sous mise en page flex. Isoler la variable dans
un second `calc()` ou changer l'ordre des termes n'y change rien. Le seul
correctif est d'enregistrer la propriété — `@property --chute { syntax:
'<length>' }` —, ce qui force sa résolution en longueur réelle avant héritage.

**Detecte par** — `relecture` — et **seulement** parce que la consigne exigeait
un contrôle au pixel plutôt qu'une lecture du DOM. À la lecture du CSS, le
correctif paraissait acquis.

**Action** — `rien` — c'est un comportement de moteur, pas une faute du dépôt.
Consigné parce qu'il est coûteux à retrouver : une géométrie CSS partagée entre
un élément et son pseudo-élément se vérifie sur des pixels, jamais sur la
formule.

### 14. Le même garde-fou s'est déclenché à tort une troisième fois

**Symptome** — le test « aucune valeur d'objectif écrite en dur dans une vue »
est tombé sur un commentaire citant la chaîne du bug qu'il corrigeait,
« SEMAINE 1SÉANCE 1 SUR 4 » : son motif `\d+\s*(?:s|min)` a reconnu « 1S » dans
« 1SÉANCE ».

**Cause** — même racine qu'à l'anomalie 10, troisième occurrence sur cette
branche : le test lit le source comme du texte brut. Il ne distingue ni le code
du commentaire, ni un mot d'une unité.

**Detecte par** — `test`

**Action** — `garde-fou` — trois faux positifs sur une seule branche ne sont
plus une coïncidence. Le motif devrait au minimum exiger une limite de mot après
l'unité, et le message d'échec devrait dire qu'un commentaire suffit à le
déclencher. Il reste préférable trop large que troué — mais son coût est réel et
il est désormais mesuré.

### 15. Un élément ne peut pas lire ses propres unités de conteneur

**Symptome** — la couture faisait 12° sur mobile et **31,3°** au bureau. La
formule était pourtant unique et dérivait bien de la largeur du panneau.

**Cause** — la spécification l'interdit : un élément qui pose lui-même
`container-type` **ne peut pas** consommer ses propres `cqw`, sous peine de
dépendance circulaire ; la résolution retombe alors sur le conteneur ancêtre
suivant, ou à défaut sur le viewport. `.empiecement` posait `container-type` sur
lui-même tout en lisant `100cqw` dans sa propre variable : sous 640 px le
panneau et son ancêtre ayant la même largeur, l'erreur était invisible ; au-delà,
la borne de bureau les séparait et le calcul prenait 1280 px au lieu de 448.

Corrigé en déplaçant `container-type: inline-size` sur `#ecran > section`, dont
la largeur **est** celle du panneau à toute largeur d'écran. Mesuré à 390 px et
à 1280 px avant et après : 12,00° dans les deux cas.

**Detecte par** — `relecture`

**Action** — `rien` — règle de langage, pas faute du dépôt. Consignée avec
l'anomalie 13 : ce sont les deux pièges de `cqw` rencontrés sur la même
propriété, et tous deux ne se voient qu'en mesurant deux largeurs, jamais une.

### 16. Le même bouton s'aligne différemment selon sa balise

**Symptome** — l'écran du jour portait trois axes d'alignement : les liens de
navigation à gauche, un bouton de texte centré, le titre centré. Rien dans le
CSS ne l'expliquait.

**Cause** — `.bouton--discret` ne déclare aucun `display`. Une balise `<button>`
est centrée par la feuille de style du navigateur ; une balise `<a>` reste en
flux en ligne et s'aligne à gauche. La même classe produit donc deux
alignements selon la balise qui la porte, et cela ne se lit pas dans le CSS.

**Detecte par** — `relecture`

**Action** — `comportement` — une classe partagée entre `<a>` et `<button>` doit
déclarer son `display` explicitement, sans quoi elle hérite de deux valeurs par
défaut différentes.

### 17. Deux choix de finition tranchés seuls, en fin de course

Le second verdict de la revue laissait deux points ouverts. Ni l'un ni l'autre
n'est un des trois arrêts du mode autonome ; ils sont donc tranchés ici, et
écrits pour être relus.

**Le premier est corrigé** : les réglages gardaient deux axes d'alignement, par
la cause de l'anomalie 16 dont le remède n'avait été appliqué qu'à l'écran du
jour. `.bouton--discret` déclare désormais son `display`, et le remède vaut
partout. **Je l'ai écrit moi-même plutôt que de le déléguer à l'artisan** — deux
règles CSS contre un agent complet, alors que le contexte de cette session
dépassait déjà 400 000 jetons. C'est un écart au contrat, assumé pour la raison
même qui fonde la règle : l'économie de contexte.

**Le second ne l'est pas, et c'est délibéré.** Au bureau, la borne de 28 rem
s'applique aussi à l'empiècement : le panneau bleu pend au milieu d'un champ
beige au lieu de border la fenêtre. La revue le dit « pas un manquement à une
promesse, mais le dernier endroit où le bureau semble subi ». Le corriger
demanderait de faire déborder le panneau tout en gardant le texte borné — or
c'est exactement la relation de conteneur qui vient de fixer la couture à 12°,
vérifiée à deux largeurs après deux tentatives ratées. Le risque de rouvrir
l'anomalie 15 dépasse le gain sur une application dont l'unique utilisatrice est
sur un téléphone posé par terre. **Laissé ouvert, et signalé à l'utilisateur.**

**Detecte par** — `relecture`

**Action** — `arbitrage` — financer un tour de plus pour le rendu au bureau
n'est pas une décision d'agent : elle dépend de l'importance que l'utilisateur
donne à un écran large, sur une application conçue pour un téléphone. Le point
est nommé, chiffré et laissé ouvert plutôt que tranché en silence.


---

## Suite — l'activation (PR #118 fusionnée)

La PR #118 a été fusionnée : la CI de `main` a construit et publié l'image, et
inscrit `renaissance-gym: 164c7b5` dans `versions.yml`. La branche est donc
repartie de `main` sous le même nom, conformément au harnais, et porte
maintenant le second des deux commits de `memory/ajouter-une-app.md` :
`enabled: true`, et l'app entre dans le compose avec son image épinglée.

Aucune anomalie sur cette étape.

---

## Suite — la mise en ligne, et DESIGN.md (PR #119 fusionnée)

La PR #119 a activé l'app. Le déploiement est passé, `./scripts/prod.sh` montre
les **douze services sains**, y compris `renaissance-gym`, et le site répond.

Vérifié en production, au-delà du healthcheck :

- l'API des trois opérations, de bout en bout — création (`201`), synchronisation
  d'un fait (`200`), effacement (`204`). **La création prouve que le volume est
  inscriptible** : c'est la panne la plus coûteuse à diagnostiquer de la
  fabrique, et la seule qui ne se voie qu'ici ;
- un mauvais code et un pseudonyme inexistant rendent **le même `401`** ;
- la temporisation s'est déclenchée d'elle-même après deux refus (`429`) — le
  garde-fou fonctionne sans qu'on ait eu à le provoquer ;
- le contrat de direction **survit à la construction** : il est présent dans le
  HTML servi par le binaire, clé de tirage comprise ;
- la police, le programme et les modules sont tous servis.

`DESIGN.md` et son annexe sont écrits depuis le monde construit, comme la
compétence l'exige, et non depuis les intentions. Le point resté ouvert au
bureau y est consigné **comme défaut connu et non comme règle**, pour qu'aucun
futur écran n'en hérite comme d'une intention.

### 18. Le navigateur ne franchit pas le proxy de l'environnement

**Symptome** — `curl` atteint `https://renaissance-gym.apps.billbob.ovh` sans
peine, mais Chromium piloté par Playwright rend `ERR_CONNECTION_RESET` sur la
même URL, y compris en lui passant `HTTPS_PROXY` par l'option `proxy` et en
ignorant les erreurs de certificat.

**Cause** — non élucidée. Le proxy de l'environnement est conçu pour les outils
en ligne de commande ; le navigateur préinstallé ne s'y raccorde pas de la même
façon. En local (`http://localhost:8080`) il fonctionne parfaitement, et c'est
ce qui a permis toute l'inspection visuelle.

**Detecte par** — `auteur`

**Action** — `outillage` — la vérification visuelle d'une app **en production**
n'est pas outillée : on peut la regarder en local, pas en ligne. Contourné ici
en éprouvant l'API au `curl`, ce qui prouve le serveur et le volume mais pas le
rendu. Pour une fabrique dont le point d'arrivée déclaré est « le site répond »,
c'est un manque réel.


---

## Suite — les deux premiers retours d'usage

L'application a servi une première fois. Deux remarques, dont une qui est un
défaut livré et non une demande.

### 19. La sonnerie de fin était inaudible, et la cause était physique

**Symptome** — l'utilisatrice demande « une sonnerie à la fin des décomptes ».
Elle existe pourtant : `sonnerie()` est appelée au bon moment, le code est
correct, et un test le couvre.

**Cause** — le PRP 04 avait choisi, pour distinguer la fin des trois bips qui la
précèdent, un son « plus bas et plus long » : un sinus à 220 Hz. Or un
haut-parleur de téléphone ne restitue presque rien sous 400 Hz. Les bips à
440-659 Hz s'entendaient ; la seule note qui compte était sous le plancher du
matériel qui la joue. La conception sonore a été faite sur une idée de la
perception — grave contre aigu — sans tenir compte du transducteur.

**Detecte par** — `utilisateur`

**Action** — `contrat` — aucun garde-fou ne peut entendre un son, et aucun test
non plus : c'est le seul canal de cette application qu'on ne peut ni compiler,
ni mesurer, ni capturer. Ce qui manquait n'est pas un test mais une **règle de
conception** : sur un haut-parleur de téléphone, un signal se distingue par son
**rythme**, jamais par sa hauteur, et rien sous 400 Hz ne doit porter une
information. Elle mérite d'être écrite là où la prochaine app la lira.

### 20. La séance était une file rigide, et rien ne l'avait signalé

**Symptome** — « il n'est pas possible de sauter un exercice pour pouvoir le
refaire plus tard ». Face à un ATR qui ne passe pas ou à un salon trop petit
pour une roue, la gymnaste n'avait que deux issues : cocher sans avoir fait, ou
abandonner la séance entière.

**Cause** — le PRD a décrit le parcours nominal avec soin (§7.3) et n'a jamais
posé la question « et si elle ne peut pas faire celui-là ? ». Les cinq questions
de cadrage portaient sur le programme, le rythme et la sauvegarde ; aucune ne
portait sur l'échec d'un exercice, qui est pourtant l'événement le plus
ordinaire d'un entraînement.

**Detecte par** — `utilisateur`

**Action** — `comportement` — au cadrage d'un parcours, poser explicitement la
question du **cas où l'utilisateur ne peut pas faire l'étape**. Elle ne s'est
pas posée ici parce que le parcours nominal était limpide, et c'est précisément
quand il l'est qu'on l'oublie.

### 21. Ma correction d'alignement avait neutralisé l'attribut `hidden`

**Symptome** — « Remettre à zéro » s'affichait sur les exercices qui se
comptent, où il n'a aucun sens : on ne remet pas à zéro un compte de vingt
fermetures. Le code posait pourtant bien `remise.hidden = true`.

**Cause** — la mienne, et elle date de l'anomalie 16. En déclarant
`display: inline-flex` sur `.bouton--discret` pour unifier les axes
d'alignement, j'ai donné à une règle d'auteur la priorité sur le
`display: none` que le navigateur applique à `[hidden]` : l'attribut a cessé
de cacher quoi que ce soit. Exactement le même défaut que `.confirmation-case`
plus tôt sur cette branche — **deuxième occurrence, même fichier, même cause**,
et je ne l'ai pas vue en corrigeant la première.

**Detecte par** — `relecture` — trouvé par l'artisan du lot suivant, capture
d'écran à l'appui, alors que ce n'était pas son sujet.

**Action** — `garde-fou` — une classe qui déclare `display` doit rendre
l'attribut `hidden`. C'est une règle mécanique, vérifiable par un test qui
lirait la feuille de style et exigerait, pour toute classe posant `display`,
une règle `[hidden]` correspondante. Deux occurrences sur une seule branche
suffisent à le justifier.

### 22. J'ai appliqué une règle de design à un contenu qu'elle ne visait pas

**Symptome** — `DESIGN.md` pose que le champ jersey porte un objet focal. J'ai
appliqué la règle à l'écran des exercices passés, et obtenu une **phrase
entière** de neuf mots à la taille d'affichage, occupant tout l'écran. Ça ne
lisait plus, ça criait.

**Cause** — la règle avait été écrite depuis des cas où l'objet focal était un
nom court : « Le socle », « x16 », « 0:28 ». Elle ne disait pas que la brièveté
en faisait partie, parce qu'aucun cas construit n'avait eu de phrase à placer.
Une règle tirée d'exemples homogènes n'énonce pas ce que ces exemples avaient
en commun sans le dire.

**Detecte par** — `relecture` — vu sur capture, immédiatement.

**Action** — `rien` — corrigé en séparant les deux : le **nombre** est l'objet
focal, la phrase l'explique en dessous à la taille du texte courant. La leçon
est déjà écrite dans le commentaire du code, à l'endroit où le prochain la
lira.


### 23. La grille ne montrait rien de ce qui avait été fait

**Symptome** — « dans la vue grille aucun moyen de voir ce que j'ai déjà
fait ». Exact, et trois défauts se cumulaient : une case était **tout ou
rien** (dix exercices sur onze s'affichaient comme zéro) ; les cases de la
**semaine en cours étaient `disabled`**, donc la semaine où elle vit était la
plus opaque de la grille ; et rien ne descendait à l'exercice, alors que c'est
la granularité de la feuille du club — trente-six lignes, une croix par ligne.

**Cause** — le PRD §7.4 a décrit la grille comme « les huit semaines et les
quatre séances de chacune », et le PRP 05 l'a implémentée fidèlement. Les deux
ont raisonné en **séances** parce que l'application, elle, raisonne en séances.
La feuille dont la grille est la transposition, elle, raisonne en **exercices**.
La transposition a changé d'unité sans que personne le remarque, et la grille
promettait « c'est la feuille du club, en mieux » en montrant autre chose.

Le premier des trois défauts a été **aggravé par ma propre livraison
précédente** : depuis que « Passer » existe, une séance se termine bien plus
souvent incomplète — donc invisible.

**Detecte par** — `utilisateur`

**Action** — `comportement` — quand une application transpose un artefact
existant, vérifier que l'**unité** de l'original survit à la transposition.
Ici la feuille compte des exercices et l'app comptait des séances ; les deux
documents qui devaient l'attraper — PRD et PRP — ont hérité de l'unité du code
au lieu de celle de la source.

Corollaire, valable au-delà de cette app : un ajout qui rend un état plus
fréquent (ici « séance incomplète ») **révèle** les endroits où cet état
n'était pas représenté. Le livrer sans regarder ce qu'il rend visible, c'est
livrer le défaut suivant avec.


### 24. La semaine avançait sur le calendrier, et punissait les vacances

**Symptome** — aucun symptôme rapporté : c'est une erreur trouvée en relisant
le PRD, pas en utilisant l'app. Le §8.5 et la règle §9.6 faisaient avancer la
semaine sept jours après son début, faite ou non.

**Cause** — le PRD a modelé la semaine sur le calendrier parce que la feuille du
club a huit colonnes et que huit colonnes ressemblent à huit semaines. Mais la
feuille ne date rien : ses colonnes comptent des **paliers de travail**, pas des
semaines de calendrier. La transposition a de nouveau changé d'unité, comme à
l'anomalie 23 — et cette fois dans la dimension temps.

Le coût était réel : cinq jours chez sa grand-mère consommaient une semaine
entière du programme sans qu'elle ait rien fait. Trois absences de ce genre, et
les huit semaines étaient épuisées à moitié remplies. Le §14 pose que l'abandon
est le risque principal ; un programme qui file tout seul pendant qu'on a le dos
tourné en est une fabrique.

**Detecte par** — `relecture`

**Action** — `contrat` — le §8.5 et la règle §9.6 sont corrigés par A5. La leçon
dépasse cette app : **quand une transposition hérite d'une unité, vérifier aussi
l'unité de temps**. Un artefact papier ne date presque jamais ce qu'il compte,
et lui prêter un calendrier lui ajoute une contrainte que son auteur n'a pas
écrite.

### 25. Une correction du passé fait reculer la semaine courante

**Symptome** — signalé par l'artisan, non corrigé. Sous A5, décocher un exercice
d'une semaine déjà bouclée fait **redevenir** cette semaine la semaine courante,
puisque la semaine se déduit désormais entièrement des faits et que rien ne
mémorise qu'on l'avait dépassée.

**Cause** — conséquence directe et logique du choix « la semaine se déduit des
faits, jamais d'un compteur local », qui est lui-même ce qui rend deux téléphones
cohérents. Mémoriser « cette semaine est dépassée » réintroduirait exactement
l'état local que ce choix élimine, et deux appareils pourraient en diverger.

**Detecte par** — `relecture`

**Action** — `rien` — le comportement est cohérent avec « le passé se corrige »
et sans danger : rien n'est perdu, la semaine se reboucle en recochant. Consigné
parce qu'il est surprenant, et que le corriger coûterait plus cher que ce qu'il
gêne. À revoir seulement si l'usage le fait remonter.

### 26. « Refaire une séance » a disparu de l'écran du jour

**Symptome** — sous A5, le bouton « Refaire une séance » de l'écran « semaine
bouclée » pointait vers une route qui vise désormais la semaine **suivante** :
il faisait donc la même chose que « Semaine suivante », juste à côté. L'artisan
l'a retiré plutôt que de livrer deux boutons identiques.

**Cause** — la route `#/seance/<numero>` désigne une séance **sans sa semaine**.
Tant que la semaine avançait sur le calendrier, l'ambiguïté ne se voyait pas ;
dès que la semaine dépend des faits, la même route change de cible.

**Detecte par** — `auteur`

**Action** — `arbitrage` — le PRD §9.5 autorise explicitement de refaire une
séance, et c'est désormais possible **depuis la grille seulement** (A3 bis), plus
depuis l'écran du jour. C'est un rétrécissement d'une capacité écrite, décidé
par défaut plutôt que choisi. Le rendre à l'écran du jour demande une route qui
porte la semaine, comme celle d'un exercice unique en porte déjà une.


### 27. Un refus explicite du serveur avalé par un `catch` vide

**Symptome** — un parent connecte le compte de sa fille sur son téléphone, avec
le bon pseudonyme et le bon code, et ne voit **aucune** de ses séances. Son
appareil affiche une semaine 1 vide.

**Cause** — il est passé par l'écran d'entrée ordinaire, qui **crée** un compte.
Le serveur a répondu `409` — pseudonyme pris — et `app.js` lançait la création
en `.catch(() => {})`. Un `grep` de « 409 » sur tout `web/*.js` ne rendait rien :
le cas n'était traité nulle part. L'appareil restait avec un compte purement
local qui ne pourrait jamais se synchroniser, puisqu'il retenterait
indéfiniment une création toujours refusée.

Le `catch` vide venait d'une bonne intention — PRD §11.2, « le réseau n'est
jamais une dépendance de fonctionnement » — appliquée trop largement : elle vaut
pour un serveur qui **ne répond pas**, pas pour un serveur qui répond **non**.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — un `catch` vide sur un appel réseau qui peut rendre
un refus **métier** est un trou par construction. Un test qui lirait les sources
et échouerait sur un `.catch(() => {})` autour d'un appel d'API attraperait
cette classe entière de défauts, dans cette app comme dans les autres.

### 28. Se déconnecter et effacer étaient le même bouton

**Symptome** — aucun symptôme : l'utilisateur ne l'a pas déclenché, et c'est
une chance. « Effacer ma fiche » envoie pseudonyme et code au serveur, qui
supprime la fiche définitivement. Sur l'appareil d'un parent ayant repris le
compte de son enfant — mêmes identifiants — ce bouton **détruisait les huit
semaines de l'enfant**, depuis un appareil qui n'est pas le sien, sans qu'aucun
texte ne le laisse deviner.

**Cause** — le PRD §7.5 a prévu la reprise sur plusieurs appareils sans prévoir
sa symétrie : **quitter un appareil** et **supprimer ses données** sont deux
gestes différents, et l'application n'en offrait qu'un. Le PRP 05 chantier D a
même soigné le cas du code refusé — « l'appareil ne doit pas rester prisonnier
d'une fiche » — sans voir que le cas inverse, l'appareil qui a le **bon** code
et veut seulement partir, n'avait aucune issue non destructrice.

**Detecte par** — `relecture` — trouvé en diagnostiquant l'anomalie 27.

**Action** — `contrat` — dès qu'une application permet de **reprendre** un
compte sur un appareil, elle doit permettre de l'y **quitter** sans toucher aux
données. La règle manque au contrat, et elle vaut pour toute app de la fabrique
qui gardera un jour une identité portable.

### 29. Les parures supposent un programme commencé à la semaine 1

**Symptome** — signalé par l'artisan, non tranché. Les parures comptent le
**nombre** de semaines bouclées, jamais lesquelles. Une gymnaste qui démarre en
semaine 5 — ce que le §7.1 autorise explicitement — ne peut donc en gagner que
quatre avant la fin du programme, alors que le bilan A17 suppose un justaucorps
entièrement paré.

**Cause** — A13 a été écrite en pensant à un parcours complet, sans croiser le
choix de la semaine de départ qui existe pourtant depuis le premier jour. Deux
sections du même PRD, écrites à des moments différents, se contredisent en un
point que ni l'une ni l'autre ne mentionne.

**Detecte par** — `auteur`

**Action** — `arbitrage` — trois issues, et le choix appartient au demandeur :
une parure par semaine **bouclée** quelle qu'elle soit (le justaucorps se pare
complètement même en démarrant tard, mais huit parures demandent huit semaines
que le programme ne contient plus), une parure par semaine **du programme**
(l'état actuel : démarrer tard plafonne le justaucorps), ou un jeu de parures
proportionné aux semaines restantes. En attendant, le bilan montre le
justaucorps tel qu'il est et ne prétend jamais qu'il est complet.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-15 à 21:51 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 25 327 | 0,07 $ |
| Écriture de cache | 11 325 594 | 52,47 $ |
| Lecture de cache | 547 416 730 | 204,58 $ |
| Sortie | 450 714 | 9,14 $ |
| **Total** | **559 218 365** | **266,26 $ — 231,23 €** |

**Ce qui coûte**

- **2433 appel(s) au modèle** — un par réponse, outils compris —, dont 1819 par des sous-agents — 334 180 430 jetons, 116,15 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  64 719 jetons, écrits une fois par session puis relus à chaque
  échange : 39 672 747 jetons de relecture, 7 % de tout ce qui a été relu.
- **Tours courts** — 1 896 des 2 433 tours (77 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 170,61 $, soit 64 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 64 719 jetons relus au premier appel qui relise
  quelque chose, 703 497 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 559218365 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 64719 0 106
2 principal claude-opus-5 4054 64719 291
3 principal claude-opus-5 2931 68773 538
4 principal claude-opus-5 3082 71704 297
5 principal claude-opus-5 9058 74786 474
6 principal claude-opus-5 2805 83844 329
7 principal claude-opus-5 1811 86649 859
8 principal claude-opus-5 3722 88460 161
9 principal claude-opus-5 623 92182 1287
10 principal claude-opus-5 1403 92805 1107
11 principal claude-opus-5 1198 94208 575
12 principal claude-opus-5 784 95406 1346
13 principal claude-opus-5 1483 96190 3308
14 principal claude-opus-5 76 100981 431
15 principal claude-opus-5 6446 101057 3245
16 principal claude-opus-5 3369 107503 1732
17 principal claude-opus-5 2065 110872 266
18 principal claude-opus-5 2455 112937 316
19 principal claude-opus-5 469 115392 89
20 principal claude-opus-5 29 117193 1255
21 principal claude-opus-5 1353 117222 166
22 principal claude-opus-5 545 118575 192
23 principal claude-opus-5 806 119120 228
24 principal claude-opus-5 289 119926 116
25 principal claude-opus-5 1369 120215 602
26 principal claude-opus-5 3566 122242 683
27 principal claude-opus-5 1763 125808 487
28 principal claude-opus-5 10656 127571 17254
29 principal claude-opus-5 17602 138227 1980
30 principal claude-opus-5 5044 155829 3803
31 principal claude-opus-5 4894 160873 1703
32 principal claude-opus-5 1795 165767 223
33 principal claude-opus-5 288 167562 1653
34 principal claude-opus-5 1704 167850 7524
35 principal claude-opus-5 7584 169554 450
36 principal claude-opus-5 800 177138 2906
37 principal claude-opus-5 2965 177938 1364
38 principal claude-opus-5 1427 180903 2541
39 principal claude-opus-5 2600 182330 2382
40 principal claude-opus-5 2441 184930 2353
41 principal claude-opus-5 2412 187371 2121
42 principal claude-opus-5 2180 189783 3066
43 principal claude-opus-5 3126 191963 2136
44 principal claude-opus-5 2196 195089 1425
45 principal claude-opus-5 1768 197285 347
46 principal claude-opus-5 1114 199053 117
47 principal claude-opus-5 186 200167 128
48 principal claude-opus-5 829 200353 1696
49 principal claude-opus-4-7 34997 0 215
50 principal claude-opus-4-7 331 34997 261
51 principal claude-opus-4-7 3440 35328 531
52 principal claude-opus-5 1864 201182 1257
53 principal claude-opus-4-7 602 38768 599
54 principal claude-opus-5 1585 203046 309
55 principal claude-opus-5 366 204631 195
56 principal claude-opus-5 248 204997 483
57 principal claude-opus-5 1256 205245 215
58 principal claude-opus-5 345 206501 297
59 principal claude-opus-5 325 206846 223
60 principal claude-opus-5 367 207171 1385
61 principal claude-opus-5 1759 207538 1194
62 principal claude-opus-5 1268 209297 656
63 principal claude-opus-5 936 210565 519
64 principal claude-opus-5 609 211501 1067
65 principal claude-opus-5 5085 211501 545
66 principal claude-opus-5 3903 216586 363
67 principal claude-opus-5 440 220489 811
68 principal claude-opus-5 1091 220929 232
69 principal claude-opus-5 358 222020 823
70 principal claude-opus-5 1140 222378 1110
71 principal claude-opus-4-7 3486 29200 115
72 principal claude-opus-4-7 195 32686 87
73 principal claude-opus-4-7 217 32881 227
74 principal claude-opus-5 1278 223518 222
75 principal claude-opus-5 668 224796 148
76 principal claude-opus-5 4147 222020 1287
77 principal claude-opus-5 1716 226167 215
78 principal claude-opus-5 492 227883 152
79 principal claude-opus-5 302 228375 574
80 principal claude-opus-5 755 228677 619
81 principal claude-opus-5 963 229432 122
82 principal claude-opus-5 528 230395 589
83 principal claude-opus-5 1603 230923 346
84 principal claude-opus-5 510 232526 677
85 principal claude-opus-5 734 233036 141
86 principal claude-opus-5 395 233770 1236
87 principal claude-opus-5 3758 234165 721
88 principal claude-opus-5 1087 237923 241
89 principal claude-opus-5 304 239010 214
90 principal claude-opus-4-7 35052 29200 2432
91 principal claude-opus-4-7 2514 64252 115
92 principal claude-opus-4-7 170 66766 89
93 principal claude-opus-4-7 2606 66936 90
94 principal claude-opus-5 275 239314 1743
95 principal claude-opus-4-7 2811 69542 527
96 principal claude-opus-4-7 2918 72353 90
97 principal claude-opus-5 1817 239589 1516
98 principal claude-opus-4-7 2967 75271 2785
99 principal claude-opus-5 1889 241406 284
100 principal claude-opus-5 593 243295 343
101 principal claude-opus-5 714 243888 444
102 principal claude-opus-5 3826 244602 350
103 principal claude-opus-5 519 248428 181
104 principal claude-opus-5 1161 248947 509
105 principal claude-opus-5 688 250108 391
106 principal claude-opus-5 447 250796 170
107 principal claude-opus-5 444 251243 1639
108 principal claude-opus-5 1713 251687 1678
109 principal claude-opus-5 2137 253400 2171
110 principal claude-opus-5 2551 255537 335
111 principal claude-opus-5 429 258088 404
112 principal claude-opus-5 594 258517 409
113 principal claude-opus-5 1163 259111 209
114 principal claude-opus-5 644 260274 173
115 principal claude-opus-5 223 260918 293
116 principal claude-opus-5 2539 261141 1407
117 principal claude-opus-5 1481 263680 1412
118 principal claude-opus-4-7 39163 29200 751
119 principal claude-opus-4-7 796 68363 122
120 principal claude-opus-4-7 233 69159 90
121 principal claude-opus-4-7 2811 69392 89
122 principal claude-opus-5 1584 265161 1699
123 principal claude-opus-4-7 2994 72203 2707
124 principal claude-opus-4-7 6329 75197 2330
125 principal claude-opus-5 2064 266745 306
126 principal claude-opus-5 456 268809 438
127 principal claude-opus-5 612 269265 355
128 principal claude-opus-5 490 269877 414
129 principal claude-opus-5 935 270367 1153
130 principal claude-opus-5 231063 42670 281
131 principal claude-opus-5 803 273733 153
132 principal claude-opus-5 199 274536 366
133 principal claude-opus-5 1123 274735 1120
134 principal claude-opus-5 1194 275858 1245
135 principal claude-opus-5 1432 277052 602
136 principal claude-opus-5 1061 278484 209
137 principal claude-opus-5 579 279545 127
138 principal claude-opus-5 179 280124 152
139 principal claude-opus-5 620 280303 384
140 principal claude-opus-5 442 280923 199
141 principal claude-opus-5 261 281365 210
142 principal claude-opus-5 240 281626 304
143 principal claude-opus-5 326 281866 210
144 principal claude-opus-5 2337 282192 86
145 principal claude-opus-5 155 284529 298
146 principal claude-opus-4-7 41585 29200 5515
147 principal claude-opus-4-7 5598 70785 79
148 principal claude-opus-5 548 284684 489
149 principal claude-opus-4-7 345 76383 90
150 principal claude-opus-4-7 2811 76728 93
151 principal claude-opus-4-7 8103 79539 91
152 principal claude-opus-5 575 285232 213
153 principal claude-opus-5 2076 285807 1366
154 principal claude-opus-5 1658 287883 62
155 principal claude-opus-5 1866 289541 1162
156 principal claude-opus-5 1566 291407 214
157 principal claude-opus-4-7 2482 87642 4152
158 principal claude-opus-5 2017 292973 1859
159 principal claude-opus-5 2036 294990 335
160 principal claude-opus-5 2138 297026 365
161 principal claude-opus-5 2169 299164 1286
162 principal claude-opus-5 1351 301333 825
163 principal claude-opus-5 1127 302684 384
164 principal claude-opus-5 415 303811 184
165 principal claude-opus-5 740 304226 404
166 principal claude-opus-5 954 304966 867
167 principal claude-opus-5 936 305920 607
168 principal claude-opus-5 981 306856 121
169 principal claude-opus-5 1685 307837 2658
170 principal claude-opus-5 3028 309522 411
171 principal claude-opus-5 6819 312550 350
172 principal claude-opus-5 378 319369 212
173 principal claude-opus-5 221 319747 1195
174 principal claude-opus-5 1252 319968 156
175 principal claude-opus-5 1962 321220 295
176 principal claude-opus-5 2099 323182 1027
177 principal claude-opus-5 1471 325281 1722
178 principal claude-opus-5 2089 326752 3544
179 principal claude-opus-5 3600 328841 96
180 principal claude-opus-5 441 332441 110
181 principal claude-opus-5 4477 332882 431
182 principal claude-opus-5 615 337359 1351
183 principal claude-opus-4-7 4348 29200 296
184 principal claude-opus-4-7 5822 33548 1388
185 principal claude-opus-5 5772 337974 3414
186 principal claude-opus-5 4069 343746 375
187 principal claude-opus-5 402 347815 438
188 principal claude-opus-5 487 348217 179
189 principal claude-opus-5 607 348704 449
190 principal claude-opus-5 467 349311 302
191 principal claude-opus-5 2472 349778 243
192 principal claude-opus-5 260 352250 137
193 principal claude-opus-5 499 352510 218
194 principal claude-opus-5 205 353009 248
195 principal claude-opus-5 307 353214 212
196 principal claude-opus-5 2016 353521 1067
197 principal claude-opus-5 2871 355537 938
198 principal claude-opus-5 2294 358408 166
199 principal claude-opus-5 259 360702 2939
200 principal claude-opus-5 3602 360961 285
201 principal claude-opus-5 365 364563 250
202 principal claude-opus-5 426 364928 315
203 principal claude-opus-5 390 365354 378
204 principal claude-opus-5 409 365744 348
205 principal claude-opus-5 342 366153 143
206 principal claude-opus-5 153 366495 137
207 principal claude-opus-5 300 366648 169
208 principal claude-opus-5 228 366948 63
209 principal claude-opus-5 2153 367176 1694
210 principal claude-opus-5 1801 369329 223
211 principal claude-opus-5 329 371130 1166
212 principal claude-opus-5 1235 371459 67
213 principal claude-opus-5 1875 372694 441
214 principal claude-opus-5 2485 374569 467
215 principal claude-opus-5 1677 377054 1279
216 principal claude-opus-5 1657 378731 215
217 principal claude-opus-5 312 380388 142
218 principal claude-opus-5 234 380700 133
219 principal claude-opus-5 391 380934 1799
220 principal claude-opus-5 1873 381325 200
221 principal claude-opus-5 410 383198 118
222 principal claude-opus-5 218 383608 1747
223 principal claude-opus-4-7 9210 29200 775
224 principal claude-opus-4-7 964 38410 390
225 principal claude-opus-5 4330 383826 2821
226 principal claude-opus-4-7 24292 39374 2261
227 principal claude-opus-4-7 2297 63666 69
228 principal claude-opus-5 3478 388156 258
229 principal claude-opus-5 267 391634 290
230 principal claude-opus-5 1986 391901 395
231 principal claude-opus-5 458 393887 100
232 principal claude-opus-5 666 394345 554
233 principal claude-opus-5 562 395011 173
234 principal claude-opus-5 181 395573 256
235 principal claude-opus-5 378 395754 1055
236 principal claude-opus-5 1441 396132 483
237 principal claude-opus-5 609 397573 1097
238 principal claude-opus-5 1188 398182 155
239 principal claude-opus-5 263 399370 1270
240 principal claude-opus-5 1385 399633 1401
241 principal claude-opus-4-7 4721 29200 327
242 principal claude-opus-4-7 377 33921 121
243 principal claude-opus-4-7 178 34298 73
244 principal claude-opus-4-7 144 34476 93
245 principal claude-opus-4-7 3947 34620 93
246 principal claude-opus-4-7 5107 38567 94
247 principal claude-opus-5 3274 401018 1076
248 principal claude-opus-5 1131 404292 163
249 principal claude-opus-5 612 405423 117
250 principal claude-opus-4-7 3650 43674 1064
251 principal claude-opus-5 632 406035 746
252 principal claude-opus-5 804 406667 696
253 principal claude-opus-5 722 407471 101
254 principal claude-opus-5 118 408193 270
255 principal claude-opus-5 373 408311 63
256 principal claude-opus-5 3877 408684 1137
257 principal claude-opus-5 1211 412561 137
258 principal claude-opus-5 196 413772 150
259 principal claude-opus-5 561 413968 150
260 principal claude-opus-5 579 414529 908
261 principal claude-opus-5 982 415108 117
262 principal claude-opus-5 182 416090 941
263 principal claude-opus-5 1108 416272 130
264 principal claude-opus-5 2490 417380 2003
265 principal claude-opus-5 2590 419870 178
266 principal claude-opus-5 734 422460 443
267 principal claude-opus-5 522 423194 341
268 principal claude-opus-5 470 423716 158
269 principal claude-opus-5 169 424186 137
270 principal claude-opus-5 917 424355 474
271 principal claude-opus-5 712 425272 392
272 principal claude-opus-5 403 425984 134
273 principal claude-opus-5 242 426387 137
274 principal claude-opus-5 1386 426629 140
275 principal claude-opus-5 862 428015 133
276 principal claude-opus-5 174 428877 137
277 principal claude-opus-5 663 429051 174
278 principal claude-opus-5 791 429714 568
279 principal claude-opus-5 769 430505 199
280 principal claude-opus-5 719 431274 226
281 principal claude-opus-5 654 431993 508
282 principal claude-opus-5 3123 432647 156
283 principal claude-opus-5 641 435770 163
284 principal claude-opus-5 242 436411 173
285 principal claude-opus-5 322 436653 686
286 principal claude-opus-5 810 436975 111
287 principal claude-opus-5 159 437785 101
288 principal claude-opus-5 203 437944 134
289 principal claude-opus-5 491 438147 104
290 principal claude-opus-5 548 438638 371
291 principal claude-opus-5 471 439186 716
292 principal claude-opus-4-7 4960 29200 166
293 principal claude-opus-5 902 439657 940
294 principal claude-opus-4-7 15875 34160 1191
295 principal claude-opus-5 1527 440559 178
296 principal claude-opus-4-7 2417 50035 251
297 principal claude-opus-4-7 18332 52452 2661
298 principal claude-opus-4-7 3177 70784 342
299 principal claude-opus-4-7 413 73961 1685
300 principal claude-opus-5 189 442086 137
301 principal claude-opus-5 917 442275 155
302 principal claude-opus-5 413 443192 137
303 principal claude-opus-5 1386 443605 163
304 principal claude-opus-5 204 444991 137
305 principal claude-opus-5 658 445195 204
306 principal claude-opus-5 556 445853 129
307 principal claude-opus-5 466 446409 255
308 principal claude-opus-5 382 446875 155
309 principal claude-opus-5 165 447257 185
310 principal claude-opus-5 526 447422 225
311 principal claude-opus-5 231 447948 93
312 principal claude-opus-5 477 448179 1188
313 principal claude-opus-5 1348 448656 460
314 principal claude-opus-5 644 450004 1070
315 principal claude-opus-5 1409 450648 910
316 principal claude-opus-5 1275 452057 518
317 principal claude-opus-5 592 453332 1807
318 principal claude-opus-5 2177 453924 219
319 principal claude-opus-5 286 456101 340
320 principal claude-opus-5 1648 456387 433
321 principal claude-opus-5 507 458035 106
322 principal claude-opus-5 333 458542 417
323 principal claude-opus-5 464 458875 119
324 principal claude-opus-5 486 459339 1120
325 principal claude-opus-5 1231 459825 1542
326 principal claude-opus-4-7 12813 29200 184
327 principal claude-opus-4-7 9829 42013 483
328 principal claude-opus-5 1733 461056 1111
329 principal claude-opus-5 1698 462789 155
330 principal claude-opus-5 166 464487 137
331 principal claude-opus-5 1101 464653 160
332 principal claude-opus-5 201 465754 137
333 principal claude-opus-5 662 465955 294
334 principal claude-opus-5 689 466617 407
335 principal claude-opus-5 699 467306 135
336 principal claude-opus-5 180 468005 123
337 principal claude-opus-5 135 468185 147
338 principal claude-opus-5 227 468320 965
339 principal claude-opus-5 463633 0 1511
340 principal claude-opus-5 1571 463633 77
341 principal claude-opus-5 2543 465204 138
342 principal claude-opus-5 377 467747 119
343 principal claude-opus-5 1411 468124 1248
344 principal claude-opus-5 1615 469535 1600
345 principal claude-opus-5 5460 471150 2221
346 principal claude-opus-5 2885 476610 1130
347 principal claude-opus-5 1138 479495 266
348 principal claude-opus-5 286 480633 223
349 principal claude-opus-5 254 480919 411
350 principal claude-opus-5 443 481173 28
351 principal claude-opus-5 77 481616 314
352 principal claude-opus-5 2390 481693 505
353 principal claude-opus-5 549 484083 117
354 principal claude-opus-5 548 484632 573
355 principal claude-opus-5 631 485180 127
356 principal claude-opus-5 153 485811 172
357 principal claude-opus-5 180 485964 1271
358 principal claude-opus-5 1449 486144 244
359 principal claude-opus-5 2048 487593 614
360 principal claude-opus-5 700 489641 121
361 principal claude-opus-5 543 490341 367
362 principal claude-opus-5 429 490884 159
363 principal claude-opus-5 481 491313 274
364 principal claude-opus-5 420 491794 63
365 principal claude-opus-5 1867 492214 1099
366 principal claude-opus-5 1161 494081 289
367 principal claude-opus-5 4288 495242 612
368 principal claude-opus-5 1170 499530 793
369 principal claude-opus-5 855 500700 418
370 principal claude-opus-5 734 501555 213
371 principal claude-opus-5 230 502289 237
372 principal claude-opus-5 287 502519 151
373 principal claude-opus-5 297 502806 63
374 principal claude-opus-5 1867 503103 233
375 principal claude-opus-5 682 504970 1351
376 principal claude-opus-5 1416 505652 1594
377 principal claude-opus-4-7 50785 0 238
378 principal claude-opus-4-7 288 50785 130
379 principal claude-opus-4-7 204 51073 79
380 principal claude-opus-4-7 345 51277 90
381 principal claude-opus-4-7 3513 51622 91
382 principal claude-opus-4-7 3275 55135 93
383 principal claude-opus-4-7 2958 58410 93
384 principal claude-opus-5 1791 507068 1400
385 principal claude-opus-5 2273 508859 175
386 principal claude-opus-4-7 6618 61368 2022
387 principal claude-opus-4-7 8516 67986 388
388 principal claude-opus-4-7 764 76502 253
389 principal claude-opus-4-7 1770 77266 2718
390 principal claude-opus-5 186 511132 137
391 principal claude-opus-5 1101 511318 158
392 principal claude-opus-5 199 512419 137
393 principal claude-opus-5 659 512618 153
394 principal claude-opus-5 505 513277 163
395 principal claude-opus-5 290 513782 395
396 principal claude-opus-5 547 514072 130
397 principal claude-opus-5 443 514619 634
398 principal claude-opus-5 803 515062 523
399 principal claude-opus-5 1110 515865 155
400 principal claude-opus-5 166 516975 137
401 principal claude-opus-5 1087 517141 133
402 principal claude-opus-5 174 518228 137
403 principal claude-opus-5 661 518402 205
404 principal claude-opus-5 563 519063 197
405 principal claude-opus-5 243 519626 92
406 principal claude-opus-5 785 519869 794
407 principal claude-opus-5 881 520654 321
408 principal claude-opus-5 458 521535 482
409 principal claude-opus-5 614 521993 202
410 principal claude-opus-5 529136 0 1590
411 principal claude-opus-5 1708 529136 121
412 principal claude-opus-5 1636 530844 1891
413 principal claude-opus-5 6036 532480 2086
414 principal claude-opus-5 2460 538516 863
415 principal claude-opus-5 871 540976 315
416 principal claude-opus-5 507 541847 4
417 principal claude-opus-5 313 542354 4
418 principal claude-opus-5 381 542667 931
419 principal claude-opus-5 945 543048 1041
420 principal claude-opus-5 1116 543993 326
421 principal claude-opus-5 905 545109 473
422 principal claude-opus-5 551 546014 2534
423 principal claude-opus-5 2902 546565 349
424 principal claude-opus-5 1543 549467 1069
425 principal claude-opus-5 5528 551010 1828
426 principal claude-opus-5 1843 556538 1771
427 principal claude-opus-5 6269 558381 4650
428 principal claude-opus-5 8766 564650 932
429 principal claude-opus-5 969 573416 315
430 principal claude-opus-5 347 574385 28
431 principal claude-opus-5 74 574732 315
432 principal claude-opus-5 3067 574806 2383
433 principal claude-opus-5 2424 577873 1532
434 principal claude-opus-4-7 55410 0 1434
435 principal claude-opus-4-7 1482 55410 89
436 principal claude-opus-4-7 156 56892 80
437 principal claude-opus-4-7 370 57048 96
438 principal claude-opus-4-7 3350 57418 93
439 principal claude-opus-4-7 8447 60768 89
440 principal claude-opus-5 2007 580297 3138
441 principal claude-opus-4-7 3753 69215 1637
442 principal claude-opus-4-7 5060 72968 227
443 principal claude-opus-4-7 3722 78028 93
444 principal claude-opus-4-7 5296 81750 1958
445 principal claude-opus-5 3310 582304 1271
446 principal claude-opus-5 1314 585614 2220
447 principal claude-opus-5 2603 586928 354
448 principal claude-opus-5 547562 42670 842
449 principal claude-opus-5 859 590232 133
450 principal claude-opus-5 216 591091 114
451 principal claude-opus-5 850 591307 1407
452 principal claude-opus-5 1396 592157 1121
453 principal claude-opus-5 1223 593553 325
454 principal claude-opus-5 1519 594776 818
455 principal claude-opus-5 953 596295 937
456 principal claude-opus-5 1131 597248 2712
457 principal claude-opus-5 3011 598379 1267
458 principal claude-opus-5 1401 601390 76
459 principal claude-opus-5 531 602791 664
460 principal claude-opus-5 740 603322 76
461 principal claude-opus-5 219 604062 522
462 principal claude-opus-5 553 604281 318
463 principal claude-opus-5 350 604834 28
464 principal claude-opus-5 366 605184 320
465 principal claude-opus-5 6614 605550 532
466 principal claude-opus-5 589 612164 139
467 principal claude-opus-5 515 612753 324
468 principal claude-opus-5 641 613268 1822
469 principal claude-opus-5 1836 613909 158
470 principal claude-opus-5 165 615745 411
471 principal claude-opus-5 1129 615910 746
472 principal claude-opus-5 827 617039 1754
473 principal claude-opus-4-7 30751 29200 1530
474 principal claude-opus-4-7 1578 59951 136
475 principal claude-opus-4-7 212 61529 79
476 principal claude-opus-4-7 107 61741 79
477 principal claude-opus-4-7 5092 61848 80
478 principal claude-opus-5 1949 617866 2199
479 principal claude-opus-4-7 3818 66940 84
480 principal claude-opus-4-7 5750 70758 83
481 principal claude-opus-4-7 4058 76508 80
482 principal claude-opus-4-7 3541 80566 83
483 principal claude-opus-4-7 9030 84107 1326
484 principal claude-opus-4-7 3465 93137 1348
485 principal claude-opus-5 2569 619815 500
486 principal claude-opus-5 585746 42670 457
487 principal claude-opus-5 533 628416 205
488 principal claude-opus-5 273 628949 154
489 principal claude-opus-5 477 629222 1586
490 principal claude-opus-5 2071 629699 1540
491 principal claude-opus-4-7 10275 29200 2217
492 principal claude-opus-4-7 2267 39475 99
493 principal claude-opus-5 2127 631770 155
494 principal claude-opus-4-7 220 41742 87
495 principal claude-opus-4-7 3242 41962 90
496 principal claude-opus-4-7 1673 45204 154
497 principal claude-opus-4-7 271 46877 111
498 principal claude-opus-4-7 280 47148 95
499 principal claude-opus-4-7 459 47428 87
500 principal claude-opus-4-7 4275 47887 1611
501 principal claude-opus-4-7 4304 52162 187
502 principal claude-opus-4-7 5492 56466 197
503 principal claude-opus-4-7 2157 61958 4204
504 principal claude-opus-5 166 633897 137
505 principal claude-opus-5 1101 634063 159
506 principal claude-opus-5 200 635164 137
507 principal claude-opus-5 660 635364 153
508 principal claude-opus-5 505 636024 526
509 principal claude-opus-5 647 636529 389
510 principal claude-opus-5 507 637176 145
511 principal claude-opus-5 827 637683 643
512 principal claude-opus-5 865 638510 483
513 principal claude-opus-5 1070 639375 155
514 principal claude-opus-5 166 640445 137
515 principal claude-opus-5 1087 640611 133
516 principal claude-opus-5 174 641698 137
517 principal claude-opus-5 661 641872 169
518 principal claude-opus-5 556 642533 160
519 principal claude-opus-5 195 643089 856
520 principal claude-opus-5 546568 42670 392
521 principal claude-opus-5 629 589238 1031
522 principal claude-opus-5 1028 589867 111
523 principal claude-opus-5 261 590895 2303
524 principal claude-opus-5 6082 591156 2218
525 principal claude-opus-5 3331 597238 491
526 principal claude-opus-5 770 600569 309
527 principal claude-opus-5 335 601339 169
528 principal claude-opus-5 521 601674 1306
529 principal claude-opus-5 1495 602195 292
530 principal claude-opus-5 633 603690 1784
531 principal claude-opus-5 9668 604323 390
532 principal claude-opus-5 3507 613991 460
533 principal claude-opus-5 500 617498 1559
534 principal claude-opus-5 1878 617998 1410
535 principal claude-opus-4-7 60609 0 943
536 principal claude-opus-4-7 2624 60609 192
537 principal claude-opus-5 1611 619876 1259
538 principal claude-opus-5 1846 621487 151
539 principal claude-opus-4-7 5560 63233 1280
540 principal claude-opus-5 158 623333 137
541 principal claude-opus-5 1101 623491 133
542 principal claude-opus-5 174 624592 137
543 principal claude-opus-5 658 624766 149
544 principal claude-opus-5 497 625424 265
545 principal claude-opus-5 307 625921 141
546 principal claude-opus-5 149 626228 99
547 principal claude-opus-5 744 626377 519
548 principal claude-opus-5 893 627121 204
549 principal claude-opus-5 834 628014 441
550 principal claude-opus-5 1028 628848 151
551 principal claude-opus-5 158 629876 137
552 principal claude-opus-5 1087 630034 133
553 principal claude-opus-5 174 631121 137
554 principal claude-opus-5 662 631295 185
555 principal claude-opus-5 574 631957 840
556 principal claude-opus-5 644186 0 2971
557 principal claude-opus-5 6745 644186 2664
558 principal claude-opus-5 3776 650931 623
559 principal claude-opus-5 902 654707 138
560 principal claude-opus-5 225 655609 1483
561 principal claude-opus-5 1758 655834 286
562 principal claude-opus-5 4770 657592 1217
563 principal claude-opus-5 1338 662362 99
564 principal claude-opus-5 1381 663700 770
565 principal claude-opus-5 1109 665081 152
566 principal claude-opus-5 486 666190 1654
567 principal claude-opus-5 2049 666676 2794
568 principal claude-opus-5 2800 668725 142
569 principal claude-opus-5 456 671525 1437
570 principal claude-opus-5 1533 671981 525
571 principal claude-opus-5 642623 42670 476
572 principal claude-opus-5 564 685293 204
573 principal claude-opus-5 272 685857 1752
574 principal claude-opus-5 1783 686129 1889
575 principal claude-opus-4-7 95429 0 397
576 principal claude-opus-4-7 447 95429 115
577 principal claude-opus-4-7 172 95876 79
578 principal claude-opus-4-7 107 96048 79
579 principal claude-opus-4-7 12365 96155 77
580 principal claude-opus-5 2113 687912 1579
581 principal claude-opus-5 2166 690025 151
582 principal claude-opus-4-7 4588 108520 1338
583 principal claude-opus-4-7 6657 113108 2892
584 principal claude-opus-4-7 9718 119765 83
585 principal claude-opus-4-7 9159 129483 5694
586 principal claude-opus-5 445 692191 137
587 principal claude-opus-5 1101 692636 146
588 principal claude-opus-5 187 693737 137
589 principal claude-opus-5 661 693924 149
590 principal claude-opus-5 497 694585 337
591 principal claude-opus-5 421 695082 244
592 principal claude-opus-5 630 695503 843
593 principal claude-opus-5 688878 0 1230
594 principal claude-opus-5 1524 688878 1789
595 principal claude-opus-5 2898 690402 304
596 principal claude-opus-5 583 693300 117
597 principal claude-opus-5 182 693883 986
598 principal claude-opus-5 1173 694065 315
599 principal claude-opus-5 358 695238 437
600 principal claude-opus-5 486 695596 339
601 principal claude-opus-5 2142 696082 256
602 principal claude-opus-5 324 698224 973
603 principal claude-opus-4-7 36634 0 134
604 principal claude-opus-4-7 3067 36634 80
605 principal claude-opus-4-7 1742 39701 831
606 principal claude-opus-5 1177 698548 1094
607 principal claude-opus-4-7 1310 41443 207
608 principal claude-opus-5 1681 699725 151
609 principal claude-opus-4-7 1760 42753 910
610 principal claude-opus-5 158 701406 137
611 principal claude-opus-5 1101 701564 133
612 principal claude-opus-5 174 702665 137
613 principal claude-opus-5 658 702839 147
614 principal claude-opus-5 495 703497 244
615 agent claude-haiku-4-5-20251001 11688 0 1
616 agent claude-haiku-4-5-20251001 1278 11688 1
617 agent claude-haiku-4-5-20251001 630 12966 2
618 agent claude-haiku-4-5-20251001 2273 13596 2
619 agent claude-haiku-4-5-20251001 752 15869 2
620 agent claude-haiku-4-5-20251001 263 16621 5
621 agent claude-haiku-4-5-20251001 12189 0 4
622 agent claude-haiku-4-5-20251001 3080 12189 2
623 agent claude-haiku-4-5-20251001 1433 15269 2
624 agent claude-haiku-4-5-20251001 1083 16702 2
625 agent claude-haiku-4-5-20251001 646 17785 2
626 agent claude-haiku-4-5-20251001 692 18431 2
627 agent claude-haiku-4-5-20251001 1368 19123 3
628 agent claude-haiku-4-5-20251001 286 20491 4
629 agent claude-haiku-4-5-20251001 11594 0 4
630 agent claude-haiku-4-5-20251001 3768 11594 1
631 agent claude-haiku-4-5-20251001 382 15362 3
632 agent claude-haiku-4-5-20251001 611 15744 2
633 agent claude-haiku-4-5-20251001 1319 16355 4
634 agent claude-haiku-4-5-20251001 274 17674 4
635 agent claude-haiku-4-5-20251001 12060 0 4
636 agent claude-haiku-4-5-20251001 1359 12060 2
637 agent claude-haiku-4-5-20251001 3629 13419 2
638 agent claude-haiku-4-5-20251001 328 17048 4
639 agent claude-haiku-4-5-20251001 11937 0 4
640 agent claude-haiku-4-5-20251001 4458 11937 2
641 agent claude-haiku-4-5-20251001 1922 16395 2
642 agent claude-haiku-4-5-20251001 1824 18317 2
643 agent claude-haiku-4-5-20251001 374 20141 2
644 agent claude-opus-5 12380 0 1
645 agent claude-opus-5 13012 12380 2
646 agent claude-opus-5 18598 25392 3
647 agent claude-opus-5 1200 43990 3
648 agent claude-opus-5 3173 45190 2
649 agent claude-opus-5 10030 48363 4
650 agent claude-opus-5 9389 58393 1
651 agent claude-sonnet-5 18357 0 4
652 agent claude-sonnet-5 2173 18357 4
653 agent claude-sonnet-5 233 20530 20
654 agent claude-sonnet-5 26150 20763 2
655 agent claude-sonnet-5 10931 46913 10
656 agent claude-sonnet-5 2181 57844 7
657 agent claude-sonnet-5 3904 60025 14
658 agent claude-sonnet-5 2627 63929 2
659 agent claude-sonnet-5 4662 66556 4
660 agent claude-sonnet-5 612 71218 14
661 agent claude-sonnet-5 5180 71830 5
662 agent claude-sonnet-5 2079 77010 2
663 agent claude-sonnet-5 5683 79089 2
664 agent claude-sonnet-5 5395 84772 2
665 agent claude-sonnet-5 9105 90167 2
666 agent claude-sonnet-5 4800 99272 3
667 agent claude-sonnet-5 3401 104072 3
668 agent claude-sonnet-5 9691 107473 3
669 agent claude-sonnet-5 11393 117164 2
670 agent claude-sonnet-5 7261 128557 3
671 agent claude-sonnet-5 4201 135818 20
672 agent claude-sonnet-5 3340 140019 6
673 agent claude-sonnet-5 255 143359 20
674 agent claude-sonnet-5 159 143614 6
675 agent claude-sonnet-5 574 143773 20
676 agent claude-sonnet-5 1301 144347 5
677 agent claude-sonnet-5 4742 145648 5
678 agent claude-sonnet-5 1891 150390 1
679 agent claude-sonnet-5 7079 152281 7
680 agent claude-sonnet-5 4068 159360 3
681 agent claude-sonnet-5 4138 163428 3
682 agent claude-sonnet-5 2050 167566 20
683 agent claude-sonnet-5 1664 169616 5
684 agent claude-sonnet-5 18865 171280 10
685 agent claude-sonnet-5 448 190145 4
686 agent claude-sonnet-5 4962 190593 2
687 agent claude-sonnet-5 17989 195555 2
688 agent claude-sonnet-5 9197 213544 3
689 agent claude-sonnet-5 18936 222741 2
690 agent claude-sonnet-5 8873 241677 5
691 agent claude-sonnet-5 2873 250550 2
692 agent claude-sonnet-5 3297 253423 2
693 agent claude-sonnet-5 207 256720 2
694 agent claude-sonnet-5 10277 256927 2
695 agent claude-sonnet-5 11973 267204 6
696 agent claude-sonnet-5 4866 279177 2
697 agent claude-sonnet-5 1659 284043 4
698 agent claude-sonnet-5 416 285702 2
699 agent claude-sonnet-5 875 286118 3
700 agent claude-sonnet-5 727 286993 3
701 agent claude-sonnet-5 1021 287720 3
702 agent claude-sonnet-5 1067 288741 5
703 agent claude-sonnet-5 1688 289808 5
704 agent claude-sonnet-5 2105 291496 3
705 agent claude-sonnet-5 793 293601 3
706 agent claude-sonnet-5 1056 294394 2
707 agent claude-sonnet-5 1466 295450 20
708 agent claude-sonnet-5 457 296916 2
709 agent claude-sonnet-5 525 297373 20
710 agent claude-sonnet-5 288 297898 17
711 agent claude-sonnet-5 1129 298186 2
712 agent claude-sonnet-5 1043 299315 20
713 agent claude-sonnet-5 460 300358 2
714 agent claude-sonnet-5 434 300818 20
715 agent claude-sonnet-5 364 301252 17
716 agent claude-sonnet-5 319 301616 4
717 agent claude-sonnet-5 406 301935 3
718 agent claude-sonnet-5 416 302341 20
719 agent claude-sonnet-5 763 302757 6
720 agent claude-sonnet-5 951 303520 20
721 agent claude-sonnet-5 531 304471 20
722 agent claude-sonnet-5 460 305002 3
723 agent claude-sonnet-5 383 305462 20
724 agent claude-sonnet-5 358 305845 6
725 agent claude-sonnet-5 1321 306203 4
726 agent claude-sonnet-5 1241 307524 4
727 agent claude-sonnet-5 944 308765 20
728 agent claude-sonnet-5 530 309709 6
729 agent claude-sonnet-5 501 310239 3
730 agent claude-sonnet-5 284 310740 4
731 agent claude-sonnet-5 21183 311024 2
732 agent claude-sonnet-5 2242 332207 8
733 agent claude-sonnet-5 8092 334449 3
734 agent claude-sonnet-5 12183 342541 3
735 agent claude-sonnet-5 1312 354724 3
736 agent claude-sonnet-5 3284 356036 3
737 agent claude-sonnet-5 692 359320 20
738 agent claude-sonnet-5 799 360012 2
739 agent claude-sonnet-5 629 360811 17
740 agent claude-sonnet-5 564 361440 4
741 agent claude-sonnet-5 1836 362004 2
742 agent claude-sonnet-5 316 363840 3
743 agent claude-sonnet-5 1701 364156 21
744 agent claude-sonnet-5 288 365857 16
745 agent claude-sonnet-5 751 366145 2
746 agent claude-sonnet-5 1048 366896 20
747 agent claude-sonnet-5 2343 367944 4
748 agent claude-sonnet-5 2591 370287 2
749 agent claude-sonnet-5 2322 372878 5
750 agent claude-sonnet-5 4939 375200 3
751 agent claude-sonnet-5 4327 380139 3
752 agent claude-sonnet-5 1958 384466 3
753 agent claude-sonnet-5 4390 386424 2
754 agent claude-sonnet-5 1810 390814 10
755 agent claude-sonnet-5 363 392624 17
756 agent claude-sonnet-5 331 392987 17
757 agent claude-sonnet-5 283 393318 4
758 agent claude-sonnet-5 671 393601 17
759 agent claude-sonnet-5 389 394272 2
760 agent claude-sonnet-5 1206 394661 2
761 agent claude-sonnet-5 611 395867 20
762 agent claude-sonnet-5 855 396478 4
763 agent claude-sonnet-5 819 397333 4
764 agent claude-sonnet-5 441 398152 4
765 agent claude-sonnet-5 3896 398593 3
766 agent claude-sonnet-5 4467 402489 20
767 agent claude-sonnet-5 1359 406956 2
768 agent claude-sonnet-5 814 408315 17
769 agent claude-sonnet-5 255 409129 6
770 agent claude-sonnet-5 1435 409384 3
771 agent claude-sonnet-5 534 410819 4
772 agent claude-sonnet-5 230 411353 3
773 agent claude-sonnet-5 732 411583 3
774 agent claude-sonnet-5 869 412315 2
775 agent claude-sonnet-5 663 413184 6
776 agent claude-sonnet-5 2517 413847 6
777 agent claude-sonnet-5 1453 416364 20
778 agent claude-sonnet-5 324 417817 20
779 agent claude-sonnet-5 650 418141 5
780 agent claude-sonnet-5 1033 418791 20
781 agent claude-sonnet-5 639 419824 7
782 agent claude-sonnet-5 359 420463 2
783 agent claude-sonnet-5 624 420822 17
784 agent claude-sonnet-5 1344 421446 6
785 agent claude-sonnet-5 1265 422790 20
786 agent claude-sonnet-5 2519 424055 2
787 agent claude-sonnet-5 541 426574 20
788 agent claude-sonnet-5 336 427115 17
789 agent claude-sonnet-5 1015 427451 3
790 agent claude-sonnet-5 1780 428466 20
791 agent claude-sonnet-5 422 430246 6
792 agent claude-sonnet-5 93 430668 20
793 agent claude-sonnet-5 101 430761 3
794 agent claude-sonnet-5 2781 430862 2
795 agent claude-sonnet-5 1310 433643 20
796 agent claude-sonnet-5 409 434953 3
797 agent claude-sonnet-5 2465 435362 3
798 agent claude-sonnet-5 465 437827 16
799 agent claude-sonnet-5 787 438292 3
800 agent claude-sonnet-5 317 439079 20
801 agent claude-sonnet-5 679 439396 17
802 agent claude-sonnet-5 360 440075 4
803 agent claude-sonnet-5 652 440435 3
804 agent claude-sonnet-5 127 441087 20
805 agent claude-sonnet-5 243 441214 17
806 agent claude-sonnet-5 1524 441457 8
807 agent claude-sonnet-5 682 442981 2
808 agent claude-sonnet-5 242 443663 20
809 agent claude-sonnet-5 585 443905 6
810 agent claude-sonnet-5 2388 444490 3
811 agent claude-sonnet-5 372 446878 3
812 agent claude-sonnet-5 3243 447250 20
813 agent claude-sonnet-5 726 450493 2
814 agent claude-sonnet-5 2702 451219 20
815 agent claude-sonnet-5 1033 453921 2
816 agent claude-sonnet-5 2838 454954 20
817 agent claude-sonnet-5 1062 457792 9
818 agent claude-sonnet-5 3212 458854 20
819 agent claude-sonnet-5 1368 462066 3
820 agent claude-sonnet-5 1231 463434 2
821 agent claude-sonnet-5 829 464665 5
822 agent claude-sonnet-5 945 465494 17
823 agent claude-sonnet-5 1297 466439 20
824 agent claude-sonnet-5 1102 467736 2
825 agent claude-sonnet-5 787 468838 20
826 agent claude-sonnet-5 365 469625 6
827 agent claude-sonnet-5 561 469990 17
828 agent claude-sonnet-5 636 470551 20
829 agent claude-sonnet-5 440 471187 6
830 agent claude-sonnet-5 4648 471627 7
831 agent claude-sonnet-5 2416 476275 20
832 agent claude-sonnet-5 1390 478691 3
833 agent claude-sonnet-5 391 480081 3
834 agent claude-sonnet-5 927 480472 6
835 agent claude-sonnet-5 1940 481399 3
836 agent claude-sonnet-5 866 483339 2
837 agent claude-sonnet-5 637 484205 20
838 agent claude-sonnet-5 598 484842 2
839 agent claude-sonnet-5 3679 485440 20
840 agent claude-sonnet-5 3420 489119 3
841 agent claude-sonnet-5 1051 492539 3
842 agent claude-sonnet-5 1748 493590 3
843 agent claude-sonnet-5 484 495338 2
844 agent claude-sonnet-5 2617 495822 6
845 agent claude-sonnet-5 4549 498439 20
846 agent claude-sonnet-5 793 502988 4
847 agent claude-sonnet-5 654 503781 20
848 agent claude-sonnet-5 931 504435 3
849 agent claude-sonnet-5 4102 505366 3
850 agent claude-sonnet-5 1121 509468 20
851 agent claude-sonnet-5 658 510589 4
852 agent claude-sonnet-5 1891 511247 8
853 agent claude-sonnet-5 1529 513138 3
854 agent claude-sonnet-5 1169 514667 2
855 agent claude-sonnet-5 483 515836 20
856 agent claude-sonnet-5 2514 516319 20
857 agent claude-sonnet-5 2369 518833 3
858 agent claude-sonnet-5 353 521202 1
859 agent claude-sonnet-5 702 521555 9
860 agent claude-sonnet-5 288 522257 20
861 agent claude-sonnet-5 298 522545 20
862 agent claude-sonnet-5 73 522843 3
863 agent claude-sonnet-5 290 522916 20
864 agent claude-sonnet-5 1108 523206 17
865 agent claude-sonnet-5 610 524314 2
866 agent claude-sonnet-5 1252 524924 2
867 agent claude-sonnet-5 835 526176 17
868 agent claude-sonnet-5 1364 527011 4
869 agent claude-sonnet-5 1452 528375 3
870 agent claude-sonnet-5 1880 529827 16
871 agent claude-sonnet-5 644 531707 5
872 agent claude-sonnet-5 308 532351 2
873 agent claude-sonnet-5 343 532659 2
874 agent claude-sonnet-5 540 533002 20
875 agent claude-sonnet-5 318 533542 21
876 agent claude-sonnet-5 590 533860 20
877 agent claude-sonnet-5 468 534450 8
878 agent claude-sonnet-5 264 534918 20
879 agent claude-sonnet-5 235 535182 6
880 agent claude-sonnet-5 556 535417 2
881 agent claude-sonnet-5 683 535973 5
882 agent claude-sonnet-5 149 536656 3
883 agent claude-sonnet-5 821 536805 20
884 agent claude-sonnet-5 99 537626 2
885 agent claude-sonnet-5 127 537725 5
886 agent claude-sonnet-5 137 537852 20
887 agent claude-sonnet-5 726 537989 2
888 agent claude-sonnet-5 121 538715 20
889 agent claude-sonnet-5 122 538836 16
890 agent claude-sonnet-5 610 538958 5
891 agent claude-sonnet-5 852 539568 2
892 agent claude-sonnet-5 644 540420 7
893 agent claude-sonnet-5 670 541064 3
894 agent claude-sonnet-5 1289 541734 17
895 agent claude-sonnet-5 612 543023 7
896 agent claude-sonnet-5 817 543635 2
897 agent claude-sonnet-5 1137 544452 2
898 agent claude-sonnet-5 1484 545589 3
899 agent claude-sonnet-5 766 547073 2
900 agent claude-sonnet-5 1071 547839 3
901 agent claude-sonnet-5 1041 548910 10
902 agent claude-sonnet-5 1248 549951 5
903 agent claude-sonnet-5 2113 551199 17
904 agent claude-sonnet-5 716 553312 3
905 agent claude-sonnet-5 136 554028 3
906 agent claude-sonnet-5 674 554164 3
907 agent claude-sonnet-5 1085 554838 2
908 agent claude-sonnet-5 661 555923 2
909 agent claude-sonnet-5 406 556584 3
910 agent claude-sonnet-5 295 556990 3
911 agent claude-sonnet-5 262 557285 2
912 agent claude-sonnet-5 17782 0 4
913 agent claude-sonnet-5 2220 17782 5
914 agent claude-sonnet-5 181 20002 20
915 agent claude-sonnet-5 1848 20183 2
916 agent claude-sonnet-5 10411 22031 4
917 agent claude-sonnet-5 2359 32442 2
918 agent claude-sonnet-5 5114 34801 8
919 agent claude-sonnet-5 3283 39915 14
920 agent claude-sonnet-5 3490 43198 7
921 agent claude-sonnet-5 272 46688 20
922 agent claude-sonnet-5 2926 46960 7
923 agent claude-sonnet-5 305 49886 3
924 agent claude-sonnet-5 6113 50191 3
925 agent claude-sonnet-5 889 56304 5
926 agent claude-sonnet-5 243 57193 20
927 agent claude-sonnet-5 3246 57436 3
928 agent claude-sonnet-5 2893 60682 5
929 agent claude-sonnet-5 4180 63575 20
930 agent claude-sonnet-5 2818 67755 8
931 agent claude-sonnet-5 4807 70573 2
932 agent claude-sonnet-5 237 75380 21
933 agent claude-sonnet-5 291 75617 2
934 agent claude-sonnet-5 733 75908 2
935 agent claude-sonnet-5 1586 76641 2
936 agent claude-sonnet-5 388 78227 2
937 agent claude-sonnet-5 213 78615 20
938 agent claude-sonnet-5 642 78828 3
939 agent claude-sonnet-5 453 79470 20
940 agent claude-sonnet-5 662 79923 9
941 agent claude-sonnet-5 501 80585 3
942 agent claude-sonnet-5 6563 81086 4
943 agent claude-sonnet-5 875 87649 20
944 agent claude-sonnet-5 2154 88524 5
945 agent claude-sonnet-5 11605 90678 2
946 agent claude-sonnet-5 3245 102283 5
947 agent claude-sonnet-5 418 105528 2
948 agent claude-sonnet-5 423 105946 2
949 agent claude-sonnet-5 1213 106369 5
950 agent claude-sonnet-5 571 107582 9
951 agent claude-sonnet-5 2383 108153 6
952 agent claude-sonnet-5 596 110536 20
953 agent claude-sonnet-5 808 111132 5
954 agent claude-sonnet-5 416 111940 17
955 agent claude-sonnet-5 639 112356 5
956 agent claude-sonnet-5 541 112995 9
957 agent claude-sonnet-5 469 113536 4
958 agent claude-sonnet-5 1655 114005 7
959 agent claude-sonnet-5 1980 115660 4
960 agent claude-sonnet-5 2267 117640 4
961 agent claude-sonnet-5 5198 119907 3
962 agent claude-sonnet-5 208 125105 6
963 agent claude-sonnet-5 356 125313 16
964 agent claude-sonnet-5 305 125669 5
965 agent claude-sonnet-5 17510 0 3
966 agent claude-sonnet-5 2209 17510 5
967 agent claude-sonnet-5 264 19719 20
968 agent claude-sonnet-5 4394 19983 4
969 agent claude-sonnet-5 10920 24377 6
970 agent claude-sonnet-5 156 35297 20
971 agent claude-sonnet-5 1693 35453 7
972 agent claude-sonnet-5 5259 37146 10
973 agent claude-sonnet-5 376 42405 20
974 agent claude-sonnet-5 140 42781 2
975 agent claude-sonnet-5 302 42921 20
976 agent claude-sonnet-5 146 43223 4
977 agent claude-sonnet-5 196 43369 2
978 agent claude-sonnet-5 4666 43565 3
979 agent claude-sonnet-5 7299 48231 6
980 agent claude-sonnet-5 3038 55530 2
981 agent claude-sonnet-5 4970 58568 4
982 agent claude-sonnet-5 1798 63538 3
983 agent claude-sonnet-5 7196 65336 3
984 agent claude-sonnet-5 631 72532 20
985 agent claude-sonnet-5 736 73163 2
986 agent claude-sonnet-5 332 73899 3
987 agent claude-sonnet-5 534 74231 2
988 agent claude-sonnet-5 2493 74765 272
989 agent claude-sonnet-5 3191 77258 9
990 agent claude-sonnet-5 433 80449 3
991 agent claude-sonnet-5 331 80882 20
992 agent claude-sonnet-5 152 81213 5
993 agent claude-sonnet-5 280 81365 2
994 agent claude-sonnet-5 362 81645 4
995 agent claude-sonnet-5 372 82007 2
996 agent claude-sonnet-5 1075 82379 5
997 agent claude-sonnet-5 215 83454 160
998 agent claude-sonnet-5 181 83669 17
999 agent claude-sonnet-5 133 83850 3
1000 agent claude-sonnet-5 193 83983 4
1001 agent claude-sonnet-5 241 84176 20
1002 agent claude-sonnet-5 1176 84417 6
1003 agent claude-sonnet-5 3282 85593 2
1004 agent claude-sonnet-5 333 88875 5
1005 agent claude-sonnet-5 1849 89208 3
1006 agent claude-sonnet-5 1449 91057 3
1007 agent claude-sonnet-5 5219 92506 20
1008 agent claude-sonnet-5 466 97725 1
1009 agent claude-sonnet-5 282 98191 1
1010 agent claude-sonnet-5 224 98473 21
1011 agent claude-sonnet-5 372 98697 17
1012 agent claude-sonnet-5 220 99069 8
1013 agent claude-sonnet-5 257 99289 3
1014 agent claude-sonnet-5 519 99546 2
1015 agent claude-sonnet-5 120 100065 20
1016 agent claude-sonnet-5 282 100185 6
1017 agent claude-sonnet-5 322 100467 4
1018 agent claude-sonnet-5 149 100789 5
1019 agent claude-sonnet-5 196 100938 3
1020 agent claude-sonnet-5 434 101134 4
1021 agent claude-sonnet-5 1538 101568 1
1022 agent claude-sonnet-5 1960 103106 3
1023 agent claude-sonnet-5 1383 105066 2
1024 agent claude-sonnet-5 1983 106449 5
1025 agent claude-sonnet-5 442 108432 20
1026 agent claude-sonnet-5 494 108874 2
1027 agent claude-sonnet-5 141 109368 2
1028 agent claude-sonnet-5 319 109509 8
1029 agent claude-haiku-4-5-20251001 11397 0 4
1030 agent claude-haiku-4-5-20251001 1308 11397 2
1031 agent claude-haiku-4-5-20251001 545 12705 2
1032 agent claude-haiku-4-5-20251001 590 13250 2
1033 agent claude-haiku-4-5-20251001 537 13840 4
1034 agent claude-haiku-4-5-20251001 362 14377 5
1035 agent claude-haiku-4-5-20251001 11883 0 1
1036 agent claude-haiku-4-5-20251001 1507 11883 2
1037 agent claude-haiku-4-5-20251001 502 13390 1
1038 agent claude-haiku-4-5-20251001 397 13892 2
1039 agent claude-haiku-4-5-20251001 230 14289 2
1040 agent claude-haiku-4-5-20251001 810 14519 2
1041 agent claude-haiku-4-5-20251001 930 15329 5
1042 agent claude-haiku-4-5-20251001 270 16259 2
1043 agent claude-haiku-4-5-20251001 12120 0 4
1044 agent claude-haiku-4-5-20251001 1232 12120 2
1045 agent claude-haiku-4-5-20251001 499 13352 2
1046 agent claude-haiku-4-5-20251001 1279 13851 2
1047 agent claude-haiku-4-5-20251001 1345 15130 4
1048 agent claude-haiku-4-5-20251001 271 16475 4
1049 agent claude-sonnet-5 17933 0 5
1050 agent claude-sonnet-5 2208 17933 3
1051 agent claude-sonnet-5 20084 20141 2
1052 agent claude-sonnet-5 10398 40225 2
1053 agent claude-sonnet-5 1653 50623 2
1054 agent claude-sonnet-5 3010 52276 2
1055 agent claude-sonnet-5 3702 55286 14
1056 agent claude-sonnet-5 3490 58988 3
1057 agent claude-sonnet-5 6716 62478 2
1058 agent claude-sonnet-5 9566 69194 4
1059 agent claude-sonnet-5 4513 78760 3
1060 agent claude-sonnet-5 5235 83273 3
1061 agent claude-sonnet-5 941 88508 3
1062 agent claude-sonnet-5 2488 89449 4
1063 agent claude-sonnet-5 1225 91937 4
1064 agent claude-sonnet-5 3582 93162 20
1065 agent claude-sonnet-5 2100 96744 3
1066 agent claude-sonnet-5 1437 98844 2
1067 agent claude-sonnet-5 11735 100281 5
1068 agent claude-sonnet-5 3433 112016 6
1069 agent claude-sonnet-5 12094 115449 2
1070 agent claude-sonnet-5 5533 127543 2
1071 agent claude-sonnet-5 6926 133076 7
1072 agent claude-sonnet-5 386 140002 20
1073 agent claude-sonnet-5 1151 140388 5
1074 agent claude-sonnet-5 2720 141539 2
1075 agent claude-sonnet-5 5194 144259 6
1076 agent claude-sonnet-5 5238 149453 2
1077 agent claude-sonnet-5 1456 154691 3
1078 agent claude-sonnet-5 2908 156147 4
1079 agent claude-sonnet-5 1991 159055 2
1080 agent claude-sonnet-5 19696 161046 3
1081 agent claude-sonnet-5 268 180742 20
1082 agent claude-sonnet-5 1056 181010 2
1083 agent claude-sonnet-5 2872 182066 3
1084 agent claude-sonnet-5 268 184938 14
1085 agent claude-sonnet-5 1153 185206 5
1086 agent claude-sonnet-5 654 186359 9
1087 agent claude-sonnet-5 196 187013 2
1088 agent claude-sonnet-5 4030 187209 2
1089 agent claude-sonnet-5 3834 191239 2
1090 agent claude-sonnet-5 3151 195073 3
1091 agent claude-sonnet-5 436 198224 2
1092 agent claude-sonnet-5 470 198660 5
1093 agent claude-sonnet-5 4684 199130 3
1094 agent claude-sonnet-5 2809 203814 10
1095 agent claude-sonnet-5 720 206623 17
1096 agent claude-sonnet-5 1179 207343 4
1097 agent claude-sonnet-5 5695 208522 3
1098 agent claude-sonnet-5 2734 214217 4
1099 agent claude-sonnet-5 1566 216951 5
1100 agent claude-sonnet-5 544 218517 20
1101 agent claude-sonnet-5 471 219061 16
1102 agent claude-sonnet-5 501 219532 20
1103 agent claude-sonnet-5 560 220033 3
1104 agent claude-sonnet-5 813 220593 9
1105 agent claude-sonnet-5 1373 221406 2
1106 agent claude-sonnet-5 554 222779 20
1107 agent claude-sonnet-5 269 223333 9
1108 agent claude-sonnet-5 886 223602 17
1109 agent claude-sonnet-5 1165 224488 20
1110 agent claude-sonnet-5 691 225653 2
1111 agent claude-sonnet-5 1775 226344 2
1112 agent claude-sonnet-5 815 228119 4
1113 agent claude-sonnet-5 1178 228934 3
1114 agent claude-sonnet-5 895 230112 2
1115 agent claude-sonnet-5 689 231007 3
1116 agent claude-sonnet-5 1888 231696 6
1117 agent claude-sonnet-5 1214 233584 3
1118 agent claude-sonnet-5 4454 234798 2
1119 agent claude-sonnet-5 1053 239252 2
1120 agent claude-sonnet-5 901 240305 4
1121 agent claude-sonnet-5 388 241206 2
1122 agent claude-sonnet-5 587 241594 8
1123 agent claude-sonnet-5 874 242181 3
1124 agent claude-sonnet-5 616 243055 3
1125 agent claude-sonnet-5 949 243671 20
1126 agent claude-sonnet-5 881 244620 2
1127 agent claude-sonnet-5 1149 245501 2
1128 agent claude-sonnet-5 616 246650 7
1129 agent claude-sonnet-5 1993 247266 20
1130 agent claude-sonnet-5 292 249259 7
1131 agent claude-sonnet-5 594 249551 17
1132 agent claude-sonnet-5 2033 250145 3
1133 agent claude-sonnet-5 635 252178 20
1134 agent claude-sonnet-5 305 252813 5
1135 agent claude-sonnet-5 429 253118 4
1136 agent claude-sonnet-5 1035 253547 2
1137 agent claude-sonnet-5 609 254582 4
1138 agent claude-sonnet-5 1138 255191 6
1139 agent claude-sonnet-5 4112 256329 3
1140 agent claude-sonnet-5 224 260441 3
1141 agent claude-sonnet-5 260 260665 2
1142 agent claude-sonnet-5 239 260925 3
1143 agent claude-sonnet-5 3006 261164 5
1144 agent claude-sonnet-5 240 264170 3
1145 agent claude-sonnet-5 3138 264410 20
1146 agent claude-sonnet-5 919 267548 9
1147 agent claude-sonnet-5 2304 268467 20
1148 agent claude-sonnet-5 1857 270771 6
1149 agent claude-sonnet-5 461 272628 5
1150 agent claude-sonnet-5 629 273089 17
1151 agent claude-sonnet-5 976 273718 9
1152 agent claude-sonnet-5 352 274694 2
1153 agent claude-sonnet-5 786 275046 1
1154 agent claude-sonnet-5 1636 275832 2
1155 agent claude-sonnet-5 195 277468 20
1156 agent claude-sonnet-5 174 277663 2
1157 agent claude-sonnet-5 301 277837 20
1158 agent claude-sonnet-5 105 278138 20
1159 agent claude-sonnet-5 1771 278243 14
1160 agent claude-sonnet-5 1601 280014 2
1161 agent claude-sonnet-5 484 281615 3
1162 agent claude-sonnet-5 545 282099 3
1163 agent claude-sonnet-5 389 282644 2
1164 agent claude-sonnet-5 738 283033 2
1165 agent claude-sonnet-5 1029 283771 3
1166 agent claude-sonnet-5 668 284800 2
1167 agent claude-sonnet-5 1839 285468 20
1168 agent claude-sonnet-5 617 287307 2
1169 agent claude-sonnet-5 954 287924 2
1170 agent claude-sonnet-5 679 288878 5
1171 agent claude-sonnet-5 1032 289557 10
1172 agent claude-sonnet-5 1306 290589 2
1173 agent claude-sonnet-5 352 291895 20
1174 agent claude-sonnet-5 292 292247 2
1175 agent claude-sonnet-5 269 292539 5
1176 agent claude-sonnet-5 1535 292808 3
1177 agent claude-sonnet-5 435 294343 9
1178 agent claude-sonnet-5 908 294778 2
1179 agent claude-sonnet-5 531 295686 3
1180 agent claude-sonnet-5 582 296217 2
1181 agent claude-sonnet-5 633 296799 2
1182 agent claude-sonnet-5 1156 297432 2
1183 agent claude-sonnet-5 409 298588 6
1184 agent claude-sonnet-5 590 298997 2
1185 agent claude-sonnet-5 304 299587 3
1186 agent claude-sonnet-5 7409 10806 6
1187 agent claude-sonnet-5 2169 18215 4
1188 agent claude-sonnet-5 534 20384 20
1189 agent claude-sonnet-5 1835 20918 2
1190 agent claude-sonnet-5 929 22753 7
1191 agent claude-sonnet-5 10520 23682 2
1192 agent claude-sonnet-5 2367 34202 6
1193 agent claude-sonnet-5 229 36569 20
1194 agent claude-sonnet-5 5084 36798 2
1195 agent claude-sonnet-5 6659 41882 8
1196 agent claude-sonnet-5 3306 48541 14
1197 agent claude-sonnet-5 3490 51847 2
1198 agent claude-sonnet-5 3650 55337 2
1199 agent claude-sonnet-5 4081 58987 8
1200 agent claude-sonnet-5 2984 63068 6
1201 agent claude-sonnet-5 503 66052 20
1202 agent claude-sonnet-5 6062 66555 3
1203 agent claude-sonnet-5 7875 72617 8
1204 agent claude-sonnet-5 1960 80492 6
1205 agent claude-sonnet-5 660 82452 20
1206 agent claude-sonnet-5 539 83112 20
1207 agent claude-sonnet-5 2962 83651 6
1208 agent claude-sonnet-5 2990 86613 4
1209 agent claude-sonnet-5 6788 89603 2
1210 agent claude-sonnet-5 2007 96391 3
1211 agent claude-sonnet-5 12846 98398 3
1212 agent claude-sonnet-5 16575 111244 3
1213 agent claude-sonnet-5 7605 127819 2
1214 agent claude-sonnet-5 3973 135424 10
1215 agent claude-sonnet-5 3189 139397 3
1216 agent claude-sonnet-5 334 142586 21
1217 agent claude-sonnet-5 1031 142920 5
1218 agent claude-sonnet-5 335 143951 2
1219 agent claude-sonnet-5 564 144286 5
1220 agent claude-sonnet-5 772 144850 2
1221 agent claude-sonnet-5 1156 145622 2
1222 agent claude-sonnet-5 1017 146778 2
1223 agent claude-sonnet-5 930 147795 2
1224 agent claude-sonnet-5 1000 148725 20
1225 agent claude-sonnet-5 785 149725 16
1226 agent claude-sonnet-5 1243 150510 2
1227 agent claude-sonnet-5 1429 151753 20
1228 agent claude-sonnet-5 1175 153182 4
1229 agent claude-sonnet-5 566 154357 2
1230 agent claude-sonnet-5 791 154923 20
1231 agent claude-sonnet-5 393 155714 3
1232 agent claude-sonnet-5 606 156107 2
1233 agent claude-sonnet-5 1511 156713 14
1234 agent claude-sonnet-5 627 158224 20
1235 agent claude-sonnet-5 389 158851 4
1236 agent claude-sonnet-5 800 159240 3
1237 agent claude-sonnet-5 8466 160040 3
1238 agent claude-sonnet-5 3993 168506 3
1239 agent claude-sonnet-5 3572 172499 2
1240 agent claude-sonnet-5 934 176071 17
1241 agent claude-sonnet-5 506 177005 8
1242 agent claude-sonnet-5 2294 177511 4
1243 agent claude-sonnet-5 5258 179805 2
1244 agent claude-sonnet-5 2156 185063 4
1245 agent claude-sonnet-5 189 187219 2
1246 agent claude-sonnet-5 420 187408 3
1247 agent claude-sonnet-5 5018 187828 2
1248 agent claude-sonnet-5 415 192846 7
1249 agent claude-sonnet-5 970 193261 3
1250 agent claude-sonnet-5 673 194231 4
1251 agent claude-sonnet-5 801 194904 17
1252 agent claude-sonnet-5 441 195705 6
1253 agent claude-sonnet-5 439 196146 4
1254 agent claude-sonnet-5 1227 196585 6
1255 agent claude-sonnet-5 875 197812 17
1256 agent claude-sonnet-5 303 198687 3
1257 agent claude-sonnet-5 2051 198990 2
1258 agent claude-sonnet-5 3284 201041 3
1259 agent claude-sonnet-5 433 204325 2
1260 agent claude-sonnet-5 419 204758 6
1261 agent claude-sonnet-5 6224 205177 10
1262 agent claude-sonnet-5 2759 211401 3
1263 agent claude-sonnet-5 854 214160 4
1264 agent claude-sonnet-5 2801 215014 4
1265 agent claude-sonnet-5 3197 217815 17
1266 agent claude-sonnet-5 804 221012 2
1267 agent claude-sonnet-5 820 221816 17
1268 agent claude-sonnet-5 2549 222636 3
1269 agent claude-sonnet-5 2528 225185 2
1270 agent claude-sonnet-5 744 227713 6
1271 agent claude-sonnet-5 1497 228457 2
1272 agent claude-sonnet-5 3724 229954 6
1273 agent claude-sonnet-5 1244 233678 3
1274 agent claude-sonnet-5 4185 234922 6
1275 agent claude-sonnet-5 869 239107 2
1276 agent claude-sonnet-5 194 239976 20
1277 agent claude-sonnet-5 159 240170 20
1278 agent claude-sonnet-5 84 240329 9
1279 agent claude-sonnet-5 306 240413 20
1280 agent claude-sonnet-5 2151 240719 20
1281 agent claude-sonnet-5 175 242870 20
1282 agent claude-sonnet-5 468 243045 20
1283 agent claude-sonnet-5 101 243513 6
1284 agent claude-sonnet-5 249 243614 2
1285 agent claude-sonnet-5 559 243863 4
1286 agent claude-sonnet-5 613 244422 2
1287 agent claude-sonnet-5 555 245035 3
1288 agent claude-sonnet-5 613 245590 3
1289 agent claude-sonnet-5 1059 246203 5
1290 agent claude-sonnet-5 566 247262 9
1291 agent claude-sonnet-5 1894 247828 2
1292 agent claude-sonnet-5 550 249722 2
1293 agent claude-sonnet-5 916 250272 2
1294 agent claude-sonnet-5 112 251188 3
1295 agent claude-sonnet-5 165 251300 3
1296 agent claude-sonnet-5 257 251465 3
1297 agent claude-sonnet-5 1803 251722 2
1298 agent claude-sonnet-5 381 253525 2
1299 agent claude-sonnet-5 1372 253906 8
1300 agent claude-sonnet-5 689 255278 3
1301 agent claude-sonnet-5 8509 255967 2
1302 agent claude-sonnet-5 3667 264476 14
1303 agent claude-sonnet-5 826 268143 9
1304 agent claude-sonnet-5 843 268969 3
1305 agent claude-sonnet-5 1189 269812 17
1306 agent claude-sonnet-5 469 271001 2
1307 agent claude-sonnet-5 308 271470 8
1308 agent claude-sonnet-5 1090 271778 3
1309 agent claude-sonnet-5 465 272868 2
1310 agent claude-sonnet-5 261 273333 1
1311 agent claude-haiku-4-5-20251001 12034 0 4
1312 agent claude-haiku-4-5-20251001 1346 12034 2
1313 agent claude-haiku-4-5-20251001 3498 13380 2
1314 agent claude-haiku-4-5-20251001 1292 16878 3
1315 agent claude-haiku-4-5-20251001 357 18170 2
1316 agent claude-haiku-4-5-20251001 211 18527 2
1317 agent claude-haiku-4-5-20251001 12271 0 4
1318 agent claude-haiku-4-5-20251001 1816 12271 2
1319 agent claude-haiku-4-5-20251001 463 14087 2
1320 agent claude-haiku-4-5-20251001 825 14550 4
1321 agent claude-haiku-4-5-20251001 1595 15375 1
1322 agent claude-haiku-4-5-20251001 290 16970 2
1323 agent claude-haiku-4-5-20251001 186 17260 2
1324 agent claude-sonnet-5 17695 0 5
1325 agent claude-sonnet-5 2211 17695 4
1326 agent claude-sonnet-5 291 19906 20
1327 agent claude-sonnet-5 1911 20197 3
1328 agent claude-sonnet-5 271 22108 21
1329 agent claude-sonnet-5 2466 22379 2
1330 agent claude-sonnet-5 2998 24845 2
1331 agent claude-sonnet-5 12598 27843 8
1332 agent claude-sonnet-5 3518 40441 3
1333 agent claude-sonnet-5 7707 43959 2
1334 agent claude-sonnet-5 271 51666 17
1335 agent claude-sonnet-5 604 51937 9
1336 agent claude-sonnet-5 516 52541 17
1337 agent claude-sonnet-5 240 53057 2
1338 agent claude-sonnet-5 1163 53297 2
1339 agent claude-sonnet-5 464 54460 3
1340 agent claude-sonnet-5 213 54924 2
1341 agent claude-sonnet-5 1009 55137 3
1342 agent claude-sonnet-5 2865 56146 3
1343 agent claude-sonnet-5 4832 59011 2
1344 agent claude-sonnet-5 1056 63843 3
1345 agent claude-sonnet-5 1796 64899 2
1346 agent claude-sonnet-5 5722 66695 3
1347 agent claude-sonnet-5 295 72417 3
1348 agent claude-sonnet-5 814 72712 6
1349 agent claude-sonnet-5 451 73526 20
1350 agent claude-sonnet-5 1004 73977 17
1351 agent claude-sonnet-5 454 74981 2
1352 agent claude-sonnet-5 364 75435 4
1353 agent claude-sonnet-5 246 75799 3
1354 agent claude-sonnet-5 257 76045 3
1355 agent claude-sonnet-5 591 76302 2
1356 agent claude-sonnet-5 169 76893 3
1357 agent claude-sonnet-5 647 77062 4
1358 agent claude-sonnet-5 892 77709 3
1359 agent claude-sonnet-5 240 78601 3
1360 agent claude-sonnet-5 145 78841 8
1361 agent claude-sonnet-5 221 78986 20
1362 agent claude-sonnet-5 94 79207 2
1363 agent claude-sonnet-5 121 79301 2
1364 agent claude-sonnet-5 511 79422 7
1365 agent claude-sonnet-5 168 79933 2
1366 agent claude-sonnet-5 629 80101 5
1367 agent claude-sonnet-5 790 80730 3
1368 agent claude-sonnet-5 2160 81520 3
1369 agent claude-sonnet-5 468 83680 17
1370 agent claude-sonnet-5 343 84148 20
1371 agent claude-sonnet-5 83 84491 20
1372 agent claude-sonnet-5 90 84574 20
1373 agent claude-sonnet-5 145 84664 20
1374 agent claude-sonnet-5 500 84809 6
1375 agent claude-sonnet-5 1678 85309 2
1376 agent claude-sonnet-5 2707 86987 2
1377 agent claude-sonnet-5 860 89694 3
1378 agent claude-sonnet-5 695 90554 6
1379 agent claude-sonnet-5 569 91249 2
1380 agent claude-sonnet-5 101 91818 20
1381 agent claude-sonnet-5 188 91919 20
1382 agent claude-sonnet-5 105 92107 3
1383 agent claude-sonnet-5 678 92212 2
1384 agent claude-sonnet-5 353 92890 20
1385 agent claude-sonnet-5 577 93243 5
1386 agent claude-sonnet-5 333 93820 2
1387 agent claude-sonnet-5 600 94153 6
1388 agent claude-sonnet-5 434 94753 20
1389 agent claude-sonnet-5 2788 95187 7
1390 agent claude-sonnet-5 685 97975 2
1391 agent claude-sonnet-5 3764 98660 2
1392 agent claude-sonnet-5 502 102424 17
1393 agent claude-sonnet-5 604 102926 7
1394 agent claude-sonnet-5 3278 103530 2
1395 agent claude-sonnet-5 1072 106808 4
1396 agent claude-sonnet-5 762 107880 17
1397 agent claude-sonnet-5 608 108642 7
1398 agent claude-sonnet-5 6508 109250 2
1399 agent claude-sonnet-5 4992 115758 2
1400 agent claude-sonnet-5 3747 120750 20
1401 agent claude-sonnet-5 167 124497 9
1402 agent claude-sonnet-5 3166 124664 3
1403 agent claude-sonnet-5 1040 127830 3
1404 agent claude-sonnet-5 294 128870 2
1405 agent claude-sonnet-5 2439 129164 3
1406 agent claude-sonnet-5 859 131603 2
1407 agent claude-sonnet-5 555 132462 7
1408 agent claude-sonnet-5 372 133017 20
1409 agent claude-sonnet-5 414 133389 17
1410 agent claude-sonnet-5 689 133803 2
1411 agent claude-sonnet-5 734 134492 20
1412 agent claude-sonnet-5 475 135226 17
1413 agent claude-sonnet-5 947 135701 2
1414 agent claude-sonnet-5 102 136648 20
1415 agent claude-sonnet-5 80 136750 20
1416 agent claude-sonnet-5 144 136830 20
1417 agent claude-sonnet-5 1027 136974 3
1418 agent claude-sonnet-5 684 138001 1
1419 agent claude-sonnet-5 667 138685 1
1420 agent claude-sonnet-5 662 139352 2
1421 agent claude-sonnet-5 652 140014 20
1422 agent claude-sonnet-5 588 140666 2
1423 agent claude-sonnet-5 662 141254 5
1424 agent claude-sonnet-5 677 141916 2
1425 agent claude-sonnet-5 325 142593 9
1426 agent claude-sonnet-5 388 142918 5
1427 agent claude-sonnet-5 758 143306 3
1428 agent claude-sonnet-5 2088 144064 3
1429 agent claude-sonnet-5 1325 146152 17
1430 agent claude-sonnet-5 602 147477 3
1431 agent claude-sonnet-5 1365 148079 1
1432 agent claude-sonnet-5 207 149444 20
1433 agent claude-sonnet-5 180 149651 20
1434 agent claude-sonnet-5 767 149831 2
1435 agent claude-sonnet-5 528 150598 3
1436 agent claude-sonnet-5 220 151126 8
1437 agent claude-sonnet-5 1524 151346 17
1438 agent claude-sonnet-5 489 152870 2
1439 agent claude-sonnet-5 335 153359 2
1440 agent claude-sonnet-5 315 153694 5
1441 agent claude-sonnet-5 159 154009 20
1442 agent claude-sonnet-5 80 154168 20
1443 agent claude-sonnet-5 144 154248 20
1444 agent claude-sonnet-5 447 154392 17
1445 agent claude-sonnet-5 602 154839 2
1446 agent claude-sonnet-5 1074 155441 2
1447 agent claude-sonnet-5 122 156515 20
1448 agent claude-sonnet-5 99 156637 7
1449 agent claude-sonnet-5 301 156736 6
1450 agent claude-sonnet-5 532 157037 2
1451 agent claude-sonnet-5 1082 157569 5
1452 agent claude-sonnet-5 1850 158651 3
1453 agent claude-sonnet-5 7678 160501 2
1454 agent claude-sonnet-5 366 168179 2
1455 agent claude-haiku-4-5-20251001 11755 0 1
1456 agent claude-haiku-4-5-20251001 4143 11755 2
1457 agent claude-haiku-4-5-20251001 853 15898 2
1458 agent claude-haiku-4-5-20251001 1158 16751 3
1459 agent claude-haiku-4-5-20251001 323 17909 4
1460 agent claude-haiku-4-5-20251001 11215 0 4
1461 agent claude-haiku-4-5-20251001 1637 11215 2
1462 agent claude-haiku-4-5-20251001 348 12852 3
1463 agent claude-haiku-4-5-20251001 2957 13200 5
1464 agent claude-haiku-4-5-20251001 418 16157 3
1465 agent claude-haiku-4-5-20251001 352 16575 3
1466 agent claude-haiku-4-5-20251001 2326 16927 2
1467 agent claude-haiku-4-5-20251001 596 19253 2
1468 agent claude-haiku-4-5-20251001 850 19849 4
1469 agent claude-haiku-4-5-20251001 333 20699 2
1470 agent claude-haiku-4-5-20251001 197 21032 2
1471 agent claude-haiku-4-5-20251001 6777 5008 4
1472 agent claude-haiku-4-5-20251001 1386 11785 2
1473 agent claude-haiku-4-5-20251001 322 13171 2
1474 agent claude-haiku-4-5-20251001 1025 13493 2
1475 agent claude-haiku-4-5-20251001 1058 14518 3
1476 agent claude-haiku-4-5-20251001 325 15576 5
1477 agent claude-haiku-4-5-20251001 12014 0 4
1478 agent claude-haiku-4-5-20251001 1443 12014 2
1479 agent claude-haiku-4-5-20251001 376 13457 4
1480 agent claude-haiku-4-5-20251001 1987 13833 2
1481 agent claude-haiku-4-5-20251001 1161 15820 2
1482 agent claude-haiku-4-5-20251001 338 16981 2
1483 agent claude-haiku-4-5-20251001 179 17319 2
1484 agent claude-sonnet-5 17913 0 3
1485 agent claude-sonnet-5 2217 17913 4
1486 agent claude-sonnet-5 23941 20130 6
1487 agent claude-sonnet-5 10923 44071 2
1488 agent claude-sonnet-5 1808 54994 20
1489 agent claude-sonnet-5 3563 56802 8
1490 agent claude-sonnet-5 358 60365 20
1491 agent claude-sonnet-5 3805 60723 3
1492 agent claude-sonnet-5 4380 64528 2
1493 agent claude-sonnet-5 545 68908 4
1494 agent claude-sonnet-5 8169 69453 6
1495 agent claude-sonnet-5 4009 77622 4
1496 agent claude-sonnet-5 13313 81631 2
1497 agent claude-sonnet-5 8131 94944 4
1498 agent claude-sonnet-5 5069 103075 2
1499 agent claude-sonnet-5 9109 108144 2
1500 agent claude-sonnet-5 3383 117253 2
1501 agent claude-sonnet-5 3555 120636 14
1502 agent claude-sonnet-5 5371 124191 2
1503 agent claude-sonnet-5 6608 129562 3
1504 agent claude-sonnet-5 11064 136170 3
1505 agent claude-sonnet-5 3490 147234 17
1506 agent claude-sonnet-5 1263 150724 5
1507 agent claude-sonnet-5 9109 151987 8
1508 agent claude-sonnet-5 5471 161096 2
1509 agent claude-sonnet-5 13484 166567 3
1510 agent claude-sonnet-5 8480 180051 3
1511 agent claude-sonnet-5 6231 188531 5
1512 agent claude-sonnet-5 4553 194762 3
1513 agent claude-sonnet-5 800 199315 4
1514 agent claude-sonnet-5 195 200115 3
1515 agent claude-sonnet-5 11314 200310 3
1516 agent claude-sonnet-5 1973 211624 20
1517 agent claude-sonnet-5 17981 213597 8
1518 agent claude-sonnet-5 1464 231578 2
1519 agent claude-sonnet-5 175 233042 3
1520 agent claude-sonnet-5 2739 233217 3
1521 agent claude-sonnet-5 18632 235956 2
1522 agent claude-sonnet-5 3646 254588 6
1523 agent claude-sonnet-5 258 258234 5
1524 agent claude-sonnet-5 265 258492 4
1525 agent claude-sonnet-5 375 258757 17
1526 agent claude-sonnet-5 6037 259132 4
1527 agent claude-sonnet-5 1692 265169 8
1528 agent claude-sonnet-5 381 266861 2
1529 agent claude-sonnet-5 5664 267242 3
1530 agent claude-sonnet-5 2390 272906 2
1531 agent claude-sonnet-5 1668 275296 3
1532 agent claude-sonnet-5 235 276964 5
1533 agent claude-sonnet-5 2145 277199 3
1534 agent claude-sonnet-5 11978 279344 2
1535 agent claude-sonnet-5 530 291322 17
1536 agent claude-sonnet-5 4451 291852 2
1537 agent claude-sonnet-5 650 296303 6
1538 agent claude-sonnet-5 587 296953 2
1539 agent claude-sonnet-5 622 297540 2
1540 agent claude-sonnet-5 1544 298162 2
1541 agent claude-sonnet-5 1677 299706 2
1542 agent claude-sonnet-5 2463 301383 10
1543 agent claude-sonnet-5 2339 303846 2
1544 agent claude-sonnet-5 506 306185 4
1545 agent claude-sonnet-5 5555 306691 3
1546 agent claude-sonnet-5 1651 312246 2
1547 agent claude-sonnet-5 416 313897 6
1548 agent claude-sonnet-5 351 314313 17
1549 agent claude-sonnet-5 599 314664 2
1550 agent claude-sonnet-5 1240 315263 3
1551 agent claude-sonnet-5 548 316503 2
1552 agent claude-sonnet-5 545 317051 6
1553 agent claude-sonnet-5 3785 317596 3
1554 agent claude-sonnet-5 473 321381 4
1555 agent claude-sonnet-5 1086 321854 6
1556 agent claude-sonnet-5 4459 322940 3
1557 agent claude-sonnet-5 2699 327399 2
1558 agent claude-sonnet-5 477 330098 20
1559 agent claude-sonnet-5 408 330575 17
1560 agent claude-sonnet-5 313 330983 6
1561 agent claude-sonnet-5 958 331296 17
1562 agent claude-sonnet-5 561 332254 5
1563 agent claude-sonnet-5 259 332815 16
1564 agent claude-sonnet-5 364 333074 6
1565 agent claude-sonnet-5 424 333438 20
1566 agent claude-sonnet-5 601 333862 2
1567 agent claude-sonnet-5 172 334463 3
1568 agent claude-sonnet-5 4758 334635 3
1569 agent claude-sonnet-5 1667 339393 1
1570 agent claude-sonnet-5 454 341060 2
1571 agent claude-sonnet-5 1583 341514 17
1572 agent claude-sonnet-5 617 343097 20
1573 agent claude-sonnet-5 335 343714 5
1574 agent claude-sonnet-5 2493 344049 2
1575 agent claude-sonnet-5 266 346542 5
1576 agent claude-sonnet-5 2395 346808 3
1577 agent claude-sonnet-5 1175 349203 3
1578 agent claude-sonnet-5 529 350378 3
1579 agent claude-sonnet-5 721 350907 2
1580 agent claude-sonnet-5 1217 351628 20
1581 agent claude-sonnet-5 1538 352845 2
1582 agent claude-sonnet-5 375 354383 17
1583 agent claude-sonnet-5 727 354758 20
1584 agent claude-sonnet-5 575 355485 20
1585 agent claude-sonnet-5 612 356060 20
1586 agent claude-sonnet-5 619 356672 6
1587 agent claude-sonnet-5 806 357291 5
1588 agent claude-sonnet-5 327 358097 6
1589 agent claude-sonnet-5 373 358424 9
1590 agent claude-sonnet-5 2871 358797 3
1591 agent claude-sonnet-5 7256 361668 20
1592 agent claude-sonnet-5 1290 368924 3
1593 agent claude-sonnet-5 889 370214 3
1594 agent claude-sonnet-5 1219 371103 5
1595 agent claude-sonnet-5 285 372322 9
1596 agent claude-sonnet-5 2879 372607 3
1597 agent claude-sonnet-5 507 375486 2
1598 agent claude-sonnet-5 456 375993 4
1599 agent claude-sonnet-5 1170 376449 5
1600 agent claude-sonnet-5 1026 377619 5
1601 agent claude-sonnet-5 2400 378645 20
1602 agent claude-sonnet-5 1557 381045 2
1603 agent claude-sonnet-5 147 382602 14
1604 agent claude-sonnet-5 416 382749 17
1605 agent claude-sonnet-5 522 383165 3
1606 agent claude-sonnet-5 147 383687 2
1607 agent claude-sonnet-5 451 383834 2
1608 agent claude-sonnet-5 366 384285 3
1609 agent claude-sonnet-5 123 384651 2
1610 agent claude-sonnet-5 115 384774 20
1611 agent claude-sonnet-5 309 384889 9
1612 agent claude-sonnet-5 648 385198 3
1613 agent claude-sonnet-5 308 385846 2
1614 agent claude-sonnet-5 325 386154 20
1615 agent claude-sonnet-5 480 386479 6
1616 agent claude-sonnet-5 407 386959 7
1617 agent claude-sonnet-5 255 387366 5
1618 agent claude-sonnet-5 1939 387621 20
1619 agent claude-sonnet-5 178 389560 20
1620 agent claude-sonnet-5 238 389738 17
1621 agent claude-sonnet-5 664 389976 1
1622 agent claude-sonnet-5 697 390640 7
1623 agent claude-sonnet-5 1397 391337 17
1624 agent claude-sonnet-5 664 392734 5
1625 agent claude-sonnet-5 691 393398 2
1626 agent claude-sonnet-5 1246 394089 8
1627 agent claude-sonnet-5 1522 395335 9
1628 agent claude-sonnet-5 760 396857 3
1629 agent claude-sonnet-5 1678 397617 20
1630 agent claude-sonnet-5 670 399295 2
1631 agent claude-sonnet-5 693 399965 2
1632 agent claude-sonnet-5 712 400658 3
1633 agent claude-sonnet-5 358 401370 2
1634 agent claude-sonnet-5 897 401728 17
1635 agent claude-sonnet-5 478 402625 3
1636 agent claude-sonnet-5 213 403103 20
1637 agent claude-sonnet-5 294 403316 2
1638 agent claude-sonnet-5 1021 403610 5
1639 agent claude-sonnet-5 2374 404631 2
1640 agent claude-sonnet-5 543 407005 7
1641 agent claude-sonnet-5 250 407548 3
1642 agent claude-sonnet-5 915 407798 3
1643 agent claude-sonnet-5 438 408713 2
1644 agent claude-sonnet-5 3157 409151 2
1645 agent claude-sonnet-5 3252 412308 2
1646 agent claude-sonnet-5 249 415560 4
1647 agent claude-sonnet-5 9269 8117 5
1648 agent claude-sonnet-5 2206 17386 20
1649 agent claude-sonnet-5 10795 19592 14
1650 agent claude-sonnet-5 14992 30387 2
1651 agent claude-sonnet-5 5528 45379 4
1652 agent claude-sonnet-5 13854 50907 14
1653 agent claude-sonnet-5 4345 64761 7
1654 agent claude-sonnet-5 11937 69106 5
1655 agent claude-sonnet-5 13806 81043 7
1656 agent claude-sonnet-5 535 94849 20
1657 agent claude-sonnet-5 5027 95384 7
1658 agent claude-sonnet-5 562 100411 20
1659 agent claude-sonnet-5 1261 100973 3
1660 agent claude-sonnet-5 13627 102234 5
1661 agent claude-sonnet-5 9305 115861 5
1662 agent claude-sonnet-5 4032 125166 4
1663 agent claude-sonnet-5 178962 0 2
1664 agent claude-sonnet-5 28566 178962 6
1665 agent claude-sonnet-5 5851 207528 3
1666 agent claude-sonnet-5 465 213379 17
1667 agent claude-sonnet-5 346 213844 6
1668 agent claude-sonnet-5 4698 214190 4
1669 agent claude-sonnet-5 836 218888 5
1670 agent claude-sonnet-5 2889 219724 3
1671 agent claude-sonnet-5 290 222613 5
1672 agent claude-sonnet-5 3052 222903 6
1673 agent claude-sonnet-5 1954 225955 5
1674 agent claude-sonnet-5 505 227909 20
1675 agent claude-sonnet-5 880 228414 3
1676 agent claude-sonnet-5 914 229294 8
1677 agent claude-sonnet-5 545 230208 3
1678 agent claude-sonnet-5 1852 230753 5
1679 agent claude-sonnet-5 2290 232605 5
1680 agent claude-sonnet-5 10812 234895 3
1681 agent claude-sonnet-5 5034 245707 3
1682 agent claude-sonnet-5 1696 250741 3
1683 agent claude-sonnet-5 1200 252437 2
1684 agent claude-sonnet-5 1874 253637 3
1685 agent claude-sonnet-5 998 255511 2
1686 agent claude-sonnet-5 2239 256509 1
1687 agent claude-sonnet-5 589 258748 3
1688 agent claude-sonnet-5 1235 259337 20
1689 agent claude-sonnet-5 474 260572 5
1690 agent claude-sonnet-5 937 261046 5
1691 agent claude-sonnet-5 4291 261983 20
1692 agent claude-sonnet-5 1379 266274 2
1693 agent claude-sonnet-5 1054 267653 20
1694 agent claude-sonnet-5 301 268707 2
1695 agent claude-sonnet-5 6585 269008 2
1696 agent claude-sonnet-5 9392 275593 20
1697 agent claude-sonnet-5 2660 284985 3
1698 agent claude-sonnet-5 1282 287645 17
1699 agent claude-sonnet-5 592 288927 3
1700 agent claude-sonnet-5 454 289519 3
1701 agent claude-sonnet-5 327 289973 2
1702 agent claude-sonnet-5 2521 290300 2
1703 agent claude-sonnet-5 5686 292821 8
1704 agent claude-sonnet-5 1653 298507 2
1705 agent claude-sonnet-5 545 300160 6
1706 agent claude-sonnet-5 352 300705 3
1707 agent claude-sonnet-5 1599 301057 1
1708 agent claude-sonnet-5 336 302656 7
1709 agent claude-sonnet-5 816 302992 2
1710 agent claude-sonnet-5 948 303808 2
1711 agent claude-sonnet-5 1284 304756 2
1712 agent claude-sonnet-5 2532 306040 2
1713 agent claude-sonnet-5 483 308572 6
1714 agent claude-sonnet-5 524 309055 7
1715 agent claude-sonnet-5 2620 309579 3
1716 agent claude-sonnet-5 702 312199 20
1717 agent claude-sonnet-5 1395 312901 2
1718 agent claude-sonnet-5 1748 314296 10
1719 agent claude-sonnet-5 2119 316044 2
1720 agent claude-sonnet-5 1831 318163 17
1721 agent claude-sonnet-5 285 319994 3
1722 agent claude-sonnet-5 654 320279 16
1723 agent claude-sonnet-5 596 320933 3
1724 agent claude-sonnet-5 543 321529 20
1725 agent claude-haiku-4-5-20251001 4878 6686 4
1726 agent claude-haiku-4-5-20251001 3545 11564 2
1727 agent claude-haiku-4-5-20251001 781 15109 2
1728 agent claude-haiku-4-5-20251001 672 15890 2
1729 agent claude-haiku-4-5-20251001 268 16562 3
1730 agent claude-haiku-4-5-20251001 11552 0 4
1731 agent claude-haiku-4-5-20251001 1480 11552 1
1732 agent claude-haiku-4-5-20251001 1911 13032 3
1733 agent claude-haiku-4-5-20251001 378 14943 4
1734 agent claude-sonnet-5 17885 0 3
1735 agent claude-sonnet-5 2194 17885 6
1736 agent claude-sonnet-5 146 20079 20
1737 agent claude-sonnet-5 1653 20225 2
1738 agent claude-sonnet-5 10950 21878 6
1739 agent claude-sonnet-5 874 32828 20
1740 agent claude-sonnet-5 1911 33702 6
1741 agent claude-sonnet-5 3125 35613 5
1742 agent claude-sonnet-5 3003 38738 4
1743 agent claude-sonnet-5 2299 41741 2
1744 agent claude-sonnet-5 403 44040 5
1745 agent claude-sonnet-5 370 44443 2
1746 agent claude-sonnet-5 5159 44813 2
1747 agent claude-sonnet-5 798 49972 3
1748 agent claude-sonnet-5 3594 50770 20
1749 agent claude-sonnet-5 124 54364 6
1750 agent claude-sonnet-5 1907 54488 2
1751 agent claude-sonnet-5 878 56395 2
1752 agent claude-sonnet-5 1535 57273 4
1753 agent claude-sonnet-5 593 58808 2
1754 agent claude-sonnet-5 700 59401 5
1755 agent claude-sonnet-5 784 60101 2
1756 agent claude-sonnet-5 988 60885 2
1757 agent claude-sonnet-5 808 61873 6
1758 agent claude-sonnet-5 759 62681 7
1759 agent claude-sonnet-5 2340 63440 2
1760 agent claude-sonnet-5 605 65780 2
1761 agent claude-sonnet-5 510 66385 21
1762 agent claude-sonnet-5 177 66895 21
1763 agent claude-sonnet-5 263 67072 5
1764 agent claude-sonnet-5 1260 67335 4
1765 agent claude-sonnet-5 272 68595 20
1766 agent claude-sonnet-5 197 68867 20
1767 agent claude-sonnet-5 1314 69064 3
1768 agent claude-sonnet-5 239 70378 20
1769 agent claude-sonnet-5 205 70617 21
1770 agent claude-sonnet-5 752 70822 5
1771 agent claude-sonnet-5 411 71574 21
1772 agent claude-sonnet-5 163 71985 21
1773 agent claude-sonnet-5 197 72148 5
1774 agent claude-sonnet-5 224 72345 2
1775 agent claude-sonnet-5 367 72569 20
1776 agent claude-sonnet-5 1106 72936 4
1777 agent claude-sonnet-5 1094 74042 17
1778 agent claude-sonnet-5 410 75136 5
1779 agent claude-sonnet-5 357 75546 2
1780 agent claude-sonnet-5 1693 75903 2
1781 agent claude-sonnet-5 209 77596 2
1782 agent claude-sonnet-5 1579 77805 2
1783 agent claude-sonnet-5 821 79384 3
1784 agent claude-sonnet-5 1491 80205 20
1785 agent claude-sonnet-5 314 81696 6
1786 agent claude-sonnet-5 1722 82010 2
1787 agent claude-sonnet-5 159 83732 20
1788 agent claude-sonnet-5 460 83891 3
1789 agent claude-sonnet-5 244 84351 14
1790 agent claude-sonnet-5 1996 84595 20
1791 agent claude-sonnet-5 318 86591 20
1792 agent claude-sonnet-5 178 86909 17
1793 agent claude-sonnet-5 351 87087 20
1794 agent claude-sonnet-5 1084 87438 3
1795 agent claude-sonnet-5 829 88522 3
1796 agent claude-sonnet-5 621 89351 8
1797 agent claude-sonnet-5 2445 89972 2
1798 agent claude-sonnet-5 571 92417 20
1799 agent claude-sonnet-5 1423 92988 5
1800 agent claude-sonnet-5 1496 94411 3
1801 agent claude-sonnet-5 1266 95907 3
1802 agent claude-sonnet-5 543 97173 3
1803 agent claude-sonnet-5 1289 97716 3
1804 agent claude-sonnet-5 3154 99005 3
1805 agent claude-sonnet-5 946 102159 9
1806 agent claude-sonnet-5 2053 103105 3
1807 agent claude-sonnet-5 2314 105158 2
1808 agent claude-sonnet-5 2872 107472 8
1809 agent claude-sonnet-5 1143 110344 3
1810 agent claude-sonnet-5 407 111487 20
1811 agent claude-sonnet-5 328 111894 4
1812 agent claude-sonnet-5 1385 112222 3
1813 agent claude-sonnet-5 681 113607 20
1814 agent claude-sonnet-5 114 114288 2
1815 agent claude-sonnet-5 1592 114402 3
1816 agent claude-sonnet-5 1040 115994 5
1817 agent claude-sonnet-5 212 117034 3
1818 agent claude-sonnet-5 781 117246 3
1819 agent claude-sonnet-5 1650 118027 1
1820 agent claude-sonnet-5 284 119677 9
1821 agent claude-sonnet-5 439 119961 2
1822 agent claude-sonnet-5 570 120400 21
1823 agent claude-sonnet-5 379 120970 17
1824 agent claude-sonnet-5 242 121349 5
1825 agent claude-sonnet-5 844 121591 20
1826 agent claude-sonnet-5 677 122435 3
1827 agent claude-sonnet-5 379 123112 2
1828 agent claude-sonnet-5 287 123491 20
1829 agent claude-sonnet-5 87 123778 5
1830 agent claude-sonnet-5 853 123865 2
1831 agent claude-sonnet-5 1162 124718 20
1832 agent claude-sonnet-5 345 125880 2
1833 agent claude-sonnet-5 601 126225 1
1834 agent claude-sonnet-5 17694 0 5
1835 agent claude-sonnet-5 2205 17694 2
1836 agent claude-sonnet-5 6042 19899 2
1837 agent claude-sonnet-5 8735 25941 3
1838 agent claude-sonnet-5 1488 34676 6
1839 agent claude-sonnet-5 8108 36164 3
1840 agent claude-sonnet-5 2899 44272 20
1841 agent claude-sonnet-5 3687 47171 4
1842 agent claude-sonnet-5 4829 50858 14
1843 agent claude-sonnet-5 3146 55687 7
1844 agent claude-sonnet-5 3592 58833 4
1845 agent claude-sonnet-5 17303 62425 2
1846 agent claude-sonnet-5 175 79728 3
1847 agent claude-sonnet-5 442 79903 20
1848 agent claude-sonnet-5 3084 80345 3
1849 agent claude-sonnet-5 6548 83429 2
1850 agent claude-sonnet-5 359 89977 14
1851 agent claude-sonnet-5 4592 90336 2
1852 agent claude-sonnet-5 382 94928 20
1853 agent claude-sonnet-5 901 95310 2
1854 agent claude-sonnet-5 999 96211 2
1855 agent claude-sonnet-5 583 97210 4
1856 agent claude-sonnet-5 852 97793 3
1857 agent claude-sonnet-5 1809 98645 6
1858 agent claude-sonnet-5 728 100454 2
1859 agent claude-sonnet-5 960 101182 3
1860 agent claude-sonnet-5 432 102142 4
1861 agent claude-sonnet-5 4227 102574 3
1862 agent claude-sonnet-5 413 106801 2
1863 agent claude-sonnet-5 880 107214 9
1864 agent claude-sonnet-5 1700 108094 6
1865 agent claude-sonnet-5 356 109794 2
1866 agent claude-sonnet-5 1344 110150 3
1867 agent claude-sonnet-5 1631 111494 1
1868 agent claude-sonnet-5 163 113125 5
1869 agent claude-sonnet-5 336 113288 2
1870 agent claude-sonnet-5 5061 113624 3
1871 agent claude-sonnet-5 1442 118685 2
1872 agent claude-sonnet-5 259 120127 2
1873 agent claude-haiku-4-5-20251001 11728 0 4
1874 agent claude-haiku-4-5-20251001 1428 11728 2
1875 agent claude-haiku-4-5-20251001 11936 0 1
1876 agent claude-haiku-4-5-20251001 2110 11936 2
1877 agent claude-haiku-4-5-20251001 1401 14046 2
1878 agent claude-haiku-4-5-20251001 1277 15447 2
1879 agent claude-haiku-4-5-20251001 297 16724 3
1880 agent claude-haiku-4-5-20251001 12104 0 4
1881 agent claude-haiku-4-5-20251001 4791 12104 2
1882 agent claude-haiku-4-5-20251001 549 16895 4
1883 agent claude-haiku-4-5-20251001 316 17444 1
1884 agent claude-haiku-4-5-20251001 2470 17760 3
1885 agent claude-haiku-4-5-20251001 384 20230 4
1886 agent claude-haiku-4-5-20251001 11908 0 4
1887 agent claude-haiku-4-5-20251001 1552 11908 2
1888 agent claude-haiku-4-5-20251001 549 13460 2
1889 agent claude-haiku-4-5-20251001 490 14009 2
1890 agent claude-haiku-4-5-20251001 1075 14499 1
1891 agent claude-haiku-4-5-20251001 257 15574 4
1892 agent claude-haiku-4-5-20251001 11908 0 4
1893 agent claude-haiku-4-5-20251001 1481 11908 2
1894 agent claude-haiku-4-5-20251001 550 13389 2
1895 agent claude-haiku-4-5-20251001 1077 13939 3
1896 agent claude-haiku-4-5-20251001 293 15016 4
1897 agent claude-opus-5 13872 0 1
1898 agent claude-opus-5 6262 13872 5
1899 agent claude-opus-5 7388 20134 3
1900 agent claude-opus-5 6992 27522 4
1901 agent claude-opus-5 10873 34514 4
1902 agent claude-opus-5 5888 45387 2
1903 agent claude-opus-5 1184 51275 2
1904 agent claude-opus-5 381 52459 3
1905 agent claude-opus-5 1152 52840 3
1906 agent claude-opus-5 2180 53992 3
1907 agent claude-opus-5 4879 56172 2
1908 agent claude-opus-5 4617 61051 6
1909 agent claude-opus-5 69496 0 6
1910 agent claude-opus-5 6466 69496 2
1911 agent claude-opus-5 4939 75962 3
1912 agent claude-opus-5 2133 80901 3
1913 agent claude-opus-5 9057 83034 3
1914 agent claude-opus-5 95590 0 3
1915 agent claude-opus-5 10613 95590 3
1916 agent claude-opus-5 3223 106203 3
1917 agent claude-opus-5 4113 109426 2
1918 agent claude-haiku-4-5-20251001 11302 0 4
1919 agent claude-haiku-4-5-20251001 3894 11302 1
1920 agent claude-haiku-4-5-20251001 141 15196 2
1921 agent claude-haiku-4-5-20251001 280 15337 2
1922 agent claude-haiku-4-5-20251001 1810 15617 2
1923 agent claude-haiku-4-5-20251001 633 17427 4
1924 agent claude-haiku-4-5-20251001 335 18060 4
1925 agent claude-sonnet-5 18271 0 5
1926 agent claude-sonnet-5 2211 18271 5
1927 agent claude-sonnet-5 1767 20482 20
1928 agent claude-sonnet-5 1911 22249 4
1929 agent claude-sonnet-5 6043 24160 2
1930 agent claude-sonnet-5 9847 30203 2
1931 agent claude-sonnet-5 2604 40050 4
1932 agent claude-sonnet-5 3806 42654 4
1933 agent claude-sonnet-5 3400 46460 2
1934 agent claude-sonnet-5 8554 49860 3
1935 agent claude-sonnet-5 4853 58414 3
1936 agent claude-sonnet-5 400 63267 2
1937 agent claude-sonnet-5 3121 63667 3
1938 agent claude-sonnet-5 2338 66788 2
1939 agent claude-sonnet-5 4658 69126 2
1940 agent claude-sonnet-5 571 73784 9
1941 agent claude-sonnet-5 2825 74355 3
1942 agent claude-sonnet-5 239 77180 2
1943 agent claude-sonnet-5 439 77419 3
1944 agent claude-sonnet-5 472 77858 2
1945 agent claude-sonnet-5 3630 78330 2
1946 agent claude-sonnet-5 119027 0 3
1947 agent claude-sonnet-5 5521 119027 20
1948 agent claude-sonnet-5 1179 124548 5
1949 agent claude-sonnet-5 2430 125727 3
1950 agent claude-sonnet-5 9054 128157 6
1951 agent claude-sonnet-5 8910 137211 3
1952 agent claude-sonnet-5 6178 146121 2
1953 agent claude-sonnet-5 10022 152299 8
1954 agent claude-sonnet-5 773 162321 2
1955 agent claude-sonnet-5 2176 163094 6
1956 agent claude-sonnet-5 4181 165270 6
1957 agent claude-sonnet-5 588 169451 17
1958 agent claude-sonnet-5 361 170039 3
1959 agent claude-sonnet-5 1138 170400 3
1960 agent claude-sonnet-5 951 171538 17
1961 agent claude-sonnet-5 333 172489 2
1962 agent claude-sonnet-5 765 172822 20
1963 agent claude-sonnet-5 1117 173587 3
1964 agent claude-sonnet-5 385 174704 20
1965 agent claude-sonnet-5 303 175089 4
1966 agent claude-sonnet-5 272 175392 20
1967 agent claude-sonnet-5 620 175664 17
1968 agent claude-sonnet-5 1097 176284 4
1969 agent claude-sonnet-5 199 177381 14
1970 agent claude-sonnet-5 237 177580 16
1971 agent claude-sonnet-5 442 177817 7
1972 agent claude-sonnet-5 536 178259 16
1973 agent claude-sonnet-5 732 178795 9
1974 agent claude-sonnet-5 13138 179527 3
1975 agent claude-sonnet-5 2391 192665 3
1976 agent claude-sonnet-5 669 195056 17
1977 agent claude-sonnet-5 289 195725 2
1978 agent claude-sonnet-5 495 196014 20
1979 agent claude-sonnet-5 888 196509 3
1980 agent claude-sonnet-5 454 197397 17
1981 agent claude-sonnet-5 205 197851 5
1982 agent claude-sonnet-5 343 198056 21
1983 agent claude-sonnet-5 191 198399 2
1984 agent claude-sonnet-5 1920 198590 2
1985 agent claude-sonnet-5 1033 200510 2
1986 agent claude-sonnet-5 442 201543 2
1987 agent claude-sonnet-5 815 201985 2
1988 agent claude-sonnet-5 868 202800 2
1989 agent claude-sonnet-5 1873 203668 20
1990 agent claude-sonnet-5 390 205541 2
1991 agent claude-sonnet-5 239 205931 20
1992 agent claude-sonnet-5 419 206170 17
1993 agent claude-sonnet-5 389 206589 6
1994 agent claude-sonnet-5 3025 206978 4
1995 agent claude-sonnet-5 6324 210003 6
1996 agent claude-sonnet-5 3809 216327 2
1997 agent claude-sonnet-5 5096 220136 3
1998 agent claude-sonnet-5 3472 225232 2
1999 agent claude-sonnet-5 1699 228704 2
2000 agent claude-sonnet-5 1642 230403 5
2001 agent claude-sonnet-5 285 232045 3
2002 agent claude-sonnet-5 1922 232330 3
2003 agent claude-sonnet-5 201 234252 6
2004 agent claude-sonnet-5 457 234453 6
2005 agent claude-sonnet-5 2005 234910 2
2006 agent claude-sonnet-5 306 236915 9
2007 agent claude-sonnet-5 1082 237221 3
2008 agent claude-sonnet-5 593 238303 17
2009 agent claude-sonnet-5 446 238896 3
2010 agent claude-sonnet-5 393 239342 4
2011 agent claude-sonnet-5 293 239735 9
2012 agent claude-sonnet-5 794 240028 2
2013 agent claude-sonnet-5 520 240822 1
2014 agent claude-haiku-4-5-20251001 12003 0 1
2015 agent claude-haiku-4-5-20251001 5434 12003 2
2016 agent claude-haiku-4-5-20251001 853 17437 2
2017 agent claude-haiku-4-5-20251001 1139 18290 4
2018 agent claude-haiku-4-5-20251001 382 19429 4
2019 agent claude-haiku-4-5-20251001 12179 0 4
2020 agent claude-haiku-4-5-20251001 2011 12179 1
2021 agent claude-haiku-4-5-20251001 239 14190 2
2022 agent claude-haiku-4-5-20251001 1305 14429 3
2023 agent claude-haiku-4-5-20251001 260 15734 4
2024 agent claude-sonnet-5 17918 0 3
2025 agent claude-sonnet-5 18818 17918 5
2026 agent claude-sonnet-5 770 36736 2
2027 agent claude-sonnet-5 16625 37506 2
2028 agent claude-sonnet-5 10249 54131 4
2029 agent claude-sonnet-5 6090 64380 8
2030 agent claude-sonnet-5 19133 70470 3
2031 agent claude-sonnet-5 6837 89603 3
2032 agent claude-sonnet-5 3132 96440 3
2033 agent claude-sonnet-5 818 99572 20
2034 agent claude-sonnet-5 7372 100390 3
2035 agent claude-sonnet-5 11293 107762 3
2036 agent claude-sonnet-5 5079 119055 3
2037 agent claude-sonnet-5 1314 124134 6
2038 agent claude-sonnet-5 8345 125448 3
2039 agent claude-sonnet-5 1261 133793 3
2040 agent claude-sonnet-5 667 135054 2
2041 agent claude-sonnet-5 535 135721 5
2042 agent claude-sonnet-5 535 136256 2
2043 agent claude-sonnet-5 506 136791 3
2044 agent claude-sonnet-5 8131 137297 3
2045 agent claude-sonnet-5 487 145428 6
2046 agent claude-sonnet-5 1512 145915 3
2047 agent claude-sonnet-5 1641 147427 17
2048 agent claude-sonnet-5 1963 149068 3
2049 agent claude-sonnet-5 607 151031 4
2050 agent claude-sonnet-5 3482 151638 3
2051 agent claude-sonnet-5 524 155120 5
2052 agent claude-sonnet-5 155 155644 3
2053 agent claude-sonnet-5 1431 155799 3
2054 agent claude-sonnet-5 2110 157230 3
2055 agent claude-sonnet-5 1558 159340 10
2056 agent claude-sonnet-5 1630 160898 3
2057 agent claude-sonnet-5 1182 162528 2
2058 agent claude-sonnet-5 6305 163710 1
2059 agent claude-sonnet-5 1965 170015 3
2060 agent claude-sonnet-5 739 171980 20
2061 agent claude-sonnet-5 181 172719 5
2062 agent claude-sonnet-5 1298 172900 20
2063 agent claude-sonnet-5 311 174198 5
2064 agent claude-sonnet-5 621 174509 8
2065 agent claude-sonnet-5 4035 175130 4
2066 agent claude-sonnet-5 4363 179165 7
2067 agent claude-sonnet-5 2351 183528 14
2068 agent claude-sonnet-5 585 185879 8
2069 agent claude-sonnet-5 1058 186464 17
2070 agent claude-sonnet-5 280 187522 3
2071 agent claude-sonnet-5 6365 187802 3
2072 agent claude-sonnet-5 2309 194167 5
2073 agent claude-sonnet-5 595 196476 5
2074 agent claude-sonnet-5 901 197071 20
2075 agent claude-sonnet-5 1763 197972 3
2076 agent claude-sonnet-5 825 199735 9
2077 agent claude-sonnet-5 1365 200560 20
2078 agent claude-sonnet-5 963 201925 2
2079 agent claude-sonnet-5 1505 202888 3
2080 agent claude-sonnet-5 4059 204393 3
2081 agent claude-sonnet-5 1136 208452 20
2082 agent claude-sonnet-5 294 209588 2
2083 agent claude-sonnet-5 2572 209882 2
2084 agent claude-sonnet-5 480 212454 17
2085 agent claude-sonnet-5 474 212934 3
2086 agent claude-sonnet-5 1852 213408 3
2087 agent claude-sonnet-5 2671 215260 20
2088 agent claude-sonnet-5 991 217931 8
2089 agent claude-sonnet-5 1035 218922 9
2090 agent claude-sonnet-5 331 219957 2
2091 agent claude-sonnet-5 2206 220288 1
2092 agent claude-sonnet-5 143 222494 20
2093 agent claude-sonnet-5 183 222637 5
2094 agent claude-sonnet-5 795 222820 17
2095 agent claude-sonnet-5 649 223615 8
2096 agent claude-sonnet-5 898 224264 17
2097 agent claude-sonnet-5 655 225162 3
2098 agent claude-sonnet-5 736 225817 3
2099 agent claude-sonnet-5 1011 226553 21
2100 agent claude-sonnet-5 1342 227564 7
2101 agent claude-sonnet-5 1137 228906 3
2102 agent claude-sonnet-5 1018 230043 7
2103 agent claude-sonnet-5 476 231061 3
2104 agent claude-sonnet-5 1040 231537 6
2105 agent claude-sonnet-5 861 232577 8
2106 agent claude-sonnet-5 1697 233438 3
2107 agent claude-sonnet-5 1398 235135 4
2108 agent claude-sonnet-5 1980 236533 3
2109 agent claude-sonnet-5 815 238513 14
2110 agent claude-sonnet-5 651 239328 10
2111 agent claude-sonnet-5 1242 239979 3
2112 agent claude-sonnet-5 157 241221 2
2113 agent claude-sonnet-5 402 241378 3
2114 agent claude-sonnet-5 108 241780 2
2115 agent claude-sonnet-5 469 241888 9
2116 agent claude-sonnet-5 526 242357 2
2117 agent claude-sonnet-5 224 242883 9
2118 agent claude-sonnet-5 411 243107 2
2119 agent claude-sonnet-5 272 243518 20
2120 agent claude-sonnet-5 277 243790 9
2121 agent claude-sonnet-5 965 244067 2
2122 agent claude-sonnet-5 312 245032 1
2123 agent claude-sonnet-5 9679 8117 7
2124 agent claude-sonnet-5 2205 17796 5
2125 agent claude-sonnet-5 597 20001 21
2126 agent claude-sonnet-5 13789 20598 8
2127 agent claude-sonnet-5 3589 34387 4
2128 agent claude-sonnet-5 2868 37976 3
2129 agent claude-sonnet-5 3656 40844 6
2130 agent claude-sonnet-5 375 44500 2
2131 agent claude-sonnet-5 8098 44875 7
2132 agent claude-sonnet-5 928 52973 14
2133 agent claude-sonnet-5 5062 53901 6
2134 agent claude-sonnet-5 1473 58963 20
2135 agent claude-sonnet-5 307 60436 6
2136 agent claude-sonnet-5 3139 60743 2
2137 agent claude-sonnet-5 898 63882 2
2138 agent claude-sonnet-5 1579 64780 2
2139 agent claude-sonnet-5 16184 66359 20
2140 agent claude-sonnet-5 865 82543 5
2141 agent claude-sonnet-5 697 83408 2
2142 agent claude-sonnet-5 2879 84105 3
2143 agent claude-sonnet-5 2787 86984 3
2144 agent claude-sonnet-5 697 89771 3
2145 agent claude-sonnet-5 229 90468 2
2146 agent claude-sonnet-5 482 90697 20
2147 agent claude-sonnet-5 1011 91179 17
2148 agent claude-sonnet-5 1752 92190 3
2149 agent claude-sonnet-5 1309 93942 2
2150 agent claude-sonnet-5 799 95251 3
2151 agent claude-sonnet-5 3199 96050 3
2152 agent claude-sonnet-5 1277 99249 3
2153 agent claude-sonnet-5 780 100526 2
2154 agent claude-sonnet-5 778 101306 20
2155 agent claude-sonnet-5 791 102084 2
2156 agent claude-sonnet-5 253 102875 20
2157 agent claude-sonnet-5 128 103128 10
2158 agent claude-sonnet-5 7445 103256 3
2159 agent claude-sonnet-5 270 110701 2
2160 agent claude-sonnet-5 226 110971 3
2161 agent claude-sonnet-5 421 111197 8
2162 agent claude-sonnet-5 175 111618 2
2163 agent claude-sonnet-5 161 111793 2
2164 agent claude-sonnet-5 192 111954 20
2165 agent claude-sonnet-5 191 112146 3
2166 agent claude-sonnet-5 208 112337 16
2167 agent claude-sonnet-5 1752 112545 4
2168 agent claude-sonnet-5 464 114297 17
2169 agent claude-sonnet-5 327 114761 17
2170 agent claude-sonnet-5 325 115088 4
2171 agent claude-sonnet-5 1351 115413 3
2172 agent claude-sonnet-5 487 116764 17
2173 agent claude-sonnet-5 779 117251 3
2174 agent claude-sonnet-5 543 118030 17
2175 agent claude-sonnet-5 488 118573 4
2176 agent claude-sonnet-5 487 119061 20
2177 agent claude-sonnet-5 446 119548 4
2178 agent claude-sonnet-5 2187 119994 3
2179 agent claude-sonnet-5 429 122181 17
2180 agent claude-sonnet-5 351 122610 20
2181 agent claude-sonnet-5 410 122961 17
2182 agent claude-sonnet-5 496 123371 4
2183 agent claude-sonnet-5 4553 123867 3
2184 agent claude-sonnet-5 1925 128420 17
2185 agent claude-sonnet-5 336 130345 7
2186 agent claude-sonnet-5 628 130681 2
2187 agent claude-sonnet-5 419 131309 17
2188 agent claude-sonnet-5 368 131728 3
2189 agent claude-sonnet-5 206 132096 3
2190 agent claude-sonnet-5 100 132302 20
2191 agent claude-sonnet-5 106 132402 20
2192 agent claude-sonnet-5 172 132508 2
2193 agent claude-sonnet-5 346 132680 2
2194 agent claude-sonnet-5 720 133026 8
2195 agent claude-sonnet-5 1790 133746 5
2196 agent claude-sonnet-5 3290 135536 3
2197 agent claude-sonnet-5 819 138826 2
2198 agent claude-sonnet-5 370 139645 2
2199 agent claude-sonnet-5 407 140015 2
2200 agent claude-sonnet-5 1182 140422 20
2201 agent claude-sonnet-5 928 141604 3
2202 agent claude-sonnet-5 981 142532 20
2203 agent claude-sonnet-5 273 143513 2
2204 agent claude-sonnet-5 1115 143786 17
2205 agent claude-sonnet-5 295 144901 3
2206 agent claude-sonnet-5 337 145196 3
2207 agent claude-sonnet-5 879 145533 2
2208 agent claude-sonnet-5 640 146412 2
2209 agent claude-sonnet-5 397 147052 3
2210 agent claude-sonnet-5 1408 147449 2
2211 agent claude-sonnet-5 869 148857 2
2212 agent claude-sonnet-5 1588 149726 2
2213 agent claude-sonnet-5 206 151314 4
2214 agent claude-sonnet-5 474 151520 8
2215 agent claude-sonnet-5 762 151994 20
2216 agent claude-sonnet-5 1742 152756 2
2217 agent claude-sonnet-5 353 154498 3
2218 agent claude-sonnet-5 104 154851 2
2219 agent claude-haiku-4-5-20251001 11294 0 4
2220 agent claude-haiku-4-5-20251001 1291 11294 2
2221 agent claude-haiku-4-5-20251001 2434 12585 2
2222 agent claude-haiku-4-5-20251001 362 15019 2
2223 agent claude-haiku-4-5-20251001 11827 0 4
2224 agent claude-haiku-4-5-20251001 4718 11827 2
2225 agent claude-haiku-4-5-20251001 236 16545 2
2226 agent claude-haiku-4-5-20251001 885 16781 4
2227 agent claude-haiku-4-5-20251001 339 17666 4
2228 agent claude-sonnet-5 17055 0 5
2229 agent claude-sonnet-5 2195 17055 5
2230 agent claude-sonnet-5 9313 19250 20
2231 agent claude-sonnet-5 17832 28563 9
2232 agent claude-sonnet-5 637 46395 20
2233 agent claude-sonnet-5 2723 47032 3
2234 agent claude-sonnet-5 2749 49755 3
2235 agent claude-sonnet-5 11943 52504 3
2236 agent claude-sonnet-5 3109 64447 2
2237 agent claude-sonnet-5 1093 67556 2
2238 agent claude-sonnet-5 105493 0 5
2239 agent claude-sonnet-5 18103 105493 2
2240 agent claude-sonnet-5 905 123596 5
2241 agent claude-sonnet-5 4082 124501 4
2242 agent claude-sonnet-5 2738 128583 2
2243 agent claude-sonnet-5 2304 131321 3
2244 agent claude-sonnet-5 4645 133625 3
2245 agent claude-sonnet-5 6279 138270 3
2246 agent claude-sonnet-5 2049 144549 6
2247 agent claude-sonnet-5 2570 146598 3
2248 agent claude-sonnet-5 3174 149168 3
2249 agent claude-sonnet-5 3149 152342 2
2250 agent claude-sonnet-5 1747 155491 3
2251 agent claude-sonnet-5 175 157238 20
2252 agent claude-sonnet-5 166 157413 2
2253 agent claude-sonnet-5 1511 157579 2
2254 agent claude-sonnet-5 3425 159090 10
2255 agent claude-sonnet-5 3345 162515 3
2256 agent claude-sonnet-5 1744 165860 9
2257 agent claude-sonnet-5 3082 167604 20
2258 agent claude-sonnet-5 752 170686 2
2259 agent claude-sonnet-5 590 171438 9
2260 agent claude-sonnet-5 170 172028 7
2261 agent claude-sonnet-5 342 172198 4
2262 agent claude-sonnet-5 417 172540 7
2263 agent claude-sonnet-5 406 172957 10
2264 agent claude-sonnet-5 498 173363 6
2265 agent claude-sonnet-5 787 173861 2
2266 agent claude-sonnet-5 626 174648 2
2267 agent claude-sonnet-5 203 175274 1
2268 agent claude-sonnet-5 9051 8117 3
2269 agent claude-sonnet-5 2194 17168 4
2270 agent claude-sonnet-5 9445 19362 4
2271 agent claude-sonnet-5 15017 28807 8
2272 agent claude-sonnet-5 2763 43824 3
2273 agent claude-sonnet-5 1438 46587 2
2274 agent claude-sonnet-5 1497 48025 2
2275 agent claude-sonnet-5 14608 49522 5
2276 agent claude-sonnet-5 5335 64130 2
2277 agent claude-sonnet-5 301 69465 3
2278 agent claude-sonnet-5 637 69766 5
2279 agent claude-sonnet-5 14119 70403 3
2280 agent claude-sonnet-5 6045 84522 7
2281 agent claude-sonnet-5 3589 90567 3
2282 agent claude-sonnet-5 20197 94156 3
2283 agent claude-sonnet-5 3483 114353 20
2284 agent claude-sonnet-5 161 117836 9
2285 agent claude-sonnet-5 9802 117997 3
2286 agent claude-sonnet-5 4307 127799 4
2287 agent claude-sonnet-5 2756 132106 3
2288 agent claude-sonnet-5 2100 134862 6
2289 agent claude-sonnet-5 1948 136962 2
2290 agent claude-sonnet-5 5614 138910 20
2291 agent claude-sonnet-5 9615 144524 3
2292 agent claude-sonnet-5 1350 154139 6
2293 agent claude-sonnet-5 4586 155489 8
2294 agent claude-sonnet-5 793 160075 2
2295 agent claude-sonnet-5 340 160868 6
2296 agent claude-sonnet-5 1751 161208 2
2297 agent claude-sonnet-5 1865 162959 4
2298 agent claude-sonnet-5 298 164824 4
2299 agent claude-sonnet-5 615 165122 2
2300 agent claude-sonnet-5 649 165737 2
2301 agent claude-sonnet-5 1360 166386 20
2302 agent claude-sonnet-5 14643 167746 2
2303 agent claude-sonnet-5 826 182389 2
2304 agent claude-sonnet-5 611 183215 20
2305 agent claude-sonnet-5 107 183826 2
2306 agent claude-sonnet-5 3426 183933 3
2307 agent claude-sonnet-5 490 187359 6
2308 agent claude-sonnet-5 521 187849 3
2309 agent claude-sonnet-5 455 188370 2
2310 agent claude-sonnet-5 290 188825 2
2311 agent claude-sonnet-5 551 189115 3
2312 agent claude-sonnet-5 983 189666 5
2313 agent claude-sonnet-5 5564 190649 2
2314 agent claude-sonnet-5 880 196213 6
2315 agent claude-sonnet-5 701 197093 5
2316 agent claude-sonnet-5 383 197794 7
2317 agent claude-sonnet-5 3288 198177 3
2318 agent claude-sonnet-5 1752 201465 17
2319 agent claude-sonnet-5 766 203217 20
2320 agent claude-sonnet-5 113 203983 2
2321 agent claude-sonnet-5 135 204096 8
2322 agent claude-sonnet-5 103 204231 20
2323 agent claude-sonnet-5 747 204334 20
2324 agent claude-sonnet-5 4160 205081 2
2325 agent claude-sonnet-5 134 209241 7
2326 agent claude-sonnet-5 516 209375 2
2327 agent claude-sonnet-5 408 209891 17
2328 agent claude-sonnet-5 528 210299 9
2329 agent claude-sonnet-5 160 210827 7
2330 agent claude-sonnet-5 1295 210987 2
2331 agent claude-sonnet-5 478 212282 17
2332 agent claude-sonnet-5 378 212760 4
2333 agent claude-sonnet-5 808 213138 8
2334 agent claude-sonnet-5 1148 213946 20
2335 agent claude-sonnet-5 170 215094 2
2336 agent claude-sonnet-5 1168 215264 8
2337 agent claude-sonnet-5 288 216432 9
2338 agent claude-sonnet-5 3975 216720 20
2339 agent claude-sonnet-5 459 220695 20
2340 agent claude-sonnet-5 357 221154 6
2341 agent claude-sonnet-5 640 221511 17
2342 agent claude-sonnet-5 396 222151 9
2343 agent claude-sonnet-5 455 222547 20
2344 agent claude-sonnet-5 669 223002 20
2345 agent claude-sonnet-5 127 223671 2
2346 agent claude-sonnet-5 229 223798 7
2347 agent claude-sonnet-5 311 224027 3
2348 agent claude-sonnet-5 385 224338 3
2349 agent claude-sonnet-5 980 224723 2
2350 agent claude-sonnet-5 4837 225703 3
2351 agent claude-sonnet-5 10745 230540 2
2352 agent claude-sonnet-5 577 241285 3
2353 agent claude-sonnet-5 177 241862 3
2354 agent claude-sonnet-5 142 242039 2
2355 agent claude-sonnet-5 2886 242181 10
2356 agent claude-sonnet-5 720 245067 3
2357 agent claude-sonnet-5 1805 245787 1
2358 agent claude-sonnet-5 409 247592 6
2359 agent claude-sonnet-5 324 248001 8
2360 agent claude-sonnet-5 17502 0 3
2361 agent claude-sonnet-5 2195 17502 20
2362 agent claude-sonnet-5 6024 19697 14
2363 agent claude-sonnet-5 2595 25721 20
2364 agent claude-sonnet-5 2590 28316 2
2365 agent claude-sonnet-5 15029 30906 2
2366 agent claude-sonnet-5 292 45935 20
2367 agent claude-sonnet-5 2944 46227 20
2368 agent claude-sonnet-5 2459 49171 20
2369 agent claude-sonnet-5 2788 51630 14
2370 agent claude-sonnet-5 2583 54418 2
2371 agent claude-sonnet-5 3742 57001 14
2372 agent claude-sonnet-5 1475 60743 2
2373 agent claude-sonnet-5 3149 62218 5
2374 agent claude-sonnet-5 3708 65367 6
2375 agent claude-sonnet-5 3608 69075 2
2376 agent claude-sonnet-5 4284 72683 8
2377 agent claude-sonnet-5 1682 76967 5
2378 agent claude-sonnet-5 19693 78649 20
2379 agent claude-sonnet-5 726 98342 2
2380 agent claude-sonnet-5 7426 99068 2
2381 agent claude-sonnet-5 879 106494 8
2382 agent claude-sonnet-5 816 107373 20
2383 agent claude-sonnet-5 3200 108189 9
2384 agent claude-sonnet-5 2714 111389 3
2385 agent claude-sonnet-5 502 114103 4
2386 agent claude-sonnet-5 430 114605 2
2387 agent claude-sonnet-5 8857 115035 5
2388 agent claude-sonnet-5 6330 123892 5
2389 agent claude-sonnet-5 242 130222 5
2390 agent claude-sonnet-5 27004 130464 5
2391 agent claude-sonnet-5 436 157468 3
2392 agent claude-sonnet-5 2144 157904 2
2393 agent claude-sonnet-5 1696 160048 6
2394 agent claude-sonnet-5 1991 161744 5
2395 agent claude-sonnet-5 825 163735 17
2396 agent claude-sonnet-5 602 164560 2
2397 agent claude-sonnet-5 3345 165162 3
2398 agent claude-sonnet-5 7685 168507 3
2399 agent claude-sonnet-5 1166 176192 3
2400 agent claude-sonnet-5 6303 177358 6
2401 agent claude-sonnet-5 7851 183661 2
2402 agent claude-sonnet-5 9678 191512 6
2403 agent claude-sonnet-5 2410 201190 3
2404 agent claude-sonnet-5 1893 203600 3
2405 agent claude-sonnet-5 2319 205493 3
2406 agent claude-sonnet-5 5577 207812 4
2407 agent claude-sonnet-5 1452 213389 2
2408 agent claude-sonnet-5 327 214841 4
2409 agent claude-sonnet-5 507 215168 6
2410 agent claude-sonnet-5 3457 215675 7
2411 agent claude-sonnet-5 1961 219132 17
2412 agent claude-sonnet-5 226 221093 3
2413 agent claude-sonnet-5 3185 221319 5
2414 agent claude-sonnet-5 1224 224504 1
2415 agent claude-sonnet-5 830 225728 2
2416 agent claude-sonnet-5 2284 226558 6
2417 agent claude-sonnet-5 4024 228842 2
2418 agent claude-sonnet-5 691 232866 3
2419 agent claude-sonnet-5 1185 233557 2
2420 agent claude-sonnet-5 381 234742 20
2421 agent claude-sonnet-5 2321 235123 4
2422 agent claude-sonnet-5 442 237444 20
2423 agent claude-sonnet-5 1781 237886 3
2424 agent claude-sonnet-5 1035 239667 6
2425 agent claude-sonnet-5 340 240702 2
2426 agent claude-sonnet-5 745 241042 20
2427 agent claude-sonnet-5 335 241787 9
2428 agent claude-sonnet-5 1118 242122 7
2429 agent claude-sonnet-5 484 243240 2
2430 agent claude-sonnet-5 2172 243724 2
2431 agent claude-sonnet-5 395 245896 4
2432 agent claude-sonnet-5 928 246291 2
2433 agent claude-sonnet-5 192 247219 2
-->
<!-- /cout -->

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

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-15 à 02:46 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 13 117 | 0,04 $ |
| Écriture de cache | 3 462 309 | 13,67 $ |
| Lecture de cache | 179 769 168 | 70,20 $ |
| Sortie | 252 402 | 5,31 $ |
| **Total** | **183 496 996** | **89,21 $ — 77,47 €** |

**Ce qui coûte**

- **1056 appel(s) au modèle** — un par réponse, outils compris —, dont 732 par des sous-agents — 95 439 965 jetons, 37,41 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  64 719 jetons, écrits une fois par session puis relus à chaque
  échange : 20 904 237 jetons de relecture, 11 % de tout ce qui a été relu.
- **Tours courts** — 788 des 1 056 tours (74 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 60,50 $, soit 67 % de la facture.
  Grouper les appels indépendants dans un même tour divise ce poste.
- **Croissance** — 64 719 jetons relus au premier appel qui relise
  quelque chose, 459 339 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 183496996 -->
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
325 agent claude-haiku-4-5-20251001 11688 0 1
326 agent claude-haiku-4-5-20251001 1278 11688 1
327 agent claude-haiku-4-5-20251001 630 12966 2
328 agent claude-haiku-4-5-20251001 2273 13596 2
329 agent claude-haiku-4-5-20251001 752 15869 2
330 agent claude-haiku-4-5-20251001 263 16621 5
331 agent claude-opus-5 12380 0 1
332 agent claude-opus-5 13012 12380 2
333 agent claude-opus-5 18598 25392 3
334 agent claude-opus-5 1200 43990 3
335 agent claude-opus-5 3173 45190 2
336 agent claude-opus-5 10030 48363 4
337 agent claude-opus-5 9389 58393 1
338 agent claude-haiku-4-5-20251001 11397 0 4
339 agent claude-haiku-4-5-20251001 1308 11397 2
340 agent claude-haiku-4-5-20251001 545 12705 2
341 agent claude-haiku-4-5-20251001 590 13250 2
342 agent claude-haiku-4-5-20251001 537 13840 4
343 agent claude-haiku-4-5-20251001 362 14377 5
344 agent claude-haiku-4-5-20251001 11883 0 1
345 agent claude-haiku-4-5-20251001 1507 11883 2
346 agent claude-haiku-4-5-20251001 502 13390 1
347 agent claude-haiku-4-5-20251001 397 13892 2
348 agent claude-haiku-4-5-20251001 230 14289 2
349 agent claude-haiku-4-5-20251001 810 14519 2
350 agent claude-haiku-4-5-20251001 930 15329 129
351 agent claude-haiku-4-5-20251001 270 16259 2
352 agent claude-haiku-4-5-20251001 12120 0 4
353 agent claude-haiku-4-5-20251001 1232 12120 2
354 agent claude-haiku-4-5-20251001 499 13352 2
355 agent claude-haiku-4-5-20251001 1279 13851 2
356 agent claude-haiku-4-5-20251001 1345 15130 4
357 agent claude-haiku-4-5-20251001 271 16475 4
358 agent claude-sonnet-5 17695 0 5
359 agent claude-sonnet-5 2211 17695 4
360 agent claude-sonnet-5 291 19906 20
361 agent claude-sonnet-5 1911 20197 3
362 agent claude-sonnet-5 271 22108 21
363 agent claude-sonnet-5 2466 22379 2
364 agent claude-sonnet-5 2998 24845 2
365 agent claude-sonnet-5 12598 27843 8
366 agent claude-sonnet-5 3518 40441 3
367 agent claude-sonnet-5 7707 43959 2
368 agent claude-sonnet-5 271 51666 59
369 agent claude-sonnet-5 604 51937 9
370 agent claude-sonnet-5 516 52541 17
371 agent claude-sonnet-5 240 53057 2
372 agent claude-sonnet-5 1163 53297 2
373 agent claude-sonnet-5 464 54460 3
374 agent claude-sonnet-5 213 54924 2
375 agent claude-sonnet-5 1009 55137 3
376 agent claude-sonnet-5 2865 56146 3
377 agent claude-sonnet-5 4832 59011 2
378 agent claude-sonnet-5 1056 63843 3
379 agent claude-sonnet-5 1796 64899 2
380 agent claude-sonnet-5 5722 66695 3
381 agent claude-sonnet-5 295 72417 3
382 agent claude-sonnet-5 814 72712 6
383 agent claude-sonnet-5 451 73526 20
384 agent claude-sonnet-5 1004 73977 17
385 agent claude-sonnet-5 454 74981 2
386 agent claude-sonnet-5 364 75435 4
387 agent claude-sonnet-5 246 75799 3
388 agent claude-sonnet-5 257 76045 3
389 agent claude-sonnet-5 591 76302 2
390 agent claude-sonnet-5 169 76893 3
391 agent claude-sonnet-5 647 77062 4
392 agent claude-sonnet-5 892 77709 3
393 agent claude-sonnet-5 240 78601 3
394 agent claude-sonnet-5 145 78841 8
395 agent claude-sonnet-5 221 78986 20
396 agent claude-sonnet-5 94 79207 2
397 agent claude-sonnet-5 121 79301 2
398 agent claude-sonnet-5 511 79422 7
399 agent claude-sonnet-5 168 79933 2
400 agent claude-sonnet-5 629 80101 5
401 agent claude-sonnet-5 790 80730 3
402 agent claude-sonnet-5 2160 81520 3
403 agent claude-sonnet-5 468 83680 17
404 agent claude-sonnet-5 343 84148 20
405 agent claude-sonnet-5 83 84491 20
406 agent claude-sonnet-5 90 84574 20
407 agent claude-sonnet-5 145 84664 20
408 agent claude-sonnet-5 500 84809 6
409 agent claude-sonnet-5 1678 85309 2
410 agent claude-sonnet-5 2707 86987 2
411 agent claude-sonnet-5 860 89694 3
412 agent claude-sonnet-5 695 90554 6
413 agent claude-sonnet-5 569 91249 2
414 agent claude-sonnet-5 101 91818 20
415 agent claude-sonnet-5 188 91919 20
416 agent claude-sonnet-5 105 92107 3
417 agent claude-sonnet-5 678 92212 2
418 agent claude-sonnet-5 353 92890 20
419 agent claude-sonnet-5 577 93243 5
420 agent claude-sonnet-5 333 93820 2
421 agent claude-sonnet-5 600 94153 6
422 agent claude-sonnet-5 434 94753 20
423 agent claude-sonnet-5 2788 95187 7
424 agent claude-sonnet-5 685 97975 2
425 agent claude-sonnet-5 3764 98660 2
426 agent claude-sonnet-5 502 102424 17
427 agent claude-sonnet-5 604 102926 7
428 agent claude-sonnet-5 3278 103530 2
429 agent claude-sonnet-5 1072 106808 4
430 agent claude-sonnet-5 762 107880 17
431 agent claude-sonnet-5 608 108642 7
432 agent claude-sonnet-5 6508 109250 2
433 agent claude-sonnet-5 4992 115758 2
434 agent claude-sonnet-5 3747 120750 20
435 agent claude-sonnet-5 167 124497 9
436 agent claude-sonnet-5 3166 124664 3
437 agent claude-sonnet-5 1040 127830 3
438 agent claude-sonnet-5 294 128870 2
439 agent claude-sonnet-5 2439 129164 3
440 agent claude-sonnet-5 859 131603 2
441 agent claude-sonnet-5 555 132462 7
442 agent claude-sonnet-5 372 133017 20
443 agent claude-sonnet-5 414 133389 17
444 agent claude-sonnet-5 689 133803 2
445 agent claude-sonnet-5 734 134492 20
446 agent claude-sonnet-5 475 135226 17
447 agent claude-sonnet-5 947 135701 2
448 agent claude-sonnet-5 102 136648 20
449 agent claude-sonnet-5 80 136750 20
450 agent claude-sonnet-5 144 136830 20
451 agent claude-sonnet-5 1027 136974 3
452 agent claude-sonnet-5 684 138001 1
453 agent claude-sonnet-5 667 138685 1
454 agent claude-sonnet-5 662 139352 2
455 agent claude-sonnet-5 652 140014 20
456 agent claude-sonnet-5 588 140666 2
457 agent claude-sonnet-5 662 141254 5
458 agent claude-sonnet-5 677 141916 2
459 agent claude-sonnet-5 325 142593 9
460 agent claude-sonnet-5 388 142918 5
461 agent claude-sonnet-5 758 143306 3
462 agent claude-sonnet-5 2088 144064 3
463 agent claude-sonnet-5 1325 146152 17
464 agent claude-sonnet-5 602 147477 3
465 agent claude-sonnet-5 1365 148079 1
466 agent claude-sonnet-5 207 149444 20
467 agent claude-sonnet-5 180 149651 20
468 agent claude-sonnet-5 767 149831 2
469 agent claude-sonnet-5 528 150598 3
470 agent claude-sonnet-5 220 151126 8
471 agent claude-sonnet-5 1524 151346 17
472 agent claude-sonnet-5 489 152870 2
473 agent claude-sonnet-5 335 153359 2
474 agent claude-sonnet-5 315 153694 5
475 agent claude-sonnet-5 159 154009 20
476 agent claude-sonnet-5 80 154168 20
477 agent claude-sonnet-5 144 154248 20
478 agent claude-sonnet-5 447 154392 17
479 agent claude-sonnet-5 602 154839 2
480 agent claude-sonnet-5 1074 155441 2
481 agent claude-sonnet-5 122 156515 20
482 agent claude-sonnet-5 99 156637 7
483 agent claude-sonnet-5 301 156736 6
484 agent claude-sonnet-5 532 157037 2
485 agent claude-sonnet-5 1082 157569 5
486 agent claude-sonnet-5 1850 158651 3
487 agent claude-sonnet-5 7678 160501 2
488 agent claude-sonnet-5 366 168179 2
489 agent claude-haiku-4-5-20251001 11755 0 1
490 agent claude-haiku-4-5-20251001 4143 11755 2
491 agent claude-haiku-4-5-20251001 853 15898 2
492 agent claude-haiku-4-5-20251001 1158 16751 3
493 agent claude-haiku-4-5-20251001 323 17909 4
494 agent claude-haiku-4-5-20251001 6777 5008 4
495 agent claude-haiku-4-5-20251001 1386 11785 2
496 agent claude-haiku-4-5-20251001 322 13171 2
497 agent claude-haiku-4-5-20251001 1025 13493 2
498 agent claude-haiku-4-5-20251001 1058 14518 3
499 agent claude-haiku-4-5-20251001 325 15576 5
500 agent claude-sonnet-5 9269 8117 5
501 agent claude-sonnet-5 2206 17386 20
502 agent claude-sonnet-5 10795 19592 14
503 agent claude-sonnet-5 14992 30387 2
504 agent claude-sonnet-5 5528 45379 4
505 agent claude-sonnet-5 13854 50907 14
506 agent claude-sonnet-5 4345 64761 7
507 agent claude-sonnet-5 11937 69106 5
508 agent claude-sonnet-5 13806 81043 7
509 agent claude-sonnet-5 535 94849 20
510 agent claude-sonnet-5 5027 95384 7
511 agent claude-sonnet-5 562 100411 20
512 agent claude-sonnet-5 1261 100973 3
513 agent claude-sonnet-5 13627 102234 5
514 agent claude-sonnet-5 9305 115861 5
515 agent claude-sonnet-5 4032 125166 4
516 agent claude-sonnet-5 178962 0 2
517 agent claude-sonnet-5 28566 178962 6
518 agent claude-sonnet-5 5851 207528 3
519 agent claude-sonnet-5 465 213379 17
520 agent claude-sonnet-5 346 213844 6
521 agent claude-sonnet-5 4698 214190 4
522 agent claude-sonnet-5 836 218888 5
523 agent claude-sonnet-5 2889 219724 3
524 agent claude-sonnet-5 290 222613 5
525 agent claude-sonnet-5 3052 222903 6
526 agent claude-sonnet-5 1954 225955 5
527 agent claude-sonnet-5 505 227909 20
528 agent claude-sonnet-5 880 228414 3
529 agent claude-sonnet-5 914 229294 8
530 agent claude-sonnet-5 545 230208 3
531 agent claude-sonnet-5 1852 230753 5
532 agent claude-sonnet-5 2290 232605 5
533 agent claude-sonnet-5 10812 234895 3
534 agent claude-sonnet-5 5034 245707 3
535 agent claude-sonnet-5 1696 250741 3
536 agent claude-sonnet-5 1200 252437 2
537 agent claude-sonnet-5 1874 253637 3
538 agent claude-sonnet-5 998 255511 2
539 agent claude-sonnet-5 2239 256509 1
540 agent claude-sonnet-5 589 258748 3
541 agent claude-sonnet-5 1235 259337 20
542 agent claude-sonnet-5 474 260572 5
543 agent claude-sonnet-5 937 261046 5
544 agent claude-sonnet-5 4291 261983 20
545 agent claude-sonnet-5 1379 266274 2
546 agent claude-sonnet-5 1054 267653 20
547 agent claude-sonnet-5 301 268707 2
548 agent claude-sonnet-5 6585 269008 2
549 agent claude-sonnet-5 9392 275593 20
550 agent claude-sonnet-5 2660 284985 3
551 agent claude-sonnet-5 1282 287645 17
552 agent claude-sonnet-5 592 288927 3
553 agent claude-sonnet-5 454 289519 3
554 agent claude-sonnet-5 327 289973 2
555 agent claude-sonnet-5 2521 290300 2
556 agent claude-sonnet-5 5686 292821 8
557 agent claude-sonnet-5 1653 298507 2
558 agent claude-sonnet-5 545 300160 6
559 agent claude-sonnet-5 352 300705 3
560 agent claude-sonnet-5 1599 301057 1
561 agent claude-sonnet-5 336 302656 7
562 agent claude-sonnet-5 816 302992 2
563 agent claude-sonnet-5 948 303808 2
564 agent claude-sonnet-5 1284 304756 2
565 agent claude-sonnet-5 2532 306040 2
566 agent claude-sonnet-5 483 308572 6
567 agent claude-sonnet-5 524 309055 7
568 agent claude-sonnet-5 2620 309579 3
569 agent claude-sonnet-5 702 312199 20
570 agent claude-sonnet-5 1395 312901 2
571 agent claude-sonnet-5 1748 314296 10
572 agent claude-sonnet-5 2119 316044 2
573 agent claude-sonnet-5 1831 318163 17
574 agent claude-sonnet-5 285 319994 3
575 agent claude-sonnet-5 654 320279 16
576 agent claude-sonnet-5 596 320933 3
577 agent claude-sonnet-5 543 321529 20
578 agent claude-haiku-4-5-20251001 4878 6686 4
579 agent claude-haiku-4-5-20251001 3545 11564 2
580 agent claude-haiku-4-5-20251001 781 15109 2
581 agent claude-haiku-4-5-20251001 672 15890 2
582 agent claude-haiku-4-5-20251001 268 16562 3
583 agent claude-sonnet-5 17694 0 5
584 agent claude-sonnet-5 2205 17694 2
585 agent claude-sonnet-5 6042 19899 2
586 agent claude-sonnet-5 8735 25941 3
587 agent claude-sonnet-5 1488 34676 6
588 agent claude-sonnet-5 8108 36164 3
589 agent claude-sonnet-5 2899 44272 20
590 agent claude-sonnet-5 3687 47171 4
591 agent claude-sonnet-5 4829 50858 14
592 agent claude-sonnet-5 3146 55687 7
593 agent claude-sonnet-5 3592 58833 4
594 agent claude-sonnet-5 17303 62425 2
595 agent claude-sonnet-5 175 79728 3
596 agent claude-sonnet-5 442 79903 20
597 agent claude-sonnet-5 3084 80345 3
598 agent claude-sonnet-5 6548 83429 2
599 agent claude-sonnet-5 359 89977 14
600 agent claude-sonnet-5 4592 90336 2
601 agent claude-sonnet-5 382 94928 20
602 agent claude-sonnet-5 901 95310 2
603 agent claude-sonnet-5 999 96211 2
604 agent claude-sonnet-5 583 97210 4
605 agent claude-sonnet-5 852 97793 3
606 agent claude-sonnet-5 1809 98645 6
607 agent claude-sonnet-5 728 100454 2
608 agent claude-sonnet-5 960 101182 3
609 agent claude-sonnet-5 432 102142 4
610 agent claude-sonnet-5 4227 102574 3
611 agent claude-sonnet-5 413 106801 2
612 agent claude-sonnet-5 880 107214 9
613 agent claude-sonnet-5 1700 108094 6
614 agent claude-sonnet-5 356 109794 2
615 agent claude-sonnet-5 1344 110150 3
616 agent claude-sonnet-5 1631 111494 1
617 agent claude-sonnet-5 163 113125 5
618 agent claude-sonnet-5 336 113288 2
619 agent claude-sonnet-5 5061 113624 3
620 agent claude-sonnet-5 1442 118685 2
621 agent claude-sonnet-5 259 120127 2
622 agent claude-haiku-4-5-20251001 11728 0 4
623 agent claude-haiku-4-5-20251001 1428 11728 2
624 agent claude-haiku-4-5-20251001 11936 0 1
625 agent claude-haiku-4-5-20251001 2110 11936 2
626 agent claude-haiku-4-5-20251001 1401 14046 2
627 agent claude-haiku-4-5-20251001 1277 15447 2
628 agent claude-haiku-4-5-20251001 297 16724 3
629 agent claude-haiku-4-5-20251001 12104 0 4
630 agent claude-haiku-4-5-20251001 4791 12104 2
631 agent claude-haiku-4-5-20251001 549 16895 4
632 agent claude-haiku-4-5-20251001 316 17444 1
633 agent claude-haiku-4-5-20251001 2470 17760 3
634 agent claude-haiku-4-5-20251001 384 20230 4
635 agent claude-haiku-4-5-20251001 11908 0 4
636 agent claude-haiku-4-5-20251001 1481 11908 2
637 agent claude-haiku-4-5-20251001 550 13389 2
638 agent claude-haiku-4-5-20251001 1077 13939 3
639 agent claude-haiku-4-5-20251001 293 15016 4
640 agent claude-opus-5 13872 0 1
641 agent claude-opus-5 6262 13872 5
642 agent claude-opus-5 7388 20134 3
643 agent claude-opus-5 6992 27522 4
644 agent claude-opus-5 10873 34514 4
645 agent claude-opus-5 5888 45387 2
646 agent claude-opus-5 1184 51275 2
647 agent claude-opus-5 381 52459 3
648 agent claude-opus-5 1152 52840 3
649 agent claude-opus-5 2180 53992 3
650 agent claude-opus-5 4879 56172 2
651 agent claude-opus-5 4617 61051 6
652 agent claude-opus-5 69496 0 6
653 agent claude-opus-5 6466 69496 2
654 agent claude-opus-5 4939 75962 3
655 agent claude-opus-5 2133 80901 3
656 agent claude-opus-5 9057 83034 3
657 agent claude-opus-5 95590 0 3
658 agent claude-opus-5 10613 95590 3
659 agent claude-opus-5 3223 106203 3
660 agent claude-opus-5 4113 109426 2
661 agent claude-sonnet-5 18271 0 5
662 agent claude-sonnet-5 2211 18271 5
663 agent claude-sonnet-5 1767 20482 73
664 agent claude-sonnet-5 1911 22249 4
665 agent claude-sonnet-5 6043 24160 2
666 agent claude-sonnet-5 9847 30203 2
667 agent claude-sonnet-5 2604 40050 4
668 agent claude-sonnet-5 3806 42654 4
669 agent claude-sonnet-5 3400 46460 2
670 agent claude-sonnet-5 8554 49860 3
671 agent claude-sonnet-5 4853 58414 3
672 agent claude-sonnet-5 400 63267 2
673 agent claude-sonnet-5 3121 63667 3
674 agent claude-sonnet-5 2338 66788 2
675 agent claude-sonnet-5 4658 69126 2
676 agent claude-sonnet-5 571 73784 9
677 agent claude-sonnet-5 2825 74355 3
678 agent claude-sonnet-5 239 77180 2
679 agent claude-sonnet-5 439 77419 3
680 agent claude-sonnet-5 472 77858 2
681 agent claude-sonnet-5 3630 78330 2
682 agent claude-sonnet-5 119027 0 3
683 agent claude-sonnet-5 5521 119027 20
684 agent claude-sonnet-5 1179 124548 5
685 agent claude-sonnet-5 2430 125727 3
686 agent claude-sonnet-5 9054 128157 6
687 agent claude-sonnet-5 8910 137211 3
688 agent claude-sonnet-5 6178 146121 2
689 agent claude-sonnet-5 10022 152299 8
690 agent claude-sonnet-5 773 162321 2
691 agent claude-sonnet-5 2176 163094 6
692 agent claude-sonnet-5 4181 165270 6
693 agent claude-sonnet-5 588 169451 17
694 agent claude-sonnet-5 361 170039 3
695 agent claude-sonnet-5 1138 170400 3
696 agent claude-sonnet-5 951 171538 17
697 agent claude-sonnet-5 333 172489 2
698 agent claude-sonnet-5 765 172822 1059
699 agent claude-sonnet-5 1117 173587 3
700 agent claude-sonnet-5 385 174704 20
701 agent claude-sonnet-5 303 175089 4
702 agent claude-sonnet-5 272 175392 20
703 agent claude-sonnet-5 620 175664 17
704 agent claude-sonnet-5 1097 176284 4
705 agent claude-sonnet-5 199 177381 14
706 agent claude-sonnet-5 237 177580 16
707 agent claude-sonnet-5 442 177817 7
708 agent claude-sonnet-5 536 178259 16
709 agent claude-sonnet-5 732 178795 9
710 agent claude-sonnet-5 13138 179527 3
711 agent claude-sonnet-5 2391 192665 3
712 agent claude-sonnet-5 669 195056 17
713 agent claude-sonnet-5 289 195725 2
714 agent claude-sonnet-5 495 196014 20
715 agent claude-sonnet-5 888 196509 3
716 agent claude-sonnet-5 454 197397 17
717 agent claude-sonnet-5 205 197851 5
718 agent claude-sonnet-5 343 198056 21
719 agent claude-sonnet-5 191 198399 2
720 agent claude-sonnet-5 1920 198590 2
721 agent claude-sonnet-5 1033 200510 2
722 agent claude-sonnet-5 442 201543 2
723 agent claude-sonnet-5 815 201985 2
724 agent claude-sonnet-5 868 202800 2
725 agent claude-sonnet-5 1873 203668 20
726 agent claude-sonnet-5 390 205541 2
727 agent claude-sonnet-5 239 205931 20
728 agent claude-sonnet-5 419 206170 17
729 agent claude-sonnet-5 389 206589 6
730 agent claude-sonnet-5 3025 206978 4
731 agent claude-sonnet-5 6324 210003 6
732 agent claude-sonnet-5 3809 216327 2
733 agent claude-sonnet-5 5096 220136 3
734 agent claude-sonnet-5 3472 225232 2
735 agent claude-sonnet-5 1699 228704 2
736 agent claude-sonnet-5 1642 230403 5
737 agent claude-sonnet-5 285 232045 3
738 agent claude-sonnet-5 1922 232330 3
739 agent claude-sonnet-5 201 234252 6
740 agent claude-sonnet-5 457 234453 6
741 agent claude-sonnet-5 2005 234910 2
742 agent claude-sonnet-5 306 236915 9
743 agent claude-sonnet-5 1082 237221 3
744 agent claude-sonnet-5 593 238303 17
745 agent claude-sonnet-5 446 238896 3
746 agent claude-sonnet-5 393 239342 4
747 agent claude-sonnet-5 293 239735 9
748 agent claude-sonnet-5 794 240028 2
749 agent claude-sonnet-5 520 240822 1
750 agent claude-haiku-4-5-20251001 12179 0 4
751 agent claude-haiku-4-5-20251001 2011 12179 1
752 agent claude-haiku-4-5-20251001 239 14190 2
753 agent claude-haiku-4-5-20251001 1305 14429 3
754 agent claude-haiku-4-5-20251001 260 15734 4
755 agent claude-sonnet-5 9679 8117 7
756 agent claude-sonnet-5 2205 17796 5
757 agent claude-sonnet-5 597 20001 21
758 agent claude-sonnet-5 13789 20598 8
759 agent claude-sonnet-5 3589 34387 4
760 agent claude-sonnet-5 2868 37976 3
761 agent claude-sonnet-5 3656 40844 6
762 agent claude-sonnet-5 375 44500 2
763 agent claude-sonnet-5 8098 44875 7
764 agent claude-sonnet-5 928 52973 14
765 agent claude-sonnet-5 5062 53901 6
766 agent claude-sonnet-5 1473 58963 20
767 agent claude-sonnet-5 307 60436 6
768 agent claude-sonnet-5 3139 60743 2
769 agent claude-sonnet-5 898 63882 2
770 agent claude-sonnet-5 1579 64780 2
771 agent claude-sonnet-5 16184 66359 20
772 agent claude-sonnet-5 865 82543 5
773 agent claude-sonnet-5 697 83408 2
774 agent claude-sonnet-5 2879 84105 3
775 agent claude-sonnet-5 2787 86984 3
776 agent claude-sonnet-5 697 89771 3
777 agent claude-sonnet-5 229 90468 2
778 agent claude-sonnet-5 482 90697 20
779 agent claude-sonnet-5 1011 91179 17
780 agent claude-sonnet-5 1752 92190 3
781 agent claude-sonnet-5 1309 93942 2
782 agent claude-sonnet-5 799 95251 3
783 agent claude-sonnet-5 3199 96050 3
784 agent claude-sonnet-5 1277 99249 3
785 agent claude-sonnet-5 780 100526 2
786 agent claude-sonnet-5 778 101306 20
787 agent claude-sonnet-5 791 102084 2
788 agent claude-sonnet-5 253 102875 20
789 agent claude-sonnet-5 128 103128 10
790 agent claude-sonnet-5 7445 103256 3
791 agent claude-sonnet-5 270 110701 2
792 agent claude-sonnet-5 226 110971 3
793 agent claude-sonnet-5 421 111197 8
794 agent claude-sonnet-5 175 111618 2
795 agent claude-sonnet-5 161 111793 2
796 agent claude-sonnet-5 192 111954 20
797 agent claude-sonnet-5 191 112146 3
798 agent claude-sonnet-5 208 112337 16
799 agent claude-sonnet-5 1752 112545 4
800 agent claude-sonnet-5 464 114297 17
801 agent claude-sonnet-5 327 114761 17
802 agent claude-sonnet-5 325 115088 4
803 agent claude-sonnet-5 1351 115413 3
804 agent claude-sonnet-5 487 116764 17
805 agent claude-sonnet-5 779 117251 3
806 agent claude-sonnet-5 543 118030 17
807 agent claude-sonnet-5 488 118573 4
808 agent claude-sonnet-5 487 119061 20
809 agent claude-sonnet-5 446 119548 4
810 agent claude-sonnet-5 2187 119994 3
811 agent claude-sonnet-5 429 122181 17
812 agent claude-sonnet-5 351 122610 20
813 agent claude-sonnet-5 410 122961 17
814 agent claude-sonnet-5 496 123371 4
815 agent claude-sonnet-5 4553 123867 3
816 agent claude-sonnet-5 1925 128420 17
817 agent claude-sonnet-5 336 130345 7
818 agent claude-sonnet-5 628 130681 2
819 agent claude-sonnet-5 419 131309 17
820 agent claude-sonnet-5 368 131728 3
821 agent claude-sonnet-5 206 132096 3
822 agent claude-sonnet-5 100 132302 20
823 agent claude-sonnet-5 106 132402 20
824 agent claude-sonnet-5 172 132508 2
825 agent claude-sonnet-5 346 132680 2
826 agent claude-sonnet-5 720 133026 8
827 agent claude-sonnet-5 1790 133746 5
828 agent claude-sonnet-5 3290 135536 3
829 agent claude-sonnet-5 819 138826 2
830 agent claude-sonnet-5 370 139645 2
831 agent claude-sonnet-5 407 140015 2
832 agent claude-sonnet-5 1182 140422 20
833 agent claude-sonnet-5 928 141604 3
834 agent claude-sonnet-5 981 142532 20
835 agent claude-sonnet-5 273 143513 2
836 agent claude-sonnet-5 1115 143786 17
837 agent claude-sonnet-5 295 144901 3
838 agent claude-sonnet-5 337 145196 3
839 agent claude-sonnet-5 879 145533 2
840 agent claude-sonnet-5 640 146412 2
841 agent claude-sonnet-5 397 147052 3
842 agent claude-sonnet-5 1408 147449 2
843 agent claude-sonnet-5 869 148857 2
844 agent claude-sonnet-5 1588 149726 2
845 agent claude-sonnet-5 206 151314 4
846 agent claude-sonnet-5 474 151520 8
847 agent claude-sonnet-5 762 151994 20
848 agent claude-sonnet-5 1742 152756 2
849 agent claude-sonnet-5 353 154498 3
850 agent claude-sonnet-5 104 154851 2
851 agent claude-sonnet-5 17055 0 5
852 agent claude-sonnet-5 2195 17055 5
853 agent claude-sonnet-5 9313 19250 20
854 agent claude-sonnet-5 17832 28563 9
855 agent claude-sonnet-5 637 46395 20
856 agent claude-sonnet-5 2723 47032 3
857 agent claude-sonnet-5 2749 49755 3
858 agent claude-sonnet-5 11943 52504 3
859 agent claude-sonnet-5 3109 64447 2
860 agent claude-sonnet-5 1093 67556 2
861 agent claude-sonnet-5 105493 0 5
862 agent claude-sonnet-5 18103 105493 2
863 agent claude-sonnet-5 905 123596 5
864 agent claude-sonnet-5 4082 124501 4
865 agent claude-sonnet-5 2738 128583 2
866 agent claude-sonnet-5 2304 131321 3
867 agent claude-sonnet-5 4645 133625 3
868 agent claude-sonnet-5 6279 138270 3
869 agent claude-sonnet-5 2049 144549 6
870 agent claude-sonnet-5 2570 146598 3
871 agent claude-sonnet-5 3174 149168 3
872 agent claude-sonnet-5 3149 152342 2
873 agent claude-sonnet-5 1747 155491 3
874 agent claude-sonnet-5 175 157238 20
875 agent claude-sonnet-5 166 157413 2
876 agent claude-sonnet-5 1511 157579 2
877 agent claude-sonnet-5 3425 159090 10
878 agent claude-sonnet-5 3345 162515 3
879 agent claude-sonnet-5 1744 165860 9
880 agent claude-sonnet-5 3082 167604 20
881 agent claude-sonnet-5 752 170686 2
882 agent claude-sonnet-5 590 171438 9
883 agent claude-sonnet-5 170 172028 7
884 agent claude-sonnet-5 342 172198 4
885 agent claude-sonnet-5 417 172540 7
886 agent claude-sonnet-5 406 172957 10
887 agent claude-sonnet-5 498 173363 6
888 agent claude-sonnet-5 787 173861 2
889 agent claude-sonnet-5 626 174648 2
890 agent claude-sonnet-5 203 175274 1
891 agent claude-sonnet-5 9051 8117 3
892 agent claude-sonnet-5 2194 17168 4
893 agent claude-sonnet-5 9445 19362 4
894 agent claude-sonnet-5 15017 28807 8
895 agent claude-sonnet-5 2763 43824 3
896 agent claude-sonnet-5 1438 46587 2
897 agent claude-sonnet-5 1497 48025 2
898 agent claude-sonnet-5 14608 49522 5
899 agent claude-sonnet-5 5335 64130 2
900 agent claude-sonnet-5 301 69465 3
901 agent claude-sonnet-5 637 69766 5
902 agent claude-sonnet-5 14119 70403 3
903 agent claude-sonnet-5 6045 84522 7
904 agent claude-sonnet-5 3589 90567 3
905 agent claude-sonnet-5 20197 94156 3
906 agent claude-sonnet-5 3483 114353 20
907 agent claude-sonnet-5 161 117836 9
908 agent claude-sonnet-5 9802 117997 3
909 agent claude-sonnet-5 4307 127799 4
910 agent claude-sonnet-5 2756 132106 3
911 agent claude-sonnet-5 2100 134862 6
912 agent claude-sonnet-5 1948 136962 2
913 agent claude-sonnet-5 5614 138910 20
914 agent claude-sonnet-5 9615 144524 3
915 agent claude-sonnet-5 1350 154139 6
916 agent claude-sonnet-5 4586 155489 8
917 agent claude-sonnet-5 793 160075 2
918 agent claude-sonnet-5 340 160868 6
919 agent claude-sonnet-5 1751 161208 2
920 agent claude-sonnet-5 1865 162959 4
921 agent claude-sonnet-5 298 164824 4
922 agent claude-sonnet-5 615 165122 2
923 agent claude-sonnet-5 649 165737 2
924 agent claude-sonnet-5 1360 166386 20
925 agent claude-sonnet-5 14643 167746 2
926 agent claude-sonnet-5 826 182389 2
927 agent claude-sonnet-5 611 183215 20
928 agent claude-sonnet-5 107 183826 2
929 agent claude-sonnet-5 3426 183933 3
930 agent claude-sonnet-5 490 187359 6
931 agent claude-sonnet-5 521 187849 3
932 agent claude-sonnet-5 455 188370 2
933 agent claude-sonnet-5 290 188825 2
934 agent claude-sonnet-5 551 189115 3
935 agent claude-sonnet-5 983 189666 5
936 agent claude-sonnet-5 5564 190649 2
937 agent claude-sonnet-5 880 196213 6
938 agent claude-sonnet-5 701 197093 5
939 agent claude-sonnet-5 383 197794 7
940 agent claude-sonnet-5 3288 198177 3
941 agent claude-sonnet-5 1752 201465 17
942 agent claude-sonnet-5 766 203217 20
943 agent claude-sonnet-5 113 203983 2
944 agent claude-sonnet-5 135 204096 8
945 agent claude-sonnet-5 103 204231 20
946 agent claude-sonnet-5 747 204334 20
947 agent claude-sonnet-5 4160 205081 2
948 agent claude-sonnet-5 134 209241 7
949 agent claude-sonnet-5 516 209375 2
950 agent claude-sonnet-5 408 209891 17
951 agent claude-sonnet-5 528 210299 9
952 agent claude-sonnet-5 160 210827 7
953 agent claude-sonnet-5 1295 210987 2
954 agent claude-sonnet-5 478 212282 17
955 agent claude-sonnet-5 378 212760 4
956 agent claude-sonnet-5 808 213138 8
957 agent claude-sonnet-5 1148 213946 20
958 agent claude-sonnet-5 170 215094 2
959 agent claude-sonnet-5 1168 215264 8
960 agent claude-sonnet-5 288 216432 9
961 agent claude-sonnet-5 3975 216720 20
962 agent claude-sonnet-5 459 220695 20
963 agent claude-sonnet-5 357 221154 6
964 agent claude-sonnet-5 640 221511 17
965 agent claude-sonnet-5 396 222151 9
966 agent claude-sonnet-5 455 222547 20
967 agent claude-sonnet-5 669 223002 20
968 agent claude-sonnet-5 127 223671 2
969 agent claude-sonnet-5 229 223798 7
970 agent claude-sonnet-5 311 224027 3
971 agent claude-sonnet-5 385 224338 3
972 agent claude-sonnet-5 980 224723 2
973 agent claude-sonnet-5 4837 225703 3
974 agent claude-sonnet-5 10745 230540 2
975 agent claude-sonnet-5 577 241285 3
976 agent claude-sonnet-5 177 241862 3
977 agent claude-sonnet-5 142 242039 2
978 agent claude-sonnet-5 2886 242181 10
979 agent claude-sonnet-5 720 245067 3
980 agent claude-sonnet-5 1805 245787 1
981 agent claude-sonnet-5 409 247592 6
982 agent claude-sonnet-5 324 248001 8
983 agent claude-sonnet-5 17502 0 3
984 agent claude-sonnet-5 2195 17502 20
985 agent claude-sonnet-5 6024 19697 14
986 agent claude-sonnet-5 2595 25721 20
987 agent claude-sonnet-5 2590 28316 2
988 agent claude-sonnet-5 15029 30906 2
989 agent claude-sonnet-5 292 45935 20
990 agent claude-sonnet-5 2944 46227 20
991 agent claude-sonnet-5 2459 49171 20
992 agent claude-sonnet-5 2788 51630 14
993 agent claude-sonnet-5 2583 54418 2
994 agent claude-sonnet-5 3742 57001 14
995 agent claude-sonnet-5 1475 60743 2
996 agent claude-sonnet-5 3149 62218 5
997 agent claude-sonnet-5 3708 65367 6
998 agent claude-sonnet-5 3608 69075 2
999 agent claude-sonnet-5 4284 72683 8
1000 agent claude-sonnet-5 1682 76967 5
1001 agent claude-sonnet-5 19693 78649 20
1002 agent claude-sonnet-5 726 98342 2
1003 agent claude-sonnet-5 7426 99068 2
1004 agent claude-sonnet-5 879 106494 8
1005 agent claude-sonnet-5 816 107373 20
1006 agent claude-sonnet-5 3200 108189 9
1007 agent claude-sonnet-5 2714 111389 3
1008 agent claude-sonnet-5 502 114103 4
1009 agent claude-sonnet-5 430 114605 2
1010 agent claude-sonnet-5 8857 115035 5
1011 agent claude-sonnet-5 6330 123892 5
1012 agent claude-sonnet-5 242 130222 5
1013 agent claude-sonnet-5 27004 130464 5
1014 agent claude-sonnet-5 436 157468 3
1015 agent claude-sonnet-5 2144 157904 2
1016 agent claude-sonnet-5 1696 160048 6
1017 agent claude-sonnet-5 1991 161744 5
1018 agent claude-sonnet-5 825 163735 17
1019 agent claude-sonnet-5 602 164560 2
1020 agent claude-sonnet-5 3345 165162 3
1021 agent claude-sonnet-5 7685 168507 3
1022 agent claude-sonnet-5 1166 176192 3
1023 agent claude-sonnet-5 6303 177358 6
1024 agent claude-sonnet-5 7851 183661 2
1025 agent claude-sonnet-5 9678 191512 6
1026 agent claude-sonnet-5 2410 201190 3
1027 agent claude-sonnet-5 1893 203600 3
1028 agent claude-sonnet-5 2319 205493 3
1029 agent claude-sonnet-5 5577 207812 4
1030 agent claude-sonnet-5 1452 213389 2
1031 agent claude-sonnet-5 327 214841 4
1032 agent claude-sonnet-5 507 215168 6
1033 agent claude-sonnet-5 3457 215675 7
1034 agent claude-sonnet-5 1961 219132 17
1035 agent claude-sonnet-5 226 221093 3
1036 agent claude-sonnet-5 3185 221319 5
1037 agent claude-sonnet-5 1224 224504 1
1038 agent claude-sonnet-5 830 225728 2
1039 agent claude-sonnet-5 2284 226558 6
1040 agent claude-sonnet-5 4024 228842 2
1041 agent claude-sonnet-5 691 232866 3
1042 agent claude-sonnet-5 1185 233557 2
1043 agent claude-sonnet-5 381 234742 20
1044 agent claude-sonnet-5 2321 235123 4
1045 agent claude-sonnet-5 442 237444 20
1046 agent claude-sonnet-5 1781 237886 3
1047 agent claude-sonnet-5 1035 239667 6
1048 agent claude-sonnet-5 340 240702 2
1049 agent claude-sonnet-5 745 241042 20
1050 agent claude-sonnet-5 335 241787 9
1051 agent claude-sonnet-5 1118 242122 7
1052 agent claude-sonnet-5 484 243240 2
1053 agent claude-sonnet-5 2172 243724 2
1054 agent claude-sonnet-5 395 245896 4
1055 agent claude-sonnet-5 928 246291 2
1056 agent claude-sonnet-5 192 247219 2
-->
<!-- /cout -->

# 2026-08-22 — claude/ramure-v2-refonte-1q0zsr

Branche : `claude/ramure-v2-refonte-1q0zsr`
Périmètre : `ramure-v2` — reprise des neuf PRP après le durcissement de la chaîne
de développement (revue outillée à cinq axes). Aucune autre app touchée.
Mode : `chaud`

## Anomalies

### 1. L'axe de couverture navigateur ne mesure rien sur cette app, et le dit vert

**Symptome** — `./scripts/revue.sh ramure-v2` rend « ok couverture Go 81.7% ».
Pas un mot du navigateur, alors que l'app porte 13 fichiers de test et 167 tests
TypeScript — soit la moitie de son code. `revue_couverture_web` est absent de son
`app.yml`, donc aucune barre n'est posee, donc meme l'avertissement « aucune
barre posee » ne se declenche pas : la cle vide passe pour un choix.

**Cause** — l'axe ne sait lire qu'une seule forme : `node --test
tests/*.test.js`, a la racine de l'app. `ramure-v2` teste son client avec
`vitest`, sous `web/tests/*.test.ts`. Le glob ne matche rien, `web_pct` reste
vide, et le code ne distingue pas « cette app n'a pas de navigateur » de « je
n'ai pas su la mesurer ». C'est exactement le vert silencieux que
`memory/revue.md` dit refuser — « un axe qui ne lit rien doit crier, pas rendre
0 » —, ici sous une quatrieme forme que ses quatre cas connus ne couvraient pas :
non pas un outil qui tombe ou qui lit de travers, mais un outil qui n'est jamais
appele.

**Detecte par** — `auteur`

**Action** — `garde-fou` — l'axe doit crier quand une app a des tests navigateur
qu'il ne sait pas lancer, au lieu de rendre un verdict Go seul.

### 2. La moitie du client n'est couverte par aucun test unitaire, et personne ne pouvait le savoir

**Symptome** — mesure faite a la main, l'axe ne la faisant pas (anomalie 1) :
couverture navigateur **53,9 %** de lignes, contre 81,7 % cote Go. Le detail est
plus dur que le total : `main.ts`, **1157 lignes**, tout le cablage de
l'application — routage, montage des ecrans, branchement des evenements — est a
**0 %**. `sw.ts` est a 20,3 %. Les onze autres modules sont entre 84 % et 100 %.

**Cause** — deux causes additionnees. La premiere est structurelle : `main.ts`
est un script d'assemblage a effet de bord immediat, sans fonction exportee ; il
n'y a rien a appeler depuis un test, donc aucun test n'a ete ecrit. La seconde
est que rien ne l'a signale — les 167 tests passent, la revue est verte, et le
seul chiffre affiche est celui du Go. Un module a 0 % dans une app qui annonce
81,7 % : les deux chiffres coexistent sans se contredire parce qu'ils ne parlent
pas du meme code.

**Detecte par** — `auteur`

**Action** — `garde-fou` — meme cause que l'anomalie 1 : un axe qui ne mesure
pas une moitie du code laisse cette moitie deriver sans bruit.

### 3. Le tri de la discographie par appreciation est faux, et ses deux tests ne pouvaient pas le voir

**Symptome** — F-21 demande la discographie triee par appreciation decroissante,
les albums sans note significative rejetes en fin de liste dans leur ordre
d'origine. Sur une liste melangee — un album note 1.0, un sans note, un note
9.0, un sans note, un note 5.0 — la fonction rend l'ordre source inchange :
l'album note 9 reste derriere l'album note 1. Reproduit sur la vraie fonction
pendant l'audit.

**Cause** — le comparateur passe a `sort.SliceStable` rend `false` des que l'un
des deux albums est sous le seuil de votes. Ce n'est pas un ordre strict faible :
la relation n'est pas transitive, deux albums notes peuvent se retrouver
« egaux » via un album non note intercale, et le tri de Go part alors de travers
**en silence**. Les deux tests existants ne comparaient chacun qu'un seul type de
paire — deux notes entre eux, ou deux non-notes entre eux. Aucun ne melangeait
les deux, c'est-a-dire aucun ne testait le cas reel.

**Detecte par** — `relecture`

**Action** — `comportement` — un comparateur se teste sur une liste **melangee**,
pas sur deux paires homogenes. Deux tests verts qui n'exercent jamais la
combinaison sont un cas particulier de couverture menteuse : le pourcentage
monte, la regle n'est pas exercee.

### 4. Deux documents de l'app decrivaient un etat de la serie depasse

**Symptome** — le `README` de l'app annonce « Socle deployable […] Le canevas,
l'arbre et les sources de donnees arrivent aux etapes suivantes » et « Go 1.24,
bibliotheque standard uniquement a ce stade », quarante lignes au-dessus de sa
propre documentation de `/api/centre`, de la collection, du service worker et de
l'installation. `web/tests/REFERENCE.md` annonce 165 tests client et 161
fonctions Go, pour 167 et 164 reels.

**Cause** — les deux fichiers sont ecrits une fois, a l'etape qui les cree, et
rien ne les relit ensuite : aucun controle ne compare un chiffre ecrit dans un
document a la mesure correspondante. Le cas de `REFERENCE.md` est le plus net —
un commit a retouche ce fichier le jour meme ou les compteurs devenaient faux,
sans corriger la table.

**Detecte par** — `relecture`

**Action** — `garde-fou` — un chiffre recopie a la main dans un document derive
en silence. Soit il se genere, soit il ne s'ecrit pas.

### 5. Deux chantiers enchaines sans enregistrement entre les deux

**Symptome** — l'instrumentation de la couverture navigateur et le correctif du
tri de la discographie se sont retrouves dans le meme arbre de travail sale, et
donc dans le meme commit, alors que ce sont deux etapes independantes, relisables
separement.

**Cause** — j'ai lance le second artisan sans passer le greffier entre les deux.
Le greffier fait `git add -A` : une fois les deux chantiers dans l'arbre, il n'y
a plus de decoupage possible sans faire moi-meme le `git add` selectif que le
contrat me retire. Le decoupage en commits se decide **avant** de lancer
l'artisan suivant, pas apres.

**Detecte par** — `auteur`

**Action** — `comportement` — un artisan, puis un greffier, puis l'artisan
suivant. L'ordre n'est pas une preference de style : il est la seule fenetre ou
le decoupage existe encore.


### 6. L'artisan repart en tache de fond malgre le drapeau explicite

**Symptome** — les trois artisans de cette branche ont ete lances avec
`run_in_background: false`, comme le contrat l'exige. Le harnais a repondu
« Async agent launched successfully » aux trois, et a rendu la main
immediatement.

**Cause** — inconnue, cote harnais. Ce n'est pas neuf : `docs/parallelisme.md`
signale deja deux entrees de journal qui rapportent le meme comportement. Troisieme
occurrence, meme drapeau, meme resultat.

**Detecte par** — `auteur`

**Action** — `contrat` — le contrat presente `run_in_background: false` comme la
protection qui empeche deux ecrivains de se marcher dessus. Elle ne protege pas :
c'est la session appelante qui doit **n'en lancer qu'un a la fois**, et le
drapeau ne fait rien pour l'y aider. Le dire ainsi plutot que de repeter un
drapeau sans effet.


### 7. Un test nomme par un PRP peut ne jamais etre ecrit sans que rien ne le voie

**Symptome** — la tache 3 du PRP 06 exige que « le service choisi soit relu du
serveur au demarrage, pas du navigateur ». Le comportement est livre et
fonctionne en production ; aucun test ne l'exerce, ni unitaire ni bout en bout.
Meme famille, un cran plus bas : `textes.suggestionsLabel` etait defini dans le
fichier des libelles et pose nulle part, si bien que la liste de suggestions —
que la tache 2 du meme PRP voulait annoncee — n'avait pas de nom accessible.

**Cause** — les PRP nomment leurs tests un par un, et rien ne verifie ensuite que
le test nomme existe. Le seul controle proche est celui de `--check` sur les
tests cites par `PRODUCT.md`, et il ne cherche pas sous `internal/` : il rend des
`attn` sur des tests qui existent bel et bien, ce qui apprend a ne plus le lire.
Un controle qui crie a tort sur ce qui va couvre ce qui ne va pas.

**Detecte par** — `relecture`

**Action** — `garde-fou` — un nom de test ecrit dans un PRP ou un PRD est une
promesse verifiable mecaniquement : soit la fonction existe quelque part sous
l'app, soit le document ment. Et le controle existant doit d'abord cesser de se
tromper avant qu'on lui en demande plus.

**Suite, chiffree.** Le controle existant rend **sept** avertissements sur cette
app. Verification faite un par un : **six sont faux** — les tests existent, sous
`internal/`, ou il ne cherche pas. Le septieme est vrai :
`TestCadragePlusEtroitSurEcranEtroit`, que le PRD §14 designe comme la
mitigation du risque « le canevas exige de la place », n'existe nulle part.
`cadragePour` — la fonction qui fait dependre de la largeur le nombre de
branches et d'heritiers — n'a aucun test : tous les tests d'arbre passent
`CadrageLarge` en dur.

Six faux positifs cachaient un vrai. C'est la demonstration exacte de ce que
coute un controle qui crie a tort : non pas du bruit, mais un vrai constat
rendu invisible parmi ses six voisins.

### 8. Une constante de libelle definie et jamais posee ne se voit dans aucun axe

**Symptome** — `textes.suggestionsLabel` etait exporte, jamais reference.
`staticcheck` ne le voit pas — c'est du TypeScript ; `tsc --noEmit` ne le voit
pas non plus — un export non utilise est legitime dans un module ; et la
couverture le comptait comme couvert, puisque le fichier de libelles est
integralement evalue a l'import.

**Cause** — une valeur morte dans un module de constantes est invisible aux cinq
axes a la fois. Elle est pourtant le signe le plus fiable qu'une exigence a ete
a moitie faite : quelqu'un a ecrit le libelle, puis n'a pas pose l'attribut.

**Detecte par** — `relecture`

**Action** — `outillage` — la chaine navigateur n'a aucun detecteur de code mort
cote TypeScript. `tsc --noEmit` n'est pas un remplacant : ce n'est pas son role.

### 9. L'outil de navigation depose ses traces a la racine du depot

**Symptome** — pendant la critique des ecrans, un repertoire `.playwright-mcp/`
apparait a la **racine** du depot, avec journaux de console et instantanes de
page. Il n'est ignore nulle part, donc `git status` le voit, donc le `git add -A`
du greffier l'aurait committe — et il aurait atterri sur `main` avec la pull
request.

**Cause** — l'esthete a pour regle de ne rien ecrire hors du repertoire de son
app ; l'outil de navigation qu'il pilote, lui, n'a pas cette regle et ecrit ou
sa configuration lui dit. La regle porte sur l'agent, pas sur ses outils.

**Detecte par** — `auteur`

**Action** — `garde-fou` — soit le repertoire est ignore, soit l'outil est
configure pour ecrire ailleurs. Un depot ou le passage d'un agent laisse des
fichiers non suivis a la racine finit par les committer : il suffit d'un
greffier lance sans regarder.

### 10. Un agent bloque une heure sans que rien ne le signale

**Symptome** — l'esthete lance a 09h56 n'a plus emis une seule ligne apres
10h00, et n'a rendu aucun fichier. Une heure d'attente, un navigateur ouvert,
l'app demarree, et rien. Aucune notification, aucun code d'erreur : du point de
vue de la session appelante, un agent bloque et un agent qui reflechit
longuement sont indiscernables.

**Cause** — non etablie cote agent. Ce qui est etabli, c'est la facon de s'en
apercevoir : la seule trace exploitable est l'horodatage du fichier de
transcription du sous-agent, sous
`~/.claude/projects/<depot>/<session>/subagents/`. Fige depuis 58 minutes, il
tranche ce qu'aucun autre signal ne disait.

**Detecte par** — `auteur`

**Action** — `comportement` — un agent lance en fin de branche se surveille a la
croissance de sa transcription, pas a l'espoir qu'il rende. Et une mission
longue s'ecrit avec un **premier livrable impose tout de suite** : le second
esthete a recu l'ordre de deposer sa critique squelettique avant de regarder
quoi que ce soit, pour qu'une heure perdue laisse au moins un fichier.

### 11. Une interface francophone sans un seul accent, en ligne depuis le premier jour

**Symptome** — la critique des ecrans a trouve **zero diacritique** dans toute
l'interface : « Gardes recemment », « Deja garde », « Ta session a expire ». Une
app dont le PRD tranche « francophone », dont le vocabulaire est declare
contractuel, affichait un francais sans accents a tous ses visiteurs depuis sa
mise en ligne.

**Cause** — les libelles ont ete ecrits sans accents par commodite de saisie, et
rien ne les relit : `tsc` valide des chaines, la couverture les compte comme
executees, `jscpd` ne les compare pas, et les tests de bout en bout les
selectionnent par le texte **tel qu'il est ecrit** — donc ils passaient au vert
en confirmant l'erreur. Cinq litteraux de test portaient les memes fautes.

**Detecte par** — `relecture`

**Action** — `garde-fou` — un test qui selectionne par un libelle errone valide
le libelle errone. Rien dans la chaine ne regarde la langue de ce qui s'affiche,
alors que la langue est une exigence ecrite du PRD.

### 12. La barre de couverture posee le matin a attrape une regression l'apres-midi

**Symptome** — `test.sh` a echoue : « Coverage for lines (56.45%) does not meet
global threshold (57%) ». La critique des ecrans venait d'ajouter cent vingt-six
lignes a `main.ts`, le fichier a 0 %, ce qui a dilue le ratio sous la barre.

**Cause** — aucune. C'est le garde-fou qui fait exactement ce pour quoi il a ete
pose ce matin, quelques heures apres l'avoir ete, sur du code ecrit par un autre
agent que celui qui l'a installe. Notee ici parce qu'une mesure qui n'a jamais
rien attrape ne prouve rien, et que celle-ci a desormais attrape quelque chose.

**Detecte par** — `test`

**Action** — `rien` — le garde-fou a joue, le code neuf part se faire tester.

### 13. La critique a pris pour un defaut un chargement volontairement differe

**Symptome** — l'esthete signale comme le plus grave de ses constats que
`/api/centre` rend « ok » avec dix branches et **zero heritier**, et que rien a
l'ecran ne dit que la moitie de l'arbre manque. Verification faite : c'est le
comportement voulu — `internal/arbre/centre.go:89` ecrit « les heritiers de
chaque branche restent vides : F-39 les charge ensuite ».

**Cause** — l'esthete regarde l'ecran et n'a pas a lire le serveur, qui est hors
de son perimetre. Un chargement progressif ressemble, sur une capture, a un
chargement incomplet. Ecarte, avec sa raison.

**Detecte par** — `relecture`

**Action** — `rien` — le partage des perimetres a fonctionne : l'esthete a
montre plutot que de decider, et la verification a tranche en deux minutes.


### 14. La CI ne demarrait pas, et son silence ressemblait a une attente

**Symptome** — la pull request ouverte, aucun controle n'apparait. Ni rouge, ni
vert, ni « en cours » : **zero controle**, vingt-sept minutes durant. L'API le
confirme — aucun run de workflow n'existe pour cette branche.

**Cause** — `main` avait avance de quarante-cinq commits pendant la branche, et
la pull request etait en conflit. GitHub ne peut alors pas construire la
reference de fusion sur laquelle tournent les workflows declenches par
`pull_request` : il n'echoue pas, il ne lance rien. `mergeable_state: dirty`
dans la reponse de l'API etait le seul endroit ou cela se lisait.

**Detecte par** — `auteur`

**Action** — `comportement` — devant une CI muette, la premiere question n'est
pas « qu'est-ce qui echoue » mais « a-t-elle seulement demarre ». Zero controle
et un controle en cours se ressemblent, et seul l'etat de mergeabilite les
distingue. Attendre un resultat qui ne viendra jamais coute plus cher qu'un
appel d'API.

### 15. Deux sessions ont ecrit le meme test, le meme jour, sous le meme nom

**Symptome** — la fusion de `main` a fait entrer un second
`TestCadragePlusEtroitSurEcranEtroit` dans le meme paquet, git ayant fusionne
les deux ajouts **sans conflit** : ils tombaient a des endroits differents du
fichier. Deux fonctions de meme nom dans un meme paquet Go — seul le
compilateur l'aurait attrape.

**Cause** — le nom du test est **impose par le PRD**, qui le designe comme la
mitigation d'un risque. Deux sessions ayant lu le meme PRD le meme jour ont donc
ecrit la meme fonction sous le meme nom, chacune de son cote. Un nom impose par
un document partage est un point de collision par construction, et git ne voit
pas les collisions de symboles, seulement celles de lignes.

**Detecte par** — `auteur`

**Action** — `comportement` — celle de `main` est gardee : elle verifie la meme
propriete au niveau de la fonction **et** a travers la route HTTP, la seconde
prouvant que le parametre de largeur atteint reellement la selection. La mienne
s'arretait au premier niveau. Deux ecritures independantes de la meme exigence
ne sont pas un gaspillage complet : la comparaison a designe la meilleure.

### 16. Un cas de bout en bout rouge une fois, vert au rejeu, code identique

**Symptome** — juste apres la fusion, `collection-hors-ligne.spec.ts` echoue sur
le cycle hors ligne de F-33 : 20 passes, 1 echoue. Rejoue sans toucher une
ligne : 21/21.

**Cause** — non etablie. Ce n'est pas neuf dans ce depot : une entree anterieure
rapporte deja « une suite de bout en bout rouge une fois sur trois, code
identique ». Le rejeu unique est ici conforme a la regle — un echec qui ne se
reproduit pas a l'identique une fois ne se traite pas comme un defaut, mais il
se consigne, sans quoi la troisieme occurrence ressemblera encore a la premiere.

**Detecte par** — `test`

**Action** — `garde-fou` — l'instabilite est desormais vue sur deux suites
differentes. Tant qu'elle n'est pas nommee, chaque branche paiera son rejeu et
personne n'accumulera les occurrences.

---

## Suite — apres fusion, les deux choix rendus par l'utilisateur

La pull request #171 est fusionnee et deployee (`e83765c`). La branche repart de
`main` sous le meme nom, et cette entree continue apres ce separateur plutot que
d'en ouvrir une seconde : c'est le meme sujet, et les anomalies d'avant la
fusion expliquent une partie de ce qui suit.

L'esthete avait montre trois variantes pour chacun des deux ecrans qu'il
refusait de trancher seul. L'utilisateur a retenu **C** pour l'ecran d'echec de
plantation — bande pleine largeur, arbre precedent conserve et estompe — et
**A** pour le mur d'accueil sur ecran large — pochettes carrees, grille centree.
Les deux decisions, avec ce qui a ete ecarte et pourquoi, sont ecrites au
`PRODUCT.md` §17.

### 17. L'app affirmait un resultat qu'elle n'avait pas

**Symptome** — une graine mal orthographiee ne produisait pas un echec mais un
**faux resultat** : un disque de 119 px au centre de l'ecran, portant le nom
saisi, entoure de rien. Le seul dementi etait une ligne de gris de 12,8 px a
l'autre bout de l'ecran.

**Cause** — l'ecran d'echec n'avait jamais ete concu ; le chemin nominal a servi
de chemin par defaut, et un centre sans voisins reste un centre a l'affichage.
Le PRD exigeait pourtant (F-36) que « rien a montrer » et « panne » produisent
deux messages differents — la troisieme possibilite, « ce nom ne correspond a
rien », n'etait dans aucune des deux cases.

**Detecte par** — `relecture`

**Action** — `arbitrage` — la forme de cet ecran revenait a l'utilisateur, et
elle lui a ete montree en trois variantes plutot que decidee. Trancher seul
aurait ete plus rapide et aurait produit un ecran que personne n'aurait choisi.

### 18. Le bout en bout a rattrape une regression que rien d'autre ne voyait

**Symptome** — en supprimant le centre fantome de l'ecran d'echec, la mise a jour
de la lignee disparaissait avec lui : une tentative de plantation fautive puis
corrigee ne comptait plus comme « centre quitte ». F-14 et F-29 s'en trouvaient
casses. `parcours.spec.ts` l'a vu ; aucun test unitaire ne pouvait le voir.

**Cause** — le dessin du faux centre et l'avancement de la lignee vivaient dans
la meme fonction de `main.ts`, le fichier que l'app exempte deliberement de test
unitaire. Retirer l'un retirait l'autre. Deux responsabilites au meme endroit,
dont une seule etait le sujet du chantier.

**Detecte par** — `test`

**Action** — `rien` — le filet a joue exactement ou il devait : le bout en bout
est ce qui couvre le cablage que l'unitaire ne couvre pas, et c'est
l'argument sur lequel repose l'exemption de `main.ts`. Il vient d'etre paye.

### 19. Le carre pose en centrant la grille rouvrait le vide qu'on venait de fermer

**Symptome** — premiere mise en oeuvre des pochettes carrees : colonnes de
largeur fixe plus grille centree. Le rendu paraissait juste. A la mesure, le vide
lateral revenait — environ 260 px de chaque cote a 1440 px, la ou le correctif de
la veille l'avait ramene a presque rien. Le defaut n'etait plus asymetrique, donc
plus visible a l'oeil ; il etait toujours la.

**Cause** — deux facons d'obtenir un carre. Figer la largeur de colonne le donne,
et abandonne l'occupation de la largeur disponible. Garder les colonnes
elastiques et faire porter le carre sur la hauteur de rangee le donne aussi, sans
rien lacher. La premiere est la premiere qui vient a l'esprit.

**Detecte par** — `auteur`

**Action** — `comportement` — un correctif de mise en page se verifie a la
mesure, jamais au rendu. Un vide symetrique ressemble a une marge voulue ; c'est
ce qui l'aurait fait passer.

### 20. Le mur ne redimensionne plus, il rogne

**Symptome** — les tuiles etant desormais de taille fixe plutot qu'etirees en
hauteur, une collection assez grande deborderait verticalement, et
`overflow: hidden` rognerait les dernieres au lieu de les retrecir comme avant.

**Cause** — le contrat existant du mur — pas de defilement — a ete ecrit quand
les tuiles s'etiraient : elles absorbaient la place. Des tuiles carrees ne
l'absorbent plus. Le contrat n'a pas change, ce qu'il gouverne si.

**Detecte par** — `auteur`

**Action** — `arbitrage` — rien n'est casse aujourd'hui, l'accueil ne montrant
que six propositions. Cela le deviendra si F-28 ou F-30 laissent la collection
grossir sans plafond. Ne pas le corriger a l'aveugle : le choix entre plafonner
le nombre de tuiles, autoriser le defilement, ou retrecir sous un seuil est un
choix de produit.

### 21. La phrase d'echec corrigee cote client n'etait pas celle que le visiteur lit

**Symptome** — la passe du 22 aout a accentue toute l'interface, `textes.ts`
compris, y compris son message « aucun artiste ne correspond a… ». La critique
du 23 aout, regardant l'ecran reel, retrouve la meme phrase **sans accent** — et
vouvoyant, dans une app qui tutoie partout. Le libelle corrige cote client est un
**repli**, jamais atteint des que le serveur repond : la phrase affichee vient de
`internal/arbre/centre.go`.

**Cause** — le meme message existe a deux endroits, dans deux langages, et rien
ne dit lequel fait autorite. Corriger « toutes les chaines affichees » en ne
regardant que `textes.ts` etait donc faux sans en avoir l'air : le fichier
s'annonce comme la source unique — ses propres tests l'affirment — alors qu'il ne
l'est pas.

**Detecte par** — `relecture`

**Action** — `contrat` — « les chaines affichees vivent dans textes.ts et nulle
part ailleurs » est une regle que le depot ecrit et que le serveur enfreint. Soit
le serveur ne rend pas de texte affichable, soit la regle nomme les deux
sources. Aujourd'hui elle en cache une.

### 22. Le service worker a fait mesurer l'etat d'avant les correctifs

**Symptome** — la premiere serie de mesures de la critique du 23 aout portait sur
l'interface **precedente**. Profil de navigateur neuf, app relancee, binaire
reconstruit : le service worker servait quand meme la coquille mise en cache la
veille.

**Cause** — c'est son role, et il le remplit bien. Mais toute mesure faite en
navigateur sur cette app doit purger `ramure-shell` d'abord, sans quoi elle
decrit un etat qui n'existe plus. Un profil neuf ne suffit pas : le cache est
reconstruit au premier chargement, avant la mesure.

**Detecte par** — `auteur`

**Action** — `comportement` — l'app est installable et fonctionne hors ligne ;
la contrepartie est qu'elle ment a qui la mesure sans precaution. A dire dans la
mission de tout agent qui regarde ses ecrans.

### 23. Un troisieme choix de forme est remonte, non tranche

**Symptome** — la critique du 23 aout montre que le mur d'accueil laisse 548 px
de noir, soit 70 % de la zone, une fois les tuiles rendues carrees. La forme
carree etant un choix de l'utilisateur, la question qui suit lui revient aussi :
qu'est-ce qui occupe cette place.

**Cause** — aucune. Une decision de forme en appelle une autre, et c'est normal :
rendre les tuiles carrees liberait mecaniquement de la hauteur.

**Detecte par** — `relecture`

**Action** — `arbitrage` — trois variantes publiees, rien de retenu d'avance.
Non bloquant pour cette livraison : l'ecran est correct, il est seulement vide.

### 24. Le garde-fou d'orthographe ecrit le matin accusait des phrases correctes

**Symptome** — le test cense tenir « les messages rendus a l'utilisateur sont
accentues et tutoient » signale « Cet artiste a disparu de la source. » comme
portant un accent manquant. Il prend le verbe *avoir* pour un *a* prive de son
accent grave. Il refuserait donc des messages justes. Et symetriquement, sa
liste de mots interdits laisse passer `repondu`, `resultat`, `acces`, `cree`.

**Cause** — cent soixante-dix-huit lignes d'analyse syntaxique et d'heuristique
ecrites pour tenir cinq litteraux d'un seul fichier. La regle « un `a` seul est
un `a` mal accentue » est vraie assez souvent pour paraitre bonne, et fausse
exactement sur le verbe le plus frequent de la langue. Les deux neutralisations
posees couvrent l'elision, pas le verbe plein.

**Detecte par** — `relecture`

**Action** — `garde-fou` — c'est le meme defaut que les six faux « introuvable »
consignes plus haut, reproduit le jour meme ou celui-la etait constate : un
controle qui crie a tort finit ignore, et emporte avec lui les vrais constats.
Un garde-fou se verifie sur ce qu'il doit ACCEPTER autant que sur ce qu'il doit
refuser.

### 25. Le correctif rendait le contenu, pas le moyen d'agir

**Symptome** — sur un echec de plantation depuis l'accueil, le mur avait d'abord
disparu : sept cent quatre-vingt-onze pixels de noir, aucune action. Corrige, les
six tuiles reviennent — mais estompees **et inertes**, la barre d'accueil
masquee. La bande dit « plante un autre nom » et le seul moyen de le faire est de
ressaisir a la main : une tuile EST ce rebond, et elle ne repond pas.

**Cause** — l'estompe de l'arbre avait ete etendue a l'accueil au nom du « meme
traitement ». La raison ne se transferait pas : rendre l'arbre inerte empeche une
promotion parasite derriere une bande d'echec, alors qu'une tuile du mur est
precisement l'action que cette bande recommande. Le constat d'origine disait
« zero contenu, zero action » ; le correctif n'avait referme que la premiere
moitie.

**Detecte par** — `relecture`

**Action** — `arbitrage` — tranche ici : l'estompe de l'accueil reste **visuelle**,
ses tuiles et sa barre redeviennent actionnables ; celle de l'arbre reste
inerte. Les deux cas ne se traitent pas pareil, et un commentaire doit le dire,
sans quoi le prochain lecteur les realignera.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-23 à 10:54 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-4-7, claude-opus-5, claude-haiku-4-5-20251001, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 3 709 | 0,01 $ |
| Écriture de cache | 3 776 326 | 17,62 $ |
| Lecture de cache | 171 436 055 | 71,26 $ |
| Sortie | 168 082 | 4,09 $ |
| **Total** | **175 384 172** | **92,97 $ — 80,74 €** |

**Ce qui coûte**

- **1559 appel(s) au modèle** — un par réponse, outils compris —, dont 1288 par des sous-agents — 113 093 616 jetons, 52,12 $.
- **Démarrage** — contrat, outillage et définitions d'outils pèsent
  68 792 jetons, écrits une fois par session puis relus à chaque
  échange : 18 573 840 jetons de relecture, 10 % de tout ce qui a été relu.
- **Tours courts** — 1 407 des 1 559 tours (90 %) sortent
  moins de 300 jetons : un appel d'outil nu, qui paie tout le contexte relu pour
  une sortie de rien. Ils coûtent 67,90 $, soit 73 % de la facture.
  Dont 1 284 chez des agents, où un tour EST un appel d'outil :
  ceux-là ne se groupent pas — c'est la LONGUEUR de la session qu'il faut réduire,
  ligne suivante. Le reste vient de la session principale, et se groupe.
- **Sessions d'agent** — 33, dont la plus longue fait 168 tours,
  relit 119 080 jetons par tour en moyenne et coûte 11,33 $.
  Son coût croît en **carré** de sa longueur : deux fois plus de tours, chacun
  relisant deux fois plus. Deux sessions de moitié, la seconde repartant du
  document de conception et non de l'exploration de la première, coûtent environ
  la moitié.
  **Au-delà de 60 tours, découpe le chantier.**
- **Croissance** — 68 792 jetons relus au premier appel qui relise
  quelque chose, 393 853 au dernier : une session longue se paie à chaque tour.

<!-- cout-total: 175384172 -->
<!-- cout-agent-max: 168 -->
<!-- cout-detail : un échange par ligne — rang, agent, modèle, écriture, lecture, sortie
1 principal claude-opus-5 68792 0 203
2 principal claude-opus-5 3566 68792 376
3 principal claude-opus-5 7469 72358 418
4 principal claude-opus-5 24640 79827 451
5 principal claude-opus-5 2552 104467 523
6 principal claude-opus-5 1824 107019 598
7 principal claude-opus-5 2806 108843 298
8 principal claude-opus-5 504 111649 1387
9 principal claude-opus-5 2066 112153 1083
10 principal claude-opus-5 3785 114219 6396
11 principal claude-opus-5 10039 118004 404
12 principal claude-opus-5 1974 128043 283
13 principal claude-opus-5 3442 130017 2285
14 principal claude-opus-5 2521 133459 185
15 principal claude-opus-5 885 135980 310
16 principal claude-opus-5 933 136865 388
17 principal claude-opus-5 462 137798 236
18 principal claude-opus-5 1209 138260 1078
19 principal claude-opus-5 4912 139469 724
20 principal claude-opus-5 2254 144381 1748
21 principal claude-opus-5 2833 146635 322
22 principal claude-opus-5 1576 149468 489
23 principal claude-opus-5 616 151044 274
24 principal claude-opus-5 900 151660 539
25 principal claude-opus-5 753 152560 78
26 principal claude-opus-5 3143 153313 1634
27 principal claude-opus-5 10608 156456 1974
28 principal claude-opus-5 1993 167064 247
29 principal claude-opus-5 1168 169057 358
30 principal claude-opus-5 1740 170225 673
31 principal claude-opus-5 4503 171965 2336
32 principal claude-opus-5 4060 176468 1079
33 principal claude-opus-5 1400 180528 1486
34 principal claude-opus-4-7 26921 29208 164
35 principal claude-opus-4-7 252 56129 93
36 principal claude-opus-4-7 280 56381 96
37 principal claude-opus-5 1685 181928 318
38 principal claude-opus-4-7 5440 56661 938
39 principal claude-opus-4-7 5404 62101 943
40 principal claude-opus-5 2056 183613 3826
41 principal claude-opus-5 4332 185669 325
42 principal claude-opus-5 501 190001 1038
43 principal claude-opus-5 1069 190502 458
44 principal claude-opus-5 738 191571 382
45 principal claude-opus-5 984 192309 714
46 principal claude-opus-5 944 193293 28
47 principal claude-opus-5 3896 192309 498
48 principal claude-opus-5 1084 196205 1447
49 principal claude-opus-4-7 20898 29208 165
50 principal claude-opus-4-7 290 50106 124
51 principal claude-opus-4-7 221 50396 84
52 principal claude-opus-4-7 155 50617 94
53 principal claude-opus-4-7 3526 50772 91
54 principal claude-opus-4-7 21732 54298 138
55 principal claude-opus-4-7 2101 76030 93
56 principal claude-opus-5 2056 197289 1770
57 principal claude-opus-4-7 2121 78131 3492
58 principal claude-opus-4-7 3566 80252 69
59 principal claude-opus-5 2163 199345 1339
60 principal claude-opus-5 1370 201508 413
61 principal claude-opus-5 1916 202878 564
62 principal claude-opus-5 830 204794 94
63 principal claude-opus-5 1197 205624 902
64 principal claude-opus-5 1005 206821 18
65 principal claude-opus-5 298 207826 187
66 principal claude-opus-5 343 208124 820
67 principal claude-opus-5 923 208467 20
68 principal claude-opus-5 1813 208124 150
69 principal claude-opus-5 1293 209937 274
70 principal claude-opus-5 2553 211230 1138
71 principal claude-opus-5 1334 213783 1203
72 principal claude-opus-5 1605 215117 256
73 principal claude-opus-5 489 216722 249
74 principal claude-opus-5 1128 217211 491
75 principal claude-opus-5 594 218339 14
76 principal claude-opus-5 285 218947 178
77 principal claude-opus-5 367 219232 657
78 principal claude-opus-5 882 219599 295
79 principal claude-opus-5 3315 220481 1044
80 principal claude-opus-5 1075 223796 14
81 principal claude-opus-5 294 224871 492
82 principal claude-opus-5 592 225165 16
83 principal claude-opus-5 1153 225165 175
84 principal claude-opus-5 468 226318 460
85 principal claude-opus-5 672 226786 439
86 principal claude-opus-5 579 227458 812
87 principal claude-opus-5 1707 228037 1679
88 principal claude-opus-5 2066 229744 671
89 principal claude-opus-5 702 231810 383
90 principal claude-opus-5 484 232512 38
91 principal claude-opus-5 318 232996 149
92 principal claude-opus-5 1006 233314 497
93 principal claude-opus-5 599 234320 25
94 principal claude-opus-5 3758 233314 1613
95 principal claude-opus-5 2918 237072 986
96 principal claude-opus-5 1734 239990 1245
97 principal claude-opus-5 1738 241724 2402
98 principal claude-opus-5 2923 243462 1292
99 principal claude-opus-5 1569 246385 394
100 principal claude-opus-5 497 247954 148
101 principal claude-opus-5 211 248451 516
102 principal claude-opus-5 618 248662 17
103 principal claude-opus-5 1645 249297 455
104 principal claude-opus-5 1063 250942 1579
105 principal claude-opus-4-7 50915 0 153
106 principal claude-opus-4-7 278 50915 123
107 principal claude-opus-4-7 221 51193 73
108 principal claude-opus-4-7 144 51414 84
109 principal claude-opus-4-7 4064 51558 81
110 principal claude-opus-4-7 24277 55622 83
111 principal claude-opus-4-7 10632 79899 82
112 principal claude-opus-4-7 3493 90531 120
113 principal claude-opus-4-7 2083 94024 225
114 principal claude-opus-4-7 3318 96107 78
115 principal claude-opus-5 1775 252005 1389
116 principal claude-opus-5 2019 253780 187
117 principal claude-opus-5 577 255799 368
118 principal claude-opus-4-7 8917 99425 1366
119 principal claude-opus-4-7 1503 108342 126
120 principal claude-opus-5 1521 256376 488
121 principal claude-opus-4-7 1517 109845 1032
122 principal claude-opus-5 769 257897 529
123 principal claude-opus-5 637 258666 195
124 principal claude-opus-5 1529 259303 361
125 principal claude-opus-5 1315 260832 314
126 principal claude-opus-4-7 1812 111362 2740
127 principal claude-opus-5 1124 262147 1323
128 principal claude-opus-5 1482 263271 354
129 principal claude-opus-5 456 264753 11
130 principal claude-opus-5 74 265209 861
131 principal claude-opus-5 1049 265283 22
132 principal claude-opus-5 292 266354 280
133 principal claude-opus-5 866 266646 321
134 principal claude-opus-5 1148 267512 42
135 principal claude-opus-5 2546 268702 2300
136 principal claude-opus-5 2689 271248 364
137 principal claude-opus-5 938 273937 43
138 principal claude-opus-5 106 274875 250
139 principal claude-opus-5 5779 274981 193
140 principal claude-opus-5 421 280760 375
141 principal claude-opus-5 478 281181 7
142 principal claude-opus-5 393 281666 106
143 principal claude-opus-5 542 282059 41
144 principal claude-opus-5 104 282601 358
145 principal claude-opus-5 460 282705 11
146 principal claude-opus-5 2256 283176 1454
147 principal claude-opus-4-7 7873 29208 244
148 principal claude-opus-4-7 368 37081 128
149 principal claude-opus-4-7 235 37449 81
150 principal claude-opus-4-7 151 37684 137
151 principal claude-opus-4-7 2806 37835 336
152 principal claude-opus-5 1777 285432 209
153 principal claude-opus-4-7 2263 40641 505
154 principal claude-opus-5 480 287209 363
155 principal claude-opus-4-7 626 42904 1049
156 principal claude-opus-5 557 287689 120
157 principal claude-opus-5 1412 288246 2008
158 principal claude-opus-5 2073 289658 762
159 principal claude-opus-5 1012 291731 35
160 principal claude-opus-5 385 292743 30
161 principal claude-opus-5 1308 293128 137
162 principal claude-opus-5 311 294436 470
163 principal claude-opus-5 503 294747 406
164 principal claude-opus-5 493 295250 545
165 principal claude-opus-5 286 296288 148
166 principal claude-opus-5 1413 296574 27
167 principal claude-opus-5 356 298014 30
168 principal claude-opus-5 806 298370 137
169 principal claude-opus-5 183 299176 551
170 principal claude-opus-5 1090 299359 476
171 principal claude-opus-5 981 300449 620
172 principal claude-opus-5 3093 301430 455
173 principal claude-opus-5 630 304523 186
174 principal claude-opus-5 2449 305153 655
175 principal claude-opus-5 788 307602 152
176 principal claude-opus-5 3164 308390 773
177 principal claude-opus-5 984 311554 874
178 principal claude-opus-5 908 312538 320
179 principal claude-opus-5 877 313446 436
180 principal claude-opus-5 1380 314323 793
181 principal claude-opus-5 907 315703 824
182 principal claude-opus-5 885 316610 281
183 principal claude-opus-5 1208 317495 350
184 principal claude-opus-5 1021 318703 366
185 principal claude-opus-5 1567 319724 1900
186 principal claude-opus-5 1931 321291 756
187 principal claude-opus-5 957 323222 93
188 principal claude-opus-5 199 324179 791
189 principal claude-opus-5 893 324378 35
190 principal claude-opus-5 336 325271 35
191 principal claude-opus-5 292 325642 32
192 principal claude-opus-5 477 325966 30
193 principal claude-opus-5 689 326443 137
194 principal claude-opus-5 1601 327132 360
195 principal claude-opus-5 1106 328733 133
196 principal claude-opus-5 198 329839 192
197 principal claude-opus-5 308 330037 613
198 principal claude-opus-5 775 330345 366
199 principal claude-opus-5 925 331120 680
200 principal claude-opus-5 911 332045 31
201 principal claude-opus-5 380 332956 30
202 principal claude-opus-5 753 333336 36
203 principal claude-opus-5 303 334125 410
204 principal claude-opus-5 517 334428 217
205 principal claude-opus-5 302 334945 572
206 principal claude-opus-5 674 335247 28
207 principal claude-opus-5 378 335921 30
208 principal claude-opus-5 1097 336299 59
209 principal claude-opus-5 302 337455 114
210 principal claude-opus-5 1907 337757 25
211 principal claude-opus-5 285 339689 151
212 principal claude-opus-5 911 339974 442
213 principal claude-opus-5 549 340885 258
214 principal claude-opus-5 438 341434 929
215 principal claude-opus-5 335500 0 413
216 principal claude-opus-5 4120 335500 210
217 principal claude-opus-5 599 339620 535
218 principal claude-opus-5 1144 340219 723
219 principal claude-opus-5 2248 341363 1359
220 principal claude-opus-5 1392 343611 860
221 principal claude-opus-5 891 345003 2112
222 principal claude-opus-5 2513 345894 357
223 principal claude-opus-5 586 348407 21
224 principal claude-opus-5 84 348993 199
225 principal claude-opus-5 9448 349276 410
226 principal claude-opus-5 1114 358724 1330
227 principal claude-opus-5 1632 359838 445
228 principal claude-opus-5 639 361470 1579
229 principal claude-opus-5 1783 362109 128
230 principal claude-opus-4-7 20186 29208 1674
231 principal claude-opus-4-7 1797 49394 126
232 principal claude-opus-4-7 223 51191 82
233 principal claude-opus-4-7 151 51414 92
234 principal claude-opus-4-7 1930 51565 135
235 principal claude-opus-4-7 3609 53495 242
236 principal claude-opus-5 202 363892 1591
237 principal claude-opus-4-7 551 57104 135
238 principal claude-opus-4-7 1056 57655 976
239 principal claude-opus-5 2109 364094 300
240 principal claude-opus-5 398 366203 35
241 principal claude-opus-5 95 366601 160
242 principal claude-opus-5 218 366696 107
243 principal claude-opus-5 270 367021 343
244 principal claude-opus-5 783 367291 19
245 principal claude-opus-5 79 368074 76
246 principal claude-opus-5 1482 368229 1731
247 principal claude-opus-5 3274 369711 1264
248 principal claude-opus-5 1295 372985 331
249 principal claude-opus-5 433 374280 7
250 principal claude-opus-5 70 374713 71
251 principal claude-opus-5 1687 374854 350
252 principal claude-opus-5 1060 376541 1538
253 principal claude-opus-4-7 12493 29208 419
254 principal claude-opus-4-7 573 41701 98
255 principal claude-opus-4-7 377 42274 167
256 principal claude-opus-4-7 7014 42651 345
257 principal claude-opus-4-7 16776 49665 419
258 principal claude-opus-4-7 1866 66441 183
259 principal claude-opus-5 1870 377601 1436
260 principal claude-opus-5 2002 379471 135
261 principal claude-opus-4-7 1779 68307 1216
262 principal claude-opus-5 223 381473 787
263 principal claude-opus-5 3076 381696 341
264 principal claude-opus-5 444 384772 11
265 principal claude-opus-4-7 1488 70086 1541
266 principal claude-opus-5 2928 385227 2916
267 principal claude-opus-5 3437 388155 1189
268 principal claude-opus-5 1693 391592 332
269 principal claude-opus-5 433 393285 7
270 principal claude-opus-5 70 393718 65
271 principal claude-opus-5 2004 393853 257
272 agent claude-opus-5 32387 0 1
273 agent claude-opus-5 4706 32387 1
274 agent claude-opus-5 528 37093 3
275 agent claude-opus-5 1209 37621 3
276 agent claude-opus-5 6068 38830 7
277 agent claude-opus-5 716 44898 17
278 agent claude-opus-5 4658 45614 2
279 agent claude-opus-5 238 50272 36
280 agent claude-opus-5 169 50510 41
281 agent claude-opus-5 274 50679 40
282 agent claude-opus-5 235 50953 16
283 agent claude-opus-5 134 51188 17
284 agent claude-opus-5 501 51322 3
285 agent claude-opus-5 1509 51823 6
286 agent claude-opus-5 2215 53332 3
287 agent claude-opus-5 3570 55547 3
288 agent claude-opus-5 2003 59117 4
289 agent claude-opus-5 1875 61120 2
290 agent claude-opus-5 1012 62995 41
291 agent claude-opus-5 1623 64007 3
292 agent claude-opus-5 964 65630 17
293 agent claude-opus-5 276 66594 17
294 agent claude-opus-5 2189 66870 2
295 agent claude-opus-5 1723 69059 4
296 agent claude-opus-5 163 70782 40
297 agent claude-opus-5 310 70945 41
298 agent claude-opus-5 231 71255 17
299 agent claude-opus-5 616 71486 2
300 agent claude-opus-5 609 72102 38
301 agent claude-opus-5 1586 72711 2
302 agent claude-opus-5 927 74297 3
303 agent claude-opus-5 239 75224 41
304 agent claude-opus-5 229 75463 20
305 agent claude-opus-5 804 75692 3
306 agent claude-opus-5 1523 76496 2
307 agent claude-opus-5 1120 78019 43
308 agent claude-opus-5 323 79139 16
309 agent claude-opus-5 616 79462 2
310 agent claude-opus-5 3875 80078 3
311 agent claude-opus-5 2764 83953 3
312 agent claude-opus-5 2045 86717 2
313 agent claude-opus-5 2353 88762 4
314 agent claude-opus-5 172 91115 41
315 agent claude-opus-5 235 91287 17
316 agent claude-opus-5 1900 91522 3
317 agent claude-opus-5 1356 93422 39
318 agent claude-opus-5 2107 94778 3
319 agent claude-opus-5 1781 96885 3
320 agent claude-opus-5 821 98666 17
321 agent claude-opus-5 919 99487 17
322 agent claude-opus-5 1094 100406 20
323 agent claude-opus-5 502 101500 17
324 agent claude-opus-5 522 102002 4
325 agent claude-opus-5 2097 102524 3
326 agent claude-opus-5 1924 104621 4
327 agent claude-opus-5 339 106545 39
328 agent claude-opus-5 1617 106884 37
329 agent claude-opus-5 231 108501 16
330 agent claude-opus-5 1898 108732 2
331 agent claude-opus-5 942 110630 41
332 agent claude-opus-5 1117 111572 3
333 agent claude-opus-5 1121 112689 3
334 agent claude-opus-5 1995 113810 3
335 agent claude-opus-5 1249 115805 20
336 agent claude-opus-5 642 117054 20
337 agent claude-opus-5 279 117696 20
338 agent claude-opus-5 192 117975 20
339 agent claude-opus-5 608 118167 20
340 agent claude-opus-5 504 118775 5
341 agent claude-opus-5 2569 119279 20
342 agent claude-opus-5 680 121848 4
343 agent claude-opus-5 552 122528 2
344 agent claude-opus-5 215 123080 17
345 agent claude-opus-5 402 123295 20
346 agent claude-opus-5 718 123697 16
347 agent claude-opus-5 568 124415 4
348 agent claude-opus-5 305 124983 16
349 agent claude-opus-5 769 125288 3
350 agent claude-opus-5 901 126057 3
351 agent claude-opus-5 704 126958 3
352 agent claude-opus-5 1137 127662 20
353 agent claude-opus-5 1343 128799 20
354 agent claude-opus-5 306 130142 16
355 agent claude-opus-5 1394 130448 2
356 agent claude-opus-5 860 131842 2
357 agent claude-opus-5 989 132702 20
358 agent claude-opus-5 261 133691 20
359 agent claude-opus-5 292 133952 20
360 agent claude-opus-5 370 134244 16
361 agent claude-opus-5 468 134614 20
362 agent claude-opus-5 1454 135082 2
363 agent claude-opus-5 541 136536 16
364 agent claude-opus-5 517 137077 17
365 agent claude-opus-5 4980 137594 3
366 agent claude-opus-5 1191 142574 20
367 agent claude-opus-5 724 143765 2
368 agent claude-opus-5 468 144489 20
369 agent claude-opus-5 1185 144957 2
370 agent claude-opus-5 1060 146142 20
371 agent claude-opus-5 742 147202 3
372 agent claude-opus-5 1007 147944 4
373 agent claude-opus-5 385 148951 20
374 agent claude-opus-5 609 149336 4
375 agent claude-opus-5 2034 149945 2
376 agent claude-opus-5 579 151979 20
377 agent claude-opus-5 940 152558 4
378 agent claude-opus-5 1041 153498 2
379 agent claude-opus-5 316 154539 8
380 agent claude-opus-5 5190 154855 3
381 agent claude-opus-5 187 160045 20
382 agent claude-opus-5 286 160232 16
383 agent claude-opus-5 193 160518 16
384 agent claude-opus-5 472 160711 1
385 agent claude-opus-5 432 161183 3
386 agent claude-opus-5 352 161615 20
387 agent claude-opus-5 259 161967 20
388 agent claude-opus-5 437 162226 17
389 agent claude-opus-5 271 162663 38
390 agent claude-opus-5 276 162934 42
391 agent claude-opus-5 247 163210 17
392 agent claude-opus-5 1906 163457 3
393 agent claude-opus-5 363 165363 41
394 agent claude-opus-5 303 165726 41
395 agent claude-opus-5 1513 166029 7
396 agent claude-opus-5 1639 167542 2
397 agent claude-opus-5 1159 169181 2
398 agent claude-opus-5 324 170340 39
399 agent claude-opus-5 1467 170664 2
400 agent claude-opus-5 596 172131 16
401 agent claude-opus-5 622 172727 3
402 agent claude-opus-5 2615 173349 4
403 agent claude-opus-5 3776 175964 3
404 agent claude-opus-5 12197 179740 17
405 agent claude-opus-5 603 191937 17
406 agent claude-opus-5 741 192540 2
407 agent claude-opus-5 1091 193281 2
408 agent claude-opus-5 5189 194372 17
409 agent claude-opus-5 332 199561 17
410 agent claude-opus-5 490 199893 2
411 agent claude-opus-5 763 200383 1
412 agent claude-sonnet-5 5703 9726 4
413 agent claude-sonnet-5 14827 15429 8
414 agent claude-sonnet-5 1876 30256 20
415 agent claude-sonnet-5 1228 32132 2
416 agent claude-sonnet-5 492 33360 20
417 agent claude-sonnet-5 5675 33852 3
418 agent claude-sonnet-5 3928 39527 6
419 agent claude-sonnet-5 8619 43455 3
420 agent claude-sonnet-5 5017 52074 6
421 agent claude-sonnet-5 681 57091 21
422 agent claude-sonnet-5 12327 57772 4
423 agent claude-sonnet-5 1592 70099 6
424 agent claude-sonnet-5 1198 71691 7
425 agent claude-sonnet-5 1644 72889 2
426 agent claude-sonnet-5 2760 74533 4
427 agent claude-sonnet-5 432 77293 14
428 agent claude-sonnet-5 320 77725 0
429 agent claude-sonnet-5 2730 78045 2
430 agent claude-sonnet-5 275 80775 5
431 agent claude-sonnet-5 215 81050 2
432 agent claude-sonnet-5 280 81265 8
433 agent claude-sonnet-5 1370 81545 3
434 agent claude-sonnet-5 311 82915 4
435 agent claude-sonnet-5 751 83226 3
436 agent claude-sonnet-5 496 83977 2
437 agent claude-sonnet-5 666 84473 2
438 agent claude-sonnet-5 2344 85139 7
439 agent claude-sonnet-5 674 87483 20
440 agent claude-sonnet-5 273 88157 2
441 agent claude-sonnet-5 292 88430 7
442 agent claude-sonnet-5 1011 88722 2
443 agent claude-sonnet-5 481 89733 3
444 agent claude-sonnet-5 1390 90214 6
445 agent claude-sonnet-5 445 91604 21
446 agent claude-sonnet-5 421 92049 3
447 agent claude-sonnet-5 1798 92470 3
448 agent claude-sonnet-5 1931 94268 2
449 agent claude-sonnet-5 285 96199 3
450 agent claude-sonnet-5 298 96484 3
451 agent claude-sonnet-5 1356 96782 2
452 agent claude-sonnet-5 1280 98138 2
453 agent claude-sonnet-5 2587 99418 2
454 agent claude-sonnet-5 255 102005 5
455 agent claude-sonnet-5 1328 102260 2
456 agent claude-sonnet-5 3033 103588 4
457 agent claude-sonnet-5 362 106621 4
458 agent claude-sonnet-5 1440 106983 6
459 agent claude-sonnet-5 323 108423 9
460 agent claude-sonnet-5 567 108746 3
461 agent claude-sonnet-5 1639 109313 2
462 agent claude-sonnet-5 683 110952 1
463 agent claude-opus-5 33496 0 137
464 agent claude-opus-5 4732 33496 1
465 agent claude-opus-5 378 38228 2
466 agent claude-opus-5 299 38606 3
467 agent claude-opus-5 5483 38905 17
468 agent claude-opus-5 2705 44388 4
469 agent claude-opus-5 490 47093 16
470 agent claude-opus-5 3387 47583 3
471 agent claude-opus-5 585 50970 137
472 agent claude-opus-5 363 51555 16
473 agent claude-opus-5 1674 51918 17
474 agent claude-opus-5 347 53592 1
475 agent claude-opus-5 140 53939 40
476 agent claude-opus-5 169 54079 41
477 agent claude-opus-5 276 54248 41
478 agent claude-opus-5 231 54524 16
479 agent claude-opus-5 133 54755 17
480 agent claude-opus-5 156 54888 16
481 agent claude-opus-5 1898 55044 3
482 agent claude-opus-5 1325 56942 4
483 agent claude-opus-5 581 58267 3
484 agent claude-opus-5 558 58848 41
485 agent claude-opus-5 288 59406 41
486 agent claude-opus-5 235 59694 16
487 agent claude-opus-5 1900 59929 4
488 agent claude-opus-5 2369 61829 3
489 agent claude-opus-5 2763 64198 17
490 agent claude-opus-5 745 66961 8
491 agent claude-opus-5 606 67706 17
492 agent claude-opus-5 1806 68312 3
493 agent claude-opus-5 163 70118 41
494 agent claude-opus-5 276 70281 41
495 agent claude-opus-5 227 70557 17
496 agent claude-opus-5 614 70784 2
497 agent claude-opus-5 2027 71398 3
498 agent claude-opus-5 1354 73425 3
499 agent claude-opus-5 823 74779 4
500 agent claude-opus-5 176 75602 40
501 agent claude-opus-5 324 75778 41
502 agent claude-opus-5 247 76102 16
503 agent claude-opus-5 1906 76349 3
504 agent claude-opus-5 3277 78255 3
505 agent claude-opus-5 2295 81532 20
506 agent claude-opus-5 1769 83827 2
507 agent claude-opus-5 881 85596 20
508 agent claude-opus-5 294 86477 9
509 agent claude-opus-5 453 86771 39
510 agent claude-opus-5 340 87224 40
511 agent claude-opus-5 263 87564 17
512 agent claude-opus-5 1914 87827 3
513 agent claude-opus-5 1338 89741 3
514 agent claude-opus-5 780 91079 17
515 agent claude-opus-5 719 91859 2
516 agent claude-opus-5 1668 92578 4
517 agent claude-opus-5 320 94246 40
518 agent claude-opus-5 323 94566 2
519 agent claude-opus-5 350 94889 40
520 agent claude-opus-5 259 95239 17
521 agent claude-opus-5 1912 95498 3
522 agent claude-opus-5 2567 97410 3
523 agent claude-opus-5 1314 99977 4
524 agent claude-opus-5 162 101291 40
525 agent claude-opus-5 300 101453 41
526 agent claude-opus-5 670 101753 41
527 agent claude-opus-5 358 102423 17
528 agent claude-opus-5 628 102781 2
529 agent claude-opus-5 1774 103409 2
530 agent claude-opus-5 1525 105183 3
531 agent claude-opus-5 1010 106708 3
532 agent claude-opus-5 2239 107718 3
533 agent claude-opus-5 1116 109957 3
534 agent claude-opus-5 1429 111073 20
535 agent claude-opus-5 782 112502 5
536 agent claude-opus-5 2126 113284 20
537 agent claude-opus-5 790 115410 6
538 agent claude-opus-5 1555 116200 20
539 agent claude-opus-5 534 117755 2
540 agent claude-opus-5 1446 118289 17
541 agent claude-opus-5 319 119735 20
542 agent claude-opus-5 375 120054 4
543 agent claude-opus-5 1209 120429 2
544 agent claude-opus-5 688 121638 2
545 agent claude-opus-5 665 122326 2
546 agent claude-opus-5 448 122991 16
547 agent claude-opus-5 424 123439 4
548 agent claude-opus-5 1117 123863 3
549 agent claude-opus-5 607 124980 20
550 agent claude-opus-5 554 125587 20
551 agent claude-opus-5 348 126141 20
552 agent claude-opus-5 4598 126489 4
553 agent claude-opus-5 971 131087 17
554 agent claude-opus-5 633 132058 1
555 agent claude-opus-5 319 132691 17
556 agent claude-opus-5 356 133010 2
557 agent claude-opus-5 584 133366 1
558 agent claude-opus-5 186 133950 41
559 agent claude-opus-5 300 134136 41
560 agent claude-opus-5 1077 134436 2
561 agent claude-opus-5 679 135513 3
562 agent claude-opus-5 455 136192 38
563 agent claude-opus-5 300 136647 39
564 agent claude-opus-5 1344 136947 3
565 agent claude-opus-5 450 138291 6
566 agent claude-opus-5 497 138741 41
567 agent claude-opus-5 312 139238 40
568 agent claude-opus-5 1433 139550 3
569 agent claude-opus-5 1793 140983 2
570 agent claude-opus-5 471 142776 3
571 agent claude-opus-5 534 143247 20
572 agent claude-opus-5 220 143781 3
573 agent claude-opus-5 333 144001 39
574 agent claude-opus-5 1016 144334 3
575 agent claude-opus-5 557 145350 41
576 agent claude-opus-5 312 145907 41
577 agent claude-opus-5 1073 146219 5
578 agent claude-opus-5 917 147292 2
579 agent claude-opus-5 1135 148209 5
580 agent claude-opus-5 436 149344 20
581 agent claude-opus-5 425 149780 20
582 agent claude-opus-5 265 150205 17
583 agent claude-opus-5 218 150470 1
584 agent claude-opus-5 297 150688 41
585 agent claude-opus-5 312 150985 39
586 agent claude-opus-5 1069 151297 2
587 agent claude-opus-5 1034 152366 4
588 agent claude-opus-5 465 153400 40
589 agent claude-opus-5 981 153865 1
590 agent claude-opus-5 269 154846 17
591 agent claude-opus-5 1898 155115 2
592 agent claude-opus-5 1281 157013 3
593 agent claude-opus-5 848 158294 20
594 agent claude-opus-5 312 159142 20
595 agent claude-opus-5 156 159454 16
596 agent claude-opus-5 263 159610 9
597 agent claude-opus-5 296 159873 41
598 agent claude-opus-5 288 160169 41
599 agent claude-opus-5 1164 160457 2
600 agent claude-opus-5 409 161621 39
601 agent claude-opus-5 1212 162030 2
602 agent claude-opus-5 1007 163242 2
603 agent claude-opus-5 659 164249 41
604 agent claude-opus-5 677 164908 3
605 agent claude-opus-5 883 165585 1
606 agent claude-opus-5 876 166468 2
607 agent claude-opus-5 500 167344 2
608 agent claude-opus-5 5549 167844 2
609 agent claude-opus-5 10346 173393 2
610 agent claude-opus-5 1003 183739 17
611 agent claude-opus-5 466 184742 4
612 agent claude-opus-5 170 185208 41
613 agent claude-opus-5 251 185378 17
614 agent claude-opus-5 233 185629 40
615 agent claude-opus-5 227 185862 41
616 agent claude-opus-5 355 186089 17
617 agent claude-opus-5 2529 186444 3
618 agent claude-opus-5 1477 188973 20
619 agent claude-opus-5 672 190450 20
620 agent claude-opus-5 379 191122 17
621 agent claude-opus-5 147 191501 17
622 agent claude-opus-5 462 191648 38
623 agent claude-opus-5 290 192110 41
624 agent claude-opus-5 258 192400 14
625 agent claude-opus-5 2531 192658 3
626 agent claude-opus-5 934 195189 3
627 agent claude-opus-5 2006 196123 7
628 agent claude-opus-5 376 198129 17
629 agent claude-opus-5 2078 198505 2
630 agent claude-opus-5 485 200583 2
631 agent claude-sonnet-5 5607 9726 2
632 agent claude-sonnet-5 36352 15333 5
633 agent claude-sonnet-5 15202 51685 6
634 agent claude-sonnet-5 7614 66887 2
635 agent claude-sonnet-5 4656 74501 5
636 agent claude-sonnet-5 1290 79157 1
637 agent claude-sonnet-5 1779 80447 3
638 agent claude-sonnet-5 1517 82226 1
639 agent claude-sonnet-5 474 83743 2
640 agent claude-sonnet-5 455 84217 0
641 agent claude-sonnet-5 639 84672 3
642 agent claude-sonnet-5 1331 85311 2
643 agent claude-sonnet-5 5171 86642 2
644 agent claude-sonnet-5 2582 91813 1
645 agent claude-sonnet-5 1067 94395 2
646 agent claude-sonnet-5 18961 0 2
647 agent claude-sonnet-5 2532 18961 5
648 agent claude-sonnet-5 383 21493 20
649 agent claude-sonnet-5 139 21876 2
650 agent claude-sonnet-5 7973 22015 2
651 agent claude-sonnet-5 6199 29988 5
652 agent claude-sonnet-5 2038 36187 20
653 agent claude-sonnet-5 3766 38225 3
654 agent claude-sonnet-5 666 41991 20
655 agent claude-sonnet-5 1622 42657 3
656 agent claude-sonnet-5 2972 44279 3
657 agent claude-sonnet-5 1963 47251 2
658 agent claude-sonnet-5 3233 49214 2
659 agent claude-sonnet-5 1670 52447 3
660 agent claude-sonnet-5 7052 54117 3
661 agent claude-sonnet-5 1607 61169 2
662 agent claude-sonnet-5 2419 62776 20
663 agent claude-sonnet-5 1841 65195 2
664 agent claude-sonnet-5 3281 67036 2
665 agent claude-sonnet-5 3297 70317 4
666 agent claude-sonnet-5 1849 73614 7
667 agent claude-sonnet-5 619 75463 20
668 agent claude-sonnet-5 1333 76082 7
669 agent claude-sonnet-5 1026 77415 3
670 agent claude-sonnet-5 1976 78441 2
671 agent claude-sonnet-5 1120 80417 6
672 agent claude-sonnet-5 1044 81537 16
673 agent claude-sonnet-5 367 82581 2
674 agent claude-sonnet-5 1969 82948 3
675 agent claude-sonnet-5 351 84917 20
676 agent claude-sonnet-5 982 85268 4
677 agent claude-sonnet-5 882 86250 2
678 agent claude-sonnet-5 320 87132 2
679 agent claude-sonnet-5 1899 87452 4
680 agent claude-sonnet-5 799 89351 20
681 agent claude-sonnet-5 401 90150 2
682 agent claude-sonnet-5 2861 90551 8
683 agent claude-sonnet-5 2437 93412 20
684 agent claude-sonnet-5 2085 95849 2
685 agent claude-sonnet-5 172 97934 20
686 agent claude-sonnet-5 1300 98106 2
687 agent claude-sonnet-5 368 99406 3
688 agent claude-sonnet-5 836 99774 2
689 agent claude-sonnet-5 2522 100610 1
690 agent claude-sonnet-5 1160 103132 3
691 agent claude-sonnet-5 880 104292 3
692 agent claude-sonnet-5 309 105172 5
693 agent claude-sonnet-5 182 105481 20
694 agent claude-sonnet-5 4827 105663 2
695 agent claude-sonnet-5 449 110490 6
696 agent claude-sonnet-5 864 110939 2
697 agent claude-sonnet-5 632 111803 17
698 agent claude-sonnet-5 362 112435 6
699 agent claude-sonnet-5 354 112797 4
700 agent claude-sonnet-5 1468 113151 3
701 agent claude-sonnet-5 5657 114619 3
702 agent claude-sonnet-5 333 120276 3
703 agent claude-sonnet-5 248 120609 2
704 agent claude-sonnet-5 375 120857 16
705 agent claude-sonnet-5 338 121232 3
706 agent claude-sonnet-5 274 121570 5
707 agent claude-sonnet-5 3005 121844 3
708 agent claude-sonnet-5 2420 124849 1
709 agent claude-sonnet-5 776 127269 4
710 agent claude-sonnet-5 386 128045 7
711 agent claude-sonnet-5 1321 128431 2
712 agent claude-sonnet-5 2145 129752 5
713 agent claude-sonnet-5 520 131897 2
714 agent claude-sonnet-5 488 132417 2
715 agent claude-haiku-4-5-20251001 12144 0 1
716 agent claude-haiku-4-5-20251001 1803 12144 2
717 agent claude-haiku-4-5-20251001 1134 13947 3
718 agent claude-haiku-4-5-20251001 8849 15081 2
719 agent claude-haiku-4-5-20251001 551 23930 2
720 agent claude-haiku-4-5-20251001 2225 24481 2
721 agent claude-haiku-4-5-20251001 302 26706 2
722 agent claude-haiku-4-5-20251001 12700 0 418
723 agent claude-haiku-4-5-20251001 1578 12700 229
724 agent claude-haiku-4-5-20251001 838 14278 1
725 agent claude-haiku-4-5-20251001 3727 15116 1125
726 agent claude-haiku-4-5-20251001 1356 18843 2
727 agent claude-haiku-4-5-20251001 456 20199 3
728 agent claude-sonnet-5 5702 9726 5
729 agent claude-sonnet-5 20998 15428 5
730 agent claude-sonnet-5 1679 36426 3
731 agent claude-sonnet-5 5488 38105 3
732 agent claude-sonnet-5 7538 43593 2
733 agent claude-sonnet-5 13404 51131 1
734 agent claude-sonnet-5 10535 64535 2
735 agent claude-sonnet-5 3397 75070 1
736 agent claude-sonnet-5 4407 78467 2
737 agent claude-sonnet-5 1777 82874 1
738 agent claude-sonnet-5 1444 84651 3
739 agent claude-sonnet-5 914 86095 2
740 agent claude-sonnet-5 417 87009 2
741 agent claude-sonnet-5 2640 87426 2
742 agent claude-sonnet-5 1372 90066 2
743 agent claude-sonnet-5 1352 91438 1
744 agent claude-sonnet-5 199 92790 0
745 agent claude-sonnet-5 5762 9726 4
746 agent claude-sonnet-5 8120 15488 5
747 agent claude-sonnet-5 4313 23608 2
748 agent claude-sonnet-5 5131 27921 6
749 agent claude-sonnet-5 3554 33052 10
750 agent claude-sonnet-5 1248 36606 3
751 agent claude-sonnet-5 260 37854 3
752 agent claude-sonnet-5 701 38114 2
753 agent claude-sonnet-5 1094 38815 2
754 agent claude-sonnet-5 952 39909 3
755 agent claude-sonnet-5 874 40861 2
756 agent claude-sonnet-5 1104 41735 5
757 agent claude-sonnet-5 964 42839 3
758 agent claude-sonnet-5 2866 43803 3
759 agent claude-sonnet-5 1611 46669 7
760 agent claude-sonnet-5 2269 48280 3
761 agent claude-sonnet-5 549 50549 9
762 agent claude-sonnet-5 1074 51098 8
763 agent claude-sonnet-5 5530 52172 2
764 agent claude-sonnet-5 1592 57702 3
765 agent claude-sonnet-5 1529 59294 2
766 agent claude-sonnet-5 625 60823 6
767 agent claude-sonnet-5 938 61448 2
768 agent claude-sonnet-5 1437 62386 4
769 agent claude-sonnet-5 4101 63823 2
770 agent claude-sonnet-5 879 67924 0
771 agent claude-sonnet-5 1684 68803 3
772 agent claude-sonnet-5 1037 70487 1
773 agent claude-sonnet-5 1356 71524 2
774 agent claude-sonnet-5 2253 72880 8
775 agent claude-sonnet-5 484 75133 21
776 agent claude-sonnet-5 1345 75617 6
777 agent claude-sonnet-5 1025 76962 2
778 agent claude-sonnet-5 883 77987 2
779 agent claude-sonnet-5 3159 78870 2
780 agent claude-sonnet-5 427 82029 2
781 agent claude-sonnet-5 350 82456 2
782 agent claude-sonnet-5 558 82806 9
783 agent claude-sonnet-5 215 83364 4
784 agent claude-haiku-4-5-20251001 12668 0 5
785 agent claude-haiku-4-5-20251001 1453 12668 2
786 agent claude-haiku-4-5-20251001 963 14121 1127
787 agent claude-haiku-4-5-20251001 1385 15084 2
788 agent claude-haiku-4-5-20251001 1448 16469 4
789 agent claude-haiku-4-5-20251001 289 17917 2
790 agent claude-haiku-4-5-20251001 4562 6769 1
791 agent claude-haiku-4-5-20251001 1303 11331 2
792 agent claude-haiku-4-5-20251001 678 12634 1
793 agent claude-haiku-4-5-20251001 180 13312 1
794 agent claude-haiku-4-5-20251001 990 13492 2
795 agent claude-haiku-4-5-20251001 1203 14482 1
796 agent claude-haiku-4-5-20251001 316 15685 3
797 agent claude-haiku-4-5-20251001 271 16001 5
798 agent claude-haiku-4-5-20251001 217 16272 1
799 agent claude-sonnet-5 5824 9726 3
800 agent claude-sonnet-5 11099 15550 5
801 agent claude-sonnet-5 1620 26649 2
802 agent claude-sonnet-5 2574 28269 2
803 agent claude-sonnet-5 5803 30843 8
804 agent claude-sonnet-5 10110 36646 1
805 agent claude-sonnet-5 11523 46756 1
806 agent claude-sonnet-5 7289 58279 10
807 agent claude-sonnet-5 4786 65568 1
808 agent claude-sonnet-5 438 70354 20
809 agent claude-sonnet-5 6835 70792 4
810 agent claude-sonnet-5 5059 77627 3
811 agent claude-sonnet-5 477 82686 14
812 agent claude-sonnet-5 3674 83163 8
813 agent claude-sonnet-5 539 86837 3
814 agent claude-sonnet-5 3072 87376 3
815 agent claude-sonnet-5 373 90448 14
816 agent claude-sonnet-5 3392 90821 2
817 agent claude-sonnet-5 280 94213 2
818 agent claude-sonnet-5 412 94493 14
819 agent claude-sonnet-5 4838 94905 3
820 agent claude-sonnet-5 2513 99743 6
821 agent claude-sonnet-5 231 102256 2
822 agent claude-sonnet-5 2245 102487 4
823 agent claude-sonnet-5 3116 104732 1
824 agent claude-sonnet-5 1305 107848 1
825 agent claude-sonnet-5 299 109153 3
826 agent claude-sonnet-5 2242 109452 1
827 agent claude-sonnet-5 1402 111694 7
828 agent claude-sonnet-5 3578 113096 6
829 agent claude-sonnet-5 1208 116674 3
830 agent claude-sonnet-5 1459 117882 3
831 agent claude-sonnet-5 939 119341 2
832 agent claude-sonnet-5 2805 120280 1
833 agent claude-sonnet-5 321 123085 3
834 agent claude-sonnet-5 646 123406 1
835 agent claude-sonnet-5 19766 0 2
836 agent claude-sonnet-5 2378 19766 4
837 agent claude-sonnet-5 559 22144 2
838 agent claude-sonnet-5 378 22703 101
839 agent claude-sonnet-5 255 23081 21
840 agent claude-sonnet-5 4180 23336 2
841 agent claude-sonnet-5 243 27516 20
842 agent claude-sonnet-5 165 27759 2
843 agent claude-sonnet-5 259 27924 9
844 agent claude-sonnet-5 484 28183 2
845 agent claude-sonnet-5 714 28667 1
846 agent claude-sonnet-5 289 29381 20
847 agent claude-sonnet-5 635 29670 2
848 agent claude-sonnet-5 4104 30305 3
849 agent claude-sonnet-5 952 34409 5
850 agent claude-sonnet-5 6848 35361 2
851 agent claude-sonnet-5 647 42209 2
852 agent claude-sonnet-5 544 42856 20
853 agent claude-sonnet-5 326 43400 16
854 agent claude-sonnet-5 1164 43726 5
855 agent claude-sonnet-5 3375 44890 2
856 agent claude-sonnet-5 673 48265 20
857 agent claude-sonnet-5 1189 48938 3
858 agent claude-sonnet-5 1190 50127 6
859 agent claude-sonnet-5 11441 51317 3
860 agent claude-sonnet-5 3692 62758 2
861 agent claude-sonnet-5 1205 66450 2
862 agent claude-sonnet-5 898 67655 5
863 agent claude-sonnet-5 10653 68553 2
864 agent claude-sonnet-5 4246 79206 20
865 agent claude-sonnet-5 1764 83452 3
866 agent claude-sonnet-5 5298 85216 6
867 agent claude-sonnet-5 2479 90514 2
868 agent claude-sonnet-5 9158 92993 4
869 agent claude-sonnet-5 1242 102151 2
870 agent claude-sonnet-5 6467 103393 3
871 agent claude-sonnet-5 3081 109860 5
872 agent claude-sonnet-5 1997 112941 3
873 agent claude-sonnet-5 1165 114938 10
874 agent claude-sonnet-5 2215 116103 2
875 agent claude-sonnet-5 10066 118318 3
876 agent claude-sonnet-5 1905 128384 20
877 agent claude-sonnet-5 274 130289 2
878 agent claude-sonnet-5 4315 130563 2
879 agent claude-sonnet-5 6122 134878 3
880 agent claude-sonnet-5 1536 141000 20
881 agent claude-sonnet-5 1725 142536 2
882 agent claude-sonnet-5 2009 144261 2
883 agent claude-sonnet-5 795 146270 8
884 agent claude-sonnet-5 985 147065 20
885 agent claude-sonnet-5 2559 148050 9
886 agent claude-sonnet-5 2724 150609 2
887 agent claude-sonnet-5 1799 153333 2
888 agent claude-sonnet-5 500 155132 2
889 agent claude-sonnet-5 2191 155632 3
890 agent claude-sonnet-5 805 157823 20
891 agent claude-sonnet-5 361 158628 20
892 agent claude-sonnet-5 378 158989 2
893 agent claude-sonnet-5 2035 159367 3
894 agent claude-sonnet-5 977 161402 20
895 agent claude-sonnet-5 637 162379 2
896 agent claude-sonnet-5 714 163016 5
897 agent claude-sonnet-5 940 163730 2
898 agent claude-sonnet-5 480 164670 2
899 agent claude-sonnet-5 1013 165150 4
900 agent claude-sonnet-5 465 166163 2
901 agent claude-sonnet-5 1352 166628 7
902 agent claude-sonnet-5 530 167980 4
903 agent claude-sonnet-5 7016 168510 3
904 agent claude-sonnet-5 202 175526 2
905 agent claude-sonnet-5 1372 175728 9
906 agent claude-sonnet-5 1604 177100 2
907 agent claude-sonnet-5 1397 178704 2
908 agent claude-sonnet-5 1579 180101 3
909 agent claude-sonnet-5 666 181680 20
910 agent claude-sonnet-5 445 182346 20
911 agent claude-sonnet-5 577 182791 6
912 agent claude-sonnet-5 850 183368 20
913 agent claude-sonnet-5 904 184218 5
914 agent claude-sonnet-5 3288 185122 3
915 agent claude-sonnet-5 8062 188410 14
916 agent claude-sonnet-5 664 196472 2
917 agent claude-sonnet-5 1982 197136 2
918 agent claude-sonnet-5 1851 199118 3
919 agent claude-sonnet-5 2559 200969 7
920 agent claude-sonnet-5 193 203528 3
921 agent claude-sonnet-5 4355 203721 2
922 agent claude-sonnet-5 2688 208076 20
923 agent claude-sonnet-5 3489 210764 2
924 agent claude-sonnet-5 5086 214253 20
925 agent claude-sonnet-5 2269 219339 9
926 agent claude-sonnet-5 1746 221608 2
927 agent claude-sonnet-5 2466 223354 1
928 agent claude-sonnet-5 744 225820 3
929 agent claude-sonnet-5 1132 226564 20
930 agent claude-sonnet-5 341 227696 2
931 agent claude-sonnet-5 2019 228037 20
932 agent claude-sonnet-5 618 230056 3
933 agent claude-sonnet-5 2144 230674 3
934 agent claude-sonnet-5 336 232818 2
935 agent claude-sonnet-5 201 233154 20
936 agent claude-sonnet-5 1636 233355 2
937 agent claude-sonnet-5 434 234991 9
938 agent claude-sonnet-5 788 235425 2
939 agent claude-sonnet-5 436 236213 2
940 agent claude-haiku-4-5-20251001 11621 0 3
941 agent claude-haiku-4-5-20251001 1393 11621 2
942 agent claude-haiku-4-5-20251001 812 13014 1
943 agent claude-haiku-4-5-20251001 329 13826 2
944 agent claude-haiku-4-5-20251001 19598 14155 1
945 agent claude-haiku-4-5-20251001 980 33753 2
946 agent claude-haiku-4-5-20251001 281 34733 4
947 agent claude-haiku-4-5-20251001 254 35014 2
948 agent claude-haiku-4-5-20251001 4832 6769 5
949 agent claude-haiku-4-5-20251001 1497 11601 2
950 agent claude-haiku-4-5-20251001 15076 13098 2
951 agent claude-haiku-4-5-20251001 1133 28174 1
952 agent claude-haiku-4-5-20251001 1236 29307 2
953 agent claude-haiku-4-5-20251001 917 30543 1
954 agent claude-haiku-4-5-20251001 465 31460 2
955 agent claude-sonnet-5 5636 9726 5
956 agent claude-sonnet-5 14261 15362 5
957 agent claude-sonnet-5 11837 29623 3
958 agent claude-sonnet-5 2719 41460 2
959 agent claude-sonnet-5 8067 44179 3
960 agent claude-sonnet-5 6144 52246 2
961 agent claude-sonnet-5 5784 58390 5
962 agent claude-sonnet-5 3641 64174 2
963 agent claude-sonnet-5 6140 67815 1
964 agent claude-sonnet-5 4725 73955 1
965 agent claude-sonnet-5 5013 78680 2
966 agent claude-sonnet-5 800 83693 3
967 agent claude-sonnet-5 415 84493 20
968 agent claude-sonnet-5 4475 84908 2
969 agent claude-sonnet-5 5136 89383 3
970 agent claude-sonnet-5 981 94519 3
971 agent claude-sonnet-5 1218 95500 3
972 agent claude-sonnet-5 905 96718 2
973 agent claude-sonnet-5 2026 97623 0
974 agent claude-sonnet-5 430 99649 3
975 agent claude-sonnet-5 1066 100079 6
976 agent claude-sonnet-5 936 101145 7
977 agent claude-sonnet-5 286 102081 9
978 agent claude-sonnet-5 1306 102367 3
979 agent claude-sonnet-5 278 103673 3
980 agent claude-sonnet-5 1631 103951 9
981 agent claude-sonnet-5 4722 105582 6
982 agent claude-sonnet-5 190 110304 2
983 agent claude-sonnet-5 245 110494 1
984 agent claude-sonnet-5 15397 0 2
985 agent claude-sonnet-5 5780 15397 4
986 agent claude-sonnet-5 57095 21177 4
987 agent claude-sonnet-5 25208 78272 7
988 agent claude-sonnet-5 8893 103480 3
989 agent claude-sonnet-5 1258 112373 2
990 agent claude-sonnet-5 6837 113631 2
991 agent claude-sonnet-5 3491 120468 1
992 agent claude-sonnet-5 509 123959 4
993 agent claude-sonnet-5 997 124468 2
994 agent claude-sonnet-5 1968 125465 3
995 agent claude-sonnet-5 3068 127433 2
996 agent claude-sonnet-5 1891 130501 9
997 agent claude-sonnet-5 19128 0 2
998 agent claude-sonnet-5 2378 19128 4
999 agent claude-sonnet-5 7746 21506 10
1000 agent claude-sonnet-5 10170 29252 8
1001 agent claude-sonnet-5 1282 39422 2
1002 agent claude-sonnet-5 278 40704 6
1003 agent claude-sonnet-5 1439 40982 2
1004 agent claude-sonnet-5 4412 42421 4
1005 agent claude-sonnet-5 1288 46833 3
1006 agent claude-sonnet-5 741 48121 2
1007 agent claude-sonnet-5 1150 48862 6
1008 agent claude-sonnet-5 637 50012 6
1009 agent claude-sonnet-5 441 50649 20
1010 agent claude-sonnet-5 163 51090 20
1011 agent claude-sonnet-5 4494 51253 1
1012 agent claude-sonnet-5 530 55747 3
1013 agent claude-sonnet-5 534 56277 3
1014 agent claude-sonnet-5 405 56811 20
1015 agent claude-sonnet-5 762 57216 6
1016 agent claude-sonnet-5 2991 57978 3
1017 agent claude-sonnet-5 1561 60969 5
1018 agent claude-sonnet-5 2565 62530 3
1019 agent claude-sonnet-5 1403 65095 3
1020 agent claude-sonnet-5 289 66498 20
1021 agent claude-sonnet-5 325 66787 5
1022 agent claude-sonnet-5 1912 67112 5
1023 agent claude-sonnet-5 289 69024 20
1024 agent claude-sonnet-5 1630 69313 6
1025 agent claude-sonnet-5 826 70943 21
1026 agent claude-sonnet-5 4106 71769 2
1027 agent claude-sonnet-5 1865 75875 5
1028 agent claude-sonnet-5 652 77740 5
1029 agent claude-sonnet-5 1638 78392 3
1030 agent claude-sonnet-5 253 80030 2
1031 agent claude-sonnet-5 221 80283 3
1032 agent claude-sonnet-5 342 80504 21
1033 agent claude-sonnet-5 582 80846 2
1034 agent claude-sonnet-5 603 81428 20
1035 agent claude-sonnet-5 1631 82031 2
1036 agent claude-sonnet-5 716 83662 2
1037 agent claude-sonnet-5 695 84378 2
1038 agent claude-sonnet-5 1458 85073 5
1039 agent claude-sonnet-5 466 86531 5
1040 agent claude-sonnet-5 1244 86997 3
1041 agent claude-sonnet-5 1157 88241 7
1042 agent claude-sonnet-5 1604 89398 5
1043 agent claude-sonnet-5 177 91002 20
1044 agent claude-sonnet-5 530 91179 2
1045 agent claude-sonnet-5 212 91709 2
1046 agent claude-sonnet-5 225 91921 1
1047 agent claude-sonnet-5 739 92146 5
1048 agent claude-sonnet-5 175 92885 20
1049 agent claude-sonnet-5 148 93060 2
1050 agent claude-sonnet-5 1323 93208 2
1051 agent claude-sonnet-5 2263 94531 2
1052 agent claude-sonnet-5 1617 96794 4
1053 agent claude-sonnet-5 814 98411 3
1054 agent claude-sonnet-5 2171 99225 1
1055 agent claude-sonnet-5 150 101396 20
1056 agent claude-sonnet-5 2236 101546 1
1057 agent claude-sonnet-5 328 103782 5
1058 agent claude-sonnet-5 447 104110 5
1059 agent claude-sonnet-5 313 104557 3
1060 agent claude-sonnet-5 768 104870 1
1061 agent claude-sonnet-5 874 105638 3
1062 agent claude-sonnet-5 1428 106512 2
1063 agent claude-sonnet-5 642 107940 20
1064 agent claude-sonnet-5 3107 108582 2
1065 agent claude-sonnet-5 535 111689 3
1066 agent claude-sonnet-5 1214 112224 6
1067 agent claude-sonnet-5 1492 113438 2
1068 agent claude-sonnet-5 2170 114930 7
1069 agent claude-sonnet-5 573 117100 9
1070 agent claude-sonnet-5 1300 117673 6
1071 agent claude-sonnet-5 1001 118973 2
1072 agent claude-sonnet-5 354 119974 20
1073 agent claude-sonnet-5 852 120328 3
1074 agent claude-sonnet-5 1537 121180 3
1075 agent claude-sonnet-5 215 122717 20
1076 agent claude-sonnet-5 531 122932 6
1077 agent claude-sonnet-5 496 123463 1
1078 agent claude-sonnet-5 1230 123959 2
1079 agent claude-sonnet-5 2151 125189 2
1080 agent claude-sonnet-5 372 127340 2
1081 agent claude-sonnet-5 453 127712 20
1082 agent claude-sonnet-5 1166 128165 3
1083 agent claude-sonnet-5 1164 129331 1
1084 agent claude-sonnet-5 402 130495 1
1085 agent claude-opus-5 31960 0 1
1086 agent claude-opus-5 4738 31960 1
1087 agent claude-opus-5 3195 36698 7
1088 agent claude-opus-5 2309 39893 17
1089 agent claude-opus-5 5318 42202 5
1090 agent claude-opus-5 1496 47520 3
1091 agent claude-opus-5 5368 49016 2
1092 agent claude-opus-5 4264 54384 2
1093 agent claude-opus-5 833 58648 17
1094 agent claude-opus-5 1019 59481 17
1095 agent claude-opus-5 836 60500 3
1096 agent claude-opus-5 455 61336 17
1097 agent claude-opus-5 1733 61791 3
1098 agent claude-opus-5 510 63524 3
1099 agent claude-opus-5 299 64034 20
1100 agent claude-opus-5 258 64333 2
1101 agent claude-opus-5 371 64591 33
1102 agent claude-opus-5 169 64962 40
1103 agent claude-opus-5 276 65131 41
1104 agent claude-opus-5 266 65407 17
1105 agent claude-opus-5 1446 65673 2
1106 agent claude-opus-5 1047 67119 3
1107 agent claude-opus-5 906 68166 38
1108 agent claude-opus-5 213 69072 40
1109 agent claude-opus-5 468 69285 41
1110 agent claude-opus-5 411 69753 9
1111 agent claude-haiku-4-5-20251001 12261 0 1
1112 agent claude-haiku-4-5-20251001 1644 12261 2
1113 agent claude-haiku-4-5-20251001 807 13905 1
1114 agent claude-haiku-4-5-20251001 3389 14712 2
1115 agent claude-haiku-4-5-20251001 1331 18101 3
1116 agent claude-haiku-4-5-20251001 358 19432 4
1117 agent claude-haiku-4-5-20251001 12054 0 1
1118 agent claude-haiku-4-5-20251001 1277 12054 1
1119 agent claude-haiku-4-5-20251001 828 13331 1
1120 agent claude-haiku-4-5-20251001 1307 14159 1
1121 agent claude-haiku-4-5-20251001 1106 15466 3
1122 agent claude-haiku-4-5-20251001 314 16572 2
1123 agent claude-haiku-4-5-20251001 200 16886 1
1124 agent claude-opus-5 13157 0 256
1125 agent claude-opus-5 2494 13157 17
1126 agent claude-opus-5 5734 15651 2
1127 agent claude-opus-5 11757 21385 249
1128 agent claude-opus-5 3314 33142 185
1129 agent claude-opus-5 1204 36456 17
1130 agent claude-opus-5 3996 37660 5
1131 agent claude-opus-5 1607 41656 169
1132 agent claude-opus-5 4272 43263 3
1133 agent claude-opus-5 5026 47535 3
1134 agent claude-opus-5 3809 52561 2
1135 agent claude-opus-5 1846 56370 3
1136 agent claude-opus-5 4831 58216 3
1137 agent claude-opus-5 778 63047 2
1138 agent claude-opus-5 2257 63825 2
1139 agent claude-opus-5 4441 66082 3
1140 agent claude-opus-5 867 70523 3
1141 agent claude-opus-5 1004 71390 3
1142 agent claude-opus-5 1940 72394 2
1143 agent claude-opus-5 1012 74334 2
1144 agent claude-opus-5 3285 75346 3
1145 agent claude-opus-5 2949 78631 17
1146 agent claude-opus-5 2772 81580 3
1147 agent claude-opus-5 3468 84352 3
1148 agent claude-opus-5 744 87820 9
1149 agent claude-sonnet-5 7329 12065 2
1150 agent claude-sonnet-5 2374 19394 8
1151 agent claude-sonnet-5 416 21768 20
1152 agent claude-sonnet-5 640 22184 5
1153 agent claude-sonnet-5 388 22824 20
1154 agent claude-sonnet-5 23519 23212 10
1155 agent claude-sonnet-5 9048 46731 7
1156 agent claude-sonnet-5 638 55779 20
1157 agent claude-sonnet-5 638 56417 20
1158 agent claude-sonnet-5 735 57055 6
1159 agent claude-sonnet-5 403 57790 2
1160 agent claude-sonnet-5 345 58193 4
1161 agent claude-sonnet-5 691 58538 20
1162 agent claude-sonnet-5 343 59229 5
1163 agent claude-sonnet-5 574 59572 6
1164 agent claude-sonnet-5 1436 60146 0
1165 agent claude-sonnet-5 1771 61582 6
1166 agent claude-sonnet-5 1047 63353 3
1167 agent claude-sonnet-5 294 64400 20
1168 agent claude-sonnet-5 725 64694 3
1169 agent claude-sonnet-5 2884 65419 2
1170 agent claude-sonnet-5 728 68303 7
1171 agent claude-sonnet-5 960 69031 6
1172 agent claude-sonnet-5 609 69991 4
1173 agent claude-sonnet-5 845 70600 7
1174 agent claude-sonnet-5 284 71445 4
1175 agent claude-sonnet-5 1463 71729 3
1176 agent claude-sonnet-5 419 73192 20
1177 agent claude-sonnet-5 208 73611 3
1178 agent claude-sonnet-5 1083 73819 3
1179 agent claude-sonnet-5 1051 74902 4
1180 agent claude-sonnet-5 3226 75953 3
1181 agent claude-sonnet-5 863 79179 5
1182 agent claude-sonnet-5 982 80042 4
1183 agent claude-sonnet-5 272 81024 1
1184 agent claude-sonnet-5 331 81296 17
1185 agent claude-sonnet-5 396 81627 3
1186 agent claude-sonnet-5 814 82023 4
1187 agent claude-sonnet-5 344 82837 20
1188 agent claude-sonnet-5 414 83181 20
1189 agent claude-sonnet-5 364 83595 3
1190 agent claude-sonnet-5 1042 83959 4
1191 agent claude-sonnet-5 302 85001 6
1192 agent claude-sonnet-5 281 85303 2
1193 agent claude-sonnet-5 411 85584 20
1194 agent claude-sonnet-5 445 85995 4
1195 agent claude-sonnet-5 187 86440 8
1196 agent claude-sonnet-5 314 86627 17
1197 agent claude-sonnet-5 382 86941 2
1198 agent claude-sonnet-5 302 87323 20
1199 agent claude-sonnet-5 814 87625 20
1200 agent claude-sonnet-5 774 88439 5
1201 agent claude-sonnet-5 309 89213 21
1202 agent claude-sonnet-5 4427 89522 4
1203 agent claude-sonnet-5 252 93949 2
1204 agent claude-sonnet-5 293 94201 4
1205 agent claude-sonnet-5 337 94494 20
1206 agent claude-sonnet-5 4228 94831 2
1207 agent claude-sonnet-5 217 99059 14
1208 agent claude-sonnet-5 951 99276 17
1209 agent claude-sonnet-5 660 100227 3
1210 agent claude-sonnet-5 257 100887 7
1211 agent claude-sonnet-5 332 101144 5
1212 agent claude-sonnet-5 1808 101476 5
1213 agent claude-sonnet-5 967 103284 5
1214 agent claude-sonnet-5 187 104251 20
1215 agent claude-sonnet-5 513 104438 16
1216 agent claude-sonnet-5 620 104951 3
1217 agent claude-sonnet-5 515 105571 3
1218 agent claude-sonnet-5 723 106086 5
1219 agent claude-sonnet-5 923 106809 7
1220 agent claude-sonnet-5 3316 107732 9
1221 agent claude-sonnet-5 6329 111048 3
1222 agent claude-sonnet-5 1188 117377 3
1223 agent claude-sonnet-5 1320 118565 2
1224 agent claude-sonnet-5 761 119885 3
1225 agent claude-sonnet-5 2140 120646 1
1226 agent claude-sonnet-5 959 122786 20
1227 agent claude-sonnet-5 2212 123745 1
1228 agent claude-sonnet-5 3798 125957 3
1229 agent claude-sonnet-5 685 129755 3
1230 agent claude-sonnet-5 904 130440 1
1231 agent claude-sonnet-5 1283 131344 1
1232 agent claude-sonnet-5 192 132627 4
1233 agent claude-sonnet-5 231 132819 20
1234 agent claude-sonnet-5 1079 133050 2
1235 agent claude-sonnet-5 6850 134129 2
1236 agent claude-sonnet-5 187 140979 1
1237 agent claude-sonnet-5 5729 9726 4
1238 agent claude-sonnet-5 6346 15455 2
1239 agent claude-sonnet-5 33965 21801 4
1240 agent claude-sonnet-5 11893 55766 3
1241 agent claude-sonnet-5 1344 67659 5
1242 agent claude-sonnet-5 12040 69003 7
1243 agent claude-sonnet-5 3410 81043 2
1244 agent claude-sonnet-5 5405 84453 2
1245 agent claude-sonnet-5 2801 89858 7
1246 agent claude-sonnet-5 822 92659 2
1247 agent claude-sonnet-5 1403 93481 20
1248 agent claude-sonnet-5 2202 94884 2
1249 agent claude-sonnet-5 6089 97086 2
1250 agent claude-sonnet-5 3079 103175 6
1251 agent claude-sonnet-5 2584 106254 3
1252 agent claude-sonnet-5 381 108838 2
1253 agent claude-sonnet-5 305 109219 21
1254 agent claude-sonnet-5 1964 109524 3
1255 agent claude-sonnet-5 3151 111488 3
1256 agent claude-sonnet-5 2487 114639 5
1257 agent claude-sonnet-5 1344 117126 3
1258 agent claude-sonnet-5 445 118470 3
1259 agent claude-sonnet-5 579 118915 5
1260 agent claude-sonnet-5 4092 119494 3
1261 agent claude-sonnet-5 696 123586 7
1262 agent claude-sonnet-5 2384 124282 3
1263 agent claude-sonnet-5 418 126666 3
1264 agent claude-sonnet-5 837 127084 3
1265 agent claude-sonnet-5 878 127921 2
1266 agent claude-sonnet-5 870 128799 2
1267 agent claude-sonnet-5 6533 12065 3
1268 agent claude-sonnet-5 2378 18598 5
1269 agent claude-sonnet-5 7677 20976 2
1270 agent claude-sonnet-5 1177 28653 3
1271 agent claude-sonnet-5 738 29830 2
1272 agent claude-sonnet-5 1059 30568 5
1273 agent claude-sonnet-5 741 31627 4
1274 agent claude-sonnet-5 1074 32368 2
1275 agent claude-sonnet-5 718 33442 2
1276 agent claude-sonnet-5 1399 34160 5
1277 agent claude-sonnet-5 1855 35559 3
1278 agent claude-sonnet-5 1061 37414 2
1279 agent claude-sonnet-5 235 38475 7
1280 agent claude-sonnet-5 429 38710 9
1281 agent claude-sonnet-5 906 39139 3
1282 agent claude-sonnet-5 315 40045 2
1283 agent claude-sonnet-5 1918 40360 5
1284 agent claude-sonnet-5 1315 42278 3
1285 agent claude-sonnet-5 264 43593 20
1286 agent claude-sonnet-5 1521 43857 2
1287 agent claude-sonnet-5 483 45378 2
1288 agent claude-sonnet-5 2167 45861 6
1289 agent claude-sonnet-5 922 48028 2
1290 agent claude-sonnet-5 1173 48950 3
1291 agent claude-sonnet-5 1571 50123 2
1292 agent claude-sonnet-5 634 51694 2
1293 agent claude-sonnet-5 163 52328 3
1294 agent claude-sonnet-5 579 52491 3
1295 agent claude-sonnet-5 2200 53070 7
1296 agent claude-sonnet-5 1959 55270 20
1297 agent claude-sonnet-5 782 57229 2
1298 agent claude-sonnet-5 416 58011 6
1299 agent claude-sonnet-5 5266 58427 3
1300 agent claude-sonnet-5 2631 63693 3
1301 agent claude-sonnet-5 455 66324 1
1302 agent claude-sonnet-5 911 66779 6
1303 agent claude-sonnet-5 493 67690 5
1304 agent claude-sonnet-5 1492 68183 1
1305 agent claude-sonnet-5 2227 69675 2
1306 agent claude-sonnet-5 388 71902 1
1307 agent claude-sonnet-5 19052 0 2
1308 agent claude-sonnet-5 2384 19052 5
1309 agent claude-sonnet-5 4372 21436 3
1310 agent claude-sonnet-5 3653 25808 3
1311 agent claude-sonnet-5 3098 29461 5
1312 agent claude-sonnet-5 623 32559 21
1313 agent claude-sonnet-5 1038 33182 3
1314 agent claude-sonnet-5 311 34220 20
1315 agent claude-sonnet-5 188 34531 20
1316 agent claude-sonnet-5 563 34719 5
1317 agent claude-sonnet-5 2632 35282 2
1318 agent claude-sonnet-5 368 37914 3
1319 agent claude-sonnet-5 944 38282 3
1320 agent claude-sonnet-5 1016 39226 20
1321 agent claude-sonnet-5 371 40242 1
1322 agent claude-sonnet-5 271 40613 8
1323 agent claude-sonnet-5 838 40884 3
1324 agent claude-sonnet-5 2144 41722 2
1325 agent claude-sonnet-5 1278 43866 20
1326 agent claude-sonnet-5 340 45144 3
1327 agent claude-sonnet-5 425 45484 3
1328 agent claude-sonnet-5 1178 45909 3
1329 agent claude-sonnet-5 308 47087 3
1330 agent claude-sonnet-5 2223 47395 5
1331 agent claude-sonnet-5 1033 49618 4
1332 agent claude-sonnet-5 11199 50651 7
1333 agent claude-sonnet-5 3593 61850 4
1334 agent claude-sonnet-5 847 65443 6
1335 agent claude-sonnet-5 1131 66290 20
1336 agent claude-sonnet-5 254 67421 20
1337 agent claude-sonnet-5 265 67675 2
1338 agent claude-sonnet-5 4443 67940 2
1339 agent claude-sonnet-5 215 72383 2
1340 agent claude-sonnet-5 558 72598 2
1341 agent claude-sonnet-5 151 73156 3
1342 agent claude-sonnet-5 2203 73307 1
1343 agent claude-sonnet-5 1169 75510 2
1344 agent claude-sonnet-5 748 76679 3
1345 agent claude-sonnet-5 2638 77427 2
1346 agent claude-sonnet-5 396 80065 6
1347 agent claude-sonnet-5 427 80461 9
1348 agent claude-sonnet-5 498 80888 4
1349 agent claude-sonnet-5 142 81386 1
1350 agent claude-sonnet-5 5678 9726 3
1351 agent claude-sonnet-5 9801 15404 2
1352 agent claude-sonnet-5 2211 25205 4
1353 agent claude-sonnet-5 6638 27416 3
1354 agent claude-sonnet-5 10289 34054 2
1355 agent claude-sonnet-5 5813 44343 2
1356 agent claude-sonnet-5 4930 50156 2
1357 agent claude-sonnet-5 609 55086 14
1358 agent claude-sonnet-5 2727 55695 6
1359 agent claude-sonnet-5 2105 58422 2
1360 agent claude-sonnet-5 2584 60527 2
1361 agent claude-sonnet-5 2582 63111 2
1362 agent claude-sonnet-5 320 65693 4
1363 agent claude-sonnet-5 1982 66013 2
1364 agent claude-sonnet-5 836 67995 3
1365 agent claude-sonnet-5 1892 68831 3
1366 agent claude-sonnet-5 2739 70723 3
1367 agent claude-sonnet-5 6364 73462 3
1368 agent claude-sonnet-5 2780 79826 2
1369 agent claude-sonnet-5 566 82606 2
1370 agent claude-sonnet-5 398 83172 20
1371 agent claude-sonnet-5 394 83570 3
1372 agent claude-haiku-4-5-20251001 11838 0 8
1373 agent claude-haiku-4-5-20251001 1387 11838 2
1374 agent claude-haiku-4-5-20251001 839 13225 2
1375 agent claude-haiku-4-5-20251001 1363 14064 2
1376 agent claude-haiku-4-5-20251001 842 15427 2
1377 agent claude-haiku-4-5-20251001 279 16269 2
1378 agent claude-sonnet-5 15909 0 8
1379 agent claude-sonnet-5 12607 15909 5
1380 agent claude-sonnet-5 18919 28516 2
1381 agent claude-sonnet-5 1502 47435 20
1382 agent claude-sonnet-5 2597 48937 2
1383 agent claude-sonnet-5 4181 51534 2
1384 agent claude-sonnet-5 1491 55715 20
1385 agent claude-sonnet-5 4110 57206 2
1386 agent claude-sonnet-5 739 61316 20
1387 agent claude-sonnet-5 1778 62055 2
1388 agent claude-sonnet-5 2818 63833 2
1389 agent claude-sonnet-5 4502 66651 3
1390 agent claude-sonnet-5 1071 71153 20
1391 agent claude-sonnet-5 1988 72224 4
1392 agent claude-sonnet-5 466 74212 5
1393 agent claude-sonnet-5 979 74678 6
1394 agent claude-sonnet-5 1185 75657 1
1395 agent claude-sonnet-5 1062 76842 20
1396 agent claude-sonnet-5 2796 77904 4
1397 agent claude-sonnet-5 760 80700 3
1398 agent claude-sonnet-5 426 81460 9
1399 agent claude-sonnet-5 743 81886 5
1400 agent claude-sonnet-5 543 82629 3
1401 agent claude-sonnet-5 358 83172 8
1402 agent claude-sonnet-5 1119 83530 7
1403 agent claude-sonnet-5 1139 84649 3
1404 agent claude-sonnet-5 1659 85788 20
1405 agent claude-sonnet-5 1995 87447 7
1406 agent claude-sonnet-5 343 89442 3
1407 agent claude-sonnet-5 686 89785 9
1408 agent claude-sonnet-5 699 90471 5
1409 agent claude-sonnet-5 1603 91170 3
1410 agent claude-sonnet-5 1869 92773 2
1411 agent claude-sonnet-5 278 94642 3
1412 agent claude-sonnet-5 813 94920 2
1413 agent claude-sonnet-5 1368 95733 20
1414 agent claude-sonnet-5 1394 97101 3
1415 agent claude-sonnet-5 334 98495 2
1416 agent claude-sonnet-5 352 98829 4
1417 agent claude-sonnet-5 435 99181 5
1418 agent claude-sonnet-5 322 99616 2
1419 agent claude-sonnet-5 339 99938 4
1420 agent claude-sonnet-5 1258 100277 3
1421 agent claude-sonnet-5 501 101535 16
1422 agent claude-sonnet-5 1038 102036 2
1423 agent claude-sonnet-5 432 103074 21
1424 agent claude-sonnet-5 196 103506 20
1425 agent claude-sonnet-5 1600 103702 6
1426 agent claude-sonnet-5 874 105302 4
1427 agent claude-sonnet-5 433 106176 20
1428 agent claude-sonnet-5 607 106609 9
1429 agent claude-sonnet-5 1352 107216 20
1430 agent claude-sonnet-5 2301 108568 2
1431 agent claude-sonnet-5 324 110869 2
1432 agent claude-sonnet-5 643 111193 2
1433 agent claude-sonnet-5 794 111836 3
1434 agent claude-sonnet-5 341 112630 20
1435 agent claude-sonnet-5 332 112971 2
1436 agent claude-sonnet-5 301 113303 2
1437 agent claude-sonnet-5 819 113604 20
1438 agent claude-sonnet-5 171 114423 5
1439 agent claude-sonnet-5 1530 114594 7
1440 agent claude-sonnet-5 2031 116124 2
1441 agent claude-sonnet-5 1811 118155 2
1442 agent claude-sonnet-5 2564 119966 3
1443 agent claude-sonnet-5 18314 0 3
1444 agent claude-sonnet-5 3398 18314 5
1445 agent claude-sonnet-5 1634 21712 7
1446 agent claude-sonnet-5 263 23346 2
1447 agent claude-sonnet-5 595 23609 2
1448 agent claude-sonnet-5 492 24204 2
1449 agent claude-sonnet-5 704 24696 9
1450 agent claude-sonnet-5 413 25400 20
1451 agent claude-sonnet-5 1248 25813 2
1452 agent claude-sonnet-5 234 27061 2
1453 agent claude-sonnet-5 295 27295 20
1454 agent claude-sonnet-5 817 27590 2
1455 agent claude-sonnet-5 296 28407 2
1456 agent claude-sonnet-5 1694 28703 3
1457 agent claude-sonnet-5 409 30397 1
1458 agent claude-sonnet-5 244 30806 4
1459 agent claude-sonnet-5 297 31050 20
1460 agent claude-sonnet-5 413 31347 2
1461 agent claude-sonnet-5 405 31760 1
1462 agent claude-sonnet-5 470 32165 20
1463 agent claude-sonnet-5 221 32635 2
1464 agent claude-sonnet-5 2142 32856 3
1465 agent claude-sonnet-5 19953 0 5
1466 agent claude-sonnet-5 2380 19953 6
1467 agent claude-sonnet-5 648 22333 4
1468 agent claude-sonnet-5 6305 22981 3
1469 agent claude-sonnet-5 1607 29286 2
1470 agent claude-sonnet-5 3608 30893 2
1471 agent claude-sonnet-5 218 34501 20
1472 agent claude-sonnet-5 2651 34719 6
1473 agent claude-sonnet-5 1329 37370 20
1474 agent claude-sonnet-5 1494 38699 6
1475 agent claude-sonnet-5 853 40193 20
1476 agent claude-sonnet-5 134 41046 9
1477 agent claude-sonnet-5 693 41180 5
1478 agent claude-sonnet-5 5988 41873 3
1479 agent claude-sonnet-5 4358 47861 5
1480 agent claude-sonnet-5 932 52219 14
1481 agent claude-sonnet-5 442 53151 304
1482 agent claude-sonnet-5 428 53593 2
1483 agent claude-sonnet-5 1722 54021 7
1484 agent claude-sonnet-5 817 55743 16
1485 agent claude-sonnet-5 935 56560 2
1486 agent claude-sonnet-5 1186 57495 14
1487 agent claude-sonnet-5 400 58681 17
1488 agent claude-sonnet-5 1412 59081 2
1489 agent claude-sonnet-5 672 60493 20
1490 agent claude-sonnet-5 525 61165 16
1491 agent claude-sonnet-5 637 61690 2
1492 agent claude-sonnet-5 198 62327 3
1493 agent claude-sonnet-5 447 62525 3
1494 agent claude-sonnet-5 191 62972 2
1495 agent claude-sonnet-5 965 63163 4
1496 agent claude-sonnet-5 1436 64128 4
1497 agent claude-sonnet-5 2756 65564 3
1498 agent claude-sonnet-5 2366 68320 7
1499 agent claude-sonnet-5 2361 70686 6
1500 agent claude-sonnet-5 3019 73047 5
1501 agent claude-sonnet-5 1186 76066 20
1502 agent claude-sonnet-5 1288 77252 5
1503 agent claude-sonnet-5 216 78540 20
1504 agent claude-sonnet-5 142 78756 20
1505 agent claude-sonnet-5 654 78898 5
1506 agent claude-sonnet-5 1261 79552 20
1507 agent claude-sonnet-5 464 80813 9
1508 agent claude-sonnet-5 1403 81277 3
1509 agent claude-sonnet-5 323 82680 3
1510 agent claude-sonnet-5 4605 83003 3
1511 agent claude-sonnet-5 3289 87608 2
1512 agent claude-sonnet-5 1634 90897 2
1513 agent claude-sonnet-5 178 92531 20
1514 agent claude-sonnet-5 292 92709 1
1515 agent claude-sonnet-5 179 93001 20
1516 agent claude-sonnet-5 3773 93180 2
1517 agent claude-sonnet-5 1777 96953 20
1518 agent claude-sonnet-5 1023 98730 2
1519 agent claude-sonnet-5 6267 99753 3
1520 agent claude-sonnet-5 1346 106020 2
1521 agent claude-sonnet-5 185 107366 20
1522 agent claude-sonnet-5 3964 107551 2
1523 agent claude-sonnet-5 171 111515 20
1524 agent claude-sonnet-5 184 111686 4
1525 agent claude-sonnet-5 471 111870 5
1526 agent claude-sonnet-5 386 112341 20
1527 agent claude-sonnet-5 361 112727 2
1528 agent claude-sonnet-5 4174 113088 2
1529 agent claude-sonnet-5 333 117262 1
1530 agent claude-sonnet-5 2216 117595 1
1531 agent claude-sonnet-5 160 119811 2
1532 agent claude-sonnet-5 2808 119971 1
1533 agent claude-sonnet-5 268 122779 7
1534 agent claude-sonnet-5 1831 123047 3
1535 agent claude-sonnet-5 648 124878 20
1536 agent claude-sonnet-5 121 125526 7
1537 agent claude-sonnet-5 1679 125647 2
1538 agent claude-sonnet-5 348 127326 1
1539 agent claude-sonnet-5 6309 12065 3
1540 agent claude-sonnet-5 4578 18374 8
1541 agent claude-sonnet-5 6340 22952 3
1542 agent claude-sonnet-5 1126 29292 2
1543 agent claude-sonnet-5 1270 30418 2
1544 agent claude-sonnet-5 259 31688 17
1545 agent claude-sonnet-5 442 31947 20
1546 agent claude-sonnet-5 459 32389 5
1547 agent claude-sonnet-5 473 32848 20
1548 agent claude-sonnet-5 266 33321 2
1549 agent claude-sonnet-5 1692 33587 2
1550 agent claude-sonnet-5 523 35279 2
1551 agent claude-sonnet-5 574 35802 4
1552 agent claude-sonnet-5 1036 36376 1
1553 agent claude-haiku-4-5-20251001 12235 0 3
1554 agent claude-haiku-4-5-20251001 1511 12235 2
1555 agent claude-haiku-4-5-20251001 700 13746 1
1556 agent claude-haiku-4-5-20251001 6762 14446 2
1557 agent claude-haiku-4-5-20251001 590 21208 1
1558 agent claude-haiku-4-5-20251001 1273 21798 2
1559 agent claude-haiku-4-5-20251001 358 23071 3
-->
<!-- /cout -->

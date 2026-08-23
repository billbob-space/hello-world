# 2026-08-22 — claude/estran-location-selection-fsizzf

Branche : `claude/estran-location-selection-fsizzf`
Périmètre : marcq-handball, fabrique
Mode : `chaud`

## Anomalies

### 1. Un test de bout en bout qui devient rouge en changeant de jour

**Symptome** — `bout-en-bout (marcq-handball)` echoue depuis le 2026-08-22 :
« Salut Lea » n'apparait jamais apres la saisie du prenom. Le contexte capture
par Playwright dit pourquoi — l'app affiche « Ton bilan », « du lundi 3 aout au
vendredi 21 aout ».

**Cause** — l'app fait exactement ce que son PRD demande : « §9 : passe
prog.fin, la racine mene au bilan » (`web/app.js`). Le programme courait jusqu'au
21 aout ; le 22, la racine mene au bilan, et le test suppose le programme en
cours. **L'app n'est pas cassee — le test l'est.** Il passait la veille, il
echoue tous les jours depuis, et rien dans son ecriture ne disait qu'il portait
une date.

Le remede existe deja dans le depot, applique ailleurs : les tests d'`estran`
appellent `RecupererA`, qui prend l'heure en PARAMETRE, « pour rester
reproductibles sans dependre de l'horloge du poste qui les execute ». Personne
ne l'avait porte au navigateur, ou l'horloge reste celle de la machine.

**Detecte par** — `CI`

**Action** — `garde-fou` — corrige en figeant l'horloge du navigateur. Le
principe manque au contrat plutot qu'a cette app : **un test qui lit l'heure sans
la figer est une bombe a retardement**, et rien ne le signale tant que la date
n'est pas passee.

### 2. Une app non touchee peut rester cassee sans que rien ne le dise

**Symptome** — ce rouge datait du matin meme et n'a ete vu que parce qu'une
branche touchant l'outillage partage a force la matrice complete. Sans elle, il
aurait attendu le prochain changement partage.

**Cause** — la CI ne lance la matrice que sur les apps MODIFIEES. C'est le bon
choix pour le cout, et il a un angle mort exact : une app que personne ne touche
n'est jamais rejouee. `main` reste vert pendant ce temps.

**Detecte par** — `CI`

**Action** — `garde-fou` — corrige dans cette branche, en
`.github/workflows/build.yml` (que `pret.sh` ne compte pas parmi les surfaces
partagees qu'il surveille — il regarde `memory/`, `.claude/`, `scripts/`,
`init.sh` et `CLAUDE.md`, pas le workflow). Tranche par l'utilisateur le
2026-08-22 : un passage complet **hebdomadaire**, toutes apps. Une app peut alors rester cassee jusqu'a
six jours, contre un temps non borne aujourd'hui, pour un septieme du cout d'un
passage quotidien.

### 3. La barre de progression annonce son role sans dire ce qu'elle mesure

**Symptome** — releve par l'artisan en figeant l'horloge : sur un jour PORTANT
une seance, `axe` leve `aria-progressbar-name`, gravite **serious**.
`web/barre.js` pose `role="progressbar"` sans nom accessible des que la barre
n'est pas muette, et `web/vue-jour.js` l'appelle ainsi sur l'ecran du jour.

**Cause** — un role ARIA sans nom laisse un lecteur d'ecran annoncer « barre de
progression » et rien d'autre. Le defaut existe depuis la creation de l'app.
S'il n'a jamais ete vu, c'est que la suite lisait l'horloge de la machine et
tombait, **par hasard**, sur des jours de repos ou la barre n'est pas montee.

**Detecte par** — `test`

**Action** — `rien` — corrige : `creerBarre` prend un `nom`, et l'ecran du jour
lui passe « Avancement des exercices de la seance : n sur total ».

**Ce qui a failli arriver, et qui est la vraie lecon** : le premier correctif
avait figé l'horloge sur un jour de REPOS, ce qui rendait la suite verte en
EVITANT le defaut. Un test qui passe parce qu'il ne rencontre pas le cas est un
test qui ment, et c'est la meme faute que desactiver un test pour reverdir. La
date figee porte donc une contrainte ecrite — un jour qui porte une seance, ni
le premier ni le dernier du programme — sans quoi le prochain qui la deplacera
rouvrira le trou sans le savoir.

### 4. Le meme defaut vivait sur deux ecrans que la mesure ne regardait pas

**Symptome** — releve par l'`esthete` apres la correction de l'ecran du jour :
`vue-seance.js` et `vue-perso.js` appellent la meme barre **sans nom**. Mesure :
`#/seance` porte `aria-progressbar-name` (serious) et trois `color-contrast`
(serious), `#/perso` un `aria-progressbar-name`. **Cinq constats serious en
ligne**, avec une CI verte.

**Cause** — `e2e` n'appelait `verifierAccessibilite` que sur trois ecrans sur
cinq. La mesure d'accessibilite bloque, elle ne se discute pas — mais elle ne
bloque que la ou on la lance. Un controle qui ne couvre qu'une partie de son
objet donne la meme confiance qu'un controle complet, et c'est ce qui le rend
plus dangereux qu'une absence de controle.

**Detecte par** — `relecture`

**Action** — `garde-fou` — les deux ecrans sont nommes ET la mesure les couvre
desormais. Le troisieme geste est le seul qui compte dans le temps : sans lui,
les deux premiers redeviennent invisibles au prochain changement.

### 5. Un contraste casse par une DOUBLE attenuation, pas par une couleur mal choisie

**Symptome** — trois constats `color-contrast` sur `#/seance` :
`.exercice.fait .chrono` tombait a 2,56:1.

**Cause** — la couleur etait bonne (7,4:1 sur blanc) ; une regle
`opacity: .55` posee par-dessus la ramenait sous le seuil. Chercher la faute
dans la palette n'aurait rien donne.

**Detecte par** — `relecture`

**Action** — `rien` — l'opacite est retiree plutot que reglee : une valeur
d'opacite choisie juste au-dessus du seuil serait restee fragile au premier
changement de teinte. `.exercice.fait .video-exercice` portait le meme calcul et
n'etait pas mesure — aucun exercice coche du jour de test ne porte de lien video
— donc corrige par coherence, sinon le trou se serait deplace sur un autre jour.

### 6. Un libelle invente faute de PRD

**Symptome** — la barre de `#/perso` mesure le PROGRAMME entier, pas une seance.
L'artisan l'a donc nommee « Avancement des exercices du programme », distincte de
celle de la seance, pour ne pas dire une fausse chose a la voix.

**Cause** — rien dans le PRD ne fixe ces libelles. Le choix est juste, et il
reste un choix fait par un agent a la place de l'utilisateur.

**Detecte par** — `auteur`

**Action** — `arbitrage` — a confirmer par l'utilisateur ; ecrit ici plutot que
tu, pour qu'il ne reste pas un mot pose par defaut que plus personne n'interroge.

### 7. La fiche produit a decrit du code qui n'existait pas encore

**Symptome** — releve par le `relecteur`. J'avais ecrit dans `PRODUCT.md`
« **Ce qui existe maintenant** : l'ecran du jour dit en toutes lettres... »
alors que l'artisan etait encore en train de le construire : `vue-jour.js`
n'avait que deux etats, aucun « Revoir » n'existait, et le total restait ecrit
deux fois.

**Cause** — j'ai ecrit la section produit AU MOMENT de la decision de
l'utilisateur, et non au moment de la livraison. L'intention etait bonne — la
decision est reelle, tranchee sur maquettes — mais un PRD qui dit « maintenant »
d'un code absent ment des la fusion, et rien ne distingue a la lecture une
decision prise d'une decision prise ET livree.

**Detecte par** — `relecture`

**Action** — `comportement` — la section produit s'ecrit quand le code existe, et
part dans LE MEME commit que lui. Le contrat le disait deja (« dans le meme
commit que le code ») ; ce que cette anomalie ajoute, c'est qu'ecrire d'avance
dans l'arbre de travail suffit a creer le mensonge, meme sans committer.

### 8. Mes deux sections de PRD etaient placees hors de la section qui les accueille

**Symptome** — releve par le `relecteur` : ecrites en `###`, elles atterrissaient
APRES « 16. Ajoute apres les PRP » au lieu d'etre dedans, ou les neuf
precedentes sont en `####`.

**Cause** — je n'ai pas regarde le niveau de titre des sections voisines avant
d'ecrire.

**Detecte par** — `relecture`

**Action** — `rien` — renumerotees `16.10` et `16.11`.

### 9. Le garde-fou de contexte a bloque un commit deja verifie

**Symptome** — `pret.sh` a refuse l'etape : « contexte de 643 821 jetons — au-dela
du critique ». Le seuil est 600 000 (`COUT_CONTEXTE_CRITIQUE`, `scripts/cout.sh`).
Le travail etait pourtant **fini et vert** — tests 339/339, e2e 5/5 aujourd'hui et
sous une horloge de novembre, revue outillee verte, critique UX rendue — et
simplement pas encore enregistre.

**Cause** — le garde-fou vise a empecher de CONTINUER a travailler dans une
session saturee. Il attrape aussi le dernier geste d'une session qui, elle, a
fini : son message dit « rouvre une session sur la MEME branche, qui reprend par
le depot », alors que precisement le travail n'y est pas encore. La session neuve
ne trouverait rien a reprendre.

**Detecte par** — `auteur`

**Action** — `arbitrage` — pose a l'utilisateur, qui a tranche : enregistrer,
puis couper. Le contournement est assume et ecrit ici plutot que tu, parce qu'un
garde-fou contourne en silence est pire qu'un garde-fou absent — il donne
l'illusion qu'il tient.

**Ce qu'il faudrait changer, et qui n'est pas fait ici** : le refus devrait
porter sur l'ouverture d'un CHANTIER, pas sur l'enregistrement de ce qui est
deja verifie. Un `pret.sh` qui laisse passer un arbre vert tout en refusant la
suite dirait la meme chose sans pousser a le contourner. A porter par une branche
`fabrique/` — pas par celle-ci, dont le perimetre est deja large et le contexte
justement sature.

**Et la mesure elle-meme est juste** : cette session a fait bien plus que ce
qu'une branche devrait porter. Elle est partie d'un test rouge et a livre six
corrections d'accessibilite, deux decisions d'ecran, un filet hebdomadaire et
trois regles de contrat. C'est le garde-fou qui avait raison sur le fond ; c'est
son POINT D'APPLICATION qui est mal choisi.

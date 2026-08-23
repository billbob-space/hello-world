# 2026-08-23 — claude/ramure-v2-refonte-suite-w2epqj

Branche : `claude/ramure-v2-refonte-suite-w2epqj`
Périmètre : ramure-v2, fabrique
Mode : `chaud`

Suite de `journal/2026-08-22-claude-ramure-v2-refonte-1q0zsr.md`, dont les
anomalies 20, 21 et 23 sont le reste a traiter : le troisieme choix de forme
(les 548 px libres du mur), le rognage du mur, et les deux defauts d'outillage
laisses ouverts parce qu'ils debordaient de la demande d'alors.

## Anomalies

### 1. L'axe de couverture navigateur se taisait au lieu de rendre KO

**Symptome** — `./scripts/revue.sh ramure-v2` rendait « couverture Go 82,0 % » et
rien d'autre. Le client TypeScript de l'app — 15 modules, 16 fichiers de test —
n'etait mesure par aucune revue. Rien dans la sortie ne disait qu'une moitie de
l'app n'avait pas ete lue.

**Cause** — l'axe reconnaissait une seule chaine de test client, `node --test
tests/*.test.js` a la racine de l'app. C'est la chaine des trois apps qui
l'utilisent, et elle a l'avantage de n'installer aucune dependance. Un client en
TypeScript ne peut pas l'utiliser — node n'execute pas de `.ts` — et passe donc
par vitest, sous `web/`. Le `ls tests/*.test.js` echouait, la branche entiere
etait sautee, et `web_pct` restait vide : la variable vide traversait tout le
chemin jusqu'au manifeste, ou `revue_couverture_web` n'etait tout simplement
jamais posee. Un axe qui ne trouve pas ce qu'il cherche rend `ok`.

**Detecte par** — `relecture`

**Action** — `garde-fou` — le defaut n'est pas d'ignorer vitest, c'est de rendre
`ok` en n'ayant rien mesure. Une app qui echappe a un axe doit le FAIRE SAVOIR ;
ici l'app avait du reporter la barre dans son propre `test.sh`, ce qui donne deux
barres pour une mesure, dont une seule alimente le cliquet.

### 2. Les diagnostics du serveur de langage Go sont tous faux dans le conteneur cloud

**Symptome** — a la premiere edition d'un fichier Go, seize diagnostics
identiques : « go.work requires go >= 1.25.0 (running go 1.24.7) », sur des
fichiers qui compilent et dont les tests passent dans le meme conteneur.

**Cause** — deux Go dans l'image. Le shell voit `go1.25.0` ; `gopls`, lance par
le harnais, en trouve un autre en 1.24.7 et refuse de charger les paquets. Aucun
diagnostic Go n'est donc exploitable dans une session cloud, ni les vrais ni les
faux.

**Detecte par** — `auteur`

**Action** — `outillage` — un LSP qui rend seize faux constats sur un depot sain
coute plus qu'il ne rapporte : on apprend a ne plus lire ses sorties, et le jour
ou il en rend un vrai il est ignore. Meme mecanique que les faux « introuvable »
du 22 aout.

### 3. La section qui garde la trace d'un choix citait un artefact qui n'existe plus

**Symptome** — la section « Montre » de la critique du 23 aout pointait un
artefact publie lors d'un essai anterieur, remplace depuis : l'adresse ne rend
plus rien. Elle chiffrait par ailleurs la tuile de la variante A a 373 px, valeur
d'esquisse presentee comme une mesure ; la variante reellement construite donne
377 px. Deux couts de variante manquaient encore : les 293 px de vide lateral que
A rouvre, et le nombre de pochettes que chaque variante tient sans retrecir —
18 aujourd'hui, 6 avec A comme avec B.

**Cause** — les maquettes sont jetables, la trace ne l'est pas, et les deux ont
ete ecrites dans le desordre : la section a ete redigee avant que les variantes
soient baties, donc avec les chiffres de l'esquisse et l'adresse de l'essai
precedent. Republier un artefact lui donne une adresse neuve, et rien ne relie
l'ancienne a la nouvelle.

**Detecte par** — `relecture`

**Action** — `comportement` — la section qui cite un artefact s'ecrit APRES sa
publication, et ne porte que des chiffres releves sur la maquette construite. Un
document de decision qui pointe dans le vide vaut moins qu'une absence de
document : il fait croire que la trace existe.

### 4. Le message de commit est ecrit par le moteur le moins cher, et personne ne le relit

**Symptome** — le premier commit de la branche porte « L'axe detale maintenant
vitest » pour « detecte », et « une chaine reconue » pour « reconnue ». Le corps
reste comprehensible, mais c'est le document ou le raisonnement est cense
survivre a la fusion.

**Cause** — le greffier tourne sur `haiku`, choix delibere et justifie : son
travail est mecanique et son verdict binaire. Ecrire le message ne l'est pas —
c'est la seule partie redactionnelle de sa sequence, et elle est confiee au
moteur le moins outille pour elle. Aucun controle ne lit ce texte : `pret.sh`
verifie l'etape, pas la prose.

**Detecte par** — `auteur`

**Action** — `arbitrage` — non corrige ici : reecrire un commit deja pousse pour
deux fautes coute une reecriture d'historique, ce qui est cher pour du cosmetique.
Mais le partage est a revoir — soit l'appelant fournit la premiere ligne et le
corps, soit le greffier cesse de rediger. Aujourd'hui le fait de le lui laisser
n'a jamais ete decide, il a ete herite.


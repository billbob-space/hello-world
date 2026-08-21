# 2026-08-21 — claude/estran-location-selection-fsizzf

Branche : `claude/estran-location-selection-fsizzf`
Périmètre : estran
Mode : `chaud`

## Anomalies

### 1. Le catalogue de sites de maree etait suppose absent, il est public

**Symptome** — `PRODUCT.md` et `prp/00-ossature.md` decrivent
`berck-plage-fort-mahon` comme « le point le plus proche disponible dans leur
catalogue », arbitrage pris en aout 2026 apres consultation manuelle. La
selection de lieu exigeait de retrouver ce catalogue ; il est servi par
`GET https://api-maree.fr/sites`, **sans cle**, 131 sites avec leurs
coordonnees.

**Cause** — l'endpoint n'est pas liste dans la page de documentation de
l'API, qui ne decrit que `tide-extrema` et `water-levels`. Le catalogue avait
donc ete releve a la main, une fois, et fige dans le PRD comme une limite du
fournisseur alors que ce n'en etait pas une.

**Detecte par** — `auteur`

**Action** — `rien` — un endpoint non documente ne se devine pas ; aucun
garde-fou n'aurait vu qu'une constante figee cachait une capacite.

### 2. Un artisan lance avec `run_in_background: false` demarre quand meme en fond

**Symptome** — l'appel `Agent(subagent_type: "artisan", run_in_background: false)`
rend immediatement « Async agent launched successfully », avec la consigne de ne
pas travailler sur les memes fichiers en attendant. Le drapeau explicite n'a pas
ete honore.

**Cause** — le harnais, pas le depot : la valeur est acceptee sans effet.
`memory/travail.md` annonce deja ce comportement (« `run_in_background: false`
n'est pas une garantie ») sur la foi de deux entrees ; celle-ci est la
troisieme, et la premiere ou la consigne « ne se lance JAMAIS en tache de fond »
de l'artisan est contredite des le premier appel.

**Detecte par** — `auteur`

**Action** — `comportement` — la parade est cote appelant : ne rien ecrire dans
`apps/estran/` tant que l'artisan tourne, et le declarer dans le champ `hors` de
sa mission plutot que de compter sur le drapeau.

### 3. Deux tests d'estran appelaient le vrai Open-Meteo depuis la CI

**Symptome** — releve par l'artisan du chantier `04`. `serveurEtRequetePrevisions`
et `requeteMaree` construisaient leurs clients par `NouveauClientPluie` et
`NouveauClientNowcast`, qui lisent les URL de base **de production** quand les
variables `ESTRAN_BASE_*` sont absentes. Les tests partaient donc sur
`api.open-meteo.com` et `webservice.meteofrance.com` a chaque execution, y
compris en CI.

**Cause** — le repli `env("ESTRAN_BASE_PLUIE", "<url de production>")` est le bon
comportement en production et le mauvais en test, et rien ne distingue les deux.
Les tests passaient : un appel reseau reussi ne se voit pas, et un appel reseau
echoue aurait ete lu comme une panne de fournisseur, que ces tests couvrent
justement. Le defaut etait donc invisible dans les deux sens.

**Detecte par** — `auteur`

**Action** — `garde-fou` — `test.sh` ne verifie pas qu'aucun test ne sort sur le
reseau. Le PRD de la fabrique l'interdit pourtant, et `e2e/lancer.sh` s'en donne
les moyens la ou les tests unitaires ne le font pas. Corrige en passant sur ces
deux tests ; **le controle manque toujours, et son correctif ne vit pas sur cette
branche** — il touche `scripts/` et vaut pour les dix apps, alors que le
Perimetre est `estran`. A porter par une branche `fabrique/`.

### 4. Un document de conception trop imprecis fait retirer des cas de test

**Symptome** — `prp/04` § 1.1 donne six distances de controle au dixieme de
kilometre mais **pas les coordonnees** des six points. L'artisan, a qui la
revalidation reseau etait interdite, n'a pu ecrire que quatre des six paires, et
avec une tolerance large ; les deux plus precises (Wimereux/Boulogne a 4,4 km,
Saint-Malo a 7,6 km) — donc celles qui exercent le mieux le seuil de 30 km —
sont absentes de `lieu_test.go`.

**Cause** — moi. J'ai calcule ces distances a partir de coordonnees que je n'ai
pas recopiees dans le document, en supposant qu'un resultat mesure suffisait a
le rejouer. Un chiffre attendu sans son entree n'est pas un cas de test, c'est
une affirmation.

**Detecte par** — `auteur`

**Action** — `comportement` — une valeur attendue ecrite dans un PRP part avec
ses ENTREES, sinon elle n'est pas reproductible par qui recoit le document.

### 5. `NaN` traverse un controle de bornes qui a l'air complet

**Symptome** — releve en instruisant un constat G704 de la revue outillee.
`parametreLatLon` valide par `lat < -90 || lat > 90 || lon < -180 || lon > 180`.
`strconv.ParseFloat("NaN", 64)` **reussit**, et les quatre comparaisons sont
**fausses** pour NaN — toute comparaison avec NaN l'est. `?lat=NaN&lon=NaN`
traversait donc la validation et partait chez le fournisseur.

**Cause** — un controle de bornes ecrit en comparaisons se lit comme exhaustif
et ne l'est pas : il rejette ce qui est hors bornes, pas ce qui n'est comparable
a rien. `+Inf` et `-Inf`, eux, sont bien rejetes, ce qui rendait le controle
convaincant a la relecture. Le format `%.4f` empechait que ce soit une faille —
`NaN` n'introduit aucun separateur d'hote — mais la donnee etait fausse.

**Detecte par** — `relecture`

**Action** — `rien` — corrige, et le cas est desormais teste. Aucun garde-fou
generique n'attraperait « comparaison de bornes sur une valeur potentiellement
non finie » sans crier sur tout le depot.

### 6. Un `#nosec` documente ce que le code ne garantit pas

**Symptome** — le constat G704 visait `recupererJSON`, le point de passage
UNIQUE de tous les appels sortants de l'app. La teinte y etait bien neutralisee,
mais **chez les appelants** : `%.Nf` sur des flottants, `url.QueryEscape` sur le
seul parametre texte, hote toujours pris d'une variable de paquet. Y poser un
`#nosec` aurait couvert d'avance **tout appelant futur**, y compris un appelant
teinte — c'est-a-dire exactement le risque que la regle veut empecher.

**Cause** — la regle du contrat dit qu'un `#nosec` doit nommer *ce qui*
neutralise la teinte. Elle ne dit pas ou ce quelque chose doit vivre. Une raison
vraie au moment ou on l'ecrit peut cesser de l'etre sans que la ligne bouge.

**Detecte par** — `auteur`

**Action** — `contrat` — `memory/revue.md` gagnerait une phrase : quand le
constat porte sur un point de passage partage, la raison du `#nosec` doit etre
**appliquee par du code a cet endroit**, pas seulement vraie chez les appelants.
Ici, un garde sur le couple scheme+hote. **Le correctif ne vit pas sur cette
branche** : `memory/` est partage, le Perimetre est `estran`. A porter par une
branche `fabrique/`, avec l'anomalie 3.

### 7. Un `#nosec` sur un seul des deux points de sortie fait reapparaitre l'autre

**Symptome** — releve par l'artisan. G704 designe DEUX lignes de
`recupererJSON` : `http.NewRequestWithContext` et `client.Do(req)`. Annoter la
premiere seule ne suffit pas — gosec suit `req` par teinte jusqu'au vrai point
de sortie reseau, et le constat reapparait sur la seconde. Les deux lignes
doivent porter l'annotation.

**Cause** — un constat de teinte n'a pas UN emplacement mais une chaine, et
l'outil rapporte chaque maillon separement. Rien dans le message ne le dit.

**Detecte par** — `relecture`

**Action** — `rien` — verifie en relancant gosec directement plutot que
`revue.sh`, qui agrege. La lecon vaut pour la methode, pas pour un artefact :
un `#nosec` se verifie en relancant l'outil qui a produit le constat.

### 8. Un garde compare a des variables globales aurait casse toute la suite de tests

**Symptome** — le garde anti-SSRF devait comparer l'hote appele a celui des
bases configurees. Les bases sont des variables de PAQUET (`baseMeteoForecast`,
`basePluie`…), mais les tests construisent leurs clients en fixant directement
le champ `Base*` de la structure vers un serveur local, sans jamais toucher ces
variables. Un garde adosse aux globales aurait refuse la quasi-totalite des
appels de test.

**Cause** — deux sources de verite pour la meme adresse : la variable de paquet,
lue au demarrage, et le champ de la structure, seul lu ensuite. Le code de
production les fait coincider, les tests non — et c'est le test qui a raison,
puisque c'est le champ qui decide de l'appel reel.

**Detecte par** — `auteur`

**Action** — `rien` — resolu en faisant porter la base en PARAMETRE explicite de
`recupererJSON`, alimente par le champ du client a chaque site d'appel. Le garde
compare desormais ce que l'appelant a declare vouloir joindre a ce qu'il joint
vraiment, ce qui est la comparaison utile.

### 9. G706 reste remonte apres correction : le verbe de format ne coupe pas la teinte

**Symptome** — apres passage de `%s` a `%q` sur le chemin journalise, gosec
continue de signaler G706. La correction est bonne — le test le prouve, un
chemin porteur d'un saut de ligne ne produit qu'une ligne — mais l'analyse de
teinte ne modelise pas qu'un verbe de format neutralise la source.

**Cause** — l'outil suit l'origine d'une valeur, pas ce qu'on en fait a
l'arrivee.

**Detecte par** — `relecture`

**Action** — `comportement` — ne pas viser « aucun residu » mais « aucun point
bloquant ». Un constat de gravite basse qui survit a sa correction est un etat
normal ; le poursuivre conduirait a poser un `#nosec` sur du code deja correct,
donc a masquer le jour ou il cesserait de l'etre.

### 10. Une regle d'auteur bat l'agent utilisateur : un `<dialog>` ferme restait visible

**Symptome** — releve par l'artisan de l'ecran de choix. `dialogue.open` valait
bien `false` apres `close()`, mais le cadre restait affiche a l'ecran.

**Cause** — une regle `display: flex` posee sur `.dialogue-lieu` sans qualifier
`[open]`. Le navigateur applique lui-meme `display: none` a un `<dialog>` ferme,
mais par sa feuille d'agent utilisateur — et **toute** regle d'auteur la bat,
quelle que soit la specificite. L'etat du DOM etait donc juste et l'ecran faux,
ce qui rend le defaut invisible a toute verification qui interroge `open`.

**Detecte par** — `test`

**Action** — `rien` — corrige en scopant la regle a `.dialogue-lieu[open]`, avec
le mecanisme commente dans le CSS. Le piege est propre a `<dialog>` et a une
poignee d'elements a comportement natif ; un garde-fou generique crierait sur
tout le depot.

### 11. Un jeton anti-concurrence incremente deux fois laissait gagner la reponse la plus lente

**Symptome** — `rendreListeLieux` incrementait `jetonRequeteLieu` une seconde
fois en interne, en plus de son appelant. Une reponse plus ANCIENNE — la liste
par defaut, plus lente — pouvait donc gagner la course contre une recherche
lancee apres elle, et s'afficher a sa place.

**Cause** — le jeton est un compteur qui doit avoir **un seul** point
d'incrementation par requete logique. En le posant a la fois chez l'appelant et
chez l'appele, on invalide la requete en vol depuis l'interieur de son propre
traitement.

**Detecte par** — `auteur`

**Action** — `rien` — corrige en ne l'incrementant qu'a l'appelant, propage en
parametre. Aucun test ne l'aurait vu : il faut deux requetes en vol dont la
premiere est la plus lente, ce que le stub local ne produit pas.

# 2026-08-18 — claude/estran-forecast-beyond-5h-0pjzvx

Branche : `claude/estran-forecast-beyond-5h-0pjzvx`
Périmètre : estran
Mode : `chaud`

## Anomalies

### 1. La navigation temporelle a laisse le jour courant tronque a cinq heures

**Symptome** — un aller-retour utilisateur : impossible de voir la fin de
l'apres-midi sans partir sur demain puis revenir. La donnee etait deja
recuperee et deja servie aux autres jours ; seule la journee en cours restait
coupee a cinq vignettes.

**Cause** — prp/01 s'etait donne pour contrainte principale de laisser l'ecran
d'aujourd'hui identique a l'octet pres, et a livre les vingt-quatre heures
« pour un jour autre qu'aujourd'hui ». Cette formulation, ecrite pour proteger
l'ecran d'ouverture, a fige une asymetrie que personne n'avait choisie : le
seul jour qu'on regarde vraiment etait le seul a ne pas avoir le detail.

**Detecte par** — `utilisateur`

**Action** — `comportement` — quand une capacite s'ajoute « pour les autres
cas », verifier ce qu'elle laisse au cas par defaut : ne pas toucher a l'ecran
d'ouverture est une precaution, pas un objectif.

### 2. Au bord de la fenetre, l'absence se decodait en zero

**Symptome** — application lancee en local et interrogee pour de vrai : le
seizieme jour de tendance annoncait « 0 °C, vent 0 km/h, rafales 0 », et la
journee entiere affichait « pluie 0 % » et « vagues 0,0 m ». Ni la
compilation, ni `go vet`, ni les tests, ni la relecture du diff ne l'avaient
signale — la seule chose qui l'ait montre est un appel a la vraie API.

**Cause** — Open-Meteo rend `null` au bord de sa fenetre, sur des grandeurs
distinctes et a des profondeurs distinctes (journalier au dernier jour, pluie
horaire sur la derniere journee, vagues nulles sur les 24 heures). Decodees en
`float64`, ces absences deviennent la valeur zero, qui est ici **credible** :
« 0 % de pluie » ne ressemble pas a une donnee manquante. Le PRP decrivait
pourtant la degradation attendue en bord de fenetre pour les vagues seules,
heritee de prp/01 — la regle etait ecrite, mais pour un seul champ, et
personne ne l'a generalisee en passant de huit a seize jours.

**Detecte par** — `auteur`

**Action** — `comportement` — elargir une fenetre de donnees, c'est s'approcher
du bord ou le fournisseur cesse de repondre : lancer l'app et regarder le
DERNIER element, pas le premier. Un test sur une donnee figee ne peut pas
trouver ca, il ne contient que ce qu'on a pense a y mettre.

### 3. Deux modeles d'accord affichaient « confiance haute »

**Symptome** — sur la vraie reponse, les jours J+9 a J+12 portaient une
confiance haute alors que quatre modeles sur six ne repondaient plus. L'indice
disait le contraire de ce qu'il est cense dire, precisement la ou l'incertitude
est maximale.

**Cause** — la regle que j'avais ecrite mesurait la DISPERSION entre modeles
survivants sans jamais regarder leur NOMBRE, au-dela d'un plancher a deux. Deux
modeles qui s'accordent ne font pas un accord, mais la formule ne pouvait pas
le savoir. Erreur de conception, pas d'implementation.

**Detecte par** — `auteur`

**Action** — `rien` — reparee par un plafond (« moyenne » au plus sous trois
modeles) ecrit dans le PRP et dans le code ; rien a en tirer pour la fabrique.

### 4. Un test capturait la mauvaise requete sortante, en silence

**Symptome** — rapporte par l'artisan : le test qui verifie la fenetre demandee
au fournisseur meteo capturait la requete dans une variable partagee par un
handler unique. L'appel d'accord entre modeles partageant la meme URL de base,
il ecrasait la requete capturee, et le test aurait continue a passer en
verifiant la mauvaise.

**Cause** — un test double qui ne distingue pas deux appels distincts vers le
meme hote ne verifie pas ce que son nom annonce. Le defaut est apparu quand un
troisieme appel sortant est arrive, pas quand le test a ete ecrit.

**Detecte par** — `auteur`

**Action** — `rien` — repare en distinguant les deux requetes sur la presence
du parametre `models`.

### 5. Un test comparait un nombre d'heures a une constante, avec l'heure reelle

**Symptome** — rapporte par l'artisan : le test de la reponse sans parametre
utilisait `time.Now()` et exigeait exactement cinq vignettes. Avec la nouvelle
regle (les heures restantes du jour, minimum cinq), cette egalite devient
fausse selon l'heure a laquelle la CI tourne — vert en local le soir, rouge en
CI a midi.

**Cause** — un test qui depend de l'horloge reelle et fige une egalite stricte
mesure l'heure autant que le code. Le reste du domaine passe deja `maintenant`
en parametre explicite pour cette raison ; ce test-la ne le faisait pas.

**Detecte par** — `auteur`

**Action** — `rien` — repare en comparant au plancher plutot qu'a l'egalite ;
le vice de forme est connu et deja evite partout ailleurs dans cette app.

# 03 — Le graphe de pluie : deux echelles de temps, deux fournisseurs

Demande utilisateur du 19 aout 2026 : « un graphe de pluie le plus precis
possible (par 10 mins si possible) ».

Le present document dit ce qui a ete mesure, ce qui a ete choisi, et ce qui a
ete refuse. Les deux precedents restent valides : celui-ci ajoute une section a
l'ecran, il ne remanie rien.

## 1. Ce que les fournisseurs donnent vraiment (mesure le 19 aout 2026)

Trois pistes ouvertes, toutes appelees en direct sur `50.517, 1.583` :

| Source | Pas | Portee | Cle | Verdict |
|---|---|---|---|---|
| Open-Meteo `minutely_15`, defaut « seamless » | 15 min **annonces** | J-7 → J+15, **sans un seul null** | non | **piege**, cf. ci-dessous |
| Open-Meteo `minutely_15`, `models=meteofrance_arome_france_hd` | 15 min **reels** | J-7 → J+2 (puis `null`) | non | **retenu** — la courbe du jour |
| Meteo-France « pluie dans l'heure » | 5 min puis 10 min | +60 min | non | **retenu** — la bande de l'heure |
| Open-Meteo `hourly=precipitation` | 60 min | J-7 → J+15 | non | **retenu** — le repli au-dela de J+2 |

**Le piege de `minutely_15` par defaut.** Interroge sans `models=`, Open-Meteo
rend 2208 pas de quart d'heure couvrant les vingt-trois jours de la fenetre de
l'app, aucun `null`. Aucun modele meteo ne produit du quart d'heure a seize
jours : au-dela de la portee d'un modele a maille fine, le fournisseur
**interpole depuis l'horaire** et ne le dit pas dans sa reponse. Une courbe
batie la-dessus aurait montre, a J+9, un detail au quart d'heure entierement
fabrique — precisement le « zero credible et faux » que le principe 3 du PRD
interdit, sous une autre forme.

Le meme appel force sur `meteofrance_arome_france_hd` (maille 1,5 km) s'arrete
net et rend `null` au-dela de sa portee. **C'est cette version qu'on retient :
la fenetre du vrai quart d'heure devient lisible dans la donnee elle-meme**,
au lieu d'etre un seuil devine et code en dur qui aurait vieilli en silence.
La borne mesuree le 19 aout etait J+2 vers 11 h ; on ne l'ecrit nulle part.

**La bande de l'heure.** Meteo-France expose la prevision immediate de pluie
sur un point nomme, et ce point existe : la reponse s'identifie
`Le Touquet-Paris-Plage`, avec `rain_product_available: 1`. Elle rend neuf pas
— six de 5 minutes puis trois de 10 — couvrant l'heure qui vient, chacun avec
une intensite de 1 a 4 (sec, faible, moderee, forte) et son libelle francais.
C'est le seul « par 10 minutes » qui existe pour ce lieu, et il ne porte que
sur l'heure qui vient : d'ou deux echelles plutot qu'une.

**Ce que cette source coute en fragilite.** Elle passe par l'adresse
qu'utilise l'application mobile de Meteo-France, avec le jeton public que
celle-ci embarque — pas par un contrat d'API. Elle est gratuite et sans
inscription, mais rien ne la garantit : elle peut changer ou disparaitre sans
preavis. **Arbitrage assume et dit a l'utilisateur avant ecriture** ; la
contrepartie est que sa panne ne coute rien (section 4). Un jeton public
embarque dans une application distribuee n'est pas un secret : il est ecrit en
clair dans le code, avec ce commentaire, et non declare en `env:` — un `env:`
suggererait a l'exploitant qu'il a une valeur a fournir, ce qui est faux.

## 2. Ce que l'ecran montre

Une section **Pluie**, entre la maree et les prochaines heures : c'est la
question qu'on se pose en second, juste apres l'etat de la maree, et avant le
detail heure par heure.

- **Bande de l'heure qui vient** — neuf segments colores par intensite, de
  maintenant a +60 min, avec l'heure de la derniere mise a jour. **Aujourd'hui
  uniquement** : cette prevision n'existe pas pour un autre jour, et une bande
  vide vaudrait mieux que rien seulement si elle se distinguait d'une bande
  seche — elle ne se distinguerait pas. Sur un autre jour, elle n'est pas
  rendue du tout.
- **Courbe du jour affiche** — de minuit a minuit, en millimetres, suivant les
  fleches de navigation comme le reste de l'ecran. Au pas du **quart d'heure**
  quand AROME couvre ce jour, au pas de **l'heure** sinon, et l'ecran dit
  lequel des deux (« au quart d'heure » / « par heure »). Le cumul du jour et
  le maximum d'un pas accompagnent la courbe.
- **Une journee sans pluie** affiche « aucune pluie prevue » plutot qu'une
  courbe plate : une courbe plate se lit comme une panne.

## 3. Ou vit le code

Un fichier `pluie.go` pour les deux fournisseurs, plutot qu'une rallonge de
`meteo.go` (deja 25 ko, deja trois appels sortants) : les deux echelles ont
leur propre cadence de fraicheur, leur propre mode de panne, et aucune n'entre
dans `Previsions`.

Une route `/api/pluie` distincte de `/api/previsions`, pour trois raisons :
une source lente ne doit pas retarder l'ecran principal, la bande de l'heure
se rafraichit plus souvent que la tendance a seize jours, et la panne de l'une
se lit sans contaminer l'autre. Elle accepte le meme parametre `date` que les
deux routes existantes, valide par la meme fonction et la meme fenetre.

Chaque fournisseur a son propre `dernierConnu` : la bande peut etre resservie
depuis le cache pendant que la courbe est fraiche, et reciproquement.

## 4. Degradation

Le principe 3 du PRD s'applique deux fois, differemment :

- **La bande de l'heure tombe** — la section garde la courbe du jour et la
  bande disparait. Aucun message d'erreur : cette prevision est un supplement,
  pas la promesse.
- **La courbe fine tombe, ou le jour regarde est hors de la portee d'AROME** —
  la courbe passe au pas horaire, batie sur `hourly=precipitation`, qui vient
  du meme appel que le reste de l'ecran et tombe donc en meme temps que lui.
  L'ecran dit « par heure » : c'est une precision moindre, pas une panne.
- **Les deux tombent** — la section affiche que la pluie est indisponible pour
  le moment, et le reste de l'ecran ne bouge pas.
- **Un pas `null`** reste absent jusqu'au JSON de sortie, comme partout
  ailleurs dans cette app. Un `null` de fin de fenetre AROME n'est pas un
  0,0 mm : c'est ce qui delimite la portee du quart d'heure.

## 5. Ce qui n'est pas fait

- **Pas de radar, pas de carte.** Les tuiles de radar public donneraient une
  image, pas une valeur au point ; lire un pixel de tuile pour en tirer une
  intensite serait un detour fragile pour une precision qu'on a deja.
- **Pas d'alerte, pas de notification.** Le PRD les exclut, et rien ici ne
  rouvre la question.
- **Pas de probabilite au quart d'heure.** Open-Meteo ne rend
  `precipitation_probability` que sur le mode « seamless », donc interpolee
  au-dela de la portee fine ; la probabilite horaire, elle, existe deja sur
  les vignettes des prochaines heures.

# 04 — Le lieu devient une donnee

Jusqu'ici le lieu etait quatre constantes de `main.go` : `latitude`, `longitude`,
`siteMaree`, et le titre de `index.html`. Ce document le transforme en parametre
de requete, et definit ce que l'application sait dire d'un lieu qu'elle n'a
jamais vu.

Il ne touche pas a l'ecran de choix, qui fait l'objet de `05-ecran-de-choix.md` :
ici, uniquement les donnees et les routes.

**Ce qui l'a demande** : la demande du 21 aout 2026 — « pouvoir choisir la
localisation, en distinguant les zones de littoral des zones interieures, la
meteo marine etant la seule fiable sur la plage ». C'est cette derniere phrase
qui commande tout le document : sur un lieu de littoral, l'etat de la mer n'est
pas un supplement, c'est ce qui rend l'ecran juste.

## 1. Ce que les fournisseurs donnent vraiment (mesure le 21 aout 2026)

### 1.1 Le catalogue de marees est public, et il n'a pas de cle

    GET https://api-maree.fr/sites

Rend `{"sites":[{"site_id","site_name","latitude","longitude"}, ...]}`, **131
sites**, **sans `key=`**. Il n'est pas liste dans la page de documentation de
l'API, qui ne decrit que `tide-extrema` et `water-levels` — d'ou l'affirmation
de `00-ossature.md` et de `PRODUCT.md` selon laquelle le catalogue avait ete
releve a la main. Elle etait vraie du geste, pas du fournisseur.

Consequence directe : `siteMaree = "berck-plage-fort-mahon"` cesse d'etre une
constante et devient **le plus proche du point regarde**, calcule.

Couverture mesuree : Manche, mer du Nord, Atlantique, estuaires (Bordeaux,
Pauillac). **Ni la Mediterranee ni la Corse.** Le site le plus proche de Nice
est Bordeaux, a 644 km — ce qui donne le seuil du § 2.2.

Distances de controle, calculees a la formule de haversine :

| Point | Site le plus proche | Distance |
|---|---|---|
| Le Touquet-Paris-Plage | Berck Plage – Fort Mahon | 20,1 km |
| Wimereux | Boulogne-sur-Mer | 4,4 km |
| Saint-Malo | Saint-Malo | 7,6 km |
| Arras | Berck Plage – Fort Mahon | 89,7 km |
| Lille | Dunkerque | 77,9 km |
| Nice | Bordeaux | 643,8 km |

### 1.2 La grille marine repond, ou ne repond pas

    GET https://marine-api.open-meteo.com/v1/marine?latitude=..&longitude=..&hourly=wave_height

Le fournisseur **repond 200 partout**, y compris a Arras et a Lille : ce n'est
pas le code HTTP qui distingue la mer de la terre, c'est le contenu. En mer, la
serie porte des nombres ; a l'interieur, elle porte **`null` sur toutes les
heures**. Verifie aux quatre points ci-dessus.

C'est donc le fournisseur lui-meme qui tranche « littoral / interieur », et
non un rayon invente ou une liste de communes cotieres a tenir a jour.

### 1.3 Le geocodage : la Base Adresse Nationale

    GET https://api-adresse.data.gouv.fr/search/?q=..&type=municipality&limit=8
    GET https://api-adresse.data.gouv.fr/reverse/?lat=..&lon=..

Publique, gratuite, sans cle, service de l'Etat. Rend du GeoJSON dont on lit
`properties.name` (« Wimereux »), `properties.postcode`, `properties.context`
(« 62, Pas-de-Calais, Hauts-de-France ») et `geometry.coordinates` (**lon, lat**
— dans cet ordre, piege classique du GeoJSON).

**France uniquement, et c'est un choix, pas une limite subie.** Les quatre
sources de l'app le sont deja : les marees viennent du SHOM, la prevision
immediate de Meteo-France, et le bulletin de reference qui a defini le produit
est un bulletin marine francais. Un geocodeur mondial rendrait des lieux ou
trois sections sur quatre seraient vides — et sa premiere reponse a « Le
Touquet » est une commune belge du Hainaut, mesuree le 21 aout 2026. La
recherche mondiale n'est pas ecartee pour toujours ; elle n'est pas dans ce
document.

`reverse` rend une **adresse**, pas une commune : on lit `properties.city`.
En mer il rend `features: []` — cas normal quand le telephone se localise sur
une plage large ou sur un ponton (§ 4).

## 2. Ce qu'est un lieu

```go
type Lieu struct {
    Nom        string   // "Le Touquet-Paris-Plage"
    Contexte   string   // "62, Pas-de-Calais"  — desambigue deux homonymes
    Latitude   float64
    Longitude  float64
    Littoral   bool     // § 2.1
    Maree      *SiteMaree // nil = pas de maree ici, § 2.2
}

type SiteMaree struct {
    ID       string  // "berck-plage-fort-mahon"
    Nom      string  // "Berck Plage – Fort Mahon"
    DistanceKm float64
}
```

### 2.1 `Littoral` — ce que dit la grille marine

`Littoral` est vrai si et seulement si l'appel marine du § 1.2 rend **au moins
une hauteur de vague non nulle** sur la fenetre demandee. Aucun autre critere.

Corollaire a tenir : la reponse du fournisseur marine ne peut pas etre
« absente » sans consequence. Si l'appel **echoue** (reseau, 5xx), on ne conclut
pas « interieur » — on ressert le dernier connu du lieu, et a froid on rend
`littoral: null` : *on ne sait pas encore*. Un lieu de plage declare interieur
par une panne reseau est exactement l'erreur que ce document doit empecher.

### 2.2 `Maree` — le plus proche, sous 30 km

Haversine sur les 131 sites. Le plus proche est retenu **s'il est a 30 km ou
moins** ; au-dela, `Maree` est `nil`.

Le seuil vient de deux mesures et non d'un arrondi : Le Touquet est a 20,1 km de
Berck et cette approximation est deja assumee et documentee depuis aout 2026 ;
le premier lieu franchement interieur du tableau, Dunkerque vu de Lille, est a
77,9 km. Entre 20 et 78 il y a de la place ; 30 km laisse passer les plages dont
le port de reference est un peu loin sans jamais laisser passer une ville de
l'interieur.

**La distance s'affiche toujours**, comme aujourd'hui pour Berck. C'est ce qui
permet a celui qui lit de juger l'approximation lui-meme.

Un lieu peut donc etre `Littoral: true, Maree: nil` — toute la Mediterranee.
Ce troisieme cas n'est pas une panne et ne se presente pas comme telle.

## 3. Les routes

Trois routes existantes prennent deux parametres optionnels, **`lat` et `lon`**,
a cote de `date` qu'elles portent deja :

    GET /api/previsions?lat=&lon=&date=
    GET /api/maree?lat=&lon=&date=
    GET /api/pluie?lat=&lon=&date=

**Absents, le comportement est celui d'aujourd'hui a l'octet pres** : Le Touquet,
Berck. C'est la meme contrainte que `01-navigation-temporelle.md` s'etait donnee
pour `date`, et pour la meme raison — un parametre neuf ne doit pas pouvoir
changer une reponse que personne ne lui a demande de changer.

Presents, ils sont valides ensemble : l'un sans l'autre est une `400`, hors de
`[-90,90]` / `[-180,180]` aussi. Ils sont **arrondis a 3 decimales** avant tout
usage — ~110 m, sous la maille de tous les fournisseurs — ce qui borne les cles
de cache et evite qu'un GPS qui derive de 4 m cree une entree neuve a chaque
rafraichissement.

`/api/maree` sur un lieu sans site a moins de 30 km rend un corps explicite
plutot qu'une erreur :

```json
{ "configure": true, "sansMaree": true, "raison": "cote-eloignee",
  "distanceKm": 89.7, "siteLePlusProche": "Berck Plage – Fort Mahon" }
```

`raison` est a **vocabulaire ferme** : `cote-eloignee` (§ 2.2) ou
`facade-non-couverte` (site le plus proche a plus de 200 km — la Mediterranee).
L'ecran a besoin de la distinction : « la cote est loin d'ici » et « cette mer
n'est pas couverte » ne se disent pas de la meme facon a quelqu'un qui est
assis sur une plage a Nice.

Deux routes neuves :

    GET /api/lieux?q=<texte>        recherche, § 1.3, max 8 resultats
    GET /api/lieu?lat=&lon=         resout un point : nom, littoral, maree

`/api/lieux` rend pour chaque resultat le `Lieu` complet du § 2 — donc son
caractere littoral et son site de maree. C'est ce qui permet a l'ecran de choix
d'annoncer ce qu'on va trouver **avant** de changer de lieu, ce que la variante
retenue le 21 aout 2026 promet.

Consequence a assumer : une recherche declenche jusqu'a 8 appels marine. Ils
partent **en parallele**, bornes a 4 s au total, et un lieu dont l'appel n'a pas
abouti sort avec `littoral: null` — l'ecran dira « on verra sur place » plutot
que de mentir dans un sens ou dans l'autre. Le catalogue de marees, lui, est en
memoire (§ 4) : il ne coute aucun appel.

`/api/lieu` sert la geolocalisation : le navigateur donne un point, le serveur
rend le nom (BAN reverse) et les capacites. `features: []` — en mer, ou hors de
France — rend un lieu **sans nom**, `nom: ""`, jamais un nom invente ; l'ecran
choisit alors quoi ecrire (`05`, § 4).

## 4. Ou vit le code

| Fichier | Ce qu'il porte |
|---|---|
| `lieu.go` **(neuf)** | `Lieu`, `SiteMaree`, haversine, le client BAN, le client catalogue, la resolution d'un point en `Lieu` |
| `lieu_test.go` **(neuf)** | haversine sur les six distances du § 1.1, seuil 30 km, ordre lon/lat du GeoJSON, `littoral: null` a froid |
| `meteo.go` | `ClientMeteo` perd ses champs `lat`/`lon` : `Recuperer(ctx, lat, lon)` |
| `maree.go` | idem, et le site n'est plus un champ du client mais un argument |
| `pluie.go` | idem pour `ClientPluie` et `ClientNowcast` |
| `cache.go` | `dernierConnu[T]` devient **`parLieu[T]`** : `map[cle]*dernierConnu[T]` sous mutex, `cle` = lat/lon arrondis (+ le site pour la maree) |
| `main.go` | perd `latitude`/`longitude`/`siteMaree` comme constantes de construction ; les garde comme **defaut** du § 3 |

**Le cache par lieu est borne.** Un `map` qui grandit a chaque coordonnee vue est
une fuite lente dans une app a 128 Mo. Plafond : **32 lieux**, eviction du moins
recemment servi. Trente-deux couvre tres largement l'usage reel — quelques lieux
epingles, quelques recherches — et le depassement se journalise une fois, pas a
chaque eviction.

**Le catalogue de marees vit en memoire, charge paresseusement**, rafraichi au
plus une fois par 24 h. Son echec au premier appel ne casse rien : on retombe
sur `berck-plage-fort-mahon` **uniquement pour le lieu par defaut**, et pour
tout autre lieu on rend `sansMaree` avec `raison: "catalogue-indisponible"` —
troisieme valeur du vocabulaire ferme. Inventer un site voisin serait pire que
de dire qu'on ne sait pas.

**Aucun fichier sur disque, aucun volume** : `README.md` promet « aucune donnee
persistante », et ce document ne le change pas. Le catalogue se recharge au
demarrage, en un appel.

## 5. Degradation

Le principe 3 — degrader, jamais casser — s'applique lieu par lieu, et la regle
est la meme partout : **une capacite qu'on ne sait pas evaluer ne bascule jamais
vers « absente »**.

| Ce qui tombe | Ce que l'app fait |
|---|---|
| l'appel marine, sur un lieu | `littoral: null`, dernier connu du lieu resservi s'il existe |
| le catalogue de marees | lieu par defaut : Berck, inchange · autre lieu : `raison: "catalogue-indisponible"` |
| BAN `search` | `/api/lieux` rend 200 et une liste vide, avec un champ `erreur` : l'ecran garde ses lieux recents |
| BAN `reverse` | `/api/lieu` rend le lieu **sans nom**, capacites comprises : la geolocalisation reste utile |
| un fournisseur meteo | inchange — dernier connu **du lieu regarde**, jamais celui d'un autre |

Cette derniere ligne est la seule regression possible du document, et elle est
la raison du cache par lieu : resservir la meteo du Touquet sous le nom d'Arras
serait une valeur inventee, la faute que `PRODUCT.md` interdit partout.

## 6. Ce qui n'est pas fait ici

- **L'ecran de choix** — `05-ecran-de-choix.md`.
- **La recherche hors de France** — § 1.3.
- **Un compte, une preference conservee cote serveur** — rien ne change : ce que
  l'utilisateur retient vit dans son navigateur, et le serveur ne garde que des
  caches anonymes bornes.
- **Une maree mediterraneenne** — aucun fournisseur gratuit ne la donne, et son
  marnage la rend accessoire ; l'etat de la mer, lui, y est servi normalement.

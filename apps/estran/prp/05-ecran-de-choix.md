# 05 — L'ecran de choix du lieu

Ce document construit l'ecran par lequel on change de lieu. Il suppose acquis
tout `04-le-lieu-devient-une-donnee.md` : les routes `/api/lieux`, `/api/lieu`,
et `lat`/`lon` sur les trois routes existantes.

**La forme a ete tranchee par l'utilisateur le 21 aout 2026**, sur trois
maquettes montrees en artefact. Ce qui a ete ecarte est ecrit au § 6, avec sa
raison — sans quoi il reviendra tel quel dans deux mois.

## 1. La forme retenue — un ecran de choix qui dit ce que chaque lieu vaut

Le choix prend tout l'ecran, le temps de le faire. Chaque lieu y porte **trois
lignes de capacite** : maree, etat de la mer, pluie a la minute — presente ou
absente, et pourquoi.

C'est cette annonce qui a emporte le choix. Les deux autres variantes laissaient
decouvrir l'absence *apres* le changement, en ouvrant un ecran ampute ; celle-ci
la dit **avant**. Sur une app dont la moitie de la promesse est la maree, changer
de lieu sans savoir qu'on la perd est le mauvais moment pour l'apprendre.

```
┌──────────────────────────────┐
│ Où êtes-vous ?             ✕ │
│ ⌕ Chercher une commune…      │
│ ⊙ Utiliser ma position       │
├──────────────────────────────┤
│ Le Touquet-Paris-P. [LITTORAL]│
│  ● Marée — Berck, à 20 km    │
│  ● État de la mer            │
│  ● Pluie à la minute         │
├──────────────────────────────┤
│ Arras              [INTÉRIEUR]│
│  ○ Pas de marée — côte 90 km │
│  ○ Pas d'état de la mer      │
│  ● Pluie à la minute         │
└──────────────────────────────┘
```

## 2. Par ou on l'ouvre

Le nom du lieu, deja ecrit sous le titre dans l'en-tete (`index.html`,
`.lieu`), devient un **bouton**. Il n'y a pas de second point d'entree : le
contrat d'ecran du 20 aout 2026 tient — « le choix du jour est un controle
visible, jamais deduit d'un autre element » — et ce qui vaut pour le jour vaut
pour le lieu.

L'ecran s'ouvre **au-dessus** du contenu, pas a cote : c'est ce qui garde
l'ecran d'ouverture intact, l'argument qui a fait preferer cette variante au
bandeau de lieux. Piege connu et a tenir : `<dialog>` natif, `showModal()`,
fermeture a `Echap` et au clic hors du cadre, focus rendu au bouton a la
fermeture, `aria-modal`. Pas de scroll du corps derriere.

## 3. Ce que porte chaque fiche de lieu

Trois lignes, dans cet ordre, toujours les trois — une ligne absente et une
ligne negative ne disent pas la meme chose :

| Ligne | Presente | Absente |
|---|---|---|
| Maree | « Maree — <site>, a <n> km » | « Pas de maree — cote a <n> km » · « Pas de maree — la Mediterranee n'est pas couverte » |
| Etat de la mer | « Etat de la mer — houle et vagues » | « Pas d'etat de la mer » |
| Pluie a la minute | « Pluie a la minute — l'heure qui vient » | « Pas de pluie a la minute ici » |

Les deux libelles negatifs de la maree viennent du champ `raison` de `04` § 3 :
`cote-eloignee` et `facade-non-couverte`. `catalogue-indisponible` en donne un
troisieme, « Maree — on ne sait pas pour l'instant », qui n'est **ni** un oui
**ni** un non : c'est une panne, elle se dit comme telle.

Meme regle pour `littoral: null` (l'appel marine n'a pas abouti, `04` § 2.1) :
les deux premieres lignes affichent « on verra sur place », jamais « pas de ».
**Une capacite inconnue ne s'affiche jamais comme absente** — c'est la seule
regle de cet ecran qu'il ne faut pas assouplir.

La pastille `LITTORAL` / `INTERIEUR` reprend les couleurs deja posees :
`--eau-300` sur fond translucide pour le littoral, `--sable-400` pour
l'interieur. **Pas d'ambre** : il appartient a la maree et a rien d'autre
(`style.css`, en-tete).

## 4. « Utiliser ma position »

Un bouton, sous le champ de recherche. `navigator.geolocation.getCurrentPosition`,
puis `/api/lieu?lat=&lon=`.

Quatre etats, tous a ecrire :

- **refuse** — « Position refusee. Cherchez la commune ci-dessus. » Pas de
  seconde demande : le navigateur ne la montrera pas, et insister ne sert
  qu'a faire croire a une panne.
- **indisponible** (pas de HTTPS, materiel muet) — meme phrase, autre cause,
  meme issue.
- **abouti, nom connu** — la fiche s'affiche comme une autre, deja selectionnee.
- **abouti, nom inconnu** (`04` § 3, `nom: ""` — en mer, ou hors de France) — la
  fiche s'intitule **« Votre position »** et porte les coordonnees a 3
  decimales. Les trois lignes de capacite sont justes malgre tout : c'est le
  cas d'une plage large, et c'est precisement le cas d'usage qui a motive
  toute cette evolution. Ne pas le traiter comme une erreur.

La geolocalisation ne se declenche **jamais a l'ouverture de la page** : la
demande d'autorisation d'un navigateur, non sollicitee, est le premier ecran
qu'on apprend a refuser.

## 5. Ce qui est retenu, et ou

Les lieux vus vivent dans **`localStorage`**, cle `estran.lieux`, **8 au
maximum**, le plus recemment choisi en tete. Aucun compte, rien envoye nulle
part : `PRODUCT.md` exclut l'historique personnel, et cette liste ne le rouvre
pas — elle ne quitte pas l'appareil et ne dit rien de ce qui a ete consulte, ni
quand.

Trois obligations qui viennent du contrat d'artefact et valent ici :

- **toute lecture et toute ecriture sous `try/catch`** — navigation privee,
  stockage bloque, quota plein : la page doit s'afficher normalement sans.
- **Le Touquet-Paris-Plage est toujours dans la liste**, en dernier, non
  supprimable. C'est le lieu par defaut de `04` § 3 et le retour au connu.
- **le lieu choisi ne survit pas au rechargement** — il est dans l'URL
  (`?lat=&lon=`), pas dans le stockage. `01-navigation-temporelle.md` avait
  pris la meme decision pour le jour, et pour la meme raison : ce qui est dans
  l'adresse se partage et se relit ; ce qui est cache surprend.

## 6. Ce qui a ete ecarte, et pourquoi

**Ecarte — la recherche dans l'en-tete.** Le nom du lieu devient un bouton, un
champ s'ouvre dessous, on tape trois lettres. La plus econome des trois : rien
n'est ajoute a l'ecran d'ouverture, et le geste se devine sans rien apprendre.
Ecartee parce qu'elle ne dit jamais ce qu'on va perdre : on choisit Arras, et on
decouvre l'absence de maree en voyant un trou a la place de la jauge.

**Ecarte — un bandeau de lieux**, une rangee de pastilles au-dessus du bandeau
de jours, sur le modele exact du choix du jour. C'etait la variante la plus
rapide a l'usage — deux ou trois lieux en alternance pour un seul geste — et la
plus reguliere : une grammaire pour le jour et le lieu, pas deux. Ecartee pour
deux raisons cumulees : une rangee de plus (~40 px) en haut d'un ecran de
telephone deja court, au-dessus de la maree qui est la premiere chose qu'on
vient voir ; et surtout la meme cecite que la variante precedente sur les
capacites du lieu. **A rouvrir si l'usage montre qu'on alterne vraiment entre
deux ou trois lieux** : le stockage du § 5 porte deja la liste qu'il faudrait.

**Ce que la variante retenue coute, et qui est assume** : changer de lieu
demande deux gestes et un ecran entier, a chaque fois. C'est le prix de
l'annonce des capacites, et il se paie a chaque changement alors que l'annonce
ne sert vraiment que la premiere fois qu'on visite un lieu.

## 7. L'ecran principal, une fois le lieu choisi

Rien ne bouge sur un lieu de littoral : c'est l'ecran d'aujourd'hui, aux
coordonnees du lieu, avec l'etat de la mer dans les vignettes horaires comme au
Touquet. **C'est la clause centrale de la demande du 21 aout** — sur la plage,
la meteo marine est la seule fiable — et aucune section ne la retire.

Sur un lieu de l'interieur, deux sections n'ont pas de sens :

- **Maree** — la carte disparait, remplacee par le **cadre pointille** deja
  choisi le 21 aout 2026 pour « il n'y a rien a montrer » : « Pas de maree a
  Arras — la cote la plus proche du catalogue est a 90 km. » Ce n'est pas une
  panne et ne prend donc pas la carte d'indisponibilite, qui est reservee aux
  sources muettes. La decision du 21 aout tient telle quelle : « une absence
  legitime et une panne ne se presentent pas de la meme facon, et cette
  difference est portee par la forme ».
- **Etat de la mer** — la ligne de houle disparait des vignettes horaires. Pas
  de cadre, pas de phrase : une grandeur secondaire absente laisse sa ligne de
  cote, c'est deja la regle du `README` (« Degradation »).

Pluie et prochaines heures sont inchangees, partout.

Le titre de la page (`<title>`) et le nom sous l'en-tete suivent le lieu.
`index.html` porte aujourd'hui « estran — Le Touquet-Paris-Plage » en dur : il
devient le lieu par defaut, mis a jour par `app.js` au changement.

## 8. Bout en bout

`e2e/stub-serveur.js` gagne les deux routes BAN et le catalogue de marees, et
`e2e/tests/` un troisieme fichier, `lieu.spec.js`, qui couvre les trois etats
que rien d'autre ne couvre :

1. **littoral** — l'ecran de choix s'ouvre, une commune se cherche, la jauge de
   maree et la houle des vignettes sont la apres le choix ;
2. **interieur** — le cadre pointille remplace la jauge, la houle a disparu des
   vignettes, et **la carte d'indisponibilite n'apparait nulle part** — c'est
   la regression que ce PRP redoute le plus ;
3. **capacite inconnue** — le stub rend le marine en erreur : les lignes disent
   « on verra sur place », et **jamais « pas de »**.

L'accessibilite mesuree (`@axe-core/playwright`) passe sur l'ecran de choix
ouvert, comme sur le reste : elle bloque, elle ne se discute pas.

## 9. Ce qui n'est pas fait ici

- **Un lieu par defaut choisi par l'utilisateur** — Le Touquet reste le lieu
  d'ouverture. Rien ne le change tant qu'aucun usage ne le demande.
- **Une carte** — chercher une commune par son nom suffit a ce produit ; une
  carte est un composant lourd pour un geste rare.
- **Comparer deux lieux cote a cote** — jamais demande.

# PRP 06 — Les écrans autour du canevas

> **Ce PRP livre** tout ce qui entoure l'arbre : l'accueil et son mur de
> pochettes (F-05, F-06, F-07), la recherche avec suggestions et rattrapage
> orthographique (F-01 à F-04), la fiche artiste avec discographie classée et
> lecteur d'extraits (F-19, F-21, F-22, F-24, F-40), et le partage d'un arbre
> (F-34) — le seul canal d'acquisition du produit selon la §03.
>
> **Ce PRP consomme :**
> - du PRP 02 — `source.CorrectionPlausible(demande, propose string) bool`, qui
>   **ne sert jamais à choisir un candidat en silence** : elle n'autorise qu'une
>   proposition affichée à l'utilisateur ;
> - du PRP 03 — `LastFM.Profil`, `Deezer.Extraits`, `Odesli.LienEcoute`,
>   `RecherchePreRemplie`, et la discographie déjà classée par MusicBrainz ;
> - du PRP 04 — `Routes(d arbre.Dependances) http.Handler`, qu'il **élargit** ;
> - du PRP 05 — `textes.ts`, le compteur de génération de `promotion.ts`, et le
>   repli d'illustration déterministe de `canevas.ts`.
>
> **Ce PRP produit :**
>
> ```go
> // internal/api/suggest.go
> // GET /api/suggest?q=<saisie>  → [{nom, mbid}], au plus 8, jamais de correction silencieuse
> // GET /api/fiche?mbid=<mbid>   → profil, extraits, liens d'écoute
> ```
>
> ```ts
> // web/src/accueil.ts   mur de pochettes, tri mémorisé
> // web/src/fiche.ts     profil, discographie, filtre par type, lecteur
> // web/src/main.ts      amorçage, routage d'URL, état global
> ```

**Trois tâches**, indépendantes entre elles une fois les routes posées.

---

### Tâche 1 : l'accueil, le mur de pochettes et le tri mémorisé

Porte F-05, F-06, F-07.

**Fichiers :** créer `web/src/accueil.ts`, tests associés.

**Exigences testées :**

- le mur occupe toute la hauteur **sans défilement** ; le nombre de colonnes suit
  la largeur ;
- **aucune tuile vide ni décalage pendant le chargement** — le repli graphique du
  PRP 05 tient la place, et c'est pour cela qu'il occupe exactement celle de
  l'image ;
- **trois ordres au minimum**, dont un aléatoire relançable ;
- le choix de tri **survit au rechargement** (`localStorage`) ;
- **changer de tri ne recharge aucune illustration** — vérification par comptage
  des requêtes réseau, pas à l'œil ;
- **revenir à l'accueil réinitialise l'état** : la dernière graine ne reste pas
  collée (F-07) ;
- l'apparition progressive est **neutralisée** sous `prefers-reduced-motion`,
  jamais seulement accélérée.

- [ ] **Étapes 1 à 4 : rouge, implémenter, vert, committer**

```bash
git commit -m "ramure-v2 : accueil, mur de pochettes et tri memorise"
```

---

### Tâche 2 : recherche, suggestions, rattrapage et partage

Porte F-01, F-02, F-03, F-04 et F-34.

**Fichiers :** créer `internal/api/suggest.go`, `web/src/main.ts`, tests
associés.

**Exigences testées, côté interface :**

- suggestions au fil de la frappe, choisies **à la souris comme au clavier** :
  flèches pour parcourir, validation pour planter, effacement en une action ;
- l'état de la liste est exposé par `aria-expanded`, `aria-activedescendant` et
  `role="listbox"` — sans quoi la liste n'existe pas pour un lecteur d'écran ;
- **le rattrapage (F-03) passe par `CorrectionPlausible`** et replante sous la
  forme correcte **sans retaper**. La correction est toujours **affichée** :
  « tu voulais dire *Portishead* ? ». Une substitution silencieuse est interdite
  par la §09, et c'est la raison pour laquelle `autocorrect=0` est forcé côté
  Last.fm (PRP 03) ;
- un lien partagé ou une entrée de collection plante l'artiste **une seule
  fois**, sans le replanter aux navigations suivantes (F-04) — vérification par
  comptage des appels à `/api/centre` après trois navigations internes.

**Le partage d'un arbre (F-34)** — le lien doit marcher pour quelqu'un qui n'a
jamais ouvert l'application :

- une action produit un lien vers le centre courant, de la forme
  `https://ramure-v2.apps.billbob.ovh/?graine=<nom>` ;
- **aucun identifiant d'utilisateur, aucun jeton de session dans l'URL** — le
  lien ne porte que le nom de l'artiste ;
- le destinataire passe par l'authentification Google de Traefik, puis **ouvre
  l'arbre directement sur cet artiste**, sans écran d'accueil intermédiaire.

Tests : `le lien partagé ne contient aucune donnée personnelle` ; `ouvrir le lien
plante l'artiste sans passer par l'accueil` ; `un nom contenant un espace ou une
esperluette est correctement encodé puis décodé`.

**Note d'exécution :** en palier `google`, le destinataire doit posséder un
compte Google. C'est le seul palier qui rend F-34 réalisable dans cette fabrique,
et c'est la raison de la décision d'exposition — l'accès invité en lecture seule
évoqué par le PRD n'existe pas ici.

- [ ] **Étapes 1 à 4**

```bash
git commit -m "ramure-v2 : recherche, suggestions, rattrapage et partage"
```

---

### Tâche 3 : la fiche artiste, la discographie et le lecteur

Porte F-19, F-21, F-22, F-24 et F-40.

**Fichiers :** créer `web/src/fiche.ts`, `internal/api/fiche.go`, tests associés.

**Exigences testées :**

- sur écran large, **survoler une branche n'écrase jamais le profil du centre**
  (F-19) — l'aperçu est un panneau distinct ; c'est l'erreur d'ergonomie la plus
  facile à commettre et la plus désorientante ;
- le reclassement par appréciation est **perceptible comme tel** et n'intervient
  **qu'une fois** (F-21) : jamais de réordonnancement intermédiaire pendant le
  chargement ;
- le filtre par type est **masqué s'il n'y a rien à filtrer** (F-22) ;
- le lecteur est **réinitialisé à chaque changement de centre** (F-24) — un
  extrait qui continue après une promotion appartient à un artiste qui n'est plus
  à l'écran ;
- sans extrait disponible, la commande de lecture est **désactivée et
  explicite**, jamais un bouton inerte (F-40).

**Budget :** `Profil` et `Extraits` ne sont appelés **qu'ici**, à l'ouverture de
la fiche, jamais au chargement de l'arbre. Les appeler dans `Composer`
doublerait le coût du geste le plus fréquent du produit.

- [ ] **Étapes 1 à 4**

```bash
git commit -m "ramure-v2 : fiche, discographie classee et lecteur"
```

---

## Vérification de l'étape

**1 · Les deux suites passent.**

```bash
cd /home/user/hello-world && ./apps/ramure-v2/test.sh
```

**2 · Le parcours complet tient à la main**, serveur local : accueil → saisie
avec faute de frappe → correction proposée et acceptée → arbre → promotion →
fiche → extrait → lien d'écoute → partage. Aucun écran ne se recharge
entièrement.

**3 · Le budget n'a pas bougé.** L'ouverture d'une fiche ne doit rien coûter à
MusicBrainz au-delà des deux appels du centre :

```bash
cd /home/user/hello-world/apps/ramure-v2 && \
go test -race -count=1 -run 'TestBudget' -v ./internal/...
```

**4 · Le contrat de la fabrique tient, et l'app reste désactivée.**

```bash
cd /home/user/hello-world && ./init.sh --check && ./init.sh --list | grep ramure-v2
```

---

## Ce que la suite attend de vous

1. **Toutes les chaînes sont dans `textes.ts`.** Le PRP 08 le vérifie ; une
   chaîne écrite en dur dans `fiche.ts` sera à déplacer.
2. **Aucun contrôle en double.** Ce PRP ajoute beaucoup de commandes ; la parité
   stricte (PRP 08) exige que les deux variantes d'un même contrôle ne coexistent
   **jamais** dans le document. Deux champs de recherche produiraient des
   requêtes en double et rendraient la navigation assistée inutilisable.
3. **Le lecteur d'extraits est le seul élément à état persistant de
   l'interface.** Le PRP 07 ajoute la collection : qu'il ne le réinitialise pas
   en ajoutant un signet, ce qui couperait la lecture sans raison visible.
4. **`/api/suggest` ne corrige jamais en silence.** S'il renvoyait un artiste
   corrigé sans le dire, F-03 deviendrait invérifiable et la §09 serait violée
   côté serveur, là où personne ne la relit.

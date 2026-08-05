# PRP 08 — Parité stricte, accessibilité, installation

> **Ce PRP livre** les deux exigences transverses que rien n'a encore vérifiées :
> la **parité stricte des dispositions** — étroit et large au même niveau
> d'exigence, décision du commanditaire — et **WCAG 2.2 AA sans exception** sur
> l'écran principal (§07, §12, M-08). Il livre aussi l'installation, le
> fonctionnement hors ligne et la mise à jour (N-11, N-12, F-41, F-42), y compris
> le cas propre à cette fabrique : la session Traefik expirée.
>
> **Ce PRP consomme** l'ensemble de l'interface produite par les PRP 05 et 06 —
> canevas, caméra, promotion, accueil, recherche, fiche — et n'ajoute aucune
> route serveur. **Il corrige** ce que les tests d'accessibilité révèlent : c'est
> sa nature, et c'est pourquoi il vient après les écrans et non avant.
>
> **Ce PRP produit :**
>
> ```ts
> // web/src/disposition.ts   parité stricte étroit/large
> // web/src/sw.ts            installation, hors-ligne, mise à jour
> // web/manifest.webmanifest
> ```

**Deux tâches.**

---

## Pourquoi la parité stricte est une contrainte de structure

Le PRD (§17) laissait ouverte la question « mobile ou desktop d'abord ». La
réponse du commanditaire est **la parité stricte**, et sa conséquence n'est pas
cosmétique : les paramètres de cadrage §05 deviennent **fonction de la largeur** —
10 branches et 3 héritiers sur écran large, 6 branches et 2 héritiers sur écran
étroit — pour tenir la lisibilité (§11) et les cibles tactiles (§12).

L'exigence structurante qui en découle : **les deux variantes d'un même contrôle
ne coexistent jamais**. Deux champs de recherche simultanés produiraient des
requêtes en double, et deux commandes de même intitulé rendraient la navigation
assistée inutilisable — le lecteur d'écran annoncerait deux fois la même chose
sans qu'aucune des deux ne soit la bonne.

---

### Tâche 1 : parité stricte et WCAG 2.2 AA

Porte §07, §12 et M-08.

**Fichiers :** créer `web/src/disposition.ts` ; modifier tout ce que les tests
révèlent dans `canevas.ts`, `accueil.ts`, `fiche.ts`, `main.ts` ; tests associés.

- [ ] **Étape 1 : écrire les onze tests qui échouent**

1. `un seul champ de recherche dans le document`, à toute largeur — balayage de
   320 px à 2560 px par pas de 40 px.
2. `aucun intitulé accessible en double` — extraction de tous les noms
   accessibles, comparaison deux à deux, **aux deux dispositions**.
3. `chaque nœud est activable au clavier`, avec le même résultat qu'au clic.
4. `chaque nœud porte le nom complet de l'artiste` comme intitulé accessible —
   jamais une initiale, un identifiant ou une position.
5. `le changement de centre est annoncé` — une région `aria-live="polite"`
   contient le nom du nouveau centre après promotion.
6. `quitter l'exploration et remonter d'un cran ont des intitulés distincts`.
7. `les cibles tactiles font au moins 24×24 px`, y compris les commandes de zoom
   et le plus petit nœud, aux deux dispositions.
8. `l'ordre de tabulation suit la logique de lecture`, pas l'ordre de rendu — en
   SVG, l'ordre du document est aussi l'ordre de peinture, et les deux
   divergent dès qu'on place les libellés en dernier (PRP 05).
9. `les panneaux et fenêtres sont titrés`, même sans titre visible.
10. `un lien d'évitement mène au contenu principal`.
11. `aucune information n'est portée par la couleur seule` — l'affinité se lit
    par la distance et la taille (F-09), jamais par la teinte.

- [ ] **Étape 2 : lancer, constater l'échec, corriger l'interface**

C'est la seule étape de la série où l'implémentation consiste surtout à
**modifier du code déjà écrit**. Deux corrections sont attendues d'expérience :
l'ordre de tabulation, et les intitulés en double laissés par les variantes de
disposition du PRP 06.

- [ ] **Étape 3 : vérifier au vert, puis committer**

```bash
git commit -m "ramure-v2 : parite stricte des dispositions, WCAG 2.2 AA"
```

---

### Tâche 2 : installation, hors-ligne, mise à jour et session expirée

Porte N-11, N-12, F-41, F-42.

**Fichiers :** créer `web/src/sw.ts`, `web/manifest.webmanifest`, tests associés.

**Exigences testées :**

- l'application est **installable** et **démarre sans réseau** sur son écran
  d'accueil ;
- les illustrations déjà vues restent disponibles hors ligne ;
- une version déployée atteint les installations existantes **sans action
  manuelle**, dans un délai borné ;
- une nouvelle version est **signalée à l'utilisateur** avec une action pour
  l'appliquer, **sans vidage manuel du cache** (F-42).

**F-41, session expirée — le cas propre à cette fabrique.** Traefik répond par
une redirection vers Google quand la session expire. Une requête `fetch` vers
`/api/…` reçoit alors une réponse **opaque ou en HTML**, jamais le JSON attendu.

Test : simuler une réponse `302` vers un hôte externe, puis une réponse HTML sur
`/api/centre`. L'application doit afficher **« session expirée, reconnecte-toi »**
avec un lien de reconnexion, et **jamais** un message d'erreur de saisie. C'est
le défaut le plus déroutant possible : l'utilisateur croit avoir mal tapé un nom
alors qu'il est simplement déconnecté.

**Piège de service worker :** un worker qui met en cache `/api/…` masquerait la
distinction vide/panne du PRP 04 et servirait un arbre périmé après
reconnexion. **Seuls les fichiers statiques et les illustrations sont mis en
cache** ; `/api` passe toujours par le réseau.

- [ ] **Étapes 1 à 4**

```bash
git commit -m "ramure-v2 : installation, mise a jour et session expiree"
```

---

## Vérification de l'étape

**1 · Les deux suites passent.**

```bash
cd /home/user/hello-world && ./apps/ramure-v2/test.sh
```

**2 · Les onze tests d'accessibilité sont bien exécutés**, pas seulement écrits :

```bash
cd /home/user/hello-world/apps/ramure-v2 && npm run --prefix web test -- --reporter verbose | grep -c '✓'
```

**3 · Ces tests-ci tournent sur DOM simulé, donc en CI.** C'est voulu : ils
n'ont besoin ni de navigateur ni de démon Docker, et ils sont donc les seuls
contrôles d'accessibilité que la chaîne automatique jouera vraiment à chaque
commit. Le PRP 09 en ajoute d'autres dans un vrai navigateur, mais désactivés
par défaut.

**4 · Une vérification manuelle au clavier**, documentée dans le `README` de
l'app : parcourir l'arbre entier à la tabulation, promouvoir une branche à la
touche d'entrée, revenir au cadrage neutre, ouvrir une fiche, garder un
artiste — sans souris, du début à la fin.

**5 · Le contrat de la fabrique tient, et l'app reste désactivée.**

```bash
cd /home/user/hello-world && ./init.sh --check && ./init.sh --list | grep ramure-v2
```

---

## Ce que la suite attend de vous

1. **Le PRP 09 rejoue ces mêmes propriétés dans un vrai navigateur.** Les tests
   de cette étape tournent sur DOM simulé : ils attrapent les intitulés en
   double et l'ordre de tabulation, pas le recouvrement réel des libellés ni le
   zoom des illustrations. Les deux niveaux sont nécessaires ; aucun ne remplace
   l'autre.
2. **Le service worker complique le bout en bout.** Prévoyez de pouvoir le
   désactiver par une variable au moment des tests, faute de quoi une version
   mise en cache rendra les échecs du PRP 09 irreproductibles.
3. **La parité stricte est une propriété qu'on perd sans le voir.** Tout contrôle
   ajouté après ce PRP doit passer le balayage 320 → 2560 px ; c'est le genre de
   test qu'on oublie de relancer parce qu'il ne concerne « que l'affichage ».

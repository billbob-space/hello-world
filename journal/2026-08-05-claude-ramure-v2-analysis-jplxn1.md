# 2026-08-05 — claude/ramure-v2-analysis-jplxn1

Branche : `claude/ramure-v2-analysis-jplxn1`
Périmètre : ramure-v2
Mode : `chaud`

## Anomalies

### 1. Supprimer le plan monolithique a emporté les vingt et une tâches que la série ne couvrait pas

**Symptome** — l'utilisateur signale que le PRD de `ramure-v2` semble perdu.
L'inventaire de l'historique montre deux suppressions distinctes, et une seule
est bénigne. `docs/PRD-RAMURE.md` (625 lignes, supprimé le 4 août par 598111b)
est **identique octet pour octet** à `apps/ramure/PRODUCT.md` : rien de perdu,
un déplacement. En revanche `docs/superpowers/plans/2026-08-03-ramure-v2.md`
(2282 lignes, supprimé le 5 août par 7de0c51) portait **25 tâches**, alors que
la série de PRP qui l'a remplacé n'en couvrait que 4 — les PRP 01 et 02. Les
tâches 5 à 25 — sources, arbre, canevas, écrans, collection, accessibilité,
recette, branchement — ne vivaient plus que dans l'historique git.

**Cause** — le commit de suppression a raisonné sur la **redondance** des deux
documents (« deux plans concurrents pour une app qui n'a pas une ligne de
code ») sans vérifier leur **couverture respective**. Les deux décrivaient bien
le même périmètre, mais à des profondeurs différentes : le plan monolithique
couvrait 25 tâches à faible densité, la série 4 tâches à très forte densité. Le
README de la série annonçait d'ailleurs les sept PRP restants comme « à venir »,
ce qui rendait la perte invisible : il n'y avait rien de cassé à voir, seulement
un travail à refaire que personne ne savait déjà fait.

**Detecte par** — `utilisateur`

**Action** — `garde-fou` — un contrôle possible : `--check` refuse la
suppression d'un document `docs/` ou `apps/*/prp/` dont le contenu n'est pas
couvert par les documents qui le remplacent. Difficile à écrire honnêtement
(« couvert » n'est pas mécanisable), donc à défaut : quand un document en
remplace un autre, la section `Provenance` du remplaçant doit dire **ce qui du
document supprimé n'a pas été repris**. Celle du README de la série disait
« le contenu qui comptait est ici », ce qui était faux et invérifiable.

### 2. Le plan d'origine décrivait des signatures que ses propres tests contredisaient

**Symptome** — trois divergences relevées en convertissant les tâches
récupérées. `Resoudre(ctx, nom)` n'avait pas de paramètre de portée, mais son
test n° 4 exigeait `budget.ErrPorteeInterdite` sur un appel en portée
`Entourage` — donc un argument que la signature ne portait pas. L'interface
`Proximite` passait un nom, alors que ListenBrainz **exige un MBID** : le repli
prévu contre le risque §14 était inutilisable tel qu'écrit. Et `routes()`
restait sans argument alors que `/api/centre` a besoin de sources injectées.

**Cause** — le plan monolithique a été écrit **avant** les PRP 01 et 02, qui ont
figé des conventions qu'il ne pouvait pas connaître : « la portée vient du site
d'appel, jamais d'une valeur par défaut », et « le PRP qui greffe le premier
tranche pour tous ». Un document de plan vieillit dès qu'un document plus précis
est écrit à côté de lui, et rien ne le signale.

**Detecte par** — `auteur`

**Action** — `rien` — les trois divergences sont tranchées dans les PRP 03 et
04, et consignées dans la section `Provenance` du README de la série, avec leur
raison. Aucun artefact de fabrique n'est en cause.

### 3. Deux sessions ont travaillé le même produit le même jour sans se voir

**Symptome** — l'analyse initiale de l'app a trouvé que `ramure-v2` réécrit un
produit déjà livré. `apps/ramure` couvre pratiquement tout le PRD — son code
cite F-01 à F-42 et N-01 à N-13, lot V2 partiellement compris — et tourne en
ligne. Le PRP 02 de `ramure-v2` spécifie un cache mutualisé, un budget d'appels
et une correspondance stricte des noms qui existent déjà dans `cache.go`,
`nom.go` et `mesures.go` de `apps/ramure`. La chronologie est serrée : plan v2
committé à 10 h 15, première version de l'app à 10 h 17, le même 3 août.

**Cause** — deux branches ouvertes en parallèle sur le même PRD, l'une en mode
planification, l'autre en mode réalisation, sans qu'aucun artefact du dépôt ne
les relie. Le contrat impose une entrée de journal par branche mais rien qui
signale « une autre branche travaille déjà ce périmètre ».

**Detecte par** — `auteur`

**Action** — `arbitrage` — poursuivre la réécriture ou reporter les trois écarts
réels sur `apps/ramure` (palier `google`, collection persistante, choix de
fournisseur du rôle 1) est une décision de produit, pas un correctif. La
décision prise sur cette branche est de poursuivre la série ; la note est
conservée pour que le coût soit connu.

<!-- cout : genere par ./scripts/cout.sh, ne pas editer a la main -->
## Coût

Relevé le 2026-08-05 à 14:01 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 171 | 0,00 $ |
| Écriture de cache | 369 593 | 2,31 $ |
| Lecture de cache | 10 228 931 | 5,11 $ |
| Sortie | 131 334 | 3,28 $ |
| **Total** | **10 730 029** | **10,71 $ — 9,30 €** |

<!-- cout-total: 10730029 -->
<!-- /cout -->

# Verite du banc relecteur — 6 defauts semes, 3 changements anodins

| # | fichier | defaut | difficulte | ce qu'il casse |
|---|---|---|---|---|
| D1 | maree.go | `sens` inverse : `prochain.Type == "BM"` au lieu de `"PM"` | moyen | la jauge annonce « montante » quand la mer descend |
| D2 | maree.go | `c := *e.Coefficient` sans garde nil (nil sur BM par convention SHOM, dit par le commentaire du type) | facile-moyen | panique a l'execution des qu'un extremum PM sans coef arrive |
| D3 | maree.go | `clamp(..., 0, 100)` retire | subtil | PositionPct depasse 100 quand `maintenant` sort de l'encadrement |
| D4 | pluie.go | echec de `recupererHoraire` avale (`return s, nil`) alors que le commentaire juste au-dessus le declare fatal | moyen | section vide sans qu'aucune erreur ne remonte ; repli perdu |
| D5 | pluie.go | fenetre horaire `joursNavigationAvant` au lieu de `+1` | subtil | le dernier jour navigable n'a plus de courbe |
| D6 | pluie.go | `c.Latitude` passe deux fois au lieu de `c.Longitude` | facile | la courbe fine porte sur un autre point du globe |

Changements ANODINS (les signaler comme defaut = faux positif) :
- A : `total` renomme `duree` dans RecupererA
- B : une phrase ajoutee au commentaire de JourMaree
- C : coordonnees formatees `%.5f` au lieu de `%.4f` dans recupererHoraire

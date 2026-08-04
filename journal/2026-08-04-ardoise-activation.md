# 2026-08-04 — ardoise/activation

Branche : `ardoise/activation`
Périmètre : ardoise
Mode : `chaud`

> Second commit de la séquence en deux temps du contrat : l'image d'`ardoise`
> est publiée (build vert sur `main`, commit `869b3a6`), ce commit passe
> `enabled: true` et régénère `compose.yaml`. Rien d'autre.

## Anomalies

Aucune anomalie : `./init.sh --app ardoise --enable` puis `./init.sh --check`
se sont déroulés sans surprise. Le bloc généré porte les trois services
attendus (`ardoise`, `ardoise-base`, `redis` en dépendance), `POSTGRES_PASSWORD`
injecté par nom sur les deux premiers.

<!-- cout : genere par ./init.sh --cout, ne pas editer a la main -->
## Coût

Relevé le 2026-08-04 à 21:25 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5, claude-sonnet-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 1 822 | 0,01 $ |
| Écriture de cache | 4 930 206 | 17,43 $ |
| Lecture de cache | 269 790 395 | 82,12 $ |
| Sortie | 675 172 | 9,83 $ |
| **Total** | **275 397 595** | **109,38 $ — 94,99 €** |

<!-- cout-total: 275397595 -->
<!-- /cout -->

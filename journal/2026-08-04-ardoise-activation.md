# 2026-08-04 — ardoise/activation

Branche : `ardoise/activation`
Périmètre : ardoise
Mode : `chaud`

> Second commit de la séquence en deux temps du contrat : l'image d'`ardoise`
> est publiée (build vert sur `main`, commit `869b3a6`), ce commit passe
> `enabled: true` et régénère `compose.yaml`. Rien d'autre.

## Anomalies

`./init.sh --app ardoise --enable` puis `./init.sh --check` se sont déroulés
sans surprise. Le bloc généré porte les trois services attendus (`ardoise`,
`ardoise-base`, `redis` en dépendance), `POSTGRES_PASSWORD` injecté par nom
sur les deux premiers.

### 1. Conflit de fusion sur `compose.yaml`, et le budget mémoire annoncé au-delà du plafond

**Symptome** — la PR d'activation de `compteur` (#43) a fusionné pendant que
celle-ci était ouverte ; les deux régénèrent `compose.yaml`, donc conflit.
Résolu en fusionnant `main` puis en **régénérant** le fichier avec
`./init.sh` plutôt qu'en résolvant les marqueurs à la main — c'est un
artefact généré, le contrat l'interdit d'ailleurs. Une fois `ardoise` **et**
`compteur` activées ensemble, `--check` annonce « mémoire engagée 1088 Mo sur
8 service(s), au-delà du plafond 1024 Mo » — exactement ce que
`apps/compteur/prp/00-ossature-et-implementation.md` §3 avait anticipé avant
d'écrire la moindre ligne de code.

**Cause** — deux applications à base de données activées le même jour,
chacune sous le plafond prise séparément, dépassent ensemble le
`memory_budget` de `fabrique.yml`. `--check` avertit, ne bloque pas :
`memory_budget` n'est pas un KO, c'est une limite dont le contrat laisse la
décision à qui connaît la RAM réelle du serveur.

**Detecte par** — `CI` (le conflit) et `auteur` (le budget, prévu d'avance)

**Action** — `arbitrage` — décision qui appartient à l'exploitant, pas à
corriger dans la fabrique : soit le serveur a la RAM pour 1088 Mo malgré le
plafond annoncé à 1024, soit `memory_budget` doit monter dans `fabrique.yml`,
soit une des deux annexes doit réduire sa limite mémoire.

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

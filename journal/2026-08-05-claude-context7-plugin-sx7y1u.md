# 2026-08-05 — claude/context7-plugin-sx7y1u

Branche : `claude/context7-plugin-sx7y1u`
Périmètre : cadran
Mode : `chaud`

## Anomalies

### 1. `cadran` servait sans delai d'ecriture depuis sa mise en ligne

**Symptome** — le serveur HTTP de `cadran` pose `ReadHeaderTimeout` et
`IdleTimeout`, mais pas `WriteTimeout`. Un client qui ouvre une connexion, envoie
ses en-tetes puis cesse de lire la reponse la retient indefiniment : rien ne la
ferme, aucun compteur ne le signale. La comparaison avec l'exemple de reference
de `net/http` — qui pose `ReadTimeout` et `WriteTimeout` — le rend visible en
une lecture.

**Cause** — les trois delais n'ont pas la meme evidence. `ReadHeaderTimeout` est
celui que tout le monde cite, `IdleTimeout` decoule du maintien de connexion ;
`WriteTimeout` protege contre un client lent *en lecture*, cas auquel on ne
pense pas en ecrivant un serveur qui repond en quelques millisecondes. Le piege
historique — `WriteTimeout` seul coupe les connexions maintenues — pousse en
outre a l'omettre ; il ne vaut que sans `IdleTimeout`, qui est ici pose.

**Detecte par** — `relecture`

**Action** — `rien` — repare ; un garde-fou generique serait faux, une app qui
diffuse un flux long doit legitimement s'en passer.

### 2. J'ai annonce que context7 n'avait rien a dire sur une app sans dependance

**Symptome** — interroge sur l'analyse de `cadran` avec context7, j'ai repondu
que l'app n'utilisant aucune bibliotheque exterieure, il n'y aurait « pas
grand-chose a aller verifier dehors ». Deux requetes plus tard, la confrontation
a la documentation de `net/http` produisait les deux seules corrections de la
session.

**Cause** — j'ai assimile « documentation d'une bibliotheque » a « documentation
d'une *dependance* ». La bibliotheque standard est de la documentation
exterieure comme une autre, et c'est meme le cas ou la verification paye le
mieux : une app sans dependance repose *entierement* sur elle, et personne ne
va relire les commentaires de `Server` une fois le serveur ecrit.

**Detecte par** — `auteur`

**Action** — `comportement` — une app en Go pur n'est pas une app sans surface a
verifier : la surface est la bibliotheque standard.

<!-- cout : genere par ./init.sh --cout, ne pas editer a la main -->
## Coût

Relevé le 2026-08-05 à 08:51 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 1 020 | 0,01 $ |
| Écriture de cache | 364 096 | 2,28 $ |
| Lecture de cache | 4 056 896 | 2,03 $ |
| Sortie | 26 764 | 0,67 $ |
| **Total** | **4 448 776** | **4,98 $ — 4,32 €** |

<!-- cout-total: 4448776 -->
<!-- /cout -->

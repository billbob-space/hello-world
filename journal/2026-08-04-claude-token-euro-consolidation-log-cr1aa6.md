# 2026-08-04 — claude/token-euro-consolidation-log-cr1aa6

Branche : `claude/token-euro-consolidation-log-cr1aa6`
Périmètre : fabrique
Mode : `chaud`

## Le relevé token/euro de cette session

Sujet de la branche : consigner ici le rapprochement entre les jetons consommés
et leur coût. Relevé au moment de la rédaction, modèle `claude-opus-5`, tarif
public 5 $ / 25 $ par million de jetons (entrée / sortie), écriture de cache à
1,25x l'entrée, lecture de cache à 0,1x.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée (non mise en cache) | 10 520 | 0,05 $ |
| Écriture de cache | 1 219 498 | 7,62 $ |
| Lecture de cache | 6 302 986 | 3,15 $ |
| Sortie | 24 408 | 0,61 $ |
| **Total** | **7 557 412** | **11,44 $ — 9,93 €** |

Taux 1 $ = 0,86843 € au 2026-08-04, source Frankfurter (référence BCE). Ce
tarif est celui de l'API : une session sous abonnement n'est pas facturée à ce
prix, le montant se lit comme une valeur de consommation, pas comme une facture.

L'écriture de cache pèse 67 % du total, et l'essentiel vient d'un seul geste :
la lecture du plugin `claude-api` pour vérifier le tarif par jeton. Chercher le
prix a coûté plus cher que tout le reste de la session réunie.

## Anomalies

### 1. Rien dans la fabrique ne rapproche les jetons du coût, et rien ne le signale

**Symptome** — La demande supposait qu'une consolidation token/euro existait
quelque part et qu'il suffisait de la recopier. Elle n'existe nulle part :
aucun fichier du dépôt ne mentionne de jetons ni d'euros, aucune entrée de
`journal/` ne porte de chiffre de consommation, et `/cost` — la commande citée
par l'utilisateur — est une commande du client, pas un outil : une session ne
peut pas l'exécuter sur elle-même. La consommation est bien enregistrée, mais
dans le fichier de conversation du conteneur, sous
`~/.claude/projects/`. Ce répertoire ne contenait que la session courante :
les huit branches précédentes du dépôt n'y ont laissé aucune trace.

**Cause** — Le chiffre vit dans le conteneur, qui est éphémère, et non dans le
dépôt, qui survit. Personne ne l'avait relevé parce que rien ne le réclame :
`--check` vérifie les manifestes et les documents, `--pret` vérifie la branche
et les tests, aucun des deux ne regarde ce que le travail a coûté. Un chiffre
que personne ne demande à l'instant où il est encore lisible est perdu par
défaut.

**Detecte par** — `utilisateur`

**Action** — `arbitrage` — faut-il un poste « coût » par branche ? Le relever
suppose de l'écrire à la main dans l'entrée de journal avant la fin de la
session : aucun outillage ne peut le reconstituer après coup, puisque la donnée
disparaît avec le conteneur. C'est une décision de méthode, pas un correctif.

### 2. Mesurer la session pendant la session a fait mentir la première mesure

**Symptome** — Premier relevé, en début de travail : 195 615 jetons d'écriture
de cache, environ 2 $ pour l'ensemble de la session. Second relevé, une
vingtaine de minutes plus tard : 1 219 498 jetons, 11,44 $. Le travail effectué
entre les deux se résume à la lecture d'un fichier de documentation et à la
rédaction de cette entrée — un facteur six sans qu'aucune tâche lourde n'ait
été lancée. Le tableau ci-dessus a lui-même dû être réécrit deux fois entre sa
première rédaction et le commit qui l'emporte.

**Cause** — La consommation d'une session s'accumule jusqu'à sa fin, y compris
sur les gestes faits pour la mesurer. Ici, le geste coûteux était précisément
celui de la mesure : ouvrir le plugin qui documente les tarifs par jeton a
chargé environ un million de jetons en cache, soit près de 8 $ sur les 9,73 $
du total. Un chiffre annoncé au milieu d'une session ne décrit donc pas la
session, et l'erreur va toujours dans le même sens : la sous-estimation.

**Detecte par** — `auteur` — second relevé, avant l'écriture du tableau.

**Action** — `comportement` — un chiffre de consommation se relève au dernier
moment, juste avant le commit qui l'emporte, et s'écrit avec l'instant du
relevé. Sans cette datation, un lecteur ne peut pas savoir ce que le chiffre
recouvre.

### 3. L'euro n'existe nulle part dans la donnée : il faut trois conversions

**Symptome** — La demande parlait d'euros. La conversation n'enregistre que
des jetons ; le tarif public est en dollars par million de jetons, et découpé
en quatre postes aux prix différents — entrée, sortie, écriture de cache,
lecture de cache — dont deux sont des multiples du prix d'entrée. L'euro exige
enfin un taux de change, absent du conteneur et allé chercher sur le réseau.
Trois conversions, dont deux qui vieillissent : le tarif du modèle et le taux
du jour.

**Cause** — Rien ne rapproche ces trois sources, et chacune vit ailleurs :
la consommation dans le conteneur, le tarif dans la documentation du modèle, le
taux sur un service tiers. Une valeur en euros est donc toujours une
reconstitution, jamais une lecture.

**Detecte par** — `auteur`

**Action** — `comportement` — un montant en euros ne s'écrit jamais seul : il
porte le taux, sa date et sa source, sinon il devient faux en silence et rien
ne permet de le recalculer.

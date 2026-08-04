# 2026-08-04 — claude/token-euro-consolidation-log-cr1aa6

Branche : `claude/token-euro-consolidation-log-cr1aa6`
Périmètre : fabrique
Mode : `chaud`

## Le relevé token/euro de cette session

Sujet de la branche : rapprocher les jetons consommés de leur coût. Le chiffre
est en fin d'entrée, écrit et tenu à jour par `./init.sh --cout` — la commande
née de cette branche. Ce qu'il ne dit pas et qui compte :

- **c'est un prix d'API, pas une facture.** Sous abonnement, rien de ce montant
  n'est refacturé ; il se lit comme une valeur de consommation ;
- **le cache domine.** L'écriture et la lecture de cache font l'essentiel du
  total ; l'entrée et la sortie visibles n'en sont qu'une fraction ;
- **une lecture de documentation coûte cher.** Ouvrir le plugin `claude-api`
  pour y vérifier le tarif par jeton a chargé plus d'un million de jetons en
  cache. Chercher le prix a coûté plus que tout le travail qui a suivi.

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

**Action** — `outillage` — arbitrage rendu dans la même session : il faut un
poste « coût » par branche. `./init.sh --cout` lit les conversations du
conteneur, applique les tarifs déclarés dans `fabrique.yml` et écrit le relevé
dans l'entrée de journal ; `--pret` avertit à chaque étape tant que le chiffre
manque ou a vieilli. Il avertit sans bloquer : le relevé peut encore s'écrire
au commit suivant, mais une branche fusionnée sans lui a perdu le sien.

### 2. Mesurer la session pendant la session a fait mentir la première mesure

**Symptome** — Trois relevés successifs de la même session, à une demi-heure
d'intervalle : environ 2 $, puis 11,44 $, puis plus de 23 $. Aucune tâche lourde
entre les deux derniers — la lecture d'un fichier de documentation, l'écriture
d'un script, quelques essais. Le tableau écrit à la main a dû être réécrit deux
fois avant d'être committé, et était de nouveau faux à l'instant du commit.

**Cause** — La consommation s'accumule jusqu'à la fin de la session, y compris
sur les gestes faits pour la mesurer : ici, le geste le plus coûteux était
précisément celui de la mesure. Un chiffre annoncé au milieu d'une session ne
décrit donc pas la session, et l'erreur va toujours dans le même sens, la
sous-estimation. Écrit à la main, il est faux avant même d'être relu.

**Detecte par** — `auteur` — relevés successifs, avant le premier commit.

**Action** — `outillage` — c'est ce qui a décidé de la forme de `--cout` : le
chiffre est **généré**, jamais recopié, et remplacé en place à chaque relance.
`--pret` compare le total consigné à celui de la conversation et avertit dès
qu'il a dérivé de plus d'un dixième, pour que le dernier commit d'une branche
emporte un chiffre juste.

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

**Action** — `outillage` — le taux et sa date vivent dans `fabrique.yml`, figés
à la main, et le bloc généré les recopie à côté du montant. `--cout` ne va
délibérément pas les chercher sur le réseau : un outil de vérification qui
appelle Internet échoue le jour où Internet manque. Il avertit à la place quand
le taux dépasse quatre-vingt-dix jours.

### 4. Le mot « token » est un mot-secret : nommer les clés en anglais arrêtait tout

**Symptome** — En déclarant les tarifs dans `fabrique.yml`, le nom de clé
naturel était `prix_token`. Essayé pour voir : `--check` s'arrête sur « la clé
token porte une valeur littérale et son nom évoque un secret ». Le message est
juste dans sa logique et trompeur dans son contexte — la valeur en question est
le chiffre 5, un prix public.

**Cause** — Le vocabulaire du sujet recoupe celui des secrets : un « token »
est ici une unité de facturation, ailleurs un jeton d'authentification. Le
scanner regarde le nom de la clé, jamais le sens, et c'est ce qui fait sa
solidité — il n'a pas à comprendre pour refuser.

**Detecte par** — `auteur` — essai délibéré avant d'écrire la clé, après
lecture du motif de détection.

**Action** — `rien` — les clés s'écrivent en français, « jetons », et le
problème disparaît. Affaiblir le motif pour ce cas coûterait bien plus qu'il ne
rapporte : `token` doit rester refusé partout.

### 5. Le tableau généré est sorti sur une seule ligne

**Symptome** — Premier essai de `--cout` : les quatre lignes du tableau
markdown collées bout à bout sur une seule, tableau illisible. Le script
n'avait pourtant rien signalé.

**Cause** — Chaque ligne était produite par une substitution de commande, et
bash retire les sauts de ligne de fin d'une substitution. Quatre appels ont donc
rendu quatre fragments sans séparateur. Rien ne pouvait le voir : du markdown
mal formé reste du texte valide.

**Detecte par** — `auteur` — relecture de la sortie de `--cout --dry-run`,
avant tout écriture dans le journal.

**Action** — `rien` — corrigé en accumulant les lignes dans une variable plutôt
qu'en les substituant. Le `--dry-run` a fait exactement son travail : montrer le
résultat avant qu'il touche un fichier.

<!-- cout : genere par ./init.sh --cout, ne pas editer a la main -->
## Coût

Relevé le 2026-08-04 à 20:01 UTC, sur 1 session(s) lisible(s) depuis
ce conteneur — celles des conteneurs précédents sont perdues. Modèle(s) :
claude-opus-5. Tarifs de `fabrique.yml`, en dollars par million de jetons ;
écriture de cache à 1,25x le prix d'entrée, lecture à 0,10x. Taux
1 $ = 0,86843 € au 2026-08-04.

| Poste | Jetons | Coût |
|---|---:|---:|
| Entrée | 10 658 | 0,05 $ |
| Écriture de cache | 1 342 078 | 8,39 $ |
| Lecture de cache | 38 899 780 | 19,45 $ |
| Sortie | 115 369 | 2,88 $ |
| **Total** | **40 367 885** | **30,78 $ — 26,73 €** |

<!-- cout-total: 40367885 -->
<!-- /cout -->

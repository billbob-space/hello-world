# Le PRD suit l'application — le détail

Quand lire : avant d'écrire un PRD ou un PRP, avant de livrer un ajout qui ne
vient d'aucun PRP, avant de retirer une ligne d'un « hors périmètre », et quand
`pret.sh` signale du code neuf sans `PRODUCT.md`.
Tenu par : --check — un document d'app égaré sous `docs/` est refusé par son
nom, le PRD n'a qu'un domicile ; pret.sh — un fichier de code neuf dans une app
dont le `PRODUCT.md` ne bouge pas, en avertissement, huit cas dans
`test-pret.sh`

## Pourquoi un document juste devient faux sans que personne ne mente

**Une correction passe par une ligne déjà écrite du PRD**, donc la fait bouger
toute seule : pour corriger le dénominateur du classement de marcq-handball, il
fallait rouvrir le § 9 qui l'énonçait. Le document a suivi sans que personne
n'ait eu à y penser.

**Une capacité neuve ne passe par aucune ligne existante.** Elle s'ajoute *à
côté* du PRD. Le 7 août 2026, marcq-handball a reçu un minuteur d'exercice et
des liens vidéo alors que son PRD listait les deux sous « hors périmètre, décidé
et non oublié » — et l'argument du refus, encore écrit, était devenu faux sans
qu'une seule ligne du document n'ait changé.

C'est le mode de défaillance à retenir : **le document ne devient pas faux au
moment où on l'écrit, mais au moment où on livre autre chose sans le rouvrir.**

## Les trois registres, et le trou entre eux

| Registre | Ce qu'il enregistre |
|---|---|
| `journal/` | les **anomalies** — ce qui a surpris, cassé, ou s'est révélé faux |
| `apps/<nom>/prp/` | le travail **planifié**, à sa date, et qui ne se rouvre pas |
| `apps/<nom>/PRODUCT.md` | les **décisions** — ce que l'app fait, et ce qu'elle refuse de faire |

Un ajout demandé de vive voix après la livraison ne tombe dans aucun des trois :
il n'a mal tourné nulle part, il n'était pas planifié, et il n'a été arbitré par
écrit nulle part. Le dépôt n'avait pas d'endroit pour lui — ce qui se lit, à
tort, comme la permission de ne rien écrire. **C'est ce trou que la section
« Ajouté après les PRP » comble**, et rien d'autre : elle ne remplace ni le
journal, ni un PRP.

## Ce qu'on écrit, et où

**Une correction** — elle livre ce que le PRD promettait déjà, ou répare ce
qu'il ne tenait pas. Corrige la ligne concernée, dans le commit qui corrige le
code. Rien de plus.

**Une capacité neuve** — une section `### N. Ajouté après les PRP` du
`PRODUCT.md`, dans le **même commit que le code**. Une entrée dit : ce qui
existe maintenant, ce qui l'a demandé, et ce que le PRD affirmait avant. La
troisième est la seule qui coûte quelque chose à écrire, et la seule qui serve
dans six mois.

**Une exclusion levée** — la ligne du « hors périmètre » ne s'efface pas : elle
garde une phrase qui renvoie à ce qui l'a rouverte. *Une exclusion qui disparaît
sans laisser d'adresse est une décision perdue*, et c'est ainsi qu'on la reprend
deux mois plus tard sans savoir qu'elle avait été tranchée.

**Un tableau de risques nomme le test qui tient chacun d'eux.** Tout tableau
« Risques » d'un PRD et tout tableau de cas d'échec d'un PRP porte une **colonne
finale « Test »** : soit le nom exact d'un test entre guillemets inverses, soit
« non testable » suivi de la raison. Une cellule vide n'est pas une option
silencieuse, et `--check` avertit quand un nom cité n'existe dans aucun test de
l'app. `apps/pilabelle/prp/` pratique déjà ce format.

*Ce que ça évite* : sur `renaissance-gym`, le refus « pseudonyme déjà pris » était
spécifié **trois fois** — PRD §14, PRP 03, PRP 06 — testé nulle part côté client,
et livré non implémenté. Un parent a perdu l'accès aux huit semaines de sa fille.
Une colonne obligatoire vide se voit à la relecture ; une promesse en prose, non.

**Quatre questions trouvent leur réponse écrite dans l'Annexe** du PRD, avant la
première ligne de code. Elles ne sont pas là par principe : chacune a coûté un
défaut livré.

1. **Combien d'appareils ?** — pas « combien d'utilisateurs ». C'est la seconde
   question qui décide s'il faut un serveur, et l'avoir confondue avec la
   première a invalidé un design déjà approuvé.
2. **Et si l'utilisateur ne peut pas terminer une étape ?** Un parcours guidé a
   besoin de quatre issues — sauter, quitter, revenir, refaire. On oublie de se
   la poser précisément quand le parcours nominal est limpide.
3. **Comment quitte-t-on un compte sans l'effacer ?** Dès qu'une identité est
   portable d'un appareil à l'autre, sa symétrie doit exister.
4. **L'unité de l'original survit-elle à la transposition ?** Séance ou
   exercice, palier ou date : une feuille papier ne date presque jamais ce
   qu'elle compte, et lui prêter un calendrier lui ajoute une contrainte que son
   auteur n'a pas écrite.

Ces quatre-là ne couvrent pas tout — les contraintes physiques de l'appareil et
la maille d'affichage de la progression restent hors de leur portée, et c'est dit
ici pour qu'on ne les croie pas couvertes.

**Un PRP livré ne se rouvre jamais** pour y ajouter l'après. Il est le compte
rendu d'une intention, à sa date. Le `README.md` du répertoire `prp/` dit où se
lit l'état réel : dans le PRD.

## Délimiter n'est pas lever — la distinction qui vaut le détour

Le minuteur de marcq-handball ne rouvre pas le refus écrit dans les décisions
écartées : ce qui était refusé, c'est de **mesurer la séance** ; ce qui a été
livré compte un **geste**, n'enregistre rien et n'envoie rien au serveur.
L'argument tient toujours, et reste écrit — le PRD en a **délimité le bord**.

Les liens vidéo, eux, **lèvent** une exclusion : rien de ce qui la motivait ne
survit. Les deux se ressemblent au moment de coder et ne se ressemblent plus du
tout six mois après. Écris laquelle des deux c'est ; si tu ne sais pas trancher,
c'est une levée.

## Ce que le garde-fou voit, et ce qu'il ne voit pas

`pret.sh` avertit quand une branche crée un fichier de code dans une app dont le
`PRODUCT.md` ne bouge pas. Le rapprochement est bon sans être infaillible :
vérifié sur les sept changements du 7 août, les trois qui déplaçaient le
périmètre créent chacun un fichier, les quatre corrections aucun.

- **Les `.md` et les répertoires de tests sont exclus.** Un test qui accompagne
  un correctif ne dit rien du périmètre. Mais un test qui accompagne une
  capacité neuve **n'éteint pas** l'avertissement — sinon il ne se déclencherait
  jamais sur du travail bien fait.
- **C'est un avertissement, jamais un blocage.** Un refactoring qui déplace du
  code dans un fichier neuf le déclenche sans rien devoir au PRD. Bloquer sur un
  signal heuristique apprend à le contourner.
- **Son angle mort** : la comparaison porte sur la branche entière depuis
  `origin/main`. Un `PRODUCT.md` touché au premier commit éteint l'avertissement
  pour tous les suivants. Il rattrape l'oubli, pas la négligence — relire le PRD
  avant la pull request reste un geste, pas une formalité.

## Le PRD n'a qu'un domicile

`apps/<nom>/PRODUCT.md`, jamais `docs/`, et `--check` refuse un document de
`docs/` dont le nom contient celui d'une app. Les compétences `superpowers`
écrivent leurs specs sous `docs/` : déplace le fichier avant de committer.

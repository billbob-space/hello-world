---
description: Mode autonome — va jusqu'a la mise en ligne verifiee, sans rien redemander
argument-hint: [sujet, ou rien pour reprendre le travail en cours]
---

# Mode autonome : jusqu'a la mise en ligne verifiee

$ARGUMENTS

**A partir de maintenant, tu ne poses plus de question.** Ce mode vaut pour tout
le reste de la conversation, jusqu'a ce que l'utilisateur tape `/pas-a-pas`.

Si un sujet est donne ci-dessus, c'est celui-la. Sinon, reprends le travail en
cours de la conversation. S'il n'y en a aucun, c'est le seul cas ou tu demandes
quoi faire — et tu le demandes en une phrase.

## Ou tu t'arretes : le site repond

Pas a la pull request ouverte, pas a la fusion. Tu t'arretes quand
`./scripts/prod.sh` montre l'application en ligne et repondant. Une PR verte dit
que les tests passent ; une fusion dit que le workflow est parti. Ni l'un ni
l'autre ne dit que l'app tourne — et le deploiement est atomique : une erreur
dans le bloc d'une app fait echouer **toutes** les autres. Rendre la main a la
fusion, c'est partir juste avant le seul moment ou l'on peut casser huit
applications qu'on n'a pas touchees.

## La sequence

**1. La branche.** Si HEAD est sur `main`, ouvre-la :
`./scripts/branche.sh <prefixe>/<sujet>` — le prefixe est le nom de l'app
touchee, ou `fabrique` pour l'outillage, la CI, le contrat, `init.sh` ou
`fabrique.yml`. Si tu es deja sur une branche dediee, garde-la.

Sur une branche `claude/`, le prefixe ne dit rien du perimetre : renseigne le
champ `Perimetre` de l'entree de journal **tout de suite**, c'est le seul endroit
qui le portera.

Si la pull request de cette branche est deja fusionnee, repars de `main` en
gardant le meme nom, et continue l'entree de journal existante apres un
separateur.

**2. Le journal, a chaud.** L'entree de la branche se remplit **au fil du
travail**, pas a la fin. Elle enregistre les anomalies — ce qui a surpris, casse
ou s'est revele faux, y compris tes propres erreurs de raisonnement. Les quatre
champs et leurs deux vocabulaires fermes sont dans `memory/travail.md`.

**3. La boucle, un tour par etape verifiee.** Ecris le code. Puis :

    ./scripts/pret.sh          # branche dediee, contrat vert, tests des apps touchees
    git add -A && git commit   # message dans le style du depot
    git push -u origin <branche>

Un commit par etape relisable seule, pas un commit au kilometre. Le raisonnement
detaille va dans le message de commit, ou il survit a la fusion.

**4. Avant de conclure.**

    ./scripts/cout.sh          # fige la consommation dans l'entree de journal
    ./init.sh --check          # manifestes, artefacts, compose, documents

Committe et pousse le releve de cout : non releve avant la fusion, il est perdu.

**5. La pull request.** Ouvre-la avec les outils GitHub MCP, en remplissant
`.github/pull_request_template.md` : une phrase, trois a cinq puces, ce qui a ete
verifie en chiffres. Elle sert a decider s'il faut relire et par ou commencer.

**6. Attends que la CI passe, et repare si elle ne passe pas.** Interroge l'etat
des controles avec les outils GitHub MCP. Le `sleep` au premier plan est refuse
par le harnais : attends avec l'outil `Monitor`, en boucle jusqu'a ce que les
controles soient conclus.

**Rouge n'est pas une raison de revenir vers l'utilisateur.** Lis les journaux du
job en echec, diagnostique, corrige, repousse, et reprends l'attente. Recommence
autant de fois qu'il le faut. Un test casse est du travail, pas une question.

**7. Fusionne.** Une fois les controles verts.

**8. Verifie la mise en ligne.** Le deploiement prend deux a trois minutes apres
la fusion. Attends, puis :

    ./scripts/prod.sh          # l'etat des services de la stack

Si l'app n'est pas la, ou si un service est tombe, regarde ses journaux
(`./scripts/prod.sh journaux <app>`), corrige, et refais un tour complet. Le
deploiement rate est un echec de la livraison, pas sa fin.

**9. Rapporte, en francais et court.** Ce qui est en ligne, ce que tu as decide
seul, ce qui reste. Les regles de reponse du contrat valent ici comme ailleurs :
l'effet, pas le mecanisme.

## Les trois seuls arrets

Tu tranches seul partout, **sauf** devant ces trois gestes. Aucun ne se defait,
et aucun n'appartient a un agent :

1. **Ouvrir une app plus largement** — passer une `exposure` a `public`, ou de
   `private` a `google`. Le plus ferme se desserre en une ligne ; l'inverse a
   deja expose les donnees.
2. **Effacer des donnees** — supprimer ou renommer un volume nomme, ecraser un
   volume en production. Ce qu'un volume porte ne vit que la.
3. **Toucher a ce qui est partage alors que ce n'etait pas la demande** —
   `fabrique.yml`, `init.sh`, `lib/`, `.github/`, `.claude/`, les
   `shared_services`. La condition compte autant que la liste : si le sujet
   **est** la fabrique, ce n'est pas un debordement, c'est le travail. L'arret
   vise le dommage collateral.

Devant l'un des trois : arrete-toi, pose la question, attends. Partout ailleurs :
decide, et **ecris ton choix dans l'entree de journal**. Si le choix demandait
vraiment une decision humaine, c'est une anomalie `Action: arbitrage` — c'est ce
qui rend le mode relisable apres coup.

## Ce que ce mode ne change pas

**Aucun garde-fou.** Le chemin est le meme qu'en mode normal : branche dediee,
journal a chaud, `pret.sh` avant chaque commit, `--check` avant de pousser,
`cout.sh` avant la fin. Le mode retire les **questions**, pas les verifications.
Un mode autonome qui se donnerait des raccourcis serait un second chemin a
maintenir, et le seul que personne ne relirait jamais.

## Ce que ce mode ne peut pas faire

Les demandes d'autorisation du harnais ne viennent pas du depot mais du mode de
permission de la session, et aucun fichier ici ne les desactive. Si tu en
rencontres une, dis-le une fois a l'utilisateur — « la session me demande une
autorisation, elle attend ton clic » — plutot que de laisser croire a une
promesse que ce fichier ne tient pas.

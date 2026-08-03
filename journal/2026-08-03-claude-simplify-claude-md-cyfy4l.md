# 2026-08-03 — claude/simplify-claude-md-cyfy4l

Branche : `claude/simplify-claude-md-cyfy4l`
Périmètre : fabrique
Mode : `chaud`

Condensation de `CLAUDE.md` — 55 455 → 41 489 octets, soit environ 3 900 jetons
économisés à chaque ouverture de session, sans qu'aucune règle, aucun piège ni
aucun vocabulaire fermé ne disparaisse.

## Anomalies

### 1. Le contrat portait deux fois la section « Les volumes nommés », et les deux versions divergeaient

**Symptôme** — `CLAUDE.md` contenait deux sections `## Les volumes nommés — ce qui
survit au redéploiement`, l'une aux lignes 354-451, l'autre aux lignes 786-832.
Ce n'était pas une simple copie : chacune portait des faits que l'autre n'avait
pas. La première donnait `chown 10001:10001` puis `USER 10001:10001`, décrivait la
portée exacte de l'avertissement `--check` (annexes bâties sur l'image de l'app
comprises) et la procédure de migration ; la seconde donnait `chown 10001` puis
`USER app`, précisait que deux apps produisant le même nom réel sont refusées **à
la génération** et non seulement au `--check`, et ajoutait le corollaire du nom
devenu global à l'hôte. Un lecteur tombant sur l'une ignorait ce que disait
l'autre.

**Cause** — le commit de fusion `07f7c7a` (« les capacites de la fabrique
rejoignent le travail de main ») a résolu un conflit en gardant les deux côtés. La
signature en est restée visible : la ligne 451 se terminait par `...n'est émis.` et
la ligne 452 enchaînait directement sur `## Comment on travaille`, sans ligne
vide — un raccord de fusion, pas une rédaction. Rien ne l'a vu ensuite : `--check`
lit bien `CLAUDE.md`, mais seulement pour y traquer les liens morts ; la CI a été
verte pendant toute la durée de vie du doublon, et la relecture de PR a porté sur
un diff, où deux blocs ajoutés loin l'un de l'autre ne se ressemblent pas.

**Detecte par** — `auteur`

**Action** — `garde-fou` — `--check` ouvre déjà `CLAUDE.md` pour ses liens morts :
y refuser deux titres `##` identiques coûte une ligne et ferme exactement ce mode
d'échec. Un contrat qui se contredit en deux endroits est pire qu'un contrat qui
se tait, parce qu'il donne raison à qui lit le mauvais.

### 2. J'ai cru que condenser la prose suffirait ; l'essentiel du gain était ailleurs

**Symptôme** — première passe de réécriture, faite en resserrant les paragraphes
section par section : 20 % de réduction seulement, alors que le texte était
devenu nettement plus sec. Le budget de coupe semblait épuisé.

**Cause** — j'avais traité le fichier comme un problème de style alors que c'était
un problème d'inventaire. Les vrais gisements n'étaient pas dans la longueur des
phrases mais dans du contenu qui n'avait plus lieu d'être : la section dupliquée
ci-dessus, la section `## Le rayon de souffle` qui ne faisait que résumer trois
garde-fous déjà expliqués chacun à sa place, et surtout la procédure de migration
« une stack qui a déjà tourné sans `name:` » — une vingtaine de lignes qui ne
peuvent **jamais** s'appliquer ici, puisque aucun volume n'existe aujourd'hui dans
la fabrique (ni dans les `app.yml`, ni dans `shared_services`, ni dans
`compose.yaml`) et que `init.sh` émet `name:` depuis le début. Vérifier l'état réel
du dépôt avant de couper a rapporté davantage que trois passes de réécriture.

**Detecte par** — `auteur`

**Action** — `comportement` — avant de condenser un document, en faire l'inventaire
et confronter chaque bloc à l'état du dépôt : ce qui est mort, ce qui est dupliqué
et ce qui n'est qu'un résumé se coupent sans perte, la prose ne se coupe qu'avec
perte.

### 3. Mon contrôle anti-régression échouait en silence sur les termes qui comptaient le plus

**Symptôme** — pour prouver qu'aucune règle n'avait disparu, j'ai bouclé sur une
liste de termes normatifs avec `grep -qF -- "$t"` dans l'ancien et le nouveau
fichier. Le contrôle a rendu « aucun manquant ». Il avait en réalité refusé de
traiter sept termes — `--check`, `--pret`, `--branche`, `--add`, `--dry-run`,
`--list`, `--enable` —, chacun pris pour une option de `grep`.

**Cause** — deux fautes qui se sont couvertes l'une l'autre. Le `--` séparateur
manquait dans la première version de la boucle, et surtout la sortie d'erreur de
`grep` partait sur `stderr` au milieu d'un flot de lignes vertes : le message
`unrecognized option` était visible, mais la ligne de conclusion, elle, disait
« aucun manquant » avec la même autorité que si les 97 termes avaient été
vérifiés. Un contrôle qui saute une entrée doit échouer, pas la compter comme
réussie — d'autant que les sept sautés étaient précisément les commandes du
contrat, celles dont la disparition aurait été la plus grave.

**Detecte par** — `auteur`

**Action** — `comportement` — un contrôle anti-régression doit rendre le nombre de
termes réellement comparés, pas seulement la liste des manquants. Sans ce compte,
« rien ne manque » et « rien n'a été vérifié » s'affichent de la même façon.

### 4. « Un titre en double est toujours un défaut » était faux, et le dépôt avait déjà le contre-exemple

**Symptôme** — en écrivant le garde-fou issu de l'anomalie 1, j'allais refuser deux
titres identiques **à n'importe quel niveau** dans un même document. Un relevé
préalable sur tous les `.md` du dépôt a rendu un cas : `apps/hello-world/DESIGN.md`
porte quatre fois `### Named Rules`. Le garde-fou aurait fait passer `--check` au
rouge sur un fichier parfaitement correct — et, la CI étant le verrou de tous les
autres jobs, aurait bloqué le dépôt entier sur un faux positif.

**Cause** — j'avais généralisé depuis un seul cas. Dans `CLAUDE.md`, le doublon
était deux **chapitres** revendiquant le même sujet ; dans `DESIGN.md`, c'est un
**sous-titre** répété sous quatre parents différents — « Named Rules » des couleurs,
de la typographie, des gabarits, des ombres — où la répétition est la structure même
du document et ne crée aucune ambiguïté. Ce qui rend deux sections contradictoires
n'est pas la répétition du texte, c'est le fait qu'elles soient au **même niveau**,
donc frères, donc concurrents. Le garde-fou ne vérifie plus que le niveau 2.

**Detecte par** — `auteur`

**Action** — `comportement` — avant d'écrire un garde-fou, passer le motif sur
l'ensemble du dépôt et regarder ce qu'il attrape déjà. Un contre-exemple légitime
trouvé avant coûte cinq minutes ; trouvé après, il coûte une CI rouge sur du travail
qui n'a rien fait de mal, et la confiance dans le contrôle avec.

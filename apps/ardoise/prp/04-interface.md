# PRP 04 — Interface

> Lis [`00-ossature.md`](00-ossature.md) d'abord. Dépend du PRP 03.
> **Branche :** `ardoise/interface`
> **Ce qui devient vrai :** un humain écrit sa ligne dans un navigateur, voit
> son adresse à côté, et lit d'où vient l'affichage.

---

## Objectif

Une page. Un champ, un bouton, une liste, et une mention de provenance. Servie
par le binaire lui-même — HTML, CSS et JS embarqués par `go:embed` — parce
qu'une image qui contient déjà son interface n'a besoin d'aucun volume, d'aucun
serveur de fichiers et d'aucun réglage.

## Ce que ce PRP met à l'épreuve dans le contrat

`ui: true`, et surtout l'**identité**. Le contrat est catégorique :
`X-Forwarded-User` est la **seule** source d'identité admissible — jamais un
identifiant fourni par le client, ni URL, ni corps de requête, ni cookie
applicatif. Traefik réécrit cet en-tête à chaque requête, il n'est donc pas
usurpable ; un champ « votre nom » dans le formulaire le serait.

En développement local, aucun Traefik ne pose l'en-tête. L'application affiche
alors `anonyme@local` — **une valeur qui se voit**, pas une chaîne vide qui
ressemblerait à un bogue.

## Tâches

### 1. Les tests avant le code

`api_test.go` :

| Test | Ce qu'il verrouille |
|---|---|
| `POST` sans `X-Forwarded-User` → auteur `anonyme@local` | pas de plantage hors Traefik |
| `POST` avec `X-Forwarded-User: a@b.c` **et** un champ `auteur` dans le corps → l'en-tête gagne | R3 |
| le texte rendu dans la page est échappé | pas d'injection HTML |

`e2e/` — Playwright, contre la stack réelle :

| Test | Le parcours |
|---|---|
| la page charge, le champ est focalisable | |
| écrire une ligne la fait apparaître en tête de liste | A8 du PRD |
| la provenance affichée passe de `base` à `cache` au rechargement | §5 |

### 2. Le front

`web/index.html`, `web/ardoise.css`, `web/ardoise.js`. Sans dépendance, sans
étape de construction : `go:embed web` suffit, et l'image ne gagne que le poids
des fichiers.

Ce que la page doit rendre lisible **sans explication** :

- la ligne qu'on vient d'écrire, en tête ;
- l'adresse de son auteur, à côté de chaque ligne ;
- la provenance de l'affichage — `base` ou `cache` — en clair, pas en jargon :
  « lu dans la base » / « lu dans le cache » ;
- un refus (ligne vide, plus de 140 caractères) énoncé en français, pas un code
  HTTP.

Le compteur de caractères restants est la seule fioriture admise : il évite un
aller-retour de refus, ce qui est de l'ergonomie et pas de la décoration.

### 3. Vérifier l'échappement

Le texte vient d'un humain authentifié, ce qui ne le rend pas sûr. Il est inséré
par `textContent`, jamais par `innerHTML`. Un test le verrouille, parce que la
régression est d'une ligne et passe la relecture.

## Critères d'acceptation

| # | Constat | Comment |
|---|---|---|
| 1 | La page charge et le parcours écrire → voir fonctionne | Playwright |
| 2 | L'auteur affiché est celui de l'en-tête, jamais du corps | test unitaire |
| 3 | `<script>` saisi s'affiche comme du texte | Playwright |
| 4 | La provenance est lisible par un non-technicien | lecture |
| 5 | `--check` vert, image toujours < 200 Mo | `./init.sh --check`, `docker image inspect` |

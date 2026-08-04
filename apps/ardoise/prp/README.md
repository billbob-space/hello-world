# Les PRP d'ardoise

Quatre documents d'implémentation, dérivés du PRD
[`docs/superpowers/specs/2026-08-04-ardoise-prd.md`](../../../docs/superpowers/specs/2026-08-04-ardoise-prd.md).

**Commence par [`00-ossature.md`](00-ossature.md).** C'est le contrat technique
commun — les trois services, les noms, le schéma, les routes, l'arborescence.
Aucun PRP ne s'exécute sans l'avoir lu, et aucun n'introduit un nom qui n'y
figure pas sans l'y déclarer.

| PRP | Branche | Ce qui devient vrai |
|---|---|---|
| [01](01-socle.md) | `ardoise/socle` | L'URL répond. L'image est publiée, `--check` est vert. |
| [02](02-donnees.md) | `ardoise/donnees` | Une ligne écrite survit à un redéploiement. |
| [03](03-cache.md) | `ardoise/cache` | La lecture passe par le cache, et l'écran dit d'où elle vient. |
| [04](04-interface.md) | `ardoise/interface` | Un humain écrit sa ligne dans un navigateur. |

## L'ordre d'exécution

```
01 socle ──> 02 donnees ──> 03 cache ──> 04 interface
```

Strictement séquentiel, et c'est rare. La raison est dans l'ossature §10 : un
cache se mesure contre une base, et une interface ne peut afficher une
provenance qui n'est pas encore calculée. Rien ici ne se parallélise sans
inventer un état intermédiaire que personne ne déploiera.

## Ce que ces PRP valident au-delà d'eux-mêmes

`ardoise` est une application de validation : chaque PRP exerce une partie du
contrat que rien n'exerçait.

| PRP | Chapitre du contrat mis à l'épreuve |
|---|---|
| 01 | `--add`, les deux commits, `enabled: false` comme protection |
| 02 | `services:`, `volumes:`, `env:`, le `chown` avant `USER` |
| 03 | `shared_services`, `needs:`, le rayon de souffle de `fabrique.yml` |
| 04 | `ui: true`, l'identité par `X-Forwarded-User` |

Les anomalies rencontrées ne vont pas dans ces documents : elles vont dans
`journal/`, avec leurs deux champs à vocabulaire fermé. Ces PRP décrivent ce
qu'il faut faire ; le journal décrit ce que ça a coûté d'apprendre.

# estran

URL : https://estran.apps.billbob.ovh — palier d'exposition : `private`.

## Ce que fait cette application

Météo marine et jauge de marée pour un seul secteur fixe, Le
Touquet-Paris-Plage / Étaples (coordonnées `50.517, 1.583`) : prévision horaire
du jour en cours (pluie, ensoleillement, température, vent, état de la mer),
jauge de marée (position entre basse et pleine mer, prochaine bascule),
graphe de pluie du jour (au quart d'heure quand un modèle à maille fine le
couvre, à l'heure sinon) doublé d'une bande de prévision immédiate sur les
soixante minutes qui viennent, et
tendance jusqu'à 16 jours avec vent journalier et indice de confiance. Le jour
regardé se choisit, de J-7 à J+15. Détail produit : `PRODUCT.md`. Décisions
techniques et arbitrages : `prp/00-ossature.md`, `prp/01-navigation-temporelle.md`,
`prp/02-horizon-confiance-vent.md`, `prp/03-graphe-de-pluie.md`.

## Sources de données

- Météo horaire et journalière : [Open-Meteo](https://open-meteo.com/en/docs)
  — publique, gratuite, sans clé. Un second appel au même fournisseur, avec
  `models=`, demande les mêmes grandeurs journalières à six modèles : leur
  dispersion donne l'indice de confiance. Cet appel ne peut jamais faire
  échouer la prévision — délai propre, échec journalisé, tendance servie sans
  indice.
- État de la mer (hauteur de vagues) : [Open-Meteo Marine](https://open-meteo.com/en/docs/marine-weather-api)
  — même fournisseur, sans clé.
- Graphe de pluie du jour : [Open-Meteo](https://open-meteo.com/en/docs) à
  nouveau, mais deux appels distincts de celui de la prévision horaire —
  `minutely_15=precipitation` **forcé sur `models=meteofrance_arome_france_hd`**
  (maille 1,5 km), et `hourly=precipitation` sur toute la fenêtre de navigation
  comme repli. Le `models=` explicite est le point important : sans lui, le
  fournisseur rend du quart d'heure sur seize jours **sans un seul `null`**, en
  interpolant depuis l'horaire au-delà de la portée d'un modèle fin et sans le
  signaler. Forcé sur ce modèle, il s'arrête net et rend `null` : la fenêtre du
  vrai quart d'heure se lit dans la donnée, au lieu d'être un seuil codé en
  dur. Détail : `prp/03-graphe-de-pluie.md`.
- Prévision immédiate de pluie (les 60 minutes qui viennent, par pas de 5 puis
  10 minutes) : **Météo-France**, sur le point `Le Touquet-Paris-Plage`. Elle
  passe par l'adresse qu'appelle leur application mobile, avec le jeton public
  que celle-ci embarque — pas par un contrat d'API : gratuite, sans
  inscription, et **sans garantie**. Arbitrage assumé, soumis à l'utilisateur
  avant écriture ; sa panne fait disparaître la bande de l'heure et rien
  d'autre. Ce jeton n'est pas un secret et ne se déclare pas en `env:` : il est
  identique pour tous les utilisateurs de l'application distribuée, et écrit en
  clair dans `pluie.go`.
- Marée : [api-maree.fr](https://api-maree.fr) — gratuite avec une clé
  d'inscription (pas d'abonnement payant), sur le site `berck-plage-fort-mahon`
  (Étaples/Le Touquet n'existent pas dans leur catalogue ; c'est le point
  disponible le plus proche — voir `prp/00-ossature.md` pour la mesure de cet
  écart).

## Développement

```bash
cd apps/estran
go run .            # ecoute sur :8080
./test.sh           # go vet + go test
```

Aucune donnée persistante : rien n'est écrit sur disque, pas de volume.

## Variables d'environnement

| Nom | Obligatoire | Rôle |
|---|---|---|
| `PORT` | non (défaut `8080`) | port d'écoute HTTP |
| `API_MAREE_KEY` | non | clé api-maree.fr. **Absente, la jauge de marée affiche « configuration requise »** plutôt qu'une erreur — le reste de l'application (météo, tendance) fonctionne normalement sans elle. À obtenir par inscription gratuite sur [api-maree.fr](https://api-maree.fr), puis à poser côté serveur (jamais dans ce dépôt). |

## Dégradation

Au bord de la fenêtre (16e jour), Open-Meteo rend `null` plutôt que des
valeurs : ces absences sont décodées comme telles jusqu'au JSON de sortie. Un
jour ou une heure sans température n'est pas affiché, une grandeur secondaire
absente laisse sa ligne de côté — jamais un zéro, qui serait crédible et faux.

La section Pluie dégrade en trois temps : la bande de l'heure tombe et la
courbe du jour reste (aucun message — cette prévision est un supplément) ; la
série fine tombe, ou le jour regardé sort de la portée du modèle à maille
fine, et la courbe passe au pas horaire en le disant ; les deux tombent, et la
section seule affiche son indisponibilité. Une couverture fine **partielle**
sur un jour — le cas du jour où le modèle s'arrête en cours de route — retombe
sur l'horaire entier plutôt que d'afficher une courbe tronquée en milieu de
journée, qui se lirait « plus rien après ».

Un fournisseur externe indisponible ne casse pas l'application : la dernière
réponse réussie est resservie (avec `frais: false` dans la réponse JSON), et
à froid (jamais interrogé avec succès) la section concernée l'affiche
explicitement plutôt que d'inventer une valeur. `/healthz` ne dépend d'aucun
fournisseur externe.

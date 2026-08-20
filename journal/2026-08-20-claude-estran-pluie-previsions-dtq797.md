# 2026-08-20 — claude/estran-pluie-previsions-dtq797

Branche : `claude/estran-pluie-previsions-dtq797`
Périmètre : estran
Mode : `chaud`

## Anomalies

### 1. Le pourcentage des vignettes horaires se lit comme une quantite de pluie

**Symptome** — l'utilisateur signale une incoherence : la courbe de la section
pluie annonce 0 mm pour tout l'apres-midi du 20 aout, tandis que les vignettes
« les prochaines heures » affichent 98 %, 100 %, 98 % sur les memes heures. La
bande de la prochaine heure (Meteo-France) dit « temps sec ». Verifie en direct
sur les trois sources : aucune ne se trompe.

**Cause** — trois sources alimentent la meme page et deux d'entre elles ne
mesurent pas la meme grandeur. Les millimetres viennent du modele a maille fine
(AROME 1,5 km, `pluie.go`) ; le pourcentage vient de `precipitation_probability`
du « best match » d'Open-Meteo (`meteo.go`), qui est en fait ICON — verifie en
interrogeant les modeles un par un : ICON rend exactement 98/100/98/73/58, AROME
et meteofrance_seamless ne rendent pas ce champ du tout. C'est une probabilite
d'ensemble (« au moins un membre depose 0,1 mm sur cette heure »), incoherente
avec la quantite deterministe du meme modele : ICON annonce lui aussi 0,0 mm sur
ces heures-la. A l'ecran, ce chiffre etait rendu par une goutte et un « % », sans
un mot pour dire que c'etait un risque.

**Detecte par** — `utilisateur`

**Action** — `comportement` — quand deux sources de grandeurs differentes
alimentent le meme ecran, l'unite de chacune doit etre ecrite a l'ecran, pas
seulement dans le code ; aucun test ne voit un chiffre affiche sans son unite.

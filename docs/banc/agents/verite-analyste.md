# Verite du banc analyste — mesurable par awk, verifiee deux fois

56 entrees · 381 anomalies (= nombre de `^### `, = nombre de `**Detecte par**`)

Detecte par : auteur 185 · relecture 70 · utilisateur 58 · test 30 · CI 26 · production 9 · compilateur 3
Action      : garde-fou 107 · comportement 90 · rien 82 · contrat 48 · arbitrage 43 · outillage 11
Mode        : chaud 55 · retrospective 1  → 1/56 entrees, 10/381 anomalies

Piege : « CI » est en MAJUSCULES, les six autres en minuscules. Un depouillement
qui filtre sur [a-z] rend 355 au lieu de 381 et perd une valeur entiere.
(Je suis moi-meme tombe dedans en preparant ce banc ; c'est un agent qui l'a vu.)

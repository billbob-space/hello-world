<!-- Une pull request se lit en trente secondes. Elle sert a decider s'il faut
     relire et par ou commencer — le raisonnement, lui, vit dans les messages de
     commit, ou il reste attache au changement qu'il explique. -->

<!-- Une phrase : ce que ce changement fait. -->

## Ce qui compte

<!-- Trois a cinq puces, la plus importante en premier. Ce qu'un relecteur doit
     savoir pour juger — pas la liste de ce qui a ete fait, le diff la montre
     deja. Mets en gras le mot qui porte l'idee de chaque puce. -->

## Verifie

<!-- Une ou deux lignes : ce qui a ete lance, et le resultat. Des nombres
     plutot que des adjectifs. -->

## Revue

<!-- OBLIGATOIRE, et la CI le verifie sur les pull requests. Deux lignes, une par
     relecteur, chacune datee. Les cinq axes outilles (securite, dependances,
     qualite, couverture, duplication) sont deja verts par construction — la CI
     les bloque — donc n'en parle pas ici : cette section porte sur ce qu'aucun
     outil ne voit.

     Code — agent `relecteur`, lance sur la branche entiere avant cette PR.
     Ecris ce qu'il a trouve et ce qui en a ete fait. « Aucun constat » est une
     reponse valable ; « non lance » n'en est pas une.

     UX/UI — agent `esthete`, seulement si des ECRANS ont bouge. Sa critique vit
     dans `apps/<nom>/.impeccable/critique/`, et elle doit etre plus recente que
     le dernier changement d'ecran. Ce qui a ete tranche par l'utilisateur va
     dans le `PRODUCT.md` de l'app, retenu ET ecarte.

     Un constat ecarte se dit ici avec sa raison. Un constat tu n'est pas
     ecarte : il est cache. -->

- **Code** — `relecteur`, le AAAA-MM-JJ :
- **UX/UI** — `esthete`, le AAAA-MM-JJ : <!-- ou « aucun ecran touche » -->

## Avant de fusionner

<!-- Supprime cette section s'il n'y a rien a signaler. Sinon : points
     d'attention, gestes cote serveur, ce qui n'est pas couvert par la CI. -->

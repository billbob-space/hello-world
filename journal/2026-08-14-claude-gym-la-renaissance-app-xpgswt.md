# 2026-08-14 — claude/gym-la-renaissance-app-xpgswt


Branche : `claude/gym-la-renaissance-app-xpgswt`
Périmètre : renaissance-gym
Mode : `chaud`

## Anomalies

Création de `renaissance-gym` : PRD puis PRP puis code, pour l'app de suivi du
programme de vacances de La Renaissance Gymnastique de Marcq-en-Barœul. Deux
feuilles papier (36 exercices × 8 semaines) transposées en séance du jour
guidée. Palier `public`, compte `pseudo` + code à 6 chiffres, progression
sauvegardée côté serveur dans un volume nommé.

### 1. Le brief initial a changé de socle en cours de cadrage

**Symptome** — le design présenté et approuvé (« tout reste sur le téléphone,
aucun serveur ne connaît quoi que ce soit ») a été invalidé par la demande
suivante de l'utilisateur : progression enregistrée côté serveur, avec le
mécanisme d'authentification par code de `marcq-handball`. Le palier
d'exposition, le volume nommé, l'API et la moitié des écrans en dépendaient.

**Cause** — la question « qui utilise l'app » a été posée, et sa réponse
(« ta fille seule ») a été lue comme répondant aussi à « où vivent les
données ». Les deux sont indépendantes : une app mono-utilisatrice a besoin
d'un serveur dès lors qu'elle change d'appareil. La question du multi-appareil
n'a jamais été posée.

**Detecte par** — `utilisateur`

**Action** — `comportement` — au cadrage, séparer « combien d'utilisateurs » de
« combien d'appareils » : c'est la seconde qui décide du serveur.

### 2. L'artisan part en tâche de fond malgré `run_in_background: false`

**Symptome** — l'agent `artisan` a été lancé avec `run_in_background: false`,
explicitement, et le harnais l'a néanmoins démarré en tâche de fond : « Async
agent launched successfully », avec la consigne de ne pas toucher aux mêmes
fichiers en attendant. Or `memory/travail.md` pose que l'artisan « ne se lance
JAMAIS en tâche de fond », précisément parce qu'il écrit dans le dépôt pendant
qu'on y travaille.

**Cause** — le paramètre est une préférence, pas une garantie : la description
de l'outil dit que les sous-agents tournent en fond « par défaut » et que
`run_in_background: false` ne s'impose que si l'étape suivante en dépend
strictement. Le contrat du dépôt, lui, énonce une interdiction que rien dans le
harnais n'applique. La définition de l'agent (`.claude/agents/artisan.md`) ne
peut pas non plus la faire respecter : aucun champ n'exprime cette contrainte.

**Detecte par** — `auteur`

**Action** — `contrat` — `memory/travail.md` affirme une garantie qui n'existe
pas. Le texte doit dire ce qui est vrai : le lancement en fond ne peut pas être
empêché, donc la règle réelle est « n'édite rien dans `apps/<nom>/` tant qu'un
artisan y travaille », qui est une consigne pour l'appelant et non une propriété
de l'agent.

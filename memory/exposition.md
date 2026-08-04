# Les trois paliers d’exposition — le détail

Quand lire : avant de changer l'`exposure` d'une app, avant de lire une
identité d’utilisateur, et avant tout choix de palier `public`.
Tenu par : --check — middleware du palier service par service, lecture de
`X-Forwarded-User` refusée en `exposure: public`, avertissement sur tout palier
public

En `private` et `google`, l'identité de l'utilisateur arrive dans l'en-tête
**`X-Forwarded-User`** (son adresse e-mail). Traefik le **réécrit à chaque requête**,
il n'est donc pas usurpable.

**Ne code pas de système de comptes.** Pour cloisonner des données par utilisateur,
`X-Forwarded-User` est la **seule** source d'identité admissible — jamais un
identifiant fourni par le client (URL, corps de requête, cookie applicatif). En palier
`google`, ce cloisonnement n'est pas optionnel : n'importe qui peut se connecter.

**Ce que `public` implique — à lire avant de le choisir.** Aucune authentification
n'a lieu, **donc Traefik ne pose ni n'écrase `X-Forwarded-User`** : l'en-tête devient
entièrement contrôlé par le client, et une app qui le lirait croirait identifier un
utilisateur sur une valeur forgée. `--check` **refuse** une app qui lit
`X-Forwarded-User` en `exposure: public`. Quatre contraintes non négociables en
découlent :

- **Pas d'état par utilisateur côté serveur** — ni compte, ni session, ni données
  nominatives. Ce qui est propre à un visiteur reste sur son appareil
  (`localStorage`, `IndexedDB`).
- **Rien de sensible ne transite** — clés d'API tierces comprises. Tout ce que le
  navigateur reçoit est, par construction, public.
- **Le rate-limit n'est pas une protection** — le palier en pose un (50 req/s par IP,
  rafale 100), mais l'app doit encaisser du trafic non sollicité.
- **L'URL finira par être trouvée.** Ne compte jamais sur le fait qu'elle n'est pas
  publiée.


Une app publique voisine d’apps privées ne les expose pas : chaque routeur porte son
propre middleware, et `--check` le vérifie service par service.

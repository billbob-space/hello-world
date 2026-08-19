// apps/ramure-v2/web/src/session.ts
//
// Le jeton de session cote client (N-09, N-10) : un identifiant OPAQUE,
// SANS AUCUN RAPPORT avec l'identite Google de l'utilisateur
// (X-Forwarded-User, lu UNIQUEMENT cote serveur, jamais ici). Il ne fait
// que regrouper les evenements d'un meme onglet de navigateur pour
// l'agregat de mesure serveur (internal/mesure) ; le perdre ne revele
// rien de personnel.
const CLE_SESSION = "ramure:session";

function jetonAleatoire(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Repli si crypto.randomUUID est absent : un jeton opaque suffisant
  // pour regrouper des evenements, jamais un identifiant cryptographique.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** sessionId() rend un jeton STABLE pour la duree de l'onglet
 * (sessionStorage, jamais localStorage : une session ne doit pas
 * survivre a la fermeture de l'onglet), cree au premier appel. */
export function sessionId(stockage: Storage): string {
  try {
    const existant = stockage.getItem(CLE_SESSION);
    if (existant) return existant;
    const nouveau = jetonAleatoire();
    stockage.setItem(CLE_SESSION, nouveau);
    return nouveau;
  } catch {
    // Stockage indisponible (navigation privee stricte) : un jeton
    // ephemere, different a chaque appel, degrade seulement la mesure —
    // jamais l'application.
    return jetonAleatoire();
  }
}

/** EN_TETE_SESSION doit correspondre EXACTEMENT a internal/api.EnTeteSession
 * (mesure_api.go) : c'est le seul contrat entre les deux cotes. */
export const EN_TETE_SESSION = "X-Ramure-Session";

// ---------------------------------------------------------------------
// Session Traefik expiree (F-41, PRP 08) — le cas propre a cette fabrique
// ---------------------------------------------------------------------

/** SessionExpireeError distingue "la session a expire" de toute autre
 * panne reseau (§09) : un `catch` generique ne doit JAMAIS confondre les
 * deux, sous peine d'afficher "reessaie" a quelqu'un qui doit en realite
 * se reconnecter (le defaut le plus deroutant possible, PRP 08). */
export class SessionExpireeError extends Error {
  constructor() {
    super("ramure-v2 : session expiree (redirection Traefik detectee)");
    this.name = "SessionExpireeError";
  }
}

/** Le sous-ensemble de Response necessaire au diagnostic — duck-type
 * plutot que le DOM `Response` global : testable avec de simples objets
 * litteraux, sans fetch ni jsdom (aucun appel reseau dans les tests). */
export interface ReponseDiagnosticable {
  readonly type?: string;
  readonly redirected: boolean;
  readonly url: string;
  readonly headers: { get(nom: string): string | null };
}

// estReponseSessionExpiree (F-41) : Traefik repond a une session expiree
// par une redirection vers Google — fetch() la SUIT en silence (jamais un
// evenement que le code applicatif peut intercepter directement) et rend
// soit une reponse "opaqueredirect"/"opaque" (mode `redirect: "manual"`,
// non utilise ici mais couvert par prudence), soit une reponse 200 dont
// l'URL finale n'est plus celle demandee et dont le corps est la page de
// connexion Google — jamais le JSON attendu. Les DEUX signaux sont
// verifies : l'origine de la reponse APRES redirection, et le
// Content-Type reellement recu, qui vaut text/html au lieu
// d'application/json des que Traefik a intercepte la requete.
export function estReponseSessionExpiree(
  reponse: ReponseDiagnosticable,
  origineAttendue: string,
): boolean {
  if (reponse.type === "opaqueredirect" || reponse.type === "opaque") {
    return true;
  }
  if (reponse.redirected) {
    try {
      if (new URL(reponse.url).origin !== origineAttendue) {
        return true;
      }
    } catch {
      // URL illisible : pas assez d'information pour conclure sur ce seul
      // critere, le Content-Type ci-dessous tranche.
    }
  }
  const typeContenu = reponse.headers.get("content-type") ?? "";
  return typeContenu.includes("text/html") && !typeContenu.includes("application/json");
}

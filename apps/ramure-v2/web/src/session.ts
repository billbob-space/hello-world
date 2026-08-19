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

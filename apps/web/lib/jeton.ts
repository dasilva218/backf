/**
 * Lecture de la charge utile du JWT émis par l'API, SANS vérifier sa
 * signature : le secret n'existe que côté API, et ce front ne doit pas le
 * détenir. Cette lecture ne sert qu'aux décisions optimistes (rediriger vers
 * la connexion, choisir un écran). C'est l'API qui authentifie réellement
 * chaque appel — un jeton forgé ici n'ouvrirait aucune donnée.
 *
 * Volontairement sans `server-only` : `proxy.ts` l'importe aussi.
 */

export const NOM_COOKIE_SESSION = "fd_session";

export interface ChargeJeton {
  sub: string;
  email: string;
  role: "CLIENT" | "LIVREUR" | "ADMIN";
  /** Expiration, en secondes depuis l'époque Unix. */
  exp: number;
}

export function lireChargeJeton(jeton: string | undefined): ChargeJeton | null {
  if (!jeton) return null;
  const partie = jeton.split(".")[1];
  if (!partie) return null;
  try {
    const base64 = partie.replace(/-/g, "+").replace(/_/g, "/");
    const charge = JSON.parse(atob(base64)) as Partial<ChargeJeton>;
    if (!charge.sub || !charge.role || typeof charge.exp !== "number") return null;
    return charge as ChargeJeton;
  } catch {
    return null;
  }
}

/** Expiré, ou à moins de 10 s de l'être : inutile d'envoyer un appel voué au 401. */
export function jetonExpire(charge: ChargeJeton, maintenant = Date.now()): boolean {
  return charge.exp * 1000 <= maintenant + 10_000;
}

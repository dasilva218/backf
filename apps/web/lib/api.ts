import "server-only";

import { redirect } from "next/navigation";
import { exigerSession } from "@/lib/session";

/**
 * Client de l'API find_delivery, côté serveur uniquement.
 *
 * `API_URL` n'est PAS une variable `NEXT_PUBLIC_*` : le navigateur n'appelle
 * jamais l'API directement (voir session.ts), il n'a donc pas à connaître son
 * adresse.
 */

const TIMEOUT_MS = 15_000;

function urlApi(): string {
  const url = process.env.API_URL;
  if (url) return url.replace(/\/+$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:3001/api/v1";
  throw new Error("API_URL n'est pas configurée");
}

export type ReponseApi<T> =
  | { ok: true; statut: number; donnees: T }
  | { ok: false; statut: number; message: string };

/**
 * Message lisible depuis une erreur NestJS. Le `ValidationPipe` renvoie un
 * TABLEAU de messages ; les autres exceptions, une chaîne.
 */
function messageErreur(corps: unknown, statut: number): string {
  const message = (corps as { message?: unknown } | null)?.message;
  if (Array.isArray(message) && message.length > 0) return message.join(" · ");
  if (typeof message === "string" && message) return message;
  if (statut === 429) return "Trop de requêtes. Patientez une minute puis réessayez.";
  return "Le service est momentanément indisponible. Réessayez dans un instant.";
}

async function appeler<T>(
  chemin: string,
  init: { methode?: string; corps?: unknown; jeton?: string },
): Promise<ReponseApi<T>> {
  let reponse: Response;
  try {
    reponse = await fetch(`${urlApi()}${chemin}`, {
      method: init.methode ?? "GET",
      headers: {
        ...(init.jeton ? { Authorization: `Bearer ${init.jeton}` } : {}),
        ...(init.corps !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.corps !== undefined ? JSON.stringify(init.corps) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (erreur) {
    console.error(`[api] ${init.methode ?? "GET"} ${chemin} injoignable:`, (erreur as Error).message);
    return {
      ok: false,
      statut: 0,
      message: "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.",
    };
  }

  const texte = await reponse.text();
  let corps: unknown = null;
  try {
    corps = texte ? JSON.parse(texte) : null;
  } catch {
    corps = null;
  }

  if (!reponse.ok) {
    return { ok: false, statut: reponse.status, message: messageErreur(corps, reponse.status) };
  }
  return { ok: true, statut: reponse.status, donnees: corps as T };
}

/** Appel sans session : connexion, inscription, grille des prix. */
export function appelerApiPublique<T>(chemin: string, methode = "GET", corps?: unknown) {
  return appeler<T>(chemin, { methode, corps });
}

/**
 * Appel au nom de la boutique connectée.
 *
 * Un 401 malgré un jeton non expiré (secret changé côté API, compte
 * désactivé) mène à `/deconnexion` : rien de ce qu'affiche la page ne serait
 * de toute façon accessible.
 */
export async function appelerApi<T>(
  chemin: string,
  init: { methode?: string; corps?: unknown } = {},
): Promise<ReponseApi<T>> {
  const { jeton } = await exigerSession();
  const resultat = await appeler<T>(chemin, { ...init, jeton });
  if (!resultat.ok && resultat.statut === 401) redirect("/deconnexion?motif=expiree");
  return resultat;
}

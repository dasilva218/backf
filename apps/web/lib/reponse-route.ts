import "server-only";

import { NextResponse } from "next/server";
import type { ReponseApi } from "@/lib/api";

/**
 * Relaie au navigateur la réponse de l'API, pour les Route Handlers du suivi
 * en direct. Jamais mise en cache : une position d'il y a une minute servie
 * par un cache serait présentée comme actuelle.
 */
export function relayer<T>(reponse: ReponseApi<T>): NextResponse {
  const enTetes = { "Cache-Control": "no-store" };
  if (reponse.ok) return NextResponse.json(reponse.donnees, { headers: enTetes });
  // Statut 0 = API injoignable depuis le serveur Next.
  return NextResponse.json({ message: reponse.message }, { status: reponse.statut || 503, headers: enTetes });
}

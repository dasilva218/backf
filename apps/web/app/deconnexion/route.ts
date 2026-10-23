import { NextResponse, type NextRequest } from "next/server";
import { fermerSession } from "@/lib/session";

/**
 * Efface la session puis renvoie vers la connexion, avec le motif.
 *
 * Route Handler et non page : un Server Component ne peut pas supprimer de
 * cookie. Utilisée pour les sessions expirées ou d'un mauvais rôle ; la
 * déconnexion volontaire passe par la Server Action `seDeconnecter`.
 */
export async function GET(requete: NextRequest) {
  await fermerSession();
  const motif = requete.nextUrl.searchParams.get("motif");
  const cible = new URL("/connexion", requete.nextUrl);
  if (motif === "expiree" || motif === "role") cible.searchParams.set("motif", motif);
  return NextResponse.redirect(cible);
}

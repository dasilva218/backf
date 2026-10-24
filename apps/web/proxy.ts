import { NextResponse, type NextRequest } from "next/server";
import { NOM_COOKIE_SESSION, jetonExpire, lireChargeJeton } from "@/lib/jeton";

/** Miroir de `ACCUEIL_PAR_ROLE` (lib/session.ts, `server-only`, non importable ici). */
const ACCUEIL: Record<string, string> = { CLIENT: "/courses", ADMIN: "/admin" };

/**
 * Aiguillage OPTIMISTE, sur la seule lecture du cookie : pas d'appel à l'API
 * ici, le proxy s'exécute sur chaque navigation, préchargements compris. La
 * vraie barrière est l'API, qui vérifie la signature de chaque jeton ; les
 * pages repassent en plus par `exigerSession()`.
 */

const PAGES_INVITE = ["/connexion", "/inscription"];
/** Ouvertes à tous, connecté ou non : la page d'accueil adapte son menu. */
const PAGES_PUBLIQUES = ["/"];

export default function proxy(requete: NextRequest) {
  const chemin = requete.nextUrl.pathname;
  const charge = lireChargeJeton(requete.cookies.get(NOM_COOKIE_SESSION)?.value);
  const role = charge && !jetonExpire(charge) ? charge.role : null;
  const accueil = role ? ACCUEIL[role] : undefined;

  // `/deconnexion` passe toujours : c'est elle qui efface un cookie périmé.
  if (chemin.startsWith("/deconnexion") || PAGES_PUBLIQUES.includes(chemin)) {
    return NextResponse.next();
  }

  const pageInvite = PAGES_INVITE.some((p) => chemin.startsWith(p));

  if (!accueil) {
    return pageInvite ? NextResponse.next() : NextResponse.redirect(new URL("/connexion", requete.nextUrl));
  }
  if (pageInvite) {
    return NextResponse.redirect(new URL(accueil, requete.nextUrl));
  }
  // Chaque rôle reste dans son espace : un client n'a rien sous /admin, un
  // admin n'a pas de « mes courses » de client.
  const espaceAdmin = chemin === "/admin" || chemin.startsWith("/admin/");
  if (espaceAdmin !== (role === "ADMIN")) {
    return NextResponse.redirect(new URL(accueil, requete.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|woff2?)$).*)"],
};

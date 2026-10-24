import { NextResponse, type NextRequest } from "next/server";
import { NOM_COOKIE_SESSION, jetonExpire, lireChargeJeton } from "@/lib/jeton";

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
  const connecte = !!charge && !jetonExpire(charge) && charge.role === "CLIENT";

  // `/deconnexion` passe toujours : c'est elle qui efface un cookie périmé.
  if (chemin.startsWith("/deconnexion") || PAGES_PUBLIQUES.includes(chemin)) {
    return NextResponse.next();
  }

  const pageInvite = PAGES_INVITE.some((p) => chemin.startsWith(p));

  if (!connecte && !pageInvite) {
    return NextResponse.redirect(new URL("/connexion", requete.nextUrl));
  }
  if (connecte && pageInvite) {
    return NextResponse.redirect(new URL("/courses", requete.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|woff2?)$).*)"],
};

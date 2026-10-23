import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  NOM_COOKIE_SESSION,
  jetonExpire,
  lireChargeJeton,
} from "@/lib/jeton";

/**
 * Session de la boutique : le JWT de l'API, dans un cookie httpOnly.
 *
 * Le jeton n'est jamais exposé au JavaScript du navigateur — un script injecté
 * ne peut pas le lire. Tous les appels à l'API partent donc du serveur Next
 * (Server Components et Server Actions), jamais du navigateur.
 *
 * L'API ne délivre pas de jeton de rafraîchissement : la session dure ce que
 * dure le JWT (`JWT_EXPIRES_IN`, 30 min par défaut), puis il faut se
 * reconnecter. Le cookie expire au même instant que le jeton.
 */

export async function ouvrirSession(jeton: string): Promise<void> {
  const charge = lireChargeJeton(jeton);
  (await cookies()).set(NOM_COOKIE_SESSION, jeton, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(charge ? { expires: new Date(charge.exp * 1000) } : {}),
  });
}

export async function fermerSession(): Promise<void> {
  (await cookies()).delete(NOM_COOKIE_SESSION);
}

/**
 * Session de boutique valide, ou `null` — sans rediriger. Pour les pages
 * publiques qui adaptent seulement leur menu : lecture optimiste, aucune
 * donnée n'en dépend.
 */
export async function lireSessionOptimiste(): Promise<{ email: string } | null> {
  const charge = lireChargeJeton((await cookies()).get(NOM_COOKIE_SESSION)?.value);
  if (!charge || jetonExpire(charge) || charge.role !== "BOUTIQUE") return null;
  return { email: charge.email };
}

/**
 * Exige une session de boutique valide, sinon redirige.
 *
 * Mémoïsée par rendu (`cache`) : le layout et la page l'appellent tous deux
 * sans relire le cookie. Un jeton expiré ou d'un autre rôle passe par
 * `/deconnexion`, qui seul peut effacer le cookie depuis un rendu — sans quoi
 * `proxy.ts` renverrait aussitôt vers l'espace, en boucle.
 */
export const exigerSession = cache(async () => {
  const jeton = (await cookies()).get(NOM_COOKIE_SESSION)?.value;
  const charge = lireChargeJeton(jeton);

  if (!jeton || !charge) redirect("/connexion");
  if (jetonExpire(charge)) redirect("/deconnexion?motif=expiree");
  if (charge.role !== "BOUTIQUE") redirect("/deconnexion?motif=role");

  return { jeton, email: charge.email };
});

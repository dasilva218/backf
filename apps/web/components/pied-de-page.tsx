import Link from "next/link";
import { Logo } from "@/components/logo";

export const LIENS_LEGAUX = [
  { href: "/conditions-utilisation", libelle: "Conditions d'utilisation" },
  { href: "/confidentialite", libelle: "Politique de confidentialité" },
  { href: "/mentions-legales", libelle: "Mentions légales" },
];

/** Pied de page public : accueil et pages légales. */
export function PiedDePage() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 text-sm text-muted-foreground">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <Link href="/" aria-label="find_delivery, accueil">
            <Logo className="text-foreground" />
          </Link>
          <p>Livraisons dans le Grand Libreville, Gabon</p>
        </div>
        <nav aria-label="Informations légales" className="border-t pt-6">
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 sm:justify-start">
            {LIENS_LEGAUX.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-foreground hover:underline underline-offset-4">
                  {l.libelle}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}

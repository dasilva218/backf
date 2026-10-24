"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "#fonctionnement", libelle: "Comment ça marche" },
  { href: "#tarifs", libelle: "Tarifs" },
  { href: "#zones", libelle: "Zones" },
  { href: "#questions", libelle: "Questions" },
];

/**
 * Menu de la page d'accueil. Les boutons d'action suivent la session : un
 * visiteur voit « Connexion / Créer un compte », un client connecté va
 * droit à ses courses.
 */
export function MenuAccueil({ connecte }: { connecte: boolean }) {
  const [ouvert, setOuvert] = useState(false);

  // Échap referme le panneau mobile, comme tout menu déroulant.
  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [ouvert]);

  const actions = connecte ? (
    <>
      <Button asChild variant="ghost">
        <Link href="/courses">Mes courses</Link>
      </Button>
      <Button asChild>
        <Link href="/courses/nouvelle">Nouvelle course</Link>
      </Button>
    </>
  ) : (
    <>
      <Button asChild variant="ghost">
        <Link href="/connexion">Connexion</Link>
      </Button>
      <Button asChild>
        <Link href="/inscription">Créer un compte</Link>
      </Button>
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" aria-label="find_delivery, accueil">
          <Logo />
        </Link>

        <nav aria-label="Sections de la page" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {s.libelle}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">{actions}</div>

        <Button
          variant="ghost"
          size="icon"
          className="ml-auto md:hidden"
          aria-expanded={ouvert}
          aria-controls="menu-mobile"
          aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={() => setOuvert((o) => !o)}
        >
          {ouvert ? <X /> : <Menu />}
        </Button>
      </div>

      <div
        id="menu-mobile"
        hidden={!ouvert}
        className={cn("border-t bg-background md:hidden", ouvert && "animate-in fade-in-0 slide-in-from-top-2")}
      >
        <nav aria-label="Sections de la page" className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
          {SECTIONS.map((s) => (
            <a
              key={s.href}
              href={s.href}
              onClick={() => setOuvert(false)}
              className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent"
            >
              {s.libelle}
            </a>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2 border-t pt-3 [&>*]:w-full">{actions}</div>
        </nav>
      </div>
    </header>
  );
}

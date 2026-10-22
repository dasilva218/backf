"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LIENS = [
  { href: "/courses", libelle: "Mes courses", actif: (c: string) => c === "/courses" || /^\/courses\/(?!nouvelle)/.test(c) },
  { href: "/courses/nouvelle", libelle: "Nouvelle course", actif: (c: string) => c === "/courses/nouvelle" },
  { href: "/profil", libelle: "Profil", actif: (c: string) => c.startsWith("/profil") },
];

export function NavigationEspace() {
  const chemin = usePathname();

  return (
    <nav aria-label="Navigation principale" className="order-last -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
      {LIENS.map((lien) => {
        const actif = lien.actif(chemin);
        return (
          <Link
            key={lien.href}
            href={lien.href}
            aria-current={actif ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent",
              actif ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
          >
            {lien.libelle}
          </Link>
        );
      })}
    </nav>
  );
}

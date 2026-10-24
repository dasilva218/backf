"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Banknote, Package, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

const LIENS = [
  { href: "/admin/livreurs", libelle: "Livreurs", icone: UsersRound },
  { href: "/admin/especes", libelle: "Espèces", icone: Banknote },
  { href: "/admin/courses", libelle: "Courses", icone: Package },
];

/** Colonne dans la barre latérale (md et plus), ligne défilante en haut sur mobile. */
export function NavigationAdmin({ orientation }: { orientation: "colonne" | "ligne" }) {
  const chemin = usePathname();

  return (
    <nav
      aria-label="Navigation de l'administration"
      className={cn("flex gap-1", orientation === "colonne" ? "flex-col" : "-mx-1 overflow-x-auto")}
    >
      {LIENS.map(({ href, libelle, icone: Icone }) => {
        const actif = chemin === href || chemin.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={actif ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              actif ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
          >
            <Icone className={cn("size-4", actif && "text-primary")} aria-hidden />
            {libelle}
          </Link>
        );
      })}
    </nav>
  );
}

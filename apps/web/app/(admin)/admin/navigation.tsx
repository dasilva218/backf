"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LIENS = [
  { href: "/admin/livreurs", libelle: "Livreurs" },
  { href: "/admin/especes", libelle: "Espèces" },
  { href: "/admin/courses", libelle: "Courses" },
];

export function NavigationAdmin() {
  const chemin = usePathname();

  return (
    <nav aria-label="Navigation de l'administration" className="order-last -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
      {LIENS.map((lien) => {
        const actif = chemin === lien.href || chemin.startsWith(`${lien.href}/`);
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

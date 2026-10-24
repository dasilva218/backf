import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { seDeconnecter } from "@/app/actions/auth";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { exigerSession } from "@/lib/session";
import { NavigationAdmin } from "./navigation";

export const metadata: Metadata = { title: { default: "Administration", template: "%s · Administration" } };

function Marque() {
  return (
    <Link href="/admin" aria-label="Administration find_delivery" className="flex items-center gap-2">
      <Logo />
      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">Admin</span>
    </Link>
  );
}

function Deconnexion({ compact }: { compact?: boolean }) {
  return (
    <form action={seDeconnecter}>
      <Button type="submit" variant="ghost" size="sm" className={compact ? undefined : "w-full justify-start"}>
        <LogOut aria-hidden />
        <span className={compact ? "sr-only" : undefined}>Déconnexion</span>
      </Button>
    </form>
  );
}

/**
 * L'espace du bureau find_delivery : dossiers des livreurs, espèces, courses.
 * Barre latérale fixe à partir de md ; en dessous, un bandeau avec la même navigation.
 */
export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const { email } = await exigerSession("ADMIN");

  return (
    <div className="min-h-dvh bg-muted/30">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r bg-background md:flex">
        <div className="flex h-16 items-center border-b px-4">
          <Marque />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavigationAdmin orientation="colonne" />
        </div>
        <div className="flex flex-col gap-2 border-t p-3">
          <span className="truncate px-3 text-xs text-muted-foreground" title={email}>
            {email}
          </span>
          <Deconnexion />
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <Marque />
          <Deconnexion compact />
        </div>
        <div className="px-4 pb-2">
          <NavigationAdmin orientation="ligne" />
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 md:ml-60 md:px-8 md:py-8">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}

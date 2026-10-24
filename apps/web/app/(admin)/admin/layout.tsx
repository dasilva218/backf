import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { seDeconnecter } from "@/app/actions/auth";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { exigerSession } from "@/lib/session";
import { NavigationAdmin } from "./navigation";

export const metadata: Metadata = { title: { default: "Administration", template: "%s · Administration" } };

/** L'espace du bureau find_delivery : dossiers des livreurs, espèces, courses. */
export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const { email } = await exigerSession("ADMIN");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" aria-label="Administration find_delivery" className="flex items-center gap-2">
            <Logo />
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">Admin</span>
          </Link>
          <NavigationAdmin />
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:inline" title={email}>
              {email}
            </span>
            <form action={seDeconnecter}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut aria-hidden />
                <span>Déconnexion</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}

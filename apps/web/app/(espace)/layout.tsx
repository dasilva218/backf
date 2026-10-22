import Link from "next/link";
import { LogOut } from "lucide-react";
import { seDeconnecter } from "@/app/actions/auth";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { exigerSession } from "@/lib/session";
import { NavigationEspace } from "./navigation";

export default async function LayoutEspace({ children }: { children: React.ReactNode }) {
  const { email } = await exigerSession();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/courses" aria-label="Accueil find_delivery">
            <Logo />
          </Link>
          <NavigationEspace />
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
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}

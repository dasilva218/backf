import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { PiedDePage } from "@/components/pied-de-page";
import { Button } from "@/components/ui/button";

/** Pages légales : publiques, lisibles connecté ou non (voir PAGES_PUBLIQUES dans proxy.ts). */
export default function LayoutLegal({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" aria-label="find_delivery, accueil">
            <Logo />
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft aria-hidden />
              Accueil
            </Link>
          </Button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <PiedDePage />
    </div>
  );
}

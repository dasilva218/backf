import type { Metadata } from "next";
import { CarteAdmin } from "./carte-admin";

export const metadata: Metadata = { title: "Carte" };

export default function PageCarte() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Carte des courses</h1>
        <p className="text-sm text-muted-foreground">
          Les courses qu&apos;un livreur a en main, des deux flottes, avec sa dernière position. Rafraîchie toutes les
          15 secondes.
        </p>
      </div>
      <CarteAdmin />
    </div>
  );
}

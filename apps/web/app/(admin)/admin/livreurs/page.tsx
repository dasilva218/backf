import type { Metadata } from "next";
import Link from "next/link";
import { Bike, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { appelerApi } from "@/lib/api";
import { formaterDate } from "@/lib/affichage";
import { STATUTS_DOSSIER, type LivreurAdmin, type StatutDossier } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ActionsDossier } from "./actions-dossier";

export const metadata: Metadata = { title: "Livreurs" };

const FILTRES: { valeur: StatutDossier | "tous"; libelle: string }[] = [
  { valeur: "EN_ATTENTE", libelle: "À valider" },
  { valeur: "VALIDE", libelle: "Validés" },
  { valeur: "REFUSE", libelle: "Refusés" },
  { valeur: "tous", libelle: "Tous" },
];

const LIBELLES_DOSSIER: Record<StatutDossier, string> = {
  EN_ATTENTE: "À valider",
  VALIDE: "Validé",
  REFUSE: "Refusé",
};

/** `CANTER` est la camionnette : l'enum d'origine de la base (vehicules.ts côté API). */
const VEHICULES: Record<string, string> = { MOTO: "Moto", VOITURE: "Voiture", CANTER: "Camionnette" };

export default async function PageLivreurs({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const { statut: brut } = await searchParams;
  // « À valider » par défaut : c'est la file de travail du bureau.
  const filtre: StatutDossier | "tous" =
    brut === "tous" ? "tous" : (STATUTS_DOSSIER as readonly string[]).includes(brut ?? "") ? (brut as StatutDossier) : "EN_ATTENTE";

  const reponse = await appelerApi<LivreurAdmin[]>(
    filtre === "tous" ? "/admin/livreurs" : `/admin/livreurs?statut=${filtre}`,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Livreurs</h1>
        <p className="text-sm text-muted-foreground">
          Dossiers vérifiés au bureau, pièces en main. Aucune course n&apos;est proposée à un livreur avant la
          validation de son dossier.
        </p>
      </div>

      <nav aria-label="Filtrer par dossier" className="flex flex-wrap gap-2">
        {FILTRES.map((f) => (
          <Button key={f.valeur} asChild size="sm" variant={f.valeur === filtre ? "default" : "outline"}>
            <Link href={`/admin/livreurs?statut=${f.valeur}`} aria-current={f.valeur === filtre ? "page" : undefined}>
              {f.libelle}
            </Link>
          </Button>
        ))}
      </nav>

      {!reponse.ok ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="font-medium">Impossible de charger les livreurs.</p>
            <p className="text-sm text-muted-foreground">{reponse.message}</p>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/livreurs?statut=${filtre}`}>Réessayer</Link>
            </Button>
          </CardContent>
        </Card>
      ) : reponse.donnees.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <UserRound className="size-10 text-muted-foreground" aria-hidden />
            <p className="font-medium">
              {filtre === "EN_ATTENTE" ? "Aucun dossier à valider" : "Aucun livreur dans cette liste"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {reponse.donnees.map((l) => (
            <li key={l.id}>
              <Card>
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {l.firstname} {l.lastname}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          l.statutDossier === "VALIDE" && "border-primary/40 text-primary",
                          l.statutDossier === "REFUSE" && "border-destructive/40 text-destructive",
                        )}
                      >
                        {LIBELLES_DOSSIER[l.statutDossier]}
                      </Badge>
                      {l.user.status !== "ACTIVE" && (
                        <Badge variant="outline" className="border-destructive/40 text-destructive">
                          Compte {l.user.status.toLowerCase()}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[l.phoneAirtel, l.phoneMoov].filter(Boolean).join(" · ") || "Sans téléphone"} · {l.user.email}
                    </p>
                    <p className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                      <Bike className="size-4" aria-hidden />
                      {VEHICULES[l.moyenTransport] ?? l.moyenTransport}
                      {l.immatriculation ? ` · ${l.immatriculation}` : ""} · Zones : {l.zoneGeographique.join(", ") || "toutes"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Inscrit le {formaterDate(l.createdAt)}
                      {l.dossierTraiteAt ? ` · traité le ${formaterDate(l.dossierTraiteAt)}` : ""}
                      {l.statutDossier === "VALIDE" ? ` · ${l.nombreLivraisons} livraison${l.nombreLivraisons > 1 ? "s" : ""}` : ""}
                    </p>
                    {l.motifRefus && <p className="text-sm text-destructive">Motif : {l.motifRefus}</p>}
                  </div>
                  <ActionsDossier livreurId={l.id} nom={`${l.firstname} ${l.lastname}`} statut={l.statutDossier} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

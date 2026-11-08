import type { Metadata } from "next";
import Link from "next/link";
import { Bike, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Livreur</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Véhicule</TableHead>
                <TableHead>Zones</TableHead>
                <TableHead>Dossier</TableHead>
                <TableHead>Inscrit le</TableHead>
                <TableHead className="text-right">Livraisons</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reponse.donnees.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <div className="flex min-w-44 flex-col">
                      <span className="font-medium">
                        {l.firstname} {l.lastname}
                      </span>
                      <span className="text-xs text-muted-foreground">{l.user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {[l.phoneAirtel, l.phoneMoov].filter(Boolean).join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <Bike className="size-4 text-muted-foreground" aria-hidden />
                      {VEHICULES[l.moyenTransport] ?? l.moyenTransport}
                    </span>
                    {l.immatriculation && <span className="block text-xs text-muted-foreground">{l.immatriculation}</span>}
                  </TableCell>
                  <TableCell className="max-w-48 text-muted-foreground">{l.zoneGeographique.join(", ") || "Toutes"}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex flex-wrap gap-1">
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
                      {l.motifRefus && <span className="max-w-56 text-xs text-destructive">Motif : {l.motifRefus}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formaterDate(l.createdAt)}
                    {l.dossierTraiteAt && <span className="block text-xs">traité le {formaterDate(l.dossierTraiteAt)}</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.statutDossier === "VALIDE" ? l.nombreLivraisons : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <ActionsDossier livreurId={l.id} nom={`${l.firstname} ${l.lastname}`} statut={l.statutDossier} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

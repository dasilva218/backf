import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Lock, PackageOpen } from "lucide-react";
import { BadgeStatut } from "@/components/badge-statut";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { appelerApi } from "@/lib/api";
import { formaterDate, formaterMontant, LIBELLES_TYPE } from "@/lib/affichage";
import type { Flotte, LivraisonAdmin } from "@/lib/types";

export const metadata: Metadata = { title: "Courses" };

const LIMITE = 30;

/** Au 5e code faux, la course ne se clôture plus que par un ADMIN (livreur-courses.service.ts). */
const MAX_TENTATIVES_CODE = 5;

const LIBELLES_FLOTTE: Record<Flotte, string> = { FIND_DELIVERY: "find_delivery", EWUANG: "Ewuang" };

interface PageAdmin {
  donnees: LivraisonAdmin[];
  total: number;
  page: number;
  limite: number;
}

export default async function PageCoursesAdmin({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: brut } = await searchParams;
  const page = Math.max(1, Number.parseInt(brut ?? "1", 10) || 1);
  // ADMIN : l'API sert toutes les courses, avec ses champs réservés.
  const reponse = await appelerApi<PageAdmin>(`/livraisons?page=${page}&limite=${LIMITE}`);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
        <p className="text-sm text-muted-foreground">
          Toutes les courses, des deux flottes. Une course au code bloqué se clôture depuis sa fiche.
        </p>
      </div>

      {!reponse.ok ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="font-medium">Impossible de charger les courses.</p>
            <p className="text-sm text-muted-foreground">{reponse.message}</p>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/courses?page=${page}`}>Réessayer</Link>
            </Button>
          </CardContent>
        </Card>
      ) : reponse.donnees.total === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <PackageOpen className="size-10 text-muted-foreground" aria-hidden />
            <p className="font-medium">Aucune course</p>
          </CardContent>
        </Card>
      ) : (
        <Liste donnees={reponse.donnees} />
      )}
    </div>
  );
}

function Liste({ donnees }: { donnees: PageAdmin }) {
  const pages = Math.max(1, Math.ceil(donnees.total / donnees.limite));
  return (
    <>
      <ul className="flex flex-col gap-2">
        {donnees.donnees.map((c) => {
          const bloquee = c.flotte === "FIND_DELIVERY" && c.statut === "EN_COURS" && c.tentativesCode >= MAX_TENTATIVES_CODE;
          return (
            <li key={c.id}>
              <Link
                href={`/admin/courses/${c.id}`}
                className="group flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:flex-row sm:items-center sm:gap-6"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {c.zoneDepart ?? "—"} → {c.zoneArrivee ?? "—"}
                    </span>
                    {c.typeCourse && <span className="text-xs text-muted-foreground">· {LIBELLES_TYPE[c.typeCourse]}</span>}
                    {c.flotte && <Badge variant="outline">{LIBELLES_FLOTTE[c.flotte]}</Badge>}
                    {bloquee && (
                      <Badge variant="outline" className="border-destructive/40 text-destructive">
                        <Lock aria-hidden />
                        Code bloqué
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    Pour {c.destinataireNom ?? "—"} · {c.livreurNom ? `livreur ${c.livreurNom}` : "sans livreur"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.referenceExterne ?? c.id} · {formaterDate(c.dateDemande)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <BadgeStatut livraison={c} />
                  <span className="w-28 text-right text-sm font-semibold tabular-nums">{formaterMontant(c.tarif)}</span>
                  <ArrowRight className="hidden size-4 text-muted-foreground sm:block" aria-hidden />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-4">
          <Button asChild={donnees.page > 1} variant="outline" size="sm" disabled={donnees.page <= 1}>
            {donnees.page > 1 ? (
              <Link href={`/admin/courses?page=${donnees.page - 1}`}>
                <ChevronLeft aria-hidden /> Précédentes
              </Link>
            ) : (
              <span>
                <ChevronLeft aria-hidden /> Précédentes
              </span>
            )}
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {donnees.page} sur {pages}
          </span>
          <Button asChild={donnees.page < pages} variant="outline" size="sm" disabled={donnees.page >= pages}>
            {donnees.page < pages ? (
              <Link href={`/admin/courses?page=${donnees.page + 1}`}>
                Suivantes <ChevronRight aria-hidden />
              </Link>
            ) : (
              <span>
                Suivantes <ChevronRight aria-hidden />
              </span>
            )}
          </Button>
        </nav>
      )}
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, PackageOpen, Plus } from "lucide-react";
import { BadgeStatut } from "@/components/badge-statut";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { appelerApi } from "@/lib/api";
import { formaterDate, formaterMontant, LIBELLES_TYPE } from "@/lib/affichage";
import type { PageLivraisons } from "@/lib/types";

export const metadata: Metadata = { title: "Mes courses" };

const LIMITE = 20;

export default async function PageCourses({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageBrute } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageBrute ?? "1", 10) || 1);

  const reponse = await appelerApi<PageLivraisons>(`/livraisons?page=${page}&limite=${LIMITE}`);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mes courses</h1>
          <p className="text-sm text-muted-foreground">Suivez vos livraisons et leurs codes de remise.</p>
        </div>
        <Button asChild>
          <Link href="/courses/nouvelle">
            <Plus aria-hidden />
            Nouvelle course
          </Link>
        </Button>
      </div>

      {!reponse.ok ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="font-medium">Impossible de charger vos courses.</p>
            <p className="text-sm text-muted-foreground">{reponse.message}</p>
            <Button asChild variant="outline" size="sm">
              <Link href={`/courses?page=${page}`}>Réessayer</Link>
            </Button>
          </CardContent>
        </Card>
      ) : reponse.donnees.total === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <PackageOpen className="size-10 text-muted-foreground" aria-hidden />
            <p className="font-medium">Aucune course pour l&apos;instant</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Soumettez votre première course : un livreur viendra récupérer le colis à votre boutique.
            </p>
            <Button asChild className="mt-2">
              <Link href="/courses/nouvelle">Créer une course</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ListeCourses donnees={reponse.donnees} />
      )}
    </div>
  );
}

function ListeCourses({ donnees }: { donnees: PageLivraisons }) {
  const pages = Math.max(1, Math.ceil(donnees.total / donnees.limite));

  return (
    <>
      <ul className="flex flex-col gap-3">
        {donnees.donnees.map((course) => (
          <li key={course.id}>
            <Link
              href={`/courses/${course.id}`}
              className="group flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:flex-row sm:items-center sm:gap-6"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {course.zoneDepart ?? "—"} → {course.zoneArrivee ?? "—"}
                  </span>
                  {course.typeCourse && (
                    <span className="text-xs text-muted-foreground">· {LIBELLES_TYPE[course.typeCourse]}</span>
                  )}
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  Pour {course.destinataireNom ?? "—"} · {course.adresseArrivee}
                </p>
                <p className="text-xs text-muted-foreground">{formaterDate(course.dateDemande)}</p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <BadgeStatut livraison={course} />
                <span className="w-28 text-right text-sm font-semibold tabular-nums">
                  {formaterMontant(course.tarif)}
                </span>
                <ArrowRight
                  className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block"
                  aria-hidden
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-4">
          <Button asChild={donnees.page > 1} variant="outline" size="sm" disabled={donnees.page <= 1}>
            {donnees.page > 1 ? (
              <Link href={`/courses?page=${donnees.page - 1}`}>
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
              <Link href={`/courses?page=${donnees.page + 1}`}>
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

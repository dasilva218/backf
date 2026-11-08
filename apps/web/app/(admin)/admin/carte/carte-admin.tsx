"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, PackageOpen, TriangleAlert } from "lucide-react";
import { BadgeStatut } from "@/components/badge-statut";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { depuis, useHorloge, useSondage } from "@/components/carte/use-sondage";
import type { MarqueurLivreur } from "@/components/carte/carte-livreurs";
import type { CarteAdmin as DonneesCarte, CourseCarte, Flotte } from "@/lib/types";
import { cn } from "@/lib/utils";

// Leaflet n'existe que dans le navigateur.
const CarteLivreurs = dynamic(() => import("@/components/carte/carte-livreurs"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-muted" />,
});

const INTERVALLE_MS = 15_000;

const LIBELLES_FLOTTE: Record<Flotte, string> = { FIND_DELIVERY: "Avoo", EWUANG: "Ewuang" };
/** Mêmes teintes que les marqueurs (components/carte/carte-livreurs.tsx). */
const PASTILLES: Record<Flotte, string> = { FIND_DELIVERY: "bg-[#0F6E56]", EWUANG: "bg-[#1F5FA8]" };

function trajet(c: CourseCarte): string {
  return `${c.zoneDepart ?? "—"} → ${c.zoneArrivee ?? "—"}`;
}

export function CarteAdmin() {
  const { donnees, erreur } = useSondage<DonneesCarte>("/admin/carte/donnees", INTERVALLE_MS);
  const maintenant = useHorloge();
  const [selection, setSelection] = useState<string | null>(null);

  const courses = useMemo(() => donnees?.courses ?? [], [donnees]);
  const marqueurs = useMemo<MarqueurLivreur[]>(
    () =>
      courses.flatMap((c) =>
        c.position && c.flotte
          ? [
              {
                id: c.id,
                latitude: c.position.latitude,
                longitude: c.position.longitude,
                flotte: c.flotte,
                perimee: c.position.perimee,
                libelle: `${c.livreurNom ?? "Livreur"} · ${trajet(c)}`,
                details: <DetailsCourse course={c} maintenant={maintenant} />,
              },
            ]
          : [],
      ),
    [courses, maintenant],
  );
  const sansPosition = courses.length - marqueurs.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline">{courses.length} en cours</Badge>
        {(["FIND_DELIVERY", "EWUANG"] as const).map((f) => (
          <Badge key={f} variant="outline" className="gap-1.5">
            <span className={cn("size-2 rounded-full", PASTILLES[f])} aria-hidden />
            {courses.filter((c) => c.flotte === f).length} {LIBELLES_FLOTTE[f]}
          </Badge>
        ))}
        {sansPosition > 0 && (
          <Badge variant="outline" className="text-muted-foreground">
            {sansPosition} sans position
          </Badge>
        )}
        {donnees && (
          <span className="text-muted-foreground" aria-live="polite">
            Mise à jour {depuis(donnees.genereAt, maintenant)}
          </span>
        )}
      </div>

      {(erreur || donnees?.flotteEwuangIndisponible) && (
        <div role="status" className="flex gap-3 rounded-xl border border-statut-alerte/40 bg-statut-alerte/10 p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-statut-alerte" aria-hidden />
          <p>{erreur ?? "La flotte Ewuang ne répond pas : ses livreurs apparaissent sans position."}</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden py-0">
          <div className="h-[60vh] min-h-96">
            <CarteLivreurs marqueurs={marqueurs} selection={selection} onSelect={setSelection} />
          </div>
        </Card>

        <Card className="py-2">
          <CardContent className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto px-2">
            {!donnees && !erreur && <p className="p-4 text-center text-sm text-muted-foreground">Chargement…</p>}
            {donnees && courses.length === 0 && (
              <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
                <PackageOpen className="size-8" aria-hidden />
                Aucune course en cours.
              </div>
            )}
            {courses.map((c) => (
              <LigneCourse
                key={c.id}
                course={c}
                maintenant={maintenant}
                active={selection === c.id}
                onSelect={() => setSelection(selection === c.id ? null : c.id)}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LigneCourse({
  course,
  maintenant,
  active,
  onSelect,
}: {
  course: CourseCarte;
  maintenant: number;
  active: boolean;
  onSelect: () => void;
}) {
  const { position } = course;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/60",
        active ? "border-primary bg-muted/60" : "border-transparent",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={!position}
        aria-pressed={active}
        className="flex min-w-0 flex-1 flex-col gap-1 text-left disabled:cursor-default"
      >
        <span className="flex items-center gap-2 font-medium">
          {course.flotte && <span className={cn("size-2 shrink-0 rounded-full", PASTILLES[course.flotte])} aria-hidden />}
          <span className="truncate">{trajet(course)}</span>
        </span>
        <span className="truncate text-muted-foreground">
          {course.livreurNom ?? "Livreur"}
          {course.flotte ? ` · ${LIBELLES_FLOTTE[course.flotte]}` : ""}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <BadgeStatut livraison={course} />
          <span className={cn("text-xs", position?.perimee || !position ? "text-statut-alerte" : "text-muted-foreground")}>
            {position ? `Position ${depuis(position.positionAt, maintenant)}` : "Aucune position"}
          </span>
        </span>
      </button>
      <Link
        href={`/admin/courses/${course.id}`}
        className="mt-0.5 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label={`Ouvrir la course ${trajet(course)}`}
      >
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

function DetailsCourse({ course, maintenant }: { course: CourseCarte; maintenant: number }) {
  return (
    <div className="flex flex-col gap-0.5 text-sm">
      <span className="font-semibold">{course.livreurNom ?? "Livreur"}</span>
      {course.livreurContact && (
        <a href={`tel:${course.livreurContact}`} className="underline">
          {course.livreurContact}
        </a>
      )}
      <span>{trajet(course)}</span>
      {course.destinataireNom && <span>Pour {course.destinataireNom}</span>}
      {course.position && (
        <span className="text-muted-foreground">
          Position {depuis(course.position.positionAt, maintenant)}
          {course.position.precisionM ? ` · ±${Math.round(course.position.precisionM)} m` : ""}
        </span>
      )}
      <Link href={`/admin/courses/${course.id}`} className="underline">
        Ouvrir la course
      </Link>
    </div>
  );
}

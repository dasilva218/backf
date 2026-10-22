import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Bike, KeyRound, TriangleAlert } from "lucide-react";
import { BadgeStatut } from "@/components/badge-statut";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { appelerApi } from "@/lib/api";
import {
  estAnnulable,
  estARenvoyer,
  formaterDate,
  formaterMontant,
  LIBELLES_TYPE,
} from "@/lib/affichage";
import type { LivraisonDetail } from "@/lib/types";
import { ActionsCourse } from "./actions";

export const metadata: Metadata = { title: "Course" };

export default async function PageCourse({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reponse = await appelerApi<LivraisonDetail>(`/livraisons/${encodeURIComponent(id)}`);

  if (!reponse.ok && reponse.statut === 404) notFound();
  if (!reponse.ok) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3">
          <p className="font-medium">Impossible de charger cette course.</p>
          <p className="text-sm text-muted-foreground">{reponse.message}</p>
          <Button asChild variant="outline" size="sm">
            <Link href={`/courses/${id}`}>Réessayer</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const course = reponse.donnees;
  const charge = course.chargeEwuang;
  const annulee = course.statut === "ANNULEE";

  const etapes = [
    { libelle: "Demandée", date: course.dateDemande },
    { libelle: "Acceptée par un livreur", date: course.dateAcceptation },
    { libelle: "Colis récupéré", date: course.dateRecuperation },
    { libelle: "Livrée", date: course.dateLivraison },
    ...(course.dateAnnulation ? [{ libelle: "Annulée", date: course.dateAnnulation }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/courses"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Mes courses
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {course.zoneDepart ?? "—"} <ArrowRight className="size-5" aria-label="vers" /> {course.zoneArrivee ?? "—"}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <BadgeStatut livraison={course} />
            {course.typeCourse && <span>{LIBELLES_TYPE[course.typeCourse]}</span>}
            <span>{formaterMontant(course.tarif)}</span>
          </div>
        </div>
        <ActionsCourse
          id={course.id}
          annulable={estAnnulable(course)}
          aRenvoyer={estARenvoyer(course)}
        />
      </div>

      {estARenvoyer(course) && (
        <div role="alert" className="flex gap-3 rounded-xl border border-statut-alerte/40 bg-statut-alerte/10 p-4">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-statut-alerte" aria-hidden />
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-medium">Cette course n&apos;a pas encore été transmise aux livreurs.</p>
            <p className="text-muted-foreground">
              {course.erreurEwuang ?? "Le service de livraison était injoignable."} Utilisez « Renvoyer » :
              il n&apos;y a aucun risque de doublon.
            </p>
          </div>
        </div>
      )}

      {annulee && course.erreurEwuang && (
        <div role="status" className="rounded-xl border border-statut-annulee/30 bg-statut-annulee/10 p-4 text-sm">
          <p className="font-medium">Course refusée par le service de livraison.</p>
          <p className="text-muted-foreground">{course.erreurEwuang}</p>
        </div>
      )}

      {course.codeRemise && !annulee && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div className="flex flex-col gap-1">
                <p className="font-medium">Code de remise</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Transmettez-le à {course.destinataireNom ?? "votre destinataire"}
                  {course.destinataireContact ? ` (${course.destinataireContact})` : ""}. Le livreur le lui
                  demandera : sans lui, la course ne peut pas être clôturée.
                </p>
              </div>
            </div>
            <p
              className="font-mono text-4xl font-semibold tracking-[0.3em] tabular-nums"
              aria-label={`Code de remise : ${course.codeRemise.split("").join(" ")}`}
            >
              {course.codeRemise}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Trajet</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <Bloc titre="Enlèvement">
              <p>{course.adresseDepart}</p>
              {charge?.enlevement?.contact && <p className="text-muted-foreground">{charge.enlevement.contact}</p>}
              {charge?.enlevement?.instructions && (
                <p className="text-muted-foreground">« {charge.enlevement.instructions} »</p>
              )}
            </Bloc>
            <Bloc titre="Livraison">
              <p className="font-medium">{course.destinataireNom ?? "—"}</p>
              <p>{course.adresseArrivee}</p>
              {course.destinataireContact && <p className="text-muted-foreground">{course.destinataireContact}</p>}
            </Bloc>
            {charge?.colis?.description && (
              <Bloc titre="Colis">
                <p>{charge.colis.description}</p>
                {charge.colis.vehicule_requis && (
                  <p className="text-muted-foreground">Véhicule requis : {charge.colis.vehicule_requis}</p>
                )}
              </Bloc>
            )}
            {charge?.date_souhaitee && (
              <Bloc titre="Date souhaitée">
                <p>{formaterDate(charge.date_souhaitee)}</p>
              </Bloc>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Livreur</CardTitle>
              {!course.livreurNom && (
                <CardDescription>
                  {annulee ? "Aucun livreur n'a pris cette course." : "En attente qu'un livreur accepte la course."}
                </CardDescription>
              )}
            </CardHeader>
            {course.livreurNom && (
              <CardContent className="flex items-center gap-3 text-sm">
                <span className="grid size-10 place-items-center rounded-full bg-muted">
                  <Bike className="size-5 text-muted-foreground" aria-hidden />
                </span>
                <div>
                  <p className="font-medium">{course.livreurNom}</p>
                  <p className="text-muted-foreground">
                    {[course.livreurContact, course.livreurTypeVehicule].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Suivi</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3 text-sm">
                {etapes.map((etape) => (
                  <li key={etape.libelle} className="flex items-center justify-between gap-4">
                    <span className={etape.date ? "font-medium" : "text-muted-foreground"}>
                      <span
                        className={`mr-2 inline-block size-2 rounded-full ${etape.date ? "bg-primary" : "bg-border"}`}
                        aria-hidden
                      />
                      {etape.libelle}
                    </span>
                    <span className="text-muted-foreground tabular-nums">{formaterDate(etape.date)}</span>
                  </li>
                ))}
              </ol>
              {course.noteLivreur && (
                <p className="mt-4 rounded-md bg-muted px-3 py-2 text-sm">Motif : {course.noteLivreur}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Référence : {course.referenceExterne ?? course.id}</p>
    </div>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titre}</p>
      {children}
    </div>
  );
}

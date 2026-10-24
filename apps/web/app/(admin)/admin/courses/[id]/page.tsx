import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BadgeStatut } from "@/components/badge-statut";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { appelerApi } from "@/lib/api";
import { calculerEncaissements, formaterDate, formaterMontant, LIBELLES_TYPE } from "@/lib/affichage";
import type { LivraisonAdmin, LivraisonDetail } from "@/lib/types";
import { ClotureCourse } from "./cloture";

export const metadata: Metadata = { title: "Course" };

type CourseAdmin = LivraisonAdmin & Pick<LivraisonDetail, "chargeEwuang">;

const LIBELLES_PAYEUR = { EXPEDITEUR: "l'expéditeur, à l'enlèvement", DESTINATAIRE: "le destinataire, à la remise" };

export default async function PageCourseAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reponse = await appelerApi<CourseAdmin>(`/livraisons/${encodeURIComponent(id)}`);
  if (!reponse.ok && reponse.statut === 404) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href="/admin/courses">
          <ChevronLeft aria-hidden /> Toutes les courses
        </Link>
      </Button>

      {!reponse.ok ? (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="font-medium">Impossible de charger la course.</p>
            <p className="text-sm text-muted-foreground">{reponse.message}</p>
          </CardContent>
        </Card>
      ) : (
        <Fiche course={reponse.donnees} />
      )}
    </div>
  );
}

function Fiche({ course: c }: { course: CourseAdmin }) {
  const tarif = c.tarif ?? 0;
  const aRemise = c.payeur ? calculerEncaissements(tarif, c.payeur, c.montantMarchandise).remise : 0;
  const cloturable = c.flotte === "FIND_DELIVERY" && c.statut === "EN_COURS";

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {c.zoneDepart ?? "—"} → {c.zoneArrivee ?? "—"}
        </h1>
        <BadgeStatut livraison={c} />
      </div>
      <p className="-mt-4 text-sm text-muted-foreground">
        {c.referenceExterne ?? c.id} · {c.typeCourse ? LIBELLES_TYPE[c.typeCourse] : "—"} · demandée le{" "}
        {formaterDate(c.dateDemande)}
      </p>

      {cloturable && <ClotureCourse id={c.id} du={aRemise} essais={c.tentativesCode} />}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trajet</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <Ligne libelle="Enlèvement" valeur={c.adresseDepart} detail={c.chargeEwuang?.enlevement?.contact} />
            <Ligne libelle="Destinataire" valeur={`${c.destinataireNom ?? "—"} · ${c.adresseArrivee}`} detail={c.destinataireContact} />
            <Ligne libelle="Colis" valeur={c.chargeEwuang?.colis?.description ?? "—"} />
            <Ligne
              libelle="Livreur"
              valeur={c.livreurNom ? `${c.livreurNom} (${c.flotte === "EWUANG" ? "Ewuang" : "find_delivery"})` : "Aucun"}
              detail={c.livreurContact}
            />
            {c.noteLivreur && <Ligne libelle="Note du livreur" valeur={c.noteLivreur} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Argent</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <Ligne libelle="Prix client" valeur={formaterMontant(c.tarif)} />
            <Ligne
              libelle="Paiement"
              valeur={c.payeur ? `Espèces, payées par ${LIBELLES_PAYEUR[c.payeur]}` : "Réglée hors course"}
            />
            {c.montantMarchandise > 0 && <Ligne libelle="Marchandise" valeur={formaterMontant(c.montantMarchandise)} />}
            <Ligne libelle="Part du livreur" valeur={formaterMontant(c.remunerationLivreur)} />
            {c.tarifEwuang != null && <Ligne libelle="Coût chez Ewuang" valeur={formaterMontant(c.tarifEwuang)} />}
            <Ligne libelle="Commission find_delivery" valeur={formaterMontant(c.commission)} />
            <Ligne libelle="Code de remise" valeur={c.codeRemise ?? "—"} detail={`${c.tentativesCode} essai(s) faux`} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Étapes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <Ligne libelle="Acceptée" valeur={formaterDate(c.dateAcceptation)} />
          <Ligne libelle="Colis récupéré" valeur={formaterDate(c.dateRecuperation)} />
          <Ligne libelle="Livrée" valeur={formaterDate(c.dateLivraison)} />
          <Ligne libelle="Rendue à l'expéditeur" valeur={formaterDate(c.dateRetour)} />
          <Ligne libelle="Annulée" valeur={formaterDate(c.dateAnnulation)} />
          {c.statutEwuang && <Ligne libelle="Statut chez Ewuang" valeur={c.statutEwuang} />}
        </CardContent>
      </Card>
    </>
  );
}

function Ligne({ libelle, valeur, detail }: { libelle: string; valeur: string; detail?: string | null }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{libelle}</span>
      <span>{valeur}</span>
      {detail && <span className="text-muted-foreground">{detail}</span>}
    </div>
  );
}

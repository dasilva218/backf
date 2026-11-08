"use client";

import { startTransition, useActionState, useState } from "react";
import { Check, X } from "lucide-react";
import { refuserDossier, validerDossier } from "@/app/actions/admin";
import { OverlayChargement } from "@/components/overlay-chargement";
import { useFormulaireAction, useRetourAction } from "@/components/use-retour-action";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StatutDossier } from "@/lib/types";

/**
 * Valider ou refuser un dossier. Un dossier refusé peut être validé ensuite
 * (pièce complétée), et un dossier validé refusé (pièce expirée) : l'API ne
 * fige pas l'état.
 */
export function ActionsDossier({ livreurId, nom, statut }: { livreurId: string; nom: string; statut: StatutDossier }) {
  const [etatValidation, valider, validationEnCours] = useActionState(validerDossier.bind(null, livreurId), null);
  useRetourAction(etatValidation);

  const [ouvert, setOuvert] = useState(false);
  const refus = useFormulaireAction(refuserDossier.bind(null, livreurId), () => setOuvert(false));

  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      <OverlayChargement visible={validationEnCours} libelle="Validation du dossier…" />
      <OverlayChargement visible={refus.enCours} libelle="Refus du dossier…" />

      {statut !== "VALIDE" && (
        <Button size="sm" onClick={() => startTransition(() => valider())} disabled={validationEnCours}>
          <Check aria-hidden />
          Valider
        </Button>
      )}

      {statut !== "REFUSE" && (
        <AlertDialog open={ouvert} onOpenChange={setOuvert}>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline">
              <X aria-hidden />
              Refuser
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <form onSubmit={refus.soumettre} className="flex flex-col gap-4">
              <AlertDialogHeader>
                <AlertDialogTitle>Refuser le dossier de {nom} ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Le livreur lira le motif dans son application, et ne recevra aucune course.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`motif-${livreurId}`}>Motif</Label>
                <Input id={`motif-${livreurId}`} name="motif" required minLength={3} maxLength={255} placeholder="Pièce d'identité expirée" />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel type="button">Garder le dossier</AlertDialogCancel>
                <Button type="submit" variant="destructive" disabled={refus.enCours}>
                  Refuser
                </Button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

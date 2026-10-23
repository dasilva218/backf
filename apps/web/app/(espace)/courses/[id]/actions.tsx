"use client";

import { startTransition, useActionState } from "react";
import { RotateCw, X } from "lucide-react";
import { annulerCourse, renvoyerCourse } from "@/app/actions/courses";
import { OverlayChargement } from "@/components/overlay-chargement";
import { useRetourAction } from "@/components/use-retour-action";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";

export function ActionsCourse({
  id,
  annulable,
  aRenvoyer,
}: {
  id: string;
  annulable: boolean;
  aRenvoyer: boolean;
}) {
  const [etatRenvoi, renvoyer, renvoiEnCours] = useActionState(renvoyerCourse.bind(null, id), null);
  const [etatAnnulation, annuler, annulationEnCours] = useActionState(annulerCourse.bind(null, id), null);
  useRetourAction(etatRenvoi);
  useRetourAction(etatAnnulation);

  if (!annulable && !aRenvoyer) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <OverlayChargement visible={renvoiEnCours} libelle="Transmission de la course…" />
      <OverlayChargement visible={annulationEnCours} libelle="Annulation…" />

      {aRenvoyer && (
        <Button onClick={() => startTransition(() => renvoyer())} disabled={renvoiEnCours}>
          <RotateCw aria-hidden />
          Renvoyer
        </Button>
      )}

      {annulable && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={annulationEnCours}>
              <X aria-hidden />
              Annuler la course
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Annuler cette course ?</AlertDialogTitle>
              <AlertDialogDescription>
                La course sera retirée des livreurs. Une fois le colis récupéré par le livreur,
                l&apos;annulation n&apos;est plus possible ici.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Garder la course</AlertDialogCancel>
              <AlertDialogAction
                className={buttonVariants({ variant: "destructive" })}
                onClick={() => startTransition(() => annuler())}
              >
                Annuler la course
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

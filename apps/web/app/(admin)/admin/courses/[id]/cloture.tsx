"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { cloturerCourse } from "@/app/actions/admin";
import { OverlayChargement } from "@/components/overlay-chargement";
import { useFormulaireAction } from "@/components/use-retour-action";
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
import { Card, CardContent } from "@/components/ui/card";
import { formaterMontant } from "@/lib/affichage";

/**
 * Clôture sans code d'une course de notre flotte en cours de livraison.
 *
 * L'admin a joint le destinataire et le livreur : le colis est remis, le code
 * est bloqué (5 essais) ou perdu. L'argent suit la même règle que pour le
 * livreur : le montant exact dû à la remise, confirmé explicitement.
 */
export function ClotureCourse({ id, du, essais }: { id: string; du: number; essais: number }) {
  const [ouvert, setOuvert] = useState(false);
  const { soumettre, enCours } = useFormulaireAction(cloturerCourse.bind(null, id, du), () => setOuvert(false));
  const bloquee = essais >= 5;

  return (
    <Card className={bloquee ? "border-destructive/40" : undefined}>
      <OverlayChargement visible={enCours} libelle="Clôture de la course…" />
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm">
          <Lock className={bloquee ? "mt-0.5 size-4 text-destructive" : "mt-0.5 size-4 text-muted-foreground"} aria-hidden />
          <span>
            {bloquee
              ? "Code de remise bloqué après 5 essais faux : le livreur ne peut plus clôturer cette course."
              : "Le destinataire a perdu son code ? La course peut être clôturée ici, sans code."}
          </span>
        </div>
        <AlertDialog open={ouvert} onOpenChange={setOuvert}>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant={bloquee ? "default" : "outline"}>
              Clôturer sans code
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <form onSubmit={soumettre} className="flex flex-col gap-4">
              <AlertDialogHeader>
                <AlertDialogTitle>Clôturer la course comme livrée ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Joignez d&apos;abord le destinataire et le livreur : la remise doit avoir eu lieu. Cette action est
                  définitive et écrit les espèces au registre.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {du > 0 && (
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="encaisse" required className="mt-1" />
                  <span>
                    Le livreur a encaissé exactement <strong>{formaterMontant(du)}</strong> auprès du destinataire.
                  </span>
                </label>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel type="button">Annuler</AlertDialogCancel>
                <Button type="submit" disabled={enCours}>
                  Clôturer
                </Button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

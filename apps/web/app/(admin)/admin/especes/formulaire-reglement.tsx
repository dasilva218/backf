"use client";

import { useState } from "react";
import { enregistrerReglement, type TypeReglement } from "@/app/actions/admin";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formaterMontant } from "@/lib/affichage";

/**
 * Un règlement en espèces contre un reçu papier.
 *
 * Le montant est prérempli avec le maximum (tout ce qui est dû) mais reste
 * modifiable : un versement partiel est permis entre le livreur et le bureau.
 * Le plafond est revérifié par l'API, sous verrou.
 */
export function FormulaireReglement({
  type,
  compteId,
  libelle,
  titre,
  description,
  maximum,
}: {
  type: TypeReglement;
  compteId: string;
  libelle: string;
  titre: string;
  description: string;
  maximum: number;
}) {
  const [ouvert, setOuvert] = useState(false);
  const { soumettre, enCours } = useFormulaireAction(enregistrerReglement.bind(null, type, compteId), () =>
    setOuvert(false),
  );
  const prefixe = `${type}-${compteId}`;

  return (
    <>
      <OverlayChargement visible={enCours} libelle="Enregistrement du règlement…" />
      <AlertDialog open={ouvert} onOpenChange={setOuvert}>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="outline">
            {libelle}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <form onSubmit={soumettre} className="flex flex-col gap-4">
            <AlertDialogHeader>
              <AlertDialogTitle>{titre}</AlertDialogTitle>
              <AlertDialogDescription>
                {description} Au plus {formaterMontant(maximum)}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${prefixe}-montant`}>Montant (FCFA)</Label>
                <Input
                  id={`${prefixe}-montant`}
                  name="montant"
                  inputMode="numeric"
                  required
                  defaultValue={String(maximum)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${prefixe}-reference`}>N° du reçu</Label>
                <Input
                  id={`${prefixe}-reference`}
                  name="reference"
                  required
                  maxLength={64}
                  pattern="[A-Za-z0-9][A-Za-z0-9/._\-]{0,63}"
                  title="Lettres, chiffres et / . _ -"
                  placeholder="R-000123"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${prefixe}-note`}>Note (facultatif)</Label>
              <Input id={`${prefixe}-note`} name="note" maxLength={255} />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Annuler</AlertDialogCancel>
              <Button type="submit" disabled={enCours}>
                Enregistrer
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

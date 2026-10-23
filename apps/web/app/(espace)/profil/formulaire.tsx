"use client";

import { useRouter } from "next/navigation";
import { enregistrerProfil } from "@/app/actions/profil";
import { OverlayChargement } from "@/components/overlay-chargement";
import { useFormulaireAction } from "@/components/use-retour-action";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProfilBoutique } from "@/lib/types";

export function FormulaireProfil({ profil }: { profil: ProfilBoutique | null }) {
  const router = useRouter();
  const premiereFois = !profil;

  const { soumettre, enCours } = useFormulaireAction(enregistrerProfil, () => {
    // Après la création du profil, la boutique peut soumettre sa première course.
    if (premiereFois) router.push("/courses/nouvelle");
  });

  return (
    <form onSubmit={soumettre} className="flex flex-col gap-4">
      <OverlayChargement visible={enCours} libelle="Enregistrement…" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="firstname">Prénom</Label>
          <Input id="firstname" name="firstname" defaultValue={profil?.firstname} maxLength={100} required autoComplete="given-name" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="lastname">Nom</Label>
          <Input id="lastname" name="lastname" defaultValue={profil?.lastname} maxLength={100} required autoComplete="family-name" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="phoneAirtel">Téléphone Airtel</Label>
          <Input id="phoneAirtel" name="phoneAirtel" type="tel" defaultValue={profil?.phoneAirtel ?? ""} maxLength={50} placeholder="+241 07…" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phoneMoov">Téléphone Moov</Label>
          <Input id="phoneMoov" name="phoneMoov" type="tel" defaultValue={profil?.phoneMoov ?? ""} maxLength={50} placeholder="+241 06…" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="address">Adresse</Label>
        <Textarea
          id="address"
          name="address"
          defaultValue={profil?.address ?? ""}
          maxLength={255}
          placeholder="Quartier, rue, repère visible…"
          aria-describedby="address-aide"
        />
        <p id="address-aide" className="text-xs text-muted-foreground">
          Le livreur viendra récupérer les colis ici, sauf adresse différente indiquée sur la course.
        </p>
      </div>
      <Button type="submit" disabled={enCours} className="self-start">
        Enregistrer
      </Button>
    </form>
  );
}

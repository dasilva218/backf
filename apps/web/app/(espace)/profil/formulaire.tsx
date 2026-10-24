"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { enregistrerProfil } from "@/app/actions/profil";
import { OverlayChargement } from "@/components/overlay-chargement";
import { useFormulaireAction } from "@/components/use-retour-action";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LIBELLES_TYPE_CLIENT } from "@/lib/affichage";
import { TYPES_CLIENT, type ProfilClient, type TypeClient } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FormulaireProfil({ profil }: { profil: ProfilClient | null }) {
  const router = useRouter();
  const premiereFois = !profil;
  // Pas de type par défaut pour un nouveau profil : le client doit le choisir.
  const [type, setType] = useState<TypeClient | null>(profil?.type ?? null);
  const avecRaisonSociale = type !== null && type !== "PARTICULIER";

  const { soumettre, enCours } = useFormulaireAction(enregistrerProfil, () => {
    // Après la création du profil, le client peut soumettre sa première course.
    if (premiereFois) router.push("/courses/nouvelle");
  });

  return (
    <form onSubmit={soumettre} className="flex flex-col gap-4">
      <OverlayChargement visible={enCours} libelle="Enregistrement…" />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Vous êtes</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {TYPES_CLIENT.map((t) => (
            <label
              key={t}
              className={cn(
                "flex cursor-pointer items-center justify-center rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-accent/50 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                type === t && "border-primary bg-primary/5",
              )}
            >
              <input
                type="radio"
                name="type"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
                required
                className="sr-only"
              />
              {LIBELLES_TYPE_CLIENT[t]}
            </label>
          ))}
        </div>
      </fieldset>

      {avecRaisonSociale && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="raisonSociale">
            {type === "BOUTIQUE" ? "Nom de la boutique" : "Nom de l'entreprise"}
          </Label>
          <Input
            id="raisonSociale"
            name="raisonSociale"
            defaultValue={profil?.raisonSociale ?? ""}
            maxLength={150}
            required
            autoComplete="organization"
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="firstname">{avecRaisonSociale ? "Prénom du contact" : "Prénom"}</Label>
          <Input id="firstname" name="firstname" defaultValue={profil?.firstname} maxLength={100} required autoComplete="given-name" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="lastname">{avecRaisonSociale ? "Nom du contact" : "Nom"}</Label>
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

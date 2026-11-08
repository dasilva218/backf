"use client";

import { useState } from "react";
import { demanderReinitialisation } from "@/app/actions/auth";
import { OverlayChargement } from "@/components/overlay-chargement";
import { useFormulaireAction } from "@/components/use-retour-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FormulaireMotDePasseOublie() {
  const [envoye, setEnvoye] = useState(false);
  const { soumettre, enCours } = useFormulaireAction(demanderReinitialisation, () => setEnvoye(true));

  if (envoye) {
    return (
      <p role="status" className="rounded-md border border-border bg-muted/40 px-3 py-3 text-sm">
        Si un compte existe pour cette adresse, un e-mail vient de partir avec un lien pour choisir un nouveau mot de
        passe. Il est valable 30 minutes. Pensez à regarder dans vos courriers indésirables.
      </p>
    );
  }

  return (
    <form onSubmit={soumettre} className="flex flex-col gap-4">
      <OverlayChargement visible={enCours} libelle="Envoi du lien…" />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail du compte</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <Button type="submit" disabled={enCours} className="mt-2">
        Recevoir un lien
      </Button>
    </form>
  );
}

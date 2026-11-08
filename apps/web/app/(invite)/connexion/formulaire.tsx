"use client";

import { seConnecter } from "@/app/actions/auth";
import { ChampMotDePasse } from "@/components/champ-mot-de-passe";
import { OverlayChargement } from "@/components/overlay-chargement";
import { useFormulaireAction } from "@/components/use-retour-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FormulaireConnexion() {
  const { soumettre, enCours } = useFormulaireAction(seConnecter);

  return (
    <form onSubmit={soumettre} className="flex flex-col gap-4">
      <OverlayChargement visible={enCours} libelle="Connexion…" />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Mot de passe</Label>
        <ChampMotDePasse id="password" name="password" autoComplete="current-password" required />
      </div>
      <Button type="submit" disabled={enCours} className="mt-2">
        Se connecter
      </Button>
    </form>
  );
}

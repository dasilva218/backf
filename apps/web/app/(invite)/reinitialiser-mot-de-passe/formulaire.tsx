"use client";

import { reinitialiserMotDePasse } from "@/app/actions/auth";
import { ChampMotDePasse } from "@/components/champ-mot-de-passe";
import { OverlayChargement } from "@/components/overlay-chargement";
import { useFormulaireAction } from "@/components/use-retour-action";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function FormulaireReinitialisation({ jeton }: { jeton: string }) {
  const { soumettre, enCours } = useFormulaireAction(reinitialiserMotDePasse);

  return (
    <form onSubmit={soumettre} className="flex flex-col gap-4">
      <OverlayChargement visible={enCours} libelle="Enregistrement…" />
      <input type="hidden" name="jeton" value={jeton} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Nouveau mot de passe</Label>
        <ChampMotDePasse
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={10}
          maxLength={72}
          required
          aria-describedby="aide-password"
        />
        <p id="aide-password" className="text-xs text-muted-foreground">
          10 caractères minimum.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmation">Confirmer le mot de passe</Label>
        <ChampMotDePasse
          id="confirmation"
          name="confirmation"
          autoComplete="new-password"
          minLength={10}
          maxLength={72}
          required
        />
      </div>
      <Button type="submit" disabled={enCours} className="mt-2">
        Enregistrer le mot de passe
      </Button>
    </form>
  );
}

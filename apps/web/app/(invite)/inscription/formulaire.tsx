"use client";

import Link from "next/link";
import { sInscrire } from "@/app/actions/auth";
import { ChampMotDePasse } from "@/components/champ-mot-de-passe";
import { OverlayChargement } from "@/components/overlay-chargement";
import { useFormulaireAction } from "@/components/use-retour-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FormulaireInscription() {
  const { soumettre, enCours } = useFormulaireAction(sInscrire);

  return (
    <form onSubmit={soumettre} className="flex flex-col gap-4">
      <OverlayChargement visible={enCours} libelle="Création du compte…" />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Mot de passe</Label>
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
        Créer mon compte
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        En créant un compte, vous acceptez les{" "}
        <Link href="/conditions-utilisation" target="_blank" className="font-medium text-primary underline-offset-4 hover:underline">
          conditions d&apos;utilisation
        </Link>{" "}
        et la{" "}
        <Link href="/confidentialite" target="_blank" className="font-medium text-primary underline-offset-4 hover:underline">
          politique de confidentialité
        </Link>
        .
      </p>
    </form>
  );
}

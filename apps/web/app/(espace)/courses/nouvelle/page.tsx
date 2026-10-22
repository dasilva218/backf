import type { Metadata } from "next";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { appelerApi } from "@/lib/api";
import type { Devis, ProfilBoutique } from "@/lib/types";
import { FormulaireCourse } from "./formulaire";

export const metadata: Metadata = { title: "Nouvelle course" };

export default async function PageNouvelleCourse() {
  const [profil, grille] = await Promise.all([
    appelerApi<ProfilBoutique>("/boutiques/moi"),
    appelerApi<Devis[]>("/tarifs"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nouvelle course</h1>
        <p className="text-sm text-muted-foreground">
          Un livreur récupère le colis et le remet au destinataire contre un code à 4 chiffres.
        </p>
      </div>

      {!profil.ok && profil.statut === 404 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-5 text-muted-foreground" aria-hidden />
              Complétez d&apos;abord votre profil
            </CardTitle>
            <CardDescription>
              Votre nom, votre téléphone et l&apos;adresse de la boutique servent de point
              d&apos;enlèvement par défaut.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/profil">Renseigner mon profil</Link>
            </Button>
          </CardContent>
        </Card>
      ) : !profil.ok || !grille.ok ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="font-medium">Impossible de préparer le formulaire.</p>
            <p className="text-sm text-muted-foreground">
              {!profil.ok ? profil.message : !grille.ok ? grille.message : ""}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/courses/nouvelle">Réessayer</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <FormulaireCourse grille={grille.donnees} profil={profil.donnees} />
      )}
    </div>
  );
}

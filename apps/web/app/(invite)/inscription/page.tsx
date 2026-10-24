import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormulaireInscription } from "./formulaire";

export const metadata: Metadata = { title: "Créer un compte" };

export default function PageInscription() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Créer un compte</CardTitle>
        <CardDescription>
          Particulier, entreprise ou boutique : confiez vos livraisons à des livreurs à Libreville,
          Akanda et Owendo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <FormulaireInscription />
        <p className="text-center text-sm text-muted-foreground">
          Déjà inscrit ?{" "}
          <Link href="/connexion" className="font-medium text-primary underline-offset-4 hover:underline">
            Se connecter
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

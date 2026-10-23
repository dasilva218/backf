import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormulaireConnexion } from "./formulaire";

export const metadata: Metadata = { title: "Connexion" };

const MESSAGES_MOTIF: Record<string, string> = {
  expiree: "Votre session a expiré. Reconnectez-vous.",
  role: "Cet espace est réservé aux comptes boutique.",
};

export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ motif?: string }>;
}) {
  const { motif } = await searchParams;
  const avis = motif ? MESSAGES_MOTIF[motif] : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Connexion</CardTitle>
        <CardDescription>Accédez à l&apos;espace de votre boutique.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {avis && (
          <p role="status" className="rounded-md border border-statut-alerte/40 bg-statut-alerte/10 px-3 py-2 text-sm">
            {avis}
          </p>
        )}
        <FormulaireConnexion />
        <p className="text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="font-medium text-primary underline-offset-4 hover:underline">
            Créer un compte boutique
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

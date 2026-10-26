import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormulaireReinitialisation } from "./formulaire";

// Le jeton est dans l'URL : il ne doit pas partir dans l'en-tête Referer.
export const metadata: Metadata = { title: "Nouveau mot de passe", referrer: "no-referrer" };

export default async function PageReinitialisation({
  searchParams,
}: {
  searchParams: Promise<{ jeton?: string }>;
}) {
  const { jeton } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Nouveau mot de passe</CardTitle>
        <CardDescription>Choisissez le mot de passe de votre compte Avoo.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {jeton ? (
          <FormulaireReinitialisation jeton={jeton} />
        ) : (
          <p role="status" className="rounded-md border border-statut-alerte/40 bg-statut-alerte/10 px-3 py-2 text-sm">
            Ce lien est incomplet. Ouvrez à nouveau le lien reçu par e-mail, ou faites une nouvelle demande.
          </p>
        )}
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/mot-de-passe-oublie" className="font-medium text-primary underline-offset-4 hover:underline">
            Recevoir un nouveau lien
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormulaireMotDePasseOublie } from "./formulaire";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function PageMotDePasseOublie() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Mot de passe oublié</CardTitle>
        <CardDescription>Saisissez l&apos;e-mail de votre compte : nous vous envoyons un lien pour en choisir un nouveau.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <FormulaireMotDePasseOublie />
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/connexion" className="font-medium text-primary underline-offset-4 hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

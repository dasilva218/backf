import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { appelerApi } from "@/lib/api";
import type { ProfilClient } from "@/lib/types";
import { FormulaireProfil } from "./formulaire";

export const metadata: Metadata = { title: "Profil" };

export default async function PageProfil({
  searchParams,
}: {
  searchParams: Promise<{ bienvenue?: string }>;
}) {
  const { bienvenue } = await searchParams;
  const reponse = await appelerApi<ProfilClient>("/clients/moi");

  // 404 = profil pas encore créé : formulaire vide, c'est le cas normal
  // juste après l'inscription.
  if (!reponse.ok && reponse.statut !== 404) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3">
          <p className="font-medium">Impossible de charger votre profil.</p>
          <p className="text-sm text-muted-foreground">{reponse.message}</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/profil">Réessayer</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const profil = reponse.ok ? reponse.donnees : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Renseigner votre profil</h1>
        <p className="text-sm text-muted-foreground">
          Ces informations servent de point d&apos;enlèvement par défaut pour vos courses.
        </p>
      </div>

      {(bienvenue || !profil) && (
        <div role="status" className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="font-medium">{bienvenue ? "Bienvenue sur Avoo !" : "Profil à compléter"}</p>
          <p className="text-muted-foreground">
            Renseignez votre profil pour pouvoir soumettre votre première course.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
          <CardDescription>
            Le type de compte, le prénom et le nom sont obligatoires, ainsi que le nom de l&apos;entreprise
            ou de la boutique.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormulaireProfil profil={profil} />
        </CardContent>
      </Card>
    </div>
  );
}

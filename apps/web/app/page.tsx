import Link from "next/link";
import {
  ArrowRight,
  Bike,
  ClipboardList,
  KeyRound,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { MenuAccueil } from "@/components/accueil/menu-accueil";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { appelerApiPublique } from "@/lib/api";
import { formaterMontant } from "@/lib/affichage";
import { lireSessionOptimiste } from "@/lib/session";
import { ZONES, type Devis, type TypeCourse, type Zone } from "@/lib/types";

/**
 * Page d'accueil publique : présentation, grille de prix et accès à l'espace
 * client. Les prix viennent de `GET /tarifs` (public) et ne sont jamais
 * recopiés ici, pour qu'un changement de grille côté API s'y reflète seul.
 */

const ETAPES = [
  {
    icone: ClipboardList,
    titre: "Créez la course",
    texte: "Trajet, destinataire, colis : le prix s'affiche avant l'envoi.",
  },
  {
    icone: Bike,
    titre: "Un livreur l'accepte",
    texte: "Elle est proposée aux livreurs disponibles, qui viennent récupérer le colis.",
  },
  {
    icone: KeyRound,
    titre: "Transmettez le code",
    texte: "Chaque course a un code à 4 chiffres, à donner à votre destinataire.",
  },
  {
    icone: PackageCheck,
    titre: "Remise confirmée",
    texte: "Le livreur remet le colis contre ce code. Vous suivez chaque étape.",
  },
];

const QUESTIONS = [
  {
    q: "Qui livre mes colis ?",
    r: "Les livreurs de notre partenaire Ewuang. Le nom et le téléphone du livreur s'affichent dès qu'il accepte votre course.",
  },
  {
    q: "À quoi sert le code de remise ?",
    r: "Le livreur ne peut clôturer la course qu'avec ce code, que seul votre destinataire connaît. C'est la preuve que le colis est arrivé à la bonne personne.",
  },
  {
    q: "La course express est-elle garantie dans un délai ?",
    r: "Non. Une course express passe en priorité auprès des livreurs, mais aucun délai n'est garanti.",
  },
  {
    q: "Puis-je annuler une course ?",
    r: "Oui, depuis votre espace, tant que le livreur n'a pas récupéré le colis.",
  },
];

function grilleParType(grille: Devis[], type: TypeCourse) {
  return (depart: Zone, arrivee: Zone) =>
    grille.find((d) => d.typeCourse === type && d.zoneDepart === depart && d.zoneArrivee === arrivee)?.tarif;
}

/** Supplément d'un type sur le standard, lu dans la grille plutôt que supposé. */
function supplement(grille: Devis[], type: TypeCourse): number | undefined {
  const base = grilleParType(grille, "standard")("Libreville", "Libreville");
  const prix = grilleParType(grille, type)("Libreville", "Libreville");
  return base != null && prix != null ? prix - base : undefined;
}

export default async function Accueil() {
  const [session, grille] = await Promise.all([
    lireSessionOptimiste(),
    appelerApiPublique<Devis[]>("/tarifs"),
  ]);
  const connecte = !!session;
  const prixMin = grille.ok ? Math.min(...grille.donnees.map((d) => d.tarif)) : undefined;

  return (
    <>
      <MenuAccueil connecte={connecte} />

      <main>
        {/* ─── Présentation ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_0%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-[1.1fr_0.9fr] md:py-24">
            <div className="flex flex-col gap-6">
              <p className="inline-flex w-fit items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <MapPin className="size-3.5 text-primary" aria-hidden />
                Libreville · Akanda · Owendo
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Un livreur pour vos colis, en quelques clics.
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground text-pretty">
                Soumettez votre course, un livreur vient récupérer le colis chez vous et le remet à
                votre destinataire contre un code. Le prix est connu d&apos;avance, et se paie en espèces
                au livreur.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href={connecte ? "/courses/nouvelle" : "/inscription"}>
                    {connecte ? "Nouvelle course" : "Créer un compte"}
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="#tarifs">Voir les tarifs</a>
                </Button>
              </div>
              {prixMin != null && (
                <p className="text-sm text-muted-foreground">
                  À partir de <span className="font-semibold text-foreground">{formaterMontant(prixMin)}</span> la course.
                </p>
              )}
            </div>

            {/* Aperçu d'une course : décoratif, sans donnée réelle. */}
            <div aria-hidden className="mx-auto w-full max-w-sm">
              <Card className="gap-4 shadow-lg">
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Libreville → Akanda</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-statut-cours/30 bg-statut-cours/10 px-2 py-0.5 text-xs font-medium text-statut-cours">
                      <span className="size-1.5 rounded-full bg-current" />
                      Livreur en route
                    </span>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
                    <span className="grid size-9 place-items-center rounded-full bg-card">
                      <Bike className="size-4 text-muted-foreground" />
                    </span>
                    <div className="text-sm">
                      <p className="font-medium">Votre livreur</p>
                      <p className="text-muted-foreground">Moto · en route vers le client</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <KeyRound className="size-4 text-primary" />
                      Code de remise
                    </span>
                    <span className="font-mono text-2xl font-semibold tracking-[0.3em]">4817</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* ─── Fonctionnement ───────────────────────────────────────────── */}
        <section id="fonctionnement" className="scroll-mt-20 border-b">
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
            <h2 className="text-3xl font-semibold tracking-tight">Comment ça marche</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Quatre étapes, de la commande de votre client à la remise du colis.
            </p>
            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {ETAPES.map(({ icone: Icone, titre, texte }, i) => (
                <li key={titre} className="flex flex-col gap-3">
                  <span className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icone className="size-5" aria-hidden />
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">Étape {i + 1}</span>
                  </span>
                  <h3 className="font-semibold">{titre}</h3>
                  <p className="text-sm text-muted-foreground">{texte}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ─── Tarifs ───────────────────────────────────────────────────── */}
        <section id="tarifs" className="scroll-mt-20 border-b bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
            <h2 className="text-3xl font-semibold tracking-tight">Tarifs</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Un prix fixe selon la zone d&apos;arrivée, sans abonnement. Le prix affiché est celui que vous payez.
            </p>

            {grille.ok ? (
              <TableauTarifs grille={grille.donnees} />
            ) : (
              <p className="mt-8 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                La grille des tarifs est momentanément indisponible. Elle s&apos;affichera aussi au moment
                de créer votre course.
              </p>
            )}
          </div>
        </section>

        {/* ─── Zones ────────────────────────────────────────────────────── */}
        <section id="zones" className="scroll-mt-20 border-b">
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
            <h2 className="text-3xl font-semibold tracking-tight">Zones desservies</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Enlèvement et livraison dans le Grand Libreville, dans les deux sens.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-3">
              {ZONES.map((zone) => (
                <li key={zone} className="flex items-center gap-3 rounded-xl border bg-card p-5 shadow-sm">
                  <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <MapPin className="size-5" aria-hidden />
                  </span>
                  <span className="font-medium">{zone}</span>
                </li>
              ))}
            </ul>
            <ul className="mt-10 grid gap-6 sm:grid-cols-3">
              <li className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Remise sécurisée.</span> Le colis n&apos;est
                  remis que contre le code de votre destinataire.
                </p>
              </li>
              <li className="flex gap-3">
                <Timer className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Suivi étape par étape.</span> Acceptée,
                  colis récupéré, livrée : tout s&apos;affiche dans votre espace.
                </p>
              </li>
              <li className="flex gap-3">
                <Bike className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Le bon véhicule.</span> Moto ou voiture :
                  exigez-le si votre colis le demande.
                </p>
              </li>
            </ul>
          </div>
        </section>

        {/* ─── Questions ────────────────────────────────────────────────── */}
        <section id="questions" className="scroll-mt-20 border-b">
          <div className="mx-auto max-w-3xl px-4 py-16 md:py-20">
            <h2 className="text-3xl font-semibold tracking-tight">Questions fréquentes</h2>
            <div className="mt-8 divide-y rounded-xl border bg-card">
              {QUESTIONS.map(({ q, r }) => (
                <details key={q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {q}
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground">{r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Appel à l'action ─────────────────────────────────────────── */}
        <section>
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-16 text-center md:py-20">
            <h2 className="text-3xl font-semibold tracking-tight text-balance">
              {connecte ? "Une livraison à faire ?" : "Prêt à confier votre première livraison ?"}
            </h2>
            <p className="max-w-xl text-muted-foreground">
              {connecte
                ? "Créez la course, nous la proposons aux livreurs."
                : "Particulier, entreprise ou boutique : créez votre compte en une minute, puis soumettez votre première course."}
            </p>
            <Button asChild size="lg">
              <Link href={connecte ? "/courses/nouvelle" : "/inscription"}>
                {connecte ? "Nouvelle course" : "Créer un compte"}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <Logo className="text-foreground" />
          <p>Livraisons opérées par Ewuang · Grand Libreville, Gabon</p>
        </div>
      </footer>
    </>
  );
}

function TableauTarifs({ grille }: { grille: Devis[] }) {
  const prix = grilleParType(grille, "standard");
  const express = supplement(grille, "express");
  const volumineux = supplement(grille, "volumineux");

  return (
    <div className="mt-8 flex flex-col gap-4">
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full min-w-[28rem] text-sm">
          <caption className="sr-only">
            Prix d&apos;une course standard, selon la zone d&apos;arrivée
          </caption>
          <thead>
            <tr className="border-b bg-muted/50">
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                Arrivée →
              </th>
              {ZONES.map((z) => (
                <th key={z} scope="col" className="px-4 py-3 text-right font-semibold">
                  {z}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="px-4 py-3 text-left font-semibold">
                Prix
              </th>
              {/* Le départ n'entre pas dans le prix : n'importe lequel convient pour lire la grille. */}
              {ZONES.map((arrivee) => (
                <td key={arrivee} className="px-4 py-3 text-right tabular-nums">
                  {formaterMontant(prix(arrivee, arrivee))}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">
        Prix d&apos;une course <span className="font-medium text-foreground">standard</span>.
        {express != null && (
          <>
            {" "}Express : <span className="font-medium text-foreground">+{formaterMontant(express)}</span>.
          </>
        )}
        {volumineux != null && (
          <>
            {" "}Volumineux : <span className="font-medium text-foreground">+{formaterMontant(volumineux)}</span>.
          </>
        )}
      </p>
    </div>
  );
}

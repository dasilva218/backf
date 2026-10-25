import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Bike,
  ClipboardList,
  KeyRound,
  MapPin,
  PackageCheck,
  Plus,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { Inclinable } from "@/components/accueil/inclinable";
import { MenuAccueil } from "@/components/accueil/menu-accueil";
import { VisuelHero } from "@/components/accueil/visuel-hero";
import { PiedDePage } from "@/components/pied-de-page";
import { Button } from "@/components/ui/button";
import { appelerApiPublique } from "@/lib/api";
import { formaterMontant } from "@/lib/affichage";
import { lireSessionOptimiste } from "@/lib/session";
import { ZONES, type Devis, type TypeCourse, type Zone } from "@/lib/types";

/**
 * Page d'accueil publique : présentation, grille de prix et accès à l'espace
 * client. Les prix viennent de `GET /tarifs` (public) et ne sont jamais
 * recopiés ici, pour qu'un changement de grille côté API s'y reflète seul.
 *
 * Le visuel 3D du héros est chargé côté navigateur après le rendu serveur
 * (components/accueil/visuel-hero.tsx) ; tout le reste est rendu ici.
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

const GARANTIES = [
  {
    icone: ShieldCheck,
    titre: "Remise sécurisée.",
    texte: "Le colis n'est remis que contre le code de votre destinataire.",
  },
  {
    icone: Timer,
    titre: "Suivi étape par étape.",
    texte: "Acceptée, colis récupéré, livrée : tout s'affiche dans votre espace.",
  },
  {
    icone: Bike,
    titre: "Le bon véhicule.",
    texte: "Moto ou voiture : exigez-le si votre colis le demande.",
  },
];

const QUESTIONS = [
  {
    q: "Qui livre mes colis ?",
    r: "Des livreurs indépendants inscrits sur Avoo, et ceux de notre partenaire Ewuang : le premier qui accepte la course l'exécute. Le nom et le téléphone du livreur s'affichent dès qu'il l'accepte.",
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

/** Retard d'une apparition au chargement, lu par la classe `.entree`. */
const delai = (ms: number): CSSProperties & { "--delai": string } => ({ "--delai": `${ms}ms` });

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

function EnTeteSection({ surtitre, titre, texte }: { surtitre: string; titre: string; texte?: string }) {
  return (
    <div className="revele max-w-2xl">
      <p className="text-sm font-medium text-primary">{surtitre}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl">{titre}</h2>
      {texte && <p className="mt-4 text-lg text-muted-foreground text-pretty">{texte}</p>}
    </div>
  );
}

export default async function Accueil() {
  const [session, grille] = await Promise.all([
    lireSessionOptimiste(),
    appelerApiPublique<Devis[]>("/tarifs"),
  ]);
  const connecte = !!session;
  const prixMin = grille.ok ? Math.min(...grille.donnees.map((d) => d.tarif)) : undefined;
  const lienAction = connecte ? "/courses/nouvelle" : "/inscription";
  const libelleAction = connecte ? "Nouvelle course" : "Créer un compte";

  return (
    <>
      <MenuAccueil connecte={connecte} />

      <main className="overflow-x-clip">
        {/* ─── Présentation ─────────────────────────────────────────────── */}
        <section className="relative">
          <div
            aria-hidden
            className="trame-points pointer-events-none absolute inset-0 mask-[radial-gradient(70%_60%_at_70%_40%,black,transparent)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 right-0 size-[40rem] rounded-full bg-primary/15 blur-[120px]"
          />

          <div className="relative mx-auto grid max-w-7xl items-center gap-4 px-4 pt-12 pb-10 md:grid-cols-[1fr_1.15fr] md:pt-16 md:pb-16">
            <div className="flex flex-col gap-7">
              <p
                className="entree inline-flex w-fit items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur"
                style={delai(0)}
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60 motion-reduce:hidden" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                Libreville · Akanda · Owendo
              </p>
              <h1
                className="entree text-5xl font-semibold tracking-tighter text-balance sm:text-6xl lg:text-7xl"
                style={delai(80)}
              >
                Un livreur pour vos colis, <span className="texte-marque">en quelques clics.</span>
              </h1>
              <p className="entree max-w-xl text-lg text-muted-foreground text-pretty" style={delai(160)}>
                Soumettez votre course, un livreur vient récupérer le colis chez vous et le remet à
                votre destinataire contre un code. Le prix est connu d&apos;avance, et se paie en espèces
                au livreur.
              </p>
              <div className="entree flex flex-wrap gap-3" style={delai(240)}>
                <Button asChild size="lg" className="pressable h-12 px-6 text-base">
                  <Link href={lienAction}>
                    {libelleAction}
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="pressable h-12 bg-card/60 px-6 text-base backdrop-blur">
                  <a href="#tarifs">Voir les tarifs</a>
                </Button>
              </div>
              <ul className="entree flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground" style={delai(320)}>
                {prixMin != null && (
                  <li>
                    À partir de <span className="font-semibold text-foreground">{formaterMontant(prixMin)}</span>
                  </li>
                )}
                <li className="flex items-center gap-1.5">
                  <KeyRound className="size-4 text-primary" aria-hidden /> Code de remise
                </li>
                <li className="flex items-center gap-1.5">
                  <Banknote className="size-4 text-primary" aria-hidden /> Paiement en espèces
                </li>
              </ul>
            </div>

            <div className="entree" style={delai(200)}>
              <VisuelHero>
                {/* Aperçu d'une course : décoratif, sans donnée réelle. */}
                <Inclinable className="absolute bottom-2 left-0 w-[17.5rem] rounded-2xl sm:left-4 sm:w-80">
                  <div
                    aria-hidden
                    className="flex flex-col gap-3 rounded-2xl border bg-card/80 p-4 shadow-2xl shadow-primary/10 backdrop-blur-xl"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">Libreville → Akanda</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-statut-cours/30 bg-statut-cours/10 px-2 py-0.5 text-xs font-medium text-statut-cours">
                        <span className="size-1.5 animate-pulse rounded-full bg-current" />
                        En route
                      </span>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl bg-muted/70 p-3">
                      <span className="grid size-9 place-items-center rounded-full bg-card">
                        <Bike className="size-4 text-muted-foreground" />
                      </span>
                      <div className="text-sm">
                        <p className="font-medium">Votre livreur</p>
                        <p className="text-muted-foreground">Moto · vers le destinataire</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-3">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <KeyRound className="size-4 text-primary" />
                        Code de remise
                      </span>
                      <span className="font-mono text-2xl font-semibold tracking-[0.3em]">4817</span>
                    </div>
                  </div>
                </Inclinable>
              </VisuelHero>
            </div>
          </div>
        </section>

        {/* ─── Fonctionnement ───────────────────────────────────────────── */}
        <section id="fonctionnement" className="scroll-mt-20">
          <div className="mx-auto max-w-7xl px-4 py-20 md:py-28">
            <EnTeteSection
              surtitre="Comment ça marche"
              titre="Quatre étapes, du colis à sa remise."
              texte="De la création de la course jusqu'au code donné par votre destinataire."
            />

            <div aria-hidden className="relative mt-14 hidden h-0.5 rounded-full bg-border lg:block">
              <div className="trace-defilement absolute inset-0 bg-linear-to-r from-primary via-primary to-colis" />
            </div>

            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:mt-0 lg:grid-cols-4">
              {ETAPES.map(({ icone: Icone, titre, texte }, i) => (
                <li key={titre} className="revele lg:pt-8">
                  <Inclinable className="h-full rounded-2xl">
                    <div className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border bg-card p-6 shadow-sm">
                      <span
                        aria-hidden
                        className="absolute -top-4 -right-1 text-8xl font-semibold tracking-tighter text-transparent [-webkit-text-stroke:1px_var(--border)]"
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Icone className="size-5" aria-hidden />
                      </span>
                      <div className="mt-6">
                        <p className="text-sm font-medium text-muted-foreground">Étape {i + 1}</p>
                        <h3 className="mt-1 text-lg font-semibold">{titre}</h3>
                        <p className="mt-2 text-sm text-muted-foreground">{texte}</p>
                      </div>
                    </div>
                  </Inclinable>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ─── Tarifs ───────────────────────────────────────────────────── */}
        <section id="tarifs" className="scroll-mt-20 px-4">
          <div className="revele relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-primary px-6 py-16 text-primary-foreground sm:px-10 md:py-20">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_100%_0%,color-mix(in_oklch,var(--colis)_35%,transparent),transparent)]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] mask-[linear-gradient(to_bottom,black,transparent)]"
            />
            <div className="relative">
              <p className="text-sm font-medium opacity-80">Tarifs</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl">
                Un prix fixe, connu avant l&apos;envoi.
              </h2>
              <p className="mt-4 max-w-2xl text-lg opacity-80">
                Selon la zone d&apos;arrivée, sans abonnement. Le prix affiché est celui que vous payez.
              </p>

              {grille.ok ? (
                <GrilleTarifs grille={grille.donnees} />
              ) : (
                <p className="mt-10 rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 p-4 text-sm">
                  La grille des tarifs est momentanément indisponible. Elle s&apos;affichera aussi au moment
                  de créer votre course.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ─── Zones ────────────────────────────────────────────────────── */}
        <section id="zones" className="scroll-mt-20">
          <div className="mx-auto max-w-7xl px-4 py-20 md:py-28">
            <EnTeteSection
              surtitre="Zones desservies"
              titre="Tout le Grand Libreville, dans les deux sens."
              texte="Enlèvement et livraison entre Akanda, Libreville et Owendo."
            />

            <div className="mt-12 grid gap-4 md:grid-cols-[1.1fr_1fr]">
              <div className="revele relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
                <div aria-hidden className="trame-points absolute inset-0 opacity-60 mask-[linear-gradient(to_left,black,transparent)]" />
                <ol className="relative flex flex-col">
                  {ZONES.map((zone, i) => (
                    <li key={zone} className="relative flex items-center gap-4 pb-8 last:pb-0">
                      {i < ZONES.length - 1 && (
                        <span
                          aria-hidden
                          className="absolute top-12 left-6 h-[calc(100%-3rem)] w-px border-l-2 border-dashed border-primary/30"
                        />
                      )}
                      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                        <MapPin className="size-5" aria-hidden />
                      </span>
                      <span className="text-2xl font-semibold tracking-tight">{zone}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <ul className="grid gap-4">
                {GARANTIES.map(({ icone: Icone, titre, texte }) => (
                  <li key={titre} className="revele flex gap-4 rounded-2xl border bg-card p-5 shadow-sm">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icone className="size-5" aria-hidden />
                    </span>
                    <p className="text-sm text-muted-foreground">
                      <span className="block font-medium text-foreground">{titre}</span> {texte}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ─── Questions ────────────────────────────────────────────────── */}
        <section id="questions" className="scroll-mt-20">
          <div className="mx-auto max-w-3xl px-4 pb-20 md:pb-28">
            <EnTeteSection surtitre="Questions" titre="Questions fréquentes" />
            <div className="revele mt-10 divide-y rounded-2xl border bg-card shadow-sm">
              {QUESTIONS.map(({ q, r }) => (
                <details key={q} className="question group px-5 py-1 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium">
                    {q}
                    <Plus
                      className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45"
                      aria-hidden
                    />
                  </summary>
                  <p className="pb-4 text-sm text-muted-foreground">{r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Appel à l'action ─────────────────────────────────────────── */}
        <section className="px-4 pb-20">
          <div className="revele relative mx-auto flex max-w-7xl flex-col items-center gap-6 overflow-hidden rounded-[2rem] border bg-card px-6 py-20 text-center shadow-sm">
            <div aria-hidden className="trame-points absolute inset-0 mask-[radial-gradient(closest-side,black,transparent)]" />
            <div aria-hidden className="absolute top-full left-1/2 size-[36rem] -translate-1/2 rounded-full bg-primary/25 blur-[100px]" />
            <h2 className="relative max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
              {connecte ? "Une livraison à faire ?" : "Prêt à confier votre première livraison ?"}
            </h2>
            <p className="relative max-w-xl text-lg text-muted-foreground">
              {connecte
                ? "Créez la course, nous la proposons aux livreurs."
                : "Particulier, entreprise ou boutique : créez votre compte en une minute, puis soumettez votre première course."}
            </p>
            <Button asChild size="lg" className="pressable relative h-12 px-6 text-base">
              <Link href={lienAction}>
                {libelleAction}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <PiedDePage />
    </>
  );
}

function GrilleTarifs({ grille }: { grille: Devis[] }) {
  const prix = grilleParType(grille, "standard");
  const express = supplement(grille, "express");
  const volumineux = supplement(grille, "volumineux");

  return (
    <div className="mt-10 flex flex-col gap-6">
      <h3 className="sr-only">Prix d&apos;une course standard, selon la zone d&apos;arrivée</h3>
      <dl className="grid gap-4 sm:grid-cols-3">
        {/* Le départ n'entre pas dans le prix : n'importe lequel convient pour lire la grille. */}
        {ZONES.map((arrivee) => (
          <div
            key={arrivee}
            className="flex flex-col gap-6 rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 p-6 backdrop-blur-sm transition-transform duration-200 ease-[var(--ease-out)] hover:-translate-y-1"
          >
            <dt className="flex items-center justify-between text-sm font-medium">
              <span>Arrivée {arrivee}</span>
              <MapPin className="size-4 opacity-70" aria-hidden />
            </dt>
            <dd className="text-4xl font-semibold tracking-tight tabular-nums">{formaterMontant(prix(arrivee, arrivee))}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm opacity-85">
        Prix d&apos;une course <span className="font-semibold">standard</span>.
        {express != null && (
          <>
            {" "}Express : <span className="font-semibold">+{formaterMontant(express)}</span>.
          </>
        )}
        {volumineux != null && (
          <>
            {" "}Volumineux : <span className="font-semibold">+{formaterMontant(volumineux)}</span>.
          </>
        )}
      </p>
    </div>
  );
}

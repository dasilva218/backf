import { MISE_A_JOUR_LEGALE } from "@/lib/editeur";

/**
 * Mise en forme commune des pages légales : titres, paragraphes et listes
 * stylés par le conteneur, pour que les pages restent du texte simple.
 */
export function DocumentLegal({ titre, intro, children }: { titre: string; intro: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12 md:py-16">
      <header className="flex flex-col gap-3 border-b pb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{titre}</h1>
        <p className="text-sm text-muted-foreground">Dernière mise à jour : {MISE_A_JOUR_LEGALE}</p>
        <div className="text-muted-foreground text-pretty">{intro}</div>
      </header>
      <div className="flex flex-col gap-10 text-[0.95rem] leading-relaxed [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_li]:pl-1 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </article>
  );
}

/** Une section numérotée : son ancre permet de la citer (`#article-3`). */
export function Article({ id, titre, children }: { id: string; titre: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titre`} className="flex scroll-mt-20 flex-col gap-3">
      <h2 id={`${id}-titre`} className="text-lg font-semibold tracking-tight">
        {titre}
      </h2>
      {children}
    </section>
  );
}

/** Une valeur de l'éditeur, ou un repère visible tant qu'elle n'est pas fournie. */
export function Valeur({ valeur, quoi }: { valeur: string | null; quoi: string }) {
  if (valeur) return <>{valeur}</>;
  return (
    <mark className="rounded bg-destructive/10 px-1.5 py-0.5 text-sm font-medium text-destructive">
      [{quoi} : à compléter]
    </mark>
  );
}

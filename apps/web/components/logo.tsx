import { cn } from "@/lib/utils";

/**
 * Logo Avoo : symbole (cercle = départ, point ambre = arrivée, arc = la course) + logotype.
 * Le symbole garde ses couleurs de marque quel que soit le thème ; le logotype suit `currentColor`.
 * Même dessin que app/icon.svg (favicon).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 64 64" className="size-8 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="16" fill="#0B6E4F" />
        <path d="M10 24 C22 13, 42 12, 54 20" stroke="#FFFFFF" strokeWidth="5" fill="none" strokeLinecap="round" />
        <circle cx="19" cy="40" r="8" stroke="#FFFFFF" strokeWidth="5" fill="none" />
        <circle cx="45" cy="40" r="10.5" fill="#E3A23B" />
      </svg>
      <span className="font-display text-[1.375em] font-bold leading-none tracking-[-0.055em]">avoo</span>
    </span>
  );
}

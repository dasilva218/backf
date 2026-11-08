"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Inclinaison maximale, en degrés. */
const INCLINAISON_MAX = 8;

/**
 * Incline son contenu en 3D vers le pointeur, avec un reflet qui le suit.
 * Seulement avec une souris (pas au toucher) et sans mouvement réduit : sinon
 * le contenu reste à plat.
 */
export function Inclinable({ children, className }: { children: ReactNode; className?: string }) {
  const carteRef = useRef<HTMLDivElement>(null);
  const refletRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const carte = carteRef.current;
    const reflet = refletRef.current;
    if (!carte || !reflet) return;
    const permis = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    if (!permis.matches) return;

    const surMouvement = (e: PointerEvent) => {
      const r = carte.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      carte.style.transform = `perspective(900px) rotateX(${(0.5 - py) * INCLINAISON_MAX * 2}deg) rotateY(${(px - 0.5) * INCLINAISON_MAX * 2}deg) translateZ(0)`;
      reflet.style.opacity = "1";
      reflet.style.background = `radial-gradient(circle at ${px * 100}% ${py * 100}%, color-mix(in oklch, white 22%, transparent), transparent 55%)`;
    };
    const surSortie = () => {
      carte.style.transform = "";
      reflet.style.opacity = "0";
    };

    carte.addEventListener("pointermove", surMouvement);
    carte.addEventListener("pointerleave", surSortie);
    return () => {
      carte.removeEventListener("pointermove", surMouvement);
      carte.removeEventListener("pointerleave", surSortie);
    };
  }, []);

  return (
    <div
      ref={carteRef}
      className={cn("relative transition-transform duration-200 ease-[var(--ease-out)] will-change-transform", className)}
    >
      {children}
      <div
        ref={refletRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-200"
      />
    </div>
  );
}

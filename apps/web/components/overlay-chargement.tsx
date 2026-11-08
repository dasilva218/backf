"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

/** Durée minimale d'affichage : un overlay qui clignote 50 ms se lit comme un bug. */
const DUREE_MINIMALE_MS = 400;

/**
 * Overlay plein écran pendant qu'une action part au serveur.
 *
 * Règle de l'interface : clic → overlay → message. Sans lui, l'écran reste
 * figé pendant l'aller-retour et rien ne dit que la demande est partie. Il
 * bloque aussi un second clic, donc une seconde course créée par accident.
 */
export function OverlayChargement({
  visible,
  libelle = "Traitement en cours…",
}: {
  visible: boolean;
  libelle?: string;
}) {
  const [affiche, setAffiche] = useState(false);
  const [depuis, setDepuis] = useState(0);

  useEffect(() => {
    if (visible) {
      // Seulement à l'apparition : `depuis` est une dépendance, le réécrire à
      // chaque passage relancerait l'effet sans fin.
      if (!affiche) {
        setAffiche(true);
        setDepuis(Date.now());
      }
      return;
    }
    if (!affiche) return;
    const reste = Math.max(0, DUREE_MINIMALE_MS - (Date.now() - depuis));
    const minuterie = setTimeout(() => setAffiche(false), reste);
    return () => clearTimeout(minuterie);
  }, [visible, affiche, depuis]);

  if (!affiche) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-sm animate-in fade-in-0"
    >
      <div className="flex items-center gap-3 rounded-lg border bg-card px-5 py-4 shadow-lg">
        <LoaderCircle className="size-5 animate-spin text-primary" aria-hidden />
        <span className="text-sm font-medium">{libelle}</span>
      </div>
    </div>
  );
}

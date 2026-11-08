"use client";

import { useCallback, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";

/** Halo et trame de points : ce qu'on voit pendant le chargement de la scène, ou sans WebGL. */
function ReplisScene() {
  return (
    <div aria-hidden className="absolute inset-0">
      <div className="trame-points absolute inset-0 mask-[radial-gradient(closest-side,black,transparent)]" />
      <div className="absolute inset-[15%] rounded-full bg-primary/20 blur-3xl" />
    </div>
  );
}

// three.js (~130 Ko gzip, mesuré au build) ne part qu'après le rendu serveur : le texte du héros reste le LCP.
const SceneLivraison = dynamic(() => import("./scene-livraison").then((m) => m.SceneLivraison), {
  ssr: false,
  loading: ReplisScene,
});

/** Visuel 3D du héros, avec un contenu posé par-dessus (la carte de course). */
export function VisuelHero({ children }: { children: ReactNode }) {
  const [echec, setEchec] = useState(false);
  // Référence stable : la scène relancerait son effet à chaque rendu sinon.
  const signalerEchec = useCallback(() => setEchec(true), []);

  return (
    <div className="relative h-104 w-full sm:h-128 md:h-144">
      {echec ? <ReplisScene /> : <SceneLivraison onEchec={signalerEchec} />}
      {children}
    </div>
  );
}

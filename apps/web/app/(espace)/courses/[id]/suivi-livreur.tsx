"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { MapPin, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { depuis, useHorloge, useSondage } from "@/components/carte/use-sondage";
import type { MarqueurLivreur } from "@/components/carte/carte-livreurs";
import type { SuiviCourse } from "@/lib/types";

// Leaflet n'existe que dans le navigateur.
const CarteLivreurs = dynamic(() => import("@/components/carte/carte-livreurs"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-muted" />,
});

/** Rythme de la flotte Ewuang (contrat §5) ; la nôtre envoie toutes les 30 s. */
const INTERVALLE_MS = 15_000;

export function SuiviLivreur({ id, livreurNom }: { id: string; livreurNom: string | null }) {
  const router = useRouter();
  const { donnees, erreur } = useSondage<SuiviCourse>(`/courses/${encodeURIComponent(id)}/suivi`, INTERVALLE_MS);
  const maintenant = useHorloge();

  // Colis remis (ou rendu) pendant que l'écran était ouvert : la page se
  // recharge pour afficher le nouveau statut, une seule fois.
  const rafraichie = useRef(false);
  useEffect(() => {
    if (donnees && !donnees.enCours && !rafraichie.current) {
      rafraichie.current = true;
      router.refresh();
    }
  }, [donnees, router]);

  const position = donnees?.position ?? null;
  const trace = useMemo(
    () => (donnees?.trace ?? []).map((p) => [p.latitude, p.longitude] as [number, number]),
    [donnees?.trace],
  );
  const marqueurs = useMemo<MarqueurLivreur[]>(
    () =>
      position
        ? [
            {
              id: "livreur",
              latitude: position.latitude,
              longitude: position.longitude,
              flotte: donnees?.flotte ?? "FIND_DELIVERY",
              perimee: position.perimee,
              libelle: livreurNom ?? "Votre livreur",
            },
          ]
        : [],
    [position, donnees?.flotte, livreurNom],
  );

  let etat: string;
  if (!donnees) etat = "Recherche de la position du livreur…";
  else if (!position && donnees.flotteIndisponible) etat = "La position du livreur est momentanément indisponible.";
  else if (!position) etat = "Le livreur n'a pas encore partagé sa position. Elle s'affichera ici dès qu'il le fera.";
  else if (position.perimee) etat = `Dernière position connue ${depuis(position.positionAt, maintenant)} : le livreur n'en a pas envoyé depuis.`;
  else etat = `Position mise à jour ${depuis(position.positionAt, maintenant)}.`;

  const enDirect = position !== null && !position.perimee;

  return (
    <Card className="gap-4 overflow-hidden pb-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="relative flex size-2.5" aria-hidden>
            {enDirect && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
            )}
            <span className={`relative inline-flex size-2.5 rounded-full ${enDirect ? "bg-primary" : "bg-border"}`} />
          </span>
          Où est votre colis
        </CardTitle>
        <CardDescription aria-live="polite">{etat}</CardDescription>
        {erreur && (
          <p role="status" className="flex items-center gap-2 text-sm text-statut-alerte">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            {erreur}
          </p>
        )}
      </CardHeader>
      <CardContent className="px-0">
        {position ? (
          <div className="h-72 border-t sm:h-96">
            <CarteLivreurs marqueurs={marqueurs} trace={trace} suivre />
          </div>
        ) : (
          <div className="flex h-40 flex-col items-center justify-center gap-2 border-t bg-muted/40 text-sm text-muted-foreground">
            <MapPin className="size-6" aria-hidden />
            La carte apparaîtra avec la première position.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

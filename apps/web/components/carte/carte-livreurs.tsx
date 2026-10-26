"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { Crosshair, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Flotte } from "@/lib/types";
import { cn } from "@/lib/utils";

// Chargé seulement dans le navigateur (`dynamic(..., { ssr: false })`) :
// Leaflet touche `window` dès son import.

/** Libreville : centre par défaut tant qu'aucune position n'est connue. */
const CENTRE_DEFAUT: [number, number] = [0.4162, 9.4673];

/** Couleurs fixes : les tuiles restent claires, même en mode sombre. */
const COULEURS: Record<Flotte, string> = { FIND_DELIVERY: "#0F6E56", EWUANG: "#1F5FA8" };
const COULEUR_PERIMEE = "#767676";

export interface MarqueurLivreur {
  id: string;
  latitude: number;
  longitude: number;
  flotte: Flotte;
  /** Position de plus de 5 min : marqueur estompé, « dernière position connue ». */
  perimee: boolean;
  libelle: string;
  details?: ReactNode;
}

function cadrer(map: L.Map, points: [number, number][]) {
  const [premier] = points;
  if (!premier) return;
  if (points.length === 1) {
    map.setView(premier, Math.max(map.getZoom(), 15));
    return;
  }
  map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
}

/**
 * Cadre une fois, à l'arrivée des premières positions, puis suit les
 * nouvelles si `suivre` — tant que l'utilisateur ne déplace pas la carte
 * lui-même : la lui reprendre à chaque rafraîchissement l'empêcherait de
 * l'explorer. « Recadrer » rétablit le suivi.
 */
function Cadrage({
  points,
  suivre,
  suiviActif,
}: {
  points: [number, number][];
  suivre: boolean;
  suiviActif: RefObject<boolean>;
}) {
  const map = useMap();
  const fait = useRef(false);
  useMapEvents({
    dragstart: () => {
      suiviActif.current = false;
    },
  });
  useEffect(() => {
    const dernier = points.at(-1);
    if (!dernier) return;
    if (!fait.current) {
      fait.current = true;
      cadrer(map, points);
      return;
    }
    if (suivre && suiviActif.current) map.panTo(dernier, { animate: true });
  }, [map, points, suivre, suiviActif]);
  return null;
}

/** Centre sur le marqueur choisi dans une liste, au changement de choix seulement. */
function SuiviSelection({ cible, selection }: { cible: [number, number] | null; selection: string | null }) {
  const map = useMap();
  const derniere = useRef<string | null>(null);
  useEffect(() => {
    if (selection === derniere.current) return;
    derniere.current = selection;
    if (cible) map.panTo(cible, { animate: true });
  }, [map, cible, selection]);
  return null;
}

/** Leaflet mesure son conteneur à la création : sans ceci, un redimensionnement laisse des tuiles grises. */
function AdaptationTaille() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function BoutonRecadrer({ points, suiviActif }: { points: [number, number][]; suiviActif: RefObject<boolean> }) {
  const map = useMap();
  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      className="absolute right-3 top-14 z-1000 size-9 shadow-md"
      aria-label="Recadrer sur les livreurs"
      title="Recadrer sur les livreurs"
      disabled={points.length === 0}
      onClick={() => {
        suiviActif.current = true;
        cadrer(map, points);
      }}
    >
      <Crosshair aria-hidden />
    </Button>
  );
}

export default function CarteLivreurs({
  marqueurs,
  trace = [],
  suivre = false,
  selection = null,
  onSelect,
}: {
  marqueurs: MarqueurLivreur[];
  /** Trajet parcouru, du plus ancien au plus récent. */
  trace?: [number, number][];
  /** Garder le dernier point en vue à chaque nouvelle position (fiche d'une course). */
  suivre?: boolean;
  selection?: string | null;
  onSelect?: (id: string | null) => void;
}) {
  const suiviActif = useRef(true);

  // Plein écran : API Fullscreen quand le navigateur l'accorde, sinon (Safari
  // iOS, iframe) un repli CSS en position fixe sur toute la fenêtre.
  // `AdaptationTaille` redimensionne la carte dans les deux cas.
  const cadre = useRef<HTMLDivElement>(null);
  const [natif, setNatif] = useState(false);
  const [repliCss, setRepliCss] = useState(false);
  const pleinEcran = natif || repliCss;

  useEffect(() => {
    const auChangement = () => setNatif(document.fullscreenElement === cadre.current);
    document.addEventListener("fullscreenchange", auChangement);
    return () => document.removeEventListener("fullscreenchange", auChangement);
  }, []);

  useEffect(() => {
    if (!repliCss) return;
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRepliCss(false);
    };
    document.addEventListener("keydown", echap);
    return () => document.removeEventListener("keydown", echap);
  }, [repliCss]);

  const basculerPleinEcran = useCallback(async () => {
    if (repliCss) {
      setRepliCss(false);
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    try {
      if (!cadre.current?.requestFullscreen) throw new Error("API Fullscreen absente");
      await cadre.current.requestFullscreen();
    } catch {
      setRepliCss(true);
    }
  }, [repliCss]);
  const points = useMemo(
    () => (trace.length > 0 ? trace : marqueurs.map((m) => [m.latitude, m.longitude] as [number, number])),
    [trace, marqueurs],
  );
  const cible = useMemo<[number, number] | null>(() => {
    const m = marqueurs.find((x) => x.id === selection);
    return m ? [m.latitude, m.longitude] : null;
  }, [marqueurs, selection]);

  return (
    // `isolate` : les panneaux Leaflet (z-index 400+) passeraient sinon au-dessus des menus.
    <div
      ref={cadre}
      className={cn("relative isolate size-full bg-background", repliCss && "fixed inset-0 z-50 h-dvh w-screen")}
    >
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="absolute right-3 top-3 z-1000 size-9 shadow-md"
        aria-label={pleinEcran ? "Quitter le plein écran" : "Afficher la carte en plein écran"}
        title={pleinEcran ? "Quitter le plein écran (Échap)" : "Plein écran"}
        aria-pressed={pleinEcran}
        onClick={basculerPleinEcran}
      >
        {pleinEcran ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
      </Button>
      <MapContainer center={CENTRE_DEFAUT} zoom={12} scrollWheelZoom className="size-full">
        {/* OSM France : tile.openstreetmap.org ne répond pas depuis certains réseaux
            gabonais (carte grise), et CARTO exige désormais une clé. */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://www.openstreetmap.fr/">OSM France</a>'
          url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
          subdomains="abc"
          maxZoom={20}
        />
        <AdaptationTaille />
        <Cadrage points={points} suivre={suivre} suiviActif={suiviActif} />
        <SuiviSelection cible={cible} selection={selection} />

        {trace.length > 1 && (
          <Polyline positions={trace} pathOptions={{ color: COULEURS.FIND_DELIVERY, weight: 4, opacity: 0.6 }} />
        )}

        {marqueurs.map((m) => {
          const actif = selection === m.id;
          return (
            <CircleMarker
              key={m.id}
              center={[m.latitude, m.longitude]}
              radius={actif ? 12 : 10}
              pathOptions={{
                color: actif ? "#111827" : "#ffffff",
                weight: actif ? 3 : 2,
                dashArray: m.perimee ? "4 3" : undefined,
                fillColor: m.perimee ? COULEUR_PERIMEE : COULEURS[m.flotte],
                fillOpacity: m.perimee ? 0.5 : 0.95,
              }}
              eventHandlers={onSelect ? { click: () => onSelect(actif ? null : m.id) } : undefined}
            >
              <Tooltip direction="top" offset={[0, -10]}>
                {m.libelle}
              </Tooltip>
              {m.details && <Popup>{m.details}</Popup>}
            </CircleMarker>
          );
        })}

        <BoutonRecadrer points={points} suiviActif={suiviActif} />
      </MapContainer>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

/**
 * Interroge un Route Handler du suivi à intervalle fixe.
 *
 * Pas de flux temps réel côté API : Ewuang ne sert sa flotte qu'en polling à
 * 15 s (contrat §5), et notre flotte envoie sa position toutes les 30 s. Les
 * appels s'arrêtent onglet caché et reprennent dès son retour.
 *
 * Session expirée (401, ou redirection de `proxy.ts` vers la connexion) :
 * passage par `/deconnexion`, comme pour une page.
 */
export function useSondage<T>(url: string, intervalleMs: number) {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    let controleur: AbortController | null = null;

    async function lire() {
      if (document.visibilityState !== "visible") return;
      controleur?.abort();
      controleur = new AbortController();
      try {
        const reponse = await fetch(url, { cache: "no-store", signal: controleur.signal });
        if (reponse.status === 401 || reponse.redirected) {
          window.location.assign("/deconnexion?motif=expiree");
          return;
        }
        const corps: unknown = await reponse.json().catch(() => null);
        if (annule) return;
        if (!reponse.ok) {
          const message = (corps as { message?: unknown } | null)?.message;
          setErreur(typeof message === "string" ? message : "Suivi momentanément indisponible.");
          return;
        }
        setDonnees(corps as T);
        setErreur(null);
      } catch (e) {
        if (annule || (e as Error).name === "AbortError") return;
        setErreur("Connexion perdue. Nouvel essai dans quelques secondes.");
      }
    }

    void lire();
    const minuterie = setInterval(() => void lire(), intervalleMs);
    const auRetour = () => {
      if (document.visibilityState === "visible") void lire();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      annule = true;
      clearInterval(minuterie);
      controleur?.abort();
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, [url, intervalleMs]);

  return { donnees, erreur };
}

/** L'heure courante, rafraîchie à intervalle : pour les « il y a 2 min » sans nouvel appel. */
export function useHorloge(intervalleMs = 10_000): number {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const minuterie = setInterval(() => setMaintenant(Date.now()), intervalleMs);
    return () => clearInterval(minuterie);
  }, [intervalleMs]);
  return maintenant;
}

/** « à l'instant », « il y a 40 s », « il y a 3 min ». */
export function depuis(iso: string, maintenant: number): string {
  const secondes = Math.max(0, Math.round((maintenant - new Date(iso).getTime()) / 1000));
  if (secondes < 10) return "à l'instant";
  if (secondes < 60) return `il y a ${secondes} s`;
  if (secondes < 3600) return `il y a ${Math.round(secondes / 60)} min`;
  return `il y a ${Math.round(secondes / 3600)} h`;
}

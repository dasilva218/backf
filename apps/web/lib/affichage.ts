import type { Livraison, TypeCourse } from "@/lib/types";

/**
 * Libellés et formats d'affichage, partagés par les écrans serveur et client.
 */

const FCFA = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export function formaterMontant(montant: number | null | undefined): string {
  return montant == null ? "—" : `${FCFA.format(montant)} FCFA`;
}

/**
 * Toujours en heure de Libreville, quel que soit le fuseau du serveur ou du
 * navigateur : les dates de l'API sont en UTC, et le Gabon est à UTC+1. Sans
 * fuseau explicite, un rendu serveur en UTC afficherait une heure de moins.
 */
const DATE_HEURE = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Libreville",
});

export function formaterDate(date: string | null | undefined): string {
  return date ? DATE_HEURE.format(new Date(date)) : "—";
}

export const LIBELLES_TYPE: Record<TypeCourse, string> = {
  standard: "Standard",
  express: "Express",
  volumineux: "Volumineux",
};

export const DESCRIPTIONS_TYPE: Record<TypeCourse, string> = {
  standard: "Petit colis, sans urgence",
  express: "Prioritaire au dispatch, sans délai garanti",
  volumineux: "Colis encombrant ou lourd",
};

export type TonStatut = "attente" | "cours" | "recupere" | "livree" | "alerte" | "annulee";

export interface StatutAffiche {
  libelle: string;
  ton: TonStatut;
}

/**
 * Le statut montré à la boutique.
 *
 * Le statut d'Ewuang fait foi dès que la course lui a été transmise. Avant
 * cela, deux cas propres à find_delivery : « Non transmise » (Ewuang
 * injoignable, à renvoyer) et « Annulée » (annulée ou refusée par Ewuang).
 */
export function statutAffiche(livraison: Pick<Livraison, "statut" | "statutEwuang" | "missionEwuangId">): StatutAffiche {
  if (livraison.statut === "ANNULEE" || livraison.statutEwuang === "Annulée") {
    return { libelle: "Annulée", ton: "annulee" };
  }
  if (!livraison.missionEwuangId) {
    return { libelle: "Non transmise", ton: "alerte" };
  }
  switch (livraison.statutEwuang) {
    case "En cours de livraison":
      return { libelle: "Livreur en route", ton: "cours" };
    case "Colis récupéré":
      return { libelle: "Colis récupéré", ton: "recupere" };
    case "Livrée":
      return { libelle: "Livrée", ton: "livree" };
    case "Reportée":
      return { libelle: "Reportée", ton: "alerte" };
    case "En attente":
    case null:
      return { libelle: "En attente d'un livreur", ton: "attente" };
    default:
      // Statut ajouté côté Ewuang et inconnu ici : on l'affiche tel quel
      // plutôt que de le masquer.
      return { libelle: livraison.statutEwuang, ton: "attente" };
  }
}

/** Ewuang refuse l'annulation une fois le colis récupéré. */
export function estAnnulable(livraison: Pick<Livraison, "statut" | "statutEwuang">): boolean {
  if (livraison.statut === "ANNULEE") return false;
  return !["Annulée", "Livrée", "Colis récupéré"].includes(livraison.statutEwuang ?? "");
}

export function estARenvoyer(livraison: Pick<Livraison, "statut" | "missionEwuangId">): boolean {
  return !livraison.missionEwuangId && livraison.statut !== "ANNULEE";
}

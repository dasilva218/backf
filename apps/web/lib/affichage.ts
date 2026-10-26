import type { Livraison, Payeur, TypeClient, TypeCourse } from "@/lib/types";

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

export const LIBELLES_TYPE_CLIENT: Record<TypeClient, string> = {
  PARTICULIER: "Particulier",
  ENTREPRISE: "Entreprise",
  BOUTIQUE: "Boutique",
};

export interface Encaissements {
  /** Payé par l'expéditeur au livreur, à l'enlèvement. */
  enlevement: number;
  /** Payé par le destinataire au livreur, à la remise. */
  remise: number;
}

/**
 * Ce que le livreur encaisse, et à quel moment.
 *
 * Les frais sont payés par le payeur choisi ; la marchandise l'est toujours
 * par le destinataire, à la remise (v2 du contrat Ewuang, §2). Même calcul que
 * `a_encaisser_enlevement` / `a_encaisser_remise` côté Ewuang.
 */
export function calculerEncaissements(tarif: number, payeur: Payeur, montantMarchandise: number): Encaissements {
  return payeur === "EXPEDITEUR"
    ? { enlevement: tarif, remise: montantMarchandise }
    : { enlevement: 0, remise: tarif + montantMarchandise };
}

export type TonStatut = "attente" | "cours" | "recupere" | "livree" | "alerte" | "annulee";

export interface StatutAffiche {
  libelle: string;
  ton: TonStatut;
}

/** Le statut d'une course prise par un livreur find_delivery, où `statut` fait foi. */
const STATUT_FLOTTE_FIND_DELIVERY: Partial<Record<Livraison["statut"], StatutAffiche>> = {
  ACCEPTEE: { libelle: "Livreur en route", ton: "cours" },
  EN_COURS: { libelle: "Colis récupéré", ton: "recupere" },
  LIVREE: { libelle: "Livrée", ton: "livree" },
  RETOUR_EXPEDITEUR: { libelle: "Retour à l'expéditeur", ton: "alerte" },
  RETOURNEE: { libelle: "Rendue à l'expéditeur", ton: "annulee" },
  EN_LITIGE: { libelle: "En litige", ton: "alerte" },
};

/**
 * Le statut montré au client.
 *
 * Qui fait foi dépend de la flotte qui a la course. Un livreur find_delivery :
 * `statut`. Un livreur Ewuang, ou personne encore : le statut d'Ewuang. Avant
 * la transmission, deux cas propres à find_delivery : « Non transmise »
 * (Ewuang injoignable, à renvoyer) et « Annulée » (annulée ou refusée).
 *
 * Une mission « Annulée » chez Ewuang n'annule PAS la course quand aucune
 * flotte ne l'a : elle a pu être retirée chez Ewuang par un livreur
 * find_delivery qui l'a ensuite rendue, et reste ouverte à notre flotte.
 */
export function statutAffiche(
  livraison: Pick<Livraison, "statut" | "statutEwuang" | "missionEwuangId" | "flotte">,
): StatutAffiche {
  if (livraison.statut === "ANNULEE") {
    return { libelle: "Annulée", ton: "annulee" };
  }
  if (livraison.flotte === "FIND_DELIVERY") {
    return STATUT_FLOTTE_FIND_DELIVERY[livraison.statut] ?? { libelle: "En attente d'un livreur", ton: "attente" };
  }
  if (!livraison.missionEwuangId) {
    return { libelle: "Non transmise", ton: "alerte" };
  }
  if (livraison.flotte === null && livraison.statutEwuang === "Annulée") {
    return { libelle: "En attente d'un livreur", ton: "attente" };
  }
  switch (livraison.statutEwuang) {
    case "Annulée":
      return { libelle: "Annulée", ton: "annulee" };
    case "En cours de livraison":
      return { libelle: "Livreur en route", ton: "cours" };
    case "Colis récupéré":
      return { libelle: "Colis récupéré", ton: "recupere" };
    case "Livrée":
      return { libelle: "Livrée", ton: "livree" };
    case "Reportée":
      return { libelle: "Reportée", ton: "alerte" };
    // v2 du contrat Ewuang, §3 : mêmes libellés que pour notre flotte.
    case "Retour expéditeur":
      return { libelle: "Retour à l'expéditeur", ton: "alerte" };
    case "Retournée":
      return { libelle: "Rendue à l'expéditeur", ton: "annulee" };
    case "En attente":
    case null:
      return { libelle: "En attente d'un livreur", ton: "attente" };
    default:
      // Statut ajouté côté Ewuang et inconnu ici : on l'affiche tel quel
      // plutôt que de le masquer.
      return { libelle: livraison.statutEwuang, ton: "attente" };
  }
}

/** Annulable tant que le colis n'est pas récupéré, quelle que soit la flotte (R4). */
export function estAnnulable(livraison: Pick<Livraison, "statut" | "statutEwuang" | "flotte">): boolean {
  if (livraison.statut === "ANNULEE") return false;
  if (livraison.flotte === "FIND_DELIVERY") {
    return livraison.statut === "ACCEPTEE";
  }
  if (livraison.flotte === null && livraison.statutEwuang === "Annulée") return true;
  return !["Annulée", "Livrée", "Colis récupéré", "Retour expéditeur", "Retournée"].includes(
    livraison.statutEwuang ?? "",
  );
}

/**
 * Un livreur a le colis en main : la fiche affiche sa position en direct.
 * Miroir de `estEnCours` (apps/api/src/suivi/suivi.ts), qui seul fait foi.
 */
export function estSuivable(livraison: Pick<Livraison, "statut" | "statutEwuang" | "flotte">): boolean {
  if (livraison.flotte === "FIND_DELIVERY") {
    return ["ACCEPTEE", "EN_COURS", "RETOUR_EXPEDITEUR"].includes(livraison.statut);
  }
  if (livraison.flotte === "EWUANG") {
    return ["En cours de livraison", "Colis récupéré", "Retour expéditeur"].includes(livraison.statutEwuang ?? "");
  }
  return false;
}

export function estARenvoyer(livraison: Pick<Livraison, "statut" | "missionEwuangId">): boolean {
  return !livraison.missionEwuangId && livraison.statut !== "ANNULEE";
}

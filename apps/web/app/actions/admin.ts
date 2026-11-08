"use server";

import { revalidatePath } from "next/cache";
import { appelerApi } from "@/lib/api";
import { exigerSession } from "@/lib/session";
import type { EtatAction } from "@/lib/types";

/**
 * Actions de l'espace d'administration.
 *
 * Chacune revérifie le rôle avant d'appeler l'API : une Server Action est un
 * point d'entrée public, que le layout de /admin ne protège pas. L'API refait
 * de toute façon le contrôle (`@Roles(ADMIN)`) — c'est elle qui fait foi.
 */

function texte(formData: FormData, nom: string): string {
  const valeur = formData.get(nom);
  return typeof valeur === "string" ? valeur.trim() : "";
}

function id(valeur: string): string {
  return encodeURIComponent(valeur);
}

// ─── Dossiers des livreurs ──────────────────────────────────────────────────

export async function validerDossier(livreurId: string, _etat: EtatAction): Promise<EtatAction> {
  await exigerSession("ADMIN");
  const reponse = await appelerApi(`/admin/livreurs/${id(livreurId)}/valider`, { methode: "POST" });
  revalidatePath("/admin/livreurs");
  if (!reponse.ok) return { ok: false, message: reponse.message };
  return { ok: true, message: "Dossier validé : le livreur peut prendre des courses." };
}

export async function refuserDossier(livreurId: string, _etat: EtatAction, formData: FormData): Promise<EtatAction> {
  await exigerSession("ADMIN");
  const motif = texte(formData, "motif");
  if (motif.length < 3) return { ok: false, message: "Indiquez le motif du refus : le livreur le lira." };
  const reponse = await appelerApi(`/admin/livreurs/${id(livreurId)}/refuser`, {
    methode: "POST",
    corps: { motif },
  });
  revalidatePath("/admin/livreurs");
  if (!reponse.ok) return { ok: false, message: reponse.message };
  return { ok: true, message: "Dossier refusé." };
}

// ─── Règlements en espèces ──────────────────────────────────────────────────

/** Où va un règlement, et ce qu'on dit une fois qu'il est enregistré. */
const REGLEMENTS = {
  versement: { chemin: (c: string) => `/admin/especes/livreurs/${id(c)}/versements`, succes: "Versement enregistré." },
  paiement: { chemin: (c: string) => `/admin/especes/livreurs/${id(c)}/paiements`, succes: "Paiement au livreur enregistré." },
  reversement: { chemin: (c: string) => `/admin/especes/clients/${id(c)}/reversements`, succes: "Reversement au client enregistré." },
  ewuangRecu: { chemin: () => "/admin/especes/ewuang/reglements-recus", succes: "Règlement d'Ewuang enregistré." },
  ewuangVerse: { chemin: () => "/admin/especes/ewuang/reglements-verses", succes: "Règlement à Ewuang enregistré." },
} as const;

export type TypeReglement = keyof typeof REGLEMENTS;

/**
 * Un règlement contre reçu. Le numéro du reçu est la clé d'idempotence côté
 * API : un double envoi du même reçu répond 409 au lieu de compter deux fois.
 */
export async function enregistrerReglement(
  type: TypeReglement,
  compteId: string,
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  await exigerSession("ADMIN");
  const montant = Number(texte(formData, "montant").replace(/\s/g, ""));
  const reference = texte(formData, "reference");
  const note = texte(formData, "note");
  if (!Number.isInteger(montant) || montant <= 0) {
    return { ok: false, message: "Le montant doit être un nombre entier de FCFA, supérieur à zéro." };
  }
  if (!reference) return { ok: false, message: "Indiquez le numéro du reçu remis." };

  const reglement = REGLEMENTS[type];
  const reponse = await appelerApi(reglement.chemin(compteId), {
    methode: "POST",
    corps: { montant, reference, ...(note ? { note } : {}) },
  });
  revalidatePath("/admin/especes");
  if (!reponse.ok) return { ok: false, message: reponse.message };
  return { ok: true, message: reglement.succes };
}

// ─── Courses ────────────────────────────────────────────────────────────────

/** Clôture sans code d'une course de notre flotte (code bloqué ou perdu). */
export async function cloturerCourse(
  courseId: string,
  du: number,
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  await exigerSession("ADMIN");
  if (du > 0 && formData.get("encaisse") !== "on") {
    return { ok: false, message: "Confirmez que le livreur a bien encaissé le montant dû." };
  }
  const reponse = await appelerApi(`/admin/courses/${id(courseId)}/cloturer`, {
    methode: "POST",
    corps: du > 0 ? { montant_encaisse: du } : {},
  });
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/admin/courses");
  revalidatePath("/admin/especes");
  if (!reponse.ok) return { ok: false, message: reponse.message };
  return { ok: true, message: "Course clôturée : livrée." };
}

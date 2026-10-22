"use server";

import { revalidatePath } from "next/cache";
import { appelerApi } from "@/lib/api";
import {
  TYPES_COURSE,
  VEHICULES,
  ZONES,
  type EtatAction,
  type LivraisonDetail,
  type ResultatTransmission,
} from "@/lib/types";

function texte(formData: FormData, nom: string): string {
  const valeur = formData.get(nom);
  return typeof valeur === "string" ? valeur.trim() : "";
}

function parmi<T extends string>(valeurs: readonly T[], valeur: string): valeur is T {
  return (valeurs as readonly string[]).includes(valeur);
}

/**
 * `datetime-local` ne porte pas de fuseau, et l'API exige ISO 8601 AVEC
 * fuseau. La saisie est une heure de Libreville : UTC+1, sans heure d'été.
 */
function versIsoGabon(valeur: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valeur)) return undefined;
  return `${valeur}:00+01:00`;
}

export async function creerCourse(_etat: EtatAction, formData: FormData): Promise<EtatAction> {
  const zoneDepart = texte(formData, "zone_depart");
  const zoneArrivee = texte(formData, "zone_arrivee");
  const typeCourse = texte(formData, "type_course");
  if (!parmi(ZONES, zoneDepart) || !parmi(ZONES, zoneArrivee)) {
    return { ok: false, message: "Choisissez une zone de départ et une zone d'arrivée." };
  }
  if (!parmi(TYPES_COURSE, typeCourse)) {
    return { ok: false, message: "Choisissez un type de course." };
  }

  const vehicule = texte(formData, "vehicule_requis");
  const dateSouhaitee = texte(formData, "date_souhaitee");

  // Un champ facultatif vide est OMIS, pas envoyé vide : l'API refuse une
  // adresse ou un contact d'enlèvement vide, et retombe sur le profil quand
  // ils sont absents.
  const enlevement = Object.fromEntries(
    (["adresse", "contact", "instructions"] as const)
      .map((cle) => [cle, texte(formData, `enlevement_${cle}`)] as const)
      .filter(([, valeur]) => valeur),
  );

  const corps = {
    zone_depart: zoneDepart,
    zone_arrivee: zoneArrivee,
    type_course: typeCourse,
    ...(Object.keys(enlevement).length > 0 ? { enlevement } : {}),
    destinataire: {
      nom: texte(formData, "destinataire_nom"),
      adresse: texte(formData, "destinataire_adresse"),
      contact: texte(formData, "destinataire_contact"),
    },
    colis: {
      description: texte(formData, "colis_description"),
      ...(parmi(VEHICULES, vehicule) ? { vehicule_requis: vehicule } : {}),
    },
    ...(dateSouhaitee && versIsoGabon(dateSouhaitee)
      ? { date_souhaitee: versIsoGabon(dateSouhaitee) }
      : {}),
  };

  const reponse = await appelerApi<ResultatTransmission>("/livraisons", {
    methode: "POST",
    corps,
  });
  if (!reponse.ok) {
    if (reponse.statut === 403) {
      return { ok: false, message: "Complétez d'abord votre profil boutique." };
    }
    return { ok: false, message: reponse.message };
  }

  revalidatePath("/courses");
  const { transmise, livraison } = reponse.donnees;
  return transmise
    ? { ok: true, id: livraison.id, message: "Course créée et transmise aux livreurs." }
    : {
        ok: true,
        id: livraison.id,
        avertissement: true,
        message: "Course enregistrée, mais pas encore transmise : le service de livraison est injoignable. Renvoyez-la dans un instant.",
      };
}

export async function renvoyerCourse(id: string, _etat: EtatAction): Promise<EtatAction> {
  const reponse = await appelerApi<ResultatTransmission>(
    `/livraisons/${encodeURIComponent(id)}/renvoyer`,
    { methode: "POST" },
  );
  revalidatePath(`/courses/${id}`);
  revalidatePath("/courses");
  if (!reponse.ok) return { ok: false, message: reponse.message };

  return reponse.donnees.transmise
    ? { ok: true, message: "Course transmise aux livreurs." }
    : {
        ok: true,
        avertissement: true,
        message: "Le service de livraison est toujours injoignable. Réessayez dans un instant.",
      };
}

export async function annulerCourse(id: string, _etat: EtatAction): Promise<EtatAction> {
  const reponse = await appelerApi<LivraisonDetail>(`/livraisons/${encodeURIComponent(id)}`, {
    methode: "DELETE",
  });
  revalidatePath(`/courses/${id}`);
  revalidatePath("/courses");
  if (!reponse.ok) return { ok: false, message: reponse.message };
  return { ok: true, message: "Course annulée." };
}

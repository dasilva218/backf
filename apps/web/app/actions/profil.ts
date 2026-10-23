"use server";

import { revalidatePath } from "next/cache";
import { appelerApi } from "@/lib/api";
import type { EtatAction, ProfilBoutique } from "@/lib/types";

function texte(formData: FormData, nom: string): string {
  const valeur = formData.get(nom);
  return typeof valeur === "string" ? valeur.trim() : "";
}

export async function enregistrerProfil(_etat: EtatAction, formData: FormData): Promise<EtatAction> {
  const firstname = texte(formData, "firstname");
  const lastname = texte(formData, "lastname");
  if (!firstname || !lastname) {
    return { ok: false, message: "Le prénom et le nom sont obligatoires." };
  }

  // Les champs facultatifs vides sont envoyés vides et non omis : c'est ce qui
  // permet d'effacer un téléphone déjà enregistré.
  const reponse = await appelerApi<ProfilBoutique>("/boutiques/moi", {
    methode: "PUT",
    corps: {
      firstname,
      lastname,
      phoneAirtel: texte(formData, "phoneAirtel"),
      phoneMoov: texte(formData, "phoneMoov"),
      address: texte(formData, "address"),
    },
  });
  if (!reponse.ok) return { ok: false, message: reponse.message };

  revalidatePath("/", "layout");
  return { ok: true, message: "Profil enregistré." };
}

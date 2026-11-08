"use server";

import { revalidatePath } from "next/cache";
import { appelerApi } from "@/lib/api";
import { TYPES_CLIENT, type EtatAction, type ProfilClient, type TypeClient } from "@/lib/types";

function texte(formData: FormData, nom: string): string {
  const valeur = formData.get(nom);
  return typeof valeur === "string" ? valeur.trim() : "";
}

function estTypeClient(valeur: string): valeur is TypeClient {
  return (TYPES_CLIENT as readonly string[]).includes(valeur);
}

export async function enregistrerProfil(_etat: EtatAction, formData: FormData): Promise<EtatAction> {
  const type = texte(formData, "type");
  const raisonSociale = texte(formData, "raisonSociale");
  const firstname = texte(formData, "firstname");
  const lastname = texte(formData, "lastname");
  if (!estTypeClient(type)) {
    return { ok: false, message: "Indiquez si vous êtes un particulier, une entreprise ou une boutique." };
  }
  if (type !== "PARTICULIER" && !raisonSociale) {
    return { ok: false, message: "Indiquez le nom de votre entreprise ou de votre boutique." };
  }
  if (!firstname || !lastname) {
    return { ok: false, message: "Le prénom et le nom sont obligatoires." };
  }

  // Les champs facultatifs vides sont envoyés vides et non omis : c'est ce qui
  // permet d'effacer un téléphone déjà enregistré.
  const reponse = await appelerApi<ProfilClient>("/clients/moi", {
    methode: "PUT",
    corps: {
      type,
      // L'API ignore la raison sociale d'un particulier ; on ne l'envoie pas.
      ...(type !== "PARTICULIER" ? { raisonSociale } : {}),
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

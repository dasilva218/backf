"use server";

import { redirect } from "next/navigation";
import { appelerApiPublique } from "@/lib/api";
import { lireChargeJeton } from "@/lib/jeton";
import { ACCUEIL_PAR_ROLE, estRoleEspace, fermerSession, ouvrirSession } from "@/lib/session";
import type { EtatAction } from "@/lib/types";

interface ReponseAuth {
  accessToken: string;
  role: string;
}

function texte(formData: FormData, nom: string): string {
  const valeur = formData.get(nom);
  return typeof valeur === "string" ? valeur.trim() : "";
}

export async function seConnecter(_etat: EtatAction, formData: FormData): Promise<EtatAction> {
  const email = texte(formData, "email").toLowerCase();
  const password = formData.get("password");
  if (!email || typeof password !== "string" || !password) {
    return { ok: false, message: "Saisissez votre e-mail et votre mot de passe." };
  }

  const reponse = await appelerApiPublique<ReponseAuth>("/auth/login", "POST", { email, password });
  if (!reponse.ok) {
    return {
      ok: false,
      message:
        reponse.statut === 401
          ? "E-mail ou mot de passe incorrect, ou compte inactif."
          : reponse.message,
    };
  }

  // Clients et administration ont chacun leur espace ici. Un LIVREUR passe par
  // l'application find_delivery_mobile : chaque écran du site lui répondrait
  // 403 ou vide.
  const role = lireChargeJeton(reponse.donnees.accessToken)?.role;
  if (!estRoleEspace(role)) {
    return { ok: false, message: "Les livreurs se connectent depuis l'application Avoo." };
  }

  await ouvrirSession(reponse.donnees.accessToken);
  redirect(ACCUEIL_PAR_ROLE[role]);
}

export async function sInscrire(_etat: EtatAction, formData: FormData): Promise<EtatAction> {
  const email = texte(formData, "email").toLowerCase();
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");

  if (!email || typeof password !== "string" || !password) {
    return { ok: false, message: "Saisissez votre e-mail et un mot de passe." };
  }
  if (password.length < 10) {
    return { ok: false, message: "Le mot de passe doit contenir au moins 10 caractères." };
  }
  if (password.length > 72) {
    return { ok: false, message: "Le mot de passe ne doit pas dépasser 72 caractères." };
  }
  if (password !== confirmation) {
    return { ok: false, message: "Les deux mots de passe ne correspondent pas." };
  }

  // Aucun rôle envoyé : l'API crée toujours un client et refuse ce champ.
  const reponse = await appelerApiPublique<ReponseAuth>("/auth/register", "POST", {
    email,
    password,
  });
  if (!reponse.ok) {
    return { ok: false, message: reponse.message };
  }

  await ouvrirSession(reponse.donnees.accessToken);
  redirect("/profil?bienvenue=1");
}

export async function seDeconnecter(): Promise<void> {
  await fermerSession();
  redirect("/connexion");
}

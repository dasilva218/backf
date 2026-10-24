import { redirect } from "next/navigation";

/** Pas de tableau de bord à part : le premier travail du bureau, ce sont les dossiers. */
export default function PageAdmin() {
  redirect("/admin/livreurs");
}

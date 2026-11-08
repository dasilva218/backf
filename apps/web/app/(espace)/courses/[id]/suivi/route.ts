import { appelerApiPourRoute } from "@/lib/api";
import { relayer } from "@/lib/reponse-route";
import type { SuiviCourse } from "@/lib/types";

/** Position du livreur d'une course du client, interrogée par la fiche toutes les 15 s. */
export async function GET(_requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return relayer(await appelerApiPourRoute<SuiviCourse>(`/livraisons/${encodeURIComponent(id)}/suivi`, "CLIENT"));
}

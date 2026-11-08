import { appelerApiPourRoute } from "@/lib/api";
import { relayer } from "@/lib/reponse-route";
import type { CarteAdmin } from "@/lib/types";

/** Courses en main des deux flottes, interrogées par la carte toutes les 15 s. */
export async function GET() {
  return relayer(await appelerApiPourRoute<CarteAdmin>("/admin/carte", "ADMIN"));
}

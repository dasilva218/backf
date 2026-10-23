import { Badge } from "@/components/ui/badge";
import { statutAffiche, type TonStatut } from "@/lib/affichage";
import type { Livraison } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONS: Record<TonStatut, string> = {
  attente: "border-statut-attente/30 bg-statut-attente/10 text-statut-attente",
  cours: "border-statut-cours/30 bg-statut-cours/10 text-statut-cours",
  recupere: "border-statut-recupere/30 bg-statut-recupere/10 text-statut-recupere",
  livree: "border-statut-livree/30 bg-statut-livree/10 text-statut-livree",
  alerte: "border-statut-alerte/40 bg-statut-alerte/10 text-statut-alerte",
  annulee: "border-statut-annulee/30 bg-statut-annulee/10 text-statut-annulee",
};

export function BadgeStatut({
  livraison,
  className,
}: {
  livraison: Pick<Livraison, "statut" | "statutEwuang" | "missionEwuangId">;
  className?: string;
}) {
  const { libelle, ton } = statutAffiche(livraison);
  return (
    <Badge variant="outline" className={cn(TONS[ton], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {libelle}
    </Badge>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function CourseIntrouvable() {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3">
        <p className="font-medium">Course introuvable</p>
        <p className="text-sm text-muted-foreground">
          Elle n&apos;existe pas, ou n&apos;appartient pas à votre boutique.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/courses">Retour à mes courses</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

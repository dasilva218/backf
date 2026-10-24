"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { creerCourse } from "@/app/actions/courses";
import { OverlayChargement } from "@/components/overlay-chargement";
import { useFormulaireAction } from "@/components/use-retour-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculerEncaissements, DESCRIPTIONS_TYPE, formaterMontant, LIBELLES_TYPE } from "@/lib/affichage";
import {
  PAYEURS,
  PLAFOND_MARCHANDISE,
  TYPES_COURSE,
  VEHICULES,
  ZONES,
  type Devis,
  type PayeurDemande,
  type ProfilClient,
  type TypeCourse,
  type Zone,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const LIBELLES_VEHICULE = { moto: "Moto", voiture: "Voiture", camionnette: "Camionnette" } as const;

const LIBELLES_PAYEUR: Record<PayeurDemande, { titre: string; detail: string }> = {
  expediteur: { titre: "L'expéditeur", detail: "En espèces, au livreur, à l'enlèvement du colis" },
  destinataire: { titre: "Le destinataire", detail: "En espèces, au livreur, à la remise du colis" },
};

/** Saisie libre du montant ; null quand elle n'est pas un entier valide. */
function lireMontant(saisie: string): number | null {
  const nettoyee = saisie.replace(/\s/g, "");
  if (nettoyee === "") return 0;
  const montant = Number(nettoyee);
  return Number.isInteger(montant) && montant >= 0 ? montant : null;
}

function Champ({
  id,
  libelle,
  aide,
  children,
}: {
  id: string;
  libelle: string;
  aide?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{libelle}</Label>
      {children}
      {aide && (
        <p id={`${id}-aide`} className="text-xs text-muted-foreground">
          {aide}
        </p>
      )}
    </div>
  );
}

export function FormulaireCourse({ grille, profil }: { grille: Devis[]; profil: ProfilClient }) {
  const router = useRouter();
  const [zoneDepart, setZoneDepart] = useState<Zone>("Libreville");
  const [zoneArrivee, setZoneArrivee] = useState<Zone>("Libreville");
  const [typeCourse, setTypeCourse] = useState<TypeCourse>("standard");
  // Pas de payeur par défaut : le choix revient au client (décision D3).
  const [payeur, setPayeur] = useState<PayeurDemande | null>(null);
  const [saisieMarchandise, setSaisieMarchandise] = useState("");

  const { soumettre, enCours } = useFormulaireAction(creerCourse, (etat) => {
    if (etat.id) router.push(`/courses/${etat.id}`);
  });

  const prix = (type: TypeCourse) =>
    grille.find((d) => d.zoneDepart === zoneDepart && d.zoneArrivee === zoneArrivee && d.typeCourse === type)?.tarif;

  const telephoneProfil = profil.phoneAirtel || profil.phoneMoov;

  const tarif = prix(typeCourse);
  const montantMarchandise = lireMontant(saisieMarchandise);
  const marchandiseInvalide = montantMarchandise === null || montantMarchandise > PLAFOND_MARCHANDISE;
  const encaissements =
    tarif !== undefined && payeur && !marchandiseInvalide
      ? calculerEncaissements(tarif, payeur === "expediteur" ? "EXPEDITEUR" : "DESTINATAIRE", montantMarchandise)
      : null;

  return (
    <form onSubmit={soumettre} className="grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
      <OverlayChargement visible={enCours} libelle="Envoi de la course…" />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Trajet</CardTitle>
            <CardDescription>Le prix dépend de la zone d&apos;arrivée et du type de course.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Champ id="zone_depart" libelle="Départ">
                <Select
                  id="zone_depart"
                  name="zone_depart"
                  value={zoneDepart}
                  onChange={(e) => setZoneDepart(e.target.value as Zone)}
                >
                  {ZONES.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </Select>
              </Champ>
              <Champ id="zone_arrivee" libelle="Arrivée">
                <Select
                  id="zone_arrivee"
                  name="zone_arrivee"
                  value={zoneArrivee}
                  onChange={(e) => setZoneArrivee(e.target.value as Zone)}
                >
                  {ZONES.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </Select>
              </Champ>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">Type de course</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {TYPES_COURSE.map((type) => (
                  <label
                    key={type}
                    className={cn(
                      "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors hover:bg-accent/50 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                      typeCourse === type && "border-primary bg-primary/5",
                    )}
                  >
                    <input
                      type="radio"
                      name="type_course"
                      value={type}
                      checked={typeCourse === type}
                      onChange={() => setTypeCourse(type)}
                      className="sr-only"
                    />
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{LIBELLES_TYPE[type]}</span>
                      <span className="text-sm font-semibold tabular-nums">{formaterMontant(prix(type))}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{DESCRIPTIONS_TYPE[type]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enlèvement</CardTitle>
            <CardDescription>Laissez vide pour utiliser les informations de votre profil.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Champ id="enlevement_adresse" libelle="Adresse d'enlèvement">
              <Input
                id="enlevement_adresse"
                name="enlevement_adresse"
                maxLength={255}
                placeholder={profil.address || "Quartier, repère…"}
              />
            </Champ>
            <Champ id="enlevement_contact" libelle="Téléphone de l'expéditeur">
              <Input
                id="enlevement_contact"
                name="enlevement_contact"
                type="tel"
                maxLength={50}
                placeholder={telephoneProfil || "+241…"}
              />
            </Champ>
            <Champ id="enlevement_instructions" libelle="Instructions pour le livreur (facultatif)">
              <Textarea
                id="enlevement_instructions"
                name="enlevement_instructions"
                maxLength={255}
                placeholder="Ex. : demander Marc à l'accueil"
              />
            </Champ>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Destinataire</CardTitle>
            <CardDescription>
              Le code de remise devra lui être transmis : le livreur le lui demandera à la livraison.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Champ id="destinataire_nom" libelle="Nom">
              <Input id="destinataire_nom" name="destinataire_nom" maxLength={120} required autoComplete="off" />
            </Champ>
            <Champ id="destinataire_contact" libelle="Téléphone">
              <Input
                id="destinataire_contact"
                name="destinataire_contact"
                type="tel"
                maxLength={50}
                required
                placeholder="+241…"
              />
            </Champ>
            <Champ id="destinataire_adresse" libelle="Adresse de livraison">
              <Textarea
                id="destinataire_adresse"
                name="destinataire_adresse"
                maxLength={255}
                required
                placeholder="Quartier, rue, repère visible…"
              />
            </Champ>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Colis</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Champ id="colis_description" libelle="Description" aide="Affichée au livreur.">
              <Input
                id="colis_description"
                name="colis_description"
                maxLength={255}
                required
                placeholder="Ex. : 2 cartons de fournitures"
                aria-describedby="colis_description-aide"
              />
            </Champ>
            <div className="grid gap-4 sm:grid-cols-2">
              <Champ
                id="vehicule_requis"
                libelle="Véhicule requis"
                aide="Exiger un véhicule réduit le nombre de livreurs disponibles."
              >
                <Select id="vehicule_requis" name="vehicule_requis" defaultValue="" aria-describedby="vehicule_requis-aide">
                  <option value="">Indifférent</option>
                  {VEHICULES.map((v) => (
                    <option key={v} value={v}>
                      {LIBELLES_VEHICULE[v]}
                    </option>
                  ))}
                </Select>
              </Champ>
              <Champ id="date_souhaitee" libelle="Date souhaitée (facultatif)" aide="Indicative, heure de Libreville.">
                <Input
                  id="date_souhaitee"
                  name="date_souhaitee"
                  type="datetime-local"
                  aria-describedby="date_souhaitee-aide"
                />
              </Champ>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paiement</CardTitle>
            <CardDescription>La course se paie en espèces, au livreur.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">Qui paie la course ?</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {PAYEURS.map((p) => (
                  <label
                    key={p}
                    className={cn(
                      "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors hover:bg-accent/50 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                      payeur === p && "border-primary bg-primary/5",
                    )}
                  >
                    <input
                      type="radio"
                      name="payeur"
                      value={p}
                      checked={payeur === p}
                      onChange={() => setPayeur(p)}
                      required
                      className="sr-only"
                    />
                    <span className="text-sm font-medium">{LIBELLES_PAYEUR[p].titre}</span>
                    <span className="text-xs text-muted-foreground">{LIBELLES_PAYEUR[p].detail}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <Champ
              id="montant_marchandise"
              libelle="Prix de la marchandise à encaisser (facultatif)"
              aide={`Le livreur l'encaisse auprès du destinataire, à la remise, et nous vous le reversons. ${formaterMontant(PLAFOND_MARCHANDISE)} au plus. Laissez vide si le destinataire n'a rien à payer pour la marchandise.`}
            >
              <Input
                id="montant_marchandise"
                name="montant_marchandise"
                inputMode="numeric"
                value={saisieMarchandise}
                onChange={(e) => setSaisieMarchandise(e.target.value)}
                placeholder="0"
                aria-describedby="montant_marchandise-aide"
                aria-invalid={marchandiseInvalide}
              />
            </Champ>
            {marchandiseInvalide && (
              <p role="alert" className="-mt-3 text-xs text-destructive">
                Saisissez un nombre entier de FCFA, {formaterMontant(PLAFOND_MARCHANDISE)} au plus.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <aside className="lg:sticky lg:top-24">
        <Card>
          <CardHeader>
            <CardTitle>Récapitulatif</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Trajet</dt>
                <dd className="flex items-center gap-1 font-medium">
                  {zoneDepart} <ArrowRight className="size-3" aria-label="vers" /> {zoneArrivee}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Type</dt>
                <dd className="font-medium">{LIBELLES_TYPE[typeCourse]}</dd>
              </div>
            </dl>
            <div className="flex items-baseline justify-between border-t pt-4">
              <span className="text-sm text-muted-foreground">Prix de la course</span>
              <span className="text-2xl font-semibold tabular-nums" aria-live="polite">
                {formaterMontant(tarif)}
              </span>
            </div>
            <dl className="flex flex-col gap-2 text-sm" aria-live="polite">
              {encaissements ? (
                <>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Encaissé à l&apos;enlèvement</dt>
                    <dd className="font-medium tabular-nums">{formaterMontant(encaissements.enlevement)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Encaissé à la remise</dt>
                    <dd className="font-medium tabular-nums">{formaterMontant(encaissements.remise)}</dd>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Indiquez qui paie pour voir ce que le livreur encaissera.</p>
              )}
            </dl>
            <Button type="submit" size="lg" disabled={enCours || marchandiseInvalide}>
              Envoyer la course
            </Button>
          </CardContent>
        </Card>
      </aside>
    </form>
  );
}

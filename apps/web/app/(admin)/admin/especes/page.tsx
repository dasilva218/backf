import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { appelerApi, type ReponseApi } from "@/lib/api";
import { formaterDate, formaterMontant, LIBELLES_TYPE_CLIENT } from "@/lib/affichage";
import type { DuClient, EncoursLivreur, MouvementEspeces, ReleveEwuang } from "@/lib/types";
import { FormulaireReglement } from "./formulaire-reglement";

export const metadata: Metadata = { title: "Espèces" };

/** Libellés du registre, du point de vue du bureau. */
const LIBELLES_MOUVEMENT: Record<string, string> = {
  ENCAISSEMENT: "Encaissé par le livreur",
  REMUNERATION: "Gain du livreur",
  VERSEMENT: "Versé par le livreur",
  PAIEMENT_LIVREUR: "Payé au livreur",
  MARCHANDISE: "Marchandise due au client",
  REVERSEMENT: "Reversé au client",
  ENCAISSEMENT_EWUANG: "Encaissé par un livreur Ewuang",
  TARIF_EWUANG: "Coût de la course chez Ewuang",
  REGLEMENT_EWUANG_RECU: "Réglé par Ewuang",
  REGLEMENT_EWUANG_VERSE: "Réglé à Ewuang",
};

/**
 * Le registre des espèces : qui doit combien à qui.
 *
 * Quatre lectures en parallèle ; chacune peut échouer seule sans masquer les
 * autres (une section en erreur dit pourquoi, les autres restent lisibles).
 */
export default async function PageEspeces() {
  const [livreurs, clients, ewuang, journal] = await Promise.all([
    appelerApi<EncoursLivreur[]>("/admin/especes/livreurs"),
    appelerApi<DuClient[]>("/admin/especes/clients"),
    appelerApi<ReleveEwuang>("/admin/especes/ewuang"),
    appelerApi<MouvementEspeces[]>("/admin/especes/mouvements?limite=50"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Espèces</h1>
        <p className="text-sm text-muted-foreground">
          Chaque règlement s&apos;enregistre contre un reçu papier, dont le numéro ne peut servir qu&apos;une fois. Le
          registre ne se modifie pas : une erreur se corrige par le règlement inverse.
        </p>
      </div>

      <Section titre="Livreurs" description="Espèces que nos livreurs détiennent. Au-delà de 50 000 FCFA ou après 48 h sans versement, ils ne reçoivent plus de nouvelle course." reponse={livreurs}>
        {(lignes) =>
          lignes.length === 0 ? (
            <Vide texte="Aucun livreur n'a encore manipulé d'espèces." />
          ) : (
            <ul className="divide-y">
              {lignes.map((l) => {
                const nom = l.livreur ? `${l.livreur.firstname} ${l.livreur.lastname}` : "Livreur inconnu";
                const id = l.livreur?.id;
                return (
                  <li key={id ?? nom} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-medium">{nom}</span>
                      <span className="text-sm text-muted-foreground">
                        {l.solde > 0
                          ? `Doit ${formaterMontant(l.solde)}${l.echeance ? ` · avant le ${formaterDate(l.echeance)}` : ""}`
                          : l.solde < 0
                            ? `find_delivery lui doit ${formaterMontant(-l.solde)}`
                            : "Soldé"}
                      </span>
                      {l.blocage && (
                        <span className="flex items-start gap-1 text-sm text-destructive">
                          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                          {l.blocage}
                        </span>
                      )}
                    </div>
                    {id && l.solde > 0 && (
                      <FormulaireReglement
                        type="versement"
                        compteId={id}
                        libelle="Enregistrer un versement"
                        titre={`Versement de ${nom}`}
                        description="Le livreur remet des espèces au bureau."
                        maximum={l.solde}
                      />
                    )}
                    {id && l.solde < 0 && (
                      <FormulaireReglement
                        type="paiement"
                        compteId={id}
                        libelle="Payer le livreur"
                        titre={`Paiement à ${nom}`}
                        description="Le bureau paie ce que find_delivery doit au livreur (un retour qui a coûté plus que la course)."
                        maximum={-l.solde}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )
        }
      </Section>

      <Section titre="Clients" description="Prix des marchandises encaissé à la remise, par nos livreurs ou ceux d'Ewuang, et pas encore reversé." reponse={clients}>
        {(lignes) =>
          lignes.length === 0 ? (
            <Vide texte="Aucune marchandise à reverser." />
          ) : (
            <ul className="divide-y">
              {lignes.map((c) => {
                const nom = c.client
                  ? c.client.raisonSociale || `${c.client.firstname} ${c.client.lastname}`
                  : "Client inconnu";
                return (
                  <li key={c.client?.id ?? nom} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        {nom}
                        {c.client && <Badge variant="outline">{LIBELLES_TYPE_CLIENT[c.client.type]}</Badge>}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        À reverser : {formaterMontant(c.du)}
                        {c.client ? ` · ${[c.client.phoneAirtel, c.client.phoneMoov].filter(Boolean).join(" · ")}` : ""}
                      </span>
                    </div>
                    {c.client && c.du > 0 && (
                      <FormulaireReglement
                        type="reversement"
                        compteId={c.client.id}
                        libelle="Reverser"
                        titre={`Reversement à ${nom}`}
                        description="Le bureau remet au client le prix de ses marchandises."
                        maximum={c.du}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )
        }
      </Section>

      <Section titre="Ewuang" description="Ce que les livreurs Ewuang ont encaissé sur nos courses, moins ce que ces courses lui coûtent : c'est le relevé entre Ewuang et find_delivery." reponse={ewuang}>
        {(releve) => (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-lg font-semibold tabular-nums">
                {releve.du > 0
                  ? `Ewuang nous doit ${formaterMontant(releve.du)}`
                  : releve.du < 0
                    ? `Nous devons ${formaterMontant(-releve.du)} à Ewuang`
                    : "Relevé soldé"}
              </p>
              {releve.du > 0 && (
                <FormulaireReglement
                  type="ewuangRecu"
                  compteId="ewuang"
                  libelle="Enregistrer son règlement"
                  titre="Règlement reçu d'Ewuang"
                  description="Ewuang remet ce que ses livreurs ont encaissé pour nous."
                  maximum={releve.du}
                />
              )}
              {releve.du < 0 && (
                <FormulaireReglement
                  type="ewuangVerse"
                  compteId="ewuang"
                  libelle="Enregistrer notre règlement"
                  titre="Règlement versé à Ewuang"
                  description="Nous réglons ce que nos courses ont coûté à Ewuang au-delà de ce qu'il a encaissé."
                  maximum={-releve.du}
                />
              )}
            </div>
            <ListeMouvements mouvements={releve.mouvements} vide="Aucun mouvement avec Ewuang." />
          </div>
        )}
      </Section>

      <Section titre="Journal" description="Les 50 derniers mouvements, tous comptes confondus." reponse={journal}>
        {(mouvements) => <ListeMouvements mouvements={mouvements} vide="Le registre est vide." />}
      </Section>
    </div>
  );
}

function Section<T>({
  titre,
  description,
  reponse,
  children,
}: {
  titre: string;
  description: string;
  reponse: ReponseApi<T>;
  children: (donnees: T) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titre}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {reponse.ok ? (
          children(reponse.donnees)
        ) : (
          <p className="text-sm text-destructive">Lecture impossible : {reponse.message}</p>
        )}
      </CardContent>
    </Card>
  );
}

function Vide({ texte }: { texte: string }) {
  return <p className="py-4 text-center text-sm text-muted-foreground">{texte}</p>;
}

function ListeMouvements({ mouvements, vide }: { mouvements: MouvementEspeces[]; vide: string }) {
  if (mouvements.length === 0) return <Vide texte={vide} />;
  return (
    <ul className="divide-y text-sm">
      {mouvements.map((m) => (
        <li key={m.id} className="flex items-start justify-between gap-4 py-2">
          <div className="flex min-w-0 flex-col">
            <span>{LIBELLES_MOUVEMENT[m.type] ?? m.type}</span>
            <span className="text-xs text-muted-foreground">
              {[
                m.referenceCourse ? `Course ${m.referenceCourse}` : null,
                m.recu ? `Reçu ${m.recu}` : null,
                m.note,
                formaterDate(m.createdAt),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          <span className="shrink-0 font-medium tabular-nums">{formaterMontant(m.montant)}</span>
        </li>
      ))}
    </ul>
  );
}

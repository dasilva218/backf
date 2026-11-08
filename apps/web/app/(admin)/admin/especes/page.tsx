import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { appelerApi, type ReponseApi } from "@/lib/api";
import { formaterDate, formaterMontant, LIBELLES_TYPE_CLIENT } from "@/lib/affichage";
import type { DuClient, EcartEwuang, EncoursLivreur, MouvementEspeces, ReleveEwuang } from "@/lib/types";
import { cn } from "@/lib/utils";
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
  const [livreurs, clients, ewuang, journal, ecarts] = await Promise.all([
    appelerApi<EncoursLivreur[]>("/admin/especes/livreurs"),
    appelerApi<DuClient[]>("/admin/especes/clients"),
    appelerApi<ReleveEwuang>("/admin/especes/ewuang"),
    appelerApi<MouvementEspeces[]>("/admin/especes/mouvements?limite=50"),
    appelerApi<EcartEwuang[]>("/admin/especes/ewuang/ecarts"),
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

      <Synthese livreurs={livreurs} clients={clients} ewuang={ewuang} ecarts={ecarts} />

      <EcartsEwuang reponse={ecarts} />

      <Section
        titre="Livreurs"
        description="Espèces que nos livreurs détiennent. Au-delà de 50 000 FCFA ou après 48 h sans versement, ils ne reçoivent plus de nouvelle course."
        reponse={livreurs}
      >
        {(lignes) =>
          lignes.length === 0 ? (
            <Vide texte="Aucun livreur n'a encore manipulé d'espèces." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Livreur</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead>À verser avant le</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map((l) => {
                  const nom = l.livreur ? `${l.livreur.firstname} ${l.livreur.lastname}` : "Livreur inconnu";
                  const id = l.livreur?.id;
                  return (
                    <TableRow key={id ?? nom}>
                      <TableCell className="whitespace-nowrap font-medium">{nom}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        <Solde valeur={l.solde} positif="doit" negatif="lui est dû" />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {l.solde > 0 && l.echeance ? formaterDate(l.echeance) : "—"}
                      </TableCell>
                      <TableCell>
                        {l.blocage ? (
                          <span className="flex max-w-72 items-start gap-1 text-destructive">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                            {l.blocage}
                          </span>
                        ) : (
                          <Badge variant="outline" className="border-primary/40 text-primary">
                            Peut rouler
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
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
                            description="Le bureau paie ce qu'Avoo doit au livreur (un retour qui a coûté plus que la course)."
                            maximum={-l.solde}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )
        }
      </Section>

      <Section
        titre="Clients"
        description="Prix des marchandises encaissé à la remise, par nos livreurs ou ceux d'Ewuang, et pas encore reversé."
        reponse={clients}
      >
        {(lignes) =>
          lignes.length === 0 ? (
            <Vide texte="Aucune marchandise à reverser." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead className="text-right">À reverser</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map((c) => {
                  const nom = c.client
                    ? c.client.raisonSociale || `${c.client.firstname} ${c.client.lastname}`
                    : "Client inconnu";
                  return (
                    <TableRow key={c.client?.id ?? nom}>
                      <TableCell className="whitespace-nowrap font-medium">{nom}</TableCell>
                      <TableCell>
                        {c.client ? <Badge variant="outline">{LIBELLES_TYPE_CLIENT[c.client.type]}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                        {c.client ? [c.client.phoneAirtel, c.client.phoneMoov].filter(Boolean).join(" · ") || "—" : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">
                        {formaterMontant(c.du)}
                      </TableCell>
                      <TableCell className="text-right">
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
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )
        }
      </Section>

      <Section
        titre="Ewuang"
        description="Ce que les livreurs Ewuang ont encaissé sur nos courses, moins ce que ces courses lui coûtent : c'est le relevé entre Ewuang et Avoo."
        reponse={ewuang}
        action={(releve) =>
          releve.du > 0 ? (
            <FormulaireReglement
              type="ewuangRecu"
              compteId="ewuang"
              libelle="Enregistrer son règlement"
              titre="Règlement reçu d'Ewuang"
              description="Ewuang remet ce que ses livreurs ont encaissé pour nous."
              maximum={releve.du}
            />
          ) : releve.du < 0 ? (
            <FormulaireReglement
              type="ewuangVerse"
              compteId="ewuang"
              libelle="Enregistrer notre règlement"
              titre="Règlement versé à Ewuang"
              description="Nous réglons ce que nos courses ont coûté à Ewuang au-delà de ce qu'il a encaissé."
              maximum={-releve.du}
            />
          ) : null
        }
      >
        {(releve) => <TableMouvements mouvements={releve.mouvements} vide="Aucun mouvement avec Ewuang." />}
      </Section>

      <Section titre="Journal" description="Les 50 derniers mouvements, tous comptes confondus." reponse={journal}>
        {(mouvements) => <TableMouvements mouvements={mouvements} vide="Le registre est vide." />}
      </Section>
    </div>
  );
}

/** Les trois montants que le bureau suit au quotidien ; une lecture en échec affiche « — ». */
function Synthese({
  livreurs,
  clients,
  ewuang,
  ecarts,
}: {
  livreurs: ReponseApi<EncoursLivreur[]>;
  clients: ReponseApi<DuClient[]>;
  ewuang: ReponseApi<ReleveEwuang>;
  ecarts: ReponseApi<EcartEwuang[]>;
}) {
  const detenu = livreurs.ok ? livreurs.donnees.reduce((s, l) => s + Math.max(0, l.solde), 0) : null;
  const bloques = livreurs.ok ? livreurs.donnees.filter((l) => l.blocage).length : null;
  const aReverser = clients.ok ? clients.donnees.reduce((s, c) => s + c.du, 0) : null;
  const releve = ewuang.ok ? ewuang.donnees.du : null;
  const nbEcarts = ecarts.ok ? ecarts.donnees.length : 0;

  const tuiles = [
    {
      libelle: "Détenu par nos livreurs",
      valeur: detenu,
      detail: bloques ? `${bloques} livreur${bloques > 1 ? "s" : ""} bloqué${bloques > 1 ? "s" : ""}` : "Aucun livreur bloqué",
      alerte: Boolean(bloques),
    },
    { libelle: "À reverser aux clients", valeur: aReverser, detail: "Prix des marchandises", alerte: false },
    {
      libelle: releve !== null && releve < 0 ? "Dû à Ewuang" : "Dû par Ewuang",
      valeur: releve === null ? null : Math.abs(releve),
      detail:
        nbEcarts > 0
          ? `Faussé : ${nbEcarts} encaissement${nbEcarts > 1 ? "s" : ""} à vérifier`
          : "Relevé entre les deux flottes",
      alerte: nbEcarts > 0,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {tuiles.map((t) => (
        <Card key={t.libelle} className="gap-1 px-5 py-4">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t.libelle}</span>
          <span className="text-2xl font-semibold tabular-nums">{t.valeur === null ? "—" : formaterMontant(t.valeur)}</span>
          <span className={cn("text-xs text-muted-foreground", t.alerte && "text-destructive")}>{t.detail}</span>
        </Card>
      ))}
    </div>
  );
}

const LIBELLES_ETAPE: Record<EcartEwuang["etape"], string> = {
  enlevement: "Enlèvement",
  remise: "Remise",
  retour: "Retour",
};

/**
 * Encaissements de livreurs Ewuang absents ou faux au registre. Rendu seulement
 * s'il y en a (ou si la lecture échoue) : c'est une alerte, pas une section.
 */
function EcartsEwuang({ reponse }: { reponse: ReponseApi<EcartEwuang[]> }) {
  if (reponse.ok && reponse.donnees.length === 0) return null;
  return (
    <Card className="gap-4 overflow-hidden border-destructive/40 pb-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <AlertTriangle className="size-4" aria-hidden />
          Encaissements Ewuang à vérifier
        </CardTitle>
        <CardDescription>
          Ewuang a signalé ces étapes sans le montant encaissé attendu : le coût de la course est inscrit, pas
          l&apos;argent reçu par son livreur, et le relevé Ewuang penche à tort en sa faveur. Vérifiez avec Ewuang
          avant tout règlement.
        </CardDescription>
      </CardHeader>
      <div className="border-t">
        {!reponse.ok ? (
          <p className="px-6 py-4 text-sm text-destructive">Lecture impossible : {reponse.message}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Course</TableHead>
                <TableHead>Étape</TableHead>
                <TableHead>Le</TableHead>
                <TableHead>Livreur Ewuang</TableHead>
                <TableHead className="text-right">Attendu</TableHead>
                <TableHead className="text-right">Inscrit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reponse.donnees.map((e) => (
                <TableRow key={`${e.livraisonId}:${e.etape}`}>
                  <TableCell className="whitespace-nowrap">
                    <Link href={`/admin/courses/${e.livraisonId}`} className="font-medium hover:text-primary hover:underline">
                      {e.numero}
                    </Link>
                    {e.statutEwuang && <span className="block text-xs text-muted-foreground">{e.statutEwuang}</span>}
                  </TableCell>
                  <TableCell>{LIBELLES_ETAPE[e.etape]}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formaterDate(e.faitAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">{e.livreurNom ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">
                    {formaterMontant(e.attendu)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-destructive">
                    {formaterMontant(e.inscrit)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Card>
  );
}

function Section<T>({
  titre,
  description,
  reponse,
  action,
  children,
}: {
  titre: string;
  description: string;
  reponse: ReponseApi<T>;
  action?: (donnees: T) => React.ReactNode;
  children: (donnees: T) => React.ReactNode;
}) {
  return (
    <Card className="gap-4 overflow-hidden pb-0">
      <CardHeader className="sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-base">{titre}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {reponse.ok && action && <div className="sm:row-span-2 sm:self-center">{action(reponse.donnees)}</div>}
      </CardHeader>
      <div className="border-t">
        {reponse.ok ? (
          children(reponse.donnees)
        ) : (
          <p className="px-6 py-4 text-sm text-destructive">Lecture impossible : {reponse.message}</p>
        )}
      </div>
    </Card>
  );
}

function Vide({ texte }: { texte: string }) {
  return <p className="px-6 py-6 text-center text-sm text-muted-foreground">{texte}</p>;
}

/** Un solde signé : positif = le compte doit au bureau, négatif = le bureau lui doit. */
function Solde({ valeur, positif, negatif }: { valeur: number; positif: string; negatif: string }) {
  if (valeur === 0) return <span className="text-muted-foreground">Soldé</span>;
  return (
    <span className="flex flex-col items-end">
      <span className="font-semibold">{formaterMontant(Math.abs(valeur))}</span>
      <span className="text-xs text-muted-foreground">{valeur > 0 ? positif : negatif}</span>
    </span>
  );
}

function TableMouvements({ mouvements, vide }: { mouvements: MouvementEspeces[]; vide: string }) {
  if (mouvements.length === 0) return <Vide texte={vide} />;
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Date</TableHead>
          <TableHead>Mouvement</TableHead>
          <TableHead>Course</TableHead>
          <TableHead>Reçu</TableHead>
          <TableHead>Note</TableHead>
          <TableHead className="text-right">Montant</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {mouvements.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="whitespace-nowrap text-muted-foreground">{formaterDate(m.createdAt)}</TableCell>
            <TableCell className="whitespace-nowrap">{LIBELLES_MOUVEMENT[m.type] ?? m.type}</TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">{m.referenceCourse ?? "—"}</TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">{m.recu ?? "—"}</TableCell>
            <TableCell className="max-w-64 truncate text-muted-foreground" title={m.note ?? undefined}>
              {m.note ?? "—"}
            </TableCell>
            <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
              {formaterMontant(m.montant)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Article, DocumentLegal, Valeur } from "@/components/legal";
import { EDITEUR } from "@/lib/editeur";

export const metadata: Metadata = { title: "Mentions légales" };

export default function PageMentionsLegales() {
  return (
    <DocumentLegal
      titre="Mentions légales"
      intro="Informations sur l'éditeur et l'hébergeur du service find_delivery, publiées conformément à la loi n°025/2021 du 28 décembre 2021 relative aux transactions électroniques en République gabonaise."
    >
      <Article id="editeur" titre="1. Éditeur">
        <ul>
          <li>
            Dénomination : <Valeur valeur={EDITEUR.raisonSociale} quoi="raison sociale" />
          </li>
          <li>
            Forme juridique et capital : <Valeur valeur={EDITEUR.formeJuridique} quoi="forme juridique" />
          </li>
          <li>
            RCCM : <Valeur valeur={EDITEUR.rccm} quoi="n° RCCM" />
          </li>
          <li>
            NIF : <Valeur valeur={EDITEUR.nif} quoi="n° NIF" />
          </li>
          <li>
            Siège social : <Valeur valeur={EDITEUR.siege} quoi="adresse du siège" />
          </li>
          <li>
            E-mail : <Valeur valeur={EDITEUR.email} quoi="e-mail de contact" />
          </li>
          <li>
            Téléphone : <Valeur valeur={EDITEUR.telephone} quoi="téléphone" />
          </li>
        </ul>
      </Article>

      <Article id="directeur" titre="2. Directeur de la publication">
        <p>
          <Valeur valeur={EDITEUR.directeurPublication} quoi="nom du directeur de la publication" />
        </p>
      </Article>

      <Article id="hebergement" titre="3. Hébergement">
        <ul>
          <li>
            Site web et serveur applicatif : <Valeur valeur={EDITEUR.hebergeurSite} quoi="hébergeur et adresse" />
          </li>
          <li>Base de données : Neon, sur l&apos;infrastructure Amazon Web Services, région us-east-2 (États-Unis).</li>
        </ul>
      </Article>

      <Article id="service" titre="4. Le service">
        <p>
          find_delivery met en relation des clients (particuliers, entreprises, boutiques) avec des livreurs pour la
          livraison de colis à Libreville, Akanda et Owendo. Les courses sont exécutées par des livreurs indépendants
          inscrits sur find_delivery, ou par les livreurs de son partenaire Ewuang. Les conditions du service sont
          décrites dans les <Link href="/conditions-utilisation">conditions d&apos;utilisation</Link>.
        </p>
      </Article>

      <Article id="propriete" titre="5. Propriété intellectuelle">
        <p>
          Le nom find_delivery, le logo, les textes et l&apos;interface du site sont la propriété de l&apos;éditeur. Toute
          reproduction ou réutilisation sans son accord écrit est interdite.
        </p>
      </Article>

      <Article id="donnees" titre="6. Données personnelles">
        <p>
          Le traitement des données personnelles est décrit dans la{" "}
          <Link href="/confidentialite">politique de confidentialité</Link>.
        </p>
      </Article>
    </DocumentLegal>
  );
}

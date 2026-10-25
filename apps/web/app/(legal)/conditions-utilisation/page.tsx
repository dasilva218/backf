import type { Metadata } from "next";
import Link from "next/link";
import { Article, DocumentLegal, Valeur } from "@/components/legal";
import { formaterMontant } from "@/lib/affichage";
import { EDITEUR } from "@/lib/editeur";
import { PLAFOND_MARCHANDISE } from "@/lib/types";

export const metadata: Metadata = { title: "Conditions d'utilisation" };

/**
 * Les règles décrites ici sont celles que l'API applique (PLAN_LANCEMENT.md,
 * règles R1 à R7) : un changement de règle dans le code doit être reporté ici,
 * avec la date de MISE_A_JOUR_LEGALE.
 */

/** Plafond des espèces détenues par un livreur indépendant (src/especes/especes.ts, côté API). */
const PLAFOND_ENCOURS = 50_000;

export default function PageConditions() {
  return (
    <DocumentLegal
      titre="Conditions d'utilisation"
      intro={
        <>
          Ces conditions régissent l&apos;utilisation de find_delivery, édité par{" "}
          <Valeur valeur={EDITEUR.raisonSociale} quoi="raison sociale" /> (voir les{" "}
          <Link href="/mentions-legales">mentions légales</Link>). Créer un compte ou commander une course vaut
          acceptation de ces conditions.
        </>
      }
    >
      <Article id="article-1" titre="1. Le service">
        <p>
          find_delivery met en relation des clients — particuliers, entreprises et boutiques — avec des livreurs, pour la
          livraison de colis entre Libreville, Akanda et Owendo. Une course est proposée en même temps aux livreurs
          indépendants inscrits sur find_delivery et aux livreurs de notre partenaire Ewuang : le premier livreur qui
          l&apos;accepte l&apos;exécute.
        </p>
      </Article>

      <Article id="article-2" titre="2. Compte">
        <ul>
          <li>Un compte s&apos;ouvre avec une adresse e-mail et un mot de passe d&apos;au moins 10 caractères.</li>
          <li>
            Vous vous engagez à fournir des informations exactes (nom, téléphone, raison sociale pour une entreprise ou
            une boutique) et à les tenir à jour.
          </li>
          <li>
            Vous êtes responsable de la confidentialité de votre mot de passe et des courses commandées depuis votre
            compte.
          </li>
          <li>Un compte peut être suspendu en cas de manquement à ces conditions ou d&apos;usage frauduleux.</li>
        </ul>
      </Article>

      <Article id="article-3" titre="3. Commande d'une course">
        <ul>
          <li>
            Vous indiquez la zone d&apos;enlèvement et d&apos;arrivée, le type de course, le destinataire (nom, adresse,
            téléphone) et la description du colis.
          </li>
          <li>
            Le prix s&apos;affiche avant l&apos;envoi de la course. C&apos;est le prix définitif : il ne change pas une fois
            la course commandée.
          </li>
          <li>
            Une course <strong>express</strong> est proposée en priorité aux livreurs, mais aucun délai de livraison
            n&apos;est garanti, quel que soit le type de course.
          </li>
          <li>
            Le colis doit correspondre à sa description, être emballé pour le transport et être prêt au moment de
            l&apos;enlèvement.
          </li>
        </ul>
      </Article>

      <Article id="article-4" titre="4. Objets interdits">
        <p>Il est interdit de confier à un livreur :</p>
        <ul>
          <li>des objets dont la détention ou le transport est interdit par la loi gabonaise ;</li>
          <li>des matières dangereuses, inflammables ou explosives, des armes et des munitions ;</li>
          <li>des espèces, des métaux précieux ou des titres au porteur ;</li>
          <li>des animaux vivants, ou des denrées périssables sans emballage adapté.</li>
        </ul>
        <p>Le livreur peut refuser un colis qui ne correspond pas à sa description ou qui lui paraît relever de cette liste.</p>
      </Article>

      <Article id="article-5" titre="5. Paiement en espèces">
        <ul>
          <li>
            La course se paie en espèces, au livreur. À la commande, vous choisissez qui paie : l&apos;expéditeur, à
            l&apos;enlèvement, ou le destinataire, à la remise.
          </li>
          <li>
            <strong>Contre-remboursement</strong> : vous pouvez demander au livreur d&apos;encaisser auprès du destinataire,
            à la remise, le prix de votre marchandise, jusqu&apos;à {formaterMontant(PLAFOND_MARCHANDISE)} par course. Ce
            montant vous est ensuite reversé par find_delivery, contre reçu. Il apparaît dans votre espace tant
            qu&apos;il ne vous a pas été reversé.
          </li>
          <li>
            Le livreur encaisse le montant exact indiqué dans la course. Sans ce paiement, le colis n&apos;est pas enlevé
            ou pas remis.
          </li>
        </ul>
      </Article>

      <Article id="article-6" titre="6. Remise du colis et code de remise">
        <ul>
          <li>
            Chaque course a un code à 4 chiffres, que vous transmettez à votre destinataire. Le livreur ne remet le colis
            que contre ce code : c&apos;est la preuve de la remise.
          </li>
          <li>
            Après 5 codes faux, la course est bloquée : elle ne peut plus être clôturée que par find_delivery, après avoir
            joint le destinataire et le livreur.
          </li>
          <li>Ne communiquez le code qu&apos;au destinataire : un colis remis contre le bon code est réputé livré.</li>
        </ul>
      </Article>

      <Article id="article-7" titre="7. Annulation">
        <p>
          Vous pouvez annuler une course depuis votre espace, sans frais, tant que le livreur n&apos;a pas récupéré le
          colis. Une fois le colis récupéré, la course ne s&apos;annule plus.
        </p>
      </Article>

      <Article id="article-8" titre="8. Destinataire absent et retour à l'expéditeur">
        <ul>
          <li>
            Arrivé à destination, le livreur le signale et attend. S&apos;il ne peut pas remettre le colis (destinataire
            absent, injoignable, refus, code inconnu), il peut déclarer l&apos;échec de la remise au plus tôt 10 minutes
            après son arrivée.
          </li>
          <li>Le colis est alors rapporté à l&apos;expéditeur.</li>
          <li>
            Le retour n&apos;est pas facturé en plus. Si la course devait être payée par le destinataire, l&apos;expéditeur
            la paie au livreur au retour du colis ; s&apos;il l&apos;a déjà payée à l&apos;enlèvement, il ne doit rien de
            plus.
          </li>
        </ul>
      </Article>

      <Article id="article-9" titre="9. Livreurs indépendants">
        <p>Les livreurs qui s&apos;inscrivent sur l&apos;application find_delivery s&apos;engagent en outre à :</p>
        <ul>
          <li>faire vérifier leur dossier au bureau, pièces en main : aucune course ne leur est proposée avant ;</li>
          <li>encaisser le montant exact indiqué à chaque étape, et ne jamais remettre un colis sans le code ;</li>
          <li>
            verser à find_delivery les espèces encaissées pour son compte au plus tard 48 heures après chaque
            encaissement. Au-delà de ce délai, ou dès {formaterMontant(PLAFOND_ENCOURS)} détenus, aucune nouvelle course ne
            leur est proposée jusqu&apos;au versement ;
          </li>
          <li>conserver leur position partagée pendant une course, pour son suivi.</li>
        </ul>
        <p>Les règlements entre un livreur et find_delivery se font au bureau, contre reçu.</p>
      </Article>

      <Article id="article-10" titre="10. Responsabilité">
        <ul>
          <li>
            find_delivery met à disposition la plateforme et veille au bon déroulement des courses. Il ne peut être tenu
            responsable d&apos;un retard, aucun délai n&apos;étant garanti.
          </li>
          <li>
            Le client est responsable du contenu du colis, de l&apos;exactitude de sa description et des informations du
            destinataire.
          </li>
          <li>
            Toute perte ou tout dommage constaté doit être signalé à find_delivery dans les plus brefs délais, au contact
            indiqué dans les <Link href="/mentions-legales">mentions légales</Link>.
          </li>
        </ul>
      </Article>

      <Article id="article-11" titre="11. Données personnelles">
        <p>
          Les données nécessaires aux courses sont traitées selon la{" "}
          <Link href="/confidentialite">politique de confidentialité</Link>.
        </p>
      </Article>

      <Article id="article-12" titre="12. Modification des conditions">
        <p>
          Ces conditions peuvent évoluer. La version applicable à une course est celle en ligne au moment de sa
          commande ; la date de mise à jour figure en tête de page.
        </p>
      </Article>

      <Article id="article-13" titre="13. Droit applicable">
        <p>
          Ces conditions sont soumises au droit gabonais. En cas de litige, une solution amiable est recherchée en
          priorité ; à défaut, les tribunaux de Libreville sont compétents.
        </p>
      </Article>
    </DocumentLegal>
  );
}

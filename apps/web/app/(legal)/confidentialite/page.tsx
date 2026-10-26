import type { Metadata } from "next";
import Link from "next/link";
import { Article, DocumentLegal, Valeur } from "@/components/legal";
import { EDITEUR } from "@/lib/editeur";

export const metadata: Metadata = { title: "Politique de confidentialité" };

/**
 * Chaque catégorie de données listée ici existe dans le schéma Prisma
 * (apps/api/prisma/schema.prisma) : un champ personnel ajouté au schéma doit
 * l'être ici aussi, avec la date de MISE_A_JOUR_LEGALE.
 */
export default function PageConfidentialite() {
  return (
    <DocumentLegal
      titre="Politique de confidentialité"
      intro="Quelles données Avoo collecte, pourquoi, avec qui elles sont partagées et comment exercer vos droits, au sens de la loi n°001/2011 du 25 septembre 2011 relative à la protection des données à caractère personnel, modifiée par la loi n°025/2023 du 12 juillet 2023."
    >
      <Article id="responsable" titre="1. Responsable du traitement">
        <p>
          <Valeur valeur={EDITEUR.raisonSociale} quoi="raison sociale" />,{" "}
          <Valeur valeur={EDITEUR.siege} quoi="adresse du siège" />. Contact pour toute question sur vos données :{" "}
          <Valeur valeur={EDITEUR.email} quoi="e-mail de contact" />.
        </p>
        <p>
          Traitement déclaré auprès de l&apos;Autorité pour la Protection des Données Personnelles et de la Vie Privée
          (APDPVP), récépissé n° <Valeur valeur={EDITEUR.recepisseApdpvp} quoi="n° de récépissé APDPVP" />.
        </p>
      </Article>

      <Article id="donnees" titre="2. Données collectées">
        <p>
          <strong>Votre compte</strong> : adresse e-mail et mot de passe (conservé uniquement sous forme chiffrée, jamais
          en clair).
        </p>
        <p>
          <strong>Votre profil de client</strong> : type de client (particulier, entreprise, boutique), raison sociale,
          nom et prénom de la personne à contacter, numéros de téléphone Airtel et Moov, adresse.
        </p>
        <p>
          <strong>Vos courses</strong> : adresses et zones d&apos;enlèvement et d&apos;arrivée, contact à l&apos;enlèvement,
          nom, adresse et téléphone du destinataire, description du colis, montants (prix de la course, prix de la
          marchandise en contre-remboursement), code de remise, étapes datées de la course.
        </p>
        <p>
          <strong>Les livreurs indépendants</strong> : nom et prénom, numéros de téléphone, adresse et ville, véhicule et
          immatriculation, zones de travail, état du dossier vérifié au bureau, espèces encaissées et versées. Pendant une
          course, et seulement quand l&apos;application est ouverte, la position du livreur est relevée toutes les 30
          secondes. Aucune position n&apos;est relevée en dehors d&apos;une course, ni pour les clients ou les
          destinataires.
        </p>
        <p>
          Les pièces du dossier d&apos;un livreur sont vérifiées au bureau, en main propre : elles ne sont ni déposées ni
          conservées sur Avoo.
        </p>
      </Article>

      <Article id="finalites" titre="3. Pourquoi ces données">
        <ul>
          <li>
            Exécuter les courses : les proposer aux livreurs, permettre l&apos;enlèvement et la remise, vous en montrer le
            suivi (exécution du contrat).
          </li>
          <li>
            Tenir le registre des espèces : ce que chaque livreur encaisse et verse, ce qui vous est dû en
            contre-remboursement et vous est reversé (exécution du contrat et obligations comptables).
          </li>
          <li>
            Sécuriser le service : authentification, code de remise limité à 5 essais, vérification du dossier des
            livreurs (intérêt légitime).
          </li>
          <li>Vous répondre quand vous nous contactez.</li>
        </ul>
        <p>Vos données ne sont ni vendues, ni utilisées à des fins publicitaires.</p>
      </Article>

      <Article id="destinataires" titre="4. Qui y a accès">
        <ul>
          <li>
            <strong>Les livreurs</strong> : tant qu&apos;une course est ouverte, les livreurs disponibles en voient les
            adresses d&apos;enlèvement et d&apos;arrivée, la description du colis et les montants à encaisser, sans aucun
            nom ni téléphone. Seul le livreur qui l&apos;accepte reçoit en plus le contact de l&apos;enlèvement, le nom et
            le téléphone du destinataire.
          </li>
          <li>
            <strong>Ewuang, notre partenaire de livraison</strong> : chaque course lui est transmise pour être proposée à
            ses livreurs, avec les mêmes informations. Ewuang nous renvoie le nom, le téléphone et le véhicule de son
            livreur, que nous vous affichons, et sa position pendant la course. Ewuang traite ces données selon sa propre politique de confidentialité.
          </li>
          <li>
            <strong>Vous</strong> voyez le nom, le téléphone et le véhicule du livreur dès qu&apos;il accepte votre course,
            et sa position sur une carte tant qu&apos;il a votre colis en main. Elle n&apos;est plus montrée une fois le
            colis remis ou rendu.
          </li>
          <li>
            <strong>L&apos;équipe Avoo</strong>, pour le suivi des courses, la vérification des dossiers et les
            règlements en espèces.
          </li>
          <li>
            <strong>Nos hébergeurs</strong> (voir les <Link href="/mentions-legales">mentions légales</Link>), qui
            stockent les données pour notre compte.
          </li>
          <li>
            <strong>Resend</strong>, notre service d&apos;envoi d&apos;e-mails : quand vous demandez à réinitialiser
            votre mot de passe, il reçoit votre adresse e-mail et le lien de réinitialisation, pour le seul besoin de
            l&apos;envoi.
          </li>
        </ul>
      </Article>

      <Article id="transferts" titre="5. Transferts hors du Gabon">
        <p>
          La base de données d&apos;Avoo est hébergée par Neon sur l&apos;infrastructure d&apos;Amazon Web Services,
          aux États-Unis (région us-east-2). Vos données y sont donc transférées hors du Gabon, pour le seul besoin de
          leur stockage.
        </p>
        <p>
          Les e-mails de réinitialisation du mot de passe sont envoyés par Resend, aux États-Unis : votre adresse
          e-mail y est transférée au moment de l&apos;envoi.
        </p>
      </Article>

      <Article id="conservation" titre="6. Durée de conservation">
        <ul>
          <li>Les données du compte et du profil sont conservées tant que le compte est ouvert.</li>
          <li>
            Les courses, avec leurs étapes et les positions relevées pendant la course, sont conservées avec
            l&apos;historique du compte.
          </li>
          <li>
            Le registre des espèces ne se modifie ni ne s&apos;efface : une écriture erronée est corrigée par une écriture
            inverse. Il est conservé pour la durée des obligations comptables.
          </li>
        </ul>
        <p>
          Vous pouvez demander la fermeture de votre compte au contact ci-dessus. Les données dont la conservation est
          imposée par la loi, comme le registre des espèces, sont alors conservées pour cette seule durée.
        </p>
      </Article>

      <Article id="cookies" titre="7. Cookies">
        <p>
          Avoo n&apos;utilise qu&apos;un seul cookie : celui de votre session, déposé à la connexion et nécessaire
          pour accéder à votre espace. Il n&apos;est pas lisible par les scripts de la page et expire avec votre session.
          Aucun cookie de mesure d&apos;audience ou de publicité n&apos;est déposé.
        </p>
      </Article>

      <Article id="droits" titre="8. Vos droits">
        <p>
          Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;opposition et de suppression de vos données.
          Pour l&apos;exercer, écrivez à <Valeur valeur={EDITEUR.email} quoi="e-mail de contact" /> en précisant
          l&apos;adresse e-mail de votre compte. Vos informations de profil se corrigent aussi directement depuis votre
          espace.
        </p>
        <p>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir l&apos;APDPVP (
          <a href="https://apdpvp.ga" rel="noopener noreferrer" target="_blank">
            apdpvp.ga
          </a>
          ).
        </p>
      </Article>

      <Article id="securite" titre="9. Sécurité">
        <p>
          Les mots de passe sont chiffrés de façon irréversible, la session est portée par un cookie inaccessible aux
          scripts, et chaque client n&apos;accède qu&apos;à ses propres courses. Les contacts d&apos;une course ne sont
          communiqués qu&apos;au livreur qui l&apos;a acceptée, dans les limites décrites à l&apos;article 4.
        </p>
      </Article>
    </DocumentLegal>
  );
}

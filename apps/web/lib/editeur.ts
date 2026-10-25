/**
 * Identité de l'éditeur, lue par les trois pages légales (mentions légales,
 * conditions d'utilisation, politique de confidentialité).
 *
 * `null` = information pas encore fournie : la page affiche alors « à
 * compléter » en évidence plutôt qu'une valeur inventée. Tout doit être
 * renseigné avant la mise en ligne publique (loi n°025/2021 sur les
 * transactions électroniques : mentions obligatoires du commerçant en ligne).
 */
export const EDITEUR = {
  /** Dénomination sociale de la société qui exploite find_delivery. */
  raisonSociale: null as string | null,
  /** SARL, SA, entreprise individuelle… avec le capital s'il y en a un. */
  formeJuridique: null as string | null,
  /** Numéro d'immatriculation au RCCM. */
  rccm: null as string | null,
  /** Numéro d'identification fiscale. */
  nif: null as string | null,
  /** Adresse du siège social. */
  siege: null as string | null,
  /** Personne physique responsable de la publication. */
  directeurPublication: null as string | null,
  /** Adresse e-mail de contact, aussi celle des demandes sur les données personnelles. */
  email: null as string | null,
  /** Téléphone de contact. */
  telephone: null as string | null,
  /** Hébergeur du site web et de l'API (nom, adresse). */
  hebergeurSite: null as string | null,
  /** Numéro du récépissé de déclaration auprès de l'APDPVP. */
  recepisseApdpvp: null as string | null,
};

/** Date de la version en ligne des documents légaux, à changer à chaque modification. */
export const MISE_A_JOUR_LEGALE = "24 octobre 2026";

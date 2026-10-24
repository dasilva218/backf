/**
 * Formes renvoyées par l'API find_delivery (apps/api). À tenir alignées sur
 * les `select` de `livraisons.service.ts` et sur `grille-tarifs.ts`.
 */

export const ZONES = ["Akanda", "Libreville", "Owendo"] as const;
export type Zone = (typeof ZONES)[number];

/** Tout ce qu'une course existante peut porter, retirés compris. */
export type TypeCourse = "standard" | "express" | "volumineux";
export type Vehicule = "moto" | "voiture" | "camionnette";

/** Ce qui est proposé à la création. `volumineux` et `camionnette` sont retirés pour l'instant. */
export const TYPES_COURSE = ["standard", "express"] as const satisfies readonly TypeCourse[];
export const VEHICULES = ["moto", "voiture"] as const satisfies readonly Vehicule[];

/** Une ligne de `GET /tarifs`. Seul `tarif` (prix client) est affiché. */
export interface Devis {
  zoneDepart: Zone;
  zoneArrivee: Zone;
  typeCourse: TypeCourse;
  tarif: number;
  devise: string;
}

export const TYPES_CLIENT = ["PARTICULIER", "ENTREPRISE", "BOUTIQUE"] as const;
export type TypeClient = (typeof TYPES_CLIENT)[number];

export interface ProfilClient {
  id: string;
  type: TypeClient;
  /** Nom de l'entreprise ou de la boutique ; null pour un particulier. */
  raisonSociale: string | null;
  firstname: string;
  lastname: string;
  phoneAirtel: string | null;
  phoneMoov: string | null;
  address: string | null;
}

/** Valeurs envoyées à l'API (`paiement.payeur`). */
export const PAYEURS = ["expediteur", "destinataire"] as const;
export type PayeurDemande = (typeof PAYEURS)[number];

/** Valeurs renvoyées par l'API (`Livraison.payeur`). */
export type Payeur = "EXPEDITEUR" | "DESTINATAIRE";

/** Miroir de `PLAFOND_MARCHANDISE` dans l'API, qui seule fait foi. */
export const PLAFOND_MARCHANDISE = 50_000;

export type StatutLivraison =
  | "EN_ATTENTE"
  | "ACCEPTEE"
  | "EN_COURS"
  | "LIVREE"
  | "ANNULEE"
  | "EN_LITIGE"
  | "RETOUR_EXPEDITEUR"
  | "RETOURNEE";

/** La flotte qui a pris la course ; null tant que personne ne l'a acceptée. */
export type Flotte = "FIND_DELIVERY" | "EWUANG";

export interface Livraison {
  id: string;
  referenceExterne: string | null;
  missionEwuangId: string | null;
  /** Fait foi quand la flotte find_delivery a la course. */
  statut: StatutLivraison;
  /** Statut d'Ewuang, repris tel quel : il fait foi pour une course de sa flotte, ou pas encore prise. */
  statutEwuang: string | null;
  flotte: Flotte | null;
  erreurEwuang: string | null;
  codeRemise: string | null;
  typeCourse: TypeCourse | null;
  zoneDepart: Zone | null;
  zoneArrivee: Zone | null;
  adresseDepart: string;
  adresseArrivee: string;
  destinataireNom: string | null;
  destinataireContact: string | null;
  tarif: number | null;
  /** Null : course réglée hors course, créée avant le paiement en espèces. */
  payeur: Payeur | null;
  montantMarchandise: number;
  livreurNom: string | null;
  livreurContact: string | null;
  livreurTypeVehicule: string | null;
  noteLivreur: string | null;
  dateDemande: string;
  dateAcceptation: string | null;
  dateRecuperation: string | null;
  dateLivraison: string | null;
  dateAnnulation: string | null;
  /** Colis rendu à l'expéditeur après un échec de remise. */
  dateRetour: string | null;
}

/** Corps envoyé à Ewuang, servi par `GET /livraisons/:id`. */
export interface ChargeEwuang {
  enlevement?: { adresse?: string; contact?: string; instructions?: string };
  colis?: { description?: string; vehicule_requis?: Vehicule };
  date_souhaitee?: string;
}

export interface LivraisonDetail extends Livraison {
  chargeEwuang: ChargeEwuang | null;
}

export interface PageLivraisons {
  donnees: Livraison[];
  total: number;
  page: number;
  limite: number;
}

/** `GET /clients/moi/especes` : contre-remboursements encaissés pour le client (registre, phase 3). */
export interface ReleveClient {
  /** Ce que find_delivery doit au client et ne lui a pas encore reversé. */
  du: number;
  mouvements: {
    id: string;
    type: "MARCHANDISE" | "REVERSEMENT";
    montant: number;
    referenceCourse: string | null;
    recu: string | null;
    createdAt: string;
  }[];
}

export interface ResultatTransmission {
  transmise: boolean;
  livraison: LivraisonDetail;
}

/** Retour commun des Server Actions, lu par les formulaires. */
export type EtatAction =
  | { ok: true; message: string; id?: string; avertissement?: boolean }
  | { ok: false; message: string }
  | null;

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
  /** Numéro court « AV-10427 » : celui qu'on affiche et qu'on dicte. */
  numero: string;
  /** Clé technique envoyée à Ewuang (FD-<uuid>) : pas pour l'affichage client. */
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

/** Champs que l'API ne sert qu'à un ADMIN (livraisons.service.ts, CHAMPS_ADMIN). */
export interface LivraisonAdmin extends Livraison {
  clientId: string | null;
  commission: number | null;
  tarifEwuang: number | null;
  remunerationLivreur: number | null;
  tentativesCode: number;
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

// ─── Administration ─────────────────────────────────────────────────────────

export const STATUTS_DOSSIER = ["EN_ATTENTE", "VALIDE", "REFUSE"] as const;
export type StatutDossier = (typeof STATUTS_DOSSIER)[number];

/** `GET /admin/livreurs` (livreurs.service.ts, CHAMPS_ADMIN). */
export interface LivreurAdmin {
  id: string;
  firstname: string;
  lastname: string;
  phoneAirtel: string | null;
  phoneMoov: string | null;
  moyenTransport: string;
  immatriculation: string | null;
  zoneGeographique: string[];
  statutDossier: StatutDossier;
  motifRefus: string | null;
  dossierTraiteAt: string | null;
  nombreLivraisons: number;
  estDisponible: boolean;
  createdAt: string;
  user: { email: string; status: string };
}

/** État du compte d'espèces d'un livreur (especes.ts, `etatLivreur`). */
export interface EtatEspecesLivreur {
  solde: number;
  plafond: number;
  depuis: string | null;
  echeance: string | null;
  blocage: string | null;
}

/** `GET /admin/especes/livreurs`. */
export interface EncoursLivreur extends EtatEspecesLivreur {
  livreur: { id: string; firstname: string; lastname: string; phoneAirtel: string | null; phoneMoov: string | null } | null;
}

/** `GET /admin/especes/clients`. */
export interface DuClient {
  client: {
    id: string;
    type: TypeClient;
    raisonSociale: string | null;
    firstname: string;
    lastname: string;
    phoneAirtel: string | null;
    phoneMoov: string | null;
  } | null;
  du: number;
}

/** Un mouvement du registre des espèces, tel que l'API le sert. */
export interface MouvementEspeces {
  id: string;
  type: string;
  montant: number;
  /** +1 : augmente le solde du compte ; −1 : le diminue. */
  sens: 1 | -1;
  livraisonId: string | null;
  referenceCourse: string | null;
  recu: string | null;
  note: string | null;
  createdAt: string;
  livreurId?: string | null;
  clientId?: string | null;
}

/** `GET /admin/especes/ewuang`. */
export interface ReleveEwuang {
  /** > 0 : Ewuang nous doit ; < 0 : nous lui devons. */
  du: number;
  mouvements: MouvementEspeces[];
}

/** Étape d'une course Ewuang dont l'encaissement au registre diffère de l'attendu (`GET /admin/especes/ewuang/ecarts`). */
export interface EcartEwuang {
  livraisonId: string;
  numero: string;
  referenceExterne: string | null;
  statutEwuang: string | null;
  livreurNom: string | null;
  etape: "enlevement" | "remise" | "retour";
  attendu: number;
  inscrit: number;
  faitAt: string;
}

// ─── Suivi en direct (apps/api/src/suivi) ───────────────────────────────────

/** Position d'un livreur ; `perimee` au-delà de 5 min sans nouvelle position. */
export interface PositionVue {
  latitude: number;
  longitude: number;
  positionAt: string;
  perimee: boolean;
  precisionM: number | null;
}

/** `GET /livraisons/:id/suivi`. */
export interface SuiviCourse {
  /** Un livreur a le colis en main : sinon, rien à suivre. */
  enCours: boolean;
  flotte: Flotte | null;
  position: PositionVue | null;
  /** Trajet depuis l'acceptation, du plus ancien au plus récent (flotte Avoo seulement). */
  trace: { latitude: number; longitude: number; at: string }[];
  /** Ewuang n'a pas pu être lu : la position manque, pas la course. */
  flotteIndisponible: boolean;
}

/** Une course en main sur la carte ADMIN (`GET /admin/carte`). */
export interface CourseCarte {
  id: string;
  referenceExterne: string | null;
  missionEwuangId: string | null;
  flotte: Flotte | null;
  statut: StatutLivraison;
  statutEwuang: string | null;
  zoneDepart: Zone | null;
  zoneArrivee: Zone | null;
  adresseDepart: string;
  adresseArrivee: string;
  destinataireNom: string | null;
  livreurNom: string | null;
  livreurContact: string | null;
  livreurTypeVehicule: string | null;
  dateAcceptation: string | null;
  position: PositionVue | null;
}

export interface CarteAdmin {
  genereAt: string;
  flotteEwuangIndisponible: boolean;
  courses: CourseCarte[];
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

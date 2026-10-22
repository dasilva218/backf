/**
 * Formes renvoyées par l'API find_delivery (apps/api). À tenir alignées sur
 * les `select` de `livraisons.service.ts` et sur `grille-tarifs.ts`.
 */

export const ZONES = ["Akanda", "Libreville", "Owendo"] as const;
export type Zone = (typeof ZONES)[number];

export const TYPES_COURSE = ["standard", "express", "volumineux"] as const;
export type TypeCourse = (typeof TYPES_COURSE)[number];

export const VEHICULES = ["moto", "voiture", "camionnette"] as const;
export type Vehicule = (typeof VEHICULES)[number];

/** Une ligne de `GET /tarifs`. Seul `tarif` (prix client) est affiché. */
export interface Devis {
  zoneDepart: Zone;
  zoneArrivee: Zone;
  typeCourse: TypeCourse;
  tarif: number;
  devise: string;
}

export interface ProfilBoutique {
  id: string;
  firstname: string;
  lastname: string;
  phoneAirtel: string | null;
  phoneMoov: string | null;
  address: string | null;
}

export type StatutLivraison =
  | "EN_ATTENTE"
  | "ACCEPTEE"
  | "EN_COURS"
  | "LIVREE"
  | "ANNULEE"
  | "EN_LITIGE";

export interface Livraison {
  id: string;
  referenceExterne: string | null;
  missionEwuangId: string | null;
  statut: StatutLivraison;
  /** Statut d'Ewuang, repris tel quel : il fait foi. */
  statutEwuang: string | null;
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
  livreurNom: string | null;
  livreurContact: string | null;
  livreurTypeVehicule: string | null;
  noteLivreur: string | null;
  dateDemande: string;
  dateAcceptation: string | null;
  dateRecuperation: string | null;
  dateLivraison: string | null;
  dateAnnulation: string | null;
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

export interface ResultatTransmission {
  transmise: boolean;
  livraison: LivraisonDetail;
}

/** Retour commun des Server Actions, lu par les formulaires. */
export type EtatAction =
  | { ok: true; message: string; id?: string; avertissement?: boolean }
  | { ok: false; message: string }
  | null;

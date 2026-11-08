import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Flotte, Prisma, UserRole, type User } from '@prisma/client';
import { EwuangClient, type LivreurFlotte } from '../ewuang/ewuang.client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  COURSE_EN_COURS,
  estEnCours,
  positionVue,
  type PositionVue,
} from './suivi.js';

type Utilisateur = Pick<User, 'id' | 'role'>;

/**
 * Durée de vie de la flotte Ewuang lue. Le contrat (§5) interdit un polling
 * plus serré que 15 s, sous peine de 429 : tous les écrans ouverts — clients et
 * ADMIN — partagent donc UNE lecture par fenêtre.
 */
const CACHE_FLOTTE_MS = 15_000;

/** Points de trajet servis pour une course de notre flotte (≈ 1 h à 30 s). */
const LIMITE_TRACE = 120;

/** Courses dessinées sur la carte ADMIN. */
const LIMITE_CARTE = 200;

const CHAMPS_SUIVI = {
  id: true,
  flotte: true,
  statut: true,
  statutEwuang: true,
  livreurEwuangId: true,
  dateAcceptation: true,
} satisfies Prisma.LivraisonSelect;

const CHAMPS_CARTE = {
  ...CHAMPS_SUIVI,
  referenceExterne: true,
  // Lu par le badge de statut de l'écran.
  missionEwuangId: true,
  zoneDepart: true,
  zoneArrivee: true,
  adresseDepart: true,
  adresseArrivee: true,
  destinataireNom: true,
  livreurNom: true,
  // Instantané posé à l'attribution, pour les deux flottes.
  livreurContact: true,
  livreurTypeVehicule: true,
  // Dernière position seulement : la trace complète ne sert qu'à la fiche.
  suivisPosition: {
    orderBy: { timestamp: 'desc' },
    take: 1,
    select: { latitude: true, longitude: true, timestamp: true },
  },
} satisfies Prisma.LivraisonSelect;

/** Flotte Ewuang indexée par identifiant de livreur ; null si illisible. */
type FlotteEwuang = Map<string, LivreurFlotte> | null;

@Injectable()
export class SuiviService {
  private readonly logger = new Logger(SuiviService.name);
  private flotte: { lueA: number; lecture: Promise<FlotteEwuang> } | null =
    null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ewuang: EwuangClient,
  ) {}

  /**
   * Position du livreur d'une course, pour son client ou un ADMIN.
   *
   * 404 pour la course d'un autre client, comme `GET /livraisons/:id`.
   * `enCours: false` : personne n'a le colis en main, rien à suivre.
   */
  async suiviCourse(user: Utilisateur, id: string) {
    const course = await this.prisma.livraison.findFirst({
      where: {
        id,
        ...(user.role === UserRole.ADMIN
          ? {}
          : { client: { userClientId: user.id } }),
      },
      select: CHAMPS_SUIVI,
    });
    if (!course) throw new NotFoundException('Course introuvable');

    const maintenant = new Date();
    if (!estEnCours(course)) {
      return {
        enCours: false,
        flotte: course.flotte,
        position: null,
        trace: [],
        flotteIndisponible: false,
      };
    }

    if (course.flotte === Flotte.EWUANG) {
      const flotte = await this.lireFlotteEwuang();
      return {
        enCours: true,
        flotte: course.flotte,
        position: this.positionEwuang(
          flotte,
          course.livreurEwuangId,
          maintenant,
        ),
        // Ewuang ne sert que la position du moment : pas de trajet.
        trace: [],
        flotteIndisponible: flotte === null,
      };
    }

    // Depuis l'acceptation : une course rendue puis reprise ne montre pas
    // le trajet du livreur précédent.
    const points = await this.prisma.suiviPosition.findMany({
      where: {
        livraisonId: course.id,
        ...(course.dateAcceptation
          ? { timestamp: { gte: course.dateAcceptation } }
          : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: LIMITE_TRACE,
      select: { latitude: true, longitude: true, timestamp: true },
    });
    const dernier = points[0];
    return {
      enCours: true,
      flotte: course.flotte,
      position: dernier
        ? positionVue(
            dernier.latitude,
            dernier.longitude,
            dernier.timestamp,
            null,
            maintenant,
          )
        : null,
      trace: points
        .reverse()
        .map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
          at: p.timestamp.toISOString(),
        })),
      flotteIndisponible: false,
    };
  }

  /** Toutes les courses en main, des deux flottes, avec la position du livreur (ADMIN). */
  async carte() {
    const courses = await this.prisma.livraison.findMany({
      where: COURSE_EN_COURS,
      select: CHAMPS_CARTE,
      orderBy: { dateAcceptation: 'desc' },
      take: LIMITE_CARTE,
    });

    const maintenant = new Date();
    // Ewuang n'est interrogé que s'il a des courses à placer.
    const flotte: FlotteEwuang = courses.some((c) => c.flotte === Flotte.EWUANG)
      ? await this.lireFlotteEwuang()
      : new Map();

    return {
      genereAt: maintenant.toISOString(),
      flotteEwuangIndisponible: flotte === null,
      courses: courses.map(({ suivisPosition, livreurEwuangId, ...c }) => {
        const dernier = suivisPosition[0];
        const position =
          c.flotte === Flotte.EWUANG
            ? this.positionEwuang(flotte, livreurEwuangId, maintenant)
            : dernier
              ? positionVue(
                  dernier.latitude,
                  dernier.longitude,
                  dernier.timestamp,
                  null,
                  maintenant,
                )
              : null;
        return { ...c, position };
      }),
    };
  }

  private positionEwuang(
    flotte: FlotteEwuang,
    livreurId: string | null,
    maintenant: Date,
  ): PositionVue | null {
    const livreur = livreurId ? flotte?.get(livreurId) : undefined;
    if (!livreur) return null;
    return positionVue(
      livreur.latitude,
      livreur.longitude,
      livreur.position_at,
      livreur.precision_m,
      maintenant,
    );
  }

  /**
   * Une lecture partagée par fenêtre de 15 s, échec compris : une erreur
   * d'Ewuang n'est pas relancée par chaque écran ouvert. Le client Ewuang a
   * déjà journalisé le statut ; une flotte illisible donne des positions
   * nulles, jamais une erreur de la route.
   */
  private lireFlotteEwuang(): Promise<FlotteEwuang> {
    const maintenant = Date.now();
    if (this.flotte && maintenant - this.flotte.lueA < CACHE_FLOTTE_MS)
      return this.flotte.lecture;

    const lecture = this.ewuang
      .lireFlotte()
      .then((r): FlotteEwuang => new Map(r.livreurs.map((l) => [l.id, l])))
      .catch((erreur: unknown) => {
        this.logger.warn(
          `Flotte Ewuang illisible : ${(erreur as Error).message}`,
        );
        return null;
      });
    this.flotte = { lueA: maintenant, lecture };
    return lecture;
  }
}

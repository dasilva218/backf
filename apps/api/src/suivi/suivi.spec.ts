import { Flotte, StatutLivraison } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { estEnCours, PERIMEE_APRES_MS, positionVue } from './suivi.js';

const MAINTENANT = new Date('2026-10-25T10:00:00Z');

describe('estEnCours', () => {
  const base = {
    flotte: null,
    statut: StatutLivraison.EN_ATTENTE,
    statutEwuang: null,
    livreurEwuangId: null,
  };

  it('une course sans flotte ne se suit pas', () => {
    expect(estEnCours(base)).toBe(false);
  });

  it('notre flotte : de l’acceptation au retour, pas après la remise', () => {
    const fd = { ...base, flotte: Flotte.FIND_DELIVERY };
    expect(estEnCours({ ...fd, statut: StatutLivraison.ACCEPTEE })).toBe(true);
    expect(estEnCours({ ...fd, statut: StatutLivraison.EN_COURS })).toBe(true);
    expect(
      estEnCours({ ...fd, statut: StatutLivraison.RETOUR_EXPEDITEUR }),
    ).toBe(true);
    expect(estEnCours({ ...fd, statut: StatutLivraison.LIVREE })).toBe(false);
    expect(estEnCours({ ...fd, statut: StatutLivraison.RETOURNEE })).toBe(
      false,
    );
  });

  it('Ewuang : son statut fait foi, et il faut un livreur', () => {
    const ew = { ...base, flotte: Flotte.EWUANG, livreurEwuangId: 'lv-1' };
    expect(estEnCours({ ...ew, statutEwuang: 'En cours de livraison' })).toBe(
      true,
    );
    expect(estEnCours({ ...ew, statutEwuang: 'Colis récupéré' })).toBe(true);
    expect(estEnCours({ ...ew, statutEwuang: 'Retour expéditeur' })).toBe(true);
    expect(estEnCours({ ...ew, statutEwuang: 'Livrée' })).toBe(false);
    // Réservée mais pas encore attribuée : pas de livreur connu.
    expect(
      estEnCours({ ...ew, livreurEwuangId: null, statutEwuang: 'En attente' }),
    ).toBe(false);
  });
});

describe('positionVue', () => {
  it('fraîche sous 5 minutes', () => {
    const at = new Date(MAINTENANT.getTime() - 60_000);
    expect(positionVue(0.41, 9.46, at, 12, MAINTENANT)).toEqual({
      latitude: 0.41,
      longitude: 9.46,
      positionAt: at.toISOString(),
      perimee: false,
      precisionM: 12,
    });
  });

  it('périmée au-delà de 5 minutes', () => {
    const at = new Date(MAINTENANT.getTime() - PERIMEE_APRES_MS - 1);
    expect(
      positionVue(0.41, 9.46, at.toISOString(), null, MAINTENANT)?.perimee,
    ).toBe(true);
  });

  it('rien sans coordonnées ni date lisible (livreur Ewuang hors ligne)', () => {
    expect(positionVue(null, null, null, null, MAINTENANT)).toBeNull();
    expect(
      positionVue(0.41, 9.46, 'pas une date', null, MAINTENANT),
    ).toBeNull();
  });
});

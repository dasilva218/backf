import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import type { EmailService } from './email.service.js';

const SECRET = 'secret-de-test';
const HASH_ACTUEL =
  '$2b$10$hashactuelhashactuelhashactuelhashactuelhashactuel12';

const UTILISATEUR = {
  id: 'u-1',
  email: 'client@exemple.ga',
  password: HASH_ACTUEL,
  status: 'ACTIVE',
};

function fabriquer() {
  const users = {
    findByEmail: vi.fn().mockResolvedValue(UTILISATEUR),
    findByIdAvecMotDePasse: vi.fn().mockResolvedValue(UTILISATEUR),
    remplacerMotDePasse: vi.fn().mockResolvedValue(true),
  };
  const email = {
    estConfigure: true,
    envoyer: vi.fn().mockResolvedValue(true),
  };
  const valeurs: Record<string, string> = {
    JWT_SECRET: SECRET,
    WEB_URL: 'https://avoo.test/',
  };
  const config = {
    get: (cle: string) => valeurs[cle],
    getOrThrow: (cle: string) => valeurs[cle],
  };
  const jwt = new JwtService({ secret: SECRET });
  const service = new AuthService(
    users as unknown as UsersService,
    jwt,
    config as unknown as ConfigService,
    email as unknown as EmailService,
  );
  return { users, email, jwt, service };
}

/** Jeton tiré du lien de l'e-mail envoyé. */
function jetonEnvoye(f: ReturnType<typeof fabriquer>): string {
  const { texte } = f.email.envoyer.mock.calls[0][0] as { texte: string };
  const lien = texte.match(/https:\/\/\S+/)![0];
  const url = new URL(lien);
  expect(url.origin + url.pathname).toBe(
    'https://avoo.test/reinitialiser-mot-de-passe',
  );
  return url.searchParams.get('jeton')!;
}

let f: ReturnType<typeof fabriquer>;
beforeEach(() => {
  f = fabriquer();
});

describe('AuthService.demanderReinitialisation', () => {
  it("n'envoie rien pour un e-mail inconnu", async () => {
    f.users.findByEmail.mockResolvedValue(null);
    await f.service.demanderReinitialisation('inconnu@exemple.ga');
    expect(f.email.envoyer).not.toHaveBeenCalled();
  });

  it("n'envoie rien pour un compte suspendu", async () => {
    f.users.findByEmail.mockResolvedValue({
      ...UTILISATEUR,
      status: 'SUSPENDED',
    });
    await f.service.demanderReinitialisation(UTILISATEUR.email);
    expect(f.email.envoyer).not.toHaveBeenCalled();
  });

  it('envoie un lien au compte actif', async () => {
    await f.service.demanderReinitialisation(UTILISATEUR.email);
    expect(f.email.envoyer).toHaveBeenCalledTimes(1);
    expect(f.email.envoyer.mock.calls[0][0].a).toBe(UTILISATEUR.email);
    expect(jetonEnvoye(f)).toBeTruthy();
  });

  it('ne lève jamais, même si la base échoue', async () => {
    f.users.findByEmail.mockRejectedValue(new Error('base indisponible'));
    await expect(
      f.service.demanderReinitialisation(UTILISATEUR.email),
    ).resolves.toBeUndefined();
  });
});

describe('AuthService.reinitialiserMotDePasse', () => {
  it("remplace le mot de passe sous condition de l'ancien hash", async () => {
    await f.service.demanderReinitialisation(UTILISATEUR.email);
    await f.service.reinitialiserMotDePasse(
      jetonEnvoye(f),
      'nouveau-mot-de-passe',
    );

    const [id, ancien, nouveau] = f.users.remplacerMotDePasse.mock.calls[0];
    expect(id).toBe('u-1');
    expect(ancien).toBe(HASH_ACTUEL);
    expect(await bcrypt.compare('nouveau-mot-de-passe', nouveau)).toBe(true);
  });

  it('refuse un lien déjà utilisé : le hash a changé depuis', async () => {
    await f.service.demanderReinitialisation(UTILISATEUR.email);
    f.users.findByIdAvecMotDePasse.mockResolvedValue({
      ...UTILISATEUR,
      password: '$2b$10$autrehash',
    });
    await expect(
      f.service.reinitialiserMotDePasse(jetonEnvoye(f), 'nouveau-mot-de-passe'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(f.users.remplacerMotDePasse).not.toHaveBeenCalled();
  });

  it('refuse si une requête simultanée a déjà consommé le lien', async () => {
    await f.service.demanderReinitialisation(UTILISATEUR.email);
    f.users.remplacerMotDePasse.mockResolvedValue(false);
    await expect(
      f.service.reinitialiserMotDePasse(jetonEnvoye(f), 'nouveau-mot-de-passe'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse un jeton de session, même valide', async () => {
    const jetonSession = await f.jwt.signAsync({
      sub: 'u-1',
      email: UTILISATEUR.email,
      role: 'CLIENT',
    });
    await expect(
      f.service.reinitialiserMotDePasse(jetonSession, 'nouveau-mot-de-passe'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse un jeton forgé avec le seul JWT_SECRET', async () => {
    const forge = await f.jwt.signAsync({
      sub: 'u-1',
      but: 'reinitialisation',
    });
    await expect(
      f.service.reinitialiserMotDePasse(forge, 'nouveau-mot-de-passe'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse un jeton illisible', async () => {
    await expect(
      f.service.reinitialiserMotDePasse('pas-un-jwt', 'nouveau-mot-de-passe'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse pour un compte suspendu entre-temps', async () => {
    await f.service.demanderReinitialisation(UTILISATEUR.email);
    f.users.findByIdAvecMotDePasse.mockResolvedValue({
      ...UTILISATEUR,
      status: 'SUSPENDED',
    });
    await expect(
      f.service.reinitialiserMotDePasse(jetonEnvoye(f), 'nouveau-mot-de-passe'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

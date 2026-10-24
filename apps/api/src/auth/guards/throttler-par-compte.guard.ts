import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Limiteur de débit qui compte par COMPTE plutôt que par IP.
 *
 * Toutes les requêtes du front arrivent depuis le serveur Next : par IP, toutes
 * les clients partageraient un seul seau, et un seul abuseur bloquerait tout
 * le monde. Doit donc s'exécuter APRÈS `JwtAuthGuard`, qui pose `req.user`.
 *
 * - requête authentifiée → l'id du compte ;
 * - connexion → l'e-mail visé, pour freiner l'essai de mots de passe sur un
 *   compte quelle que soit l'IP d'origine ;
 * - sinon → l'IP (`trust proxy` réglé par `TRUST_PROXY`, voir main.ts).
 *
 * La clé finale inclut aussi la route (`generateKey`), chaque route a son seau.
 */
@Injectable()
export class ThrottlerParCompteGuard extends ThrottlerGuard {
    protected override async getTracker(req: Record<string, any>): Promise<string> {
        const userId = (req.user as { id?: unknown } | undefined)?.id;
        if (typeof userId === 'string') return `compte:${userId}`;

        const email = (req.body as { email?: unknown } | undefined)?.email;
        if (typeof req.path === 'string' && req.path.endsWith('/auth/login') && typeof email === 'string') {
            return `login:${email.trim().toLowerCase()}`;
        }

        return super.getTracker(req);
    }
}

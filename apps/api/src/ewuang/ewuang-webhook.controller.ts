import {
    Controller,
    Headers,
    HttpCode,
    Logger,
    Post,
    Req,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import { verifierSignatureEwuang } from './ewuang-signature.js';
import {
    EwuangWebhookService,
    type EvenementEwuang,
} from './ewuang-webhook.service.js';

/**
 * Réception des webhooks d'Ewuang.
 *
 * ── Quatre décisions, chacune contre une panne ─────────────────────────────
 *
 * **`@Public()`** — l'appelant est Ewuang, pas un utilisateur de cette
 * plateforme : il n'a pas de JWT. Le `JwtAuthGuard` est global, donc sans ce
 * décorateur l'endpoint répondrait 401 à chaque livraison, Ewuang relancerait
 * en boucle, et le suivi ne démarrerait jamais. L'authentification est assurée
 * par la signature HMAC, qui est plus forte qu'un jeton : elle authentifie le
 * CORPS, pas seulement l'appelant.
 *
 * **`@SkipThrottle()`** — le plafond global est de 100 requêtes par minute. Une
 * rafale de relances après un incident le dépasserait, chaque 429 serait vu par
 * Ewuang comme un échec, et provoquerait... d'autres relances. On se serait
 * infligé la panne soi-même.
 *
 * **Pas de DTO.** Le `ValidationPipe` global tourne avec
 * `forbidNonWhitelisted: true` : un DTO strict rejetterait tout événement
 * portant un champ qu'il ne déclare pas, c'est-à-dire tout nouveau type
 * d'événement qu'Ewuang ajouterait. Le corps est donc lu tel quel, et c'est le
 * service qui décide ce qu'il sait traiter.
 *
 * **2xx avant traitement.** Le contrat est explicite : un traitement lent est vu
 * comme un échec. On acquitte dès que la signature est vérifiée, et on applique
 * ensuite.
 */
@Controller('ewuang')
export class EwuangWebhookController {
    private readonly logger = new Logger(EwuangWebhookController.name);

    constructor(
        private readonly config: ConfigService,
        private readonly webhooks: EwuangWebhookService,
    ) { }

    @Public()
    @SkipThrottle()
    @ApiExcludeEndpoint()
    @Post('webhook')
    @HttpCode(200)
    recevoir(
        @Req() requete: Request & { rawBody?: Buffer },
        @Headers('x-ewuang-signature') signature?: string,
        @Headers('x-ewuang-evenement') evenementEntete?: string,
    ): { recu: true } {
        const verdict = verifierSignatureEwuang(
            requete.rawBody,
            signature,
            this.config.get<string>('EWUANG_WEBHOOK_SECRET'),
        );

        if (!verdict.valide) {
            // Le motif est journalisé mais JAMAIS renvoyé : une réponse qui
            // distingue « signature invalide » de « horodatage hors fenêtre »
            // aide qui tâtonne. Côté Ewuang, un 401 est un échec définitif qui
            // s'épuise après ses dix tentatives, ce qui est le comportement
            // voulu face à un appelant non authentifié.
            this.logger.warn(
                `Webhook refusé (${verdict.motif})` +
                (evenementEntete ? ` — événement ${evenementEntete}` : ''),
            );
            throw new UnauthorizedException('Signature invalide');
        }

        // Le corps est reparsé depuis les octets vérifiés, et non lu dans
        // `requete.body` : on applique exactement ce qui a été signé.
        let evenement: EvenementEwuang;
        try {
            evenement = JSON.parse(requete.rawBody!.toString('utf8'));
        } catch {
            this.logger.warn('Webhook signé mais corps JSON illisible');
            // 200 quand même : le corps est authentique, le relancer donnera
            // le même corps illisible. Faire relancer Ewuang dix fois pour
            // rien n'aide personne.
            return { recu: true };
        }

        if (!evenement?.evenement_id || !evenement?.type) {
            this.logger.warn('Webhook signé mais sans evenement_id ou type');
            return { recu: true };
        }

        // Traitement détaché, après l'acquittement. Le `catch` est obligatoire :
        // une promesse rejetée sans gestionnaire fait tomber le processus Node.
        void this.webhooks.traiter(evenement).catch((erreur: Error) => {
            this.logger.error(
                `Traitement de l'événement ${evenement.evenement_id} échoué : ${erreur.message}`,
                erreur.stack,
            );
        });

        return { recu: true };
    }
}

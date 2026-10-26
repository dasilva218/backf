import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const URL_RESEND = 'https://api.resend.com/emails';
const TIMEOUT_MS = 10_000;

export interface Courriel {
  a: string;
  sujet: string;
  texte: string;
  html: string;
}

/**
 * Envoi d'e-mails par l'API REST de Resend (`fetch` natif, pas de SDK).
 *
 * Sans `RESEND_API_KEY` ou `EMAIL_EXPEDITEUR`, rien n'est envoyé et l'appelant
 * l'apprend par le `false` renvoyé. Ne lève jamais : un e-mail perdu ne doit
 * pas faire échouer la requête qui l'a déclenché.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  get estConfigure(): boolean {
    return Boolean(
      this.config.get<string>('RESEND_API_KEY') &&
      this.config.get<string>('EMAIL_EXPEDITEUR'),
    );
  }

  async envoyer(courriel: Courriel): Promise<boolean> {
    const cle = this.config.get<string>('RESEND_API_KEY');
    const expediteur = this.config.get<string>('EMAIL_EXPEDITEUR');
    if (!cle || !expediteur) {
      this.logger.warn(
        `E-mail « ${courriel.sujet} » non envoyé : RESEND_API_KEY ou EMAIL_EXPEDITEUR absente.`,
      );
      return false;
    }

    try {
      const reponse = await fetch(URL_RESEND, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cle}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: expediteur,
          to: [courriel.a],
          subject: courriel.sujet,
          text: courriel.texte,
          html: courriel.html,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!reponse.ok) {
        // Le destinataire n'est pas journalisé ; le corps de Resend dit la cause (domaine, clé…).
        const corps = (await reponse.text()).slice(0, 300);
        this.logger.error(
          `Resend a refusé l'e-mail « ${courriel.sujet} » (${reponse.status}) : ${corps}`,
        );
        return false;
      }
      return true;
    } catch (erreur) {
      this.logger.error(
        `Resend injoignable pour « ${courriel.sujet} » : ${(erreur as Error).message}`,
      );
      return false;
    }
  }
}

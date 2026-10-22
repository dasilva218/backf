import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
    FENETRE_SIGNATURE_SECONDES,
    verifierSignatureEwuang,
} from './ewuang-signature.js';

/**
 * Tests du vérificateur de signature.
 *
 * Ils existent parce que c'est la seule pièce de l'intégration dont une erreur
 * ne se voit pas : un vérificateur trop laxiste ouvre l'endpoint à qui connaît
 * l'URL, un vérificateur trop strict refuse tout et bloque le suivi — dans les
 * deux cas, sans message d'erreur qui le dise.
 */

const SECRET = 'whsec_0123456789abcdef0123456789abcdef';
const MAINTENANT = new Date('2026-10-19T12:00:00Z');

/** Signe comme Ewuang : HMAC-SHA256 de `"<t>.<corps brut>"`. */
function signer(corps: Buffer, secret = SECRET, t?: number): string {
    const horodatage = t ?? Math.floor(MAINTENANT.getTime() / 1000);
    const v1 = createHmac('sha256', secret)
        .update(`${horodatage}.`)
        .update(corps)
        .digest('hex');
    return `t=${horodatage},v1=${v1}`;
}

describe('verifierSignatureEwuang', () => {
    const corps = Buffer.from(
        JSON.stringify({ evenement_id: 'e1', type: 'mission.livree' }),
        'utf8',
    );

    it('accepte une signature correcte', () => {
        const r = verifierSignatureEwuang(corps, signer(corps), SECRET, MAINTENANT);
        expect(r.valide).toBe(true);
    });

    // Le cas qui motive tout le fichier : un corps accentué. « Colis récupéré »
    // ne survit pas à un aller-retour JSON.parse/stringify au niveau des
    // octets, et c'est le premier statut réel qui en porte.
    it('accepte un corps accentué, octet pour octet', () => {
        const accentue = Buffer.from(
            JSON.stringify({ statut: 'Colis récupéré', motif: 'reporté à demain' }),
            'utf8',
        );
        const r = verifierSignatureEwuang(
            accentue,
            signer(accentue),
            SECRET,
            MAINTENANT,
        );
        expect(r.valide).toBe(true);
    });

    it('refuse un corps modifié après signature', () => {
        const entete = signer(corps);
        const falsifie = Buffer.from(
            JSON.stringify({ evenement_id: 'e1', type: 'mission.annulee' }),
            'utf8',
        );
        const r = verifierSignatureEwuang(falsifie, entete, SECRET, MAINTENANT);
        expect(r.valide).toBe(false);
    });

    it('refuse une signature faite avec un autre secret', () => {
        const r = verifierSignatureEwuang(
            corps,
            signer(corps, 'whsec_mauvais'),
            SECRET,
            MAINTENANT,
        );
        expect(r.valide).toBe(false);
    });

    it('refuse un rejeu hors de la fenêtre de cinq minutes', () => {
        const vieux = Math.floor(MAINTENANT.getTime() / 1000) - (FENETRE_SIGNATURE_SECONDES + 1);
        const r = verifierSignatureEwuang(
            corps,
            signer(corps, SECRET, vieux),
            SECRET,
            MAINTENANT,
        );
        expect(r.valide).toBe(false);
        expect(r).toMatchObject({ motif: expect.stringContaining('fenêtre') });
    });

    // Fenêtre symétrique : une horloge Ewuang légèrement en avance ne doit pas
    // faire refuser des événements authentiques.
    it('accepte un horodatage légèrement dans le futur', () => {
        const futur = Math.floor(MAINTENANT.getTime() / 1000) + 30;
        const r = verifierSignatureEwuang(
            corps,
            signer(corps, SECRET, futur),
            SECRET,
            MAINTENANT,
        );
        expect(r.valide).toBe(true);
    });

    it('refuse quand le secret n\'est pas configuré', () => {
        const r = verifierSignatureEwuang(
            corps,
            signer(corps),
            undefined,
            MAINTENANT,
        );
        expect(r.valide).toBe(false);
        expect(r).toMatchObject({ motif: expect.stringContaining('non configuré') });
    });

    // Sans `rawBody: true` au bootstrap, `req.rawBody` est undefined. Le
    // vérificateur doit refuser, pas lever : une erreur 500 ferait relancer
    // Ewuang en boucle sur une panne de configuration.
    it('refuse un corps brut absent', () => {
        const r = verifierSignatureEwuang(
            undefined,
            signer(corps),
            SECRET,
            MAINTENANT,
        );
        expect(r.valide).toBe(false);
        expect(r).toMatchObject({ motif: expect.stringContaining('Corps brut') });
    });

    it('refuse un en-tête absent ou mal formé', () => {
        for (const entete of [
            undefined,
            '',
            'v1=abc',
            't=123',
            't=abc,v1=def',
            't=123,v1=XYZ',
        ]) {
            const r = verifierSignatureEwuang(corps, entete, SECRET, MAINTENANT);
            expect(r.valide, `entête « ${entete} »`).toBe(false);
        }
    });

    it('tolère des espaces et un ordre inversé dans l\'en-tête', () => {
        const entete = signer(corps);
        const [t, v1] = entete.split(',');
        const r = verifierSignatureEwuang(
            corps,
            `${v1}, ${t}`,
            SECRET,
            MAINTENANT,
        );
        expect(r.valide).toBe(true);
    });

    // Une signature plus courte que celle attendue ne doit pas passer par une
    // comparaison partielle, et `timingSafeEqual` lève sur des longueurs
    // différentes — d'où le test de longueur en amont.
    it('refuse une signature tronquée sans lever', () => {
        const entete = signer(corps);
        const tronquee = entete.slice(0, entete.length - 10);
        expect(() =>
            verifierSignatureEwuang(corps, tronquee, SECRET, MAINTENANT),
        ).not.toThrow();
        expect(
            verifierSignatureEwuang(corps, tronquee, SECRET, MAINTENANT).valide,
        ).toBe(false);
    });
});

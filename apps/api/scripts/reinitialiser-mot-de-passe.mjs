// Remplace le mot de passe d'un compte find_delivery existant, quel que soit
// son rôle (ADMIN, CLIENT, LIVREUR). Aucune route ne le permet encore.
//
// Usage, depuis apps/api :
//   $env:NOUVEAU_MOT_DE_PASSE = '…'   (PowerShell)   ou   export NOUVEAU_MOT_DE_PASSE='…'
//   node scripts/reinitialiser-mot-de-passe.mjs <email>
//
// Le mot de passe passe par une variable d'environnement et non par un
// argument, pour la même raison que creer-admin.mjs : un argument reste dans
// l'historique du shell et se lit dans la liste des processus.
//
// Les jetons déjà émis restent valides jusqu'à leur expiration (JWT sans
// état) : le changement protège les connexions suivantes, il ne déconnecte
// personne. Pour couper un accès sur-le-champ, suspendre le compte.
//
// Écrit dans la base de DATABASE_URL (.env) : c'est la production si .env la
// désigne.
import 'dotenv/config';
import bcrypt from 'bcrypt';
import pg from 'pg';

const email = (process.argv[2] ?? '').trim().toLowerCase();
const motDePasse = process.env.NOUVEAU_MOT_DE_PASSE ?? '';

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Usage : node scripts/reinitialiser-mot-de-passe.mjs <email>  (mot de passe dans NOUVEAU_MOT_DE_PASSE)');
    process.exit(1);
}
// Mêmes bornes que l'inscription : 10 caractères au moins, 72 au plus (limite de bcrypt).
if (motDePasse.length < 10 || motDePasse.length > 72) {
    console.error('NOUVEAU_MOT_DE_PASSE doit contenir entre 10 et 72 caractères.');
    process.exit(1);
}
if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL absente (.env).');
    process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
    const hash = await bcrypt.hash(motDePasse, await bcrypt.genSalt(10));
    const { rows } = await client.query(
        `update "user" set password = $2, "updatedAt" = now() where email = $1 returning role`,
        [email, hash],
    );
    if (rows.length === 0) throw new Error(`aucun compte pour ${email}`);
    console.log(`Mot de passe remplacé : ${email} (${rows[0].role})`);
} catch (erreur) {
    console.error(`ÉCHEC, rien n'est modifié : ${erreur.message}`);
    process.exitCode = 1;
} finally {
    await client.end();
}

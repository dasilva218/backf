// Crée un compte ADMIN de find_delivery (l'inscription publique ne crée que des
// clients, et aucune route ne donne ce rôle).
//
// Usage, depuis apps/api :
//   $env:ADMIN_MOT_DE_PASSE = '…'   (PowerShell)   ou   export ADMIN_MOT_DE_PASSE='…'
//   node scripts/creer-admin.mjs <email> <prénom> <nom>
//
// Le mot de passe passe par une variable d'environnement et non par un
// argument : un argument reste dans l'historique du shell et se lit dans la
// liste des processus. Le script refuse un e-mail déjà inscrit : il ne promeut
// jamais un compte existant.
//
// Écrit dans la base de DATABASE_URL (.env) : c'est la production si .env la
// désigne.
import 'dotenv/config';
import bcrypt from 'bcrypt';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const [emailBrut, prenom, nom] = process.argv.slice(2);
const motDePasse = process.env.ADMIN_MOT_DE_PASSE ?? '';
const email = (emailBrut ?? '').trim().toLowerCase();

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !prenom || !nom) {
    console.error('Usage : node scripts/creer-admin.mjs <email> <prénom> <nom>  (mot de passe dans ADMIN_MOT_DE_PASSE)');
    process.exit(1);
}
// Mêmes bornes que l'inscription : 10 caractères au moins, 72 au plus (limite de bcrypt).
if (motDePasse.length < 10 || motDePasse.length > 72) {
    console.error('ADMIN_MOT_DE_PASSE doit contenir entre 10 et 72 caractères.');
    process.exit(1);
}
if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL absente (.env).');
    process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
    await client.query('BEGIN');
    const existant = await client.query('select 1 from "user" where email = $1', [email]);
    if (existant.rowCount > 0) throw new Error(`${email} est déjà inscrit : rien n'est créé`);

    const userId = randomUUID();
    const hash = await bcrypt.hash(motDePasse, await bcrypt.genSalt(10));
    await client.query(
        `insert into "user" (id, name, email, password, role, status, "updatedAt")
         values ($1, $2, $3, $4, 'ADMIN', 'ACTIVE', now())`,
        [userId, `${prenom} ${nom}`, email, hash],
    );
    await client.query(
        `insert into "Admin" (id, firstname, lastname, "userAdminId", "updatedAt")
         values ($1, $2, $3, $4, now())`,
        [randomUUID(), prenom, nom, userId],
    );
    await client.query('COMMIT');
    console.log(`Compte ADMIN créé : ${email}`);
} catch (erreur) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`ÉCHEC, rien n'est créé : ${erreur.message}`);
    process.exitCode = 1;
} finally {
    await client.end();
}

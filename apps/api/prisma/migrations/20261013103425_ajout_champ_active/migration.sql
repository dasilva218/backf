-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BOUTIQUE', 'LIVREUR', 'ADMIN');

-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('MOTO', 'VOITURE', 'VELO', 'CANTER', 'AVION', 'TRAIN', 'BATEAU');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TypeNotification" AS ENUM ('NOUVELLE_LIVRAISON', 'LIVRAISON_ACCEPTEE', 'LIVRAISON_EN_COURS', 'LIVRAISON_TERMINEE', 'LIVRAISON_ANNULEE', 'PAIEMENT_RECU', 'EVALUATION_RECUE', 'MESSAGE_SUPPORT', 'ALERTE_SYSTEME');

-- CreateEnum
CREATE TYPE "StatutTicket" AS ENUM ('OUVERT', 'EN_COURS', 'RESOLU', 'FERME');

-- CreateEnum
CREATE TYPE "PrioriteTicket" AS ENUM ('BASSE', 'MOYENNE', 'HAUTE', 'URGENTE');

-- CreateEnum
CREATE TYPE "StatutLivraison" AS ENUM ('EN_ATTENTE', 'ACCEPTEE', 'EN_COURS', 'LIVREE', 'ANNULEE', 'EN_LITIGE');

-- CreateEnum
CREATE TYPE "TypeColis" AS ENUM ('DOCUMENT', 'PETIT_COLIS', 'MOYEN_COLIS', 'GROS_COLIS', 'FRAGILE', 'ALIMENTAIRE');

-- CreateEnum
CREATE TYPE "TypeTransaction" AS ENUM ('PAIEMENT_LIVRAISON', 'COMMISSION', 'RETRAIT', 'REMBOURSEMENT');

-- CreateEnum
CREATE TYPE "StatutTransaction" AS ENUM ('EN_ATTENTE', 'VALIDEE', 'ECHOUEE', 'REMBOURSEE');

-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('MOBILE_MONEY', 'CARTE_BANCAIRE', 'COMPTE_INTERNE', 'CASH');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING',
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'BOUTIQUE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "firstname" TEXT NOT NULL,
    "lastname" TEXT NOT NULL,
    "phoneAirtel" TEXT,
    "phoneMoov" TEXT,
    "userAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Boutique" (
    "id" TEXT NOT NULL,
    "firstname" TEXT NOT NULL,
    "lastname" TEXT NOT NULL,
    "phoneAirtel" TEXT,
    "phoneMoov" TEXT,
    "address" TEXT,
    "userBoutiqueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Boutique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Livreur" (
    "id" TEXT NOT NULL,
    "firstname" TEXT NOT NULL,
    "lastname" TEXT NOT NULL,
    "phoneAirtel" TEXT,
    "phoneMoov" TEXT,
    "address" TEXT,
    "userLivreurId" TEXT NOT NULL,
    "moyenTransport" "TransportMode" NOT NULL,
    "immatriculation" TEXT,
    "zoneGeographique" TEXT[],
    "ville" TEXT,
    "scoreGlobal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nombreLivraisons" INTEGER NOT NULL DEFAULT 0,
    "estDisponible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Livreur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "adminId" TEXT,
    "boutiqueId" TEXT,
    "livreurId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Colis" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "TypeColis" NOT NULL,
    "poids" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION,
    "livraisonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Colis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Livraison" (
    "id" TEXT NOT NULL,
    "livreurId" TEXT,
    "boutiqueId" TEXT,
    "adresseDepart" TEXT NOT NULL,
    "latitudeDepart" DOUBLE PRECISION,
    "longitudeDepart" DOUBLE PRECISION,
    "adresseArrivee" TEXT NOT NULL,
    "latitudeArrivee" DOUBLE PRECISION,
    "longitudeArrivee" DOUBLE PRECISION,
    "distance" DOUBLE PRECISION,
    "tarif" INTEGER DEFAULT 0,
    "commission" INTEGER DEFAULT 0,
    "statut" "StatutLivraison" NOT NULL DEFAULT 'EN_ATTENTE',
    "dateDemande" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateAcceptation" TIMESTAMP(3),
    "dateRecuperation" TIMESTAMP(3),
    "dateLivraison" TIMESTAMP(3),
    "dateAnnulation" TIMESTAMP(3),
    "noteBoutique" TEXT,
    "noteLivreur" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Livraison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuiviPosition" (
    "id" TEXT NOT NULL,
    "livraisonId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuiviPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TypeNotification" NOT NULL,
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "lue" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "livraisonId" TEXT NOT NULL,
    "noteVersLivreur" INTEGER,
    "commentaireVersLivreur" TEXT,
    "noteVersBoutique" INTEGER,
    "commentaireVersBoutique" TEXT,
    "livreurEvaluateurId" TEXT,
    "livreurEvalueId" TEXT,
    "boutiqueEvaluateurId" TEXT,
    "boutiqueEvalueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "livraisonId" TEXT,
    "boutiqueId" TEXT,
    "livreurId" TEXT,
    "adminId" TEXT,
    "type" "TypeTransaction" NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "commission" DOUBLE PRECISION,
    "modePaiement" "ModePaiement" NOT NULL,
    "statut" "StatutTransaction" NOT NULL DEFAULT 'EN_ATTENTE',
    "referenceExterne" TEXT,
    "recu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gain" (
    "id" TEXT NOT NULL,
    "livreurId" TEXT,
    "adminId" TEXT,
    "montant" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,

    CONSTRAINT "Gain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sujet" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priorite" "PrioriteTicket" NOT NULL DEFAULT 'MOYENNE',
    "statut" "StatutTicket" NOT NULL DEFAULT 'OUVERT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageSupport" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "auteur" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageSupport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_userAdminId_key" ON "Admin"("userAdminId");

-- CreateIndex
CREATE UNIQUE INDEX "Boutique_userBoutiqueId_key" ON "Boutique"("userBoutiqueId");

-- CreateIndex
CREATE UNIQUE INDEX "Livreur_userLivreurId_key" ON "Livreur"("userLivreurId");

-- CreateIndex
CREATE INDEX "Livreur_userLivreurId_idx" ON "Livreur"("userLivreurId");

-- CreateIndex
CREATE INDEX "Livreur_ville_idx" ON "Livreur"("ville");

-- CreateIndex
CREATE INDEX "Livreur_estDisponible_idx" ON "Livreur"("estDisponible");

-- CreateIndex
CREATE INDEX "Document_boutiqueId_idx" ON "Document"("boutiqueId");

-- CreateIndex
CREATE INDEX "Document_adminId_idx" ON "Document"("adminId");

-- CreateIndex
CREATE INDEX "Colis_livraisonId_idx" ON "Colis"("livraisonId");

-- CreateIndex
CREATE INDEX "Livraison_boutiqueId_idx" ON "Livraison"("boutiqueId");

-- CreateIndex
CREATE INDEX "Livraison_livreurId_idx" ON "Livraison"("livreurId");

-- CreateIndex
CREATE INDEX "Livraison_statut_idx" ON "Livraison"("statut");

-- CreateIndex
CREATE INDEX "Livraison_dateDemande_idx" ON "Livraison"("dateDemande");

-- CreateIndex
CREATE INDEX "SuiviPosition_livraisonId_idx" ON "SuiviPosition"("livraisonId");

-- CreateIndex
CREATE INDEX "SuiviPosition_timestamp_idx" ON "SuiviPosition"("timestamp");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_lue_idx" ON "Notification"("lue");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_livraisonId_key" ON "Evaluation"("livraisonId");

-- CreateIndex
CREATE INDEX "Evaluation_livraisonId_idx" ON "Evaluation"("livraisonId");

-- CreateIndex
CREATE INDEX "Evaluation_livreurEvalueId_idx" ON "Evaluation"("livreurEvalueId");

-- CreateIndex
CREATE INDEX "Evaluation_boutiqueEvalueId_idx" ON "Evaluation"("boutiqueEvalueId");

-- CreateIndex
CREATE INDEX "Transaction_livraisonId_idx" ON "Transaction"("livraisonId");

-- CreateIndex
CREATE INDEX "Transaction_boutiqueId_idx" ON "Transaction"("boutiqueId");

-- CreateIndex
CREATE INDEX "Transaction_livreurId_idx" ON "Transaction"("livreurId");

-- CreateIndex
CREATE INDEX "Transaction_statut_idx" ON "Transaction"("statut");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "Gain_livreurId_idx" ON "Gain"("livreurId");

-- CreateIndex
CREATE INDEX "Gain_date_idx" ON "Gain"("date");

-- CreateIndex
CREATE INDEX "SupportTicket_userId_idx" ON "SupportTicket"("userId");

-- CreateIndex
CREATE INDEX "SupportTicket_statut_idx" ON "SupportTicket"("statut");

-- CreateIndex
CREATE INDEX "MessageSupport_ticketId_idx" ON "MessageSupport"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_userAdminId_fkey" FOREIGN KEY ("userAdminId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boutique" ADD CONSTRAINT "Boutique_userBoutiqueId_fkey" FOREIGN KEY ("userBoutiqueId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Livreur" ADD CONSTRAINT "Livreur_userLivreurId_fkey" FOREIGN KEY ("userLivreurId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_boutiqueId_fkey" FOREIGN KEY ("boutiqueId") REFERENCES "Boutique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_livreurId_fkey" FOREIGN KEY ("livreurId") REFERENCES "Livreur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Colis" ADD CONSTRAINT "Colis_livraisonId_fkey" FOREIGN KEY ("livraisonId") REFERENCES "Livraison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Livraison" ADD CONSTRAINT "Livraison_boutiqueId_fkey" FOREIGN KEY ("boutiqueId") REFERENCES "Boutique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Livraison" ADD CONSTRAINT "Livraison_livreurId_fkey" FOREIGN KEY ("livreurId") REFERENCES "Livreur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviPosition" ADD CONSTRAINT "SuiviPosition_livraisonId_fkey" FOREIGN KEY ("livraisonId") REFERENCES "Livraison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_boutiqueEvaluateurId_fkey" FOREIGN KEY ("boutiqueEvaluateurId") REFERENCES "Boutique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_boutiqueEvalueId_fkey" FOREIGN KEY ("boutiqueEvalueId") REFERENCES "Boutique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_livraisonId_fkey" FOREIGN KEY ("livraisonId") REFERENCES "Livraison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_livreurEvaluateurId_fkey" FOREIGN KEY ("livreurEvaluateurId") REFERENCES "Livreur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_livreurEvalueId_fkey" FOREIGN KEY ("livreurEvalueId") REFERENCES "Livreur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_boutiqueId_fkey" FOREIGN KEY ("boutiqueId") REFERENCES "Boutique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_livraisonId_fkey" FOREIGN KEY ("livraisonId") REFERENCES "Livraison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_livreurId_fkey" FOREIGN KEY ("livreurId") REFERENCES "Livreur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gain" ADD CONSTRAINT "Gain_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gain" ADD CONSTRAINT "Gain_livreurId_fkey" FOREIGN KEY ("livreurId") REFERENCES "Livreur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageSupport" ADD CONSTRAINT "MessageSupport_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

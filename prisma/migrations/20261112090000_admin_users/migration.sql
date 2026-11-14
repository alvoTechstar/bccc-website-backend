-- Upgrade users table for admin accounts with invite-based passwords.
-- Keeps legacy username/password login working; invited admins have
-- NULL password until they accept the invite and set their own.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "name" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "role" TEXT NOT NULL DEFAULT 'admin',
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "mustSetPassword" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "lastLoginAt" TIMESTAMP(3),
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable (invited admins have no password until they accept the invite)
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

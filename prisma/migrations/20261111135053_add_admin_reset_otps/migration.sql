-- CreateEnum
CREATE TYPE "OtpType" AS ENUM ('login', 'reset', 'verification');

-- CreateEnum
CREATE TYPE "OtpStatus" AS ENUM ('pending', 'consumed', 'expired', 'revoked');

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "otps" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "originalOtp" TEXT NOT NULL,
    "maskedOtp" TEXT,
    "type" "OtpType" NOT NULL DEFAULT 'reset',
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "OtpStatus" NOT NULL DEFAULT 'pending',
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otps_email_idx" ON "otps"("email");

-- CreateIndex
CREATE INDEX "otps_userId_idx" ON "otps"("userId");

-- CreateIndex
CREATE INDEX "otps_expiresAt_idx" ON "otps"("expiresAt");

-- CreateIndex
CREATE INDEX "otps_createdAt_idx" ON "otps"("createdAt");

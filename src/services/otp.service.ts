import { randomUUID } from "crypto";
import { prisma } from "../config/prisma";

/**
 * Admin OTPs — biztrack design (6-digit code, 10-minute expiry).
 * Sending revokes previous pending codes for that email+type.
 * Max 3 sends per 10 minutes (rate limit). Verify consumes the code
 * and the caller issues a short-lived JWT (10m).
 */

export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_SENDS_PER_WINDOW = 3;
export const RESET_TOKEN_TTL = "10m";

type OtpPurpose = "reset" | "login";

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function maskOTP(otp: string): string {
  if (!otp || otp.length !== 6) return "******";
  return `${otp.charAt(0)}****${otp.charAt(5)}`;
}

const FULLY_MASKED = "••••••";

export async function createResetOTP(
  email: string,
  otp: string,
  userId: string | null,
  metadata: { ipAddress?: string | null; userAgent?: string | null } = {},
  purpose: OtpPurpose = "reset",
) {
  const normalized = email.trim().toLowerCase();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.otp.updateMany({
    where: { email: normalized, type: purpose, status: "pending" },
    data: { status: "revoked" },
  });

  const saved = await prisma.otp.create({
    data: {
      id: randomUUID(),
      email: normalized,
      originalOtp: otp,
      maskedOtp: maskOTP(otp),
      type: purpose,
      userId,
      expiresAt,
      status: "pending",
      ipAddress: metadata.ipAddress ?? null,
      userAgent: metadata.userAgent ?? null,
    },
  });

  // BizTrack parity: OTP is visible in the server logs so admins can
  // recover it during development / when email delivery lags.
  console.log(
    `[otp] ${purpose} OTP for ${normalized}: ${saved.originalOtp} (masked: ${saved.maskedOtp}, expires in ${OTP_EXPIRY_MINUTES}m)`,
  );

  return { id: saved.id, otp: saved.originalOtp, maskedOtp: saved.maskedOtp };
}

export async function getValidResetOTP(
  email: string,
  otp: string,
  metadata: { ipAddress?: string | null; userAgent?: string | null } = {},
  purpose: OtpPurpose = "reset",
) {
  const normalized = email.trim().toLowerCase();
  const found = await prisma.otp.findFirst({
    where: {
      email: normalized,
      originalOtp: otp,
      type: purpose,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!found) return null;

  const updated = await prisma.otp.update({
    where: { id: found.id },
    data: {
      attempts: { increment: 1 },
      ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
      ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
    },
  });
  return updated;
}

export async function consumeResetOTPs(email: string, otp?: string, purpose: OtpPurpose = "reset") {
  const normalized = email.trim().toLowerCase();
  const { count } = await prisma.otp.updateMany({
    where: {
      email: normalized,
      type: purpose,
      status: "pending",
      ...(otp ? { originalOtp: otp } : {}),
    },
    data: { status: "consumed", consumedAt: new Date(), maskedOtp: FULLY_MASKED },
  });
  return count > 0;
}

export async function getRecentResetAttempts(email: string, minutes = 10) {
  const normalized = email.trim().toLowerCase();
  const since = new Date(Date.now() - minutes * 60 * 1000);
  return prisma.otp.count({
    where: { email: normalized, createdAt: { gt: since } },
  });
}

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { sendAdminInviteEmail, sendLoginOtpEmail, sendPasswordResetOtpEmail } from "./mailer.service";
import {
  consumeResetOTPs,
  createResetOTP,
  generateOTP,
  getRecentResetAttempts,
  getValidResetOTP,
  OTP_MAX_SENDS_PER_WINDOW,
  RESET_TOKEN_TTL,
} from "./otp.service";
export type AdminRole = "superadmin" | "admin";

export interface PublicAdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  active: boolean;
  mustSetPassword: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

const AUTH_TOKEN_TTL = "12h";
// Invite links expire fast (same as biztrack's 24h setup links).
const INVITE_TOKEN_TTL = "24h";

function getJwtSecret(): string {
  if (!env.jwt.secret) {
    throw new Error("JWT_SECRET environment variable is not set.");
  }
  return env.jwt.secret;
}

function toPublic(u: {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  active: boolean;
  mustSetPassword: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}): PublicAdminUser {
  return {
    id: u.id,
    name: u.name ?? "",
    email: u.email ?? "",
    role: (u.role === "superadmin" ? "superadmin" : "admin") as AdminRole,
    active: u.active,
    mustSetPassword: u.mustSetPassword,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    lastLoginAt: u.lastLoginAt,
  };
}

function signAuthToken(user: { id: string; email: string; role: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, type: "admin_auth" },
    getJwtSecret(),
    { expiresIn: AUTH_TOKEN_TTL }
  );
}

function signInviteToken(user: { id: string; email: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, type: "admin_invite" },
    getJwtSecret(),
    { expiresIn: INVITE_TOKEN_TTL }
  );
}

function inviteLink(token: string): string {
  return `${env.frontendUrl}/admin/set-password?token=${encodeURIComponent(token)}`;
}

export const adminService = {
  toPublic,

  /**
   * Login step 1 (biztrack parity): verify email + password, then email
   * a 6-digit login OTP (10-minute expiry). Returns null on bad
   * credentials; otherwise { requiresOTP: true, ... } — no token yet.
   */
  async login(email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: normalized }, { username: normalized }] },
    });
    if (!user || !user.active || !user.password || !user.email) return null;
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return null;
    const recent = await getRecentResetAttempts(normalized, 10);
    if (recent >= OTP_MAX_SENDS_PER_WINDOW) {
      const err = new Error("Too many login attempts. Please wait 10 minutes before trying again.") as Error & { status?: number };
      err.status = 429;
      throw err;
    }
    const otp = generateOTP();
    const saved = await createResetOTP(normalized, otp, user.id, {}, "login");
    const emailSent = await sendLoginOtpEmail({
      to: user.email,
      name: user.name ?? user.email,
      otp,
    });
    return {
      requiresOTP: true as boolean,
      emailSent,
      devMode: !emailSent && process.env.NODE_ENV !== "production",
      devOtp: !emailSent && process.env.NODE_ENV !== "production" ? otp : undefined,
      otpMasked: saved.maskedOtp,
    };
  },

  /**
   * Login step 2 (biztrack parity): verify the login OTP, consume it,
   * and issue the session token.
   */
  async verifyLoginOtp(email: string, otp: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !otp) {
      const err = new Error("Email and OTP are required.") as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    const stored = await getValidResetOTP(normalized, otp, {}, "login");
    if (!stored) {
      const err = new Error("Invalid or expired OTP. Please request a new one.") as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    await consumeResetOTPs(normalized, otp, "login");
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: normalized }, { username: normalized }] },
    });
    if (!user || !user.active || !user.email) {
      const err = new Error("Admin account not found.") as Error & { status?: number };
      err.status = 404;
      throw err;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return {
      token: signAuthToken({ id: user.id, email: user.email, role: user.role }),
      user: toPublic({ ...user, lastLoginAt: new Date() }),
    };
  },

  /**
   * Re-send the login OTP (same throttle as forgot-password).
   * Unknown emails resolve silently — no enumeration.
   */
  async resendLoginOtp(email: string) {
    const normalized = email.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: normalized }, { username: normalized }] },
    });
    if (!user || !user.email || !user.active) return { sent: false as boolean, devMode: false, devOtp: undefined as string | undefined, otpMasked: undefined as string | undefined };
    const recent = await getRecentResetAttempts(normalized, 10);
    if (recent >= OTP_MAX_SENDS_PER_WINDOW) {
      const err = new Error("Too many login attempts. Please wait 10 minutes before trying again.") as Error & { status?: number };
      err.status = 429;
      throw err;
    }
    const otp = generateOTP();
    const saved = await createResetOTP(normalized, otp, user.id, {}, "login");
    const emailSent = await sendLoginOtpEmail({
      to: user.email,
      name: user.name ?? user.email,
      otp,
    });
    const dev = !emailSent && process.env.NODE_ENV !== "production";
    return { sent: emailSent, devMode: dev, devOtp: dev ? otp : undefined, otpMasked: saved.maskedOtp };
  },

  /** Validate a Bearer auth token -> fresh user (null when bad/inactive). */
  async userFromAuthToken(token: string) {
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as {
        id: string;
        type?: string;
      };
      if (decoded.type !== "admin_auth") return null;
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user || !user.active || !user.email) return null;
      return toPublic(user);
    } catch {
      return null;
    }
  },

  async list() {
    const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
    return users.map(toPublic);
  },

  /**
   * Create an admin (Super Admin only) and email them an invite link
   * to set their own password — biztrack-style.
   * Returns { user, emailSent } — user is created even if email fails.
   */
  async create(input: { name: string; email: string; role: AdminRole }) {
    const email = input.email.trim().toLowerCase();
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username: email }] },
    });
    if (existing) {
      const err = new Error("An admin with this email already exists.") as Error & { status?: number };
      err.status = 409;
      throw err;
    }
    // Unusable random hash until the invite is accepted.
    const tempPassword = crypto.randomBytes(24).toString("hex");
    const user = await prisma.user.create({
      data: {
        username: email,
        password: await bcrypt.hash(tempPassword, 10),
        name: input.name.trim(),
        email,
        role: input.role,
        active: true,
        mustSetPassword: true,
      },
    });
    const token = signInviteToken({ id: user.id, email });
    const emailSent = await sendAdminInviteEmail({
      to: email,
      name: input.name.trim(),
      role: input.role,
      inviteLink: inviteLink(token),
    });
    return { user: toPublic(user), emailSent };
  },

  /** Re-send the set-password invite (new token, resets the 24h clock). */
  async resendInvite(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || !user.email) {
      const err = new Error("Admin not found.") as Error & { status?: number };
      err.status = 404;
      throw err;
    }
    const token = signInviteToken({ id: user.id, email: user.email });
    const emailSent = await sendAdminInviteEmail({
      to: user.email,
      name: user.name ?? user.email,
      role: (user.role === "superadmin" ? "superadmin" : "admin") as AdminRole,
      inviteLink: inviteLink(token),
    });
    return { user: toPublic(user), emailSent };
  },

  /**
   * BizTrack-parity forgot password: send a 6-digit reset OTP
   * (10-minute expiry, max 3 sends per 10 minutes).
   * Unknown emails resolve silently (no enumeration) — the controller
   * always returns the generic BizTrack message.
   */
  async forgotPassword(email: string, meta: { ipAddress?: string | null; userAgent?: string | null } = {}) {
    const normalized = email.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: normalized }, { username: normalized }] },
    });
    // Don't reveal whether the email exists (BizTrack behavior).
    if (!user || !user.email) {
      return { sent: false, devMode: false as boolean, otpMasked: undefined as string | undefined, otp: undefined as string | undefined };
    }
    if (!user.active) {
      const err = new Error("This account has been deactivated. Contact a Super Admin.") as Error & { status?: number };
      err.status = 403;
      throw err;
    }
    const recent = await getRecentResetAttempts(normalized, 10);
    if (recent >= OTP_MAX_SENDS_PER_WINDOW) {
      const err = new Error("Too many reset attempts. Please wait 10 minutes.") as Error & { status?: number };
      err.status = 429;
      throw err;
    }
    const otp = generateOTP();
    const saved = await createResetOTP(normalized, otp, user.id, meta);
    const emailResult = await sendPasswordResetOtpEmail(user.email, otp);
    // BizTrack devMode: surface the code when SMTP isn't configured.
    if (emailResult.devMode) {
      return { sent: true, devMode: true, otpMasked: saved.maskedOtp ?? undefined, otp };
    }
    return {
      sent: emailResult.success,
      devMode: false,
      otpMasked: saved.maskedOtp ?? undefined,
      otp: undefined as string | undefined,
    };
  },

  /** BizTrack-parity resend: same as forgot (new code, revokes the old). */
  async resendResetOTP(email: string, meta: { ipAddress?: string | null; userAgent?: string | null } = {}) {
    return adminService.forgotPassword(email, meta);
  },

  /**
   * BizTrack-parity verify: consume the OTP and issue a short-lived
   * resetToken JWT (type password_reset, 10m expiry).
   */
  async verifyResetOTP(email: string, otp: string, meta: { ipAddress?: string | null; userAgent?: string | null } = {}) {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !otp) {
      const err = new Error("Email and OTP are required.") as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    const stored = await getValidResetOTP(normalized, otp.trim(), meta);
    if (!stored) {
      const err = new Error("Invalid or expired OTP. Please request a new one.") as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    await consumeResetOTPs(normalized, otp.trim());
    const resetToken = jwt.sign(
      { id: stored.userId ?? undefined, email: normalized, type: "password_reset" },
      getJwtSecret(),
      { expiresIn: RESET_TOKEN_TTL }
    );
    return { resetToken };
  },

  /**
   * BizTrack-parity reset: exchange the resetToken for a new password.
   * Rejects same-as-old, enforces min 8 chars.
   */
  async resetPassword(resetToken: string, newPassword: string, confirmPassword: string) {
    if (!resetToken || !newPassword || !confirmPassword) {
      const err = new Error("All fields are required.") as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    if (newPassword !== confirmPassword) {
      const err = new Error("Passwords do not match.") as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    if (newPassword.length < 8) {
      const err = new Error("Password must be at least 8 characters.") as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    let decoded: { id?: string; email: string; type?: string };
    try {
      decoded = jwt.verify(resetToken, getJwtSecret()) as typeof decoded;
    } catch {
      const err = new Error("Invalid or expired password reset token.") as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    if (decoded.type !== "password_reset") {
      const err = new Error("Invalid reset token.") as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    const user = await prisma.user.findFirst({
      where: decoded.id ? { id: decoded.id } : { email: decoded.email.toLowerCase() },
    });
    if (!user || !user.email || !user.active) {
      const err = new Error("Admin account not found.") as Error & { status?: number };
      err.status = 404;
      throw err;
    }
    if (user.password) {
      const same = await bcrypt.compare(newPassword, user.password);
      if (same) {
        const err = new Error("New password cannot be the same as the old password.") as Error & { status?: number };
        err.status = 400;
        throw err;
      }
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(newPassword, 10), mustSetPassword: false, active: true },
    });
    return { success: true as boolean };
  },

  /**
   * Accept an invite: verify the token, set the password, activate.
   * Throws { status, message } on any problem.
   */
  async acceptInvite(token: string, password: string, confirmPassword: string) {
    if (!token || !password || !confirmPassword) {
      const err = new Error("Token and both password fields are required.") as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    if (password !== confirmPassword) {
      const err = new Error("Passwords do not match.") as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    if (password.length < 8) {
      const err = new Error("Password must be at least 8 characters.") as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    let decoded: { id: string; email: string; type?: string };
    try {
      decoded = jwt.verify(token, getJwtSecret()) as typeof decoded;
    } catch {
      const err = new Error("This invite link is invalid or has expired. Ask a Super Admin to resend it.") as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    if (decoded.type !== "admin_invite") {
      const err = new Error("Invalid invite link.") as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.email || user.email.toLowerCase() !== decoded.email.toLowerCase()) {
      const err = new Error("Admin account not found.") as Error & { status?: number };
      err.status = 404;
      throw err;
    }
    if (!user.active) {
      const err = new Error("This account has been deactivated. Contact a Super Admin.") as Error & { status?: number };
      err.status = 403;
      throw err;
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(password, 10),
        mustSetPassword: false,
        active: true,
      },
    });
    return toPublic(updated);
  },

  async update(id: string, patch: { name?: string; role?: AdminRole }, actorId: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      const err = new Error("Admin not found.") as Error & { status?: number };
      err.status = 404;
      throw err;
    }
    if (patch.role && patch.role !== user.role) {
      if (id === actorId && user.role === "superadmin" && patch.role === "admin") {
        const others = await prisma.user.count({
          where: { id: { not: id }, role: "superadmin", active: true },
        });
        if (others === 0) {
          const err = new Error("You are the last Super Admin — promote someone else first.") as Error & { status?: number };
          err.status = 400;
          throw err;
        }
      }
      if (!["superadmin", "admin"].includes(patch.role)) {
        const err = new Error('Role must be "superadmin" or "admin".') as Error & { status?: number };
        err.status = 400;
        throw err;
      }
    }
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.role !== undefined ? { role: patch.role } : {}),
      },
    });
    return toPublic(updated);
  },

  async setActive(id: string, active: boolean, actorId: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      const err = new Error("Admin not found.") as Error & { status?: number };
      err.status = 404;
      throw err;
    }
    if (!active) {
      if (id === actorId) {
        const err = new Error("You cannot deactivate your own account.") as Error & { status?: number };
        err.status = 400;
        throw err;
      }
      if (user.role === "superadmin") {
        const others = await prisma.user.count({
          where: { id: { not: id }, role: "superadmin", active: true },
        });
        if (others === 0) {
          const err = new Error("Cannot deactivate the last active Super Admin.") as Error & { status?: number };
          err.status = 400;
          throw err;
        }
      }
    }
    const updated = await prisma.user.update({ where: { id }, data: { active } });
    return toPublic(updated);
  },

  async remove(id: string, actorId: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      const err = new Error("Admin not found.") as Error & { status?: number };
      err.status = 404;
      throw err;
    }
    if (id === actorId) {
      const err = new Error("You cannot delete your own account.") as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    if (user.role === "superadmin") {
      const others = await prisma.user.count({
        where: { id: { not: id }, role: "superadmin" },
      });
      if (others === 0) {
        const err = new Error("Cannot delete the last Super Admin.") as Error & { status?: number };
        err.status = 400;
        throw err;
      }
    }
    await prisma.user.delete({ where: { id } });
    return toPublic(user);
  },
};

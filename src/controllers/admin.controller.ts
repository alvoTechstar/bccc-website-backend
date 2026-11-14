import type { Request, Response } from "express";
import { z } from "zod";
import { adminService } from "../services/admin.service";
import { verifyEmailConfig } from "../services/mailer.service";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email address"),
  role: z.enum(["superadmin", "admin"]).default("admin"),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["superadmin", "admin"]).optional(),
});

const statusSchema = z.object({
  active: z.boolean(),
});
const acceptSchema = z.object({
  token: z.string().min(1, "Invite token is required"),
  password: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string().min(1, "Please confirm your password."),
});

const forgotSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

const verifyResetSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  otp: z.string().min(1, "Enter the 6-digit code"),
});

const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string().min(1, "Please confirm your password."),
});

type ServiceError = Error & { status?: number };
const serviceError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ success: false, message: "Invalid data", errors: error.errors });
    return;
  }
  const status = (error as ServiceError)?.status ?? 500;
  console.error(fallback, error);
  res.status(status).json({
    success: status === 500 ? false : undefined,
    message: status === 500 ? fallback : (error as Error).message,
  });
};

/** BizTrack-shaped error for the OTP flow: always { success: false, message }. */
const otpError = (res: Response, error: unknown, fallback: string, badRequestMessage?: string) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ success: false, message: badRequestMessage ?? "Invalid data" });
    return;
  }
  const status = (error as ServiceError)?.status ?? 500;
  console.error(fallback, error);
  res.status(status).json({
    success: false,
    message: status === 500 ? fallback : (error as Error).message,
  });
};

export const adminController = {
  /** Public: login step 1 — verify password, email a 6-digit OTP. */
  async login(req: Request, res: Response) {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const result = await adminService.login(email, password);
      if (!result) {
        res.status(401).json({ success: false, message: "Invalid email or password" });
        return;
      }
      res.json({
        success: true,
        requiresOTP: true,
        message: result.emailSent ? "OTP sent to your email" : "OTP generated — email delivery failed, use the dev code below.",
        devMode: result.devMode || false,
        otpMasked: (result as { otpMasked?: string }).otpMasked,
        ...(result.devOtp ? { otp: result.devOtp } : {}),
      });
    } catch (error) {
      otpError(res, error, "Sign in failed", "Email and password are required");
    }
  },

  /** Public: login step 2 — verify the OTP, receive the session token. */
  async verifyLoginOTP(req: Request, res: Response) {
    try {
      const { email, otp } = verifyResetSchema.parse(req.body);
      const result = await adminService.verifyLoginOtp(email, otp);
      res.json({ success: true, message: "Login successful", ...result });
    } catch (error) {
      otpError(res, error, "OTP verification failed", "Email and OTP are required");
    }
  },

  /** Public: resend the login OTP (same throttle as reset codes). */
  async resendLoginOTP(req: Request, res: Response) {
    try {
      const { email } = forgotSchema.parse(req.body);
      const result = await adminService.resendLoginOtp(email);
      res.json({
        success: true,
        message: "If an admin account exists for that email, a new login code has been sent.",
        devMode: result.devMode || false,
        ...(result.devOtp ? { otp: result.devOtp } : {}),
      });
    } catch (error) {
      otpError(res, error, "Unable to resend login code", "Email is required");
    }
  },

  /** Public: accept an invite and set the password (biztrack-style). */
  async acceptInvite(req: Request, res: Response) {
    try {
      const { token, password, confirmPassword } = acceptSchema.parse(req.body);
      const user = await adminService.acceptInvite(token, password, confirmPassword);
      res.json({ message: "Password set successfully — you can now sign in.", user });
    } catch (error) {
      serviceError(res, error, "Failed to accept invite");
    }
  },

  /**
   * Public: BizTrack-parity forgot password — sends a 6-digit OTP
   * (10-minute expiry). Unknown emails get the generic success message
   * (no enumeration). Rate-limited: 429 after 3 sends in 10 minutes.
   */
  async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = forgotSchema.parse(req.body);
      const result = await adminService.forgotPassword(email, {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json({
        success: true,
        message: result.devMode
          ? `Reset OTP: ${result.otp} (Email service not configured)`
          : "Reset OTP sent to your email",
        devMode: result.devMode || false,
        otpMasked: result.otpMasked,
        ...(result.devMode && result.otp ? { otp: result.otp } : {}),
      });
    } catch (error) {
      otpError(res, error, "Unable to process password reset", "Email is required");
    }
  },

  /** Public: BizTrack-parity resend — issues a fresh OTP (revokes the old). */
  async resendResetOTP(req: Request, res: Response) {
    try {
      const { email } = forgotSchema.parse(req.body);
      const result = await adminService.resendResetOTP(email, {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json({
        success: true,
        message: result.devMode
          ? `New reset OTP: ${result.otp} (Email service not configured)`
          : "New reset OTP sent to your email",
        devMode: result.devMode || false,
        otpMasked: result.otpMasked,
        ...(result.devMode && result.otp ? { otp: result.otp } : {}),
      });
    } catch (error) {
      otpError(res, error, "Unable to resend reset OTP", "Email is required");
    }
  },

  /** Public: BizTrack-parity verify — consumes the OTP, returns resetToken. */
  async verifyResetOTP(req: Request, res: Response) {
    try {
      const { email, otp } = verifyResetSchema.parse(req.body);
      const { resetToken } = await adminService.verifyResetOTP(email, otp, {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json({ success: true, message: "OTP verified successfully", resetToken });
    } catch (error) {
      otpError(res, error, "Internal server error", "Email and OTP are required");
    }
  },

  /** Public: BizTrack-parity reset — exchanges resetToken for a new password. */
  async resetPassword(req: Request, res: Response) {
    try {
      const { resetToken, newPassword, confirmPassword } = resetPasswordSchema.parse(req.body);
      await adminService.resetPassword(resetToken, newPassword, confirmPassword);
      res.json({ success: true, message: "Password has been reset successfully." });
    } catch (error) {
      otpError(res, error, "Internal server error", "All fields are required");
    }
  },

  /** Auth: who am I (refresh session). */
  async me(req: Request, res: Response) {
    const admin = (req as Request & { admin: { id: string } }).admin;
    try {
      const users = await adminService.list();
      const me = users.find((u) => u.id === admin.id);
      if (!me) {
        res.status(404).json({ message: "Admin not found" });
        return;
      }
      res.json(me);
    } catch (error) {
      serviceError(res, error, "Failed to load profile");
    }
  },

  /** Auth: list all admins. */
  async list(_req: Request, res: Response) {
    try {
      res.json(await adminService.list());
    } catch (error) {
      serviceError(res, error, "Failed to fetch admins");
    }
  },

  /** Super Admin: create an admin + send the set-password email. */
  async create(req: Request, res: Response) {
    try {
      const data = createSchema.parse(req.body);
      const { user, emailSent } = await adminService.create(data);
      res.status(201).json({
        message: emailSent
          ? "Admin created. Invite email sent."
          : "Admin created, but the invite email could not be sent. Check email settings, then use Resend invite.",
        user,
        emailSent,
      });
    } catch (error) {
      serviceError(res, error, "Failed to create admin");
    }
  },

  /** Super Admin: update name / role. */
  async update(req: Request, res: Response) {
    try {
      const data = updateSchema.parse(req.body);
      const admin = (req as Request & { admin: { id: string } }).admin;
      const user = await adminService.update(req.params.id, data, admin.id);
      res.json({ message: "Admin updated", user });
    } catch (error) {
      serviceError(res, error, "Failed to update admin");
    }
  },

  /** Super Admin: activate / deactivate. */
  async setStatus(req: Request, res: Response) {
    try {
      const { active } = statusSchema.parse(req.body);
      const admin = (req as Request & { admin: { id: string } }).admin;
      const user = await adminService.setActive(req.params.id, active, admin.id);
      res.json({ message: active ? "Admin activated" : "Admin deactivated", user });
    } catch (error) {
      serviceError(res, error, "Failed to update admin status");
    }
  },

  /** Super Admin: resend the set-password invite email. */
  async resendInvite(req: Request, res: Response) {
    try {
      const { user, emailSent } = await adminService.resendInvite(req.params.id);
      res.json({
        message: emailSent
          ? "Invite email sent."
          : "Invite created, but the email could not be sent. Check email settings.",
        user,
        emailSent,
      });
    } catch (error) {
      serviceError(res, error, "Failed to resend invite");
    }
  },

  /** Super Admin: delete. */
  async remove(req: Request, res: Response) {
    try {
      const admin = (req as Request & { admin: { id: string } }).admin;
      await adminService.remove(req.params.id, admin.id);
      res.json({ message: "Admin deleted" });
    } catch (error) {
      serviceError(res, error, "Failed to delete admin");
    }
  },

  /** Any admin: email self-diagnosis (config presence + live SMTP verify). */
  async emailStatus(_req: Request, res: Response) {
    try {
      res.json(await verifyEmailConfig());
    } catch (error) {
      serviceError(res, error, "Failed to check email status");
    }
  },
};

import { Router } from "express";
import { adminController } from "../controllers/admin.controller";
import { authenticateAdmin, requireSuperAdmin } from "../middleware/admin-auth";

export const adminRoutes = Router();

// Public — sign in (password -> OTP -> token) + invite acceptance + OTP self-service reset.
adminRoutes.post("/login", adminController.login);
adminRoutes.post("/verify-login-otp", adminController.verifyLoginOTP);
adminRoutes.post("/resend-login-otp", adminController.resendLoginOTP);
adminRoutes.post("/invite/accept", adminController.acceptInvite);
adminRoutes.post("/forgot-password", adminController.forgotPassword);
adminRoutes.post("/resend-reset-otp", adminController.resendResetOTP);
adminRoutes.post("/verify-reset-otp", adminController.verifyResetOTP);
adminRoutes.post("/reset-password", adminController.resetPassword);

// Authenticated admins.
adminRoutes.get("/me", authenticateAdmin, adminController.me);
adminRoutes.get("/users", authenticateAdmin, adminController.list);
adminRoutes.get("/email-status", authenticateAdmin, adminController.emailStatus);

// Super Admin only — user management.
adminRoutes.post("/users", authenticateAdmin, requireSuperAdmin, adminController.create);
adminRoutes.put("/users/:id", authenticateAdmin, requireSuperAdmin, adminController.update);
adminRoutes.patch("/users/:id/status", authenticateAdmin, requireSuperAdmin, adminController.setStatus);
adminRoutes.post("/users/:id/resend-invite", authenticateAdmin, requireSuperAdmin, adminController.resendInvite);
adminRoutes.delete("/users/:id", authenticateAdmin, requireSuperAdmin, adminController.remove);

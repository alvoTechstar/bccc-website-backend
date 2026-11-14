import type { NextFunction, Request, Response } from "express";
import { adminService } from "../services/admin.service";

export interface AdminRequestUser {
  id: string;
  email: string;
  role: string;
}

/** Authenticated admin (any role). Attaches req.admin. */
export async function authenticateAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      res.status(401).json({ message: "Access token required" });
      return;
    }
    const admin = await adminService.userFromAuthToken(token);
    if (!admin) {
      res.status(401).json({ message: "Invalid or expired token" });
      return;
    }
    (req as Request & { admin: AdminRequestUser }).admin = {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    };
    next();
  } catch (error) {
    console.error("Admin auth failed:", (error as Error).message);
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

/** Super Admin only (user management). Must run after authenticateAdmin. */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const admin = (req as Request & { admin?: AdminRequestUser }).admin;
  if (!admin) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  if (admin.role !== "superadmin") {
    res.status(403).json({ message: "Insufficient permissions — Super Admin only" });
    return;
  }
  next();
}

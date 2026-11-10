import { Router } from "express";
import { prisma } from "../config/prisma";

export const healthRoutes = Router();

healthRoutes.get("/", (_req, res) => {
  res.json({ ok: true });
});

healthRoutes.get("/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "up" });
  } catch (error) {
    res.status(500).json({ ok: false, db: "down", error: (error as Error).message });
  }
});

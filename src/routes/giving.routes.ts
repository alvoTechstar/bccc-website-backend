import { Router } from "express";
import { givingController } from "../controllers/giving.controller";

export const givingRoutes = Router();

givingRoutes.post("/", givingController.create);
givingRoutes.get("/records", givingController.list);
givingRoutes.get("/records/:id/status", givingController.getStatus);

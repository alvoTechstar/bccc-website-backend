import { Router } from "express";
import { newsletterController } from "../controllers/newsletter.controller";

export const newsletterRoutes = Router();

newsletterRoutes.post("/subscribe", newsletterController.subscribe);
newsletterRoutes.get("/subscribers", newsletterController.list);

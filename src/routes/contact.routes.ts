import { Router } from "express";
import { contactController } from "../controllers/contact.controller";

export const contactRoutes = Router();

contactRoutes.post("/", contactController.create);
contactRoutes.get("/messages", contactController.list);

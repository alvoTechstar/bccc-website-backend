import { Router } from "express";
import { mpesaController } from "../controllers/mpesa.controller";

export const mpesaRoutes = Router();

mpesaRoutes.post("/callback", mpesaController.callback);

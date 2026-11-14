import { Router } from "express";
import { eventController } from "../controllers/event.controller";
import { authenticateAdmin } from "../middleware/admin-auth";
import { uploadImages } from "../middleware/upload";

export const eventRoutes = Router();

eventRoutes.get("/", eventController.list);
eventRoutes.get("/:id", eventController.getById);

// Admin only — accept up to 10 images per event.
eventRoutes.post("/", authenticateAdmin, uploadImages.array("images", 10), eventController.create);
eventRoutes.put("/:id", authenticateAdmin, uploadImages.array("images", 10), eventController.update);
eventRoutes.delete("/:id", authenticateAdmin, eventController.remove);

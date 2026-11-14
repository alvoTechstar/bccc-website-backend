import { Router } from "express";
import { mediaController } from "../controllers/media.controller";
import { authenticateAdmin } from "../middleware/admin-auth";
import { uploadMedia } from "../middleware/upload";

export const mediaRoutes = Router();

// Admin only — up to 10 images + 1 video per publish.
mediaRoutes.post(
  "/publish",
  authenticateAdmin,
  uploadMedia.array("files", 11),
  mediaController.publish
);

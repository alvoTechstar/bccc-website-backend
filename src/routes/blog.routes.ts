import { Router } from "express";
import { blogController } from "../controllers/blog.controller";
import { authenticateAdmin } from "../middleware/admin-auth";
import { uploadImages } from "../middleware/upload";

export const blogRoutes = Router();

blogRoutes.get("/posts", blogController.list);
// NB: static sync path must be registered before "/posts/:id".
blogRoutes.post("/posts/sync/facebook", blogController.syncFacebook);
blogRoutes.get("/posts/:id", blogController.getById);
blogRoutes.get("/categories/:category", blogController.listByCategory);

// Admin only — JSON or multipart (files under "images", up to 10).
blogRoutes.post("/posts", authenticateAdmin, uploadImages.array("images", 10), blogController.create);
blogRoutes.put("/posts/:id", authenticateAdmin, uploadImages.array("images", 10), blogController.update);
blogRoutes.delete("/posts/:id", authenticateAdmin, blogController.remove);

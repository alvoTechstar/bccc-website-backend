import { Router } from "express";
import { blogController } from "../controllers/blog.controller";

export const blogRoutes = Router();

blogRoutes.get("/posts", blogController.list);
// NB: static sync path must be registered before "/posts/:id".
blogRoutes.post("/posts/sync/facebook", blogController.syncFacebook);
blogRoutes.get("/posts/:id", blogController.getById);
blogRoutes.get("/categories/:category", blogController.listByCategory);

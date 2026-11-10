import { Router } from "express";
import { blogController } from "../controllers/blog.controller";

export const blogRoutes = Router();

blogRoutes.get("/posts", blogController.list);
blogRoutes.get("/posts/:id", blogController.getById);
blogRoutes.get("/categories/:category", blogController.listByCategory);

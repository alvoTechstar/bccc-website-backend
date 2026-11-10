import type { Request, Response } from "express";
import { blogService } from "../services/blog.service";

export const blogController = {
  async list(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const posts = await blogService.list(limit);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching blog posts:", error);
      res.status(500).json({ message: "Failed to fetch blog posts" });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const post = await blogService.getById(req.params.id);
      if (!post) {
        return res.status(404).json({ message: "Blog post not found" });
      }
      res.json(post);
    } catch (error) {
      console.error("Error fetching blog post:", error);
      res.status(500).json({ message: "Failed to fetch blog post" });
    }
  },

  async listByCategory(req: Request, res: Response) {
    try {
      const posts = await blogService.listByCategory(req.params.category);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching blog posts by category:", error);
      res.status(500).json({ message: "Failed to fetch blog posts by category" });
    }
  },
};

import type { Request, Response } from "express";
import { blogService } from "../services/blog.service";
import { facebookService } from "../services/facebook.service";
import { env } from "../config/env";

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

  /**
   * POST /api/blog/posts/sync/facebook
   * Pull latest church Facebook page posts into blog_posts.
   * If SYNC_SECRET is set, the caller must send it as `x-sync-secret`.
   * TODO: replace with real admin auth when it exists.
   */
  async syncFacebook(req: Request, res: Response) {
    try {
      if (env.facebook.syncSecret) {
        const provided = req.header("x-sync-secret");
        if (provided !== env.facebook.syncSecret) {
          return res.status(401).json({ message: "Unauthorized" });
        }
      }
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 25;
      const result = await facebookService.syncFacebookPosts(limit);
      res.json({ message: "Facebook sync complete", ...result });
    } catch (error) {
      console.error("Error syncing Facebook posts:", error);
      res.status(500).json({
        message: "Failed to sync Facebook posts",
        error: (error as Error).message,
      });
    }
  },
};

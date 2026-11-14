import type { Request, Response } from "express";
import { blogService } from "../services/blog.service";
import { facebookService } from "../services/facebook.service";
import { env } from "../config/env";
import {
  insertBlogPostSchema,
  updateBlogPostSchema,
} from "../validators/schemas";
import { publicUrl } from "../middleware/upload";

/** Multipart fields always arrive as strings — coerce to schema types. */
function text(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

function bool(v: unknown, fallback: boolean): boolean {
  if (v === undefined) return fallback;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1";
  return fallback;
}

function stringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (typeof v === "string") {
    try {
      const parsed: unknown = JSON.parse(v);
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === "string");
      }
    } catch {
      /* not JSON — treat as a single value below */
    }
    return v ? [v] : [];
  }
  return [];
}

function uploadedUrls(req: Request): string[] {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  return files.map((f) => publicUrl(f.filename));
}

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
      res.status(500).json({ message: "Failed to fetch blog posts" });
    }
  },

  /**
   * POST /api/blog/posts (admin) — accepts JSON or multipart/form-data.
   * Multipart: text fields + files under "images" (up to 10).
   */
  async create(req: Request, res: Response) {
    try {
      const body = req.body as Record<string, unknown>;
      const parsed = insertBlogPostSchema.safeParse({
        title: text(body.title),
        content: text(body.content),
        excerpt: text(body.excerpt),
        category: text(body.category),
        author: text(body.author),
        imageUrl: text(body.imageUrl),
        images: stringArray(body.images),
        published: bool(body.published, true),
      });
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid post data",
          errors: parsed.error.flatten().fieldErrors,
        });
      }
      const images = [...parsed.data.images, ...uploadedUrls(req)];
      const post = await blogService.create(parsed.data, images);
      res.status(201).json(post);
    } catch (error) {
      console.error("Error creating blog post:", error);
      res.status(500).json({ message: "Failed to create blog post" });
    }
  },

  /**
   * PUT /api/blog/posts/:id (admin) — same body as create.
   * "keepImages" (multipart) lists existing URLs to keep; omitted entirely
   * (no files + no keepImages/images key) keeps the current set.
   */
  async update(req: Request, res: Response) {
    try {
      const body = req.body as Record<string, unknown>;
      const parsed = updateBlogPostSchema.safeParse({
        ...(body.title !== undefined ? { title: text(body.title) } : {}),
        ...(body.content !== undefined ? { content: text(body.content) } : {}),
        ...(body.excerpt !== undefined ? { excerpt: text(body.excerpt) } : {}),
        ...(body.category !== undefined ? { category: text(body.category) } : {}),
        ...(body.author !== undefined ? { author: text(body.author) } : {}),
        ...(body.imageUrl !== undefined ? { imageUrl: text(body.imageUrl) } : {}),
        ...(body.published !== undefined ? { published: bool(body.published, true) } : {}),
      });
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid post data",
          errors: parsed.error.flatten().fieldErrors,
        });
      }
      const uploads = uploadedUrls(req);
      const touchedImages =
        uploads.length > 0 || body.keepImages !== undefined || body.images !== undefined;
      const images = touchedImages
        ? [...stringArray(body.keepImages ?? body.images), ...uploads]
        : undefined;
      const post = await blogService.update(req.params.id, parsed.data, images);
      if (!post) return res.status(404).json({ message: "Blog post not found" });
      res.json(post);
    } catch (error) {
      console.error("Error updating blog post:", error);
      res.status(500).json({ message: "Failed to update blog post" });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const ok = await blogService.remove(req.params.id);
      if (!ok) return res.status(404).json({ message: "Blog post not found" });
      res.json({ message: "Blog post deleted" });
    } catch (error) {
      console.error("Error deleting blog post:", error);
      res.status(500).json({ message: "Failed to delete blog post" });
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

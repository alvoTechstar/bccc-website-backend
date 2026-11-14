import type { Request, Response } from "express";
import { mediaService } from "../services/media.service";

const TARGETS = ["facebook", "instagram", "tiktok"] as const;
type Target = (typeof TARGETS)[number];

function parseTargets(v: unknown): Target[] {
  let list: string[] = [];
  if (Array.isArray(v)) {
    list = v.filter((x): x is string => typeof x === "string");
  } else if (typeof v === "string") {
    try {
      const parsed: unknown = JSON.parse(v);
      if (Array.isArray(parsed)) {
        list = parsed.filter((x): x is string => typeof x === "string");
      }
    } catch {
      list = v.split(",").map((s) => s.trim().toLowerCase());
    }
  }
  return list.filter((t): t is Target =>
    (TARGETS as readonly string[]).includes(t)
  );
}

export const mediaController = {
  /** POST /api/media/publish (admin) — multipart: files + caption + targets. */
  async publish(req: Request, res: Response) {
    try {
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (files.length === 0) {
        return res.status(400).json({ message: "Attach at least one photo or video." });
      }
      const body = req.body as Record<string, unknown>;
      const caption =
        typeof body.caption === "string" && body.caption.trim()
          ? body.caption.trim()
          : "Beautiful Courts Christian Church";
      const targets = parseTargets(body.targets);
      if (targets.length === 0) {
        return res.status(400).json({ message: "Pick at least one destination." });
      }
      const result = await mediaService.publishMedia({
        caption,
        filenames: files.map((f) => f.filename),
        targets,
      });
      res.json({ message: "Media published", ...result });
    } catch (error) {
      console.error("Error publishing media:", error);
      res.status(500).json({ message: "Failed to publish media" });
    }
  },
};

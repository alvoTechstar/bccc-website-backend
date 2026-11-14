import type { Request, Response } from "express";
import { eventService } from "../services/event.service";
import { insertEventSchema, updateEventSchema } from "../validators/schemas";
import { publicUrl } from "../middleware/upload";

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

export const eventController = {
  async list(_req: Request, res: Response) {
    try {
      res.json(await eventService.list());
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const event = await eventService.getById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      res.json(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  },

  /** POST /api/events (admin) — JSON or multipart (files under "images"). */
  async create(req: Request, res: Response) {
    try {
      const body = req.body as Record<string, unknown>;
      const parsed = insertEventSchema.safeParse({
        title: text(body.title),
        description: text(body.description) ?? "",
        date: text(body.date),
        time: text(body.time),
        venue: text(body.venue),
        category: text(body.category) ?? "General",
        imageUrl: text(body.imageUrl),
        images: stringArray(body.images),
        published: bool(body.published, true),
      });
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid event data",
          errors: parsed.error.flatten().fieldErrors,
        });
      }
      const images = [...parsed.data.images, ...uploadedUrls(req)];
      const event = await eventService.create(parsed.data, images);
      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating event:", error);
      res.status(500).json({ message: "Failed to create event" });
    }
  },

  /** PUT /api/events/:id (admin) — same body; see blog update for images. */
  async update(req: Request, res: Response) {
    try {
      const body = req.body as Record<string, unknown>;
      const parsed = updateEventSchema.safeParse({
        ...(body.title !== undefined ? { title: text(body.title) } : {}),
        ...(body.description !== undefined ? { description: text(body.description) ?? "" } : {}),
        ...(body.date !== undefined ? { date: text(body.date) } : {}),
        ...(body.time !== undefined ? { time: text(body.time) } : {}),
        ...(body.venue !== undefined ? { venue: text(body.venue) } : {}),
        ...(body.category !== undefined ? { category: text(body.category) ?? "General" } : {}),
        ...(body.imageUrl !== undefined ? { imageUrl: text(body.imageUrl) } : {}),
        ...(body.published !== undefined ? { published: bool(body.published, true) } : {}),
      });
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid event data",
          errors: parsed.error.flatten().fieldErrors,
        });
      }
      const uploads = uploadedUrls(req);
      const touchedImages =
        uploads.length > 0 || body.keepImages !== undefined || body.images !== undefined;
      const images = touchedImages
        ? [...stringArray(body.keepImages ?? body.images), ...uploads]
        : undefined;
      const event = await eventService.update(req.params.id, parsed.data, images);
      if (!event) return res.status(404).json({ message: "Event not found" });
      res.json(event);
    } catch (error) {
      console.error("Error updating event:", error);
      res.status(500).json({ message: "Failed to update event" });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const ok = await eventService.remove(req.params.id);
      if (!ok) return res.status(404).json({ message: "Event not found" });
      res.json({ message: "Event deleted" });
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({ message: "Failed to delete event" });
    }
  },
};

import fs from "fs";
import path from "path";
import multer from "multer";

/**
 * Disk uploads for admin-managed images (blog posts, events, media).
 *
 * Files land in <repo>/uploads and are served at /uploads/<file>.
 * NOTE (Render free tier): the filesystem is ephemeral — redeploys wipe
 * /uploads. Fine for now; move to S3/Cloudinary (UPLOADS_* env) when the
 * media library grows. URLs stored in the DB are relative ("/uploads/x"),
 * so swapping the store later needs no data migration.
 */

export const uploadsDir =
  process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safe);
  },
});

const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const VIDEO_MIME = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

function imageOnly(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (IMAGE_MIME.has(file.mimetype)) return cb(null, true);
  cb(new Error("Only JPG, PNG, WEBP or GIF images are allowed."));
}

function imageOrVideo(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (IMAGE_MIME.has(file.mimetype) || VIDEO_MIME.has(file.mimetype)) {
    return cb(null, true);
  }
  cb(new Error("Only images (JPG/PNG/WEBP/GIF) or videos (MP4/MOV/WEBM) are allowed."));
}

/** Up to 10 images, 5MB each — blog posts & events. */
export const uploadImages = multer({
  storage,
  fileFilter: imageOnly,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
});

/** Mixed service-media: up to 10 images + 1 video (150MB). */
export const uploadMedia = multer({
  storage,
  fileFilter: imageOrVideo,
  limits: { fileSize: 150 * 1024 * 1024, files: 11 },
});

/** Public URL path stored in the DB (frontend prefixes the API base). */
export function publicUrl(filename: string): string {
  return `/uploads/${filename}`;
}

/** Best-effort delete of stored files (e.g. post deleted / image removed). */
export function removeUploads(urls: string[]): void {
  for (const url of urls) {
    try {
      const name = path.basename(url);
      // Guard: only delete inside our uploads dir.
      if (!name || name.includes("..")) continue;
      const full = path.join(uploadsDir, name);
      if (fs.existsSync(full)) fs.unlinkSync(full);
    } catch {
      /* ignore */
    }
  }
}

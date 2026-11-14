import type { Request, Response, NextFunction } from "express";

// Fallback 404 + error handler. Controllers handle their own
// validation errors so responses stay identical to the old server.
export function notFound(_req: Request, res: Response) {
  res.status(404).json({ message: "Not found" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: Error & { code?: string },
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Multer upload errors (bad type / too big / too many) -> 400 with reason.
  if (err.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({ message: "File too large." });
    return;
  }
  if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
    res.status(400).json({ message: "Too many files." });
    return;
  }
  if (/only .* (are allowed|is allowed)/i.test(err.message)) {
    res.status(400).json({ message: err.message });
    return;
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
}

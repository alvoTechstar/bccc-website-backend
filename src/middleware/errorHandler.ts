import type { Request, Response, NextFunction } from "express";

// Fallback 404 + error handler. Controllers handle their own
// validation errors so responses stay identical to the old server.
export function notFound(_req: Request, res: Response) {
  res.status(404).json({ message: "Not found" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
}

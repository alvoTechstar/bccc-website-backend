import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { apiRouter } from "./routes";
import { healthRoutes } from "./routes/health.routes";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import { connectToDb } from "./config/prisma";
import { env } from "./config/env";
import { facebookService } from "./services/facebook.service";
import { uploadsDir } from "./middleware/upload";

// Load environment variables FIRST
dotenv.config();

export const app = express();

// Open CORS for now (ALLOWED_ORIGINS=*).
// TODO: restrict to real frontend domains in production.
const allowAll = env.allowedOrigins.includes("*");
app.use(
  cors({
    origin: allowAll ? true : env.allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Uploaded images/videos (blog posts, events, media publishes).
app.use("/uploads", express.static(uploadsDir, { maxAge: "7d" }));

app.get("/", (_req: Request, res: Response) => {
  res.send("<h1>Server is Running!</h1><p>BCC backend (Node + Prisma + Postgres).</p>");
});

app.use("/healthz", healthRoutes);

app.use(requestLogger);
app.use("/api", apiRouter);

app.use(notFound);
app.use(errorHandler);

async function startServer() {
  try {
    if (!process.env.DATABASE_URL) {
      console.warn("DATABASE_URL is not set — starting without DB check.");
    } else {
      await connectToDb();
    }
    app.listen(env.port, () => {
      console.log(`Server is running on port ${env.port}`);
    });

    startFacebookSyncScheduler();
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Only auto-start when run directly (not when imported for tests)
if (require.main === module) {
  startServer();
}

/**
 * Periodically pull the church Facebook page into blog_posts.
 * Enabled only when FACEBOOK_PAGE_ID + FACEBOOK_PAGE_ACCESS_TOKEN are set
 * and FACEBOOK_SYNC_INTERVAL_MINUTES > 0. Failures are logged, never fatal.
 */
function startFacebookSyncScheduler(): void {
  const minutes = env.facebook.syncIntervalMinutes;
  if (!facebookService.isConfigured() || minutes <= 0) {
    return;
  }
  console.log(`Facebook sync scheduler enabled: every ${minutes} minute(s).`);
  const run = async () => {
    try {
      await facebookService.syncFacebookPosts();
    } catch (error) {
      console.error("Scheduled Facebook sync failed:", (error as Error).message);
    }
  };
  // Initial sync shortly after boot, then on the interval.
  setTimeout(run, 30_000);
  setInterval(run, minutes * 60_000);
}

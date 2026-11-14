import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`${name} environment variable is not set.`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  mpesa: {
    apiUrl:
      process.env.MPESA_API_URL ??
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
    authUrl:
      process.env.MPESA_AUTH_URL ??
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    consumerKey: process.env.MPESA_CONSUMER_KEY ?? "",
    consumerSecret: process.env.MPESA_CONSUMER_SECRET ?? "",
    paybillNumber: process.env.MPESA_PAYBILL_NUMBER ?? "174379",
    passkey: process.env.MPESA_PASSKEY ?? "",
    callbackUrl:
      process.env.MPESA_CALLBACK_URL ?? "https://yourdomain.com/api/mpesa/callback",
    queryUrl:
      process.env.MPESA_QUERY_URL ??
      "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query",
  },
  appUrl: process.env.YOUR_APP_URL ?? `http://localhost:${process.env.PORT ?? 3001}`,
  // Public website URL — used to build "set your password" invite links
  // sent to new admins, e.g. https://your-church-website.com
  frontendUrl: (process.env.FRONTEND_URL ?? "http://localhost:5173").replace(/\/$/, ""),
  jwt: {
    secret: process.env.JWT_SECRET ?? "",
  },
  admin: {
    email: (process.env.ADMIN_EMAIL ?? "admin@bccchurch.co.ke").trim().toLowerCase(),
    password: (process.env.ADMIN_PASSWORD ?? "").trim(),
  },
  email: {
    smtpHost: process.env.SMTP_HOST ?? "smtp.gmail.com",
    smtpPort: Number(process.env.SMTP_PORT ?? 587),
    emailUser: process.env.EMAIL_USER ?? "",
    smtpPass: process.env.SMTP_PASS ?? "",
    from: process.env.EMAIL_FROM ?? "",
  },
  facebook: {
    // Set these to enable the Facebook -> blog auto-sync
    // (POST /api/blog/posts/sync/facebook + optional interval scheduler).
    // Setup: Meta app with a Page access token for the church page
    // (long-lived Page tokens do not expire). Keep the token server-side only.
    pageId: process.env.FACEBOOK_PAGE_ID ?? "",
    pageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? "",
    graphVersion: process.env.FACEBOOK_GRAPH_VERSION ?? "v22.0",
    syncIntervalMinutes: Number(process.env.FACEBOOK_SYNC_INTERVAL_MINUTES ?? 0),
    // Optional shared secret guarding the manual sync endpoint.
    // If set, callers must send it as `x-sync-secret`.
    syncSecret: process.env.SYNC_SECRET ?? "",
  },
  instagram: {
    // Reels + photo publishing (POST /api/media/publish target=instagram).
    // Needs an Instagram Business/Creator account linked to the Page.
    // Token: same Page access token pattern with instagram_content_publish.
    businessId: process.env.INSTAGRAM_BUSINESS_ID ?? "",
    accessToken:
      process.env.INSTAGRAM_ACCESS_TOKEN ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? "",
  },
  tiktok: {
    // Direct video posts (POST /api/media/publish target=tiktok).
    // Needs a TikTok developer app through Content Posting API audit
    // (video.upload scope) + user authorization (TIKTOK_ACCESS_TOKEN).
    // Until then the target reports "not connected".
    accessToken: process.env.TIKTOK_ACCESS_TOKEN ?? "",
  },
};

export function assertDatabaseUrl(): string {
  return required("DATABASE_URL");
}

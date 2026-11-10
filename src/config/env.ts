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
  },
  appUrl: process.env.YOUR_APP_URL ?? `http://localhost:${process.env.PORT ?? 3001}`,
};

export function assertDatabaseUrl(): string {
  return required("DATABASE_URL");
}

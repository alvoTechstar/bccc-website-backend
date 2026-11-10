import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter;

  const { smtpHost, smtpPort, emailUser, smtpPass } = env.email;
  if (!emailUser || !smtpPass) {
    console.warn("Email disabled: EMAIL_USER / SMTP_PASS are not set.");
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // 465 = implicit TLS, 587 = STARTTLS
    auth: { user: emailUser, pass: smtpPass },
    // Render-compatible timeouts
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    // Pooled + cached across calls via the singleton
    pool: true,
    maxConnections: 1,
    maxMessages: 50,
  });

  return cachedTransporter;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Best-effort send: logs and returns null when email is not configured. */
export async function sendMail(
  options: SendMailOptions
): Promise<{ messageId: string; previewUrl: string | false } | null> {
  const transporter = getTransporter();
  if (!transporter) return null;

  const info = await transporter.sendMail({
    from: `"BCC Church" <${env.email.from || env.email.emailUser}>`,
    ...options,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log(
    `Email sent to ${options.to} (messageId: ${info.messageId})${
      previewUrl ? ` preview: ${previewUrl}` : ""
    }`
  );
  return { messageId: info.messageId, previewUrl };
}

const layout = (title: string, body: string) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #222;">
    <div style="background: #14365d; color: #fff; padding: 20px; border-radius: 8px 8px 0 0;">
      <h2 style="margin: 0;">Beautiful Courts Christian Church</h2>
    </div>
    <div style="border: 1px solid #e5e5e5; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
      <h3 style="margin-top: 0;">${title}</h3>
      ${body}
      <p style="color: #666; font-size: 13px; margin-top: 24px;">Baraka! — BCC Media Team</p>
    </div>
  </div>
`;

export function sendThankYouEmail(input: {
  to: string;
  amount: number | string;
  givingType: string;
  receipt?: string | null;
  date?: Date;
}) {
  const amount =
    typeof input.amount === "number" ? input.amount.toFixed(2) : input.amount;
  return sendMail({
    to: input.to,
    subject: "Thank you for your giving — BCC Church",
    html: layout(
      "Asante sana for your generosity!",
      `<p>We have received your <strong>KSh ${amount}</strong> giving towards <strong>${input.givingType}</strong>.</p>
       ${
         input.receipt
           ? `<p>M-Pesa receipt: <strong>${input.receipt}</strong></p>`
           : ""
       }
       <p>"Each of you should give what you have decided in your heart to give... for God loves a cheerful giver." — 2 Cor 9:7</p>`
    ),
    text: `Thank you for your KSh ${amount} giving towards ${input.givingType}.${input.receipt ? ` M-Pesa receipt: ${input.receipt}.` : ""} — BCC Church`,
  }).catch((error) => {
    console.error(`Failed to send thank-you email to ${input.to}:`, error);
    return null;
  });
}

export function sendWelcomeEmail(input: { to: string; name?: string }) {
  return sendMail({
    to: input.to,
    subject: "Welcome to the BCC family!",
    html: layout(
      "Karibu sana!",
      `<p>${input.name ? `Dear ${input.name}, ` : ""}thank you for subscribing to Beautiful Courts Christian Church updates.</p>
       <p>You will now hear about services, the Dominion Summit, fasting seasons and building updates.</p>`
    ),
    text: "Welcome to BCC Church updates. Thank you for subscribing!",
  }).catch((error) => {
    console.error(`Failed to send welcome email to ${input.to}:`, error);
    return null;
  });
}

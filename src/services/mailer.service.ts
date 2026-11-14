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

/**
 * Self-diagnosis for deployments (used by GET /api/admin/email-status).
 * Never exposes the password — returns config presence + SMTP verify result.
 */
export async function verifyEmailConfig(): Promise<{
  configured: boolean;
  host: string;
  port: number;
  userSet: boolean;
  passSet: boolean;
  from: string;
  verified: boolean;
  error?: string;
}> {
  const { smtpHost, smtpPort, emailUser, smtpPass, from } = env.email;
  const base = {
    configured: Boolean(emailUser && smtpPass),
    host: smtpHost,
    port: smtpPort,
    userSet: Boolean(emailUser),
    passSet: Boolean(smtpPass),
    from: from || emailUser,
    verified: false,
  };
  if (!base.configured) {
    return { ...base, error: "EMAIL_USER / SMTP_PASS are not set on this server." };
  }
  try {
    const transporter = getTransporter();
    if (!transporter) throw new Error("Could not create mail transporter.");
    await transporter.verify();
    return { ...base, verified: true };
  } catch (error) {
    return { ...base, error: (error as Error).message };
  }
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

const inviteLayout = (body: string) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #222;">
    <div style="background: #0e2a52; color: #fff; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
      <h2 style="margin: 0; font-family: Georgia, serif;">Beautiful Courts Christian Church</h2>
      <p style="margin: 6px 0 0; color: #eab308; font-size: 11px; letter-spacing: 4px; font-weight: bold;">ADMIN CONSOLE</p>
    </div>
    <div style="border: 1px solid #e5e5e5; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
      ${body}
      <p style="color: #666; font-size: 13px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">Raising Kingdom Champions — BCC Media Team</p>
    </div>
  </div>
`;

/**
 * BizTrack-style password-reset OTP email (6-digit code, 10-minute expiry).
 * Returns { success, devMode } — devMode true when SMTP is not configured
 * (caller then surfaces the code in the API response, like BizTrack).
 */
export async function sendPasswordResetOtpEmail(
  to: string,
  otp: string
): Promise<{ success: boolean; devMode: boolean; error?: string }> {
  const { emailUser, smtpPass } = env.email;
  if (!emailUser || !smtpPass || !getTransporter()) {
    return {
      success: false,
      devMode: true,
      error: "Email service not configured. Set EMAIL_USER and SMTP_PASS environment variables.",
    };
  }
  try {
    await sendMail({
      to,
      subject: "Password Reset OTP - BCC Church Admin",
      html: inviteLayout(
        `<p>Hello,</p>
         <p>Use the following OTP to complete your password reset:</p>
         <div style="background: #f8f9fa; padding: 25px; text-align: center; border-radius: 8px; margin: 20px 0; border: 2px solid #dee2e6;">
           <div style="font-size: 36px; font-weight: bold; color: #0e2a52; letter-spacing: 8px; margin: 10px 0;">${otp}</div>
           <p>This code will expire in 10 minutes</p>
         </div>
         <p><strong>Security Notice:</strong> Never share this OTP with anyone.</p>`
      ),
      text: `Your BCC Admin password reset OTP is: ${otp}. This code expires in 10 minutes.`,
    });
    return { success: true, devMode: false };
  } catch (error) {
    console.error(`Failed to send reset OTP to ${to}:`, error);
    return { success: false, devMode: false, error: (error as Error).message };
  }
}

/**
 * Self-service password reset OTP (biztrack-style 6-digit code box).
 * Returns true when handed to the mailer, false when email is off.
 */
export function sendResetOtpEmail(input: { to: string; name: string; otp: string }) {
  return sendMail({
    to: input.to,
    subject: "Your BCC Admin password reset code",
    html: `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #0e2a52; color: #fff; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-family: Georgia, serif; font-size: 20px;">Beautiful Courts Christian Church</h1>
          <p style="margin: 6px 0 0; color: #eab308; font-size: 11px; letter-spacing: 4px; font-weight: bold;">ADMIN CONSOLE</p>
        </div>
        <div style="border: 1px solid #e5e5e5; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
          <p>Hello${input.name ? ` ${input.name}` : ""},</p>
          <p>Use the following code to reset your admin password:</p>
          <div style="background: #f8f9fa; padding: 25px; text-align: center; border-radius: 8px; margin: 20px 0; border: 2px solid #dee2e6;">
            <div style="font-size: 36px; font-weight: bold; color: #0e2a52; letter-spacing: 8px; margin: 10px 0;">${input.otp}</div>
            <p>This code will expire in 10 minutes</p>
          </div>
          <p><strong>Security Notice:</strong> Never share this code with anyone.</p>
          <p style="color: #666; font-size: 12px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px; text-align: center;">© ${new Date().getFullYear()} Beautiful Courts Christian Church</p>
        </div>
      </div>
    </body>
    </html>`,
    text: `Your BCC Admin password reset code is: ${input.otp}. This code expires in 10 minutes.`,
  })
    .then((info) => !!info)
    .catch((error) => {
      console.error(`Failed to send reset OTP to ${input.to}:`, error);
      return false;
    });
}

/**
 * Login code email (same OTP box, login wording).
 */
export function sendLoginOtpEmail(input: { to: string; name: string; otp: string }) {
  return sendMail({
    to: input.to,
    subject: "Your BCC Admin login code",
    html: `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #0e2a52; color: #fff; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-family: Georgia, serif; font-size: 20px;">Beautiful Courts Christian Church</h1>
          <p style="margin: 6px 0 0; color: #eab308; font-size: 11px; letter-spacing: 4px; font-weight: bold;">ADMIN CONSOLE</p>
        </div>
        <div style="border: 1px solid #e5e5e5; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
          <p>Hello${input.name ? ` ${input.name}` : ""},</p>
          <p>Use the following code to complete your admin sign-in:</p>
          <div style="background: #f8f9fa; padding: 25px; text-align: center; border-radius: 8px; margin: 20px 0; border: 2px solid #dee2e6;">
            <div style="font-size: 36px; font-weight: bold; color: #0e2a52; letter-spacing: 8px; margin: 10px 0;">${input.otp}</div>
            <p>This code will expire in 10 minutes</p>
          </div>
          <p><strong>Security Notice:</strong> Never share this code with anyone. If you didn't try to sign in, ignore this email.</p>
          <p style="color: #666; font-size: 12px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px; text-align: center;">© ${new Date().getFullYear()} Beautiful Courts Christian Church</p>
        </div>
      </div>
    </body>
    </html>`,
    text: `Your BCC Admin login code is: ${input.otp}. This code expires in 10 minutes.`,
  })
    .then((info) => !!info)
    .catch((error) => {
      console.error(`Failed to send login OTP to ${input.to}:`, error);
      return false;
    });
}

/**
 * Invite a new admin: they click through and set their own password.
 * Best-effort — returns null when email is not configured (caller still
 * creates the account and reports emailSent: false, biztrack-style).
 */
export function sendAdminInviteEmail(input: {
  to: string;
  name: string;
  role: string;
  inviteLink: string;
}) {
  const roleLabel = input.role === "superadmin" ? "Super Admin" : "Admin";
  return sendMail({
    to: input.to,
    subject: "Set up your BCC Admin account",
    html: inviteLayout(
      `<p>Hello ${input.name},</p>
       <p>An admin account (<strong>${roleLabel}</strong>) has been created for you on the Beautiful Courts Christian Church website. Click the button below to set your password:</p>
       <p style="text-align: center; margin: 24px 0;">
         <a href="${input.inviteLink}" style="display: inline-block; background: #eab308; color: #0e2a52; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">Set Your Password</a>
       </p>
       <p>Or paste this link into your browser:<br /><a href="${input.inviteLink}">${input.inviteLink}</a></p>
       <p style="color: #b00;"><strong>This link expires in 24 hours.</strong> If it lapses, ask a Super Admin to resend your invite from Admin → Users.</p>`
    ),
    text: `Hello ${input.name}, an admin account (${roleLabel}) was created for you at BCC Church. Set your password here: ${input.inviteLink} (expires in 24 hours).`,
  })
    .then((info) => !!info)
    .catch((error) => {
      console.error(`Failed to send admin invite to ${input.to}:`, error);
      return false;
    });
}

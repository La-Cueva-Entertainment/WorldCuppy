import "server-only";
import nodemailer from "nodemailer";

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) throw new Error("SMTP_HOST is not set");

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const from = process.env.SMTP_FROM ?? `World Cuppy <noreply@worldcuppy.app>`;
  const transport = getTransport();

  await transport.sendMail({
    from,
    to,
    subject: "Reset your World Cuppy password",
    text: `Click this link to reset your password:\n\n${resetUrl}\n\nThis link expires in 1 hour.`,
    html: `
      <p>Hi,</p>
      <p>You requested a password reset for your World Cuppy account.</p>
      <p><a href="${resetUrl}" style="background:#059669;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">Reset password</a></p>
      <p style="color:#6b7280;font-size:12px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    `,
  });
}

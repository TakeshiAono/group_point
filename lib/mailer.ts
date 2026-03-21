import nodemailer from "nodemailer";

/**
 * SMTP設定は環境変数で切り替える。
 *
 * ローカル（Mailpit）:
 *   SMTP_HOST=localhost
 *   SMTP_PORT=1025
 *   SMTP_USER=  （空でOK）
 *   SMTP_PASS=  （空でOK）
 *
 * 本番（SendGrid）:
 *   SMTP_HOST=smtp.sendgrid.net
 *   SMTP_PORT=587
 *   SMTP_USER=apikey
 *   SMTP_PASS=<SendGrid APIキー>
 */
export const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
  auth:
    process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
});

export const MAIL_FROM = process.env.MAIL_FROM ?? "noreply@group-point.local";

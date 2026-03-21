import { NextResponse } from "next/server";
import { auth } from "@/auth";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { title, message } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "タイトルは必須です" }, { status: 400 });
  if (!message?.trim()) return NextResponse.json({ error: "メッセージは必須です" }, { status: 400 });

  const {
    CONTACT_SMTP_HOST,
    CONTACT_SMTP_PORT,
    CONTACT_SMTP_USER,
    CONTACT_SMTP_PASS,
    CONTACT_MAIL_FROM,
    CONTACT_MAIL_TO,
  } = process.env;

  if (!CONTACT_SMTP_HOST || !CONTACT_MAIL_TO) {
    return NextResponse.json({ error: "メール設定が未完了です。管理者にご連絡ください。" }, { status: 503 });
  }

  const transporter = nodemailer.createTransport({
    host: CONTACT_SMTP_HOST,
    port: Number(CONTACT_SMTP_PORT ?? 1025),
    secure: Number(CONTACT_SMTP_PORT ?? 1025) === 465,
    auth: CONTACT_SMTP_USER ? { user: CONTACT_SMTP_USER, pass: CONTACT_SMTP_PASS } : undefined,
  });

  try {
    await transporter.sendMail({
      from: CONTACT_MAIL_FROM || "noreply@localhost",
      to: CONTACT_MAIL_TO,
      subject: `[お問い合わせ] ${title}`,
      text: [
        `送信者: ${session.user.name ?? ""} <${session.user.email}>`,
        `タイトル: ${title}`,
        "",
        message,
      ].join("\n"),
    });
  } catch (e) {
    console.error("sendMail error:", e);
    return NextResponse.json({ error: `メール送信に失敗しました: ${String(e)}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

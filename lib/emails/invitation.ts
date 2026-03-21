import { mailer, MAIL_FROM } from "@/lib/mailer";

type SendInvitationEmailParams = {
  to: string;
  inviteeName: string | null;
  groupName: string;
  inviterName: string | null;
  role: "LEADER" | "MEMBER";
  appUrl: string;
};

export async function sendInvitationEmail({
  to,
  inviteeName,
  groupName,
  inviterName,
  role,
  appUrl,
}: SendInvitationEmailParams) {
  const roleLabel = role === "LEADER" ? "政府関係者（LEADER）" : "一般メンバー";
  const displayName = inviteeName ?? to;
  const inviterDisplay = inviterName ?? "グループリーダー";

  await mailer.sendMail({
    from: MAIL_FROM,
    to,
    subject: `【Group Point】${groupName} へ招待されました`,
    text: `
${displayName} さん

${inviterDisplay} から「${groupName}」への招待が届いています。

ロール: ${roleLabel}

以下のURLからログインして招待を確認・承認してください。
${appUrl}

このメールに心当たりがない場合は無視してください。
`.trim(),
    html: `
<p>${displayName} さん</p>
<p><strong>${inviterDisplay}</strong> から <strong>${groupName}</strong> への招待が届いています。</p>
<table>
  <tr><td>ロール</td><td>${roleLabel}</td></tr>
</table>
<p>
  <a href="${appUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;">
    招待を確認する
  </a>
</p>
<p style="color:#9ca3af;font-size:12px;">このメールに心当たりがない場合は無視してください。</p>
`.trim(),
  });
}

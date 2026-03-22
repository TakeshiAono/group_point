import { mailer, MAIL_FROM } from "@/lib/mailer";

type SendInvitationEmailParams = {
  to: string;
  inviteeName: string | null;
  groupName: string;
  inviterName: string | null;
  role: "LEADER" | "MEMBER";
  appUrl: string;
  isNewUser?: boolean; // アカウント未登録の場合 true
};

const ROLE_LABEL: Record<string, string> = {
  LEADER: "マネージャー",
  MEMBER: "メンバー",
};

export async function sendInvitationEmail({
  to,
  inviteeName,
  groupName,
  inviterName,
  role,
  appUrl,
  isNewUser = false,
}: SendInvitationEmailParams) {
  const roleLabel = ROLE_LABEL[role] ?? role;
  const displayName = inviteeName ?? to;
  const inviterDisplay = inviterName ?? "グループリーダー";

  const signupUrl = `${appUrl}/signup?email=${encodeURIComponent(to)}`;
  const actionUrl = isNewUser ? signupUrl : appUrl;
  const actionLabel = isNewUser ? "アカウントを作成して招待を確認する" : "招待を確認する";
  const actionNote = isNewUser
    ? `まだアカウントをお持ちでない方は、以下のURLからアカウントを作成してください。\n${signupUrl}`
    : `以下のURLからログインして招待を確認・承認してください。\n${appUrl}`;

  await mailer.sendMail({
    from: MAIL_FROM,
    to,
    subject: `【Group Point】${groupName} へ招待されました`,
    text: `
${displayName} さん

${inviterDisplay} から「${groupName}」への招待が届いています。

ロール: ${roleLabel}

${actionNote}

このメールに心当たりがない場合は無視してください。
`.trim(),
    html: `
<p>${displayName} さん</p>
<p><strong>${inviterDisplay}</strong> から <strong>${groupName}</strong> への招待が届いています。</p>
<table>
  <tr><td>ロール</td><td>${roleLabel}</td></tr>
</table>
<p>
  <a href="${actionUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;">
    ${actionLabel}
  </a>
</p>
${isNewUser ? `<p style="color:#6b7280;font-size:13px;">上のボタンからアカウントを作成すると、ログイン後に招待が自動で表示されます。</p>` : ""}
<p style="color:#9ca3af;font-size:12px;">このメールに心当たりがない場合は無視してください。</p>
`.trim(),
  });
}

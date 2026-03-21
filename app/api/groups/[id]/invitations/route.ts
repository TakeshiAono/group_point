import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendInvitationEmail } from "@/lib/emails/invitation";

// グループへの招待を送る（LEADERのみ）
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId } = await params;
  const { email, role } = await req.json();

  if (!email?.trim()) {
    return NextResponse.json({ error: "メールアドレスは必須です" }, { status: 400 });
  }
  if (role !== "LEADER" && role !== "MEMBER") {
    return NextResponse.json({ error: "roleはLEADERまたはMEMBERを指定してください" }, { status: 400 });
  }

  // 操作者がLEADERか確認
  const inviterMember = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!inviterMember || inviterMember.role !== "LEADER") {
    return NextResponse.json({ error: "この操作はLEADERのみ実行できます" }, { status: 403 });
  }

  // 招待対象ユーザーを検索
  const invitee = await prisma.user.findUnique({ where: { email: email.trim() } });
  if (!invitee) {
    return NextResponse.json({ error: "指定されたメールアドレスのユーザーが見つかりません" }, { status: 404 });
  }

  // 既にメンバーの場合はエラー
  const alreadyMember = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: invitee.id, groupId } },
  });
  if (alreadyMember) {
    return NextResponse.json({ error: "このユーザーはすでにグループのメンバーです" }, { status: 409 });
  }

  // 招待者情報を取得
  const inviter = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  });

  // 既存の招待があれば再送（ステータスをPENDINGに戻す）
  const invitation = await prisma.invitation.upsert({
    where: { groupId_inviteeId: { groupId, inviteeId: invitee.id } },
    update: { status: "PENDING", role, inviterId: inviterMember.id },
    create: {
      groupId,
      inviterId: inviterMember.id,
      inviteeId: invitee.id,
      role,
    },
    include: {
      group: { select: { id: true, name: true } },
      invitee: { select: { id: true, name: true, email: true } },
    },
  });

  // メール送信（失敗してもAPIレスポンスには影響させない）
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  sendInvitationEmail({
    to: invitee.email,
    inviteeName: invitee.name,
    groupName: invitation.group.name,
    inviterName: inviter?.name ?? null,
    role,
    appUrl,
  }).catch((err) => console.error("[mailer] 招待メール送信失敗:", err));

  return NextResponse.json(invitation, { status: 201 });
}

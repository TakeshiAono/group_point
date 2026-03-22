import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendInvitationEmail } from "@/lib/emails/invitation";

// PENDING招待一覧を取得（ADMIN/LEADERのみ）
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  const { id: groupId } = await params;
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!member || member.role === "MEMBER") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  const invitations = await prisma.invitation.findMany({
    where: { groupId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      inviteeEmail: true,
      role: true,
      createdAt: true,
      invitee: { select: { name: true } },
    },
  });
  return NextResponse.json(invitations);
}

// グループへの招待を送る
// ADMIN: LEADER・MEMBERを招待可能
// LEADER: MEMBERのみ招待可能
// アカウント未登録のメールアドレスへも送信可能
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // 操作者のロールを確認（ADMIN or LEADER のみ招待可能）
    const inviterMember = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: session.user.id, groupId } },
    });
    if (!inviterMember || inviterMember.role === "MEMBER") {
      return NextResponse.json({ error: "招待できる権限がありません" }, { status: 403 });
    }

    // LEADERはMEMBERしか招待できない
    if (inviterMember.role === "LEADER" && role === "LEADER") {
      return NextResponse.json({ error: "マネージャーの招待は管理者のみ実行できます" }, { status: 403 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 招待対象ユーザーを検索（アカウントなくてもOK）
    const invitee = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // 既にメンバーの場合はエラー
    if (invitee) {
      const alreadyMember = await prisma.groupMember.findUnique({
        where: { userId_groupId: { userId: invitee.id, groupId } },
      });
      if (alreadyMember) {
        return NextResponse.json({ error: "このユーザーはすでにグループのメンバーです" }, { status: 409 });
      }
    }

    // 招待者情報を取得
    const inviter = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    });

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { name: true },
    });
    if (!group) {
      return NextResponse.json({ error: "グループが見つかりません" }, { status: 404 });
    }

    // 招待を作成（既存なら再送）
    const invitation = await prisma.invitation.upsert({
      where: { groupId_inviteeEmail: { groupId, inviteeEmail: normalizedEmail } },
      update: {
        status: "PENDING",
        role,
        inviterId: inviterMember.id,
        inviteeId: invitee?.id ?? null,
      },
      create: {
        groupId,
        inviterId: inviterMember.id,
        inviteeId: invitee?.id ?? null,
        inviteeEmail: normalizedEmail,
        role,
      },
    });

    // メール送信
    const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    sendInvitationEmail({
      to: normalizedEmail,
      inviteeName: invitee?.name ?? null,
      groupName: group.name,
      inviterName: inviter?.name ?? null,
      role,
      appUrl,
      isNewUser: !invitee,
    }).catch((err) => console.error("[mailer] 招待メール送信失敗:", err));

    return NextResponse.json({
      id: invitation.id,
      inviteeEmail: normalizedEmail,
      inviteeName: invitee?.name ?? null,
      isNewUser: !invitee,
    }, { status: 201 });
  } catch (e) {
    console.error("[invitations] POST error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

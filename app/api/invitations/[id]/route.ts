import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// 招待を承認または拒否する
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await params;
  const { action } = await req.json(); // "accept" | "decline"

  if (action !== "accept" && action !== "decline") {
    return NextResponse.json({ error: "actionはacceptまたはdeclineを指定してください" }, { status: 400 });
  }

  const invitation = await prisma.invitation.findUnique({ where: { id } });
  if (!invitation) {
    return NextResponse.json({ error: "招待が見つかりません" }, { status: 404 });
  }
  if (invitation.inviteeId !== session.user.id) {
    return NextResponse.json({ error: "この招待を操作する権限がありません" }, { status: 403 });
  }
  if (invitation.status !== "PENDING") {
    return NextResponse.json({ error: "この招待はすでに回答済みです" }, { status: 409 });
  }

  if (action === "accept") {
    // トランザクションでメンバー追加と招待ステータス更新を同時に行う
    await prisma.$transaction([
      prisma.groupMember.upsert({
        where: { userId_groupId: { userId: session.user.id, groupId: invitation.groupId } },
        update: { role: invitation.role },
        create: { userId: session.user.id, groupId: invitation.groupId, role: invitation.role },
      }),
      prisma.invitation.update({
        where: { id },
        data: { status: "ACCEPTED" },
      }),
    ]);
  } else {
    await prisma.invitation.update({
      where: { id },
      data: { status: "DECLINED" },
    });
  }

  return NextResponse.json({ ok: true });
}

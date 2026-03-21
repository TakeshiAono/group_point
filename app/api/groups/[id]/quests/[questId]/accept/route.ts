import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// クエストを受注する（OPEN → IN_PROGRESS）
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; questId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId, questId } = await params;

  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!member) {
    return NextResponse.json({ error: "グループのメンバーではありません" }, { status: 403 });
  }

  const quest = await prisma.quest.findUnique({
    where: { id: questId },
    include: {
      creator: { include: { user: { select: { id: true, name: true, email: true } } } },
      completer: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  if (!quest || quest.groupId !== groupId) {
    return NextResponse.json({ error: "クエストが見つかりません" }, { status: 404 });
  }
  if (quest.status !== "OPEN") {
    return NextResponse.json({ error: "受注できるのはステータスが受付中のクエストのみです" }, { status: 400 });
  }
  if (quest.creatorId === member.id) {
    return NextResponse.json({ error: "自分が発行したクエストは受注できません" }, { status: 400 });
  }

  const updated = await prisma.quest.update({
    where: { id: questId },
    data: { status: "IN_PROGRESS", completerId: member.id },
    include: {
      creator: { include: { user: { select: { id: true, name: true, email: true } } } },
      completer: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });

  return NextResponse.json(updated);
}

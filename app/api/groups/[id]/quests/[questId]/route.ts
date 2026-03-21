import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
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
      subQuests: {
        include: {
          assignee: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!quest || quest.groupId !== groupId) {
    return NextResponse.json({ error: "クエストが見つかりません" }, { status: 404 });
  }

  return NextResponse.json(quest);
}

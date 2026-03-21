import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; questId: string; subQuestId: string }> };

// 報酬変更を否認（担当者のみ・CHANGE_PENDING → CHANGE_DENIED）
export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId, questId, subQuestId } = await params;

  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!member) {
    return NextResponse.json({ error: "グループのメンバーではありません" }, { status: 403 });
  }

  const subQuest = await prisma.subQuest.findUnique({
    where: { id: subQuestId },
    include: {
      quest: {
        include: {
          creator: { include: { user: { select: { id: true, name: true, email: true } } } },
          completer: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      },
    },
  });

  if (!subQuest || subQuest.questId !== questId) {
    return NextResponse.json({ error: "サブクエストが見つかりません" }, { status: 404 });
  }

  if (subQuest.assigneeId !== member.id) {
    return NextResponse.json({ error: "担当者のみ否認できます" }, { status: 403 });
  }

  if (subQuest.status !== "CHANGE_PENDING") {
    return NextResponse.json({ error: "変更承認待ちのサブクエストのみ否認できます" }, { status: 400 });
  }

  const updated = await prisma.subQuest.update({
    where: { id: subQuestId },
    data: { status: "CHANGE_DENIED", pendingPointReward: null },
    include: {
      assignee: { include: { user: { select: { id: true, name: true, email: true } } } },
      quest: {
        include: {
          creator: { include: { user: { select: { id: true, name: true, email: true } } } },
          completer: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      },
    },
  });

  return NextResponse.json(updated);
}

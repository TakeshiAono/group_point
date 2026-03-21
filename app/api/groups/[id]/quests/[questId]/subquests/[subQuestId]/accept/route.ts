import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addQuestLog } from "@/lib/questLog";

type Params = { params: Promise<{ id: string; questId: string; subQuestId: string }> };

// サブクエスト受諾（REQUESTED → ASSIGNED）
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
  });

  if (!subQuest || subQuest.questId !== questId) {
    return NextResponse.json({ error: "サブクエストが見つかりません" }, { status: 404 });
  }

  if (subQuest.assigneeId !== member.id) {
    return NextResponse.json({ error: "担当者のみ受諾できます" }, { status: 403 });
  }

  if (subQuest.status !== "REQUESTED") {
    return NextResponse.json({ error: "依頼中のサブクエストのみ受諾できます" }, { status: 400 });
  }

  const updated = await prisma.subQuest.update({
    where: { id: subQuestId },
    data: { status: "ASSIGNED" },
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

  const memberName = updated.assignee?.user.name ?? updated.assignee?.user.email ?? "不明";
  await addQuestLog({ questId, memberId: member.id, action: "SUBQUEST_ACCEPTED", detail: `${memberName} がサブクエスト「${updated.title}」を受諾しました` });

  return NextResponse.json(updated);
}

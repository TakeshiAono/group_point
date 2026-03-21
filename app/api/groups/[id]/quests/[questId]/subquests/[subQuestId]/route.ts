import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; questId: string; subQuestId: string }> };

// サブクエスト詳細取得
export async function GET(_req: Request, { params }: Params) {
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
      assignee: { include: { user: { select: { id: true, name: true, email: true } } } },
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

  return NextResponse.json(subQuest);
}

// サブクエスト削除
export async function DELETE(_req: Request, { params }: Params) {
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
    include: { quest: true },
  });

  if (!subQuest || subQuest.questId !== questId) {
    return NextResponse.json({ error: "サブクエストが見つかりません" }, { status: 404 });
  }

  // クエストの発行者または受注者のみ削除可
  if (subQuest.quest.creatorId !== member.id && subQuest.quest.completerId !== member.id) {
    return NextResponse.json({ error: "削除できるのはクエストの発行者または受注者のみです" }, { status: 403 });
  }

  await prisma.subQuest.delete({ where: { id: subQuestId } });

  return NextResponse.json({ success: true });
}

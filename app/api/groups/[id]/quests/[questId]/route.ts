import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addQuestLog } from "@/lib/questLog";

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

// クエスト編集（発行者のみ）
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; questId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId, questId } = await params;
  const { title, description, pointReward, deadline } = await req.json();

  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!member) {
    return NextResponse.json({ error: "グループのメンバーではありません" }, { status: 403 });
  }

  const quest = await prisma.quest.findUnique({
    where: { id: questId },
    include: { subQuests: true },
  });
  if (!quest || quest.groupId !== groupId) {
    return NextResponse.json({ error: "クエストが見つかりません" }, { status: 404 });
  }
  if (quest.creatorId !== member.id) {
    return NextResponse.json({ error: "発行者のみ編集できます" }, { status: 403 });
  }
  if (quest.status === "COMPLETED" || quest.status === "CANCELLED") {
    return NextResponse.json({ error: "完了・キャンセル済みのクエストは編集できません" }, { status: 400 });
  }

  const changes: string[] = [];
  const data: Record<string, unknown> = {};

  if (title !== undefined && title.trim() !== quest.title) {
    data.title = title.trim();
    changes.push(`タイトル「${quest.title}」→「${title.trim()}」`);
  }
  if (description !== undefined && (description?.trim() ?? null) !== quest.description) {
    data.description = description?.trim() ?? null;
    changes.push("説明を変更");
  }
  if (deadline !== undefined) {
    const newDeadline = deadline ? new Date(deadline) : null;
    const oldDeadline = quest.deadline;
    if (newDeadline?.toISOString() !== oldDeadline?.toISOString()) {
      data.deadline = newDeadline;
      const fmt = (d: Date | null) => d ? d.toLocaleDateString("ja-JP") : "なし";
      changes.push(`期限 ${fmt(oldDeadline)} → ${fmt(newDeadline)}`);
    }
  }
  if (pointReward !== undefined && pointReward !== quest.pointReward) {
    if (typeof pointReward !== "number" || !Number.isInteger(pointReward) || pointReward <= 0) {
      return NextResponse.json({ error: "報酬は1以上の整数で指定してください" }, { status: 400 });
    }
    const usedBySubquests = quest.subQuests.reduce((s, sq) => s + sq.pointReward, 0);
    if (pointReward < usedBySubquests) {
      return NextResponse.json(
        { error: `サブクエストの報酬合計（${usedBySubquests} pt）より小さくできません` },
        { status: 400 }
      );
    }

    if (quest.questType === "MEMBER") {
      const diff = pointReward - quest.pointReward;
      if (diff > 0 && member.memberPoints < diff) {
        return NextResponse.json(
          { error: `保有ポイントが不足しています（不足: ${diff} pt）` },
          { status: 400 }
        );
      }
      await prisma.groupMember.update({
        where: { id: member.id },
        data: { memberPoints: { decrement: diff } },
      });
    }

    data.pointReward = pointReward;
    changes.push(`報酬 ${quest.pointReward} pt → ${pointReward} pt`);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: "変更なし" });
  }

  const updated = await prisma.quest.update({
    where: { id: questId },
    data,
    include: {
      creator: { include: { user: { select: { id: true, name: true, email: true } } } },
      completer: { include: { user: { select: { id: true, name: true, email: true } } } },
      subQuests: {
        include: { assignee: { include: { user: { select: { id: true, name: true, email: true } } } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  await addQuestLog({
    questId,
    memberId: member.id,
    action: "EDITED",
    detail: `クエスト情報が変更されました（${changes.join("、")}）`,
  });

  return NextResponse.json(updated);
}

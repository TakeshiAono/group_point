import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; questId: string }> };

// クエスト完了
export async function POST(_req: Request, { params }: Params) {
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
      subQuests: {
        select: { id: true, status: true, assigneeId: true, pointReward: true },
      },
    },
  });

  if (!quest || quest.groupId !== groupId) {
    return NextResponse.json({ error: "クエストが見つかりません" }, { status: 404 });
  }

  // 完了できるのは受注者のみ
  if (quest.completerId !== member.id) {
    return NextResponse.json({ error: "受注者のみ完了できます" }, { status: 403 });
  }

  if (quest.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "進行中のクエストのみ完了できます" }, { status: 400 });
  }

  // サブクエストが一つもない場合は完了不可
  if (quest.subQuests.length === 0) {
    return NextResponse.json(
      { error: "サブクエストが存在しません。少なくとも1つのサブクエストが必要です。" },
      { status: 400 }
    );
  }

  // 依頼中（未承諾）のサブクエストがある場合は完了不可
  const requestedSubQuests = quest.subQuests.filter((sq) => sq.status === "REQUESTED");
  if (requestedSubQuests.length > 0) {
    return NextResponse.json(
      { error: `依頼中のサブクエストが ${requestedSubQuests.length} 件あります。すべて承諾または削除してから完了してください。` },
      { status: 400 }
    );
  }

  // 報酬が設定されていないサブクエストがある場合は完了不可
  const noRewardSubQuests = quest.subQuests.filter((sq) => sq.pointReward === 0);
  if (noRewardSubQuests.length > 0) {
    return NextResponse.json(
      { error: `報酬が設定されていないサブクエストが ${noRewardSubQuests.length} 件あります。` },
      { status: 400 }
    );
  }

  // サブクエストの合計報酬がクエスト報酬と一致しない場合は完了不可
  const totalSubReward = quest.subQuests.reduce((sum, sq) => sum + sq.pointReward, 0);
  if (totalSubReward !== quest.pointReward) {
    return NextResponse.json(
      { error: `サブクエストの報酬合計（${totalSubReward} pt）がクエスト報酬（${quest.pointReward} pt）と一致しません。` },
      { status: 400 }
    );
  }

  const assignedSubQuests = quest.subQuests.filter((sq) => sq.status === "ASSIGNED");

  // トランザクションで一括処理
  await prisma.$transaction(async (tx) => {
    // クエストを完了に変更
    await tx.quest.update({
      where: { id: questId },
      data: { status: "COMPLETED" },
    });

    // アサイン済みサブクエストの担当者にポイントを付与（報酬はサブクエスト経由のみ）
    for (const sq of assignedSubQuests) {
      if (sq.assigneeId && sq.pointReward > 0) {
        await tx.groupMember.update({
          where: { id: sq.assigneeId },
          data: { memberPoints: { increment: sq.pointReward } },
        });
      }
      // サブクエストも完了に変更
      await tx.subQuest.update({
        where: { id: sq.id },
        data: { status: "COMPLETED" },
      });
    }
  });

  const updated = await prisma.quest.findUnique({
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

  return NextResponse.json(updated);
}

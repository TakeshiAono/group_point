import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addQuestLog } from "@/lib/questLog";

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

  // ボーナスルールを適用（納期が設定されている場合のみ）
  let bonusRate = 0;
  let appliedRule: { thresholdPercent: number; bonusRate: number } | null = null;
  if (quest.deadline) {
    const now = new Date();
    const createdAt = quest.createdAt;
    const deadline = quest.deadline;
    const totalDays = Math.ceil((deadline.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    if (totalDays > 0) {
      // クエストのボーナスルールを取得
      const rules = await prisma.$queryRaw<
        { id: string; thresholdPercent: number; bonusRate: number }[]
      >`SELECT id, "thresholdPercent", "bonusRate" FROM "BonusRule" WHERE "questId" = ${questId} ORDER BY "thresholdPercent" ASC`;

      // しきい値日付を切り上げで計算
      function thresholdDate(thresholdPercent: number): Date {
        const days = Math.ceil(totalDays * thresholdPercent / 100);
        return new Date(createdAt.getTime() + days * 24 * 60 * 60 * 1000);
      }

      // 早期完了ボーナス: now <= thresholdDate の中で最も低いthreshold（最高の達成）
      const bonusRules = rules.filter((r) => r.bonusRate > 0 && now <= thresholdDate(r.thresholdPercent));
      // 遅延ペナルティ: now >= thresholdDate の中で最も高いthreshold（最も具体的なペナルティ）
      const penaltyRules = rules.filter((r) => r.bonusRate < 0 && now >= thresholdDate(r.thresholdPercent));

      if (bonusRules.length > 0) {
        appliedRule = bonusRules[0]; // 最低threshold = 最高ボーナス
        bonusRate = appliedRule.bonusRate;
      } else if (penaltyRules.length > 0) {
        appliedRule = penaltyRules[penaltyRules.length - 1]; // 最高threshold = 最も具体的なペナルティ
        bonusRate = appliedRule.bonusRate;
      }
    }
  }

  // 実際の総支払額を計算
  const totalPayout = assignedSubQuests.reduce((sum, sq) => {
    const bonus = Math.round(sq.pointReward * bonusRate / 100);
    return sum + sq.pointReward + bonus;
  }, 0);

  // トランザクションで一括処理
  await prisma.$transaction(async (tx) => {
    // クエストを完了に変更
    await tx.quest.update({
      where: { id: questId },
      data: { status: "COMPLETED" },
    });

    // アサイン済みサブクエストの担当者にポイントを付与（ボーナス/ペナルティ込み）
    for (const sq of assignedSubQuests) {
      if (sq.assigneeId && sq.pointReward > 0) {
        const bonus = Math.round(sq.pointReward * bonusRate / 100);
        await tx.groupMember.update({
          where: { id: sq.assigneeId },
          data: { memberPoints: { increment: sq.pointReward + bonus } },
        });
      }
      // サブクエストも完了に変更
      await tx.subQuest.update({
        where: { id: sq.id },
        data: { status: "COMPLETED" },
      });
    }

    // 支払者のポイントを調整
    if (quest.questType === "MEMBER") {
      // 作成時にエスクロー済みの額（quest.pointReward）との差分を調整
      const diff = totalPayout - quest.pointReward;
      if (diff > 0) {
        // ボーナス分を発行者から追加徴収
        await tx.groupMember.update({
          where: { id: quest.creatorId },
          data: { memberPoints: { decrement: diff } },
        });
      } else if (diff < 0) {
        // ペナルティ分を発行者に返還
        await tx.groupMember.update({
          where: { id: quest.creatorId },
          data: { memberPoints: { increment: -diff } },
        });
      }
    } else if (quest.questType === "GOVERNMENT") {
      // 政府案件: 実際の支払額をグループの発行済みポイントから差し引く
      await tx.group.update({
        where: { id: groupId },
        data: { totalIssuedPoints: { decrement: totalPayout } },
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

  const bonusDetail = appliedRule
    ? `（ボーナス/ペナルティ ${appliedRule.bonusRate > 0 ? "+" : ""}${appliedRule.bonusRate}% 適用）`
    : "";
  await addQuestLog({ questId, memberId: member.id, action: "COMPLETED", detail: `クエストが完了しました${bonusDetail}` });

  return NextResponse.json({
    ...updated,
    appliedBonus: appliedRule
      ? { thresholdPercent: appliedRule.thresholdPercent, bonusRate: appliedRule.bonusRate }
      : null,
  });
}

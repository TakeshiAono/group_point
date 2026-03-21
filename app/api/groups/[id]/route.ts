import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// 政府発行済みポイントを加減算（ADMINのみ）
// delta > 0: 追加発行
// delta < 0: 回収（流通中のポイントは回収不可）
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId } = await params;
  const { delta } = await req.json();

  if (typeof delta !== "number" || !Number.isInteger(delta) || delta === 0) {
    return NextResponse.json({ error: "deltaは0以外の整数で指定してください" }, { status: 400 });
  }

  // ADMINのみ操作可能
  const operator = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!operator || operator.role !== "ADMIN") {
    return NextResponse.json({ error: "ポイント操作はADMINのみ実行できます" }, { status: 403 });
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    return NextResponse.json({ error: "グループが見つかりません" }, { status: 404 });
  }

  const newTotal = group.totalIssuedPoints + delta;

  if (newTotal < 0) {
    return NextResponse.json({ error: "発行済みポイントが0を下回ることはできません" }, { status: 400 });
  }

  // 回収の場合：流通中ポイント（メンバー保有 + アクティブ案件割当）を下回れない
  if (delta < 0) {
    const members = await prisma.groupMember.findMany({ where: { groupId } });
    const memberPointsTotal = members.reduce((sum, m) => sum + m.memberPoints, 0);
    const activeGovQuests = await prisma.quest.findMany({
      where: { groupId, questType: "GOVERNMENT", status: { in: ["OPEN", "IN_PROGRESS"] } },
      select: { pointReward: true },
    });
    const allocatedQuestPoints = activeGovQuests.reduce((sum, q) => sum + q.pointReward, 0);
    const totalCirculating = memberPointsTotal + allocatedQuestPoints;
    if (newTotal < totalCirculating) {
      const reclaimable = group.totalIssuedPoints - totalCirculating;
      return NextResponse.json(
        { error: `回収できるのは未流通分（${reclaimable} pt）までです` },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.group.update({
    where: { id: groupId },
    data: { totalIssuedPoints: newTotal },
  });

  return NextResponse.json(updated);
}

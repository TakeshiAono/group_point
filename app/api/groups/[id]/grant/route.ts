import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// ポイントを直接付与する（ADMINのみ）
// 政府の未割当ポイント（発行済み - 流通中 - 政府案件の報酬合計）から充当する
// body: { amount: number, memberId?: string }
//   memberId あり → 個人付与
//   memberId なし → グループ全員に付与（合計 = amount × 人数）
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId } = await params;
  const { amount, memberId } = await req.json();

  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ error: "付与量は1以上の整数で指定してください" }, { status: 400 });
  }

  // ADMINのみ操作可能
  const operator = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!operator || operator.role !== "ADMIN") {
    return NextResponse.json({ error: "ポイント付与はADMINのみ実行できます" }, { status: 403 });
  }

  // 未割当ポイントを計算
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return NextResponse.json({ error: "グループが見つかりません" }, { status: 404 });

  const allMembers = await prisma.groupMember.findMany({ where: { groupId } });
  const totalCirculating = allMembers.reduce((sum, m) => sum + m.memberPoints, 0);
  const activeGovQuests = await prisma.quest.findMany({
    where: { groupId, questType: "GOVERNMENT", status: { in: ["OPEN", "IN_PROGRESS"] } },
  });
  const allocated = activeGovQuests.reduce((sum, q) => sum + q.pointReward, 0);
  const available = group.totalIssuedPoints - totalCirculating - allocated;

  if (memberId) {
    // ── 個人付与 ──────────────────────────────────────────
    const target = await prisma.groupMember.findUnique({ where: { id: memberId } });
    if (!target || target.groupId !== groupId) {
      return NextResponse.json({ error: "メンバーが見つかりません" }, { status: 404 });
    }
    if (amount > available) {
      return NextResponse.json(
        { error: `未割当ポイントが不足しています（残り ${available} pt）` },
        { status: 400 }
      );
    }
    const updated = await prisma.groupMember.update({
      where: { id: memberId },
      data: { memberPoints: { increment: amount } },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({ type: "individual", updated });
  } else {
    // ── 全員付与 ──────────────────────────────────────────
    const targets = allMembers.filter((m) => m.id !== operator.id); // ADMIN自身は除外するか含めるか？→含める
    const totalCost = amount * allMembers.length;
    if (totalCost > available) {
      return NextResponse.json(
        { error: `未割当ポイントが不足しています（必要: ${totalCost} pt、残り: ${available} pt）` },
        { status: 400 }
      );
    }
    await prisma.groupMember.updateMany({
      where: { groupId },
      data: { memberPoints: { increment: amount } },
    });
    return NextResponse.json({ type: "all", totalGranted: totalCost, memberCount: allMembers.length });
  }
}

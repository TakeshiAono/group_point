import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; questId: string }> };

// ボーナスルール一覧取得
export async function GET(_req: Request, { params }: Params) {
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

  const rules = await prisma.$queryRaw<
    { id: string; questId: string; thresholdPercent: number; bonusRate: number; createdAt: Date }[]
  >`SELECT id, "questId", "thresholdPercent", "bonusRate", "createdAt" FROM "BonusRule" WHERE "questId" = ${questId} ORDER BY "thresholdPercent" ASC`;

  return NextResponse.json(rules);
}

// ボーナスルール作成（クエスト発行者・受注者のみ）
export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId, questId } = await params;
  const { thresholdPercent, bonusRate } = await req.json();

  if (typeof thresholdPercent !== "number" || thresholdPercent <= 0) {
    return NextResponse.json({ error: "しきい値は0より大きい数値で指定してください" }, { status: 400 });
  }
  if (typeof bonusRate !== "number" || bonusRate === 0) {
    return NextResponse.json({ error: "ボーナス率は0以外の数値で指定してください" }, { status: 400 });
  }

  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!member) {
    return NextResponse.json({ error: "グループのメンバーではありません" }, { status: 403 });
  }

  const quest = await prisma.quest.findUnique({ where: { id: questId } });
  if (!quest || quest.groupId !== groupId) {
    return NextResponse.json({ error: "クエストが見つかりません" }, { status: 404 });
  }

  // 発行者のみ操作可能
  if (quest.creatorId !== member.id) {
    return NextResponse.json({ error: "クエストの発行者のみ操作できます" }, { status: 403 });
  }

  const [rule] = await prisma.$queryRaw<
    { id: string; questId: string; thresholdPercent: number; bonusRate: number; createdAt: Date }[]
  >`
    INSERT INTO "BonusRule" (id, "questId", "thresholdPercent", "bonusRate", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, ${questId}, ${thresholdPercent}, ${bonusRate}, NOW(), NOW())
    RETURNING id, "questId", "thresholdPercent", "bonusRate", "createdAt"
  `;

  return NextResponse.json(rule, { status: 201 });
}

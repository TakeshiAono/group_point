import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// ボーナスルール一覧取得
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId } = await params;

  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!member) {
    return NextResponse.json({ error: "グループのメンバーではありません" }, { status: 403 });
  }

  const rules = await prisma.$queryRaw<
    { id: string; groupId: string; thresholdPercent: number; bonusRate: number; createdAt: Date }[]
  >`SELECT id, "groupId", "thresholdPercent", "bonusRate", "createdAt" FROM "BonusRule" WHERE "groupId" = ${groupId} ORDER BY "thresholdPercent" ASC`;

  return NextResponse.json(rules);
}

// ボーナスルール作成（ADMINのみ）
export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId } = await params;
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
  if (!member || member.role !== "ADMIN") {
    return NextResponse.json({ error: "ADMINのみ操作できます" }, { status: 403 });
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    return NextResponse.json({ error: "グループが見つかりません" }, { status: 404 });
  }

  const [rule] = await prisma.$queryRaw<
    { id: string; groupId: string; thresholdPercent: number; bonusRate: number; createdAt: Date }[]
  >`
    INSERT INTO "BonusRule" (id, "groupId", "thresholdPercent", "bonusRate", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, ${groupId}, ${thresholdPercent}, ${bonusRate}, NOW(), NOW())
    RETURNING id, "groupId", "thresholdPercent", "bonusRate", "createdAt"
  `;

  return NextResponse.json(rule, { status: 201 });
}

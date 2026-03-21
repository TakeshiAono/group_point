import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; ruleId: string }> };

// ボーナスルール削除（ADMINのみ）
export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId, ruleId } = await params;

  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!member || member.role !== "ADMIN") {
    return NextResponse.json({ error: "ADMINのみ操作できます" }, { status: 403 });
  }

  const [rule] = await prisma.$queryRaw<{ id: string; groupId: string }[]>`
    SELECT id, "groupId" FROM "BonusRule" WHERE id = ${ruleId}
  `;
  if (!rule || rule.groupId !== groupId) {
    return NextResponse.json({ error: "ルールが見つかりません" }, { status: 404 });
  }

  await prisma.$executeRaw`DELETE FROM "BonusRule" WHERE id = ${ruleId}`;

  return NextResponse.json({ success: true });
}

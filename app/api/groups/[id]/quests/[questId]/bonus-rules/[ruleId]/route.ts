import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; questId: string; ruleId: string }> };

// ボーナスルール削除（クエスト発行者・受注者のみ）
export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId, questId, ruleId } = await params;

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

  if (quest.creatorId !== member.id && quest.completerId !== member.id) {
    return NextResponse.json({ error: "クエストの発行者または受注者のみ操作できます" }, { status: 403 });
  }

  const [rule] = await prisma.$queryRaw<{ id: string; questId: string }[]>`
    SELECT id, "questId" FROM "BonusRule" WHERE id = ${ruleId}
  `;
  if (!rule || rule.questId !== questId) {
    return NextResponse.json({ error: "ルールが見つかりません" }, { status: 404 });
  }

  await prisma.$executeRaw`DELETE FROM "BonusRule" WHERE id = ${ruleId}`;

  return NextResponse.json({ success: true });
}

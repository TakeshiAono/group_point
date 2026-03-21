import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; questId: string }> };

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

  const logs = await prisma.$queryRaw<
    { id: string; action: string; detail: string; createdAt: Date; memberName: string | null; memberEmail: string | null }[]
  >`
    SELECT
      ql.id,
      ql.action,
      ql.detail,
      ql."createdAt",
      u.name AS "memberName",
      u.email AS "memberEmail"
    FROM "QuestLog" ql
    LEFT JOIN "GroupMember" gm ON gm.id = ql."memberId"
    LEFT JOIN "User" u ON u.id = gm."userId"
    WHERE ql."questId" = ${questId}
    ORDER BY ql."createdAt" DESC
  `;

  return NextResponse.json(logs);
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// 自分が担当しているサブクエスト一覧取得
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  // 自分のGroupMember IDを全グループ分取得
  const members = await prisma.groupMember.findMany({
    where: { userId: session.user.id },
    select: { id: true, groupId: true },
  });

  const memberIds = members.map((m) => m.id);

  const subQuests = await prisma.subQuest.findMany({
    where: { assigneeId: { in: memberIds } },
    include: {
      assignee: { include: { user: { select: { id: true, name: true, email: true } } } },
      quest: {
        include: {
          group: { select: { id: true, name: true } },
          creator: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(subQuests);
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// 提案を却下（ADMIN/LEADERのみ）
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId, proposalId } = await params;

  const reviewer = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!reviewer) {
    return NextResponse.json({ error: "グループのメンバーではありません" }, { status: 403 });
  }
  if (reviewer.role === "MEMBER") {
    return NextResponse.json({ error: "却下はADMIN・LEADERのみ実行できます" }, { status: 403 });
  }

  const proposal = await prisma.questProposal.findUnique({
    where: { id: proposalId },
  });
  if (!proposal || proposal.groupId !== groupId) {
    return NextResponse.json({ error: "提案が見つかりません" }, { status: 404 });
  }
  if (proposal.status !== "PENDING") {
    return NextResponse.json({ error: "すでに審査済みの提案です" }, { status: 400 });
  }

  const { rejectReason } = await req.json().catch(() => ({}));

  const updated = await prisma.questProposal.update({
    where: { id: proposalId },
    data: {
      status: "REJECTED",
      rejectReason: rejectReason?.trim() ?? null,
    },
    include: {
      proposer: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });

  return NextResponse.json(updated);
}

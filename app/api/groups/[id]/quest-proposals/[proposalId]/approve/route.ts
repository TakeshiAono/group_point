import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addQuestLog } from "@/lib/questLog";

// 提案を承認して政府案件として発行（ADMIN/LEADERのみ）
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId, proposalId } = await params;

  const approver = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!approver) {
    return NextResponse.json({ error: "グループのメンバーではありません" }, { status: 403 });
  }
  if (approver.role === "MEMBER") {
    return NextResponse.json({ error: "承認はADMIN・LEADERのみ実行できます" }, { status: 403 });
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

  // 政府の未割当ポイントを確認
  const body = await req.json().catch(() => ({}));
  const pointReward: number = typeof body.pointReward === "number" ? body.pointReward : proposal.pointReward;
  const title: string = body.title?.trim() || proposal.title;
  const description: string | null = body.description !== undefined ? (body.description?.trim() || null) : proposal.description;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  const members = await prisma.groupMember.findMany({ where: { groupId } });
  const totalCirculating = members.reduce((sum, m) => sum + m.memberPoints, 0);
  const activeGovQuests = await prisma.quest.findMany({
    where: { groupId, questType: "GOVERNMENT", status: { in: ["OPEN", "IN_PROGRESS"] } },
  });
  const allocated = activeGovQuests.reduce((sum, q) => sum + q.pointReward, 0);
  const available = group!.totalIssuedPoints - totalCirculating - allocated;

  if (pointReward > available) {
    return NextResponse.json(
      { error: `政府の未割当ポイントが不足しています（残り ${available} pt）` },
      { status: 400 }
    );
  }

  // 提案を承認し、クエストを作成
  const [updatedProposal, quest] = await prisma.$transaction([
    prisma.questProposal.update({
      where: { id: proposalId },
      data: { status: "APPROVED", title, description },
      include: {
        proposer: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    }),
    prisma.quest.create({
      data: {
        groupId,
        creatorId: approver.id,
        title,
        description,
        pointReward,
        questType: "GOVERNMENT",
        deadline: proposal.deadline,
      },
      include: {
        creator: { include: { user: { select: { id: true, name: true, email: true } } } },
        completer: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    }),
  ]);

  await addQuestLog({
    questId: quest.id,
    memberId: approver.id,
    action: "CREATED",
    detail: `提案「${proposal.title}」が承認され、クエストとして発行されました（${quest.pointReward} pt）`,
  });

  return NextResponse.json({ proposal: updatedProposal, quest }, { status: 201 });
}

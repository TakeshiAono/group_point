import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// クエスト提案一覧取得（グループメンバー全員）
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const proposals = await prisma.questProposal.findMany({
    where: { groupId },
    include: {
      proposer: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(proposals);
}

// クエスト提案作成（グループメンバー全員）
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId } = await params;
  const { title, description, pointReward, deadline } = await req.json();

  if (!title?.trim()) {
    return NextResponse.json({ error: "タイトルは必須です" }, { status: 400 });
  }
  if (typeof pointReward !== "number" || !Number.isInteger(pointReward) || pointReward <= 0) {
    return NextResponse.json({ error: "希望報酬は1以上の整数で指定してください" }, { status: 400 });
  }

  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!member) {
    return NextResponse.json({ error: "グループのメンバーではありません" }, { status: 403 });
  }

  const proposal = await prisma.questProposal.create({
    data: {
      groupId,
      proposerId: member.id,
      title: title.trim(),
      description: description?.trim() ?? null,
      pointReward,
      deadline: deadline ? new Date(deadline) : null,
    },
    include: {
      proposer: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });

  return NextResponse.json(proposal, { status: 201 });
}

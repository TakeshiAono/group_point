import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// サブクエスト一覧取得
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; questId: string }> }
) {
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

  const subQuests = await prisma.subQuest.findMany({
    where: { questId },
    include: {
      assignee: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(subQuests);
}

// サブクエスト作成
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; questId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId, questId } = await params;
  const { title, assigneeId } = await req.json();

  if (!title?.trim()) {
    return NextResponse.json({ error: "タイトルは必須です" }, { status: 400 });
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

  // サブクエスト作成者はクエストの受注者か作成者のみ
  if (quest.creatorId !== member.id && quest.completerId !== member.id) {
    return NextResponse.json({ error: "サブクエストを作成できるのはクエストの発行者または受注者のみです" }, { status: 403 });
  }

  // assigneeId が指定されている場合、同グループのメンバーか確認
  if (assigneeId) {
    const assignee = await prisma.groupMember.findUnique({ where: { id: assigneeId } });
    if (!assignee || assignee.groupId !== groupId) {
      return NextResponse.json({ error: "担当者が見つかりません" }, { status: 404 });
    }
  }

  const subQuest = await prisma.subQuest.create({
    data: { questId, title: title.trim(), assigneeId: assigneeId ?? null },
    include: {
      assignee: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });

  return NextResponse.json(subQuest, { status: 201 });
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; questId: string; subQuestId: string }> };

// サブクエスト詳細取得
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId, questId, subQuestId } = await params;

  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!member) {
    return NextResponse.json({ error: "グループのメンバーではありません" }, { status: 403 });
  }

  const subQuest = await prisma.subQuest.findUnique({
    where: { id: subQuestId },
    include: {
      assignee: { include: { user: { select: { id: true, name: true, email: true } } } },
      quest: {
        include: {
          creator: { include: { user: { select: { id: true, name: true, email: true } } } },
          completer: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      },
    },
  });

  if (!subQuest || subQuest.questId !== questId) {
    return NextResponse.json({ error: "サブクエストが見つかりません" }, { status: 404 });
  }

  return NextResponse.json(subQuest);
}

// 報酬変更提案（クエストの発行者または受注者がASSIGNED/CHANGE_DENIEDのサブクエストに対して）
export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId, questId, subQuestId } = await params;
  const { pendingPointReward } = await req.json();

  if (typeof pendingPointReward !== "number" || pendingPointReward < 0 || !Number.isInteger(pendingPointReward)) {
    return NextResponse.json({ error: "報酬は0以上の整数で入力してください" }, { status: 400 });
  }

  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!member) {
    return NextResponse.json({ error: "グループのメンバーではありません" }, { status: 403 });
  }

  const subQuest = await prisma.subQuest.findUnique({
    where: { id: subQuestId },
    include: {
      quest: { include: { subQuests: { select: { id: true, pointReward: true } } } },
    },
  });

  if (!subQuest || subQuest.questId !== questId) {
    return NextResponse.json({ error: "サブクエストが見つかりません" }, { status: 404 });
  }

  if (subQuest.quest.creatorId !== member.id && subQuest.quest.completerId !== member.id) {
    return NextResponse.json({ error: "クエストの発行者または受注者のみ変更を提案できます" }, { status: 403 });
  }

  if (subQuest.status !== "ASSIGNED" && subQuest.status !== "CHANGE_DENIED") {
    return NextResponse.json({ error: "アサイン済みまたは変更否認のサブクエストのみ変更できます" }, { status: 400 });
  }

  // 他サブクエストの合計 + 今回の変更後がクエスト報酬を超えないか確認
  const otherTotal = subQuest.quest.subQuests
    .filter((sq) => sq.id !== subQuestId)
    .reduce((sum, sq) => sum + sq.pointReward, 0);
  if (otherTotal + pendingPointReward > subQuest.quest.pointReward) {
    return NextResponse.json(
      { error: `報酬の合計がクエスト報酬（${subQuest.quest.pointReward} pt）を超えます。最大 ${subQuest.quest.pointReward - otherTotal} pt まで設定できます。` },
      { status: 400 }
    );
  }

  const updated = await prisma.subQuest.update({
    where: { id: subQuestId },
    data: { status: "CHANGE_PENDING", pendingPointReward },
    include: {
      assignee: { include: { user: { select: { id: true, name: true, email: true } } } },
      quest: {
        include: {
          creator: { include: { user: { select: { id: true, name: true, email: true } } } },
          completer: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      },
    },
  });

  return NextResponse.json(updated);
}

// サブクエスト削除
export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId, questId, subQuestId } = await params;

  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!member) {
    return NextResponse.json({ error: "グループのメンバーではありません" }, { status: 403 });
  }

  const subQuest = await prisma.subQuest.findUnique({
    where: { id: subQuestId },
    include: { quest: true },
  });

  if (!subQuest || subQuest.questId !== questId) {
    return NextResponse.json({ error: "サブクエストが見つかりません" }, { status: 404 });
  }

  // クエストの発行者または受注者のみ削除可
  if (subQuest.quest.creatorId !== member.id && subQuest.quest.completerId !== member.id) {
    return NextResponse.json({ error: "削除できるのはクエストの発行者または受注者のみです" }, { status: 403 });
  }

  await prisma.subQuest.delete({ where: { id: subQuestId } });

  return NextResponse.json({ success: true });
}

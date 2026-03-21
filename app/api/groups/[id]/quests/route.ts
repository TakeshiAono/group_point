import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addQuestLog } from "@/lib/questLog";

// クエスト一覧取得
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId } = await params;

  const quests = await prisma.quest.findMany({
    where: { groupId },
    include: {
      creator: { include: { user: { select: { id: true, name: true, email: true } } } },
      completer: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(quests);
}

// クエスト作成
// GOVERNMENT: ADMIN・LEADERのみ。政府の未割当ポイントから報酬を確保
// MEMBER: 全員可。作成者の保有ポイントからエスクロー（即時引落）
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId } = await params;
  const { title, description, pointReward, questType, deadline } = await req.json();

  if (!title?.trim()) {
    return NextResponse.json({ error: "タイトルは必須です" }, { status: 400 });
  }
  if (questType !== "GOVERNMENT" && questType !== "MEMBER") {
    return NextResponse.json({ error: "questTypeはGOVERNMENTまたはMEMBERを指定してください" }, { status: 400 });
  }
  if (typeof pointReward !== "number" || !Number.isInteger(pointReward) || pointReward <= 0) {
    return NextResponse.json({ error: "報酬は1以上の整数で指定してください" }, { status: 400 });
  }

  // 作成者のメンバー情報を取得
  const creatorMember = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!creatorMember) {
    return NextResponse.json({ error: "グループのメンバーではありません" }, { status: 403 });
  }

  if (questType === "GOVERNMENT") {
    // 政府案件：ADMIN・LEADERのみ作成可
    if (creatorMember.role === "MEMBER") {
      return NextResponse.json({ error: "政府案件の発行はADMIN・LEADERのみ実行できます" }, { status: 403 });
    }

    // 政府の未割当ポイントを計算
    // 未割当 = 残り予算（totalIssuedPoints）- 既存のオープン政府案件の報酬合計
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    const activeGovQuests = await prisma.quest.findMany({
      where: { groupId, questType: "GOVERNMENT", status: { in: ["OPEN", "IN_PROGRESS"] } },
    });
    const allocated = activeGovQuests.reduce((sum, q) => sum + q.pointReward, 0);
    const available = group!.totalIssuedPoints - allocated;

    if (pointReward > available) {
      return NextResponse.json(
        { error: `政府の未割当ポイントが不足しています（残り ${available} pt）` },
        { status: 400 }
      );
    }

    const quest = await prisma.quest.create({
      data: { groupId, creatorId: creatorMember.id, title: title.trim(), description: description?.trim() ?? null, pointReward, questType: "GOVERNMENT", deadline: deadline ? new Date(deadline) : null },
      include: {
        creator: { include: { user: { select: { id: true, name: true, email: true } } } },
        completer: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });

    await addQuestLog({ questId: quest.id, memberId: creatorMember.id, action: "CREATED", detail: `クエスト「${quest.title}」が作成されました（${quest.pointReward} pt）` });

    return NextResponse.json(quest, { status: 201 });
  }

  // メンバー案件：残高チェックのみ（支払いは完了時）
  if (creatorMember.memberPoints < pointReward) {
    return NextResponse.json(
      { error: `保有ポイントが不足しています（残り ${creatorMember.memberPoints} pt）` },
      { status: 400 }
    );
  }

  const quest = await prisma.quest.create({
    data: { groupId, creatorId: creatorMember.id, title: title.trim(), description: description?.trim() ?? null, pointReward, questType: "MEMBER", deadline: deadline ? new Date(deadline) : null },
    include: {
      creator: { include: { user: { select: { id: true, name: true, email: true } } } },
      completer: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });

  await addQuestLog({ questId: quest.id, memberId: creatorMember.id, action: "CREATED", detail: `クエスト「${quest.title}」が作成されました（${quest.pointReward} pt）` });

  return NextResponse.json(quest, { status: 201 });
}

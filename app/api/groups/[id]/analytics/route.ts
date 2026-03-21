import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function toMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toWeek(date: Date): string {
  const weekOfMonth = Math.ceil(date.getDate() / 7);
  if (weekOfMonth >= 5) {
    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    const nm = String(nextMonth.getMonth() + 1).padStart(2, "0");
    return `${nm}-w1`;
  }
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${month}-w${weekOfMonth}`;
}

function toBucket(date: Date, granularity: "month" | "week"): string {
  return granularity === "week" ? toWeek(date) : toMonth(date);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId } = await params;

  const url = new URL(req.url);
  const questTypesParam = url.searchParams.get("questTypes");
  const questTypeFilter = questTypesParam
    ? (questTypesParam.split(",") as ("GOVERNMENT" | "MEMBER")[])
    : (["GOVERNMENT", "MEMBER"] as ("GOVERNMENT" | "MEMBER")[]);
  const granularity = (url.searchParams.get("granularity") ?? "month") as "month" | "week";

  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!member) return NextResponse.json({ error: "メンバーではありません" }, { status: 403 });

  // ── クエスト一覧（作成日・完了情報付き） ─────────────────
  const quests = await prisma.quest.findMany({
    where: { groupId, questType: { in: questTypeFilter } },
    include: {
      completer: { include: { user: { select: { id: true, name: true, email: true } } } },
      creator:   { include: { user: { select: { id: true, name: true, email: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  // ── クエスト完了ログ（ポイント付与タイミング） ──────────
  const completeLogs = await prisma.questLog.findMany({
    where: { quest: { groupId }, action: "COMPLETED" },
    orderBy: { createdAt: "asc" },
  });

  // ── 提案一覧 ─────────────────────────────────────────────
  const proposals = await prisma.questProposal.findMany({
    where: { groupId },
    orderBy: { createdAt: "asc" },
  });

  // ── メンバー一覧 ──────────────────────────────────────────
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  // ────────────────────────────────────────────────────────────
  // 1. クエスト時系列 (月別)
  // ────────────────────────────────────────────────────────────
  const questMonthMap: Record<string, { govCreated: number; memberCreated: number; completed: number }> = {};
  for (const q of quests) {
    const m = toBucket(q.createdAt, granularity);
    if (!questMonthMap[m]) questMonthMap[m] = { govCreated: 0, memberCreated: 0, completed: 0 };
    if (q.questType === "GOVERNMENT") questMonthMap[m].govCreated++;
    else questMonthMap[m].memberCreated++;
  }
  for (const log of completeLogs) {
    const m = toBucket(log.createdAt, granularity);
    if (!questMonthMap[m]) questMonthMap[m] = { govCreated: 0, memberCreated: 0, completed: 0 };
    questMonthMap[m].completed++;
  }
  const questTimeseries = Object.entries(questMonthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));

  // ────────────────────────────────────────────────────────────
  // 2. 提案時系列 (月別)
  // ────────────────────────────────────────────────────────────
  const propMonthMap: Record<string, { created: number; approved: number; rejected: number }> = {};
  for (const p of proposals) {
    const m = toBucket(p.createdAt, granularity);
    if (!propMonthMap[m]) propMonthMap[m] = { created: 0, approved: 0, rejected: 0 };
    propMonthMap[m].created++;
    if (p.status === "APPROVED") propMonthMap[m].approved++;
    if (p.status === "REJECTED") propMonthMap[m].rejected++;
  }
  const proposalTimeseries = Object.entries(propMonthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));

  // ────────────────────────────────────────────────────────────
  // 3. メンバー別ポイント推移（イベントから再構成）
  // ────────────────────────────────────────────────────────────
  // イベント: quest完了 → completer に actualPaidPoints 加算
  //           MEMBER quest作成 → creator から pointReward 減算
  type Evt = { date: Date; memberId: string; delta: number };
  const events: Evt[] = [];

  for (const q of quests) {
    if (q.questType === "MEMBER" && q.creator) {
      events.push({ date: q.createdAt, memberId: q.creatorId, delta: -q.pointReward });
    }
  }
  for (const log of completeLogs) {
    const quest = quests.find((q) => q.id === log.questId);
    if (!quest?.completerId) continue;
    const paid = quest.actualPaidPoints ?? quest.pointReward;
    events.push({ date: log.createdAt, memberId: quest.completerId, delta: paid });
    // MEMBER quest: creator receives nothing (already deducted at creation)
  }
  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  // 月ごとの差分を集計し、現在残高から逆算
  const memberMonthDelta: Record<string, Record<string, number>> = {};
  for (const evt of events) {
    const m = toBucket(evt.date, granularity);
    if (!memberMonthDelta[evt.memberId]) memberMonthDelta[evt.memberId] = {};
    memberMonthDelta[evt.memberId][m] = (memberMonthDelta[evt.memberId][m] ?? 0) + evt.delta;
  }

  // 全月一覧
  const allMonths = Array.from(
    new Set([...questTimeseries.map((x) => x.month), ...proposalTimeseries.map((x) => x.month)])
  ).sort();

  const memberPointHistory = members.map((m) => {
    const deltas = memberMonthDelta[m.id] ?? {};
    // 現在残高から逆算して累積を復元
    const totalDelta = Object.values(deltas).reduce((s, v) => s + v, 0);
    let running = m.memberPoints - totalDelta;
    const history = allMonths.map((month) => {
      running += deltas[month] ?? 0;
      return { month, balance: running };
    });
    return {
      memberId: m.id,
      name: m.user.name ?? m.user.email,
      currentPoints: m.memberPoints,
      history,
    };
  });

  // ────────────────────────────────────────────────────────────
  // 4. メンバー別完了数推移（累積）
  // ────────────────────────────────────────────────────────────
  const memberCompletionMonthCount: Record<string, Record<string, number>> = {};
  for (const log of completeLogs) {
    const quest = quests.find((q) => q.id === log.questId);
    if (!quest?.completerId) continue;
    const m = toBucket(log.createdAt, granularity);
    if (!memberCompletionMonthCount[quest.completerId]) memberCompletionMonthCount[quest.completerId] = {};
    memberCompletionMonthCount[quest.completerId][m] = (memberCompletionMonthCount[quest.completerId][m] ?? 0) + 1;
  }
  const memberCompletionHistory = members.map((m) => {
    const monthCounts = memberCompletionMonthCount[m.id] ?? {};
    let running = 0;
    const history = allMonths.map((month) => {
      running += monthCounts[month] ?? 0;
      return { month, count: running };
    });
    return { memberId: m.id, name: m.user.name ?? m.user.email, history };
  });

  // ────────────────────────────────────────────────────────────
  // 5. メンバー別提案数推移（累積）
  // ────────────────────────────────────────────────────────────
  const memberProposalMonthCount: Record<string, Record<string, number>> = {};
  for (const p of proposals) {
    const m = toBucket(p.createdAt, granularity);
    if (!memberProposalMonthCount[p.proposerId]) memberProposalMonthCount[p.proposerId] = {};
    memberProposalMonthCount[p.proposerId][m] = (memberProposalMonthCount[p.proposerId][m] ?? 0) + 1;
  }
  const memberProposalHistory = members.map((m) => {
    const monthCounts = memberProposalMonthCount[m.id] ?? {};
    let running = 0;
    const history = allMonths.map((month) => {
      running += monthCounts[month] ?? 0;
      return { month, count: running };
    });
    return { memberId: m.id, name: m.user.name ?? m.user.email, history };
  });

  return NextResponse.json({ questTimeseries, proposalTimeseries, memberPointHistory, memberCompletionHistory, memberProposalHistory });
}

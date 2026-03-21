"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatPoint, type PointGroup } from "@/lib/pointFormat";

type QuestUser = { id: string; name: string | null; email: string };
type QuestMember = { id: string; user: QuestUser };

type Quest = {
  id: string;
  title: string;
  pointReward: number;
  actualPaidPoints: number | null;
  questType: "GOVERNMENT" | "MEMBER";
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  creator: QuestMember;
  completer: QuestMember | null;
  createdAt: string;
};

type Member = {
  id: string;
  role: "ADMIN" | "LEADER" | "MEMBER";
  memberPoints: number;
  user: QuestUser;
};

type Group = {
  id: string;
  name: string;
  totalIssuedPoints: number;
  pointUnit: string;
  laborCostPerHour: number;
  timeUnit: string;
  members: Member[];
};

const DEFAULT_POINT_GROUP: PointGroup = { pointUnit: "pt", laborCostPerHour: 0, timeUnit: "HOUR" };

const QUEST_STATUS_LABEL: Record<Quest["status"], string> = {
  OPEN: "受付中",
  IN_PROGRESS: "進行中",
  COMPLETED: "完了",
  CANCELLED: "キャンセル",
};

const QUEST_STATUS_COLOR: Record<Quest["status"], string> = {
  OPEN: "bg-green-500",
  IN_PROGRESS: "bg-yellow-400",
  COMPLETED: "bg-blue-500",
  CANCELLED: "bg-gray-300",
};

export default function GroupAnalyticsPage() {
  const { id: groupId } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/groups").then((r) => r.ok ? r.json() : []),
      fetch(`/api/groups/${groupId}/quests`).then((r) => r.ok ? r.json() : []),
    ]).then(([groups, questData]) => {
      if (Array.isArray(groups)) {
        const g = groups.find((x: Group) => x.id === groupId);
        if (g) setGroup(g);
      }
      if (Array.isArray(questData)) setQuests(questData);
    }).finally(() => setLoading(false));
  }, [groupId]);

  if (loading) return <div className="p-10 text-gray-500">読み込み中...</div>;
  if (!group) return <div className="p-10 text-red-500">グループが見つかりません</div>;

  const pg: PointGroup = { pointUnit: group.pointUnit, laborCostPerHour: group.laborCostPerHour, timeUnit: group.timeUnit };

  // ── ポイント統計 ────────────────────────────────────
  const totalCirculating = group.members.reduce((s, m) => s + m.memberPoints, 0);
  const escrow = quests
    .filter((q) => q.questType === "GOVERNMENT" && (q.status === "OPEN" || q.status === "IN_PROGRESS"))
    .reduce((s, q) => s + q.pointReward, 0);
  const available = group.totalIssuedPoints - totalCirculating - escrow;

  // ── クエスト統計 ────────────────────────────────────
  const govQuests = quests.filter((q) => q.questType === "GOVERNMENT");
  const memberQuests = quests.filter((q) => q.questType === "MEMBER");
  const completedQuests = quests.filter((q) => q.status === "COMPLETED");
  const totalPaid = completedQuests.reduce((s, q) => s + (q.actualPaidPoints ?? q.pointReward), 0);

  const statusCounts = (["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const).map((s) => ({
    status: s,
    count: quests.filter((q) => q.status === s).length,
  }));
  const total = quests.length || 1;

  // ── メンバー ─────────────────────────────────────────
  const sortedMembers = [...group.members].sort((a, b) => b.memberPoints - a.memberPoints);

  // ── ランキング（完了クエスト数） ──────────────────────
  const completionCount: Record<string, { member: Member; count: number }> = {};
  completedQuests.forEach((q) => {
    if (!q.completer) return;
    const m = group.members.find((m) => m.id === q.completer!.id);
    if (!m) return;
    if (!completionCount[m.id]) completionCount[m.id] = { member: m, count: 0 };
    completionCount[m.id].count++;
  });
  const completionRanking = Object.values(completionCount).sort((a, b) => b.count - a.count).slice(0, 5);

  const maxPoints = Math.max(...group.members.map((m) => m.memberPoints), 1);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-center gap-3">
        <Link href={`/groups/${groupId}`} className="text-sm text-gray-400 hover:text-gray-600 transition">
          ← {group.name}
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">グループ分析</h2>
      </div>

      {/* ポイント概要 */}
      <section className="space-y-3">
        <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">ポイント概要</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="発行済み" value={formatPoint(group.totalIssuedPoints, pg)} color="text-gray-800" />
          <StatCard label="流通中" value={formatPoint(totalCirculating, pg)} color="text-blue-600" />
          <StatCard label="エスクロー" value={formatPoint(escrow, pg)} color="text-yellow-600" sub="進行中クエスト" />
          <StatCard label="未割当" value={formatPoint(available, pg)} color="text-green-600" />
        </div>

        {/* 内訳バー */}
        {group.totalIssuedPoints > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <p className="text-xs text-gray-400">ポイント内訳</p>
            <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
              <div className="bg-blue-500 transition-all" style={{ width: `${(totalCirculating / group.totalIssuedPoints) * 100}%` }} title={`流通中: ${formatPoint(totalCirculating, pg)}`} />
              <div className="bg-yellow-400 transition-all" style={{ width: `${(escrow / group.totalIssuedPoints) * 100}%` }} title={`エスクロー: ${formatPoint(escrow, pg)}`} />
              <div className="bg-green-400 transition-all" style={{ width: `${(Math.max(available, 0) / group.totalIssuedPoints) * 100}%` }} title={`未割当: ${formatPoint(available, pg)}`} />
            </div>
            <div className="flex gap-4 text-xs text-gray-400">
              <span><span className="inline-block w-2 h-2 rounded-sm bg-blue-500 mr-1" />流通中</span>
              <span><span className="inline-block w-2 h-2 rounded-sm bg-yellow-400 mr-1" />エスクロー</span>
              <span><span className="inline-block w-2 h-2 rounded-sm bg-green-400 mr-1" />未割当</span>
            </div>
          </div>
        )}
      </section>

      {/* クエスト統計 */}
      <section className="space-y-3">
        <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">クエスト統計</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="総クエスト数" value={`${quests.length} 件`} color="text-gray-800" />
          <StatCard label="管理側案件" value={`${govQuests.length} 件`} color="text-purple-600" />
          <StatCard label="メンバー案件" value={`${memberQuests.length} 件`} color="text-blue-600" />
          <StatCard label="完了済み支払" value={formatPoint(totalPaid, pg)} color="text-green-600" />
        </div>

        {/* ステータス別バー */}
        {quests.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs text-gray-400">ステータス別</p>
            {statusCounts.map(({ status, count }) => (
              <div key={status} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20 shrink-0">{QUEST_STATUS_LABEL[status]}</span>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${QUEST_STATUS_COLOR[status]}`}
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-600 w-8 text-right shrink-0">{count}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* メンバー保有ポイント */}
      <section className="space-y-3">
        <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">メンバー保有ポイント</h3>
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          {sortedMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <span className="text-xs text-gray-700 w-32 shrink-0 truncate">
                {m.user.name ?? m.user.email}
              </span>
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${(m.memberPoints / maxPoints) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-blue-600 w-24 text-right shrink-0">
                {formatPoint(m.memberPoints, pg)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 完了ランキング */}
      {completionRanking.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">完了数ランキング</h3>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {completionRanking.map(({ member, count }, i) => (
              <div key={member.id} className="flex items-center gap-3 px-5 py-3">
                <span className={`text-sm font-bold w-6 ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-400" : "text-gray-300"}`}>
                  {i + 1}
                </span>
                <span className="flex-1 text-sm text-gray-700">
                  {member.user.name ?? member.user.email}
                </span>
                <span className="text-sm font-bold text-blue-600">{count} 件</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 space-y-0.5">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

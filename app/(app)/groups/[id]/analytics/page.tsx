"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatPoint, type PointGroup } from "@/lib/pointFormat";
import {
  LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, ResponsiveContainer,
} from "recharts";

// ─── 型定義 ─────────────────────────────────────────────────
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
  deadline: string | null;
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

type AnalyticsData = {
  questTimeseries: { month: string; govCreated: number; memberCreated: number; completed: number }[];
  proposalTimeseries: { month: string; created: number; approved: number; rejected: number }[];
  memberPointHistory: { memberId: string; name: string; currentPoints: number; history: { month: string; balance: number }[] }[];
};

// ─── 定数 ───────────────────────────────────────────────────
const MEMBER_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

// ─── メインページ ────────────────────────────────────────────
export default function GroupAnalyticsPage() {
  const { id: groupId } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/groups").then((r) => r.ok ? r.json() : []),
      fetch(`/api/groups/${groupId}/quests`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/groups/${groupId}/analytics`).then((r) => r.ok ? r.json() : null),
    ]).then(([groups, questData, analyticsData]) => {
      if (Array.isArray(groups)) {
        const g = groups.find((x: Group) => x.id === groupId);
        if (g) setGroup(g);
      }
      if (Array.isArray(questData)) setQuests(questData);
      if (analyticsData) setAnalytics(analyticsData);
    }).finally(() => setLoading(false));
  }, [groupId]);

  if (loading) return <div className="p-10 text-gray-500">読み込み中...</div>;
  if (!group) return <div className="p-10 text-red-500">グループが見つかりません</div>;

  const pg: PointGroup = { pointUnit: group.pointUnit, laborCostPerHour: group.laborCostPerHour, timeUnit: group.timeUnit };

  // ── ポイントランキング ──────────────────────────────────────
  const sortedMembers = [...group.members].sort((a, b) => b.memberPoints - a.memberPoints);

  // ── 完了数ランキング ──────────────────────────────────────
  const completedQuests = quests.filter((q) => q.status === "COMPLETED");
  const completionCount: Record<string, { member: Member; count: number }> = {};
  completedQuests.forEach((q) => {
    if (!q.completer) return;
    const m = group.members.find((m) => m.id === q.completer!.id);
    if (!m) return;
    if (!completionCount[m.id]) completionCount[m.id] = { member: m, count: 0 };
    completionCount[m.id].count++;
  });
  const completionRanking = Object.values(completionCount).sort((a, b) => b.count - a.count);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Link href={`/groups/${groupId}`} className="text-sm text-gray-400 hover:text-gray-600 transition">
          ← {group.name}
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">グループ分析</h2>
      </div>

      {/* ポイントランキング（円グラフ） */}
      <div className="space-y-3">
        <SubTitle>保有ポイント分布</SubTitle>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-6">
          <ResponsiveContainer width={220} height={220}>
            <PieChart>
              <Pie data={sortedMembers.map((m, i) => ({ name: m.user.name ?? m.user.email, value: m.memberPoints, color: MEMBER_COLORS[i % MEMBER_COLORS.length] }))} dataKey="value" cx="50%" cy="50%" outerRadius={90} label={false}>
                {sortedMembers.map((m, i) => (
                  <Cell key={m.id} fill={MEMBER_COLORS[i % MEMBER_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatPoint(Number(v), pg)} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="space-y-2 flex-1 min-w-0">
            {sortedMembers.map((m, i) => (
              <li key={m.id} className="flex items-center gap-2 text-sm">
                <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length] }} />
                <span className="flex-1 truncate text-gray-700">{m.user.name ?? m.user.email}</span>
                <span className="font-bold shrink-0" style={{ color: MEMBER_COLORS[i % MEMBER_COLORS.length] }}>{formatPoint(m.memberPoints, pg)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 完了数ランキング（円グラフ） */}
      {completionRanking.length > 0 && (
        <div className="space-y-3">
          <SubTitle>クエスト完了数分布</SubTitle>
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-6">
            <ResponsiveContainer width={220} height={220}>
              <PieChart>
                <Pie data={completionRanking.map(({ member, count }, i) => ({ name: member.user.name ?? member.user.email, value: count, color: MEMBER_COLORS[i % MEMBER_COLORS.length] }))} dataKey="value" cx="50%" cy="50%" outerRadius={90} label={false}>
                  {completionRanking.map(({ member }, i) => (
                    <Cell key={member.id} fill={MEMBER_COLORS[i % MEMBER_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v} 件`} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="space-y-2 flex-1 min-w-0">
              {completionRanking.map(({ member, count }, i) => (
                <li key={member.id} className="flex items-center gap-2 text-sm">
                  <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length] }} />
                  <span className="flex-1 truncate text-gray-700">{member.user.name ?? member.user.email}</span>
                  <span className="font-bold shrink-0" style={{ color: MEMBER_COLORS[i % MEMBER_COLORS.length] }}>{count} 件</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 各人の保有ポイント推移 */}
      {analytics && analytics.memberPointHistory.length > 0 && analytics.memberPointHistory[0].history.length > 1 && (
        <div className="space-y-3">
          <SubTitle>保有ポイント推移（個人別）</SubTitle>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={analytics.memberPointHistory[0].history.map((h) => {
                const row: Record<string, string | number> = { month: h.month };
                analytics.memberPointHistory.forEach((mp) => {
                  const found = mp.history.find((x) => x.month === h.month);
                  row[mp.name] = found?.balance ?? 0;
                });
                return row;
              })}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {analytics.memberPointHistory.map((mp, i) => (
                  <Line
                    key={mp.memberId}
                    type="monotone"
                    dataKey={mp.name}
                    stroke={MEMBER_COLORS[i % MEMBER_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 共通コンポーネント ──────────────────────────────────────
function SubTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-gray-600">{children}</p>;
}

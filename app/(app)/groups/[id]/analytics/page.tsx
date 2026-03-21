"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatPoint, type PointGroup } from "@/lib/pointFormat";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
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
const DEFAULT_POINT_GROUP: PointGroup = { pointUnit: "pt", laborCostPerHour: 0, timeUnit: "HOUR" };

const QUEST_STATUS_COLOR: Record<Quest["status"], string> = {
  OPEN: "bg-green-500",
  IN_PROGRESS: "bg-yellow-400",
  COMPLETED: "bg-blue-500",
  CANCELLED: "bg-gray-300",
};
const QUEST_STATUS_LABEL: Record<Quest["status"], string> = {
  OPEN: "受付中", IN_PROGRESS: "進行中", COMPLETED: "完了", CANCELLED: "キャンセル",
};

const MEMBER_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

type ActiveFilter = "reward" | "deadline";

// ─── メインページ ────────────────────────────────────────────
export default function GroupAnalyticsPage() {
  const { id: groupId } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("reward");

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

  // ── ポイント統計 ──────────────────────────────────────────
  const totalCirculating = group.members.reduce((s, m) => s + m.memberPoints, 0);
  const escrow = quests
    .filter((q) => q.questType === "GOVERNMENT" && (q.status === "OPEN" || q.status === "IN_PROGRESS"))
    .reduce((s, q) => s + q.pointReward, 0);
  const available = group.totalIssuedPoints - totalCirculating - escrow;

  // ── クエスト統計 ──────────────────────────────────────────
  const completedQuests = quests.filter((q) => q.status === "COMPLETED");
  const totalPaid = completedQuests.reduce((s, q) => s + (q.actualPaidPoints ?? q.pointReward), 0);
  const statusCounts = (["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const).map((s) => ({
    status: s, count: quests.filter((q) => q.status === s).length,
  }));
  const questTotal = quests.length || 1;

  // ── 受注中クエスト（フィルター付き） ──────────────────────
  const activeQuests = quests.filter((q) => q.status === "IN_PROGRESS");
  const sortedActiveQuests = [...activeQuests].sort((a, b) => {
    if (activeFilter === "reward") return b.pointReward - a.pointReward;
    const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return da - db;
  });

  // ── ポイントランキング ──────────────────────────────────────
  const sortedMembers = [...group.members].sort((a, b) => b.memberPoints - a.memberPoints);
  const maxPoints = Math.max(...group.members.map((m) => m.memberPoints), 1);

  // ── 完了数ランキング ──────────────────────────────────────
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

      {/* ══════════════════════════════════════════════════════
          グループ全体分析
      ══════════════════════════════════════════════════════ */}
      <div className="space-y-8">
        <SectionTitle>グループ全体</SectionTitle>

        {/* ポイント概要カード */}
        <div className="space-y-3">
          <SubTitle>ポイント概要</SubTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="発行済み" value={formatPoint(group.totalIssuedPoints, pg)} color="text-gray-800" />
            <StatCard label="流通中" value={formatPoint(totalCirculating, pg)} color="text-blue-600" />
            <StatCard label="エスクロー" value={formatPoint(escrow, pg)} color="text-yellow-600" sub="進行中クエスト" />
            <StatCard label="未割当" value={formatPoint(available, pg)} color="text-green-600" />
          </div>
          {group.totalIssuedPoints > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
              <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
                <div className="bg-blue-500 transition-all" style={{ width: `${(totalCirculating / group.totalIssuedPoints) * 100}%` }} />
                <div className="bg-yellow-400 transition-all" style={{ width: `${(escrow / group.totalIssuedPoints) * 100}%` }} />
                <div className="bg-green-400 transition-all" style={{ width: `${(Math.max(available, 0) / group.totalIssuedPoints) * 100}%` }} />
              </div>
              <div className="flex gap-4 text-xs text-gray-400">
                <LegendDot color="bg-blue-500" label="流通中" />
                <LegendDot color="bg-yellow-400" label="エスクロー" />
                <LegendDot color="bg-green-400" label="未割当" />
              </div>
            </div>
          )}
        </div>

        {/* クエスト統計 */}
        <div className="space-y-3">
          <SubTitle>クエスト統計</SubTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="総クエスト数" value={`${quests.length} 件`} color="text-gray-800" />
            <StatCard label="管理側案件" value={`${quests.filter((q) => q.questType === "GOVERNMENT").length} 件`} color="text-purple-600" />
            <StatCard label="メンバー案件" value={`${quests.filter((q) => q.questType === "MEMBER").length} 件`} color="text-blue-600" />
            <StatCard label="完了済み支払" value={formatPoint(totalPaid, pg)} color="text-green-600" />
          </div>
          {quests.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              {statusCounts.map(({ status, count }) => (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-16 shrink-0">{QUEST_STATUS_LABEL[status]}</span>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${QUEST_STATUS_COLOR[status]}`} style={{ width: `${(count / questTotal) * 100}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-600 w-6 text-right shrink-0">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* クエスト発行・完了推移 */}
        {analytics && analytics.questTimeseries.length > 0 && (
          <div className="space-y-3">
            <SubTitle>クエスト発行・完了推移</SubTitle>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analytics.questTimeseries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="govCreated" name="管理側案件発行" fill="#8b5cf6" stackId="created" />
                  <Bar dataKey="memberCreated" name="メンバー案件発行" fill="#3b82f6" stackId="created" />
                  <Bar dataKey="completed" name="完了" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 提案推移 */}
        {analytics && analytics.proposalTimeseries.length > 0 && (
          <div className="space-y-3">
            <SubTitle>クエスト提案の推移</SubTitle>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analytics.proposalTimeseries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="created" name="提案数" fill="#f59e0b" />
                  <Bar dataKey="approved" name="承認数" fill="#10b981" />
                  <Bar dataKey="rejected" name="却下数" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 受注中クエスト（フィルター付き） */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <SubTitle>受注中クエスト</SubTitle>
            <div className="flex gap-1.5">
              {(["reward", "deadline"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-3 py-1 text-xs rounded-full border transition ${
                    activeFilter === f
                      ? "bg-blue-600 text-white border-blue-600"
                      : "text-gray-600 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {f === "reward" ? "報酬が高い順" : "納期が早い順"}
                </button>
              ))}
            </div>
          </div>
          {sortedActiveQuests.length === 0 ? (
            <p className="text-sm text-gray-400">受注中のクエストはありません</p>
          ) : (
            <ul className="space-y-2">
              {sortedActiveQuests.map((q) => {
                const isOverdue = q.deadline && new Date(q.deadline) < new Date();
                return (
                  <li key={q.id}>
                    <Link
                      href={`/groups/${groupId}/quests/${q.id}`}
                      className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center justify-between gap-4 hover:shadow-md hover:border-blue-200 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{q.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          受注者: {q.completer?.user.name ?? q.completer?.user.email ?? "—"}
                          {q.deadline && (
                            <span className={`ml-2 ${isOverdue ? "text-red-500 font-medium" : ""}`}>
                              納期: {new Date(q.deadline).toLocaleDateString("ja-JP")}{isOverdue && "（超過）"}
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="text-base font-bold text-blue-600 shrink-0">{formatPoint(q.pointReward, pg)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          個人別分析
      ══════════════════════════════════════════════════════ */}
      <div className="space-y-8">
        <SectionTitle>個人別分析</SectionTitle>

        {/* ポイントランキング */}
        <div className="space-y-3">
          <SubTitle>保有ポイントランキング</SubTitle>
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            {sortedMembers.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3">
                <span className={`text-sm font-bold w-6 ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-400" : "text-gray-300"}`}>
                  {i + 1}
                </span>
                <span className="text-xs text-gray-700 w-28 shrink-0 truncate">
                  {m.user.name ?? m.user.email}
                </span>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(m.memberPoints / maxPoints) * 100}%`, backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length] }}
                  />
                </div>
                <span className="text-xs font-bold w-24 text-right shrink-0" style={{ color: MEMBER_COLORS[i % MEMBER_COLORS.length] }}>
                  {formatPoint(m.memberPoints, pg)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 完了数ランキング */}
        {completionRanking.length > 0 && (
          <div className="space-y-3">
            <SubTitle>クエスト完了数ランキング</SubTitle>
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {completionRanking.map(({ member, count }, i) => (
                <div key={member.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`text-sm font-bold w-6 ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-400" : "text-gray-300"}`}>
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-gray-700">{member.user.name ?? member.user.email}</span>
                  <span className="text-sm font-bold text-blue-600">{count} 件</span>
                </div>
              ))}
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
    </div>
  );
}

// ─── 共通コンポーネント ──────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h3 className="text-lg font-bold text-gray-800">{children}</h3>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-gray-600">{children}</p>;
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

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block w-2 h-2 rounded-sm ${color}`} />
      {label}
    </span>
  );
}

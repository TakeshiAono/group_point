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

type MemberHistory<T> = { memberId: string; name: string; history: T[] };

type AnalyticsData = {
  questTimeseries: { month: string; govCreated: number; memberCreated: number; completed: number }[];
  proposalTimeseries: { month: string; created: number; approved: number; rejected: number }[];
  memberPointHistory: MemberHistory<{ month: string; balance: number }>[];
  memberCompletionHistory: MemberHistory<{ month: string; count: number }>[];
  memberProposalHistory: MemberHistory<{ month: string; count: number }>[];
};

type TopPieMode = "points" | "proposals";

// ─── 定数 ───────────────────────────────────────────────────
const MEMBER_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

// ─── メインページ ────────────────────────────────────────────
export default function GroupAnalyticsPage() {
  const { id: groupId } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [baseAnalytics, setBaseAnalytics] = useState<AnalyticsData | null>(null);
  const [filteredAnalytics, setFilteredAnalytics] = useState<AnalyticsData | null>(null);

  const STORAGE_KEY = `analytics-filter-${groupId}`;

  function loadStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as { topPieMode: TopPieMode; selectedMonth: string; questTypes: ("GOVERNMENT" | "MEMBER")[] };
    } catch { return null; }
  }

  function saveStorage(data: { topPieMode: TopPieMode; selectedMonth: string; questTypes: ("GOVERNMENT" | "MEMBER")[] }) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }

  const saved = typeof window !== "undefined" ? loadStorage() : null;

  const [topPieMode, setTopPieMode] = useState<TopPieMode>(saved?.topPieMode ?? "points");
  const [selectedMonth, setSelectedMonth] = useState<string>(saved?.selectedMonth ?? "current");
  const [questTypeFilter, setQuestTypeFilter] = useState<Set<"GOVERNMENT" | "MEMBER">>(
    new Set(saved?.questTypes ?? ["GOVERNMENT", "MEMBER"])
  );

  function toggleQuestType(type: "GOVERNMENT" | "MEMBER") {
    setQuestTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size === 1) return prev;
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  useEffect(() => {
    saveStorage({ topPieMode, selectedMonth, questTypes: Array.from(questTypeFilter) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topPieMode, selectedMonth, questTypeFilter]);

  useEffect(() => {
    Promise.all([
      fetch("/api/groups").then((r) => r.ok ? r.json() : []),
      fetch(`/api/groups/${groupId}/analytics?questTypes=GOVERNMENT,MEMBER`).then((r) => r.ok ? r.json() : null),
    ]).then(([groups, analyticsData]) => {
      if (Array.isArray(groups)) {
        const g = groups.find((x: Group) => x.id === groupId);
        if (g) setGroup(g);
      }
      if (analyticsData) {
        setBaseAnalytics(analyticsData);
        const months = Array.from(new Set([
          ...analyticsData.questTimeseries.map((x: { month: string }) => x.month),
          ...analyticsData.proposalTimeseries.map((x: { month: string }) => x.month),
        ])).sort() as string[];
        setSelectedMonth((prev) => (prev === "current" ? (months[months.length - 1] ?? "current") : prev));
      }
    }).finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => {
    const questTypes = Array.from(questTypeFilter).join(",");
    fetch(`/api/groups/${groupId}/analytics?questTypes=${questTypes}`)
      .then((r) => r.ok ? r.json() : null)
      .then((analyticsData) => {
        if (analyticsData) setFilteredAnalytics(analyticsData);
      });
  }, [groupId, questTypeFilter]);

  if (loading) return <div className="p-10 text-gray-500">読み込み中...</div>;
  if (!group) return <div className="p-10 text-red-500">グループが見つかりません</div>;

  const pg: PointGroup = { pointUnit: group.pointUnit, laborCostPerHour: group.laborCostPerHour, timeUnit: group.timeUnit };

  const allMonths = Array.from(new Set([
    ...(baseAnalytics?.questTimeseries.map((x) => x.month) ?? []),
    ...(baseAnalytics?.proposalTimeseries.map((x) => x.month) ?? []),
  ])).sort();

  // ── 上部円グラフデータ ─────────────────────────────────────
  type PieEntry = { id: string; name: string; value: number; label: string };

  let topPieData: PieEntry[] = [];
  if (baseAnalytics) {
    if (topPieMode === "points") {
      topPieData = baseAnalytics.memberPointHistory
        .map((mp) => {
          const found = mp.history.find((h) => h.month === selectedMonth);
          return { id: mp.memberId, name: mp.name, value: found?.balance ?? 0, label: formatPoint(found?.balance ?? 0, pg) };
        })
        .sort((a, b) => b.value - a.value);
    } else {
      topPieData = baseAnalytics.memberProposalHistory
        .map((mp) => {
          const found = mp.history.find((h) => h.month === selectedMonth);
          return { id: mp.memberId, name: mp.name, value: found?.count ?? 0, label: `${found?.count ?? 0} 件` };
        })
        .filter((e) => e.value > 0)
        .sort((a, b) => b.value - a.value);
    }
  }

  // ── 上部折れ線データ ───────────────────────────────────────
  type LineRow = Record<string, string | number>;

  function buildLineRows<T extends { month: string }>(
    histories: MemberHistory<T>[],
    getValue: (h: T) => number
  ): LineRow[] {
    if (histories.length === 0 || histories[0].history.length === 0) return [];
    return histories[0].history.map((h) => {
      const row: LineRow = { month: h.month };
      histories.forEach((mp) => {
        const found = mp.history.find((x) => x.month === h.month);
        row[mp.name] = found ? getValue(found) : 0;
      });
      return row;
    });
  }

  const topLineRows = baseAnalytics
    ? topPieMode === "points"
      ? buildLineRows(baseAnalytics.memberPointHistory, (h) => (h as { month: string; balance: number }).balance)
      : buildLineRows(baseAnalytics.memberProposalHistory, (h) => (h as { month: string; count: number }).count)
    : [];

  const topLineMembers = baseAnalytics
    ? (topPieMode === "points" ? baseAnalytics.memberPointHistory : baseAnalytics.memberProposalHistory)
    : [];

  // ── 下部円グラフデータ ─────────────────────────────────────
  let completionPieData: PieEntry[] = [];
  if (filteredAnalytics) {
    completionPieData = filteredAnalytics.memberCompletionHistory
      .map((mp) => {
        const found = mp.history.find((h) => h.month === selectedMonth);
        return { id: mp.memberId, name: mp.name, value: found?.count ?? 0, label: `${found?.count ?? 0} 件` };
      })
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value);
  }

  // ── 下部折れ線データ ───────────────────────────────────────
  const completionLineRows = filteredAnalytics
    ? buildLineRows(filteredAnalytics.memberCompletionHistory, (h) => (h as { month: string; count: number }).count)
    : [];

  const completionLineMembers = filteredAnalytics?.memberCompletionHistory ?? [];

  const monthSelector = (
    <select
      value={selectedMonth}
      onChange={(e) => setSelectedMonth(e.target.value)}
      className="ml-auto text-xs border border-gray-300 rounded-lg px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      {[...allMonths].reverse().map((m) => (
        <option key={m} value={m}>{m}</option>
      ))}
    </select>
  );

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Link href={`/groups/${groupId}`} className="text-sm text-gray-400 hover:text-gray-600 transition">
          ← {group.name}
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">グループ分析</h2>
      </div>

      {/* 上部：フィルター非依存 */}
      <AnalysisSection
        title={topPieMode === "points" ? "保有ポイント" : "提案数"}
        toggleButtons={
          <div className="flex gap-1.5">
            {(["points", "proposals"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTopPieMode(mode)}
                className={`px-3 py-1 text-xs rounded-full border transition ${
                  topPieMode === mode
                    ? "bg-blue-600 text-white border-blue-600"
                    : "text-gray-600 border-gray-300 hover:border-blue-400"
                }`}
              >
                {mode === "points" ? "保有ポイント" : "提案数"}
              </button>
            ))}
          </div>
        }
        monthSelector={monthSelector}
        pieData={topPieData}
        formatPieValue={(v) => topPieMode === "points" ? formatPoint(Number(v), pg) : `${v} 件`}
        lineRows={topLineRows}
        lineMembers={topLineMembers}
        formatLineTooltip={(v) => topPieMode === "points" ? formatPoint(Number(v), pg) : `${v} 件`}
      />

      {/* クエスト種別フィルター */}
      <div className="flex items-center gap-4 bg-white border border-blue-100 rounded-xl px-5 py-3">
        <span className="text-xs text-gray-500 shrink-0">クエスト種別フィルター</span>
        {(["GOVERNMENT", "MEMBER"] as const).map((type) => (
          <label key={type} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={questTypeFilter.has(type)}
              onChange={() => toggleQuestType(type)}
              className="w-3.5 h-3.5 accent-blue-600"
            />
            <span className="text-xs text-gray-700">{type === "GOVERNMENT" ? "管理側" : "メンバー"}</span>
          </label>
        ))}
        <span className="text-xs text-gray-400 ml-auto">↓ 以下のグラフに反映</span>
      </div>

      {/* 下部：フィルター依存 */}
      <AnalysisSection
        title="クエスト完了数"
        monthSelector={monthSelector}
        pieData={completionPieData}
        formatPieValue={(v) => `${v} 件`}
        lineRows={completionLineRows}
        lineMembers={completionLineMembers}
        formatLineTooltip={(v) => `${v} 件`}
      />
    </div>
  );
}

// ─── 共通コンポーネント ──────────────────────────────────────
type PieEntry = { id: string; name: string; value: number; label: string };
type LineRow = Record<string, string | number>;
type LineMember = { memberId: string; name: string };

function AnalysisSection({
  title,
  toggleButtons,
  monthSelector,
  pieData,
  formatPieValue,
  lineRows,
  lineMembers,
  formatLineTooltip,
}: {
  title: string;
  toggleButtons?: React.ReactNode;
  monthSelector?: React.ReactNode;
  pieData: PieEntry[];
  formatPieValue: (v: number | string) => string;
  lineRows: LineRow[];
  lineMembers: LineMember[];
  formatLineTooltip: (v: number | string) => string;
}) {
  return (
    <div className="space-y-3">
      {/* タイトル行 */}
      <div className="flex items-center gap-3 flex-wrap">
        <SubTitle>{title}</SubTitle>
        {toggleButtons}
        {monthSelector}
      </div>

      {/* 円グラフ */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-6">
        {pieData.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center w-full">該当データなし</p>
        ) : (
          <>
            <ResponsiveContainer width={220} height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  startAngle={90}
                  endAngle={-270}
                  label={false}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={entry.id} fill={MEMBER_COLORS[i % MEMBER_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, name) => [formatPieValue(v as number), name]} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="space-y-2 flex-1 min-w-0">
              {pieData.map((entry, i) => (
                <li key={entry.id} className="flex items-center gap-2 text-sm">
                  <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length] }} />
                  <span className="flex-1 truncate text-gray-700">{entry.name}</span>
                  <span className="font-bold shrink-0" style={{ color: MEMBER_COLORS[i % MEMBER_COLORS.length] }}>{entry.label}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* 折れ線グラフ */}
      {lineRows.length >= 1 && lineMembers.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={lineRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, name) => [formatLineTooltip(v as number), name]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {lineMembers.map((mp, i) => (
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
      )}
    </div>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-gray-600">{children}</p>;
}

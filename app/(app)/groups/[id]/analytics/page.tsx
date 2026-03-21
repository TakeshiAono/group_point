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

  // フィルター非依存データ（保有ポイント・提案数用）
  const [baseAnalytics, setBaseAnalytics] = useState<AnalyticsData | null>(null);
  // フィルター依存データ（完了数用）
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

  // 変更をlocalStorageに保存
  useEffect(() => {
    saveStorage({ topPieMode, selectedMonth, questTypes: Array.from(questTypeFilter) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topPieMode, selectedMonth, questTypeFilter]);

  // グループ情報 + フィルター非依存analytics（初回のみ）
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

  // フィルター依存analytics（questTypeFilter変更のたびに再フェッチ）
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

  // ── 全月一覧（ベースデータから） ───────────────────────────
  const allMonths = Array.from(new Set([
    ...(baseAnalytics?.questTimeseries.map((x) => x.month) ?? []),
    ...(baseAnalytics?.proposalTimeseries.map((x) => x.month) ?? []),
  ])).sort();

  // ── 上部円グラフデータ（フィルター非依存） ─────────────────
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

  // ── 下部円グラフデータ（フィルター依存） ───────────────────
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

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Link href={`/groups/${groupId}`} className="text-sm text-gray-400 hover:text-gray-600 transition">
          ← {group.name}
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">グループ分析</h2>
      </div>

      {/* ── 上部：クエスト種別に依存しない円グラフ ── */}
      <PieSection
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
        monthSelector={
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="ml-auto text-xs border border-gray-300 rounded-lg px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {[...allMonths].reverse().map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        }
        pieData={topPieData}
        formatValue={(v) => topPieMode === "points" ? formatPoint(Number(v), pg) : `${v} 件`}
      />

      {/* ── クエスト種別フィルター ── */}
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

      {/* ── 下部：クエスト種別フィルター依存の円グラフ ── */}
      <PieSection
        title="クエスト完了数"
        monthSelector={
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="ml-auto text-xs border border-gray-300 rounded-lg px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {[...allMonths].reverse().map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        }
        pieData={completionPieData}
        formatValue={(v) => `${v} 件`}
      />

      {/* 各人の保有ポイント推移 */}
      {baseAnalytics && baseAnalytics.memberPointHistory.length > 0 && baseAnalytics.memberPointHistory[0].history.length > 1 && (
        <div className="space-y-3">
          <SubTitle>保有ポイント推移（個人別）</SubTitle>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={baseAnalytics.memberPointHistory[0].history.map((h) => {
                const row: Record<string, string | number> = { month: h.month };
                baseAnalytics.memberPointHistory.forEach((mp) => {
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
                {baseAnalytics.memberPointHistory.map((mp, i) => (
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
type PieEntry = { id: string; name: string; value: number; label: string };

function PieSection({
  title,
  toggleButtons,
  monthSelector,
  pieData,
  formatValue,
}: {
  title: string;
  toggleButtons?: React.ReactNode;
  monthSelector?: React.ReactNode;
  pieData: PieEntry[];
  formatValue: (v: number | string) => string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <SubTitle>{title}</SubTitle>
        {toggleButtons}
        {monthSelector}
      </div>
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
                <Tooltip formatter={(v, name) => [formatValue(v as number), name]} />
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
    </div>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-gray-600">{children}</p>;
}

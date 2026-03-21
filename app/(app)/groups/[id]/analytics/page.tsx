"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatPoint, type PointGroup } from "@/lib/pointFormat";
import {
  LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, ResponsiveContainer, ReferenceLine,
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

type ActiveTab = "points" | "proposals" | "completion";
type Granularity = "month" | "week";

// ─── 定数 ───────────────────────────────────────────────────
const MEMBER_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

// ─── メインページ ────────────────────────────────────────────
export default function GroupAnalyticsPage() {
  const { id: groupId } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const STORAGE_KEY = `analytics-filter-${groupId}`;

  function loadStorage() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); } catch { return {}; }
  }

  // 上部（フィルター非依存）
  const [basePieAnalytics, setBasePieAnalytics] = useState<AnalyticsData | null>(null);
  const [topLineAnalytics, setTopLineAnalytics] = useState<AnalyticsData | null>(null);
  const [topGranularity, setTopGranularity] = useState<Granularity>(() => loadStorage().topGranularity ?? "month");
  const [topBucket, setTopBucket] = useState<string>(() => loadStorage().topBucket ?? "current");
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => loadStorage().activeTab ?? "points");

  // 下部（フィルター依存）
  const [filteredPieAnalytics, setFilteredPieAnalytics] = useState<AnalyticsData | null>(null);
  const [bottomLineAnalytics, setBottomLineAnalytics] = useState<AnalyticsData | null>(null);
  const [bottomGranularity, setBottomGranularity] = useState<Granularity>(() => loadStorage().bottomGranularity ?? "month");
  const [bottomBucket, setBottomBucket] = useState<string>(() => loadStorage().bottomBucket ?? "current");
  const [questTypeFilter, setQuestTypeFilter] = useState<Set<"GOVERNMENT" | "MEMBER">>(
    () => new Set(loadStorage().questTypes ?? ["GOVERNMENT", "MEMBER"])
  );
  // localStorage 保存
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        topGranularity, topBucket, activeTab,
        bottomGranularity, bottomBucket,
        questTypes: Array.from(questTypeFilter),
      }));
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topGranularity, topBucket, activeTab, bottomGranularity, bottomBucket, questTypeFilter]);

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

  // グループ情報 + 自分のメンバーID（初回のみ）
  useEffect(() => {
    Promise.all([
      fetch("/api/groups").then((r) => r.ok ? r.json() : []),
      fetch("/api/me").then((r) => r.ok ? r.json() : null),
    ]).then(([groups, me]) => {
      if (Array.isArray(groups)) {
        const g = groups.find((x: Group) => x.id === groupId);
        if (g) {
          setGroup(g);
          if (me?.id) {
            const m = g.members.find((mem: Member) => mem.user.id === me.id);
            if (m) setMyMemberId(m.id);
          }
        }
      }
    }).finally(() => setLoading(false));
  }, [groupId]);

  // 上部 円グラフ用（常に月単位、groupIdが変わるときのみ再フェッチ）
  useEffect(() => {
    fetch(`/api/groups/${groupId}/analytics?questTypes=GOVERNMENT,MEMBER&granularity=month`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setBasePieAnalytics(data);
        const buckets = Array.from(new Set([
          ...data.questTimeseries.map((x: { month: string }) => x.month),
          ...data.proposalTimeseries.map((x: { month: string }) => x.month),
        ])).sort() as string[];
        setTopBucket((prev) => (prev === "current" || !buckets.includes(prev))
          ? (buckets[buckets.length - 1] ?? "current") : prev);
      });
  }, [groupId]);

  // 上部 折れ線グラフ用（topGranularityが変わるたびに再フェッチ）
  useEffect(() => {
    fetch(`/api/groups/${groupId}/analytics?questTypes=GOVERNMENT,MEMBER&granularity=${topGranularity}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setTopLineAnalytics(data); });
  }, [groupId, topGranularity]);

  // 下部 円グラフ用（常に月単位、questTypeFilterが変わるときのみ再フェッチ）
  useEffect(() => {
    const questTypes = Array.from(questTypeFilter).join(",");
    fetch(`/api/groups/${groupId}/analytics?questTypes=${questTypes}&granularity=month`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setFilteredPieAnalytics(data);
        const buckets = Array.from(new Set([
          ...data.questTimeseries.map((x: { month: string }) => x.month),
          ...data.proposalTimeseries.map((x: { month: string }) => x.month),
        ])).sort() as string[];
        setBottomBucket((prev) => (prev === "current" || !buckets.includes(prev))
          ? (buckets[buckets.length - 1] ?? "current") : prev);
      });
  }, [groupId, questTypeFilter]);

  // 下部 折れ線グラフ用（bottomGranularity・questTypeFilterが変わるたびに再フェッチ）
  useEffect(() => {
    const questTypes = Array.from(questTypeFilter).join(",");
    fetch(`/api/groups/${groupId}/analytics?questTypes=${questTypes}&granularity=${bottomGranularity}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setBottomLineAnalytics(data); });
  }, [groupId, questTypeFilter, bottomGranularity]);

  if (loading) return <div className="p-10 text-gray-500">読み込み中...</div>;
  if (!group) return <div className="p-10 text-red-500">グループが見つかりません</div>;

  const pg: PointGroup = { pointUnit: group.pointUnit, laborCostPerHour: group.laborCostPerHour, timeUnit: group.timeUnit };

  // ── 上部データ ─────────────────────────────────────────────
  type PieEntry = { id: string; name: string; value: number; label: string };
  type LineRow = Record<string, string | number>;

  function selfName(memberId: string, name: string): string {
    return memberId === myMemberId ? "自分" : name;
  }

  function renameSelf<T>(list: MemberHistory<T>[]): MemberHistory<T>[] {
    return list.map((m) => ({ ...m, name: selfName(m.memberId, m.name) }));
  }

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

  // ── 上部データ（円グラフ：basePieAnalytics、折れ線：topLineAnalytics） ──
  const topAllBuckets = Array.from(new Set([
    ...(basePieAnalytics?.questTimeseries.map((x) => x.month) ?? []),
    ...(basePieAnalytics?.proposalTimeseries.map((x) => x.month) ?? []),
  ])).sort();

  let topPieData: PieEntry[] = [];
  if (basePieAnalytics) {
    if (activeTab === "points") {
      topPieData = basePieAnalytics.memberPointHistory
        .map((mp) => {
          const found = mp.history.find((h) => h.month === topBucket);
          return { id: mp.memberId, name: selfName(mp.memberId, mp.name), value: found?.balance ?? 0, label: formatPoint(found?.balance ?? 0, pg) };
        }).sort((a, b) => b.value - a.value);
    } else {
      topPieData = basePieAnalytics.memberProposalHistory
        .map((mp) => {
          const found = mp.history.find((h) => h.month === topBucket);
          return { id: mp.memberId, name: selfName(mp.memberId, mp.name), value: found?.count ?? 0, label: `${found?.count ?? 0} 件` };
        }).filter((e) => e.value > 0).sort((a, b) => b.value - a.value);
    }
  }

  const topLineMembers = topLineAnalytics
    ? activeTab === "points"
      ? renameSelf(topLineAnalytics.memberPointHistory)
      : renameSelf(topLineAnalytics.memberProposalHistory)
    : [];
  const topLineRows = topLineAnalytics
    ? activeTab === "points"
      ? buildLineRows(renameSelf(topLineAnalytics.memberPointHistory), (h) => h.balance)
      : buildLineRows(renameSelf(topLineAnalytics.memberProposalHistory), (h) => h.count)
    : [];

  // ── 下部データ（円グラフ：filteredPieAnalytics、折れ線：bottomLineAnalytics） ──
  const bottomAllBuckets = Array.from(new Set([
    ...(filteredPieAnalytics?.questTimeseries.map((x) => x.month) ?? []),
    ...(filteredPieAnalytics?.proposalTimeseries.map((x) => x.month) ?? []),
  ])).sort();

  let completionPieData: PieEntry[] = [];
  if (filteredPieAnalytics) {
    completionPieData = filteredPieAnalytics.memberCompletionHistory
      .map((mp) => {
        const found = mp.history.find((h) => h.month === bottomBucket);
        return { id: mp.memberId, name: selfName(mp.memberId, mp.name), value: found?.count ?? 0, label: `${found?.count ?? 0} 件` };
      }).filter((e) => e.value > 0).sort((a, b) => b.value - a.value);
  }

  const completionLineMembers = bottomLineAnalytics
    ? renameSelf(bottomLineAnalytics.memberCompletionHistory)
    : [];
  const completionLineRows = bottomLineAnalytics
    ? buildLineRows(renameSelf(bottomLineAnalytics.memberCompletionHistory), (h) => h.count)
    : [];

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Link href={`/groups/${groupId}`} className="text-sm text-gray-400 hover:text-gray-600 transition">
          ← {group.name}
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">グループ分析</h2>
      </div>

      {/* タブ */}
      <div>
        {/* タブバー */}
        <div className="flex border-b border-gray-200">
          {([
            { key: "points",     label: "保有ポイント" },
            { key: "proposals",  label: "提案数" },
            { key: "completion", label: "クエスト完了数" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
                activeTab === key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* タブコンテンツ */}
        <div className="border border-t-0 border-gray-200 rounded-b-2xl p-5 space-y-3 bg-gray-50">
          {activeTab === "completion" && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-gray-400">クエスト種別フィルター</span>
              {(["GOVERNMENT", "MEMBER"] as const).map((type) => (
                <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={questTypeFilter.has(type)} onChange={() => toggleQuestType(type)}
                    className="w-3.5 h-3.5 accent-blue-600" />
                  <span className="text-xs text-gray-700">{type === "GOVERNMENT" ? "管理側" : "メンバー"}</span>
                </label>
              ))}
            </div>
          )}

          {activeTab !== "completion" ? (
            <AnalysisSection
              title={activeTab === "points" ? "保有ポイント" : "提案数"}
              allBuckets={topAllBuckets}
              selectedBucket={topBucket}
              onBucketChange={setTopBucket}
              granularity={topGranularity}
              onGranularityChange={(g) => setTopGranularity(g)}
              pieData={topPieData}
              formatPieValue={(v) => activeTab === "points" ? formatPoint(Number(v), pg) : `${v} 件`}
              lineRows={topLineRows}
              lineMembers={topLineMembers}
              formatLineTooltip={(v) => activeTab === "points" ? formatPoint(Number(v), pg) : `${v} 件`}
              myMemberId={myMemberId}
            />
          ) : (
            <AnalysisSection
              title="クエスト完了数"
              allBuckets={bottomAllBuckets}
              selectedBucket={bottomBucket}
              onBucketChange={setBottomBucket}
              granularity={bottomGranularity}
              onGranularityChange={(g) => setBottomGranularity(g)}
              pieData={completionPieData}
              formatPieValue={(v) => `${v} 件`}
              lineRows={completionLineRows}
              lineMembers={completionLineMembers}
              formatLineTooltip={(v) => `${v} 件`}
              myMemberId={myMemberId}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 共通コンポーネント ──────────────────────────────────────
type PieEntry = { id: string; name: string; value: number; label: string };
type LineRow = Record<string, string | number>;
type LineMember = { memberId: string; name: string };

function AnalysisSection({
  title,
  allBuckets, selectedBucket, onBucketChange,
  granularity, onGranularityChange,
  pieData, formatPieValue,
  lineRows, lineMembers, formatLineTooltip,
  myMemberId,
}: {
  title: string;
  allBuckets: string[];
  selectedBucket: string;
  onBucketChange: (v: string) => void;
  granularity: "month" | "week";
  onGranularityChange: (g: "month" | "week") => void;
  pieData: PieEntry[];
  formatPieValue: (v: number | string) => string;
  lineRows: LineRow[];
  lineMembers: LineMember[];
  formatLineTooltip: (v: number | string) => string;
  myMemberId: string | null;
}) {
  const [topN, setTopN] = useState<"all" | 3 | 5 | 10>("all");
  const limit = topN === "all" ? pieData.length : topN;
  const displayedPie = pieData.slice(0, limit);
  const displayedIds = new Set(displayedPie.map((e) => e.id));
  const displayedLineMembers = lineMembers.filter((m) => displayedIds.has(m.memberId));
  const displayedLineRows = lineRows.map((row) => {
    const r: LineRow = { month: row.month };
    displayedLineMembers.forEach((m) => { r[m.name] = row[m.name]; });
    return r;
  });

  return (
    <div className="space-y-3">
      {/* タイトル行 */}
      <div className="flex items-center gap-3 flex-wrap">
        <SubTitle>{title}</SubTitle>
      </div>

      {/* 円グラフ */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex justify-end">
          <select
            value={selectedBucket}
            onChange={(e) => onBucketChange(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {[...allBuckets].reverse().map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-6">
        {displayedPie.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center w-full">該当データなし</p>
        ) : (
          <>
            <ResponsiveContainer width={220} height={220}>
              <PieChart>
                <Pie data={displayedPie} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  outerRadius={90} startAngle={90} endAngle={-270} label={false}>
                  {displayedPie.map((entry, i) => {
                    const isMe = entry.id === myMemberId;
                    return (
                      <Cell key={entry.id}
                        fill={MEMBER_COLORS[i % MEMBER_COLORS.length]}
                        stroke={isMe ? "#fff" : "none"}
                        strokeWidth={isMe ? 3 : 0}
                        opacity={isMe ? 1 : 0.65} />
                    );
                  })}
                </Pie>
                <Tooltip formatter={(v, name) => [formatPieValue(v as number), name]} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="space-y-2 flex-1 min-w-0">
              {displayedPie.map((entry, i) => {
                const isMe = entry.id === myMemberId;
                return (
                  <li key={entry.id} className={`flex items-center gap-2 text-sm ${isMe ? "font-bold" : ""}`}>
                    <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length] }} />
                    <span className={`flex-1 truncate ${isMe ? "text-gray-900" : "text-gray-700"}`}>
                      {entry.name}
                    </span>
                    <span className="font-bold shrink-0" style={{ color: MEMBER_COLORS[i % MEMBER_COLORS.length] }}>{entry.label}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        </div>
      </div>

      {/* 折れ線グラフ（粒度ドロップダウン付き） */}
      {displayedLineRows.length >= 1 && displayedLineMembers.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-end">
            <select
              value={granularity}
              onChange={(e) => onGranularityChange(e.target.value as "month" | "week")}
              className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="month">月単位</option>
              <option value="week">週単位</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={displayedLineRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => granularity === "week" ? v.slice(5) : v} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, name) => [formatLineTooltip(v as number), name]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {granularity === "week" && displayedLineRows
                .filter((row) => String(row.month).endsWith("-w1"))
                .map((row) => {
                  const mmw1 = String(row.month).slice(5);
                  const mm = mmw1.replace("-w1", "");
                  return (
                    <ReferenceLine key={String(row.month)} x={String(row.month)}
                      stroke="#94a3b8" strokeDasharray="4 2"
                      label={{ value: `${mm}月`, fontSize: 10, fill: "#94a3b8", position: "insideTopLeft" }} />
                  );
                })}
              {displayedLineMembers.map((mp, i) => {
                const isMe = mp.memberId === myMemberId;
                return (
                  <Line key={mp.memberId} type="linear" dataKey={mp.name}
                    stroke={MEMBER_COLORS[i % MEMBER_COLORS.length]}
                    strokeWidth={isMe ? 3 : 1.5}
                    dot={isMe ? { r: 3 } : false}
                    strokeOpacity={isMe ? 1 : 0.45} />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="text-xs text-gray-400">表示人数</span>
            <select
              value={topN}
              onChange={(e) => setTopN(e.target.value === "all" ? "all" : Number(e.target.value) as 3 | 5 | 10)}
              className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="all">全員</option>
              <option value={3}>トップ3</option>
              <option value={5}>トップ5</option>
              <option value={10}>トップ10</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-gray-600">{children}</p>;
}

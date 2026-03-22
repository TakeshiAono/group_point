"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useOnboarding } from "@/lib/onboarding-context";

type Role = "ADMIN" | "LEADER" | "MEMBER";

type Member = {
  id: string;
  role: Role;
  memberPoints: number;
  user: { id: string; name: string | null; email: string };
};

type Group = {
  id: string;
  name: string;
  totalIssuedPoints?: number; // ADMIN/LEADERのみ返される
  pointUnit: string;
  laborCostPerHour: number;
  timeUnit: string;
  proposalReward: number;
  displayMultiplier: number;
  members: Member[];
};

// timeUnit: YEN=円のまま表示、HOUR/DAY/WEEK/MONTH=人・時間換算
const TIME_UNIT_LABEL: Record<string, string> = { YEN: "円", HOUR: "人・時間", DAY: "人・日", WEEK: "人・週", MONTH: "人・月" };
// 人・時間 = pt ÷ 人件費、人・日 = 人・時間 ÷ 8、人・週 = 人・日 ÷ 5、人・月 = 人・週 ÷ 4
const TIME_UNIT_MULTIPLIER: Record<string, number> = { HOUR: 1, DAY: 1 / 8, WEEK: 1 / (8 * 5), MONTH: 1 / (8 * 5 * 4) };

// 入力値（設定単位）→ pt に変換
function unitToPt(value: number, group: Pick<Group, "pointUnit" | "laborCostPerHour" | "timeUnit">): number {
  if (group.pointUnit !== "円" || group.timeUnit === "YEN" || !group.laborCostPerHour) {
    return Math.round(value);
  }
  // displayValue = (pt / laborCostPerHour) * TIME_UNIT_MULTIPLIER[timeUnit]
  // pt = displayValue / TIME_UNIT_MULTIPLIER[timeUnit] * laborCostPerHour
  const multiplier = TIME_UNIT_MULTIPLIER[group.timeUnit] ?? 1;
  return Math.round((value / multiplier) * group.laborCostPerHour);
}

// pt → 設定単位の値に変換
function ptToUnit(pt: number, group: Pick<Group, "pointUnit" | "laborCostPerHour" | "timeUnit">): number {
  if (group.pointUnit !== "円" || group.timeUnit === "YEN" || !group.laborCostPerHour) {
    return pt;
  }
  const multiplier = TIME_UNIT_MULTIPLIER[group.timeUnit] ?? 1;
  return (pt / group.laborCostPerHour) * multiplier;
}

// 入力フォームに表示するラベル
function inputUnitLabel(group: Pick<Group, "pointUnit" | "laborCostPerHour" | "timeUnit">): string {
  if (group.pointUnit !== "円") return "pt";
  if (group.timeUnit === "YEN" || !group.laborCostPerHour) return "円";
  return TIME_UNIT_LABEL[group.timeUnit] ?? "円";
}

// ポイントを表示用にフォーマット
function formatPoint(points: number, group: Pick<Group, "pointUnit" | "laborCostPerHour" | "timeUnit" | "displayMultiplier">): string {
  const multiplier = group.displayMultiplier ?? 1;
  const displayed = points * multiplier;
  if (group.pointUnit === "円") {
    if (group.timeUnit === "YEN" || !group.laborCostPerHour) {
      return `${displayed.toLocaleString("ja-JP")} 円`;
    }
    const personHours = displayed / group.laborCostPerHour;
    const value = personHours * (TIME_UNIT_MULTIPLIER[group.timeUnit] ?? 1);
    return `${value.toLocaleString("ja-JP")} ${TIME_UNIT_LABEL[group.timeUnit]}`;
  }
  return `${displayed.toLocaleString("ja-JP")} pt`;
}

type Quest = {
  id: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  questType: "GOVERNMENT" | "MEMBER";
  pointReward: number;
  creator: { id: string };
  completer: { id: string } | null;
};

type SubQuest = {
  id: string;
  title: string;
  status: "REQUESTED" | "ASSIGNED" | "CHANGE_PENDING" | "CHANGE_DENIED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  pointReward: number;
  quest: { id: string; title: string; group: { id: string } };
};

const QUEST_STATUS_LABEL: Record<Quest["status"], string> = {
  OPEN: "受付中",
  IN_PROGRESS: "進行中",
  COMPLETED: "完了",
  CANCELLED: "キャンセル",
};

const QUEST_STATUS_COLOR: Record<Quest["status"], string> = {
  OPEN: "bg-green-100 text-green-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-red-100 text-red-500",
};

const SUB_STATUS_LABEL: Record<SubQuest["status"], string> = {
  REQUESTED: "要請中",
  ASSIGNED: "アサイン済み",
  CHANGE_PENDING: "変更承認待ち",
  CHANGE_DENIED: "変更否認",
  IN_PROGRESS: "進行中",
  COMPLETED: "完了",
  CANCELLED: "キャンセル",
};

const SUB_STATUS_COLOR: Record<SubQuest["status"], string> = {
  REQUESTED: "bg-blue-100 text-blue-700",
  ASSIGNED: "bg-purple-100 text-purple-700",
  CHANGE_PENDING: "bg-orange-100 text-orange-700",
  CHANGE_DENIED: "bg-red-100 text-red-600",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-red-100 text-red-500",
};

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "管理者",
  LEADER: "マネージャー",
  MEMBER: "メンバー",
};

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  LEADER: "bg-blue-100 text-blue-700",
  MEMBER: "bg-gray-100 text-gray-600",
};

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const onboarding = useOnboarding();
  const [group, setGroup] = useState<Group | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [subQuests, setSubQuests] = useState<SubQuest[]>([]);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/me").then((r) => r.ok ? r.json() : null),
      fetch("/api/groups").then((r) => r.ok ? r.json() : []),
      fetch(`/api/groups/${id}/quests`).then((r) => r.ok ? r.json() : []),
      fetch("/api/subquests").then((r) => r.ok ? r.json() : []),
    ]).then(([me, groups, questsData, subQuestsData]) => {
      if (me?.id) setMyUserId(me.id);
      if (Array.isArray(groups)) {
        const found = groups.find((g: Group) => g.id === id);
        setGroup(found ?? null);
      }
      if (Array.isArray(questsData)) setQuests(questsData);
      if (Array.isArray(subQuestsData)) setSubQuests(subQuestsData);
    }).catch((e) => console.error("データの取得に失敗しました", e));
  }, [id]);

  if (!group) return (
    <div className="flex items-center justify-center p-20">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">読み込み中...</p>
      </div>
    </div>
  );

  const myMember = group.members.find((m) => m.user.id === myUserId);
  const myRole = myMember?.role ?? "MEMBER";

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/groups/${id}`, { method: "DELETE" });
      if (res.ok) router.push("/groups");
    } finally {
      setDeleting(false);
      setDeleteStep(0);
    }
  }

  // 受注中のクエスト（自分がcompleter）
  const myAcceptedQuests = myMember
    ? quests.filter((q) => q.completer?.id === myMember.id)
    : [];

  // このグループのアサイン済み・要請中サブクエスト
  const myActiveSubQuests = subQuests.filter(
    (sq) => sq.quest.group.id === id &&
      (sq.status === "ASSIGNED" || sq.status === "REQUESTED" || sq.status === "CHANGE_PENDING" || sq.status === "CHANGE_DENIED")
  );

  const totalMyItems = myAcceptedQuests.length + myActiveSubQuests.length;
  const displayedQuests = myAcceptedQuests.slice(0, 3);
  const displayedSubQuests = myActiveSubQuests.slice(0, 3);

  const memberPointsTotal = group.members.reduce((sum, m) => sum + m.memberPoints, 0);
  const allocatedQuestPoints = quests
    .filter((q) => q.questType === "GOVERNMENT" && (q.status === "OPEN" || q.status === "IN_PROGRESS"))
    .reduce((sum, q) => sum + q.pointReward, 0);
  const totalCirculating = memberPointsTotal + allocatedQuestPoints;

  return (
    <div>
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        {/* グループヘッダー */}
        <section className="relative bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 rounded-2xl p-6 shadow-xl overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />
          <div className="relative flex items-center gap-3 flex-wrap">
            <div>
              <h2 className="text-2xl font-bold text-white">{group.name}</h2>
              {myRole !== "MEMBER" && (
                <span className="inline-block mt-1 text-xs px-2.5 py-0.5 rounded-full font-medium bg-white/20 text-white border border-white/20">
                  {ROLE_LABEL[myRole]}
                </span>
              )}
            </div>
            {myRole === "ADMIN" && (
              <button
                onClick={() => setDeleteStep(1)}
                className="ml-auto text-sm px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-200 rounded-lg border border-red-400/30 transition"
              >
                グループを削除
              </button>
            )}
            <Link
              href={`/groups/${id}/analytics`}
              className={`${myRole === "ADMIN" ? "" : "ml-auto"} text-sm px-5 py-2 bg-white/15 hover:bg-white/25 text-white rounded-lg border border-white/20 transition flex items-center gap-2`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              分析
            </Link>
          </div>
        </section>

        {/* 管理側発行済みポイント管理（ADMIN/LEADERのみ） */}
        {group.totalIssuedPoints !== undefined && (
          <IssuedPointsEditor
            groupId={id}
            totalIssuedPoints={group.totalIssuedPoints}
            totalCirculating={totalCirculating}
            isAdmin={myRole === "ADMIN"}
            group={group}
            onUpdated={(v) => setGroup((prev) => prev ? { ...prev, totalIssuedPoints: v } : prev)}
            onSettingsUpdated={(settings) => setGroup((prev) => prev ? { ...prev, ...settings } : prev)}
          />
        )}

        {/* 自分の情報 ＋ クエスト提案 2列 */}
        {myMember && (
        <div className="grid grid-cols-2 gap-4 items-start">
          <section className="bg-white border border-slate-100 rounded-2xl p-6 space-y-4 shadow-sm hover:shadow-md transition">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-gradient-to-b from-indigo-500 to-violet-600 rounded-full inline-block" />
              自分の情報
            </h3>
            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl p-4 border border-indigo-100">
              <p className="text-xs font-medium text-slate-500 mb-1">保有ポイント</p>
              <span className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">{formatPoint(myMember.memberPoints, group)}</span>
            </div>

            <div className="border-t border-gray-100 pt-4">
              {displayedQuests.length === 0 && displayedSubQuests.length === 0 ? (
                <p className="text-sm text-gray-400">進行中の案件・サブクエストはありません</p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {/* 左：受注中クエスト */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-500 mb-2">受注中の案件</p>
                    {displayedQuests.length === 0 ? (
                      <p className="text-xs text-gray-300">なし</p>
                    ) : (
                      displayedQuests.map((q) => (
                        <Link
                          key={q.id}
                          href={`/groups/${id}/quests/${q.id}`}
                          className="block px-3 py-2 rounded-lg hover:bg-gray-50 transition"
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${QUEST_STATUS_COLOR[q.status]}`}>
                              {QUEST_STATUS_LABEL[q.status]}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 truncate">{q.title}</p>
                          <p className="text-xs font-bold text-blue-600 mt-0.5">{formatPoint(q.pointReward, group)}</p>
                        </Link>
                      ))
                    )}
                  </div>

                  {/* 右：サブクエスト */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-500 mb-2">サブクエスト</p>
                    {displayedSubQuests.length === 0 ? (
                      <p className="text-xs text-gray-300">なし</p>
                    ) : (
                      displayedSubQuests.map((sq) => (
                        <Link
                          key={sq.id}
                          href={`/groups/${id}/quests/${sq.quest.id}/subquests/${sq.id}`}
                          className="block px-3 py-2 rounded-lg hover:bg-gray-50 transition"
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${SUB_STATUS_COLOR[sq.status]}`}>
                              {SUB_STATUS_LABEL[sq.status]}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 truncate">{sq.title}</p>
                          <p className="text-xs text-gray-400 truncate">{sq.quest.title}</p>
                          {sq.pointReward > 0 && (
                            <p className="text-xs font-bold text-blue-600 mt-0.5">{formatPoint(sq.pointReward, group)}</p>
                          )}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
              {totalMyItems > 3 && (
                <Link
                  href={`/groups/${id}/quests`}
                  className="block text-xs text-blue-500 hover:text-blue-700 text-right pt-2"
                >
                  すべて見る →
                </Link>
              )}
            </div>
          </section>

          <div className="space-y-3">
            <Link
              href={`/groups/${id}/quest-proposals`}
              className="flex items-center gap-4 bg-white border border-slate-100 rounded-2xl px-5 py-4 hover:shadow-md hover:-translate-y-0.5 transition-all shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-lg shadow shrink-0">
                💡
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm">管理者へのクエスト提案</p>
                <p className="text-xs text-slate-400 mt-0.5">メンバーからの提案一覧・審査承認</p>
              </div>
              <span className="text-slate-300 text-lg">→</span>
            </Link>
            <Link
              href={`/groups/${id}/quests`}
              onClick={() => { if (onboarding?.step === "create-quest") onboarding.onQuestCreated(); }}
              className={`flex items-center gap-4 bg-white border border-slate-100 rounded-2xl px-5 py-4 hover:shadow-md hover:-translate-y-0.5 transition-all shadow-sm${onboarding?.step === "create-quest" ? " onboarding-highlight" : ""}`}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-lg shadow shrink-0">
                ⚔️
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm">クエスト</p>
                <p className="text-xs text-slate-400 mt-0.5">管理側案件・メンバー案件の一覧と発行</p>
              </div>
              <span className="text-slate-300 text-lg">→</span>
            </Link>
          </div>
        </div>
        )}

        {/* グループ設定（全員閲覧可・ADMIN/LEADERは編集可） */}
        {myMember && (
          <GroupSettingsSection
            groupId={id}
            canEdit={myRole === "ADMIN" || myRole === "LEADER"}
            proposalReward={group.proposalReward}
            onProposalRewardUpdated={(v) => setGroup((prev) => prev ? { ...prev, proposalReward: v } : prev)}
          />
        )}

        {/* ポイント付与（ADMINのみ） */}
        {myRole === "ADMIN" && (
          <GrantPointsSection
            groupId={id}
            members={group.members}
            group={group}
            onGranted={(memberId, amount) => {
              setGroup((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  members: prev.members.map((m) =>
                    memberId === null || m.id === memberId
                      ? { ...m, memberPoints: m.memberPoints + amount }
                      : m
                  ),
                };
              });
            }}
          />
        )}

        {/* メンバー管理ページへのリンク */}
        <Link
          href={`/groups/${id}/members`}
          className="flex items-center gap-4 bg-white border border-slate-100 rounded-2xl px-6 py-5 hover:shadow-md hover:-translate-y-0.5 transition-all shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-lg shadow shrink-0">
            👥
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800">メンバー</p>
            <p className="text-xs text-slate-400 mt-0.5">メンバー一覧・招待・管理</p>
          </div>
          <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
            {group.members.length}
          </span>
          <span className="text-slate-300 text-lg">→</span>
        </Link>
      </main>

      {/* 削除確認ダイアログ（1回目） */}
      {deleteStep === 1 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-800">グループを削除しますか？</h3>
            <p className="text-sm text-gray-600">
              「<strong>{group.name}</strong>」を削除します。クエスト・メンバー・ポイント履歴など関連するすべてのデータが削除されます。
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteStep(0)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition">キャンセル</button>
              <button onClick={() => setDeleteStep(2)} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition">次へ</button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認ダイアログ（2回目） */}
      {deleteStep === 2 && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-red-600">本当に削除しますか？</h3>
            <p className="text-sm text-gray-600">
              この操作は<strong>取り消せません</strong>。「<strong>{group.name}</strong>」と関連するすべてのデータが完全に削除されます。
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteStep(0)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition">キャンセル</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
              >
                {deleting ? "削除中..." : "完全に削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IssuedPointsEditor({
  groupId,
  totalIssuedPoints,
  totalCirculating,
  isAdmin,
  group,
  onUpdated,
  onSettingsUpdated,
}: {
  groupId: string;
  totalIssuedPoints: number;
  totalCirculating: number;
  isAdmin: boolean;
  group: Pick<Group, "pointUnit" | "laborCostPerHour" | "timeUnit" | "displayMultiplier">;
  onUpdated: (v: number) => void;
  onSettingsUpdated: (s: Partial<Pick<Group, "pointUnit" | "laborCostPerHour" | "timeUnit" | "displayMultiplier">>) => void;
}) {
  const reclaimable = totalIssuedPoints - totalCirculating;
  const onboarding = useOnboarding();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pointUnit, setPointUnit] = useState(group.pointUnit);
  const [laborCost, setLaborCost] = useState(group.laborCostPerHour);
  const [timeUnit, setTimeUnit] = useState(group.timeUnit);
  const [displayMultiplier, setDisplayMultiplier] = useState(group.displayMultiplier ?? 1);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  async function sendDelta(delta: number, amount: number, setError: (e: string) => void, setSaving: (b: boolean) => void, setAmount: (v: number) => void) {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "エラーが発生しました");
        return;
      }
      onUpdated(data.totalIssuedPoints);
      setAmount(0);
      if (onboarding?.step === "issue-points" && delta > 0) {
        onboarding.onPointsIssued();
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsError("");
    setSettingsSaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointUnit, laborCostPerHour: laborCost, timeUnit, displayMultiplier }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) { setSettingsError(data.error ?? `エラー (${res.status})`); return; }
      onSettingsUpdated({ pointUnit: data.pointUnit, laborCostPerHour: data.laborCostPerHour, timeUnit: data.timeUnit, displayMultiplier: data.displayMultiplier });
      setSettingsOpen(false);
    } finally {
      setSettingsSaving(false);
    }
  }

  return (
    <section className="bg-white border border-slate-100 rounded-2xl p-6 space-y-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-700 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-gradient-to-b from-indigo-500 to-violet-600 rounded-full inline-block" />
          管理側発行済みポイント
        </h3>
        {isAdmin && (
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition"
          >
            表示設定
            <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${settingsOpen ? "bg-indigo-500" : "bg-slate-200"}`}>
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${settingsOpen ? "translate-x-4" : "translate-x-0.5"}`} />
            </span>
          </button>
        )}
      </div>

      {/* 表示設定パネル */}
      {settingsOpen && (
        <form onSubmit={saveSettings} className="bg-gradient-to-br from-slate-50 to-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-slate-600">表示・人件費設定</p>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <p className="text-xs text-gray-500 mb-1">表示単位</p>
              <div className="flex gap-2">
                {(["pt", "円"] as const).map((u) => (
                  <label key={u} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="radio" checked={pointUnit === u} onChange={() => setPointUnit(u)} />
                    {u}
                  </label>
                ))}
              </div>
            </div>
            {pointUnit === "円" && (
              <div>
                <p className="text-xs text-gray-500 mb-1">表示形式</p>
                <select
                  value={timeUnit}
                  onChange={(e) => setTimeUnit(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {Object.entries(TIME_UNIT_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            )}
            {pointUnit === "円" && timeUnit !== "YEN" && (
              <div>
                <p className="text-xs text-gray-500 mb-1">人件費（円/時間）</p>
                <input
                  type="number"
                  min={0}
                  value={laborCost || ""}
                  onChange={(e) => setLaborCost(Number(e.target.value))}
                  placeholder="例: 1200"
                  className="w-32 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 mb-1">表示倍率</p>
              <input
                type="number"
                min={0.01}
                step="any"
                value={displayMultiplier}
                onChange={(e) => setDisplayMultiplier(Number(e.target.value))}
                className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={settingsSaving}
                className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs rounded-lg hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 transition shadow"
              >
                {settingsSaving ? "保存中..." : "保存"}
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                キャンセル
              </button>
            </div>
          </div>
          {pointUnit === "円" && (
            <p className="text-xs text-gray-400">
              例: 1200 pt → {formatPoint(1200, { pointUnit: "円", laborCostPerHour: laborCost, timeUnit, displayMultiplier })}
            </p>
          )}
          {settingsError && <p className="text-xs text-red-600">{settingsError}</p>}
        </form>
      )}

      {/* 現在の状態 */}
      <div className="flex flex-col sm:flex-row gap-6 items-center bg-gradient-to-br from-slate-50 to-indigo-50 rounded-xl p-4 border border-indigo-50">
        {/* 円グラフ */}
        <div className="w-48 h-48 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: "流通中", value: totalCirculating },
                  { name: "未流通", value: Math.max(reclaimable, 0) },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
              >
                <Cell fill="#3b82f6" />
                <Cell fill="#22c55e" />
              </Pie>
              <Tooltip formatter={(value) => [`${value} pt`]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 数値サマリー */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="bg-white rounded-xl px-4 py-3 border border-slate-100 shadow-sm min-w-[100px]">
            <p className="text-slate-400 text-xs mb-1">発行済み</p>
            <p className="text-xl font-bold text-slate-700">{formatPoint(totalIssuedPoints, group)}</p>
          </div>
          <div className="bg-white rounded-xl px-4 py-3 border border-indigo-100 shadow-sm min-w-[100px]">
            <p className="text-indigo-400 text-xs mb-1">流通中</p>
            <p className="text-xl font-bold text-indigo-600">{formatPoint(totalCirculating, group)}</p>
          </div>
          <div className="bg-white rounded-xl px-4 py-3 border border-emerald-100 shadow-sm min-w-[100px]">
            <p className="text-emerald-400 text-xs mb-1">未流通（回収可能）</p>
            <p className="text-xl font-bold text-emerald-600">{formatPoint(Math.max(reclaimable, 0), group)}</p>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <DeltaForm
            label="追加発行"
            buttonLabel="発行する"
            buttonClass="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-200"
            sign={1}
            onSubmit={sendDelta}
            group={group}
          />
          <DeltaForm
            label={`回収（最大 ${formatPoint(Math.max(reclaimable, 0), group)}）`}
            buttonLabel="回収する"
            buttonClass="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 shadow-red-200"
            maxPt={reclaimable}
            sign={-1}
            onSubmit={sendDelta}
            group={group}
          />
        </div>
      )}
    </section>
  );
}

function GrantPointsSection({
  groupId,
  members,
  onGranted,
  group,
}: {
  groupId: string;
  members: Member[];
  onGranted: (memberId: string | null, amount: number) => void;
  group: Pick<Group, "pointUnit" | "laborCostPerHour" | "timeUnit" | "displayMultiplier">;
}) {
  const [mode, setMode] = useState<"individual" | "multiple" | "all">("individual");
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id ?? "");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [amount, setAmount] = useState(0);
  const [selectedInputUnit, setSelectedInputUnit] = useState(group.timeUnit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function toggleMemberId(id: string) {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // 入力単位の切り替えが可能か（円表示 & 人件費設定済みの場合）
  const canSelectUnit = group.pointUnit === "円" && group.laborCostPerHour > 0;
  // 現在選択中の単位でのグループ設定（変換に使用）
  const inputGroup = { ...group, timeUnit: canSelectUnit ? selectedInputUnit : group.timeUnit };
  const unitLabel = inputUnitLabel(inputGroup);
  const isDecimalUnit = inputGroup.pointUnit === "円" && inputGroup.timeUnit !== "YEN" && inputGroup.laborCostPerHour > 0;
  const step = isDecimalUnit ? 0.01 : 1;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (amount <= 0) return;
    const ptAmount = unitToPt(amount, inputGroup);
    setSubmitting(true);
    try {
      const body: { amount: number; memberId?: string; memberIds?: string[] } = { amount: ptAmount };
      if (mode === "individual") body.memberId = selectedMemberId;
      if (mode === "multiple") body.memberIds = selectedMemberIds;
      const res = await fetch(`/api/groups/${groupId}/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "エラーが発生しました");
        return;
      }
      if (mode === "individual") {
        onGranted(selectedMemberId, ptAmount);
        setSuccess(`${amount} ${unitLabel} を付与しました`);
      } else if (mode === "multiple") {
        onGranted(null, ptAmount);
        setSuccess(`${data.memberCount}人に ${amount} ${unitLabel} を付与しました（合計 ${data.totalGranted} pt）`);
        setSelectedMemberIds([]);
      } else {
        onGranted(null, ptAmount);
        setSuccess(`全員に ${amount} ${unitLabel} を付与しました（合計 ${data.totalGranted} pt）`);
      }
      setAmount(0);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bg-white border border-slate-100 rounded-2xl p-6 space-y-4 shadow-sm">
      <h3 className="font-bold text-slate-700 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-full inline-block" />
        ポイント付与
      </h3>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="radio" checked={mode === "individual"} onChange={() => setMode("individual")} />
          個人に付与
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="radio" checked={mode === "multiple"} onChange={() => { setMode("multiple"); setSelectedMemberIds([]); }} />
          複数人に付与
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="radio" checked={mode === "all"} onChange={() => setMode("all")} />
          全員に付与
        </label>
      </div>

      {mode === "multiple" && (
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-1.5 cursor-pointer text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:border-blue-400 transition">
              <input
                type="checkbox"
                checked={selectedMemberIds.includes(m.id)}
                onChange={() => toggleMemberId(m.id)}
                className="rounded"
              />
              {m.user.name ?? m.user.email}
            </label>
          ))}
          {selectedMemberIds.length > 0 && (
            <span className="text-xs text-gray-400 self-center">{selectedMemberIds.length}人選択中</span>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
        {mode === "individual" && (
          <div>
            <p className="text-xs text-gray-500 mb-1">対象メンバー</p>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.user.name ?? m.user.email}（{formatPoint(m.memberPoints, group)}）
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-500 mb-1">付与量</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={step}
              step={step}
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder={unitLabel}
              className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
            {canSelectUnit ? (
              <select
                value={selectedInputUnit}
                onChange={(e) => { setSelectedInputUnit(e.target.value); setAmount(0); }}
                className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {Object.entries(TIME_UNIT_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-gray-500">{unitLabel}</span>
            )}
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-sm rounded-lg disabled:opacity-50 transition shadow shadow-emerald-200"
        >
          {submitting ? "付与中..." : "付与する"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
    </section>
  );
}

function DeltaForm({
  label,
  buttonLabel,
  buttonClass,
  maxPt,
  sign,
  onSubmit,
  group,
}: {
  label: string;
  buttonLabel: string;
  buttonClass: string;
  maxPt?: number;
  sign: 1 | -1;
  onSubmit: (delta: number, amount: number, setError: (e: string) => void, setSaving: (b: boolean) => void, setAmount: (v: number) => void) => void;
  group: Pick<Group, "pointUnit" | "laborCostPerHour" | "timeUnit" | "displayMultiplier">;
}) {
  const onboarding = useOnboarding();
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const unitLabel = inputUnitLabel(group);
  const isDecimalUnit = group.pointUnit === "円" && group.timeUnit !== "YEN" && group.laborCostPerHour > 0;
  const step = isDecimalUnit ? 0.01 : 1;
  const displayMax = maxPt !== undefined ? ptToUnit(maxPt, group) : undefined;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (amount <= 0) return;
    const ptAmount = unitToPt(amount, group);
    onSubmit(sign * ptAmount, ptAmount, setError, setSaving, setAmount);
  }

  return (
    <div>
      <p className="text-sm font-semibold text-slate-600 mb-2">{label}</p>
      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <input
          type="number"
          min={step}
          max={displayMax}
          step={step}
          value={amount || ""}
          onChange={(e) => setAmount(Number(e.target.value))}
          placeholder={unitLabel}
          className="w-28 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          required
        />
        <span className="text-sm text-slate-400">{unitLabel}</span>
        <button
          type="submit"
          disabled={saving || (maxPt !== undefined && maxPt <= 0)}
          className={`px-4 py-2 text-white text-sm rounded-lg disabled:opacity-50 transition shadow ${buttonClass}${onboarding?.step === "issue-points" && sign === 1 ? " onboarding-highlight" : ""}`}
        >
          {saving ? "..." : buttonLabel}
        </button>
      </form>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─── グループ設定セクション ───────────────────────────────────────────
// 全メンバーが閲覧可能。canEdit=true のとき（ADMIN/LEADER）は編集も可能。
// 今後グループ単位の設定が増えた場合はこのセクション内に追加する。

function GroupSettingsSection({
  groupId,
  canEdit,
  proposalReward,
  onProposalRewardUpdated,
}: {
  groupId: string;
  canEdit: boolean;
  proposalReward: number;
  onProposalRewardUpdated: (v: number) => void;
}) {
  const onboarding = useOnboarding();
  const router = useRouter();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (onboarding?.step === "bonus") {
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [onboarding?.step]);

  return (
    <section ref={sectionRef} className="bg-white border border-slate-100 rounded-2xl p-6 space-y-5 shadow-sm">
      <h3 className="font-bold text-slate-700 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-gradient-to-b from-amber-400 to-orange-500 rounded-full inline-block" />
        グループ設定
      </h3>

      {/* 提案報酬 */}
      <SettingRow
        label="クエスト提案報酬"
        description="提案が承認されたときに提案者へ付与する一律ポイント"
        canEdit={canEdit}
        displayValue={`${proposalReward} pt`}
        onboardingHighlight={onboarding?.step === "bonus"}
        editForm={(onClose) => (
          <ProposalRewardForm
            groupId={groupId}
            current={proposalReward}
            onSaved={(v) => {
              onProposalRewardUpdated(v);
              onClose();
              if (onboarding?.step === "bonus") {
                onboarding.advance();
                router.push(`/groups/${groupId}/analytics`);
              }
            }}
            onCancel={onClose}
          />
        )}
      />

      {/* 今後の設定はここに <SettingRow ... /> を追加する */}
    </section>
  );
}

function SettingRow({
  label,
  description,
  canEdit,
  displayValue,
  editForm,
  onboardingHighlight,
}: {
  label: string;
  description: string;
  canEdit: boolean;
  displayValue: string;
  editForm: (onClose: () => void) => React.ReactNode;
  onboardingHighlight?: boolean;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">{label}</p>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-blue-600">{displayValue}</span>
          {canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              className={`text-xs text-indigo-500 hover:text-indigo-700 transition border border-indigo-200 rounded-lg px-2.5 py-0.5 hover:bg-indigo-50${onboardingHighlight ? " onboarding-highlight" : ""}`}
            >
              変更
            </button>
          )}
        </div>
      </div>
      {editing && editForm(() => setEditing(false))}
    </div>
  );
}

function ProposalRewardForm({
  groupId,
  current,
  onSaved,
  onCancel,
}: {
  groupId: string;
  current: number;
  onSaved: (v: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalReward: value }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "エラーが発生しました"); return; }
      onSaved(data.proposalReward);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-24 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        required
      />
      <span className="text-sm text-slate-400">pt</span>
      <button
        type="submit"
        disabled={saving}
        className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs rounded-lg hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 transition"
      >
        {saving ? "保存中..." : "保存"}
      </button>
      <button type="button" onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-600 transition">
        キャンセル
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}

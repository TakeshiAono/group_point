"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type QuestUser = { id: string; name: string | null; email: string };
type QuestMember = { id: string; user: QuestUser };

type SubQuest = {
  id: string;
  title: string;
  status: "REQUESTED" | "ASSIGNED" | "CHANGE_PENDING" | "CHANGE_DENIED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  deadline: string | null;
  pointReward: number;
  assignee: QuestMember | null;
};

type Quest = {
  id: string;
  title: string;
  description: string | null;
  pointReward: number;
  questType: "GOVERNMENT" | "MEMBER";
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  creator: QuestMember;
  completer: QuestMember | null;
  deadline: string | null;
  subQuests: SubQuest[];
  createdAt: string;
};

type GroupMember = { id: string; user: QuestUser };

const STATUS_LABEL: Record<Quest["status"], string> = {
  OPEN: "受付中",
  IN_PROGRESS: "進行中",
  COMPLETED: "完了",
  CANCELLED: "キャンセル",
};

const STATUS_COLOR: Record<Quest["status"], string> = {
  OPEN: "bg-green-100 text-green-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-red-100 text-red-500",
};

const SUB_STATUS_LABEL: Record<SubQuest["status"], string> = {
  REQUESTED: "依頼中",
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

export default function QuestDetailPage() {
  const { id: groupId, questId } = useParams<{ id: string; questId: string }>();
  const [quest, setQuest] = useState<Quest | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [myMember, setMyMember] = useState<GroupMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");
  const [appliedBonus, setAppliedBonus] = useState<{ thresholdPercent: number; bonusRate: number } | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/groups/${groupId}/quests/${questId}`).then((r) => r.ok ? r.json() : Promise.reject()),
      fetch("/api/me").then((r) => r.ok ? r.json() : null),
      fetch("/api/groups").then((r) => r.ok ? r.json() : []),
    ])
      .then(([questData, me, groups]) => {
        setQuest(questData);
        if (me?.id && Array.isArray(groups)) {
          const group = groups.find((g: { id: string; members: GroupMember[] }) => g.id === groupId);
          setMembers(group?.members ?? []);
          const m = group?.members.find((m: GroupMember) => m.user.id === me.id);
          if (m) setMyMember(m);
        }
      })
      .catch(() => setError("クエストの取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [groupId, questId]);

  if (loading) return <div className="p-10 text-gray-500">読み込み中...</div>;
  if (error || !quest) return <div className="p-10 text-red-500">{error || "クエストが見つかりません"}</div>;

  const canManageSubQuest =
    myMember && (quest.creator.id === myMember.id || quest.completer?.id === myMember.id);

  const canEdit =
    myMember && quest.creator.id === myMember.id &&
    quest.status !== "COMPLETED" && quest.status !== "CANCELLED";

  const canAccept =
    myMember && quest.status === "OPEN" && quest.creator.id !== myMember.id;

  const canComplete =
    myMember && quest.completer?.id === myMember.id && quest.status === "IN_PROGRESS";

  const isOverdue = quest.deadline && quest.status !== "COMPLETED" && quest.status !== "CANCELLED"
    && new Date(quest.deadline) < new Date();

  async function handleAccept() {
    setAccepting(true);
    setAcceptError("");
    try {
      const res = await fetch(`/api/groups/${groupId}/quests/${questId}/accept`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setAcceptError(data.error ?? "受注に失敗しました");
        return;
      }
      setQuest(data);
    } finally {
      setAccepting(false);
    }
  }

  async function handleComplete() {
    if (!confirm("このクエストを完了しますか？アサイン済みのサブクエスト担当者にポイントが支払われます。")) return;
    setCompleting(true);
    setCompleteError("");
    try {
      const res = await fetch(`/api/groups/${groupId}/quests/${questId}/complete`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setCompleteError(data.error ?? "完了処理に失敗しました");
        return;
      }
      setQuest(data);
      if (data.appliedBonus) setAppliedBonus(data.appliedBonus);
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <Link href={`/groups/${groupId}/quests`} className="text-sm text-gray-400 hover:text-gray-600 transition">
        ← 案件一覧に戻る
      </Link>

      <div className="flex gap-6 mt-6 items-start">
        {/* 左: メインコンテンツ */}
        <div className="flex-1 min-w-0 space-y-6">

      {/* クエスト詳細 */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[quest.status]}`}>
            {STATUS_LABEL[quest.status]}
          </span>
          <span className="text-xs text-gray-400">
            {quest.questType === "GOVERNMENT" ? "政府案件" : "メンバー案件"}
          </span>
        </div>

        <div>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold text-gray-800">{quest.title}</h2>
            {canEdit && (
              <button
                onClick={() => setEditing((v) => !v)}
                className="shrink-0 text-xs text-gray-400 hover:text-blue-600 transition border border-gray-200 rounded px-2 py-0.5"
              >
                {editing ? "キャンセル" : "編集"}
              </button>
            )}
          </div>
          {quest.description && !editing && (
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">{quest.description}</p>
          )}
        </div>

        {editing && (
          <EditQuestForm
            groupId={groupId}
            quest={quest}
            onSaved={(updated) => { setQuest(updated); setEditing(false); }}
            onCancel={() => setEditing(false)}
          />
        )}

        <div className="flex items-center gap-2 py-3 border-t border-gray-100">
          <span className="text-sm text-gray-500">報酬</span>
          <span className="text-2xl font-bold text-blue-600">{quest.pointReward} pt</span>
        </div>

        <dl className="space-y-3 border-t border-gray-100 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-400">発行者</dt>
            <dd className="text-gray-700 font-medium">
              {quest.creator.user.name ?? quest.creator.user.email}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-400">受注者</dt>
            <dd className="text-gray-700 font-medium">
              {quest.completer ? quest.completer.user.name ?? quest.completer.user.email : "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-400">デッドライン</dt>
            <dd className={`font-medium ${isOverdue ? "text-red-600" : "text-gray-700"}`}>
              {quest.deadline
                ? `${new Date(quest.deadline).toLocaleDateString("ja-JP")}${isOverdue ? "（期限超過）" : ""}`
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-400">発行日</dt>
            <dd className="text-gray-700">
              {new Date(quest.createdAt).toLocaleDateString("ja-JP")}
            </dd>
          </div>
        </dl>

        {/* 受注ボタン */}
        {canAccept && (
          <div className="border-t border-gray-100 pt-4">
            {acceptError && <p className="text-xs text-red-600 mb-2">{acceptError}</p>}
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {accepting ? "受注中..." : "このクエストを受注する"}
            </button>
          </div>
        )}

        {/* 完了ボタン */}
        {canComplete && (
          <div className="border-t border-gray-100 pt-4">
            {completeError && <p className="text-xs text-red-600 mb-2">{completeError}</p>}
            <button
              onClick={handleComplete}
              disabled={completing}
              className="w-full py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
            >
              {completing ? "完了処理中..." : "クエストを完了する"}
            </button>
            <p className="text-xs text-gray-400 mt-1.5 text-center">
              アサイン済みのサブクエスト担当者にポイントが支払われます
            </p>
          </div>
        )}

        {/* ボーナス/ペナルティ適用通知 */}
        {appliedBonus && quest.deadline && (
          <div className={`border-t border-gray-100 pt-4 rounded-lg px-4 py-3 text-sm ${appliedBonus.bonusRate > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {(() => {
              const date = calcThresholdDate(quest.createdAt, quest.deadline, appliedBonus.thresholdPercent).toLocaleDateString("ja-JP");
              return appliedBonus.bonusRate > 0
                ? `🎉 期限（${date}）以内に完了！ボーナス +${appliedBonus.bonusRate}% が適用されました`
                : `⚠️ 期限（${date}）以降の完了。ペナルティ ${appliedBonus.bonusRate}% が適用されました`;
            })()}
          </div>
        )}
      </div>

      {/* ボーナス・ペナルティルール（全員閲覧可・発行者のみ編集） */}
      {quest.deadline && myMember && (
        <BonusRulesSection
          groupId={groupId}
          questId={questId}
          canEdit={quest.creator.id === myMember.id}
          questCreatedAt={quest.createdAt}
          questDeadline={quest.deadline}
        />
      )}

      {/* サブクエスト */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">サブクエスト</h3>
          {quest.subQuests.length > 0 && (
            <span className="text-xs text-gray-500">
              報酬合計:{" "}
              <span className="font-bold text-blue-600">
                {quest.subQuests.reduce((s, sq) => s + sq.pointReward, 0)} pt
              </span>
              {" / "}
              {quest.pointReward} pt
            </span>
          )}
        </div>

        {quest.subQuests.length === 0 ? (
          <p className="text-sm text-gray-400">サブクエストはありません</p>
        ) : (
          <ul className="space-y-2">
            {quest.subQuests.map((sq) => {
              const sqOverdue = sq.deadline &&
                sq.status !== "COMPLETED" && sq.status !== "CANCELLED" &&
                new Date(sq.deadline) < new Date();
              return (
                <li key={sq.id} className="border border-gray-100 rounded-lg hover:border-gray-200 transition">
                  <Link
                    href={`/groups/${groupId}/quests/${questId}/subquests/${sq.id}`}
                    className="flex items-center justify-between px-4 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{sq.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        担当: {sq.assignee ? sq.assignee.user.name ?? sq.assignee.user.email : "未割当"}
                        {sq.deadline && (
                          <span className={`ml-2 ${sqOverdue ? "text-red-500" : ""}`}>
                            期限: {new Date(sq.deadline).toLocaleDateString("ja-JP")}
                            {sqOverdue && "（超過）"}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {sq.pointReward > 0 && (
                        <span className="text-sm font-bold text-blue-600">{sq.pointReward} pt</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SUB_STATUS_COLOR[sq.status]}`}>
                        {SUB_STATUS_LABEL[sq.status]}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {canManageSubQuest && (
          <AddSubQuestForm
            groupId={groupId}
            questId={questId}
            members={members}
            questPointReward={quest.pointReward}
            usedPointReward={quest.subQuests.reduce((s, sq) => s + sq.pointReward, 0)}
            onAdded={(sq) => setQuest((prev) => prev ? { ...prev, subQuests: [...prev.subQuests, sq] } : prev)}
          />
        )}
      </div>

        </div>{/* 左カラム終了 */}

        {/* 右: アクティビティログ */}
        <div className="w-80 shrink-0 sticky top-6">
          <QuestLogSection groupId={groupId} questId={questId} />
        </div>
      </div>{/* flex終了 */}
    </div>
  );
}

type BonusRule = { id: string; thresholdPercent: number; bonusRate: number };

function calcThresholdDate(createdAt: string, deadline: string, thresholdPercent: number): Date {
  const start = new Date(createdAt).getTime();
  const end = new Date(deadline).getTime();
  const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  const days = Math.ceil(totalDays * thresholdPercent / 100);
  return new Date(start + days * 24 * 60 * 60 * 1000);
}

function BonusRulesSection({
  groupId, questId, canEdit, questCreatedAt, questDeadline,
}: {
  groupId: string; questId: string; canEdit: boolean; questCreatedAt: string; questDeadline: string;
}) {
  const [rules, setRules] = useState<BonusRule[]>([]);
  const [threshold, setThreshold] = useState<number | "">("");
  const [rate, setRate] = useState<number | "">("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/groups/${groupId}/quests/${questId}/bonus-rules`)
      .then((r) => r.ok ? r.json() : [])
      .then(setRules);
  }, [groupId, questId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (threshold === "" || rate === "") return;
    setError("");
    setAdding(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/quests/${questId}/bonus-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thresholdPercent: Number(threshold), bonusRate: Number(rate) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "エラーが発生しました"); return; }
      setRules((prev) => [...prev, data].sort((a, b) => a.thresholdPercent - b.thresholdPercent));
      setThreshold("");
      setRate("");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(ruleId: string) {
    const res = await fetch(`/api/groups/${groupId}/quests/${questId}/bonus-rules/${ruleId}`, { method: "DELETE" });
    if (res.ok) setRules((prev) => prev.filter((r) => r.id !== ruleId));
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <div>
        <h3 className="font-semibold text-gray-800">ボーナス・ペナルティルール</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          作成日〜納期の期間を100%として、達成タイミングに応じたボーナス/ペナルティを設定します。
        </p>
      </div>

      {rules.length === 0 ? (
        <p className="text-sm text-gray-400">ルールが登録されていません</p>
      ) : (
        <ul className="space-y-2">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2 text-sm">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-3">
                  <span className="text-gray-600">
                    {r.bonusRate > 0 ? "以内に完了" : "以降に完了"}
                  </span>
                  <span className={`font-bold ${r.bonusRate > 0 ? "text-green-600" : "text-red-500"}`}>
                    {r.bonusRate > 0 ? `+${r.bonusRate}%` : `${r.bonusRate}%`}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {r.thresholdPercent}%（
                  {calcThresholdDate(questCreatedAt, questDeadline, r.thresholdPercent).toLocaleDateString("ja-JP")}
                  ）
                </span>
              </div>
              {canEdit && (
                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-xs text-red-400 hover:text-red-600 transition"
                >
                  削除
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && <form onSubmit={handleAdd} className="border-t border-gray-100 pt-4 space-y-3">
        <p className="text-xs font-medium text-gray-600">ルールを追加</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-xs text-gray-500 mb-1">
              しきい値（%）<span className="ml-1 text-gray-400">80=早期、110=10%遅延</span>
            </p>
            <input
              type="number"
              min={1}
              step={1}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="例: 80"
              className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">
              ボーナス率（%）<span className="ml-1 text-gray-400">正=ボーナス、負=ペナルティ</span>
            </p>
            <input
              type="number"
              step={0.1}
              value={rate}
              onChange={(e) => setRate(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="例: 10 or -10"
              className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {adding ? "追加中..." : "追加"}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>}
    </div>
  );
}

function AddSubQuestForm({
  groupId,
  questId,
  members,
  questPointReward,
  usedPointReward,
  onAdded,
}: {
  groupId: string;
  questId: string;
  members: GroupMember[];
  questPointReward: number;
  usedPointReward: number;
  onAdded: (sq: SubQuest) => void;
}) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [rewardMode, setRewardMode] = useState<"pt" | "percent">("pt");
  const [pointReward, setPointReward] = useState(0);
  const [percent, setPercent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const remaining = questPointReward - usedPointReward;
  const maxPercent = questPointReward > 0 ? Math.floor((remaining / questPointReward) * 100) : 0;
  const ptFromPercent = Math.round((questPointReward * percent) / 100);
  const resolvedPt = rewardMode === "percent" ? ptFromPercent : pointReward;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (resolvedPt > remaining) {
      setError(`報酬が残り上限（${remaining} pt）を超えています`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/quests/${questId}/subquests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          assigneeId: assigneeId || undefined,
          deadline: deadline || undefined,
          pointReward: resolvedPt,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "エラーが発生しました");
        return;
      }
      onAdded(data);
      setTitle("");
      setAssigneeId("");
      setDeadline("");
      setPointReward(0);
      setPercent(0);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-100 pt-4 space-y-3">
      <p className="text-sm font-medium text-gray-700">サブクエストを追加</p>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="タイトル"
        required
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <select
        value={assigneeId}
        onChange={(e) => setAssigneeId(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <option value="">担当者を選択（任意）</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.user.name ?? m.user.email}
          </option>
        ))}
      </select>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-500">
            報酬（残り {remaining} pt）
          </label>
          <div className="flex gap-2">
            {(["pt", "percent"] as const).map((m) => (
              <label key={m} className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                <input
                  type="radio"
                  checked={rewardMode === m}
                  onChange={() => { setRewardMode(m); setPointReward(0); setPercent(0); }}
                />
                {m === "pt" ? "pt" : "%"}
              </label>
            ))}
          </div>
        </div>
        {rewardMode === "pt" ? (
          <input
            type="number"
            min={0}
            max={remaining}
            value={pointReward}
            onChange={(e) => setPointReward(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={maxPercent}
              value={percent}
              onChange={(e) => setPercent(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <span className="text-sm text-gray-500 shrink-0">%</span>
            <span className="text-xs text-gray-400 shrink-0">= {ptFromPercent} pt</span>
          </div>
        )}
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">デッドライン（任意）</label>
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {submitting ? "追加中..." : "追加する"}
      </button>
    </form>
  );
}

type QuestLogEntry = {
  id: string;
  action: string;
  detail: string;
  createdAt: string;
  memberName: string | null;
  memberEmail: string | null;
};

function QuestLogSection({ groupId, questId }: { groupId: string; questId: string }) {
  const [logs, setLogs] = useState<QuestLogEntry[]>([]);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/quests/${questId}/logs`)
      .then((r) => r.ok ? r.json() : [])
      .then(setLogs);
  }, [groupId, questId]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col" style={{ height: "60vh" }}>
      <h3 className="font-semibold text-gray-800 mb-3 shrink-0">アクティビティログ</h3>
      {logs.length === 0 ? (
        <p className="text-sm text-gray-400">まだ記録がありません</p>
      ) : (
        <ul className="space-y-3 overflow-y-auto flex-1 pr-1">
          {logs.map((log) => (
            <li key={log.id} className="flex items-start gap-2 text-sm">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5" />
              <div className="flex-1 min-w-0">
                <p className="text-gray-700 break-words">{log.detail}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {log.memberName ?? log.memberEmail ?? "システム"}
                  　{new Date(log.createdAt).toLocaleString("ja-JP")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditQuestForm({
  groupId,
  quest,
  onSaved,
  onCancel,
}: {
  groupId: string;
  quest: Quest;
  onSaved: (updated: Quest) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(quest.title);
  const [description, setDescription] = useState(quest.description ?? "");
  const [pointReward, setPointReward] = useState(quest.pointReward);
  const [deadline, setDeadline] = useState(
    quest.deadline ? new Date(quest.deadline).toISOString().slice(0, 10) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/groups/${groupId}/quests/${quest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          pointReward,
          deadline: deadline || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "保存に失敗しました");
        return;
      }
      onSaved(data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-gray-100 pt-4">
      <div>
        <label className="block text-xs text-gray-500 mb-1">タイトル</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">説明</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">報酬（pt）</label>
        <input
          type="number"
          value={pointReward}
          onChange={(e) => setPointReward(Number(e.target.value))}
          min={1}
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">期限</label>
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {saving ? "保存中..." : "保存"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}

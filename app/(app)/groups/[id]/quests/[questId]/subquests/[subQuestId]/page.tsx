"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type QuestUser = { id: string; name: string | null; email: string };
type QuestMember = { id: string; user: QuestUser };

type SubQuest = {
  id: string;
  title: string;
  status: "REQUESTED" | "ASSIGNED" | "CHANGE_PENDING" | "CHANGE_DENIED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  deadline: string | null;
  pointReward: number;
  pendingPointReward: number | null;
  assignee: QuestMember | null;
  createdAt: string;
  quest: {
    id: string;
    title: string;
    pointReward: number;
    creatorId: string;
    completerId: string | null;
    creator: QuestMember;
    completer: QuestMember | null;
  };
};

const STATUS_LABEL: Record<SubQuest["status"], string> = {
  REQUESTED: "依頼中",
  ASSIGNED: "アサイン済み",
  CHANGE_PENDING: "変更承認待ち",
  CHANGE_DENIED: "変更否認",
  IN_PROGRESS: "進行中",
  COMPLETED: "完了",
  CANCELLED: "キャンセル",
};

const STATUS_COLOR: Record<SubQuest["status"], string> = {
  REQUESTED: "bg-blue-100 text-blue-700",
  ASSIGNED: "bg-purple-100 text-purple-700",
  CHANGE_PENDING: "bg-orange-100 text-orange-700",
  CHANGE_DENIED: "bg-red-100 text-red-600",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-red-100 text-red-500",
};

export default function SubQuestDetailPage() {
  const { id: groupId, questId, subQuestId } = useParams<{
    id: string; questId: string; subQuestId: string;
  }>();
  const router = useRouter();
  const [subQuest, setSubQuest] = useState<SubQuest | null>(null);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  // 報酬変更提案フォーム
  const [proposing, setProposing] = useState(false);
  const [proposedReward, setProposedReward] = useState(0);
  const [proposeError, setProposeError] = useState("");
  const [proposing2, setProposing2] = useState(false);

  // 承認・否認
  const [approving, setApproving] = useState(false);
  const [denying, setDenying] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/groups/${groupId}/quests/${questId}/subquests/${subQuestId}`)
        .then((r) => r.ok ? r.json() : Promise.reject()),
      fetch("/api/me").then((r) => r.ok ? r.json() : null),
      fetch("/api/groups").then((r) => r.ok ? r.json() : []),
    ])
      .then(([sq, me, groups]) => {
        setSubQuest(sq);
        setProposedReward(sq.pointReward);
        if (me?.id && Array.isArray(groups)) {
          const group = groups.find((g: { id: string; members: { id: string; user: { id: string } }[] }) => g.id === groupId);
          const m = group?.members.find((m: { id: string; user: { id: string } }) => m.user.id === me.id);
          if (m) setMyMemberId(m.id);
        }
      })
      .catch(() => setError("サブクエストの取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [groupId, questId, subQuestId]);

  async function handleAccept() {
    setAccepting(true);
    setError("");
    try {
      const res = await fetch(
        `/api/groups/${groupId}/quests/${questId}/subquests/${subQuestId}/accept`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "受諾に失敗しました"); return; }
      setSubQuest(data);
    } finally {
      setAccepting(false);
    }
  }

  async function handlePropose(e: React.FormEvent) {
    e.preventDefault();
    setProposeError("");
    setProposing2(true);
    try {
      const res = await fetch(
        `/api/groups/${groupId}/quests/${questId}/subquests/${subQuestId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pendingPointReward: proposedReward }),
        }
      );
      let data: { error?: string } & Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* ignore parse error */ }
      if (!res.ok) { setProposeError(data.error ?? "変更提案に失敗しました"); return; }
      setSubQuest(data as SubQuest);
      setProposing(false);
    } finally {
      setProposing2(false);
    }
  }

  async function handleApprove() {
    setApproving(true);
    setError("");
    try {
      const res = await fetch(
        `/api/groups/${groupId}/quests/${questId}/subquests/${subQuestId}/approve-change`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "承認に失敗しました"); return; }
      setSubQuest(data);
    } finally {
      setApproving(false);
    }
  }

  async function handleDeny() {
    setDenying(true);
    setError("");
    try {
      const res = await fetch(
        `/api/groups/${groupId}/quests/${questId}/subquests/${subQuestId}/deny-change`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "否認に失敗しました"); return; }
      setSubQuest(data);
    } finally {
      setDenying(false);
    }
  }

  async function handleDelete() {
    if (!confirm("このサブクエストを削除しますか？")) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/groups/${groupId}/quests/${questId}/subquests/${subQuestId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "削除に失敗しました");
        return;
      }
      router.push(`/groups/${groupId}/quests/${questId}`);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <div className="p-10 text-gray-500">読み込み中...</div>;
  if (error || !subQuest) return <div className="p-10 text-red-500">{error || "サブクエストが見つかりません"}</div>;

  const canDelete =
    myMemberId &&
    (subQuest.quest.creatorId === myMemberId || subQuest.quest.completerId === myMemberId);

  const canAccept =
    myMemberId &&
    subQuest.assignee?.id === myMemberId &&
    subQuest.status === "REQUESTED";

  const canPropose =
    myMemberId &&
    (subQuest.quest.creatorId === myMemberId || subQuest.quest.completerId === myMemberId) &&
    (subQuest.status === "ASSIGNED" || subQuest.status === "CHANGE_DENIED");

  const canApproveOrDeny =
    myMemberId &&
    subQuest.assignee?.id === myMemberId &&
    subQuest.status === "CHANGE_PENDING";

  const isOverdue = subQuest.deadline &&
    subQuest.status !== "COMPLETED" && subQuest.status !== "CANCELLED" &&
    new Date(subQuest.deadline) < new Date();

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <Link
        href={`/groups/${groupId}/quests/${questId}`}
        className="text-sm text-gray-400 hover:text-gray-600 transition"
      >
        ← クエストに戻る
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[subQuest.status]}`}>
              {STATUS_LABEL[subQuest.status]}
            </span>
            <span className="text-xs text-gray-400">サブクエスト</span>
          </div>
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition"
            >
              {deleting ? "削除中..." : "削除"}
            </button>
          )}
        </div>

        <h2 className="text-xl font-bold text-gray-800">{subQuest.title}</h2>

        <div className="flex items-center gap-2 py-3 border-t border-gray-100">
          <span className="text-sm text-gray-500">報酬</span>
          <span className="text-2xl font-bold text-blue-600">{subQuest.pointReward} pt</span>
          {subQuest.status === "CHANGE_PENDING" && subQuest.pendingPointReward !== null && (
            <span className="text-sm text-orange-600 ml-2">
              → {subQuest.pendingPointReward} pt（変更提案中）
            </span>
          )}
        </div>

        <dl className="space-y-3 border-t border-gray-100 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-400">担当者</dt>
            <dd className="text-gray-700 font-medium">
              {subQuest.assignee
                ? subQuest.assignee.user.name ?? subQuest.assignee.user.email
                : "未割当"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-400">デッドライン</dt>
            <dd className={`font-medium ${isOverdue ? "text-red-600" : "text-gray-700"}`}>
              {subQuest.deadline
                ? `${new Date(subQuest.deadline).toLocaleDateString("ja-JP")}${isOverdue ? "（期限超過）" : ""}`
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-400">作成日</dt>
            <dd className="text-gray-700">
              {new Date(subQuest.createdAt).toLocaleDateString("ja-JP")}
            </dd>
          </div>
        </dl>

        {/* 親クエスト */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400 mb-1">親クエスト</p>
          <Link
            href={`/groups/${groupId}/quests/${questId}`}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            {subQuest.quest.title}
          </Link>
        </div>

        {/* 受諾ボタン（担当者・依頼中のみ） */}
        {canAccept && (
          <div className="border-t border-gray-100 pt-4">
            {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {accepting ? "受諾中..." : "このサブクエストを受諾する"}
            </button>
          </div>
        )}

        {/* 報酬変更提案（発行者/受注者・アサイン済みまたは変更否認のみ） */}
        {canPropose && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            {!proposing ? (
              <button
                onClick={() => { setProposing(true); setProposedReward(subQuest.pointReward); }}
                className="text-sm text-blue-600 hover:text-blue-800 transition"
              >
                報酬変更を提案する
              </button>
            ) : (
              <form onSubmit={handlePropose} className="space-y-3">
                <p className="text-sm font-medium text-gray-700">報酬変更の提案</p>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    新しい報酬（最大 {subQuest.quest.pointReward} pt）
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={subQuest.quest.pointReward}
                    value={proposedReward}
                    onChange={(e) => setProposedReward(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                {proposeError && <p className="text-xs text-red-600">{proposeError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={proposing2}
                    className="flex-1 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50 transition"
                  >
                    {proposing2 ? "提案中..." : "変更を提案する"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setProposing(false)}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* 承認・否認ボタン（担当者・変更承認待ちのみ） */}
        {canApproveOrDeny && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">
              報酬変更の提案：{subQuest.pointReward} pt → {subQuest.pendingPointReward} pt
            </p>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleApprove}
                disabled={approving || denying}
                className="flex-1 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
              >
                {approving ? "承認中..." : "承認する"}
              </button>
              <button
                onClick={handleDeny}
                disabled={approving || denying}
                className="flex-1 py-2.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition"
              >
                {denying ? "否認中..." : "否認する"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type QuestUser = { id: string; name: string | null; email: string };
type QuestMember = { id: string; user: QuestUser };

type SubQuest = {
  id: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
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

export default function QuestDetailPage() {
  const { id: groupId, questId } = useParams<{ id: string; questId: string }>();
  const [quest, setQuest] = useState<Quest | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [myMember, setMyMember] = useState<GroupMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const isOverdue = quest.deadline && quest.status !== "COMPLETED" && quest.status !== "CANCELLED"
    && new Date(quest.deadline) < new Date();

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <Link href={`/groups/${groupId}/quests`} className="text-sm text-gray-400 hover:text-gray-600 transition">
        ← 案件一覧に戻る
      </Link>

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
          <h2 className="text-xl font-bold text-gray-800">{quest.title}</h2>
          {quest.description && (
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">{quest.description}</p>
          )}
        </div>

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
      </div>

      {/* サブクエスト */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">サブクエスト</h3>

        {quest.subQuests.length === 0 ? (
          <p className="text-sm text-gray-400">サブクエストはありません</p>
        ) : (
          <ul className="space-y-2">
            {quest.subQuests.map((sq) => (
              <li key={sq.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-800">{sq.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    担当: {sq.assignee ? sq.assignee.user.name ?? sq.assignee.user.email : "未割当"}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[sq.status]}`}>
                  {STATUS_LABEL[sq.status]}
                </span>
              </li>
            ))}
          </ul>
        )}

        {canManageSubQuest && (
          <AddSubQuestForm
            groupId={groupId}
            questId={questId}
            members={members}
            onAdded={(sq) => setQuest((prev) => prev ? { ...prev, subQuests: [...prev.subQuests, sq] } : prev)}
          />
        )}
      </div>
    </div>
  );
}

function AddSubQuestForm({
  groupId,
  questId,
  members,
  onAdded,
}: {
  groupId: string;
  questId: string;
  members: GroupMember[];
  onAdded: (sq: SubQuest) => void;
}) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/quests/${questId}/subquests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, assigneeId: assigneeId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "エラーが発生しました");
        return;
      }
      onAdded(data);
      setTitle("");
      setAssigneeId("");
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

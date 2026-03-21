"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type QuestUser = { id: string; name: string | null; email: string };
type QuestMember = { id: string; user: QuestUser };

type SubQuest = {
  id: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  deadline: string | null;
  assignee: QuestMember | null;
  createdAt: string;
  quest: {
    id: string;
    title: string;
    creatorId: string;
    completerId: string | null;
    creator: QuestMember;
    completer: QuestMember | null;
  };
};

const STATUS_LABEL: Record<SubQuest["status"], string> = {
  OPEN: "受付中",
  IN_PROGRESS: "進行中",
  COMPLETED: "完了",
  CANCELLED: "キャンセル",
};

const STATUS_COLOR: Record<SubQuest["status"], string> = {
  OPEN: "bg-green-100 text-green-700",
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
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/groups/${groupId}/quests/${questId}/subquests/${subQuestId}`)
        .then((r) => r.ok ? r.json() : Promise.reject()),
      fetch("/api/me").then((r) => r.ok ? r.json() : null),
      fetch("/api/groups").then((r) => r.ok ? r.json() : []),
    ])
      .then(([sq, me, groups]) => {
        setSubQuest(sq);
        if (me?.id && Array.isArray(groups)) {
          const group = groups.find((g: { id: string; members: { id: string; user: { id: string } }[] }) => g.id === groupId);
          const m = group?.members.find((m: { id: string; user: { id: string } }) => m.user.id === me.id);
          if (m) setMyMemberId(m.id);
        }
      })
      .catch(() => setError("サブクエストの取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [groupId, questId, subQuestId]);

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
      </div>
    </div>
  );
}

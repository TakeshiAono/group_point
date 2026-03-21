"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type QuestUser = { id: string; name: string | null; email: string };
type QuestMember = { id: string; user: QuestUser };

type Quest = {
  id: string;
  title: string;
  description: string | null;
  pointReward: number;
  questType: "GOVERNMENT" | "MEMBER";
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  creator: QuestMember;
  completer: QuestMember | null;
  createdAt: string;
};

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/groups/${groupId}/quests/${questId}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then(setQuest)
      .catch(() => setError("クエストの取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [groupId, questId]);

  if (loading) return <div className="p-10 text-gray-500">読み込み中...</div>;
  if (error || !quest) return <div className="p-10 text-red-500">{error || "クエストが見つかりません"}</div>;

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <div>
        <Link
          href={`/groups/${groupId}/quests`}
          className="text-sm text-gray-400 hover:text-gray-600 transition"
        >
          ← 案件一覧に戻る
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        {/* ステータス・種別 */}
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[quest.status]}`}>
            {STATUS_LABEL[quest.status]}
          </span>
          <span className="text-xs text-gray-400">
            {quest.questType === "GOVERNMENT" ? "政府案件" : "メンバー案件"}
          </span>
        </div>

        {/* タイトル */}
        <div>
          <h2 className="text-xl font-bold text-gray-800">{quest.title}</h2>
          {quest.description && (
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">{quest.description}</p>
          )}
        </div>

        {/* 報酬 */}
        <div className="flex items-center gap-2 py-3 border-t border-gray-100">
          <span className="text-sm text-gray-500">報酬</span>
          <span className="text-2xl font-bold text-blue-600">{quest.pointReward} pt</span>
        </div>

        {/* 詳細情報 */}
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
              {quest.completer
                ? quest.completer.user.name ?? quest.completer.user.email
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
    </div>
  );
}

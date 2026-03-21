"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type QuestUser = { id: string; name: string | null; email: string };
type QuestMember = { id: string; user: QuestUser };

type SubQuest = {
  id: string;
  title: string;
  status: "REQUESTED" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  deadline: string | null;
  createdAt: string;
  assignee: QuestMember | null;
  quest: {
    id: string;
    title: string;
    group: { id: string; name: string };
    creator: QuestMember;
  };
};

const STATUS_LABEL: Record<SubQuest["status"], string> = {
  REQUESTED: "依頼中",
  ASSIGNED: "アサイン済み",
  IN_PROGRESS: "進行中",
  COMPLETED: "完了",
  CANCELLED: "キャンセル",
};

const STATUS_COLOR: Record<SubQuest["status"], string> = {
  REQUESTED: "bg-blue-100 text-blue-700",
  ASSIGNED: "bg-purple-100 text-purple-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-red-100 text-red-500",
};

export default function SubQuestsPage() {
  const [subQuests, setSubQuests] = useState<SubQuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SubQuest["status"] | "ALL">("ALL");


  useEffect(() => {
    fetch("/api/subquests")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setSubQuests(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10 text-gray-500">読み込み中...</div>;

  const filtered =
    filter === "ALL" ? subQuests : subQuests.filter((sq) => sq.status === filter);

  // グループ別にまとめる
  const byGroup = filtered.reduce<Record<string, { groupName: string; items: SubQuest[] }>>(
    (acc, sq) => {
      const gid = sq.quest.group.id;
      if (!acc[gid]) acc[gid] = { groupName: sq.quest.group.name, items: [] };
      acc[gid].items.push(sq);
      return acc;
    },
    {}
  );

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">サブクエスト一覧</h2>
        <div className="flex gap-2 flex-wrap">
          {(["ALL", "REQUESTED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-full border transition ${
                filter === f
                  ? "bg-blue-600 text-white border-blue-600"
                  : "text-gray-600 border-gray-300 hover:border-blue-400"
              }`}
            >
              {f === "ALL" ? "すべて" : STATUS_LABEL[f as SubQuest["status"]]}
            </button>
          ))}
        </div>
      </div>

      {Object.keys(byGroup).length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">担当サブクエストはありません</p>
      ) : (
        Object.entries(byGroup).map(([gid, { groupName, items }]) => (
          <section key={gid} className="space-y-3">
            <h3 className="font-semibold text-gray-700">{groupName}</h3>
            <ul className="space-y-2">
              {items.map((sq) => {
                const isOverdue =
                  sq.deadline &&
                  sq.status !== "COMPLETED" &&
                  sq.status !== "CANCELLED" &&
                  new Date(sq.deadline) < new Date();

                return (
                  <li key={sq.id}>
                    <Link
                      href={`/groups/${sq.quest.group.id}/quests/${sq.quest.id}/subquests/${sq.id}`}
                      className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center justify-between gap-4 hover:border-blue-300 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[sq.status]}`}
                          >
                            {STATUS_LABEL[sq.status]}
                          </span>
                          <span className="text-xs text-gray-400 truncate">
                            {sq.quest.title}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 truncate">{sq.title}</p>
                        {sq.deadline && (
                          <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-500" : "text-gray-400"}`}>
                            期限: {new Date(sq.deadline).toLocaleDateString("ja-JP")}
                            {isOverdue && "（超過）"}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

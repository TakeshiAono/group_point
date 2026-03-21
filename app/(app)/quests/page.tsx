"use client";

import { useEffect, useState } from "react";
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
  createdAt: string;
};

type Group = { id: string; name: string };

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

type GroupWithQuests = Group & { quests: Quest[] };

export default function AllQuestsPage() {
  const [groupsWithQuests, setGroupsWithQuests] = useState<GroupWithQuests[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "GOVERNMENT" | "MEMBER">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | Quest["status"]>("IN_PROGRESS");

  useEffect(() => {
    fetch("/api/groups")
      .then((r) => r.ok ? r.json() : [])
      .then(async (groups: Group[]) => {
        if (!Array.isArray(groups)) return;
        const results = await Promise.all(
          groups.map(async (g) => {
            const quests = await fetch(`/api/groups/${g.id}/quests`)
              .then((r) => r.ok ? r.json() : []);
            return { ...g, quests: Array.isArray(quests) ? quests : [] };
          })
        );
        setGroupsWithQuests(results);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10 text-gray-500">読み込み中...</div>;

  const filtered = groupsWithQuests
    .map((g) => ({
      ...g,
      quests: g.quests.filter(
        (q) =>
          (filter === "ALL" || q.questType === filter) &&
          (statusFilter === "ALL" || q.status === statusFilter)
      ),
    }))
    .filter((g) => g.quests.length > 0);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-800">案件一覧</h2>
        <div className="flex flex-wrap gap-2">
          {(["IN_PROGRESS", "OPEN", "COMPLETED", "ALL"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-full border transition ${
                statusFilter === s
                  ? "bg-blue-600 text-white border-blue-600"
                  : "text-gray-600 border-gray-300 hover:border-blue-400"
              }`}
            >
              {s === "ALL" ? "すべて" : STATUS_LABEL[s]}
            </button>
          ))}
          <span className="w-px bg-gray-200 mx-1" />
          {(["ALL", "GOVERNMENT", "MEMBER"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-full border transition ${
                filter === f
                  ? "bg-blue-600 text-white border-blue-600"
                  : "text-gray-600 border-gray-300 hover:border-blue-400"
              }`}
            >
              {f === "ALL" ? "種別：すべて" : f === "GOVERNMENT" ? "政府案件" : "メンバー案件"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">案件がありません</p>
      ) : (
        filtered.map((g) => (
          <section key={g.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-700">{g.name}</h3>
              <Link
                href={`/groups/${g.id}/quests`}
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                詳細 →
              </Link>
            </div>
            <ul className="space-y-2">
              {g.quests.map((q) => (
                <li key={q.id}>
                  <Link
                    href={`/groups/${g.id}/quests/${q.id}`}
                    className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center justify-between gap-4 hover:shadow-md hover:border-blue-200 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[q.status]}`}>
                          {STATUS_LABEL[q.status]}
                        </span>
                        <span className="text-xs text-gray-400">
                          {q.questType === "GOVERNMENT" ? "政府案件" : "メンバー案件"}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-800 truncate">{q.title}</p>
                    </div>
                    <p className="text-base font-bold text-blue-600 shrink-0">{q.pointReward} pt</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

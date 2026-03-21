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
  completer: QuestMember | null;
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

export default function MyQuestsPage() {
  const [groupsWithQuests, setGroupsWithQuests] = useState<GroupWithQuests[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/me").then((r) => r.ok ? r.json() : null),
      fetch("/api/groups").then((r) => r.ok ? r.json() : []),
    ]).then(async ([me, groups]) => {
      if (!me?.id || !Array.isArray(groups)) return;
      setMyId(me.id);
      const results = await Promise.all(
        groups.map(async (g: Group) => {
          const quests = await fetch(`/api/groups/${g.id}/quests`)
            .then((r) => r.ok ? r.json() : []);
          return { ...g, quests: Array.isArray(quests) ? quests : [] };
        })
      );
      // 自分が受注した案件のみ絞り込む
      setGroupsWithQuests(
        results.map((g) => ({
          ...g,
          quests: g.quests.filter((q: Quest) => q.completer?.user.id === me.id),
        })).filter((g) => g.quests.length > 0)
      );
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10 text-gray-500">読み込み中...</div>;

  const total = groupsWithQuests.reduce((sum, g) => sum + g.quests.length, 0);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-800">受注案件一覧</h2>
        <span className="text-sm text-gray-400">{total}件</span>
      </div>

      {groupsWithQuests.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">受注中の案件はありません</p>
      ) : (
        groupsWithQuests.map((g) => (
          <section key={g.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-700">{g.name}</h3>
              <Link
                href={`/groups/${g.id}/quests`}
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                案件一覧 →
              </Link>
            </div>
            <ul className="space-y-2">
              {g.quests.map((q) => (
                <li key={q.id}>
                  <Link
                    href={`/groups/${g.id}/quests/${q.id}`}
                    className="flex items-center justify-between gap-4 bg-white border border-gray-200 rounded-xl px-5 py-3 hover:shadow-md transition"
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
                      {q.description && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{q.description}</p>
                      )}
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

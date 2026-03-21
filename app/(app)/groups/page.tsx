"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Member = {
  id: string;
  role: "LEADER" | "MEMBER";
  user: { id: string; name: string | null; email: string };
};

type Group = {
  id: string;
  name: string;
  totalIssuedPoints?: number;
  members: Member[];
};

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/groups")
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data) => { if (Array.isArray(data)) setGroups(data); })
      .catch((e) => console.error("グループ一覧の取得に失敗しました", e));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "エラーが発生しました");
        return;
      }
      setGroups((prev) => [data, ...prev]);
      setNewGroupName("");
    } finally {
      setCreating(false);
    }
  }

  const GRADIENT_COLORS = [
    "from-indigo-500 to-violet-600",
    "from-violet-500 to-purple-600",
    "from-blue-500 to-indigo-600",
    "from-purple-500 to-pink-600",
    "from-cyan-500 to-blue-600",
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
      {/* 作成フォーム */}
      <section>
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-violet-600 rounded-full inline-block" />
          グループを作成
        </h2>
        <form onSubmit={handleCreate} className="flex gap-3">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="グループ名を入力..."
            className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white shadow-sm"
            required
          />
          <button
            type="submit"
            disabled={creating}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition shadow-lg shadow-indigo-200"
          >
            {creating ? "作成中..." : "作成"}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </section>

      {/* グループ一覧 */}
      <section>
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-violet-600 rounded-full inline-block" />
          グループ一覧
        </h2>
        {groups.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-3">⬡</p>
            <p className="text-sm">グループがまだありません。最初のグループを作成しましょう。</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {groups.map((g, i) => (
              <li key={g.id}>
                <Link
                  href={`/groups/${g.id}`}
                  className="flex items-center gap-4 bg-white border border-slate-100 rounded-2xl px-6 py-5 hover:shadow-lg hover:-translate-y-0.5 transition-all shadow-sm"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${GRADIENT_COLORS[i % GRADIENT_COLORS.length]} flex items-center justify-center text-white font-bold text-xl shadow`}>
                    {g.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-base">{g.name}</p>
                    {g.totalIssuedPoints !== undefined && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        発行済み: <span className="font-semibold text-indigo-500">{g.totalIssuedPoints.toLocaleString("ja-JP")} pt</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                      {g.members.length} 人
                    </span>
                    <span className="text-slate-300">→</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

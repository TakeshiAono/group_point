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
  totalIssuedPoints: number;
  members: Member[];
};

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/groups")
      .then((r) => r.json())
      .then(setGroups);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Group Point</h1>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            トップへ
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">グループを作成</h2>
          <form onSubmit={handleCreate} className="flex gap-3">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="グループ名"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {creating ? "作成中..." : "作成"}
            </button>
          </form>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">グループ一覧</h2>
          {groups.length === 0 ? (
            <p className="text-gray-500 text-sm">グループがありません。</p>
          ) : (
            <ul className="space-y-3">
              {groups.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/groups/${g.id}`}
                    className="block bg-white border border-gray-200 rounded-xl px-6 py-4 hover:shadow-md transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-800">{g.name}</span>
                      <span className="text-xs text-gray-400">
                        メンバー {g.members.length}人
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      政府発行済みポイント: {g.totalIssuedPoints} pt
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

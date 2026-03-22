"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useOnboarding } from "@/lib/onboarding-context";

type Member = { id: string; memberPoints: number; user: { id: string } };
type Group = { id: string; name: string; members: Member[] };

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const onboarding = useOnboarding();

  useEffect(() => {
    Promise.all([
      fetch("/api/groups").then((r) => r.ok ? r.json() : []),
      fetch("/api/me").then((r) => r.ok ? r.json() : null),
    ]).then(([groupsData, me]) => {
      if (Array.isArray(groupsData)) setGroups(groupsData);
      if (me?.id) setMyUserId(me.id);
    });
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
      if (!res.ok) { setError(data.error ?? "エラーが発生しました"); return; }
      setGroups((prev) => [data, ...prev]);
      setNewGroupName("");
      setShowModal(false);
      onClose();
      if (onboarding?.step === "create-group") {
        onboarding.onGroupCreated(data.id);
      } else {
        router.push(`/groups/${data.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <aside className={`w-60 shrink-0 bg-slate-900 flex flex-col shadow-xl fixed md:relative inset-y-0 left-0 z-40 transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
      <div className="px-3 py-4 border-b border-slate-700">
        <button
          onClick={() => setShowModal(true)}
          className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-medium hover:from-indigo-500 hover:to-violet-500 transition shadow${onboarding?.step === "create-group" ? " onboarding-highlight" : ""}`}
        >
          <span className="text-lg leading-none">+</span>
          グループを作成
        </button>
      </div>
      <div className="px-4 py-3 border-b border-slate-700">
        <Link
          href="/groups"
          className="text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-200 transition"
        >
          グループ一覧
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {groups.length === 0 ? (
          <p className="px-4 py-3 text-xs text-slate-500">グループなし</p>
        ) : (
          <ul className="space-y-0.5 px-2">
            {groups.map((g) => {
              const active = pathname.startsWith(`/groups/${g.id}`);
              const myMember = myUserId
                ? g.members.find((m) => m.user.id === myUserId)
                : null;
              return (
                <li key={g.id}>
                  <Link
                    href={`/groups/${g.id}`}
                    className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg transition ${
                      active
                        ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <span className={`text-sm truncate ${active ? "font-semibold" : ""}`}>{g.name}</span>
                    {myMember !== null && myMember !== undefined && (
                      <span className={`text-xs font-bold shrink-0 ${active ? "text-indigo-200" : "text-slate-500"}`}>
                        {myMember.memberPoints.toLocaleString("ja-JP")} pt
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
      {/* グループ作成モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-800">グループを作成</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="グループ名を入力..."
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                required
                autoFocus
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setNewGroupName(""); setError(""); }}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {creating ? "作成中..." : "作成する"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}

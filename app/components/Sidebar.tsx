"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Member = { id: string; memberPoints: number; user: { id: string } };
type Group = { id: string; name: string; members: Member[] };

export default function Sidebar() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    Promise.all([
      fetch("/api/groups").then((r) => r.ok ? r.json() : []),
      fetch("/api/me").then((r) => r.ok ? r.json() : null),
    ]).then(([groupsData, me]) => {
      if (Array.isArray(groupsData)) setGroups(groupsData);
      if (me?.id) setMyUserId(me.id);
    });
  }, []);

  return (
    <aside className="w-60 shrink-0 bg-slate-900 flex flex-col shadow-xl">
      <div className="px-4 py-4 border-b border-slate-700">
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
      <div className="px-3 py-4 border-t border-slate-700">
        <Link
          href="/groups"
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-medium hover:from-indigo-500 hover:to-violet-500 transition shadow"
        >
          <span className="text-lg leading-none">+</span>
          グループを作成
        </Link>
      </div>
    </aside>
  );
}

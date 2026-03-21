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
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col">
      <div className="px-4 py-4 border-b border-gray-100">
        <Link
          href="/groups"
          className="text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-600 transition"
        >
          グループ一覧
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {groups.length === 0 ? (
          <p className="px-4 py-3 text-xs text-gray-400">グループなし</p>
        ) : (
          <ul>
            {groups.map((g) => {
              const active = pathname.startsWith(`/groups/${g.id}`);
              const myMember = myUserId
                ? g.members.find((m) => m.user.id === myUserId)
                : null;
              return (
                <li key={g.id}>
                  <Link
                    href={`/groups/${g.id}`}
                    className={`block px-4 py-2.5 transition ${
                      active
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <p className={`text-sm truncate ${active ? "font-medium" : ""}`}>{g.name}</p>
                    {myMember !== null && myMember !== undefined && (
                      <p className={`text-xs mt-0.5 font-bold ${active ? "text-blue-500" : "text-gray-400"}`}>
                        {myMember.memberPoints} pt
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
      <div className="px-4 py-3 border-t border-gray-100">
        <Link
          href="/groups"
          className="text-xs text-blue-600 hover:text-blue-800 transition"
        >
          + グループを作成
        </Link>
      </div>
    </aside>
  );
}

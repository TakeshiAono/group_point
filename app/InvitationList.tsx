"use client";

import { useEffect, useState } from "react";

type Invitation = {
  id: string;
  role: "LEADER" | "MEMBER";
  group: { id: string; name: string };
  inviter: {
    user: { id: string; name: string | null; email: string };
  };
};

export default function InvitationList() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/invitations")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setInvitations(data);
      });
  }, []);

  async function respond(id: string, action: "accept" | "decline") {
    setProcessing(id);
    try {
      await fetch(`/api/invitations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
    } finally {
      setProcessing(null);
    }
  }

  if (invitations.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <h3 className="font-bold text-slate-700 text-lg">招待が届いています</h3>
        <span className="px-2.5 py-0.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold rounded-full shadow">
          {invitations.length}
        </span>
      </div>
      <ul className="space-y-3">
        {invitations.map((inv) => (
          <li
            key={inv.id}
            className="bg-white border border-indigo-100 rounded-xl px-6 py-4 flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow">
                {inv.group.name[0]}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  <span className="text-indigo-600">{inv.group.name}</span> から招待が届いています
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  招待者: {inv.inviter.user.name ?? inv.inviter.user.email} ／
                  ロール: {inv.role === "LEADER" ? "管理側メンバー（LEADER）" : "一般メンバー"}
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => respond(inv.id, "accept")}
                disabled={processing === inv.id}
                className="px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm rounded-lg hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 transition shadow shadow-indigo-200"
              >
                承認
              </button>
              <button
                onClick={() => respond(inv.id, "decline")}
                disabled={processing === inv.id}
                className="px-4 py-1.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 disabled:opacity-50 transition"
              >
                拒否
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

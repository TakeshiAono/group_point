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
      <h3 className="font-semibold text-gray-700 mb-3">
        招待が届いています
        <span className="ml-2 text-blue-600 font-bold">{invitations.length}</span>
      </h3>
      <ul className="space-y-3">
        {invitations.map((inv) => (
          <li
            key={inv.id}
            className="bg-white border border-blue-200 rounded-xl px-6 py-4 flex items-center justify-between gap-4"
          >
            <div>
              <p className="text-sm font-medium text-gray-800">
                <span className="text-blue-600">{inv.group.name}</span> から招待が届いています
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                招待者: {inv.inviter.user.name ?? inv.inviter.user.email} ／
                ロール: {inv.role === "LEADER" ? "政府関係者（LEADER）" : "一般メンバー"}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => respond(inv.id, "accept")}
                disabled={processing === inv.id}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                承認
              </button>
              <button
                onClick={() => respond(inv.id, "decline")}
                disabled={processing === inv.id}
                className="px-4 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50 transition"
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

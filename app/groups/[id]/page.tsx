"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Member = {
  id: string;
  role: "LEADER" | "MEMBER";
  memberPoints: number;
  user: { id: string; name: string | null; email: string };
};

type Group = {
  id: string;
  name: string;
  totalIssuedPoints: number;
  members: Member[];
};

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);

  useEffect(() => {
    fetch(`/api/groups`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          const found = data.find((g: Group) => g.id === id);
          setGroup(found ?? null);
        }
      });
  }, [id]);

  if (!group) {
    return <div className="p-10 text-gray-500">読み込み中...</div>;
  }

  const leaders = group.members.filter((m) => m.role === "LEADER");
  const regularMembers = group.members.filter((m) => m.role === "MEMBER");
  const totalCirculating = group.members.reduce((sum, m) => sum + m.memberPoints, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Group Point</h1>
          <Link href="/groups" className="text-sm text-gray-500 hover:text-gray-700">
            ← グループ一覧
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <section>
          <h2 className="text-2xl font-bold text-gray-800">{group.name}</h2>
          <div className="mt-2 flex gap-6 text-sm text-gray-500">
            <span>政府発行済みポイント: <strong className="text-gray-700">{group.totalIssuedPoints} pt</strong></span>
            <span>流通ポイント合計: <strong className="text-gray-700">{totalCirculating} pt</strong></span>
          </div>
        </section>

        {/* 政府関係者 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-700">政府関係者（LEADER）</h3>
            {leaders.length > 0 && <span className="text-gray-400 text-sm">{leaders.length}人</span>}
          </div>
          {leaders.length > 0 && (
            <ul className="space-y-2">
              {leaders.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  groupId={id}
                  onRemoved={(removedId) =>
                    setGroup((prev) =>
                      prev ? { ...prev, members: prev.members.filter((x) => x.id !== removedId) } : prev
                    )
                  }
                />
              ))}
            </ul>
          )}
          <InviteForm groupId={id} role="LEADER" />
        </section>

        {/* 一般メンバー */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-700">一般メンバー</h3>
            {regularMembers.length > 0 && <span className="text-gray-400 text-sm">{regularMembers.length}人</span>}
          </div>
          {regularMembers.length > 0 && (
            <ul className="space-y-2">
              {regularMembers.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  groupId={id}
                  onRemoved={(removedId) =>
                    setGroup((prev) =>
                      prev ? { ...prev, members: prev.members.filter((x) => x.id !== removedId) } : prev
                    )
                  }
                />
              ))}
            </ul>
          )}
          <InviteForm groupId={id} role="MEMBER" />
        </section>
      </main>
    </div>
  );
}

function InviteForm({ groupId, role }: { groupId: string; role: "LEADER" | "MEMBER" }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const label = role === "LEADER" ? "政府関係者を招待" : "一般メンバーを招待";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "エラーが発生しました");
        return;
      }
      setSuccess(`${data.invitee.name ?? data.invitee.email} に招待を送りました`);
      setEmail("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-sm font-medium text-gray-700 mb-3">{label}</p>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="メールアドレス"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {submitting ? "送信中..." : "招待を送る"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-2 text-sm text-green-600">{success}</p>}
    </div>
  );
}

function MemberRow({
  member,
  groupId,
  onRemoved,
}: {
  member: Member;
  groupId: string;
  onRemoved: (id: string) => void;
}) {
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    if (!confirm(`${member.user.name ?? member.user.email} をグループから外しますか？`)) return;
    setRemoving(true);
    try {
      await fetch(`/api/groups/${groupId}/members/${member.id}`, { method: "DELETE" });
      onRemoved(member.id);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <li className="bg-white border border-gray-200 rounded-lg px-5 py-3 flex items-center justify-between">
      <div>
        <span className="text-sm font-medium text-gray-800">
          {member.user.name ?? member.user.email}
        </span>
        {member.user.name && (
          <span className="ml-2 text-xs text-gray-400">{member.user.email}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">{member.memberPoints} pt</span>
        <button
          onClick={handleRemove}
          disabled={removing}
          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition"
        >
          {removing ? "..." : "削除"}
        </button>
      </div>
    </li>
  );
}

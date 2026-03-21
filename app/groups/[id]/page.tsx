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
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"LEADER" | "MEMBER">("LEADER");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "エラーが発生しました");
        return;
      }
      setSuccess(
        `${data.user.name ?? data.user.email} を ${role === "LEADER" ? "政府関係者（LEADER）" : "メンバー"} として登録しました`
      );
      setEmail("");
      // メンバー一覧を更新
      setGroup((prev) => {
        if (!prev) return prev;
        const exists = prev.members.find((m) => m.id === data.id);
        if (exists) {
          return {
            ...prev,
            members: prev.members.map((m) => (m.id === data.id ? data : m)),
          };
        }
        return { ...prev, members: [...prev.members, data] };
      });
    } finally {
      setSubmitting(false);
    }
  }

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

        {/* 政府関係者登録フォーム */}
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="font-semibold text-gray-800 mb-4">メンバーを登録</h3>
          <form onSubmit={handleAddMember} className="space-y-3">
            <div className="flex gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="メールアドレス"
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "LEADER" | "MEMBER")}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="LEADER">政府関係者（LEADER）</option>
                <option value="MEMBER">一般メンバー</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {submitting ? "登録中..." : "登録"}
            </button>
          </form>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {success && <p className="mt-2 text-sm text-green-600">{success}</p>}
        </section>

        {/* 政府関係者一覧 */}
        <section>
          <h3 className="font-semibold text-gray-700 mb-3">
            政府関係者（LEADER）{leaders.length > 0 && <span className="ml-2 text-gray-400 font-normal text-sm">{leaders.length}人</span>}
          </h3>
          {leaders.length === 0 ? (
            <p className="text-gray-400 text-sm">政府関係者がいません。</p>
          ) : (
            <ul className="space-y-2">
              {leaders.map((m) => (
                <MemberRow key={m.id} member={m} />
              ))}
            </ul>
          )}
        </section>

        {/* 一般メンバー一覧 */}
        <section>
          <h3 className="font-semibold text-gray-700 mb-3">
            一般メンバー{regularMembers.length > 0 && <span className="ml-2 text-gray-400 font-normal text-sm">{regularMembers.length}人</span>}
          </h3>
          {regularMembers.length === 0 ? (
            <p className="text-gray-400 text-sm">一般メンバーがいません。</p>
          ) : (
            <ul className="space-y-2">
              {regularMembers.map((m) => (
                <MemberRow key={m.id} member={m} />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function MemberRow({ member }: { member: Member }) {
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
      <span className="text-sm text-gray-600">{member.memberPoints} pt</span>
    </li>
  );
}

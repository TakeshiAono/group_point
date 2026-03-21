"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

type Role = "ADMIN" | "LEADER" | "MEMBER";

type Member = {
  id: string;
  role: Role;
  memberPoints: number;
  user: { id: string; name: string | null; email: string };
};

type Group = {
  id: string;
  name: string;
  totalIssuedPoints?: number; // ADMIN/LEADERのみ返される
  members: Member[];
};

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "管理人",
  LEADER: "政府関係者",
  MEMBER: "一般メンバー",
};

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  LEADER: "bg-blue-100 text-blue-700",
  MEMBER: "bg-gray-100 text-gray-600",
};

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d) => { if (d.id) setMyUserId(d.id); })
      .catch((e) => console.error("ユーザー情報の取得に失敗しました", e));
    fetch("/api/groups")
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          const found = data.find((g: Group) => g.id === id);
          setGroup(found ?? null);
        }
      })
      .catch((e) => console.error("グループ情報の取得に失敗しました", e));
  }, [id]);

  if (!group) return <div className="p-10 text-gray-500">読み込み中...</div>;

  const myMember = group.members.find((m) => m.user.id === myUserId);
  const myRole = myMember?.role ?? "MEMBER";

  const admins = group.members.filter((m) => m.role === "ADMIN");
  const leaders = group.members.filter((m) => m.role === "LEADER");
  const regularMembers = group.members.filter((m) => m.role === "MEMBER");
  const totalCirculating = group.members.reduce((sum, m) => sum + m.memberPoints, 0);

  function removeMember(removedId: string) {
    setGroup((prev) =>
      prev ? { ...prev, members: prev.members.filter((x) => x.id !== removedId) } : prev
    );
  }

  // 操作者が対象メンバーを削除できるか
  function canDelete(target: Member): boolean {
    if (target.user.id === myUserId) return false; // 自分自身は不可
    if (target.role === "ADMIN") return false;      // ADMINは削除不可
    if (myRole === "ADMIN") return true;            // ADMINはLEADER・MEMBERを削除可
    if (myRole === "LEADER") return target.role === "MEMBER"; // LEADERはMEMBERのみ
    return false;
  }

  return (
    <div>
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <section>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-800">{group.name}</h2>
            {myRole !== "MEMBER" && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[myRole]}`}>
                {ROLE_LABEL[myRole]}
              </span>
            )}
          </div>
        </section>

        {/* クエストへのリンク */}
        <Link
          href={`/groups/${id}/quests`}
          className="block bg-white border border-gray-200 rounded-xl px-6 py-4 hover:shadow-md transition"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800">クエスト</p>
              <p className="text-xs text-gray-400 mt-0.5">政府案件・メンバー案件の一覧と発行</p>
            </div>
            <span className="text-gray-400">→</span>
          </div>
        </Link>

        {/* 政府発行済みポイント管理（ADMIN/LEADERのみ） */}
        {group.totalIssuedPoints !== undefined && (
          <IssuedPointsEditor
            groupId={id}
            totalIssuedPoints={group.totalIssuedPoints}
            totalCirculating={totalCirculating}
            isAdmin={myRole === "ADMIN"}
            onUpdated={(v) => setGroup((prev) => prev ? { ...prev, totalIssuedPoints: v } : prev)}
          />
        )}

        {/* 管理人 */}
        <MemberSection
          title="管理人（ADMIN）"
          members={admins}
          groupId={id}
          canDelete={canDelete}
          onRemoved={removeMember}
        />

        {/* 政府関係者 */}
        <MemberSection
          title="政府関係者（LEADER）"
          members={leaders}
          groupId={id}
          canDelete={canDelete}
          onRemoved={removeMember}
          inviteRole={myRole === "ADMIN" ? "LEADER" : undefined}
        />

        {/* 一般メンバー */}
        <MemberSection
          title="一般メンバー"
          members={regularMembers}
          groupId={id}
          canDelete={canDelete}
          onRemoved={removeMember}
          inviteRole={myRole === "ADMIN" || myRole === "LEADER" ? "MEMBER" : undefined}
        />

        {/* ポイント付与（ADMINのみ） */}
        {myRole === "ADMIN" && (
          <GrantPointsSection
            groupId={id}
            members={group.members}
            onGranted={(memberId, amount) => {
              setGroup((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  members: prev.members.map((m) =>
                    memberId === null || m.id === memberId
                      ? { ...m, memberPoints: m.memberPoints + amount }
                      : m
                  ),
                };
              });
            }}
          />
        )}
      </main>
    </div>
  );
}

function MemberSection({
  title,
  members,
  groupId,
  canDelete,
  onRemoved,
  inviteRole,
}: {
  title: string;
  members: Member[];
  groupId: string;
  canDelete: (m: Member) => boolean;
  onRemoved: (id: string) => void;
  inviteRole?: "LEADER" | "MEMBER";
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-gray-700">{title}</h3>
        {members.length > 0 && <span className="text-gray-400 text-sm">{members.length}人</span>}
      </div>
      {members.length > 0 && (
        <ul className="space-y-2">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              groupId={groupId}
              deletable={canDelete(m)}
              onRemoved={onRemoved}
            />
          ))}
        </ul>
      )}
      {inviteRole && <InviteForm groupId={groupId} role={inviteRole} />}
    </section>
  );
}

function MemberRow({
  member,
  groupId,
  deletable,
  onRemoved,
}: {
  member: Member;
  groupId: string;
  deletable: boolean;
  onRemoved: (id: string) => void;
}) {
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    if (!confirm(`${member.user.name ?? member.user.email} を削除しますか？`)) return;
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
        {deletable && (
          <button
            onClick={handleRemove}
            disabled={removing}
            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition"
          >
            {removing ? "..." : "削除"}
          </button>
        )}
      </div>
    </li>
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

function IssuedPointsEditor({
  groupId,
  totalIssuedPoints,
  totalCirculating,
  isAdmin,
  onUpdated,
}: {
  groupId: string;
  totalIssuedPoints: number;
  totalCirculating: number;
  isAdmin: boolean;
  onUpdated: (v: number) => void;
}) {
  const reclaimable = totalIssuedPoints - totalCirculating;

  async function sendDelta(delta: number, amount: number, setError: (e: string) => void, setSaving: (b: boolean) => void, setAmount: (v: number) => void) {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "エラーが発生しました");
        return;
      }
      onUpdated(data.totalIssuedPoints);
      setAmount(0);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      <h3 className="font-semibold text-gray-800">政府発行済みポイント</h3>

      {/* 現在の状態 */}
      <div className="flex flex-col sm:flex-row gap-6 items-center">
        {/* 円グラフ */}
        <div className="w-48 h-48 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: "流通中", value: totalCirculating },
                  { name: "未流通", value: Math.max(reclaimable, 0) },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
              >
                <Cell fill="#3b82f6" />
                <Cell fill="#22c55e" />
              </Pie>
              <Tooltip formatter={(value) => [`${value} pt`]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 数値サマリー */}
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <p className="text-gray-400 text-xs mb-0.5">発行済み</p>
            <p className="text-2xl font-bold text-gray-800">{totalIssuedPoints} pt</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs mb-0.5">流通中</p>
            <p className="text-2xl font-bold text-blue-600">{totalCirculating} pt</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs mb-0.5">未流通（回収可能）</p>
            <p className="text-2xl font-bold text-green-600">{Math.max(reclaimable, 0)} pt</p>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
          <DeltaForm
            label="追加発行"
            buttonLabel="発行する"
            buttonClass="bg-blue-600 hover:bg-blue-700"
            min={1}
            sign={1}
            onSubmit={sendDelta}
          />
          <DeltaForm
            label={`回収（最大 ${reclaimable} pt）`}
            buttonLabel="回収する"
            buttonClass="bg-red-500 hover:bg-red-600"
            min={1}
            max={reclaimable}
            sign={-1}
            onSubmit={sendDelta}
          />
        </div>
      )}
    </section>
  );
}

function GrantPointsSection({
  groupId,
  members,
  onGranted,
}: {
  groupId: string;
  members: Member[];
  onGranted: (memberId: string | null, amount: number) => void;
}) {
  const [mode, setMode] = useState<"individual" | "all">("individual");
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id ?? "");
  const [amount, setAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (amount <= 0) return;
    setSubmitting(true);
    try {
      const body: { amount: number; memberId?: string } = { amount };
      if (mode === "individual") body.memberId = selectedMemberId;
      const res = await fetch(`/api/groups/${groupId}/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "エラーが発生しました");
        return;
      }
      if (mode === "individual") {
        onGranted(selectedMemberId, amount);
        setSuccess(`${amount} pt を付与しました`);
      } else {
        onGranted(null, amount);
        setSuccess(`全員に ${amount} pt を付与しました（合計 ${data.totalGranted} pt）`);
      }
      setAmount(0);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h3 className="font-semibold text-gray-800">ポイント付与（ADMIN）</h3>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="radio"
            checked={mode === "individual"}
            onChange={() => setMode("individual")}
          />
          個人に付与
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="radio"
            checked={mode === "all"}
            onChange={() => setMode("all")}
          />
          全員に付与
        </label>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
        {mode === "individual" && (
          <div>
            <p className="text-xs text-gray-500 mb-1">対象メンバー</p>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.user.name ?? m.user.email}（{m.memberPoints} pt）
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-500 mb-1">付与量</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="pt"
              className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
            <span className="text-sm text-gray-500">pt</span>
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
        >
          {submitting ? "付与中..." : "付与する"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
    </section>
  );
}

function DeltaForm({
  label,
  buttonLabel,
  buttonClass,
  min,
  max,
  sign,
  onSubmit,
}: {
  label: string;
  buttonLabel: string;
  buttonClass: string;
  min: number;
  max?: number;
  sign: 1 | -1;
  onSubmit: (delta: number, amount: number, setError: (e: string) => void, setSaving: (b: boolean) => void, setAmount: (v: number) => void) => void;
}) {
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (amount <= 0) return;
    onSubmit(sign * amount, amount, setError, setSaving, setAmount);
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="number"
          min={min}
          max={max}
          value={amount || ""}
          onChange={(e) => setAmount(Number(e.target.value))}
          placeholder="pt"
          className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          required
        />
        <button
          type="submit"
          disabled={saving || (max !== undefined && max <= 0)}
          className={`px-4 py-2 text-white text-sm rounded-lg disabled:opacity-50 transition ${buttonClass}`}
        >
          {saving ? "..." : buttonLabel}
        </button>
      </form>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

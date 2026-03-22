"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import UserAvatar from "@/app/components/UserAvatar";
import { useOnboarding } from "@/lib/onboarding-context";

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
  pointUnit: string;
  laborCostPerHour: number;
  timeUnit: string;
  members: Member[];
};

const TIME_UNIT_MULTIPLIER: Record<string, number> = {
  HOUR: 1, DAY: 1 / 8, WEEK: 1 / (8 * 5), MONTH: 1 / (8 * 5 * 4),
};
const TIME_UNIT_LABEL: Record<string, string> = {
  YEN: "円", HOUR: "人・時間", DAY: "人・日", WEEK: "人・週", MONTH: "人・月",
};

function formatPoint(points: number, group: Pick<Group, "pointUnit" | "laborCostPerHour" | "timeUnit">): string {
  if (group.pointUnit === "円") {
    if (group.timeUnit === "YEN" || !group.laborCostPerHour) return `${points.toLocaleString("ja-JP")} 円`;
    const value = (points / group.laborCostPerHour) * (TIME_UNIT_MULTIPLIER[group.timeUnit] ?? 1);
    return `${value.toLocaleString("ja-JP")} ${TIME_UNIT_LABEL[group.timeUnit]}`;
  }
  return `${points.toLocaleString("ja-JP")} pt`;
}

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "管理者", LEADER: "マネージャー", MEMBER: "メンバー",
};

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  LEADER: "bg-blue-100 text-blue-700",
  MEMBER: "bg-gray-100 text-gray-600",
};

export default function MembersPage() {
  const { id: groupId } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/me").then((r) => r.ok ? r.json() : null),
      fetch("/api/groups").then((r) => r.ok ? r.json() : []),
    ]).then(([me, groups]) => {
      if (me?.id) setMyUserId(me.id);
      if (Array.isArray(groups)) {
        const found = groups.find((g: Group) => g.id === groupId);
        setGroup(found ?? null);
      }
    }).finally(() => setLoading(false));
  }, [groupId]);

  if (loading) return <div className="p-10 text-gray-500">読み込み中...</div>;
  if (!group) return <div className="p-10 text-red-500">グループが見つかりません</div>;

  const myMember = group.members.find((m) => m.user.id === myUserId);
  const myRole = myMember?.role ?? "MEMBER";

  function canDelete(target: Member): boolean {
    if (target.user.id === myUserId) return false;
    if (target.role === "ADMIN") return false;
    if (myRole === "ADMIN") return true;
    if (myRole === "LEADER") return target.role === "MEMBER";
    return false;
  }

  function removeMember(removedId: string) {
    setGroup((prev) => prev ? { ...prev, members: prev.members.filter((m) => m.id !== removedId) } : prev);
  }

  const inviteRoles: ("LEADER" | "MEMBER")[] = [
    ...(myRole === "ADMIN" ? ["LEADER" as const] : []),
    ...(myRole === "ADMIN" || myRole === "LEADER" ? ["MEMBER" as const] : []),
  ];

  const sorted = [...group.members].sort((a, b) => {
    const order = { ADMIN: 0, LEADER: 1, MEMBER: 2 };
    return order[a.role] - order[b.role];
  });

  return (
    <div>
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/groups/${groupId}`} className="text-sm text-gray-400 hover:text-gray-600 transition">
            ← {group.name}
          </Link>
          <h2 className="text-2xl font-bold text-gray-800">メンバー管理</h2>
        </div>

        <ul className="space-y-2">
          {sorted.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              groupId={groupId}
              deletable={canDelete(m)}
              onRemoved={removeMember}
              pointGroup={group}
            />
          ))}
        </ul>

        {inviteRoles.length > 0 && (
          <InviteForm groupId={groupId} availableRoles={inviteRoles} />
        )}
      </main>
    </div>
  );
}

function MemberRow({
  member, groupId, deletable, onRemoved, pointGroup,
}: {
  member: Member;
  groupId: string;
  deletable: boolean;
  onRemoved: (id: string) => void;
  pointGroup: Pick<Group, "pointUnit" | "laborCostPerHour" | "timeUnit">;
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
      <div className="flex items-center gap-2">
        <UserAvatar userId={member.user.id} name={member.user.name} />
        <span className="text-sm font-medium text-gray-800">{member.user.name ?? member.user.email}</span>
        {member.user.name && <span className="text-xs text-gray-400">{member.user.email}</span>}
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_BADGE[member.role]}`}>
          {ROLE_LABEL[member.role]}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">{formatPoint(member.memberPoints, pointGroup)}</span>
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

function InviteForm({ groupId, availableRoles }: { groupId: string; availableRoles: ("LEADER" | "MEMBER")[] }) {
  const onboarding = useOnboarding();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"LEADER" | "MEMBER">(availableRoles[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "エラーが発生しました"); return; }
      const displayName = data.inviteeName ?? data.inviteeEmail ?? email;
      setSuccess(data.isNewUser
        ? `${displayName} に招待メールを送りました（アカウント未登録）`
        : `${displayName} に招待を送りました`);
      setEmail("");
      if (onboarding?.step === "invite") onboarding.onInviteSent();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-sm font-medium text-gray-700 mb-3">メンバーを招待</p>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="メールアドレス"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          required
        />
        {availableRoles.length > 1 && (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "LEADER" | "MEMBER")}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="LEADER">管理側</option>
            <option value="MEMBER">一般</option>
          </select>
        )}
        <button
          type="submit"
          disabled={submitting}
          className={`px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition${onboarding?.step === "invite" ? " onboarding-highlight" : ""}`}
        >
          {submitting ? "送信中..." : "招待を送る"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {success && <p className="mt-2 text-sm text-green-600">{success}</p>}
    </div>
  );
}

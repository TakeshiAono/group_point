"use client";

import { useEffect, useRef, useState } from "react";
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
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-6">
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
              isMe={m.user.id === myUserId}
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
  member, groupId, deletable, onRemoved, pointGroup, isMe,
}: {
  member: Member;
  groupId: string;
  deletable: boolean;
  onRemoved: (id: string) => void;
  pointGroup: Pick<Group, "pointUnit" | "laborCostPerHour" | "timeUnit">;
  isMe?: boolean;
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
    <li className={`rounded-lg px-4 md:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border ${isMe ? "bg-indigo-50 border-indigo-200" : "bg-white border-gray-200"}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <UserAvatar userId={member.user.id} name={member.user.name} />
        <span className="text-sm font-medium text-gray-800">{member.user.name ?? member.user.email}</span>
        {member.user.name && <span className="text-xs text-gray-400 hidden sm:inline">{member.user.email}</span>}
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_BADGE[member.role]}`}>
          {ROLE_LABEL[member.role]}
        </span>
        {isMe && <span className="text-xs text-indigo-500 font-medium">あなた</span>}
      </div>
      <div className="flex items-center gap-3 pl-8 sm:pl-0">
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
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
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

      {/* CSV一括招待 */}
      <CsvInviteSection groupId={groupId} role={role} availableRoles={availableRoles} />
    </div>
  );
}

type CsvEntry = { email: string; role: "LEADER" | "MEMBER" };
type SendResult = { email: string; ok: boolean; message: string };

function CsvInviteSection({ groupId, role: defaultRole, availableRoles }: { groupId: string; role: "LEADER" | "MEMBER"; availableRoles: ("LEADER" | "MEMBER")[] }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<CsvEntry[]>([]);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const emails = text
        .split(/[\r\n,;]+/)
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
      if (emails.length === 0) {
        setResults([{ email: "", ok: false, message: "有効なメールアドレスが見つかりませんでした" }]);
        return;
      }
      // 重複除去してプレビューへ
      const unique = [...new Set(emails)];
      setPreview(unique.map((email) => ({ email, role: defaultRole })));
      setResults([]);
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  function toggleLeader(index: number) {
    setPreview((prev) => {
      const updated = prev.map((e, i) =>
        i === index ? { ...e, role: (e.role === "LEADER" ? "MEMBER" : "LEADER") as "LEADER" | "MEMBER" } : e
      );
      // 管理側を上、メンバーを下に並び替え
      return [
        ...updated.filter((e) => e.role === "LEADER"),
        ...updated.filter((e) => e.role === "MEMBER"),
      ];
    });
  }

  function removeEntry(index: number) {
    setPreview((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSend() {
    if (preview.length === 0) return;
    setSending(true);
    setResults([]);
    const newResults: SendResult[] = [];
    for (const { email, role } of preview) {
      const res = await fetch(`/api/groups/${groupId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json().catch(() => ({}));
      newResults.push({
        email,
        ok: res.ok,
        message: res.ok
          ? data.isNewUser ? "招待メール送信（未登録）" : "招待送信済み"
          : data.error ?? "エラー",
      });
    }
    setResults(newResults);
    setPreview([]);
    setSending(false);
  }

  const successCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-indigo-500 hover:text-indigo-700 font-medium transition flex items-center gap-1"
      >
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        CSVで一括招待
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-gray-500">
            メールアドレスを1行1件またはカンマ区切りで記載したCSVファイルを選択してください。取り込み後にロールを変更できます。
          </p>
          {/* サンプル表示 */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 space-y-1">
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">CSVの例</p>
            <pre className="text-xs text-slate-600 leading-relaxed">{`tanaka@example.com\nsuzuki@example.com\nwatanabe@example.com`}</pre>
            <p className="text-[10px] text-slate-400">カンマ区切り（1行に複数）も可：<span className="font-mono">a@example.com,b@example.com</span></p>
          </div>
          <p className="text-xs text-gray-500 hidden">
          </p>
          <label className="flex items-center gap-2 w-fit px-4 py-2 rounded-lg border border-indigo-300 text-indigo-600 hover:bg-indigo-50 text-sm cursor-pointer transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            CSVファイルを選択
            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={handleFile} />
          </label>

          {/* プレビューリスト */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <div className="max-h-52 overflow-y-auto border border-gray-100 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-100">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">メールアドレス</th>
                      {availableRoles.includes("LEADER") && (
                        <th className="px-3 py-2 font-medium text-indigo-600 whitespace-nowrap">管理側として招待</th>
                      )}
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.map((entry, i) => (
                      <tr key={entry.email} className={`transition-colors ${entry.role === "LEADER" ? "bg-indigo-50" : "bg-white"}`}>
                        <td className="px-3 py-2 text-gray-700 truncate max-w-[200px]">{entry.email}</td>
                        {availableRoles.includes("LEADER") && (
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={entry.role === "LEADER"}
                              onChange={() => toggleLeader(i)}
                              className="accent-indigo-600 w-4 h-4 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeEntry(i)}
                            className="text-gray-300 hover:text-red-400 transition"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg disabled:opacity-50 transition"
              >
                {sending ? "送信中..." : `${preview.length}件に招待を送る`}
              </button>
            </div>
          )}

          {/* 送信結果 */}
          {results.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-600">
                結果: <span className="text-green-600">{successCount}件成功</span>
                {failCount > 0 && <span className="text-red-500 ml-2">{failCount}件失敗</span>}
              </p>
              <ul className="max-h-40 overflow-y-auto space-y-1">
                {results.map((r, i) => (
                  <li key={i} className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 ${r.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                    <span className="shrink-0">{r.ok ? "✓" : "✗"}</span>
                    <span className="font-medium truncate">{r.email || "—"}</span>
                    <span className="ml-auto shrink-0 text-[10px] opacity-70">{r.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  pointUnit: string;
  laborCostPerHour: number;
  timeUnit: string;
  proposalReward: number;
  members: Member[];
};

// timeUnit: YEN=円のまま表示、HOUR/DAY/WEEK/MONTH=人・時間換算
const TIME_UNIT_LABEL: Record<string, string> = { YEN: "円", HOUR: "人・時間", DAY: "人・日", WEEK: "人・週", MONTH: "人・月" };
// 人・時間 = pt ÷ 人件費、人・日 = 人・時間 ÷ 8、人・週 = 人・日 ÷ 5、人・月 = 人・週 ÷ 4
const TIME_UNIT_MULTIPLIER: Record<string, number> = { HOUR: 1, DAY: 1 / 8, WEEK: 1 / (8 * 5), MONTH: 1 / (8 * 5 * 4) };

// 入力値（設定単位）→ pt に変換
function unitToPt(value: number, group: Pick<Group, "pointUnit" | "laborCostPerHour" | "timeUnit">): number {
  if (group.pointUnit !== "円" || group.timeUnit === "YEN" || !group.laborCostPerHour) {
    return Math.round(value);
  }
  // displayValue = (pt / laborCostPerHour) * TIME_UNIT_MULTIPLIER[timeUnit]
  // pt = displayValue / TIME_UNIT_MULTIPLIER[timeUnit] * laborCostPerHour
  const multiplier = TIME_UNIT_MULTIPLIER[group.timeUnit] ?? 1;
  return Math.round((value / multiplier) * group.laborCostPerHour);
}

// pt → 設定単位の値に変換
function ptToUnit(pt: number, group: Pick<Group, "pointUnit" | "laborCostPerHour" | "timeUnit">): number {
  if (group.pointUnit !== "円" || group.timeUnit === "YEN" || !group.laborCostPerHour) {
    return pt;
  }
  const multiplier = TIME_UNIT_MULTIPLIER[group.timeUnit] ?? 1;
  return (pt / group.laborCostPerHour) * multiplier;
}

// 入力フォームに表示するラベル
function inputUnitLabel(group: Pick<Group, "pointUnit" | "laborCostPerHour" | "timeUnit">): string {
  if (group.pointUnit !== "円") return "pt";
  if (group.timeUnit === "YEN" || !group.laborCostPerHour) return "円";
  return TIME_UNIT_LABEL[group.timeUnit] ?? "円";
}

// ポイントを表示用にフォーマット
function formatPoint(points: number, group: Pick<Group, "pointUnit" | "laborCostPerHour" | "timeUnit">): string {
  if (group.pointUnit === "円") {
    if (group.timeUnit === "YEN" || !group.laborCostPerHour) {
      return `${points.toLocaleString("ja-JP")} 円`;
    }
    const personHours = points / group.laborCostPerHour; // 円 ÷ 人件費 = 人・時間
    const value = personHours * (TIME_UNIT_MULTIPLIER[group.timeUnit] ?? 1);
    return `${value.toLocaleString("ja-JP")} ${TIME_UNIT_LABEL[group.timeUnit]}`;
  }
  return `${points} pt`;
}

type Quest = {
  id: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  questType: "GOVERNMENT" | "MEMBER";
  pointReward: number;
  creator: { id: string };
  completer: { id: string } | null;
};

type SubQuest = {
  id: string;
  title: string;
  status: "REQUESTED" | "ASSIGNED" | "CHANGE_PENDING" | "CHANGE_DENIED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  pointReward: number;
  quest: { id: string; title: string; group: { id: string } };
};

const QUEST_STATUS_LABEL: Record<Quest["status"], string> = {
  OPEN: "受付中",
  IN_PROGRESS: "進行中",
  COMPLETED: "完了",
  CANCELLED: "キャンセル",
};

const QUEST_STATUS_COLOR: Record<Quest["status"], string> = {
  OPEN: "bg-green-100 text-green-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-red-100 text-red-500",
};

const SUB_STATUS_LABEL: Record<SubQuest["status"], string> = {
  REQUESTED: "要請中",
  ASSIGNED: "アサイン済み",
  CHANGE_PENDING: "変更承認待ち",
  CHANGE_DENIED: "変更否認",
  IN_PROGRESS: "進行中",
  COMPLETED: "完了",
  CANCELLED: "キャンセル",
};

const SUB_STATUS_COLOR: Record<SubQuest["status"], string> = {
  REQUESTED: "bg-blue-100 text-blue-700",
  ASSIGNED: "bg-purple-100 text-purple-700",
  CHANGE_PENDING: "bg-orange-100 text-orange-700",
  CHANGE_DENIED: "bg-red-100 text-red-600",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-red-100 text-red-500",
};

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "管理人",
  LEADER: "管理側メンバー",
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
  const [quests, setQuests] = useState<Quest[]>([]);
  const [subQuests, setSubQuests] = useState<SubQuest[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/me").then((r) => r.ok ? r.json() : null),
      fetch("/api/groups").then((r) => r.ok ? r.json() : []),
      fetch(`/api/groups/${id}/quests`).then((r) => r.ok ? r.json() : []),
      fetch("/api/subquests").then((r) => r.ok ? r.json() : []),
    ]).then(([me, groups, questsData, subQuestsData]) => {
      if (me?.id) setMyUserId(me.id);
      if (Array.isArray(groups)) {
        const found = groups.find((g: Group) => g.id === id);
        setGroup(found ?? null);
      }
      if (Array.isArray(questsData)) setQuests(questsData);
      if (Array.isArray(subQuestsData)) setSubQuests(subQuestsData);
    }).catch((e) => console.error("データの取得に失敗しました", e));
  }, [id]);

  if (!group) return <div className="p-10 text-gray-500">読み込み中...</div>;

  const myMember = group.members.find((m) => m.user.id === myUserId);
  const myRole = myMember?.role ?? "MEMBER";

  // 受注中のクエスト（自分がcompleter）
  const myAcceptedQuests = myMember
    ? quests.filter((q) => q.completer?.id === myMember.id)
    : [];

  // このグループのアサイン済み・要請中サブクエスト
  const myActiveSubQuests = subQuests.filter(
    (sq) => sq.quest.group.id === id &&
      (sq.status === "ASSIGNED" || sq.status === "REQUESTED" || sq.status === "CHANGE_PENDING" || sq.status === "CHANGE_DENIED")
  );

  const totalMyItems = myAcceptedQuests.length + myActiveSubQuests.length;
  const displayedQuests = myAcceptedQuests.slice(0, 3);
  const displayedSubQuests = myActiveSubQuests.slice(0, 3);

  const memberPointsTotal = group.members.reduce((sum, m) => sum + m.memberPoints, 0);
  const allocatedQuestPoints = quests
    .filter((q) => q.questType === "GOVERNMENT" && (q.status === "OPEN" || q.status === "IN_PROGRESS"))
    .reduce((sum, q) => sum + q.pointReward, 0);
  const totalCirculating = memberPointsTotal + allocatedQuestPoints;

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
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-gray-800">{group.name}</h2>
            {myRole !== "MEMBER" && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[myRole]}`}>
                {ROLE_LABEL[myRole]}
              </span>
            )}
            <Link
              href={`/groups/${id}/analytics`}
              className="text-sm px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              分析
            </Link>
          </div>
        </section>

        {/* 自分の情報 ＋ クエスト提案 2列 */}
        {myMember && (
        <div className="grid grid-cols-2 gap-4 items-start">
          <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-gray-800">自分の情報</h3>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">保有ポイント</span>
              <span className="text-3xl font-bold text-blue-600">{formatPoint(myMember.memberPoints, group)}</span>
            </div>

            <div className="border-t border-gray-100 pt-4">
              {displayedQuests.length === 0 && displayedSubQuests.length === 0 ? (
                <p className="text-sm text-gray-400">進行中の案件・サブクエストはありません</p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {/* 左：受注中クエスト */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-500 mb-2">受注中の案件</p>
                    {displayedQuests.length === 0 ? (
                      <p className="text-xs text-gray-300">なし</p>
                    ) : (
                      displayedQuests.map((q) => (
                        <Link
                          key={q.id}
                          href={`/groups/${id}/quests/${q.id}`}
                          className="block px-3 py-2 rounded-lg hover:bg-gray-50 transition"
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${QUEST_STATUS_COLOR[q.status]}`}>
                              {QUEST_STATUS_LABEL[q.status]}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 truncate">{q.title}</p>
                          <p className="text-xs font-bold text-blue-600 mt-0.5">{formatPoint(q.pointReward, group)}</p>
                        </Link>
                      ))
                    )}
                  </div>

                  {/* 右：サブクエスト */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-500 mb-2">サブクエスト</p>
                    {displayedSubQuests.length === 0 ? (
                      <p className="text-xs text-gray-300">なし</p>
                    ) : (
                      displayedSubQuests.map((sq) => (
                        <Link
                          key={sq.id}
                          href={`/groups/${id}/quests/${sq.quest.id}/subquests/${sq.id}`}
                          className="block px-3 py-2 rounded-lg hover:bg-gray-50 transition"
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${SUB_STATUS_COLOR[sq.status]}`}>
                              {SUB_STATUS_LABEL[sq.status]}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 truncate">{sq.title}</p>
                          <p className="text-xs text-gray-400 truncate">{sq.quest.title}</p>
                          {sq.pointReward > 0 && (
                            <p className="text-xs font-bold text-blue-600 mt-0.5">{formatPoint(sq.pointReward, group)}</p>
                          )}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
              {totalMyItems > 3 && (
                <Link
                  href={`/groups/${id}/quests`}
                  className="block text-xs text-blue-500 hover:text-blue-700 text-right pt-2"
                >
                  すべて見る →
                </Link>
              )}
            </div>
          </section>

          <Link
            href={`/groups/${id}/quest-proposals`}
            className="block bg-white border border-gray-200 rounded-xl px-6 py-4 hover:shadow-md transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">管理者へのクエスト提案</p>
                <p className="text-xs text-gray-400 mt-0.5">メンバーからの提案一覧・審査承認</p>
              </div>
              <span className="text-gray-400">→</span>
            </div>
          </Link>
        </div>
        )}

        {/* クエストへのリンク */}
        <Link
          href={`/groups/${id}/quests`}
          className="block bg-white border border-gray-200 rounded-xl px-6 py-4 hover:shadow-md transition"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800">クエスト</p>
              <p className="text-xs text-gray-400 mt-0.5">管理側案件・メンバー案件の一覧と発行</p>
            </div>
            <span className="text-gray-400">→</span>
          </div>
        </Link>

        {/* グループ設定（全員閲覧可・ADMIN/LEADERは編集可） */}
        {myMember && (
          <GroupSettingsSection
            groupId={id}
            canEdit={myRole === "ADMIN" || myRole === "LEADER"}
            proposalReward={group.proposalReward}
            onProposalRewardUpdated={(v) => setGroup((prev) => prev ? { ...prev, proposalReward: v } : prev)}
          />
        )}

        {/* 管理側発行済みポイント管理（ADMIN/LEADERのみ） */}
        {group.totalIssuedPoints !== undefined && (
          <IssuedPointsEditor
            groupId={id}
            totalIssuedPoints={group.totalIssuedPoints}
            totalCirculating={totalCirculating}
            isAdmin={myRole === "ADMIN"}
            group={group}
            onUpdated={(v) => setGroup((prev) => prev ? { ...prev, totalIssuedPoints: v } : prev)}
            onSettingsUpdated={(settings) => setGroup((prev) => prev ? { ...prev, ...settings } : prev)}
          />
        )}

        {/* ポイント付与（ADMINのみ） */}
        {myRole === "ADMIN" && (
          <GrantPointsSection
            groupId={id}
            members={group.members}
            group={group}
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

        {/* メンバー一覧（全員） */}
        <MemberSection
          title="メンバー"
          members={[...group.members].sort((a, b) => {
            const order = { ADMIN: 0, LEADER: 1, MEMBER: 2 };
            return order[a.role] - order[b.role];
          })}
          groupId={id}
          canDelete={canDelete}
          onRemoved={removeMember}
          inviteLeaderRole={myRole === "ADMIN" ? "LEADER" : undefined}
          inviteMemberRole={myRole === "ADMIN" || myRole === "LEADER" ? "MEMBER" : undefined}
          pointGroup={group}
        />
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
  inviteLeaderRole,
  inviteMemberRole,
  pointGroup,
}: {
  title: string;
  members: Member[];
  groupId: string;
  canDelete: (m: Member) => boolean;
  onRemoved: (id: string) => void;
  inviteLeaderRole?: "LEADER";
  inviteMemberRole?: "MEMBER";
  pointGroup: Pick<Group, "pointUnit" | "laborCostPerHour" | "timeUnit">;
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
              pointGroup={pointGroup}
            />
          ))}
        </ul>
      )}
      {inviteLeaderRole && <InviteForm groupId={groupId} role={inviteLeaderRole} />}
      {inviteMemberRole && <InviteForm groupId={groupId} role={inviteMemberRole} />}
    </section>
  );
}

function MemberRow({
  member,
  groupId,
  deletable,
  onRemoved,
  pointGroup,
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
        <span className="text-sm font-medium text-gray-800">
          {member.user.name ?? member.user.email}
        </span>
        {member.user.name && (
          <span className="text-xs text-gray-400">{member.user.email}</span>
        )}
        {member.role !== "MEMBER" && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_BADGE[member.role]}`}>
            {ROLE_LABEL[member.role]}
          </span>
        )}
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

function InviteForm({ groupId, role }: { groupId: string; role: "LEADER" | "MEMBER" }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const label = role === "LEADER" ? "管理側メンバーを招待" : "一般メンバーを招待";

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
  group,
  onUpdated,
  onSettingsUpdated,
}: {
  groupId: string;
  totalIssuedPoints: number;
  totalCirculating: number;
  isAdmin: boolean;
  group: Pick<Group, "pointUnit" | "laborCostPerHour" | "timeUnit">;
  onUpdated: (v: number) => void;
  onSettingsUpdated: (s: Partial<Pick<Group, "pointUnit" | "laborCostPerHour" | "timeUnit">>) => void;
}) {
  const reclaimable = totalIssuedPoints - totalCirculating;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pointUnit, setPointUnit] = useState(group.pointUnit);
  const [laborCost, setLaborCost] = useState(group.laborCostPerHour);
  const [timeUnit, setTimeUnit] = useState(group.timeUnit);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");

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

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsError("");
    setSettingsSaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointUnit, laborCostPerHour: laborCost, timeUnit }),
      });
      const data = await res.json();
      if (!res.ok) { setSettingsError(data.error ?? "エラーが発生しました"); return; }
      onSettingsUpdated({ pointUnit: data.pointUnit, laborCostPerHour: data.laborCostPerHour, timeUnit: data.timeUnit });
      setSettingsOpen(false);
    } finally {
      setSettingsSaving(false);
    }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">管理側発行済みポイント</h3>
        {isAdmin && (
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 transition"
          >
            表示設定
          </button>
        )}
      </div>

      {/* 表示設定パネル */}
      {settingsOpen && (
        <form onSubmit={saveSettings} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-xs font-medium text-gray-600">表示・人件費設定</p>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <p className="text-xs text-gray-500 mb-1">表示単位</p>
              <div className="flex gap-2">
                {(["pt", "円"] as const).map((u) => (
                  <label key={u} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="radio" checked={pointUnit === u} onChange={() => setPointUnit(u)} />
                    {u}
                  </label>
                ))}
              </div>
            </div>
            {pointUnit === "円" && (
              <div>
                <p className="text-xs text-gray-500 mb-1">表示形式</p>
                <select
                  value={timeUnit}
                  onChange={(e) => setTimeUnit(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {Object.entries(TIME_UNIT_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            )}
            {pointUnit === "円" && timeUnit !== "YEN" && (
              <div>
                <p className="text-xs text-gray-500 mb-1">人件費（円/時間）</p>
                <input
                  type="number"
                  min={0}
                  value={laborCost || ""}
                  onChange={(e) => setLaborCost(Number(e.target.value))}
                  placeholder="例: 1200"
                  className="w-32 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={settingsSaving}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {settingsSaving ? "保存中..." : "保存"}
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                キャンセル
              </button>
            </div>
          </div>
          {pointUnit === "円" && (
            <p className="text-xs text-gray-400">
              例: 1200 pt → {formatPoint(1200, { pointUnit: "円", laborCostPerHour: laborCost, timeUnit })}
            </p>
          )}
          {settingsError && <p className="text-xs text-red-600">{settingsError}</p>}
        </form>
      )}

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
            <p className="text-2xl font-bold text-gray-800">{formatPoint(totalIssuedPoints, group)}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs mb-0.5">流通中</p>
            <p className="text-2xl font-bold text-blue-600">{formatPoint(totalCirculating, group)}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs mb-0.5">未流通（回収可能）</p>
            <p className="text-2xl font-bold text-green-600">{formatPoint(Math.max(reclaimable, 0), group)}</p>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
          <DeltaForm
            label="追加発行"
            buttonLabel="発行する"
            buttonClass="bg-blue-600 hover:bg-blue-700"
            sign={1}
            onSubmit={sendDelta}
            group={group}
          />
          <DeltaForm
            label={`回収（最大 ${formatPoint(Math.max(reclaimable, 0), group)}）`}
            buttonLabel="回収する"
            buttonClass="bg-red-500 hover:bg-red-600"
            maxPt={reclaimable}
            sign={-1}
            onSubmit={sendDelta}
            group={group}
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
  group,
}: {
  groupId: string;
  members: Member[];
  onGranted: (memberId: string | null, amount: number) => void;
  group: Pick<Group, "pointUnit" | "laborCostPerHour" | "timeUnit">;
}) {
  const [mode, setMode] = useState<"individual" | "multiple" | "all">("individual");
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id ?? "");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [amount, setAmount] = useState(0);
  const [selectedInputUnit, setSelectedInputUnit] = useState(group.timeUnit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function toggleMemberId(id: string) {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // 入力単位の切り替えが可能か（円表示 & 人件費設定済みの場合）
  const canSelectUnit = group.pointUnit === "円" && group.laborCostPerHour > 0;
  // 現在選択中の単位でのグループ設定（変換に使用）
  const inputGroup = { ...group, timeUnit: canSelectUnit ? selectedInputUnit : group.timeUnit };
  const unitLabel = inputUnitLabel(inputGroup);
  const isDecimalUnit = inputGroup.pointUnit === "円" && inputGroup.timeUnit !== "YEN" && inputGroup.laborCostPerHour > 0;
  const step = isDecimalUnit ? 0.01 : 1;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (amount <= 0) return;
    const ptAmount = unitToPt(amount, inputGroup);
    setSubmitting(true);
    try {
      const body: { amount: number; memberId?: string; memberIds?: string[] } = { amount: ptAmount };
      if (mode === "individual") body.memberId = selectedMemberId;
      if (mode === "multiple") body.memberIds = selectedMemberIds;
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
        onGranted(selectedMemberId, ptAmount);
        setSuccess(`${amount} ${unitLabel} を付与しました`);
      } else if (mode === "multiple") {
        onGranted(null, ptAmount);
        setSuccess(`${data.memberCount}人に ${amount} ${unitLabel} を付与しました（合計 ${data.totalGranted} pt）`);
        setSelectedMemberIds([]);
      } else {
        onGranted(null, ptAmount);
        setSuccess(`全員に ${amount} ${unitLabel} を付与しました（合計 ${data.totalGranted} pt）`);
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
          <input type="radio" checked={mode === "individual"} onChange={() => setMode("individual")} />
          個人に付与
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="radio" checked={mode === "multiple"} onChange={() => { setMode("multiple"); setSelectedMemberIds([]); }} />
          複数人に付与
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="radio" checked={mode === "all"} onChange={() => setMode("all")} />
          全員に付与
        </label>
      </div>

      {mode === "multiple" && (
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-1.5 cursor-pointer text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:border-blue-400 transition">
              <input
                type="checkbox"
                checked={selectedMemberIds.includes(m.id)}
                onChange={() => toggleMemberId(m.id)}
                className="rounded"
              />
              {m.user.name ?? m.user.email}
            </label>
          ))}
          {selectedMemberIds.length > 0 && (
            <span className="text-xs text-gray-400 self-center">{selectedMemberIds.length}人選択中</span>
          )}
        </div>
      )}

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
                  {m.user.name ?? m.user.email}（{formatPoint(m.memberPoints, group)}）
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
              min={step}
              step={step}
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder={unitLabel}
              className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
            {canSelectUnit ? (
              <select
                value={selectedInputUnit}
                onChange={(e) => { setSelectedInputUnit(e.target.value); setAmount(0); }}
                className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {Object.entries(TIME_UNIT_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-gray-500">{unitLabel}</span>
            )}
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
  maxPt,
  sign,
  onSubmit,
  group,
}: {
  label: string;
  buttonLabel: string;
  buttonClass: string;
  maxPt?: number;
  sign: 1 | -1;
  onSubmit: (delta: number, amount: number, setError: (e: string) => void, setSaving: (b: boolean) => void, setAmount: (v: number) => void) => void;
  group: Pick<Group, "pointUnit" | "laborCostPerHour" | "timeUnit">;
}) {
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const unitLabel = inputUnitLabel(group);
  const isDecimalUnit = group.pointUnit === "円" && group.timeUnit !== "YEN" && group.laborCostPerHour > 0;
  const step = isDecimalUnit ? 0.01 : 1;
  const displayMax = maxPt !== undefined ? ptToUnit(maxPt, group) : undefined;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (amount <= 0) return;
    const ptAmount = unitToPt(amount, group);
    onSubmit(sign * ptAmount, ptAmount, setError, setSaving, setAmount);
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <input
          type="number"
          min={step}
          max={displayMax}
          step={step}
          value={amount || ""}
          onChange={(e) => setAmount(Number(e.target.value))}
          placeholder={unitLabel}
          className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          required
        />
        <span className="text-sm text-gray-500">{unitLabel}</span>
        <button
          type="submit"
          disabled={saving || (maxPt !== undefined && maxPt <= 0)}
          className={`px-4 py-2 text-white text-sm rounded-lg disabled:opacity-50 transition ${buttonClass}`}
        >
          {saving ? "..." : buttonLabel}
        </button>
      </form>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─── グループ設定セクション ───────────────────────────────────────────
// 全メンバーが閲覧可能。canEdit=true のとき（ADMIN/LEADER）は編集も可能。
// 今後グループ単位の設定が増えた場合はこのセクション内に追加する。

function GroupSettingsSection({
  groupId,
  canEdit,
  proposalReward,
  onProposalRewardUpdated,
}: {
  groupId: string;
  canEdit: boolean;
  proposalReward: number;
  onProposalRewardUpdated: (v: number) => void;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      <h3 className="font-semibold text-gray-800">グループ設定</h3>

      {/* 提案報酬 */}
      <SettingRow
        label="クエスト提案報酬"
        description="提案が承認されたときに提案者へ付与する一律ポイント"
        canEdit={canEdit}
        displayValue={`${proposalReward} pt`}
        editForm={(onClose) => (
          <ProposalRewardForm
            groupId={groupId}
            current={proposalReward}
            onSaved={(v) => { onProposalRewardUpdated(v); onClose(); }}
            onCancel={onClose}
          />
        )}
      />

      {/* 今後の設定はここに <SettingRow ... /> を追加する */}
    </section>
  );
}

function SettingRow({
  label,
  description,
  canEdit,
  displayValue,
  editForm,
}: {
  label: string;
  description: string;
  canEdit: boolean;
  displayValue: string;
  editForm: (onClose: () => void) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">{label}</p>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-blue-600">{displayValue}</span>
          {canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-gray-400 hover:text-gray-600 transition border border-gray-200 rounded px-2 py-0.5"
            >
              変更
            </button>
          )}
        </div>
      </div>
      {editing && editForm(() => setEditing(false))}
    </div>
  );
}

function ProposalRewardForm({
  groupId,
  current,
  onSaved,
  onCancel,
}: {
  groupId: string;
  current: number;
  onSaved: (v: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalReward: value }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "エラーが発生しました"); return; }
      onSaved(data.proposalReward);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        required
      />
      <span className="text-sm text-gray-500">pt</span>
      <button
        type="submit"
        disabled={saving}
        className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {saving ? "保存中..." : "保存"}
      </button>
      <button type="button" onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600 transition">
        キャンセル
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}

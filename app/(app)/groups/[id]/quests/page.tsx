"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useOnboarding } from "@/lib/onboarding-context";
import Link from "next/link";
import { formatPoint, unitLabel, type PointGroup } from "@/lib/pointFormat";
import UserAvatar from "@/app/components/UserAvatar";

type Role = "ADMIN" | "LEADER" | "MEMBER";

type QuestUser = { id: string; name: string | null; email: string };
type QuestMember = { id: string; user: QuestUser };

type Quest = {
  id: string;
  title: string;
  description: string | null;
  pointReward: number;
  questType: "GOVERNMENT" | "MEMBER";
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  creator: QuestMember;
  completer: QuestMember | null;
  deadline: string | null;
  createdAt: string;
};

type GroupMember = {
  id: string;
  role: Role;
  memberPoints: number;
  user: QuestUser;
};

const STATUS_LABEL: Record<Quest["status"], string> = {
  OPEN: "受付中",
  IN_PROGRESS: "進行中",
  COMPLETED: "完了",
  CANCELLED: "キャンセル",
};

const STATUS_COLOR: Record<Quest["status"], string> = {
  OPEN: "bg-green-100 text-green-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-red-100 text-red-500",
};

const DEFAULT_POINT_GROUP: PointGroup = { pointUnit: "pt", laborCostPerHour: 0, timeUnit: "HOUR" };

export default function QuestsPage() {
  const { id: groupId } = useParams<{ id: string }>();
  const onboarding = useOnboarding();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [myMember, setMyMember] = useState<GroupMember | null>(null);
  const [pointGroup, setPointGroup] = useState<PointGroup>(DEFAULT_POINT_GROUP);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | Quest["status"]>("IN_PROGRESS");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "GOVERNMENT" | "MEMBER">("ALL");

  useEffect(() => {
    Promise.all([
      fetch(`/api/groups/${groupId}/quests`).then((r) => r.ok ? r.json() : []),
      fetch("/api/me").then((r) => r.ok ? r.json() : null),
      fetch("/api/groups").then((r) => r.ok ? r.json() : []),
    ]).then(([questData, me, groups]) => {
      if (Array.isArray(questData)) setQuests(questData);
      if (me?.id && Array.isArray(groups)) {
        const group = groups.find((g: { id: string; members: GroupMember[]; pointUnit: string; laborCostPerHour: number; timeUnit: string }) => g.id === groupId);
        if (group) {
          setPointGroup({ pointUnit: group.pointUnit, laborCostPerHour: group.laborCostPerHour, timeUnit: group.timeUnit });
          const member = group.members.find((m: GroupMember) => m.user.id === me.id);
          if (member) setMyMember(member);
        }
      }
    });
  }, [groupId]);

  const canCreateGov = myMember?.role === "ADMIN" || myMember?.role === "LEADER";

  const filtered = quests.filter(
    (q) =>
      (typeFilter === "ALL" || q.questType === typeFilter) &&
      (statusFilter === "ALL" || q.status === statusFilter)
  );

  return (
    <div>
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-bold text-gray-800">クエスト一覧</h2>
          <div className="flex flex-wrap gap-2">
            {(["IN_PROGRESS", "OPEN", "COMPLETED", "CANCELLED", "ALL"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs rounded-full border transition ${
                  statusFilter === s
                    ? "bg-blue-600 text-white border-blue-600"
                    : "text-gray-600 border-gray-300 hover:border-blue-400"
                }`}
              >
                {s === "ALL" ? "すべて" : STATUS_LABEL[s]}
              </button>
            ))}
            <span className="w-px bg-gray-200 mx-1" />
            {(["ALL", "GOVERNMENT", "MEMBER"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`px-3 py-1.5 text-xs rounded-full border transition ${
                  typeFilter === f
                    ? "bg-blue-600 text-white border-blue-600"
                    : "text-gray-600 border-gray-300 hover:border-blue-400"
                }`}
              >
                {f === "ALL" ? "種別：すべて" : f === "GOVERNMENT" ? "管理側案件" : "メンバー案件"}
              </button>
            ))}
            {myMember && (
              <button
                onClick={() => setShowForm(true)}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-full hover:bg-blue-700 transition"
              >
                + 発行
              </button>
            )}
          </div>
        </div>

        {/* 保有ポイント表示 */}
        {myMember && (
          <p className="text-sm text-gray-500">
            あなたの保有ポイント: <strong className="text-gray-800">{formatPoint(myMember.memberPoints, pointGroup)}</strong>
          </p>
        )}

        {/* 発行フォーム */}
        {showForm && myMember && (
          <CreateQuestForm
            groupId={groupId}
            canCreateGov={canCreateGov}
            myPoints={myMember.memberPoints}
            pointGroup={pointGroup}
            onCreated={(q) => {
              setQuests((prev) => [q, ...prev]);
              setShowForm(false);
              setTypeFilter(q.questType);
              if (onboarding?.step === "create-quest") onboarding.onQuestCreated();
              if (q.questType === "MEMBER") {
                setMyMember((prev) => prev ? { ...prev, memberPoints: prev.memberPoints - q.pointReward } : prev);
              }
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* クエスト一覧 */}
        {filtered.length === 0 ? (
          <p className="text-gray-400 text-sm py-8 text-center">該当するクエストがありません</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((q) => <QuestCard key={q.id} quest={q} groupId={groupId} pointGroup={pointGroup} />)}
          </ul>
        )}
      </main>
    </div>
  );
}

function QuestCard({ quest, groupId, pointGroup }: { quest: Quest; groupId: string; pointGroup: PointGroup }) {
  const isOverdue = quest.deadline && quest.status !== "COMPLETED" && quest.status !== "CANCELLED"
    && new Date(quest.deadline) < new Date();

  return (
    <li>
      <Link
        href={`/groups/${groupId}/quests/${quest.id}`}
        className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center justify-between gap-4 hover:shadow-md hover:border-blue-200 transition"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[quest.status]}`}>
              {STATUS_LABEL[quest.status]}
            </span>
            <span className="text-xs text-gray-400">
              {quest.questType === "GOVERNMENT" ? "管理側案件" : "メンバー案件"}
            </span>
            {quest.deadline && (
              <span className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
                期限: {new Date(quest.deadline).toLocaleDateString("ja-JP")}
                {isOverdue && "（超過）"}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-800 truncate">{quest.title}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <UserAvatar userId={quest.creator.user.id} name={quest.creator.user.name} />
            <span className="text-xs text-gray-400">{quest.creator.user.name ?? quest.creator.user.email}</span>
          </div>
        </div>
        <p className="text-base font-bold text-blue-600 shrink-0">{formatPoint(quest.pointReward, pointGroup)}</p>
      </Link>
    </li>
  );
}

function CreateQuestForm({
  groupId,
  canCreateGov,
  myPoints,
  pointGroup,
  onCreated,
  onCancel,
}: {
  groupId: string;
  canCreateGov: boolean;
  myPoints: number;
  pointGroup: PointGroup;
  onCreated: (q: Quest) => void;
  onCancel: () => void;
}) {
  const [questType, setQuestType] = useState<"GOVERNMENT" | "MEMBER">(
    canCreateGov ? "GOVERNMENT" : "MEMBER"
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pointReward, setPointReward] = useState(0);
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const label = unitLabel(pointGroup);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/quests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, pointReward, questType, deadline: deadline || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "エラーが発生しました");
        return;
      }
      onCreated(data);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white border border-blue-200 rounded-xl p-6 space-y-4">
      <h3 className="font-semibold text-gray-800">クエストを発行</h3>

      {/* 案件種別 */}
      <div className="flex gap-3">
        {canCreateGov && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="GOVERNMENT"
              checked={questType === "GOVERNMENT"}
              onChange={() => setQuestType("GOVERNMENT")}
            />
            <span className="text-sm">管理側案件</span>
          </label>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            value="MEMBER"
            checked={questType === "MEMBER"}
            onChange={() => setQuestType("MEMBER")}
          />
          <span className="text-sm">メンバー案件</span>
        </label>
      </div>

      {questType === "MEMBER" && (
        <p className="text-xs text-gray-400">
          ※ 報酬は作成時にあなたの保有ポイント（{formatPoint(myPoints, pointGroup)}）から引き落とされます
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="タイトル"
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          required
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="説明（任意）"
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
        />
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={pointReward || ""}
            onChange={(e) => setPointReward(Number(e.target.value))}
            placeholder="報酬"
            min={1}
            max={questType === "MEMBER" ? myPoints : undefined}
            className="w-32 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
          <span className="text-sm text-gray-500">{label}</span>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">デッドライン（任意）</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {submitting ? "発行中..." : "発行する"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 text-sm text-gray-500 hover:text-gray-700 transition"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}

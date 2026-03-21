"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

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

export default function QuestsPage() {
  const { id: groupId } = useParams<{ id: string }>();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [myMember, setMyMember] = useState<GroupMember | null>(null);
  const [tab, setTab] = useState<"GOVERNMENT" | "MEMBER">("GOVERNMENT");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/groups/${groupId}/quests`).then((r) => r.ok ? r.json() : []),
      fetch("/api/me").then((r) => r.ok ? r.json() : null),
      fetch("/api/groups").then((r) => r.ok ? r.json() : []),
    ]).then(([questData, me, groups]) => {
      if (Array.isArray(questData)) setQuests(questData);
      if (me?.id && Array.isArray(groups)) {
        const group = groups.find((g: { id: string; members: GroupMember[] }) => g.id === groupId);
        const member = group?.members.find((m: GroupMember) => m.user.id === me.id);
        if (member) setMyMember(member);
      }
    });
  }, [groupId]);

  const canCreateGov = myMember?.role === "ADMIN" || myMember?.role === "LEADER";
  const filtered = quests.filter((q) => q.questType === tab);

  return (
    <div>
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">クエスト一覧</h2>
          {myMember && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
            >
              + クエストを発行
            </button>
          )}
        </div>

        {/* 保有ポイント表示 */}
        {myMember && (
          <p className="text-sm text-gray-500">
            あなたの保有ポイント: <strong className="text-gray-800">{myMember.memberPoints} pt</strong>
          </p>
        )}

        {/* 発行フォーム */}
        {showForm && myMember && (
          <CreateQuestForm
            groupId={groupId}
            canCreateGov={canCreateGov}
            myPoints={myMember.memberPoints}
            onCreated={(q) => {
              setQuests((prev) => [q, ...prev]);
              setShowForm(false);
              setTab(q.questType);
              // メンバー案件の場合は自分のポイントを更新
              if (q.questType === "MEMBER") {
                setMyMember((prev) => prev ? { ...prev, memberPoints: prev.memberPoints - q.pointReward } : prev);
              }
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* タブ */}
        <div className="flex gap-2 border-b border-gray-200">
          {(["GOVERNMENT", "MEMBER"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                tab === t
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "GOVERNMENT" ? "政府案件" : "メンバー案件"}
              <span className="ml-1.5 text-xs text-gray-400">
                {quests.filter((q) => q.questType === t).length}
              </span>
            </button>
          ))}
        </div>

        {/* クエスト一覧 */}
        {filtered.length === 0 ? (
          <p className="text-gray-400 text-sm py-8 text-center">クエストがありません</p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((q) => <QuestCard key={q.id} quest={q} groupId={groupId} />)}
          </ul>
        )}
      </main>
    </div>
  );
}

function QuestCard({ quest, groupId }: { quest: Quest; groupId: string }) {
  const isOverdue = quest.deadline && quest.status !== "COMPLETED" && quest.status !== "CANCELLED"
    && new Date(quest.deadline) < new Date();

  return (
    <li className="bg-white border border-gray-200 rounded-xl px-6 py-4 hover:shadow-md transition">
      <Link href={`/groups/${groupId}/quests/${quest.id}`} className="block">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[quest.status]}`}>
                {STATUS_LABEL[quest.status]}
              </span>
              <span className="text-xs text-gray-400">
                by {quest.creator.user.name ?? quest.creator.user.email}
              </span>
            </div>
            <p className="font-medium text-gray-800">{quest.title}</p>
            {quest.description && (
              <p className="text-sm text-gray-500 mt-1">{quest.description}</p>
            )}
            {quest.deadline && (
              <p className={`text-xs mt-1 ${isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
                期限: {new Date(quest.deadline).toLocaleDateString("ja-JP")}
                {isOverdue && "（期限超過）"}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-blue-600">{quest.pointReward} pt</p>
          </div>
        </div>
      </Link>
    </li>
  );
}

function CreateQuestForm({
  groupId,
  canCreateGov,
  myPoints,
  onCreated,
  onCancel,
}: {
  groupId: string;
  canCreateGov: boolean;
  myPoints: number;
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
            <span className="text-sm">政府案件</span>
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
          ※ 報酬は作成時にあなたの保有ポイント（{myPoints} pt）から引き落とされます
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
          <span className="text-sm text-gray-500">pt</span>
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

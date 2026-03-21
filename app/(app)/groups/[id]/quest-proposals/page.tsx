"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Role = "ADMIN" | "LEADER" | "MEMBER";

type ProposalUser = { id: string; name: string | null; email: string };
type ProposalMember = { id: string; user: ProposalUser };

type QuestProposal = {
  id: string;
  title: string;
  description: string | null;
  pointReward: number;
  deadline: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectReason: string | null;
  proposer: ProposalMember;
  createdAt: string;
};

type GroupMember = {
  id: string;
  role: Role;
  memberPoints: number;
  user: ProposalUser;
};

const STATUS_LABEL: Record<QuestProposal["status"], string> = {
  PENDING: "審査中",
  APPROVED: "承認済み",
  REJECTED: "却下",
};

const STATUS_COLOR: Record<QuestProposal["status"], string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-500",
};

export default function QuestProposalsPage() {
  const { id: groupId } = useParams<{ id: string }>();
  const [proposals, setProposals] = useState<QuestProposal[]>([]);
  const [myMember, setMyMember] = useState<GroupMember | null>(null);
  const [tab, setTab] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [showForm, setShowForm] = useState(false);

  const isAdmin = myMember?.role === "ADMIN" || myMember?.role === "LEADER";
  const isMemberOnly = myMember?.role === "MEMBER";

  useEffect(() => {
    Promise.all([
      fetch(`/api/groups/${groupId}/quest-proposals`).then((r) => r.ok ? r.json() : []),
      fetch("/api/me").then((r) => r.ok ? r.json() : null),
      fetch("/api/groups").then((r) => r.ok ? r.json() : []),
    ]).then(([proposalData, me, groups]) => {
      if (Array.isArray(proposalData)) setProposals(proposalData);
      if (me?.id && Array.isArray(groups)) {
        const group = groups.find((g: { id: string; members: GroupMember[] }) => g.id === groupId);
        const member = group?.members.find((m: GroupMember) => m.user.id === me.id);
        if (member) setMyMember(member);
      }
    });
  }, [groupId]);

  const filtered = proposals.filter((p) => p.status === tab);

  function onProposalCreated(p: QuestProposal) {
    setProposals((prev) => [p, ...prev]);
    setShowForm(false);
    setTab("PENDING");
  }

  function onApproved(proposalId: string, updatedProposal: QuestProposal) {
    setProposals((prev) =>
      prev.map((p) => (p.id === proposalId ? updatedProposal : p))
    );
    setTab("APPROVED");
  }

  function onRejected(proposalId: string, updatedProposal: QuestProposal) {
    setProposals((prev) =>
      prev.map((p) => (p.id === proposalId ? updatedProposal : p))
    );
    setTab("REJECTED");
  }

  return (
    <div>
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">公共事業クエスト提案</h2>
            <p className="text-sm text-gray-500 mt-1">
              市民からの公共事業クエスト提案一覧です。政府関係者が審査・承認します。
            </p>
          </div>
          {isMemberOnly && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
            >
              + 提案する
            </button>
          )}
        </div>

        {/* 提案フォーム（MEMBERのみ） */}
        {showForm && isMemberOnly && (
          <CreateProposalForm
            groupId={groupId}
            onCreated={onProposalCreated}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* タブ */}
        <div className="flex gap-2 border-b border-gray-200">
          {(["PENDING", "APPROVED", "REJECTED"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                tab === t
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {STATUS_LABEL[t]}
              <span className="ml-1.5 text-xs text-gray-400">
                {proposals.filter((p) => p.status === t).length}
              </span>
            </button>
          ))}
        </div>

        {/* 提案一覧 */}
        {filtered.length === 0 ? (
          <p className="text-gray-400 text-sm py-8 text-center">提案がありません</p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                groupId={groupId}
                isAdmin={isAdmin}
                onApproved={onApproved}
                onRejected={onRejected}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function ProposalCard({
  proposal,
  groupId,
  isAdmin,
  onApproved,
  onRejected,
}: {
  proposal: QuestProposal;
  groupId: string;
  isAdmin: boolean;
  onApproved: (id: string, p: QuestProposal) => void;
  onRejected: (id: string, p: QuestProposal) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approvePoints, setApprovePoints] = useState(proposal.pointReward);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleApprove() {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/quest-proposals/${proposal.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointReward: approvePoints }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "エラーが発生しました");
        return;
      }
      onApproved(proposal.id, data.proposal);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/quest-proposals/${proposal.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "エラーが発生しました");
        return;
      }
      onRejected(proposal.id, data);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="bg-white border border-gray-200 rounded-xl px-6 py-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[proposal.status]}`}>
              {STATUS_LABEL[proposal.status]}
            </span>
            <span className="text-xs text-gray-400">
              提案者: {proposal.proposer.user.name ?? proposal.proposer.user.email}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(proposal.createdAt).toLocaleDateString("ja-JP")}
            </span>
          </div>
          <p className="font-medium text-gray-800">{proposal.title}</p>
          {proposal.description && (
            <p className="text-sm text-gray-500 mt-1">{proposal.description}</p>
          )}
          {proposal.deadline && (
            <p className="text-xs text-gray-400 mt-1">
              希望期限: {new Date(proposal.deadline).toLocaleDateString("ja-JP")}
            </p>
          )}
          {proposal.status === "REJECTED" && proposal.rejectReason && (
            <p className="text-xs text-red-500 mt-1 bg-red-50 px-2 py-1 rounded">
              却下理由: {proposal.rejectReason}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-blue-600">{proposal.pointReward} pt</p>
          <p className="text-xs text-gray-400">希望報酬</p>
        </div>
      </div>

      {/* 承認/却下アクション（ADMIN/LEADERのみ、PENDINGのみ） */}
      {isAdmin && proposal.status === "PENDING" && (
        <div className="border-t border-gray-100 pt-3">
          {!showActions ? (
            <button
              onClick={() => setShowActions(true)}
              className="text-sm text-blue-600 hover:text-blue-800 transition"
            >
              審査する
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">承認時の報酬ポイント</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={approvePoints}
                      onChange={(e) => setApprovePoints(Number(e.target.value))}
                      min={1}
                      className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <span className="text-sm text-gray-500">pt</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">却下理由（却下時のみ任意）</label>
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="例: 予算不足、範囲外など"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleApprove}
                  disabled={submitting}
                  className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                >
                  承認してクエスト発行
                </button>
                <button
                  onClick={handleReject}
                  disabled={submitting}
                  className="px-4 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50 transition"
                >
                  却下
                </button>
                <button
                  onClick={() => { setShowActions(false); setError(""); }}
                  className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function CreateProposalForm({
  groupId,
  onCreated,
  onCancel,
}: {
  groupId: string;
  onCreated: (p: QuestProposal) => void;
  onCancel: () => void;
}) {
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
      const res = await fetch(`/api/groups/${groupId}/quest-proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, pointReward, deadline: deadline || undefined }),
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
      <div>
        <h3 className="font-semibold text-gray-800">公共事業クエストを提案</h3>
        <p className="text-xs text-gray-500 mt-1">
          政府関係者が審査し、承認されると正式なクエストとして発行されます
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="提案タイトル（例: 駅前の歩道整備）"
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          required
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="提案内容・背景・必要性など（任意）"
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
        />
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={pointReward || ""}
            onChange={(e) => setPointReward(Number(e.target.value))}
            placeholder="希望報酬"
            min={1}
            className="w-32 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
          <span className="text-sm text-gray-500">pt（政府が調整する場合あり）</span>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">希望期限（任意）</label>
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
            {submitting ? "提案中..." : "提案する"}
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

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import UserAvatar from "@/app/components/UserAvatar";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function parseJson(res: Response): Promise<any> {
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

type Role = "ADMIN" | "LEADER" | "MEMBER";

type ProposalUser = { id: string; name: string | null; email: string };
type ProposalMember = { id: string; user: ProposalUser };

type QuestProposal = {
  id: string;
  title: string;
  description: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectReason: string | null;
  questId: string | null;
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
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | QuestProposal["status"]>("PENDING");

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

  const filtered = proposals.filter(
    (p) => statusFilter === "ALL" || p.status === statusFilter
  );

  function onProposalCreated(p: QuestProposal) {
    setProposals((prev) => [p, ...prev]);
    setShowForm(false);
    setStatusFilter("PENDING");
  }

  function onApproved(proposalId: string, updatedProposal: QuestProposal) {
    setProposals((prev) =>
      prev.map((p) => (p.id === proposalId ? updatedProposal : p))
    );
  }

  function onRejected(proposalId: string, updatedProposal: QuestProposal) {
    setProposals((prev) =>
      prev.map((p) => (p.id === proposalId ? updatedProposal : p))
    );
  }

  return (
    <div>
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-bold text-gray-800">管理者へのクエスト提案</h2>
          <div className="flex flex-wrap gap-2">
            {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((s) => (
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
                {s !== "ALL" && (
                  <span className="ml-1 opacity-70">
                    {proposals.filter((p) => p.status === s).length}
                  </span>
                )}
              </button>
            ))}
            {isMemberOnly && (
              <>
                <span className="w-px bg-gray-200 mx-1" />
                <button
                  onClick={() => setShowForm(true)}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-full hover:bg-blue-700 transition"
                >
                  + 提案する
                </button>
              </>
            )}
          </div>
        </div>

        {/* 提案フォーム（MEMBERのみ） */}
        {showForm && isMemberOnly && (
          <CreateProposalForm
            groupId={groupId}
            onCreated={onProposalCreated}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* 提案一覧 */}
        {filtered.length === 0 ? (
          <p className="text-gray-400 text-sm py-8 text-center">該当する提案がありません</p>
        ) : (
          <ul className="space-y-2">
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
  const [approveTitle, setApproveTitle] = useState(proposal.title);
  const [approveDescription, setApproveDescription] = useState(proposal.description ?? "");
  const [approvePoints, setApprovePoints] = useState(0);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleApprove() {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/quest-proposals/${proposal.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: approveTitle, description: approveDescription, pointReward: approvePoints }),
      });
      const data = await parseJson(res);
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
      const data = await parseJson(res);
      if (!res.ok) {
        setError(data.error ?? "エラーが発生しました");
        return;
      }
      onRejected(proposal.id, data);
    } finally {
      setSubmitting(false);
    }
  }

  const cardContent = (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-0.5">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[proposal.status]}`}>
          {STATUS_LABEL[proposal.status]}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <UserAvatar userId={proposal.proposer?.user?.id} name={proposal.proposer?.user?.name ?? null} />
          {proposal.proposer?.user?.name ?? proposal.proposer?.user?.email ?? "不明"}
        </span>
        <span className="text-xs text-gray-400">
          {new Date(proposal.createdAt).toLocaleDateString("ja-JP")}
        </span>
      </div>
      <p className="text-sm font-medium text-gray-800 truncate">{proposal.title}</p>
      {proposal.status === "REJECTED" && proposal.rejectReason && (
        <p className="text-xs text-red-500 mt-1">却下理由: {proposal.rejectReason}</p>
      )}
    </div>
  );

  return (
    <li className="bg-white border border-gray-200 rounded-xl px-5 py-3 hover:shadow-md hover:border-blue-200 transition space-y-3">
      {proposal.status === "APPROVED" && proposal.questId ? (
        <Link href={`/groups/${groupId}/quests/${proposal.questId}`} className="flex items-center gap-4">
          {cardContent}
          <span className="text-xs text-blue-500 shrink-0">詳細 →</span>
        </Link>
      ) : (
        <div className="flex items-center gap-4">{cardContent}</div>
      )}

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
              <div>
                <label className="text-xs text-gray-500 block mb-1">タイトル</label>
                <input
                  type="text"
                  value={approveTitle}
                  onChange={(e) => setApproveTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">説明</label>
                <textarea
                  value={approveDescription}
                  onChange={(e) => setApproveDescription(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">報酬ポイント</label>
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
        body: JSON.stringify({ title, description }),
      });
      const data = await parseJson(res);
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
        <h3 className="font-semibold text-gray-800">クエストを提案</h3>
        <p className="text-xs text-gray-500 mt-1">
          管理者が審査し、承認されると正式なクエストとして発行されます
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

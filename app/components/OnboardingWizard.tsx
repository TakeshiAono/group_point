"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step =
  | "welcome"
  | "profile"
  | "create-group"
  | "issue-points"
  | "create-quest"
  | "invite"
  | "bonus"
  | "analytics"
  | "done";

const STEPS: Step[] = [
  "welcome",
  "profile",
  "create-group",
  "issue-points",
  "create-quest",
  "invite",
  "bonus",
  "analytics",
  "done",
];

const STEP_LABELS: Record<Step, string> = {
  welcome: "ようこそ",
  profile: "プロフィール設定",
  "create-group": "グループ作成",
  "issue-points": "ポイント発行",
  "create-quest": "クエスト投稿",
  invite: "メンバー招待",
  bonus: "ボーナスルール",
  analytics: "分析ページ",
  done: "完了",
};

type Props = {
  userName: string | null;
  onComplete: () => void;
};

export default function OnboardingWizard({ userName, onComplete }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState(userName ?? "");
  const [groupName, setGroupName] = useState("");
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [pointDelta, setPointDelta] = useState(100);
  const [questTitle, setQuestTitle] = useState("");
  const [questPoints, setQuestPoints] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const currentIndex = STEPS.indexOf(step);
  const progress = Math.round((currentIndex / (STEPS.length - 1)) * 100);

  function next() {
    const nextStep = STEPS[currentIndex + 1];
    if (nextStep) setStep(nextStep);
    setError("");
  }

  async function saveProfile() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "エラーが発生しました");
        return;
      }
      next();
    } finally {
      setLoading(false);
    }
  }

  async function createGroup() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "エラーが発生しました");
        return;
      }
      setCreatedGroupId(data.id);
      next();
    } finally {
      setLoading(false);
    }
  }

  async function issuePoints() {
    if (!createdGroupId) { next(); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/groups/${createdGroupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta: pointDelta }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "エラーが発生しました");
        return;
      }
      next();
    } finally {
      setLoading(false);
    }
  }

  async function createQuest() {
    if (!createdGroupId) { next(); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/groups/${createdGroupId}/quests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: questTitle,
          pointReward: questPoints,
          questType: "GOVERNMENT",
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "エラーが発生しました");
        return;
      }
      next();
    } finally {
      setLoading(false);
    }
  }

  async function completeOnboarding() {
    setLoading(true);
    try {
      await fetch("/api/me/onboarding", { method: "POST" });
      onComplete();
      if (createdGroupId) {
        router.push(`/groups/${createdGroupId}`);
      } else {
        router.push("/groups");
      }
    } finally {
      setLoading(false);
    }
  }

  async function skipOnboarding() {
    setLoading(true);
    try {
      await fetch("/api/me/onboarding", { method: "POST" });
      onComplete();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* プログレスバー */}
        <div className="bg-slate-100 h-1.5">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* ステップ名 */}
        <div className="px-6 pt-5 pb-1 flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            {currentIndex + 1} / {STEPS.length}
          </span>
          <span className="text-xs text-slate-400">—</span>
          <span className="text-xs font-medium text-indigo-600">
            {STEP_LABELS[step]}
          </span>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* ─── ようこそ ─── */}
          {step === "welcome" && (
            <>
              <h2 className="text-2xl font-bold text-slate-800">
                Group Point へようこそ！
              </h2>
              <p className="text-slate-600 text-sm leading-relaxed">
                このウィザードでは、グループの作成からポイント発行・クエスト管理まで、
                実際に操作しながら基本的な使い方をご案内します。
              </p>
              <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                <li>グループを作成してメンバーを招待する</li>
                <li>ポイントを発行してクエストに報酬を設定する</li>
                <li>ボーナスルールで早期完了を促す</li>
                <li>分析ページで貢献度を可視化する</li>
              </ul>
<div className="flex flex-col gap-2">
                <button
                  onClick={next}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium hover:from-indigo-500 hover:to-violet-500 transition"
                >
                  はじめる
                </button>
                <button
                  onClick={skipOnboarding}
                  disabled={loading}
                  className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 transition disabled:opacity-50"
                >
                  スキップして後で確認する
                </button>
              </div>
            </>
          )}

          {/* ─── プロフィール設定 ─── */}
          {step === "profile" && (
            <>
              <h2 className="text-xl font-bold text-slate-800">プロフィールを設定しましょう</h2>
              <p className="text-sm text-slate-600">
                メンバーに表示される名前を設定します。後からプロフィールページで変更できます。
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">表示名</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="名前を入力..."
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep("welcome")}
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition"
                >
                  戻る
                </button>
                <button
                  onClick={saveProfile}
                  disabled={loading || !name.trim()}
                  className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 transition"
                >
                  {loading ? "保存中..." : "保存して次へ"}
                </button>
              </div>
            </>
          )}

          {/* ─── グループ作成 ─── */}
          {step === "create-group" && (
            <>
              <h2 className="text-xl font-bold text-slate-800">グループを作成しましょう</h2>
              <p className="text-sm text-slate-600">
                グループはコミュニティの単位です。チーム名や組織名を入力してください。
                作成者は<strong>管理者</strong>になり、メンバーの招待やポイント発行ができます。
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">グループ名</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="例: 開発チームα"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep("profile")}
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition"
                >
                  戻る
                </button>
                <button
                  onClick={createGroup}
                  disabled={loading || !groupName.trim()}
                  className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 transition"
                >
                  {loading ? "作成中..." : "グループを作成"}
                </button>
              </div>
            </>
          )}

          {/* ─── ポイント発行 ─── */}
          {step === "issue-points" && (
            <>
              <h2 className="text-xl font-bold text-slate-800">ポイントを発行しましょう</h2>
              <p className="text-sm text-slate-600">
                管理者はグループポイントを発行できます。発行したポイントはクエストの報酬として使われます。
                メンバーがクエストを達成すると、このポイントがメンバーに配布されます。
              </p>
              <div className="bg-indigo-50 rounded-xl p-4 space-y-1">
                <p className="text-xs font-semibold text-indigo-700">💡 ポイントの流れ</p>
                <p className="text-xs text-indigo-600">発行済みポイント → クエスト報酬に割当 → メンバーへ配布</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">発行ポイント数</label>
                <input
                  type="number"
                  value={pointDelta}
                  onChange={(e) => setPointDelta(Number(e.target.value))}
                  min={1}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep("create-group")}
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition"
                >
                  戻る
                </button>
                <button
                  onClick={issuePoints}
                  disabled={loading || pointDelta <= 0}
                  className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 transition"
                >
                  {loading ? "発行中..." : `${pointDelta} pt 発行する`}
                </button>
              </div>
            </>
          )}

          {/* ─── クエスト作成 ─── */}
          {step === "create-quest" && (
            <>
              <h2 className="text-xl font-bold text-slate-800">クエストを作成しましょう</h2>
              <p className="text-sm text-slate-600">
                クエストはメンバーへの依頼です。達成したメンバーにポイントが支払われます。
                サブクエストに分割して複数人で協力することもできます。
              </p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">クエスト名</label>
                  <input
                    type="text"
                    value={questTitle}
                    onChange={(e) => setQuestTitle(e.target.value)}
                    placeholder="例: ドキュメントの整備"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">報酬ポイント</label>
                  <input
                    type="number"
                    value={questPoints}
                    onChange={(e) => setQuestPoints(Number(e.target.value))}
                    min={1}
                    max={pointDelta}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep("issue-points")}
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition"
                >
                  戻る
                </button>
                <button
                  onClick={createQuest}
                  disabled={loading || !questTitle.trim() || questPoints <= 0}
                  className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 transition"
                >
                  {loading ? "作成中..." : "クエストを作成"}
                </button>
              </div>
            </>
          )}

          {/* ─── メンバー招待 ─── */}
          {step === "invite" && (
            <>
              <h2 className="text-xl font-bold text-slate-800">メンバーを招待する</h2>
              <p className="text-sm text-slate-600">
                グループのメンバーページから招待を送ることができます。
                招待されたユーザーは承認・拒否を選べます。
              </p>
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-700">ロールの種類</p>
                <div className="space-y-1 text-xs text-slate-600">
                  <div className="flex gap-2">
                    <span className="font-bold text-violet-600 w-16 shrink-0">管理者</span>
                    <span>グループ作成者。全ての設定・招待・削除が可能</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-bold text-indigo-600 w-16 shrink-0">LEADER</span>
                    <span>政府関係者。メンバーの招待・クエスト管理が可能</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-bold text-slate-600 w-16 shrink-0">MEMBER</span>
                    <span>一般メンバー。クエスト受注・提案が可能</span>
                  </div>
                </div>
              </div>
              <button
                onClick={next}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium hover:from-indigo-500 hover:to-violet-500 transition"
              >
                次へ
              </button>
            </>
          )}

          {/* ─── ボーナスルール ─── */}
          {step === "bonus" && (
            <>
              <h2 className="text-xl font-bold text-slate-800">ボーナスルールについて</h2>
              <p className="text-sm text-slate-600">
                クエストには<strong>ボーナスルール</strong>を設定できます。
                早期完了にはボーナス、遅延にはペナルティを自動で計算します。
              </p>
              <div className="bg-amber-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-amber-700">💡 設定例</p>
                <div className="text-xs text-amber-700 space-y-1">
                  <p>・期間の80%以内に完了 → 報酬 +20%</p>
                  <p>・期間の110%（10%超過）→ 報酬 −10%</p>
                </div>
              </div>
              <p className="text-sm text-slate-600">
                クエスト詳細ページの「ボーナスルール」セクションから設定できます。
              </p>
              <button
                onClick={next}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium hover:from-indigo-500 hover:to-violet-500 transition"
              >
                次へ
              </button>
            </>
          )}

          {/* ─── 分析ページ ─── */}
          {step === "analytics" && (
            <>
              <h2 className="text-xl font-bold text-slate-800">分析ページで貢献を可視化</h2>
              <p className="text-sm text-slate-600">
                グループの<strong>分析ページ</strong>では、メンバーごとの獲得ポイント推移や
                貢献比率を円グラフ・折れ線グラフで確認できます。
              </p>
              <div className="bg-indigo-50 rounded-xl p-4 space-y-1">
                <p className="text-xs font-semibold text-indigo-700">📊 分析ページでできること</p>
                <ul className="text-xs text-indigo-600 space-y-0.5 list-disc list-inside">
                  <li>期間ごとのポイント獲得推移（折れ線）</li>
                  <li>メンバー別の貢献度分布（円グラフ）</li>
                  <li>グラフの線・凡例にホバーで詳細表示</li>
                </ul>
              </div>
              <button
                onClick={next}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium hover:from-indigo-500 hover:to-violet-500 transition"
              >
                次へ
              </button>
            </>
          )}

          {/* ─── 完了 ─── */}
          {step === "done" && (
            <>
              <h2 className="text-xl font-bold text-slate-800">セットアップ完了！</h2>
              <p className="text-sm text-slate-600">
                お疲れ様でした。グループの基本的な使い方をひと通り体験していただきました。
              </p>
              {createdGroupId && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-sm text-green-700">
                    <strong>「{groupName}」</strong>が作成されました。
                    サイドバーから引き続き操作できます。
                  </p>
                </div>
              )}
              <p className="text-sm text-slate-600">
                グループの設定はグループトップページの「設定」セクションから変更できます。
                わからないことがあればいつでも設定を見直してみてください。
              </p>
              <button
                onClick={completeOnboarding}
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 transition"
              >
                {loading ? "完了中..." : "グループを開く"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

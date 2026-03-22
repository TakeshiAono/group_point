"use client";

import { useRouter } from "next/navigation";
import { useOnboarding, OnboardingStep } from "@/lib/onboarding-context";

type StepConfig = {
  emoji: string;
  title: string;
  description: string;
  /** ユーザーが自分で操作するステップ（ボタン押下後に自動進行） */
  isAction?: boolean;
  /** 説明のみのステップ（「次へ」ボタンを表示） */
  isExplanation?: boolean;
  actionLabel?: string;
  /** アクションステップでも「スキップして次へ」ボタンを表示する */
  skippable?: boolean;
  /** 「このページへ」ボタン用のパス生成 */
  navigatePath?: (groupId: string | null) => string | null;
};

const STEP_CONFIG: Partial<Record<NonNullable<OnboardingStep>, StepConfig>> = {
  profile: {
    emoji: "👤",
    title: "プロフィールを設定しましょう",
    description: "名前を入力して「保存する」ボタンをクリックしてください。",
    isAction: true,
    navigatePath: () => "/profile",
  },
  "create-group": {
    emoji: "🏠",
    title: "グループを作成しましょう",
    description: "左サイドバー上部の「グループを作成」ボタンをクリックしてください。",
    isAction: true,
    navigatePath: () => "/groups",
  },
  "issue-points": {
    emoji: "💰",
    title: "ポイントを発行しましょう",
    description: "管理者はグループポイントを発行できます。「発行する」ボタンをクリックしてください。",
    isAction: true,
    navigatePath: (gid) => gid ? `/groups/${gid}` : null,
  },
  "reclaim-points": {
    emoji: "♻️",
    title: "流通中ポイントと未流通ポイント",
    description:
      "発行したポイントは「流通中」と「未流通」に分かれます。\n\n" +
      "・流通中：メンバーが保有しているポイント＋進行中クエストに割り当て済みのポイント\n" +
      "・未流通：発行済みだがまだ誰にも渡っていないポイント\n\n" +
      "回収できるのは未流通分のみです。クエストの報酬として割り当てることで流通中になります。",
    isExplanation: true,
    actionLabel: "グループトップへ",
    navigatePath: (gid) => gid ? `/groups/${gid}` : null,
  },
  "create-quest": {
    emoji: "📋",
    title: "クエスト一覧へ移動しましょう",
    description: "グループトップの「クエスト」カードをクリックしてクエスト一覧ページへ移動してください。",
    isAction: true,
    navigatePath: (gid) => gid ? `/groups/${gid}` : null,
  },
  "quest-proposals": {
    emoji: "💡",
    title: "クエスト提案機能",
    description:
      "メンバーは自分でクエストを提案できます。提案には希望報酬ポイントを設定でき、管理者・マネージャーが承認するとクエストとして発行されます。メンバーの主体性を引き出す重要な機能です。",
    isExplanation: true,
    actionLabel: "次へ",
    navigatePath: (gid) => (gid ? `/groups/${gid}/quest-proposals` : null),
  },
  invite: {
    emoji: "📨",
    title: "メンバーを招待しましょう",
    description:
      "招待フォームにメールアドレスを入力して「招待を送る」をクリックしてください。招待されたユーザーがアプリにログインすると承認・拒否できます。",
    isAction: true,
    skippable: true,
    navigatePath: (gid) => (gid ? `/groups/${gid}/members` : null),
  },
  bonus: {
    emoji: "🎯",
    title: "ボーナスルール",
    description:
      "クエストにボーナスルールを設定すると、早期完了で報酬アップ・遅延でペナルティを自動計算できます。クエスト詳細ページの「ボーナスルール」セクションから設定できます。",
    isExplanation: true,
    actionLabel: "次へ",
  },
  analytics: {
    emoji: "📊",
    title: "分析ページで貢献を確認",
    description:
      "メンバーごとのポイント獲得推移や貢献比率をグラフで確認できます。グラフにホバーするとメンバー名とポイントが表示されます。",
    isExplanation: true,
    actionLabel: "完了",
    navigatePath: (gid) => (gid ? `/groups/${gid}/analytics` : null),
  },
};

const STEP_ORDER: NonNullable<OnboardingStep>[] = [
  "welcome",
  "profile",
  "create-group",
  "issue-points",
  "reclaim-points",
  "create-quest",
  "quest-proposals",
  "invite",
  "bonus",
  "analytics",
];

export default function OnboardingGuide() {
  const ctx = useOnboarding();
  const router = useRouter();

  if (!ctx || !ctx.step || ctx.step === "welcome") return null;

  const { step, createdGroupId, advance, back, complete, skip } = ctx;
  const config = STEP_CONFIG[step];
  if (!config) return null;

  const stepIndex = STEP_ORDER.indexOf(step);
  const total = STEP_ORDER.length - 1; // welcome は除く

  async function handleAction() {
    if (step === "analytics") {
      await complete();
    } else {
      advance();
      if (config?.navigatePath) {
        const path = config.navigatePath(createdGroupId);
        if (path) router.push(path);
      }
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* プログレスバー */}
        <div className="bg-slate-100 h-1">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
            style={{ width: `${((stepIndex) / total) * 100}%` }}
          />
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">{config.emoji}</span>
            <div>
              <p className="text-xs text-slate-400">
                ステップ {stepIndex} / {total}
              </p>
              <h3 className="text-sm font-bold text-slate-800 leading-snug">{config.title}</h3>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{config.description}</p>

          {/* このステップの画面へ移動 */}
          {config.navigatePath && (() => {
            const path = config.navigatePath(createdGroupId);
            return path ? (
              <button
                onClick={() => router.push(path)}
                className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg transition text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                このステップの画面へ
              </button>
            ) : null;
          })()}

          {/* ページ移動ボタン（対象ページにいない場合のヘルプ） */}
          {config.navigatePath && !config.isAction && (
            <button
              onClick={() => {
                const path = config.navigatePath!(createdGroupId);
                if (path) router.push(path);
              }}
              className="w-full py-1.5 text-xs border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 transition"
            >
              このページへ移動
            </button>
          )}

          {/* 説明ステップの「次へ」/「完了」 */}
          {config.isExplanation && (
            <button
              onClick={handleAction}
              className="w-full py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm rounded-xl font-medium hover:from-indigo-500 hover:to-violet-500 transition"
            >
              {config.actionLabel ?? "次へ"}
            </button>
          )}

          {/* アクションステップはヒント表示 */}
          {config.isAction && (
            <p className="text-xs text-indigo-500 font-medium">
              ↑ 上のボタンをクリックすると自動で次へ進みます
            </p>
          )}

          {/* スキップ可能なアクションステップ */}
          {config.isAction && config.skippable && (
            <button
              onClick={handleAction}
              className="w-full py-1.5 text-xs border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 transition"
            >
              招待せずに次へ
            </button>
          )}

          <div className="flex items-center pt-1">
            <button
              onClick={back}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              戻る
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

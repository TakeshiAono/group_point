"use client";

import { useOnboarding } from "@/lib/onboarding-context";
import { useState } from "react";

export default function OnboardingWelcome() {
  const ctx = useOnboarding();
  const [skipping, setSkipping] = useState(false);

  if (!ctx || ctx.step !== "welcome") return null;

  async function handleSkip() {
    if (!ctx) return;
    setSkipping(true);
    await ctx.skip();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5">
          <h2 className="text-2xl font-bold text-white">Group Point へようこそ！</h2>
          <p className="text-indigo-200 text-sm mt-1">まずは基本的な使い方をご案内します</p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-slate-600 text-sm leading-relaxed">
            組織やコミュニティが活発になるためには、一人ひとりが<strong>能動的に動く仕組み</strong>が必要です。
            Group Point は、貢献に対してポイントで報いることで<strong>インセンティブを見える化</strong>し、
            メンバーが自発的に動きたくなるコミュニティをつくるためのツールです。
          </p>

          <div className="bg-indigo-50 rounded-xl p-4 space-y-1.5">
            <p className="text-xs font-semibold text-indigo-700">このガイドでやること</p>
            <ol className="text-xs text-indigo-600 space-y-0.5 list-decimal list-inside">
              <li>プロフィールを設定する</li>
              <li>グループを作成する</li>
              <li>ポイントを発行する</li>
              <li>クエスト（依頼）を作成する</li>
              <li>クエスト提案機能を知る</li>
              <li>メンバーを招待する</li>
              <li>ボーナスルールを知る</li>
              <li>分析ページを確認する</li>
            </ol>
          </div>

          <p className="text-xs text-slate-400">
            実際の画面を操作しながら進めます。各ステップで画面右下のガイドに従ってください。
          </p>

          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={() => ctx.start()}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium hover:from-indigo-500 hover:to-violet-500 transition"
            >
              ガイドをはじめる
            </button>
            <button
              onClick={handleSkip}
              disabled={skipping}
              className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 transition disabled:opacity-50"
            >
              スキップして後で確認する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

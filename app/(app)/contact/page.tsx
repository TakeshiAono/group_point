"use client";

import { useState } from "react";

export default function ContactPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) { setError(data.error ?? "エラーが発生しました"); return; }
      setSuccess(true);
      setTitle("");
      setMessage("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      {/* ページヘッダー */}
      <div className="relative bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 rounded-2xl p-6 shadow-xl overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="relative">
          <h2 className="text-2xl font-bold text-white">開発者へのお問い合わせ</h2>
          <p className="text-indigo-200 text-sm mt-1">ご意見・ご要望・バグ報告などをお送りください。</p>
        </div>
      </div>

      {/* SNSリンク */}
      <div className="bg-white border border-slate-100 rounded-2xl px-6 py-5 flex items-center gap-4 shadow-sm hover:shadow-md transition">
        <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.261 5.635 5.903-5.635zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">開発者 SNS</p>
          <p className="text-xs text-slate-400 mt-0.5">気軽にDMもどうぞ</p>
        </div>
        <a
          href="https://x.com/takeshi_program"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-black text-white text-sm rounded-xl hover:bg-slate-800 transition shadow"
        >
          @takeshi_program
        </a>
      </div>

      {/* お問い合わせフォーム */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <p className="text-sm font-bold text-slate-700 mb-5 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-gradient-to-b from-indigo-500 to-violet-600 rounded-full inline-block" />
          フォームで送る
        </p>
        {success ? (
          <div className="text-center py-10 space-y-3">
            <div className="text-5xl mb-2">✅</div>
            <p className="text-green-600 font-semibold text-lg">送信しました。ありがとうございます！</p>
            <button
              onClick={() => setSuccess(false)}
              className="text-sm text-indigo-600 hover:text-indigo-800 transition"
            >
              続けて送る
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">タイトル</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例：○○機能のバグについて"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">メッセージ</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="詳細をご記入ください"
                rows={6}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none bg-slate-50"
                required
              />
            </div>
            {error && (
              <div className="px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition shadow-lg shadow-indigo-200"
            >
              {submitting ? "送信中..." : "送信する"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

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
    <main className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">開発者へのお問い合わせ</h2>
        <p className="text-sm text-gray-500 mt-1">ご意見・ご要望・バグ報告などをお送りください。</p>
      </div>

      {/* SNSリンク */}
      <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 flex items-center gap-4">
        <div>
          <p className="text-sm font-medium text-gray-700">開発者 SNS</p>
          <p className="text-xs text-gray-400 mt-0.5">気軽にDMもどうぞ</p>
        </div>
        <a
          href="https://x.com/takeshi_program"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.261 5.635 5.903-5.635zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
          </svg>
          @takeshi_program
        </a>
      </div>

      {/* お問い合わせフォーム */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <p className="text-sm font-medium text-gray-700 mb-4">フォームで送る</p>
        {success ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-green-600 font-medium">送信しました。ありがとうございます！</p>
            <button
              onClick={() => setSuccess(false)}
              className="text-sm text-blue-600 hover:text-blue-800 transition"
            >
              続けて送る
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">タイトル</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例：○○機能のバグについて"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">メッセージ</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="詳細をご記入ください"
                rows={6}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {submitting ? "送信中..." : "送信する"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

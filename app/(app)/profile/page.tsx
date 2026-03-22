"use client";

import { useEffect, useRef, useState } from "react";
import { useOnboarding } from "@/lib/onboarding-context";

export default function ProfilePage() {
  const onboarding = useOnboarding();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setName(d.name ?? "");
          setEmail(d.email ?? "");
        }
      });

    // アイコン画像の署名付きURLを取得して表示
    fetch("/api/avatar/download-url")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.url) setAvatarUrl(d.url); })
      .catch(() => {});
  }, []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    setError("");
    try {
      // アップロード用署名付きURLを取得
      const res = await fetch("/api/avatar/upload-url");
      if (!res.ok) throw new Error("URL取得失敗");
      const { url } = await res.json();

      // S3 に直接アップロード
      const uploadRes = await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "image/jpeg" },
      });
      if (!uploadRes.ok) throw new Error("アップロード失敗");

      // ダウンロードURLを再取得して表示更新
      const dlRes = await fetch("/api/avatar/download-url");
      const dlData = await dlRes.json();
      if (dlData?.url) setAvatarUrl(dlData.url);

      setSuccess("アイコンを更新しました");
    } catch {
      setError("アイコンのアップロードに失敗しました");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const body: Record<string, string> = { name };
      if (newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "エラーが発生しました");
        return;
      }
      setSuccess("プロフィールを更新しました");
      setCurrentPassword("");
      setNewPassword("");
      if (onboarding?.step === "profile") onboarding.onProfileSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-10">
      <h2 className="text-2xl font-bold text-gray-800 mb-8">プロフィール編集</h2>

      {/* アイコン */}
      <div className="flex flex-col items-center mb-8">
        <div
          className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden cursor-pointer border-2 border-gray-300 hover:border-blue-400 transition"
          onClick={() => fileInputRef.current?.click()}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="アイコン"
              className="w-full h-full object-cover"
              onError={() => setAvatarUrl(null)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              {avatarUploading ? (
                <span className="text-gray-400 text-xs">...</span>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-14 h-14 text-gray-400">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                </svg>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          className="mt-2 text-xs text-blue-600 hover:underline"
          onClick={() => fileInputRef.current?.click()}
          disabled={avatarUploading}
        >
          {avatarUploading ? "アップロード中..." : "アイコンを変更"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="名前"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <hr className="border-gray-100" />

        <p className="text-sm font-medium text-gray-700">パスワード変更（任意）</p>

        <div>
          <label className="block text-xs text-gray-500 mb-1">現在のパスワード</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="現在のパスワード"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">新しいパスワード</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="新しいパスワード（8文字以上）"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <button
          type="submit"
          disabled={saving}
          className={`w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition${onboarding?.step === "profile" ? " onboarding-highlight" : ""}`}
        >
          {saving ? "保存中..." : "保存する"}
        </button>
      </form>
    </div>
  );
}

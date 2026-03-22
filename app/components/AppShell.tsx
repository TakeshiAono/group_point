"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Sidebar from "./Sidebar";
import UserAvatar from "./UserAvatar";
import { logout } from "@/app/actions/auth";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [me, setMe] = useState<{ id: string; name: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/me").then((r) => r.ok ? r.json() : null).then(setMe);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 z-10 shrink-0 shadow-lg">
        <div className="px-4 py-3 flex items-center gap-4">
          {/* サイドバートグル */}
          <button
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
            aria-label="サイドバーを切り替え"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link href="/" className="text-lg font-bold text-white mr-auto tracking-wide flex items-center gap-2">
            <span className="text-2xl">⬡</span>
            Group Point
          </Link>

          <nav className="flex items-center gap-1">
            {[
              { href: "/quests", label: "案件一覧" },
              { href: "/subquests", label: "サブクエスト" },
              { href: "/contact", label: "お問い合わせ" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-sm text-white/80 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded-lg transition"
              >
                {label}
              </Link>
            ))}
            {/* プロフィールリンク（アイコン付き） */}
            <Link
              href="/profile"
              className="flex items-center gap-2 text-sm text-white/80 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded-lg transition"
            >
              {me && <UserAvatar userId={me.id} name={me.name} size="sm" />}
              <span>プロフィール</span>
            </Link>
          </nav>

          <form action={logout}>
            <button
              type="submit"
              className="text-sm px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition"
            >
              ログアウト
            </button>
          </form>
        </div>
      </header>

      {/* サイドバー＋メインコンテンツ */}
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && <Sidebar />}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

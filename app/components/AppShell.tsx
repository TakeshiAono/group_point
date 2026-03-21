"use client";

import { useState } from "react";
import Link from "next/link";
import Sidebar from "./Sidebar";
import { logout } from "@/app/actions/auth";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 z-10 shrink-0">
        <div className="px-4 py-3 flex items-center gap-4">
          {/* サイドバートグル */}
          <button
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition"
            aria-label="サイドバーを切り替え"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link href="/" className="text-lg font-bold text-gray-800 mr-auto">
            Group Point
          </Link>

          <Link
            href="/quests"
            className="text-sm text-gray-600 hover:text-blue-600 transition"
          >
            案件一覧
          </Link>
          <Link
            href="/profile"
            className="text-sm text-gray-600 hover:text-blue-600 transition"
          >
            プロフィール
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
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

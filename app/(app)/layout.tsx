import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/app/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 z-10 shrink-0">
        <div className="px-6 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-gray-800">
            Group Point
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/quests"
              className="text-sm text-gray-600 hover:text-blue-600 transition"
            >
              案件
            </Link>
            <Link
              href="/profile"
              className="text-sm text-gray-600 hover:text-blue-600 transition"
            >
              {session.user?.name ?? session.user?.email}
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* サイドバー＋メインコンテンツ */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

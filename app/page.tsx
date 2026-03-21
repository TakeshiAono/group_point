import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import InvitationList from "./InvitationList";

export default async function HomePage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Group Point</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {session.user?.name ?? session.user?.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="text-sm px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">
            ようこそ、{session.user?.name ?? session.user?.email} さん
          </h2>
          <p className="text-gray-500">ログインに成功しました。</p>
        </div>

        <nav className="flex gap-4">
          <Link
            href="/groups"
            className="px-5 py-3 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition"
          >
            グループ管理
          </Link>
        </nav>

        <InvitationList />
      </main>
    </div>
  );
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import InvitationList from "@/app/InvitationList";

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      {/* ウェルカムバナー */}
      <div className="relative bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 rounded-2xl p-8 shadow-xl overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />
        <div className="relative">
          <p className="text-indigo-200 text-sm font-medium mb-1">ようこそ</p>
          <h2 className="text-3xl font-bold text-white">
            {session.user?.name ?? session.user?.email}
            <span className="text-indigo-200"> さん</span>
          </h2>
          <p className="text-indigo-200 text-sm mt-2">左のサイドバーからグループを選択してください。</p>
        </div>
      </div>

      <InvitationList />
    </div>
  );
}
